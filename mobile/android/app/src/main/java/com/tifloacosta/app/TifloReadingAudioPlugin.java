package com.tifloacosta.app;

import android.content.BroadcastReceiver;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;

import androidx.annotation.Nullable;
import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.PlaybackParameters;
import androidx.media3.common.Player;
import androidx.media3.session.MediaController;
import androidx.media3.session.SessionResult;
import androidx.media3.session.SessionToken;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.common.util.concurrent.ListenableFuture;
import com.tifloacosta.app.reading.ReadingAudioService;

import java.util.concurrent.ExecutionException;
import java.util.concurrent.Executor;

@CapacitorPlugin(name = "TifloReadingAudio")
public class TifloReadingAudioPlugin extends Plugin {
    private static final long POSITION_EVENT_INTERVAL_MS = 1000L;
    private static final float MIN_SPEED = 0.5f;
    private static final float MAX_SPEED = 3.0f;

    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final Player.Listener playerListener = new AudioPlayerListener();
    private final BroadcastReceiver playbackReceiver = new PlaybackReceiver();
    private final Runnable positionTicker = new Runnable() {
        @Override
        public void run() {
            MediaController current = controller;
            if (current == null || !current.isPlaying()) return;
            notifyListeners("audioPosition", stateJson(current), true);
            mainHandler.postDelayed(this, POSITION_EVENT_INTERVAL_MS);
        }
    };

    private Executor mainExecutor;
    private ListenableFuture<MediaController> controllerFuture;
    private MediaController controller;
    private String currentBookId = "";
    private int currentTrackIndex = 0;
    private boolean receiverRegistered;

    @Override
    public void load() {
        Context context = getContext().getApplicationContext();
        mainExecutor = command -> mainHandler.post(command);

        SessionToken sessionToken = new SessionToken(
                context,
                new ComponentName(context, ReadingAudioService.class)
        );
        controllerFuture = new MediaController.Builder(context, sessionToken).buildAsync();
        controllerFuture.addListener(() -> {
            try {
                controller = controllerFuture.get();
                controller.addListener(playerListener);
                syncIdentityFromController(controller);
                emitState(controller);
            } catch (ExecutionException | InterruptedException error) {
                if (error instanceof InterruptedException) Thread.currentThread().interrupt();
            }
        }, mainExecutor);

        IntentFilter filter = new IntentFilter();
        filter.addAction(ReadingAudioService.ACTION_AUDIO_INTERRUPTED);
        filter.addAction(ReadingAudioService.ACTION_AUDIO_ENDED);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            context.registerReceiver(playbackReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            context.registerReceiver(playbackReceiver, filter);
        }
        receiverRegistered = true;
    }

    @PluginMethod
    public void prepareAudio(PluginCall call) {
        String bookId = clean(call.getString("bookId"));
        String relativePath = clean(call.getString("relativePath"));
        int trackIndex = nonNegative(call.getInt("trackIndex"), 0);
        long positionMs = nonNegative(call.getLong("positionMs"), 0L);
        if (bookId.isEmpty()) {
            call.reject("Audio book id is required");
            return;
        }

        withController(call, "Unable to prepare reading audio", mediaController -> {
            Bundle args = new Bundle();
            args.putString(ReadingAudioService.EXTRA_BOOK_ID, bookId);
            args.putString(ReadingAudioService.EXTRA_RELATIVE_PATH, relativePath);
            args.putInt(ReadingAudioService.EXTRA_TRACK_INDEX, trackIndex);
            args.putLong(ReadingAudioService.EXTRA_POSITION_MS, positionMs);

            resolveCommand(
                    call,
                    mediaController.sendCustomCommand(ReadingAudioService.PREPARE_AUDIO_COMMAND, args),
                    "Unable to prepare reading audio",
                    () -> {
                        currentBookId = bookId;
                        currentTrackIndex = Math.max(0, mediaController.getCurrentMediaItemIndex());
                        JSObject state = stateJson(mediaController);
                        call.resolve(state);
                        emitState(mediaController);
                    }
            );
        });
    }

