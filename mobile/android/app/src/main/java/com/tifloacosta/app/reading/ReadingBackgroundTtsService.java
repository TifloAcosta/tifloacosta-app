package com.tifloacosta.app.reading;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;

import androidx.annotation.Nullable;

import com.tifloacosta.app.R;

import java.io.File;
import java.io.IOException;
import java.util.List;

/**
 * Owns continuous TifloLector speech outside the WebView lifecycle.
 *
 * A prepared session is deliberately paused. Playback only starts after an
 * explicit PLAY action. Sentence completion is chained here, so suspending the
 * WebView or locking the screen cannot stop progression through the document.
 */
public final class ReadingBackgroundTtsService extends Service {
    public static final String ACTION_PREPARE = "com.tifloacosta.app.reading.tts.PREPARE";
    public static final String ACTION_PLAY = "com.tifloacosta.app.reading.tts.PLAY";
    public static final String ACTION_PAUSE = "com.tifloacosta.app.reading.tts.PAUSE";
    public static final String ACTION_SEEK = "com.tifloacosta.app.reading.tts.SEEK";
    public static final String ACTION_STOP = "com.tifloacosta.app.reading.tts.STOP";
    public static final String ACTION_QUERY_STATE = "com.tifloacosta.app.reading.tts.QUERY_STATE";

    public static final String ACTION_TTS_STATE = "com.tifloacosta.app.reading.tts.TTS_STATE";
    public static final String ACTION_TTS_POSITION = "com.tifloacosta.app.reading.tts.TTS_POSITION";
    public static final String ACTION_TTS_INTERRUPTED = "com.tifloacosta.app.reading.tts.TTS_INTERRUPTED";
    public static final String ACTION_TTS_ENDED = "com.tifloacosta.app.reading.tts.TTS_ENDED";
    public static final String ACTION_TTS_ERROR = "com.tifloacosta.app.reading.tts.TTS_ERROR";

    public static final String EXTRA_SESSION_ID = "sessionId";
    public static final String EXTRA_BOOK_ID = "bookId";
    public static final String EXTRA_BLOCK_INDEX = "blockIndex";
    public static final String EXTRA_UNIT_INDEX = "unitIndex";
    public static final String EXTRA_PLAYING = "playing";
    public static final String EXTRA_PREPARED = "prepared";
    public static final String EXTRA_ENDED = "ended";
    public static final String EXTRA_REASON = "reason";

    private static final String NOTIFICATION_CHANNEL_ID = "tiflolector_reading";
    private static final int NOTIFICATION_ID = 1304;

    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private ReadingTtsSessionStore sessionStore;
    private ReadingTtsController controller;
    private ReadingLibraryDatabase database;
    private ReadingTtsSessionStore.Session session;
    private ReadingTtsPlaybackState playbackState;
    private boolean foregroundStarted;

    @Override
    public void onCreate() {
        super.onCreate();
        sessionStore = new ReadingTtsSessionStore(new File(getFilesDir(), "reading-tts-sessions"));
        database = new ReadingLibraryDatabase(getApplicationContext());
        controller = ReadingTtsController.create(getApplicationContext(), event ->
                mainHandler.post(() -> handleControllerEvent(event)));
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(@Nullable Intent intent, int flags, int startId) {
        if (intent == null || intent.getAction() == null) {
            // Android may recreate the service after process death. Never resume speech implicitly.
            return START_NOT_STICKY;
        }

        String action = intent.getAction();
        try {
            if (ACTION_PREPARE.equals(action)) {
                prepareSession(intent.getStringExtra(EXTRA_SESSION_ID));
            } else if (ACTION_PLAY.equals(action)) {
                playSession();
            } else if (ACTION_PAUSE.equals(action)) {
                pauseSession(null);
            } else if (ACTION_SEEK.equals(action)) {
                seekSession(
                        intent.getIntExtra(EXTRA_BLOCK_INDEX, -1),
                        intent.getIntExtra(EXTRA_UNIT_INDEX, -1)
                );
            } else if (ACTION_STOP.equals(action)) {
                stopSession();
            } else if (ACTION_QUERY_STATE.equals(action)) {
                broadcastState();
            }
        } catch (IOException | IllegalArgumentException | IllegalStateException error) {
            broadcastError(error.getMessage() == null ? "tts-service-error" : error.getMessage());
        }
        return START_NOT_STICKY;
    }

    @Override
    @Nullable
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        persistCurrentPosition(false);
        if (controller != null) {
            controller.shutdown();
            controller = null;
        }
        if (database != null) {
            database.close();
            database = null;
        }
        session = null;
        playbackState = null;
        mainHandler.removeCallbacksAndMessages(null);
        super.onDestroy();
    }

