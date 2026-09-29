package com.tifloacosta.app.reading;

import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;

import androidx.annotation.Nullable;
import androidx.media3.common.AudioAttributes;
import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.Player;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.session.MediaSession;
import androidx.media3.session.MediaSessionService;
import androidx.media3.session.SessionCommand;
import androidx.media3.session.SessionCommands;
import androidx.media3.session.SessionResult;

import com.google.common.util.concurrent.Futures;
import com.google.common.util.concurrent.ListenableFuture;

import java.io.File;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

public final class ReadingAudioService extends MediaSessionService {
    public static final long POSITION_PERSIST_INTERVAL_MS = 5000L;
    private static final long MINUTE_MS = 60_000L;

    public static final String ACTION_AUDIO_INTERRUPTED =
            "com.tifloacosta.app.reading.ACTION_AUDIO_INTERRUPTED";
    public static final String ACTION_AUDIO_ENDED =
            "com.tifloacosta.app.reading.ACTION_AUDIO_ENDED";
    public static final String EXTRA_BOOK_ID = "bookId";
    public static final String EXTRA_RELATIVE_PATH = "relativePath";
    public static final String EXTRA_TRACK_INDEX = "trackIndex";
    public static final String EXTRA_POSITION_MS = "positionMs";
    public static final String EXTRA_DURATION_MS = "durationMs";
    public static final String EXTRA_REASON = "reason";
    public static final String EXTRA_SLEEP_MINUTES = "sleepMinutes";
    public static final String EXTRA_SLEEP_AT_TRACK_END = "sleepAtTrackEnd";

    public static final String COMMAND_PREPARE_AUDIO =
            "com.tifloacosta.app.reading.PREPARE_AUDIO";
    public static final String COMMAND_SET_SLEEP_TIMER =
            "com.tifloacosta.app.reading.SET_SLEEP_TIMER";
    public static final String COMMAND_CANCEL_SLEEP_TIMER =
            "com.tifloacosta.app.reading.CANCEL_SLEEP_TIMER";

    public static final SessionCommand PREPARE_AUDIO_COMMAND =
            new SessionCommand(COMMAND_PREPARE_AUDIO, Bundle.EMPTY);
    public static final SessionCommand SET_SLEEP_TIMER_COMMAND =
            new SessionCommand(COMMAND_SET_SLEEP_TIMER, Bundle.EMPTY);
    public static final SessionCommand CANCEL_SLEEP_TIMER_COMMAND =
            new SessionCommand(COMMAND_CANCEL_SLEEP_TIMER, Bundle.EMPTY);

    private ExoPlayer player;
    private MediaSession mediaSession;
    private ReadingLibraryDatabase database;
    private boolean sleepAtTrackEnd;

    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final Runnable positionPersistenceTicker = new Runnable() {
        @Override
        public void run() {
            if (player == null || !player.isPlaying()) return;
            persistCurrentPosition(false);
            mainHandler.postDelayed(this, POSITION_PERSIST_INTERVAL_MS);
        }
    };
    private final Runnable sleepTimerAction = () -> {
        if (player == null) return;
        player.pause();
        persistCurrentPosition(false);
        clearSleepTimerState();
        sendPlaybackEvent(ACTION_AUDIO_INTERRUPTED, "sleep-timer");
    };

    @Override
    public void onCreate() {
        super.onCreate();
        database = new ReadingLibraryDatabase(getApplicationContext());

        AudioAttributes audioAttributes = new AudioAttributes.Builder()
                .setUsage(C.USAGE_MEDIA)
                .setContentType(C.AUDIO_CONTENT_TYPE_SPEECH)
                .build();

        player = new ExoPlayer.Builder(this)
                .setAudioAttributes(audioAttributes, true)
                .setHandleAudioBecomingNoisy(true)
                .build();
        player.addListener(new PlaybackListener());

        mediaSession = new MediaSession.Builder(this, player)
                .setCallback(new SessionCallback())
                .build();
    }

    @Override
    @Nullable
    public MediaSession onGetSession(MediaSession.ControllerInfo controllerInfo) {
        return mediaSession;
    }

    @Override
    public void onDestroy() {
        mainHandler.removeCallbacks(positionPersistenceTicker);
        mainHandler.removeCallbacks(sleepTimerAction);
        persistCurrentPosition(false);
        if (mediaSession != null) {
            mediaSession.release();
            mediaSession = null;
        }
        if (player != null) {
            player.release();
            player = null;
        }
        if (database != null) {
            database.close();
            database = null;
        }
        super.onDestroy();
    }

