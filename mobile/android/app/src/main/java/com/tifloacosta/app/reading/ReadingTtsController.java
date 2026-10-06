package com.tifloacosta.app.reading;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.os.Build;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.speech.tts.Voice;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public final class ReadingTtsController {
    public interface Engine {
        List<VoiceInfo> listVoices();
        boolean speak(String text, String utteranceToken, String voiceId, float rate, EngineCallback callback);
        default VoiceInstallerResult openVoiceInstaller() { return new VoiceInstallerResult(false, "none"); }
        void stop();
        void shutdown();
    }

    public interface EngineCallback {
        void onStart();
        void onDone();
        void onError(String message);
    }

    public interface InterruptionMonitor {
        boolean activate(Runnable onInterrupted);
        void deactivate();
    }

    public interface EventSink {
        void emit(Event event);
    }

    public static final class VoiceInfo {
        private final String id;
        private final String name;
        private final String language;
        private final String locale;
        private final boolean networkRequired;

        public VoiceInfo(String id, String name, String language, String locale, boolean networkRequired) {
            this.id = clean(id);
            this.name = clean(name);
            this.language = clean(language);
            this.locale = clean(locale);
            this.networkRequired = networkRequired;
        }

        public String getId() { return id; }
        public String getName() { return name; }
        public String getLanguage() { return language; }
        public String getLocale() { return locale; }
        public boolean isNetworkRequired() { return networkRequired; }
    }

    public static final class VoiceInstallerResult {
        private final boolean opened;
        private final String destination;

        public VoiceInstallerResult(boolean opened, String destination) {
            this.opened = opened;
            this.destination = clean(destination);
        }

        public boolean isOpened() { return opened; }
        public String getDestination() { return destination; }
    }

    public static final class Event {
        private final String name;
        private final String sessionId;
        private final String utteranceId;
        private final String message;

        private Event(String name, String sessionId, String utteranceId, String message) {
            this.name = name;
            this.sessionId = sessionId;
            this.utteranceId = utteranceId;
            this.message = message;
        }

        public String getName() { return name; }
        public String getSessionId() { return sessionId; }
        public String getUtteranceId() { return utteranceId; }
        public String getMessage() { return message; }
    }

    private final Engine engine;
    private final InterruptionMonitor interruptions;
    private final EventSink events;
    private long generation;
    private long activeGeneration;
    private String activeSessionId;
    private String activeUtteranceId;

    public ReadingTtsController(Engine engine, InterruptionMonitor interruptions, EventSink events) {
        if (engine == null || interruptions == null || events == null) {
            throw new IllegalArgumentException("Reading TTS dependencies are required");
        }
        this.engine = engine;
        this.interruptions = interruptions;
        this.events = events;
    }

    public static ReadingTtsController create(Context context, EventSink events) {
        Context appContext = context.getApplicationContext();
        return new ReadingTtsController(
                new AndroidEngine(appContext),
                new AndroidInterruptionMonitor(appContext),
                events
        );
    }

    public synchronized List<VoiceInfo> listVoices() {
        List<VoiceInfo> voices = engine.listVoices();
        if (voices == null || voices.isEmpty()) return Collections.emptyList();
        return new ArrayList<>(voices);
    }

    public synchronized VoiceInstallerResult openVoiceInstaller() {
        VoiceInstallerResult result = engine.openVoiceInstaller();
        return result == null ? new VoiceInstallerResult(false, "none") : result;
    }

    public synchronized boolean start(
            String sessionId,
            String utteranceId,
            String text,
            String voiceId,
            float rate
    ) {
        String safeSessionId = clean(sessionId);
        String safeUtteranceId = clean(utteranceId);
        String safeText = text == null ? "" : text.trim();
        if (safeSessionId.isEmpty() || safeUtteranceId.isEmpty() || safeText.isEmpty()) {
            emit("ttsError", safeSessionId, safeUtteranceId, "invalid-request");
            return false;
        }

        replaceActiveSpeech();
        long token = ++generation;
        activeGeneration = token;
        activeSessionId = safeSessionId;
        activeUtteranceId = safeUtteranceId;

        if (!interruptions.activate(() -> interrupt(token))) {
            emit("ttsError", safeSessionId, safeUtteranceId, "audio-focus");
            clearActive();
            return false;
        }

        float safeRate = clampRate(rate);
        String nativeUtteranceId = "reading-tts-" + token;
        boolean accepted = engine.speak(
                safeText,
                nativeUtteranceId,
                clean(voiceId),
                safeRate,
                new EngineCallback() {
                    @Override
                    public void onStart() {
                        handleStarted(token);
                    }

                    @Override
                    public void onDone() {
                        handleDone(token);
                    }

                    @Override
                    public void onError(String message) {
                        handleError(token, message);
                    }
                }
        );

        if (!accepted) {
            interruptions.deactivate();
            emit("ttsError", safeSessionId, safeUtteranceId, "tts-unavailable");
            clearActive();
            return false;
        }
        return true;
    }

    public synchronized void stop() {
        generation++;
        if (hasActiveSpeech()) engine.stop();
        interruptions.deactivate();
        clearActive();
    }

    public synchronized void shutdown() {
        stop();
        engine.shutdown();
    }

    private synchronized void handleStarted(long token) {
        if (!isCurrent(token)) return;
        emit("ttsStarted", activeSessionId, activeUtteranceId, null);
    }

    private synchronized void handleDone(long token) {
        if (!isCurrent(token)) return;
        String sessionId = activeSessionId;
        String utteranceId = activeUtteranceId;
        interruptions.deactivate();
        clearActive();
        emit("ttsDone", sessionId, utteranceId, null);
    }

    private synchronized void handleError(long token, String message) {
        if (!isCurrent(token)) return;
        String sessionId = activeSessionId;
        String utteranceId = activeUtteranceId;
        interruptions.deactivate();
        clearActive();
        emit("ttsError", sessionId, utteranceId, clean(message).isEmpty() ? "tts-failed" : clean(message));
    }

    private synchronized void interrupt(long token) {
        if (!isCurrent(token)) return;
        String sessionId = activeSessionId;
        String utteranceId = activeUtteranceId;
        generation++;
        engine.stop();
        interruptions.deactivate();
        clearActive();
        emit("ttsInterrupted", sessionId, utteranceId, null);
    }

    private void replaceActiveSpeech() {
        generation++;
        if (hasActiveSpeech()) engine.stop();
        interruptions.deactivate();
        clearActive();
    }

    private boolean hasActiveSpeech() {
        return activeGeneration != 0 && activeSessionId != null;
    }

    private boolean isCurrent(long token) {
        return token != 0 && token == activeGeneration && activeSessionId != null;
    }

    private void clearActive() {
        activeGeneration = 0;
        activeSessionId = null;
        activeUtteranceId = null;
    }

    private void emit(String name, String sessionId, String utteranceId, String message) {
        events.emit(new Event(name, clean(sessionId), clean(utteranceId), message));
    }

    private static float clampRate(float rate) {
        if (Float.isNaN(rate) || Float.isInfinite(rate)) return 1.0f;
        return Math.max(0.5f, Math.min(2.0f, rate));
    }

    static boolean shouldInterruptForAudioFocusChange(int focusChange) {
        // TalkBack and other accessibility speech can take transient focus while the
        // user navigates. Do not tear down continuous reading for those short-lived
        // focus changes; only a permanent focus loss ends the current utterance.
        return focusChange == AudioManager.AUDIOFOCUS_LOSS;
    }

    private static String clean(String value) {
        return value == null ? "" : value.trim();
    }

    private static final class AndroidEngine implements Engine {
        private final Context context;
        private final TextToSpeech tts;
        private final Map<String, EngineCallback> callbacks = new ConcurrentHashMap<>();
        private volatile boolean ready;

        private AndroidEngine(Context context) {
            this.context = context.getApplicationContext();
            tts = new TextToSpeech(this.context, status -> ready = status == TextToSpeech.SUCCESS);
            tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                @Override
                public void onStart(String utteranceId) {
                    EngineCallback callback = callbacks.get(utteranceId);
                    if (callback != null) callback.onStart();
                }

                @Override
                public void onDone(String utteranceId) {
                    EngineCallback callback = callbacks.remove(utteranceId);
                    if (callback != null) callback.onDone();
                }

                @Override
                public void onError(String utteranceId) {
                    fail(utteranceId, "tts-error");
                }

                @Override
                public void onError(String utteranceId, int errorCode) {
                    fail(utteranceId, "tts-error-" + errorCode);
                }

                private void fail(String utteranceId, String message) {
                    EngineCallback callback = callbacks.remove(utteranceId);
                    if (callback != null) callback.onError(message);
                }
            });
        }

        @Override
        public List<VoiceInfo> listVoices() {
            if (!ready || tts.getVoices() == null) return Collections.emptyList();
            List<VoiceInfo> voices = new ArrayList<>();
            for (Voice voice : tts.getVoices()) {
                Locale voiceLocale = voice.getLocale();
                String localeTag = voiceLocale == null ? "" : voiceLocale.toLanguageTag();
                String language = voiceLocale == null ? "" : voiceLocale.getLanguage();
                voices.add(new VoiceInfo(
                        voice.getName(),
                        voice.getName(),
                        language,
                        localeTag,
                        voice.isNetworkConnectionRequired()
                ));
            }
            voices.sort(Comparator.comparing(VoiceInfo::getLocale).thenComparing(VoiceInfo::getName));
            return voices;
        }

        @Override
        public VoiceInstallerResult openVoiceInstaller() {
            PackageManager packageManager = context.getPackageManager();
            String defaultEngine = clean(tts.getDefaultEngine());

            Intent installer = new Intent(TextToSpeech.Engine.ACTION_INSTALL_TTS_DATA);
            if (!defaultEngine.isEmpty()) installer.setPackage(defaultEngine);
            if (installer.resolveActivity(packageManager) != null) {
                installer.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(installer);
                return new VoiceInstallerResult(true, "installer");
            }

            if (!defaultEngine.isEmpty()) {
                Intent engineIntent = packageManager.getLaunchIntentForPackage(defaultEngine);
                if (engineIntent != null && engineIntent.resolveActivity(packageManager) != null) {
                    engineIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    context.startActivity(engineIntent);
                    return new VoiceInstallerResult(true, "engine");
                }
            }
            return new VoiceInstallerResult(false, "none");
        }

        @Override
        public boolean speak(
                String text,
                String utteranceToken,
                String voiceId,
                float rate,
                EngineCallback callback
        ) {
            if (!ready) return false;
            if (!voiceId.isEmpty() && tts.getVoices() != null) {
                for (Voice voice : tts.getVoices()) {
                    if (voiceId.equals(voice.getName())) {
                        tts.setVoice(voice);
                        break;
                    }
                }
            }
            tts.setSpeechRate(rate);
            callbacks.put(utteranceToken, callback);
            int result = tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, utteranceToken);
            if (result == TextToSpeech.ERROR) {
                callbacks.remove(utteranceToken);
                return false;
            }
            return true;
        }

        @Override
        public void stop() {
            callbacks.clear();
            tts.stop();
        }

        @Override
        public void shutdown() {
            callbacks.clear();
            tts.stop();
            tts.shutdown();
            ready = false;
        }
    }

    private static final class AndroidInterruptionMonitor implements InterruptionMonitor {
        private final Context context;
        private final AudioManager audioManager;
        private final AudioManager.OnAudioFocusChangeListener focusListener;
        private final BroadcastReceiver noisyReceiver;
        private AudioFocusRequest focusRequest;
        private Runnable onInterrupted;
        private boolean receiverRegistered;
        private boolean focusHeld;

        private AndroidInterruptionMonitor(Context context) {
            this.context = context;
            this.audioManager = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
            this.focusListener = this::onAudioFocusChange;
            this.noisyReceiver = new BroadcastReceiver() {
                @Override
                public void onReceive(Context ignored, Intent intent) {
                    if (AudioManager.ACTION_AUDIO_BECOMING_NOISY.equals(intent.getAction())) interrupt();
                }
            };
        }

        @Override
        public synchronized boolean activate(Runnable onInterrupted) {
            deactivate();
            if (audioManager == null || onInterrupted == null) return false;
            this.onInterrupted = onInterrupted;

            int result;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                AudioAttributes attributes = new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ASSISTANCE_ACCESSIBILITY)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                        .build();
                focusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                        .setAudioAttributes(attributes)
                        .setOnAudioFocusChangeListener(focusListener)
                        .build();
                result = audioManager.requestAudioFocus(focusRequest);
            } else {
                result = audioManager.requestAudioFocus(
                        focusListener,
                        AudioManager.STREAM_MUSIC,
                        AudioManager.AUDIOFOCUS_GAIN
                );
            }
            if (result != AudioManager.AUDIOFOCUS_REQUEST_GRANTED) {
                this.onInterrupted = null;
                focusRequest = null;
                return false;
            }
            focusHeld = true;

            IntentFilter filter = new IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                context.registerReceiver(noisyReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
            } else {
                context.registerReceiver(noisyReceiver, filter);
            }
            receiverRegistered = true;
            return true;
        }

        @Override
        public synchronized void deactivate() {
            if (receiverRegistered) {
                try {
                    context.unregisterReceiver(noisyReceiver);
                } catch (IllegalArgumentException ignored) {
                }
                receiverRegistered = false;
            }
            if (focusHeld && audioManager != null) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && focusRequest != null) {
                    audioManager.abandonAudioFocusRequest(focusRequest);
                } else {
                    audioManager.abandonAudioFocus(focusListener);
                }
            }
            focusHeld = false;
            focusRequest = null;
            onInterrupted = null;
        }

        private void onAudioFocusChange(int focusChange) {
            if (shouldInterruptForAudioFocusChange(focusChange)) interrupt();
        }

        private void interrupt() {
            Runnable listener;
            synchronized (this) {
                listener = onInterrupted;
            }
            if (listener != null) listener.run();
        }
    }
}
