package com.tifloacosta.app.reading;

import android.net.Uri;
import android.os.Bundle;

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

public final class ReadingAudioService extends MediaSessionService {
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
    public static final String COMMAND_PREPARE_AUDIO =
            "com.tifloacosta.app.reading.PREPARE_AUDIO";
    public static final SessionCommand PREPARE_AUDIO_COMMAND =
            new SessionCommand(COMMAND_PREPARE_AUDIO, Bundle.EMPTY);

    private ExoPlayer player;
    private MediaSession mediaSession;

    @Override
    public void onCreate() {
        super.onCreate();

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
        if (mediaSession != null) {
            mediaSession.release();
            mediaSession = null;
        }
        if (player != null) {
            player.release();
            player = null;
        }
        super.onDestroy();
    }

    private void prepareAudio(String bookId, String relativePath, long positionMs) throws IOException {
        File source = resolveReadingFile(bookId, relativePath);
        MediaItem item = new MediaItem.Builder()
                .setMediaId(bookId)
                .setUri(Uri.fromFile(source))
                .build();

        player.pause();
        player.setMediaItem(item, Math.max(0L, positionMs));
        player.prepare();
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
                file != null && file.isFile() && file.getName().startsWith("source."));
        if (candidates == null || candidates.length != 1) {
            throw new IOException("Reading audio source is ambiguous or missing");
        }
        return candidates[0];
    }

    private void sendPlaybackEvent(String action, @Nullable String reason) {
        if (player == null) return;

        android.content.Intent intent = new android.content.Intent(action);
        intent.setPackage(getPackageName());

        MediaItem currentItem = player.getCurrentMediaItem();
        intent.putExtra(EXTRA_BOOK_ID, currentItem == null ? "" : currentItem.mediaId);
        intent.putExtra(EXTRA_POSITION_MS, Math.max(0L, player.getCurrentPosition()));
        long durationMs = player.getDuration();
        intent.putExtra(EXTRA_DURATION_MS, durationMs == C.TIME_UNSET ? 0L : Math.max(0L, durationMs));
        if (reason != null) intent.putExtra(EXTRA_REASON, reason);
        sendBroadcast(intent);
    }

    private final class PlaybackListener implements Player.Listener {
        @Override
        public void onPlayWhenReadyChanged(
                boolean playWhenReady,
                @Player.PlayWhenReadyChangeReason int reason
        ) {
            if (playWhenReady) return;
            if (reason == Player.PLAY_WHEN_READY_CHANGE_REASON_AUDIO_FOCUS_LOSS) {
                sendPlaybackEvent(ACTION_AUDIO_INTERRUPTED, "audio-focus-loss");
            } else if (reason == Player.PLAY_WHEN_READY_CHANGE_REASON_AUDIO_BECOMING_NOISY) {
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
                sendPlaybackEvent(ACTION_AUDIO_INTERRUPTED, "audio-focus-loss");
            }
        }

        @Override
        public void onPlaybackStateChanged(@Player.State int playbackState) {
            if (playbackState == Player.STATE_ENDED) {
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
            if (!getPackageName().equals(controller.getPackageName())
                    || !COMMAND_PREPARE_AUDIO.equals(customCommand.customAction)) {
                return Futures.immediateFuture(
                        new SessionResult(SessionResult.RESULT_ERROR_PERMISSION_DENIED)
                );
            }

            String bookId = args.getString(EXTRA_BOOK_ID, "").trim();
            String relativePath = args.getString(EXTRA_RELATIVE_PATH, "").trim();
            long positionMs = Math.max(0L, args.getLong(EXTRA_POSITION_MS, 0L));
            if (bookId.isEmpty()) {
                return Futures.immediateFuture(
                        new SessionResult(SessionResult.RESULT_ERROR_BAD_VALUE)
                );
            }

            try {
                prepareAudio(bookId, relativePath, positionMs);
                return Futures.immediateFuture(new SessionResult(SessionResult.RESULT_SUCCESS));
            } catch (IOException | RuntimeException error) {
                return Futures.immediateFuture(new SessionResult(SessionResult.RESULT_ERROR_IO));
            }
        }
    }
}