    private void prepareAudio(String bookId, String relativePath, int trackIndex, long positionMs) throws IOException {
        List<ReadingAudioTrackRecord> tracks = database == null
                ? new ArrayList<>()
                : database.listAudioTracks(bookId);
        List<MediaItem> items = new ArrayList<>();

        if (!tracks.isEmpty()) {
            for (ReadingAudioTrackRecord track : tracks) {
                File source = resolveReadingFile(bookId, track.getRelativePath());
                items.add(mediaItem(bookId, source));
            }
        } else {
            File source = resolveReadingFile(bookId, relativePath);
            items.add(mediaItem(bookId, source));
        }

        if (items.isEmpty()) throw new IOException("Reading audio source is missing");
        int startIndex = Math.min(Math.max(0, trackIndex), items.size() - 1);
        cancelSleepTimer();
        player.pause();
        player.setMediaItems(items, startIndex, Math.max(0L, positionMs));
        player.prepare();
    }

    private static MediaItem mediaItem(String bookId, File source) {
        return new MediaItem.Builder()
                .setMediaId(bookId)
                .setUri(Uri.fromFile(source))
                .build();
    }

    private File resolveReadingFile(String bookId, String relativePath) throws IOException {
        File root = new File(getFilesDir(), "reading-library");
        if (relativePath != null && !relativePath.trim().isEmpty()) {
            File source = new File(root, relativePath);
            String rootPath = root.getCanonicalPath();
            String sourcePath = source.getCanonicalPath();
            if (!sourcePath.startsWith(rootPath + File.separator) || !source.isFile()) {
                throw new IOException("Invalid reading audio path");
            }
            return source;
        }

        String cleanBookId = bookId == null ? "" : bookId.trim();
        if (cleanBookId.isEmpty() || !cleanBookId.matches("[A-Za-z0-9_-]+")) {
            throw new IOException("Invalid reading audio book id");
        }
        File itemsRoot = new File(root, "items");
        File itemDirectory = new File(itemsRoot, cleanBookId);
        String itemsPath = itemsRoot.getCanonicalPath();
        String itemPath = itemDirectory.getCanonicalPath();
        if (!itemPath.startsWith(itemsPath + File.separator) || !itemDirectory.isDirectory()) {
            throw new IOException("Reading audio item not found");
        }
        File[] candidates = itemDirectory.listFiles(file ->
                file != null && file.isFile() && (file.getName().startsWith("source.") || file.getName().startsWith("track-")));
        if (candidates == null || candidates.length != 1) {
            throw new IOException("Reading audio source is ambiguous or missing");
        }
        return candidates[0];
    }

    private void persistCurrentPosition(boolean completed) {
        if (player == null || database == null) return;
        MediaItem currentItem = player.getCurrentMediaItem();
        if (currentItem == null) return;
        String bookId = currentItem.mediaId == null ? "" : currentItem.mediaId.trim();
        if (bookId.isEmpty()) return;

        ReadingBookRecord record = database.findById(bookId);
        if (record == null) return;

        int trackIndex = Math.max(0, player.getCurrentMediaItemIndex());
        long positionMs = Math.max(0L, player.getCurrentPosition());
        boolean finished = completed
                || player.getPlaybackState() == Player.STATE_ENDED
                || "read".equals(record.getState());
        double percent = finished ? 100.0 : calculateGlobalPercent(bookId, trackIndex, positionMs);
        database.updateProgress(
                bookId,
                record.getBlockIndex(),
                record.getUnitIndex(),
                record.getAnchorText(),
                trackIndex,
                positionMs,
                percent,
                finished ? "read" : "in-reading",
                System.currentTimeMillis()
        );
    }