    @PluginMethod
    public void playAudio(PluginCall call) {
        withController(call, "Unable to play reading audio", mediaController -> {
            mediaController.play();
            call.resolve(stateJson(mediaController));
            emitState(mediaController);
        });
    }

    @PluginMethod
    public void pauseAudio(PluginCall call) {
        withController(call, "Unable to pause reading audio", mediaController -> {
            mediaController.pause();
            call.resolve(stateJson(mediaController));
            emitState(mediaController);
        });
    }

    @PluginMethod
    public void seekAudio(PluginCall call) {
        long positionMs = nonNegative(call.getLong("positionMs"), 0L);
        withController(call, "Unable to seek reading audio", mediaController -> {
            mediaController.seekTo(clampPosition(mediaController, positionMs));
            call.resolve(stateJson(mediaController));
            emitPosition(mediaController);
        });
    }

    @PluginMethod
    public void skipAudio(PluginCall call) {
        Long requestedDelta = call.getLong("deltaMs");
        if (requestedDelta == null) {
            call.reject("Audio skip delta is required");
            return;
        }

        withController(call, "Unable to skip reading audio", mediaController -> {
            long target = safeAdd(mediaController.getCurrentPosition(), requestedDelta);
            mediaController.seekTo(clampPosition(mediaController, target));
            call.resolve(stateJson(mediaController));
            emitPosition(mediaController);
        });
    }

    @PluginMethod
    public void previousAudioTrack(PluginCall call) {
        withController(call, "Unable to move to previous reading audio track", mediaController -> {
            if (mediaController.hasPreviousMediaItem()) mediaController.seekToPreviousMediaItem();
            call.resolve(stateJson(mediaController));
            emitState(mediaController);
        });
    }

    @PluginMethod
    public void nextAudioTrack(PluginCall call) {
        withController(call, "Unable to move to next reading audio track", mediaController -> {
            if (mediaController.hasNextMediaItem()) mediaController.seekToNextMediaItem();
            call.resolve(stateJson(mediaController));
            emitState(mediaController);
        });
    }

    @PluginMethod
    public void setAudioSpeed(PluginCall call) {
        Double rawSpeed = call.getDouble("speed");
        if (rawSpeed == null || rawSpeed.isNaN() || rawSpeed.isInfinite()) {
            call.reject("Audio speed is required");
            return;
        }
        float speed = rawSpeed.floatValue();
        if (speed < MIN_SPEED || speed > MAX_SPEED) {
            call.reject("Audio speed must be between 0.5 and 3.0");
            return;
        }

        withController(call, "Unable to change reading audio speed", mediaController -> {
            mediaController.setPlaybackParameters(new PlaybackParameters(speed));
            call.resolve(stateJson(mediaController));
            emitState(mediaController);
        });
    }

    @PluginMethod
    public void setAudioSleepTimer(PluginCall call) {
        int minutes = nonNegative(call.getInt("minutes"), 0);
        boolean atTrackEnd = Boolean.TRUE.equals(call.getBoolean("atTrackEnd"));
        if (!atTrackEnd && minutes != 15 && minutes != 30 && minutes != 45 && minutes != 60) {
            call.reject("Audio sleep timer must be 15, 30, 45 or 60 minutes, or track end");
            return;
        }

        withController(call, "Unable to set reading audio sleep timer", mediaController -> {
            Bundle args = new Bundle();
            args.putInt(ReadingAudioService.EXTRA_SLEEP_MINUTES, minutes);
            args.putBoolean(ReadingAudioService.EXTRA_SLEEP_AT_TRACK_END, atTrackEnd);
            resolveCommand(
                    call,
                    mediaController.sendCustomCommand(ReadingAudioService.SET_SLEEP_TIMER_COMMAND, args),
                    "Unable to set reading audio sleep timer",
                    () -> {
                        JSObject result = new JSObject();
                        result.put("scheduled", true);
                        call.resolve(result);
                    }
            );
        });
    }