    private void prepareSession(String sessionId) throws IOException {
        String cleanSessionId = sessionId == null ? "" : sessionId.trim();
        if (cleanSessionId.isEmpty()) throw new IllegalArgumentException("sessionId is required");

        if (controller != null) controller.stop();
        persistCurrentPosition(false);

        ReadingTtsSessionStore.Session loaded = sessionStore.load(cleanSessionId);
        if (loaded == null) throw new IllegalStateException("TTS session is not committed");
        if (loaded.getUnits().isEmpty()) throw new IllegalStateException("TTS session has no readable units");

        session = loaded;
        playbackState = new ReadingTtsPlaybackState(
                loaded.getUnits(),
                loaded.getStartBlockIndex(),
                loaded.getStartUnitIndex()
        );
        ensureForeground();
        updateNotification();
        broadcastState();
        broadcastPosition();
    }

    private void playSession() {
        if (session == null || playbackState == null || !playbackState.isPrepared()) {
            broadcastError("tts-session-not-prepared");
            return;
        }
        String utteranceToken = playbackState.play();
        if (utteranceToken == null) {
            if (playbackState.isEnded()) broadcastEnded();
            else broadcastError("tts-session-not-playable");
            return;
        }
        ensureForeground();
        updateNotification();
        speakCurrent(utteranceToken);
        broadcastState();
    }

    private void pauseSession(@Nullable String reason) {
        if (controller != null) controller.stop();
        if (playbackState != null) playbackState.pause();
        persistCurrentPosition(false);
        updateNotification();
        broadcastState();
        if (reason != null && !reason.trim().isEmpty()) {
            Intent event = eventIntent(ACTION_TTS_INTERRUPTED);
            event.putExtra(EXTRA_REASON, reason);
            sendBroadcast(event);
        }
    }

    private void seekSession(int blockIndex, int unitIndex) {
        if (playbackState == null || session == null) {
            broadcastError("tts-session-not-prepared");
            return;
        }
        if (blockIndex < 0 || unitIndex < 0 || !playbackState.seek(blockIndex, unitIndex)) {
            broadcastError("tts-position-not-found");
            return;
        }

        boolean continuePlaying = playbackState.isPlaying();
        if (controller != null) controller.stop();
        persistCurrentPosition(false);
        broadcastPosition();
        broadcastState();
        if (continuePlaying) {
            String token = playbackState.activeUtteranceToken();
            if (token != null) speakCurrent(token);
        }
    }

    private void stopSession() {
        persistCurrentPosition(false);
        if (controller != null) controller.stop();
        if (playbackState != null) playbackState.pause();
        broadcastState();
        session = null;
        playbackState = null;
        if (foregroundStarted) {
            stopForeground(true);
            foregroundStarted = false;
        }
        stopSelf();
    }

    private void speakCurrent(String utteranceToken) {
        if (controller == null || session == null || playbackState == null) return;
        ReadingTtsUnit current = playbackState.current();
        if (current == null) {
            broadcastError("tts-position-missing");
            return;
        }
        boolean accepted = controller.start(
                session.getSessionId(),
                utteranceToken,
                current.getText(),
                session.getVoiceId(),
                session.getRate()
        );
        if (!accepted) {
            playbackState.pause();
            persistCurrentPosition(false);
            updateNotification();
            broadcastState();
        }
    }

    private void handleControllerEvent(ReadingTtsController.Event event) {
        if (event == null || session == null || playbackState == null) return;
        if (!session.getSessionId().equals(event.getSessionId())) return;

        String name = event.getName();
        if ("ttsDone".equals(name)) {
            if (!playbackState.complete(event.getUtteranceId())) return;
            if (playbackState.isEnded()) {
                persistCurrentPosition(true);
                broadcastPosition();
                broadcastState();
                broadcastEnded();
                if (foregroundStarted) {
                    stopForeground(true);
                    foregroundStarted = false;
                }
                stopSelf();
                return;
            }
            persistCurrentPosition(false);
            broadcastPosition();
            String nextToken = playbackState.activeUtteranceToken();
            if (nextToken != null) speakCurrent(nextToken);
            return;
        }

        if ("ttsInterrupted".equals(name)) {
            playbackState.pause();
            persistCurrentPosition(false);
            updateNotification();
            broadcastState();
            Intent interrupted = eventIntent(ACTION_TTS_INTERRUPTED);
            interrupted.putExtra(EXTRA_REASON, "audio-interruption");
            sendBroadcast(interrupted);
            return;
        }

        if ("ttsError".equals(name)) {
            playbackState.pause();
            persistCurrentPosition(false);
            updateNotification();
            broadcastState();
            broadcastError(event.getMessage() == null ? "tts-error" : event.getMessage());
        }
    }