    private double calculateGlobalPercent(String bookId, int trackIndex, long positionMs) {
        if (database == null || player == null) return 0.0;
        List<ReadingAudioTrackRecord> tracks = database.listAudioTracks(bookId);
        long totalDurationMs = 0L;
        long elapsedMs = 0L;
        if (!tracks.isEmpty()) {
            for (ReadingAudioTrackRecord track : tracks) {
                long durationMs = Math.max(0L, track.getDurationMs());
                if (track.getTrackIndex() < trackIndex) elapsedMs = safeAdd(elapsedMs, durationMs);
                totalDurationMs = safeAdd(totalDurationMs, durationMs);
            }
            if (trackIndex < tracks.size()) {
                long currentDuration = Math.max(0L, tracks.get(trackIndex).getDurationMs());
                elapsedMs = safeAdd(elapsedMs, currentDuration > 0L ? Math.min(positionMs, currentDuration) : positionMs);
            }
        }

        if (totalDurationMs <= 0L && (tracks.isEmpty() || tracks.size() == 1)) {
            long durationMs = player.getDuration();
            if (durationMs != C.TIME_UNSET && durationMs > 0L) {
                totalDurationMs = durationMs;
                elapsedMs = Math.min(positionMs, durationMs);
            }
        }
        if (totalDurationMs <= 0L) return 0.0;
        return Math.min(100.0, Math.max(0.0, (elapsedMs * 100.0) / totalDurationMs));
    }

    private static long safeAdd(long left, long right) {
        if (right > 0L && left > Long.MAX_VALUE - right) return Long.MAX_VALUE;
        return left + right;
    }

    private void schedulePositionPersistence() {
        mainHandler.removeCallbacks(positionPersistenceTicker);
        if (player != null && player.isPlaying()) {
            mainHandler.postDelayed(positionPersistenceTicker, POSITION_PERSIST_INTERVAL_MS);
        }
    }

    private boolean setSleepTimer(int minutes, boolean atTrackEnd) {
        cancelSleepTimer();
        if (atTrackEnd) {
            sleepAtTrackEnd = true;
            return true;
        }
        if (minutes != 15 && minutes != 30 && minutes != 45 && minutes != 60) return false;
        mainHandler.postDelayed(sleepTimerAction, minutes * MINUTE_MS);
        return true;
    }

    private void cancelSleepTimer() {
        mainHandler.removeCallbacks(sleepTimerAction);
        clearSleepTimerState();
    }

    private void clearSleepTimerState() {
        sleepAtTrackEnd = false;
    }

    private void sendPlaybackEvent(String action, @Nullable String reason) {
        if (player == null) return;

        android.content.Intent intent = new android.content.Intent(action);
        intent.setPackage(getPackageName());

        MediaItem currentItem = player.getCurrentMediaItem();
        intent.putExtra(EXTRA_BOOK_ID, currentItem == null ? "" : currentItem.mediaId);
        intent.putExtra(EXTRA_TRACK_INDEX, Math.max(0, player.getCurrentMediaItemIndex()));
        intent.putExtra(EXTRA_POSITION_MS, Math.max(0L, player.getCurrentPosition()));
        long durationMs = player.getDuration();
        intent.putExtra(EXTRA_DURATION_MS, durationMs == C.TIME_UNSET ? 0L : Math.max(0L, durationMs));
        if (reason != null) intent.putExtra(EXTRA_REASON, reason);
        sendBroadcast(intent);
    }

    private final class PlaybackListener implements Player.Listener {
        @Override
        public void onIsPlayingChanged(boolean isPlaying) {
            if (isPlaying) schedulePositionPersistence();
            else {
                mainHandler.removeCallbacks(positionPersistenceTicker);
                persistCurrentPosition(false);
            }
        }

        @Override
        public void onPlayWhenReadyChanged(
                boolean playWhenReady,
                @Player.PlayWhenReadyChangeReason int reason
        ) {
            if (playWhenReady) return;
            if (reason == Player.PLAY_WHEN_READY_CHANGE_REASON_AUDIO_FOCUS_LOSS) {
                persistCurrentPosition(false);
                sendPlaybackEvent(ACTION_AUDIO_INTERRUPTED, "audio-focus-loss");
            } else if (reason == Player.PLAY_WHEN_READY_CHANGE_REASON_AUDIO_BECOMING_NOISY) {
                persistCurrentPosition(false);
                sendPlaybackEvent(ACTION_AUDIO_INTERRUPTED, "audio-becoming-noisy");
            }
        }

        @Override
        public void onPlaybackSuppressionReasonChanged(
                @Player.PlaybackSuppressionReason int playbackSuppressionReason
        ) {
            if (playbackSuppressionReason == Player.PLAYBACK_SUPPRESSION_REASON_TRANSIENT_AUDIO_FOCUS_LOSS
                    && player != null
                    && player.getPlayWhenReady()) {
                player.pause();
                persistCurrentPosition(false);
                sendPlaybackEvent(ACTION_AUDIO_INTERRUPTED, "audio-focus-loss");
            }
        }