    @PluginMethod
    public void cancelAudioSleepTimer(PluginCall call) {
        withController(call, "Unable to cancel reading audio sleep timer", mediaController -> resolveCommand(
                call,
                mediaController.sendCustomCommand(ReadingAudioService.CANCEL_SLEEP_TIMER_COMMAND, Bundle.EMPTY),
                "Unable to cancel reading audio sleep timer",
                () -> {
                    JSObject result = new JSObject();
                    result.put("cancelled", true);
                    call.resolve(result);
                }
        ));
    }

    @PluginMethod
    public void getAudioState(PluginCall call) {
        withController(call, "Unable to read audio state", mediaController -> call.resolve(stateJson(mediaController)));
    }

    @PluginMethod
    public void stopAudio(PluginCall call) {
        withController(call, "Unable to stop reading audio", mediaController -> {
            mediaController.pause();
            mediaController.stop();
            mainHandler.removeCallbacks(positionTicker);
            call.resolve(stateJson(mediaController));
            emitState(mediaController);
        });
    }

    @Override
    protected void handleOnDestroy() {
        mainHandler.removeCallbacks(positionTicker);

        Context context = getContext().getApplicationContext();
        if (receiverRegistered) {
            try {
                context.unregisterReceiver(playbackReceiver);
            } catch (IllegalArgumentException ignored) {
            }
            receiverRegistered = false;
        }

        if (controller != null) {
            controller.removeListener(playerListener);
            controller.release();
            controller = null;
        } else if (controllerFuture != null) {
            controllerFuture.cancel(true);
        }
        controllerFuture = null;
        super.handleOnDestroy();
    }

    private void withController(PluginCall call, String rejection, ControllerAction action) {
        ListenableFuture<MediaController> future = controllerFuture;
        if (future == null) {
            call.reject(rejection);
            return;
        }

        future.addListener(() -> {
            try {
                MediaController mediaController = future.get();
                action.run(mediaController);
            } catch (ExecutionException | InterruptedException | RuntimeException error) {
                if (error instanceof InterruptedException) Thread.currentThread().interrupt();
                call.reject(rejection, error);
            }
        }, mainExecutor);
    }

    private void resolveCommand(
            PluginCall call,
            ListenableFuture<SessionResult> resultFuture,
            String rejection,
            Runnable onSuccess
    ) {
        resultFuture.addListener(() -> {
            try {
                SessionResult result = resultFuture.get();
                if (result.resultCode != SessionResult.RESULT_SUCCESS) {
                    call.reject(rejection);
                    return;
                }
                onSuccess.run();
            } catch (ExecutionException | InterruptedException error) {
                if (error instanceof InterruptedException) Thread.currentThread().interrupt();
                call.reject(rejection, error);
            }
        }, mainExecutor);
    }

    private void syncIdentityFromController(MediaController mediaController) {
        MediaItem item = mediaController.getCurrentMediaItem();
        currentBookId = item == null ? "" : clean(item.mediaId);
        currentTrackIndex = currentBookId.isEmpty() ? 0 : Math.max(0, mediaController.getCurrentMediaItemIndex());
    }

    private JSObject stateJson(MediaController mediaController) {
        syncIdentityFromController(mediaController);
        JSObject state = new JSObject();
        state.put("bookId", currentBookId);
        state.put("trackIndex", currentTrackIndex);
        state.put("trackCount", Math.max(0, mediaController.getMediaItemCount()));
        state.put("positionMs", Math.max(0L, mediaController.getCurrentPosition()));

        long durationMs = mediaController.getDuration();
        state.put("durationMs", durationMs == C.TIME_UNSET ? 0L : Math.max(0L, durationMs));
        state.put("playing", mediaController.isPlaying());
        state.put("speed", mediaController.getPlaybackParameters().speed);
        state.put("prepared", mediaController.getCurrentMediaItem() != null);
        return state;
    }