    private void persistCurrentPosition(boolean completed) {
        if (database == null || session == null || playbackState == null) return;
        ReadingTtsUnit current = playbackState.current();
        if (current == null) return;
        ReadingBookRecord book = database.findById(session.getBookId());
        if (book == null) return;

        int index = findUnitIndex(session.getUnits(), current);
        int total = session.getUnits().size();
        double percent = completed || playbackState.isEnded()
                ? 100.0
                : total <= 0 ? book.getPercent() : Math.min(99.9, Math.max(0.0, (index * 100.0) / total));
        database.updateProgress(
                session.getBookId(),
                current.getBlockIndex(),
                current.getUnitIndex(),
                current.getText(),
                percent,
                completed || playbackState.isEnded() ? "read" : "in-reading",
                System.currentTimeMillis()
        );
    }

    private static int findUnitIndex(List<ReadingTtsUnit> units, ReadingTtsUnit target) {
        for (int index = 0; index < units.size(); index += 1) {
            ReadingTtsUnit unit = units.get(index);
            if (unit.getBlockIndex() == target.getBlockIndex()
                    && unit.getUnitIndex() == target.getUnitIndex()) return index;
        }
        return 0;
    }

    private void broadcastState() {
        Intent intent = eventIntent(ACTION_TTS_STATE);
        if (session != null) {
            intent.putExtra(EXTRA_SESSION_ID, session.getSessionId());
            intent.putExtra(EXTRA_BOOK_ID, session.getBookId());
        }
        intent.putExtra(EXTRA_PREPARED, playbackState != null && playbackState.isPrepared());
        intent.putExtra(EXTRA_PLAYING, playbackState != null && playbackState.isPlaying());
        intent.putExtra(EXTRA_ENDED, playbackState != null && playbackState.isEnded());
        addPosition(intent);
        sendBroadcast(intent);
    }

    private void broadcastPosition() {
        Intent intent = eventIntent(ACTION_TTS_POSITION);
        if (session != null) {
            intent.putExtra(EXTRA_SESSION_ID, session.getSessionId());
            intent.putExtra(EXTRA_BOOK_ID, session.getBookId());
        }
        addPosition(intent);
        sendBroadcast(intent);
    }

    private void broadcastEnded() {
        Intent intent = eventIntent(ACTION_TTS_ENDED);
        if (session != null) {
            intent.putExtra(EXTRA_SESSION_ID, session.getSessionId());
            intent.putExtra(EXTRA_BOOK_ID, session.getBookId());
        }
        addPosition(intent);
        sendBroadcast(intent);
    }

    private void broadcastError(String reason) {
        Intent intent = eventIntent(ACTION_TTS_ERROR);
        if (session != null) {
            intent.putExtra(EXTRA_SESSION_ID, session.getSessionId());
            intent.putExtra(EXTRA_BOOK_ID, session.getBookId());
        }
        intent.putExtra(EXTRA_REASON, reason == null ? "tts-service-error" : reason);
        addPosition(intent);
        sendBroadcast(intent);
    }

    private Intent eventIntent(String action) {
        Intent intent = new Intent(action);
        intent.setPackage(getPackageName());
        return intent;
    }

    private void addPosition(Intent intent) {
        if (playbackState == null) return;
        ReadingTtsUnit current = playbackState.current();
        if (current == null) return;
        intent.putExtra(EXTRA_BLOCK_INDEX, current.getBlockIndex());
        intent.putExtra(EXTRA_UNIT_INDEX, current.getUnitIndex());
    }

    private void ensureForeground() {
        if (foregroundStarted) return;
        startForeground(NOTIFICATION_ID, buildNotification());
        foregroundStarted = true;
    }

    private void updateNotification() {
        if (!foregroundStarted) return;
        NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (manager != null) manager.notify(NOTIFICATION_ID, buildNotification());
    }

    private Notification buildNotification() {
        String title = session == null || session.getTitle().trim().isEmpty()
                ? "Leer con TifloAcosta"
                : session.getTitle().trim();
        String text = playbackState != null && playbackState.isPlaying()
                ? "Leyendo con TifloAcosta"
                : "Lectura preparada";

        Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? new Notification.Builder(this, NOTIFICATION_CHANNEL_ID)
                : new Notification.Builder(this);
        return builder
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(title)
                .setContentText(text)
                .setOngoing(playbackState != null && playbackState.isPlaying())
                .setCategory(Notification.CATEGORY_SERVICE)
                .build();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (manager == null) return;
        NotificationChannel channel = new NotificationChannel(
                NOTIFICATION_CHANNEL_ID,
                "Lectura de TifloLector",
                NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription("Mantiene la lectura de documentos mientras la pantalla está bloqueada");
        manager.createNotificationChannel(channel);
    }
}