        @Override
        public void onMediaItemTransition(@Nullable MediaItem mediaItem, @Player.MediaItemTransitionReason int reason) {
            if (mediaItem == null) return;
            if (sleepAtTrackEnd && reason == Player.MEDIA_ITEM_TRANSITION_REASON_AUTO && player != null) {
                clearSleepTimerState();
                player.pause();
                persistCurrentPosition(false);
                sendPlaybackEvent(ACTION_AUDIO_INTERRUPTED, "sleep-track-end");
            } else {
                persistCurrentPosition(false);
            }
        }

        @Override
        public void onPlaybackStateChanged(@Player.State int playbackState) {
            if (playbackState == Player.STATE_ENDED) {
                cancelSleepTimer();
                persistCurrentPosition(true);
                sendPlaybackEvent(ACTION_AUDIO_ENDED, null);
            }
        }
    }

    private final class SessionCallback implements MediaSession.Callback {
        @Override
        @UnstableApi
        public ListenableFuture<MediaSession.ConnectionResult> onConnectAsync(
                MediaSession session,
                MediaSession.ControllerInfo controller
        ) {
            if (!getPackageName().equals(controller.getPackageName())) {
                return MediaSession.Callback.super.onConnectAsync(session, controller);
            }

            SessionCommands sessionCommands =
                    MediaSession.ConnectionResult.DEFAULT_SESSION_COMMANDS
                            .buildUpon()
                            .add(PREPARE_AUDIO_COMMAND)
                            .add(SET_SLEEP_TIMER_COMMAND)
                            .add(CANCEL_SLEEP_TIMER_COMMAND)
                            .build();
            return Futures.immediateFuture(
                    new MediaSession.ConnectionResult.AcceptedResultBuilder(session, controller)
                            .setAvailableSessionCommands(sessionCommands)
                            .build()
            );
        }

        @Override
        public ListenableFuture<SessionResult> onCustomCommand(
                MediaSession session,
                MediaSession.ControllerInfo controller,
                SessionCommand customCommand,
                Bundle args
        ) {
            if (!getPackageName().equals(controller.getPackageName())) {
                return Futures.immediateFuture(new SessionResult(SessionResult.RESULT_ERROR_PERMISSION_DENIED));
            }

            if (COMMAND_CANCEL_SLEEP_TIMER.equals(customCommand.customAction)) {
                cancelSleepTimer();
                return Futures.immediateFuture(new SessionResult(SessionResult.RESULT_SUCCESS));
            }

            if (COMMAND_SET_SLEEP_TIMER.equals(customCommand.customAction)) {
                int minutes = Math.max(0, args.getInt(EXTRA_SLEEP_MINUTES, 0));
                boolean atTrackEnd = args.getBoolean(EXTRA_SLEEP_AT_TRACK_END, false);
                int result = setSleepTimer(minutes, atTrackEnd)
                        ? SessionResult.RESULT_SUCCESS
                        : SessionResult.RESULT_ERROR_BAD_VALUE;
                return Futures.immediateFuture(new SessionResult(result));
            }

            if (!COMMAND_PREPARE_AUDIO.equals(customCommand.customAction)) {
                return Futures.immediateFuture(new SessionResult(SessionResult.RESULT_ERROR_PERMISSION_DENIED));
            }

            String bookId = args.getString(EXTRA_BOOK_ID, "").trim();
            String relativePath = args.getString(EXTRA_RELATIVE_PATH, "").trim();
            int trackIndex = Math.max(0, args.getInt(EXTRA_TRACK_INDEX, 0));
            long positionMs = Math.max(0L, args.getLong(EXTRA_POSITION_MS, 0L));
            if (bookId.isEmpty()) {
                return Futures.immediateFuture(new SessionResult(SessionResult.RESULT_ERROR_BAD_VALUE));
            }

            try {
                prepareAudio(bookId, relativePath, trackIndex, positionMs);
                return Futures.immediateFuture(new SessionResult(SessionResult.RESULT_SUCCESS));
            } catch (IOException | RuntimeException error) {
                return Futures.immediateFuture(new SessionResult(SessionResult.RESULT_ERROR_IO));
            }
        }
    }
}