    private void emitState(MediaController mediaController) {
        notifyListeners("audioState", stateJson(mediaController), true);
        updatePositionTicker(mediaController);
    }

    private void emitPosition(MediaController mediaController) {
        notifyListeners("audioPosition", stateJson(mediaController), true);
    }

    private void emitPlaybackEvent(String name, Intent intent) {
        MediaController mediaController = controller;
        JSObject data = mediaController == null ? new JSObject() : stateJson(mediaController);
        String bookId = intent.getStringExtra(ReadingAudioService.EXTRA_BOOK_ID);
        if (bookId != null && !bookId.trim().isEmpty()) data.put("bookId", bookId.trim());
        data.put("trackIndex", Math.max(0, intent.getIntExtra(ReadingAudioService.EXTRA_TRACK_INDEX, currentTrackIndex)));
        data.put("positionMs", Math.max(0L, intent.getLongExtra(ReadingAudioService.EXTRA_POSITION_MS, 0L)));
        data.put("durationMs", Math.max(0L, intent.getLongExtra(ReadingAudioService.EXTRA_DURATION_MS, 0L)));
        String reason = intent.getStringExtra(ReadingAudioService.EXTRA_REASON);
        if (reason != null && !reason.isEmpty()) data.put("reason", reason);
        notifyListeners(name, data, true);
    }

    private void updatePositionTicker(MediaController mediaController) {
        mainHandler.removeCallbacks(positionTicker);
        if (mediaController.isPlaying()) mainHandler.postDelayed(positionTicker, POSITION_EVENT_INTERVAL_MS);
    }

    private long clampPosition(MediaController mediaController, long positionMs) {
        long normalized = Math.max(0L, positionMs);
        long durationMs = mediaController.getDuration();
        if (durationMs != C.TIME_UNSET && durationMs >= 0L) return Math.min(normalized, durationMs);
        return normalized;
    }

    private static long safeAdd(long base, long delta) {
        if (delta > 0L && base > Long.MAX_VALUE - delta) return Long.MAX_VALUE;
        if (delta < 0L && base < Long.MIN_VALUE - delta) return Long.MIN_VALUE;
        return base + delta;
    }

    private static int nonNegative(Integer value, int fallback) {
        return value == null ? fallback : Math.max(0, value);
    }

    private static long nonNegative(Long value, long fallback) {
        return value == null ? fallback : Math.max(0L, value);
    }

    private static String clean(String value) {
        return value == null ? "" : value.trim();
    }

    private interface ControllerAction {
        void run(MediaController mediaController);
    }

    private final class AudioPlayerListener implements Player.Listener {
        @Override
        public void onIsPlayingChanged(boolean isPlaying) {
            MediaController mediaController = controller;
            if (mediaController != null) emitState(mediaController);
        }

        @Override
        public void onPlaybackStateChanged(@Player.State int playbackState) {
            MediaController mediaController = controller;
            if (mediaController != null) emitState(mediaController);
        }

        @Override
        public void onMediaItemTransition(@Nullable MediaItem mediaItem, @Player.MediaItemTransitionReason int reason) {
            MediaController mediaController = controller;
            if (mediaController != null) emitState(mediaController);
        }

        @Override
        public void onPlaybackParametersChanged(PlaybackParameters playbackParameters) {
            MediaController mediaController = controller;
            if (mediaController != null) emitState(mediaController);
        }
    }

    private final class PlaybackReceiver extends BroadcastReceiver {
        @Override
        public void onReceive(Context context, Intent intent) {
            String action = intent == null ? null : intent.getAction();
            if (ReadingAudioService.ACTION_AUDIO_INTERRUPTED.equals(action)) {
                emitPlaybackEvent("audioInterrupted", intent);
            } else if (ReadingAudioService.ACTION_AUDIO_ENDED.equals(action)) {
                emitPlaybackEvent("audioEnded", intent);
            }
        }
    }
}
