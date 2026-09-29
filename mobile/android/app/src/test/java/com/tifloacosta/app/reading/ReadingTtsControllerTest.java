package com.tifloacosta.app.reading;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

public class ReadingTtsControllerTest {
    @Test
    public void voicesAreExposedWithStableMetadata() {
        FakeEngine engine = new FakeEngine();
        engine.voices = Arrays.asList(
                new ReadingTtsController.VoiceInfo("es-voice", "Voz ES", "es", "es-ES", false),
                new ReadingTtsController.VoiceInfo("net-voice", "Voz red", "en", "en-US", true)
        );
        ReadingTtsController controller = controller(engine, new FakeInterruptions(), new EventRecorder());

        List<ReadingTtsController.VoiceInfo> voices = controller.listVoices();

        assertEquals(2, voices.size());
        assertEquals("es-voice", voices.get(0).getId());
        assertEquals("Voz ES", voices.get(0).getName());
        assertEquals("es", voices.get(0).getLanguage());
        assertEquals("es-ES", voices.get(0).getLocale());
        assertFalse(voices.get(0).isNetworkRequired());
        assertTrue(voices.get(1).isNetworkRequired());
    }

    @Test
    public void startPropagatesVoiceClampedRateAndSessionIdentifiers() {
        FakeEngine engine = new FakeEngine();
        FakeInterruptions interruptions = new FakeInterruptions();
        EventRecorder events = new EventRecorder();
        ReadingTtsController controller = controller(engine, interruptions, events);

        assertTrue(controller.start("session-1", "utt-1", "Hola mundo", "voice-a", 3.5f));
        engine.started();

        assertEquals("Hola mundo", engine.lastText);
        assertEquals("voice-a", engine.lastVoiceId);
        assertEquals(2.0f, engine.lastRate, 0.001f);
        assertTrue(interruptions.active);
        assertEquals("ttsStarted", events.last().getName());
        assertEquals("session-1", events.last().getSessionId());
        assertEquals("utt-1", events.last().getUtteranceId());
    }

    @Test
    public void lowerRateIsClampedAndStopInvalidatesLateCallbacks() {
        FakeEngine engine = new FakeEngine();
        FakeInterruptions interruptions = new FakeInterruptions();
        EventRecorder events = new EventRecorder();
        ReadingTtsController controller = controller(engine, interruptions, events);

        assertTrue(controller.start("session-1", "utt-1", "Texto", null, 0.1f));
        assertEquals(0.5f, engine.lastRate, 0.001f);
        ReadingTtsController.EngineCallback old = engine.callback;

        controller.stop();
        old.onDone();

        assertEquals(1, engine.stopCount);
        assertFalse(interruptions.active);
        assertTrue(events.events.isEmpty());
    }

    @Test
    public void callbacksFromAnOlderSessionCannotMoveTheNewSession() {
        FakeEngine engine = new FakeEngine();
        EventRecorder events = new EventRecorder();
        ReadingTtsController controller = controller(engine, new FakeInterruptions(), events);

        controller.start("old-session", "old-utt", "Primero", null, 1.0f);
        ReadingTtsController.EngineCallback old = engine.callback;
        controller.start("new-session", "new-utt", "Segundo", null, 1.0f);
        ReadingTtsController.EngineCallback current = engine.callback;

        old.onStart();
        old.onDone();
        current.onStart();
        current.onDone();

        assertEquals(2, events.events.size());
        assertEquals("ttsStarted", events.events.get(0).getName());
        assertEquals("new-session", events.events.get(0).getSessionId());
        assertEquals("ttsDone", events.events.get(1).getName());
        assertEquals("new-session", events.events.get(1).getSessionId());
    }

    @Test
    public void engineErrorKeepsSessionIdentityAndStopsMonitoring() {
        FakeEngine engine = new FakeEngine();
        FakeInterruptions interruptions = new FakeInterruptions();
        EventRecorder events = new EventRecorder();
        ReadingTtsController controller = controller(engine, interruptions, events);

        controller.start("session-2", "utt-8", "Texto", null, 1.0f);
        engine.callback.onError("tts-failed");

        assertEquals("ttsError", events.last().getName());
        assertEquals("session-2", events.last().getSessionId());
        assertEquals("utt-8", events.last().getUtteranceId());
        assertEquals("tts-failed", events.last().getMessage());
        assertFalse(interruptions.active);
    }

    @Test
    public void audioFocusLossOrNoisyAudioStopsSpeechAndNeverAutoResumes() {
        FakeEngine engine = new FakeEngine();
        FakeInterruptions interruptions = new FakeInterruptions();
        EventRecorder events = new EventRecorder();
        ReadingTtsController controller = controller(engine, interruptions, events);

        controller.start("session-3", "utt-4", "Escuchando", null, 1.0f);
        interruptions.interrupt();

        assertEquals(1, engine.stopCount);
        assertFalse(interruptions.active);
        assertEquals("ttsInterrupted", events.last().getName());
        assertEquals("session-3", events.last().getSessionId());
        assertEquals("utt-4", events.last().getUtteranceId());
        assertEquals(1, engine.speakCount);
    }

    @Test
    public void deniedAudioFocusRejectsStartWithoutSpeaking() {
        FakeEngine engine = new FakeEngine();
        FakeInterruptions interruptions = new FakeInterruptions();
        interruptions.allowActivation = false;
        EventRecorder events = new EventRecorder();
        ReadingTtsController controller = controller(engine, interruptions, events);

        assertFalse(controller.start("session-4", "utt-1", "No debe sonar", null, 1.0f));

        assertEquals(0, engine.speakCount);
        assertEquals("ttsError", events.last().getName());
        assertEquals("audio-focus", events.last().getMessage());
    }

    private static ReadingTtsController controller(
            FakeEngine engine,
            FakeInterruptions interruptions,
            EventRecorder events
    ) {
        return new ReadingTtsController(engine, interruptions, events::add);
    }

    private static final class FakeEngine implements ReadingTtsController.Engine {
        private List<ReadingTtsController.VoiceInfo> voices = new ArrayList<>();
        private String lastText;
        private String lastVoiceId;
        private float lastRate;
        private ReadingTtsController.EngineCallback callback;
        private int speakCount;
        private int stopCount;

        @Override
        public List<ReadingTtsController.VoiceInfo> listVoices() {
            return voices;
        }

        @Override
        public boolean speak(String text, String utteranceToken, String voiceId, float rate, ReadingTtsController.EngineCallback callback) {
            this.lastText = text;
            this.lastVoiceId = voiceId;
            this.lastRate = rate;
            this.callback = callback;
            speakCount++;
            return true;
        }

        @Override
        public void stop() {
            stopCount++;
        }

        @Override
        public void shutdown() {
        }

        private void started() {
            callback.onStart();
        }
    }

    private static final class FakeInterruptions implements ReadingTtsController.InterruptionMonitor {
        private boolean active;
        private boolean allowActivation = true;
        private Runnable listener;

        @Override
        public boolean activate(Runnable onInterrupted) {
            listener = onInterrupted;
            active = allowActivation;
            return allowActivation;
        }

        @Override
        public void deactivate() {
            active = false;
        }

        private void interrupt() {
            if (active && listener != null) listener.run();
        }
    }

    private static final class EventRecorder {
        private final List<ReadingTtsController.Event> events = new ArrayList<>();

        private void add(ReadingTtsController.Event event) {
            events.add(event);
        }

        private ReadingTtsController.Event last() {
            return events.get(events.size() - 1);
        }
    }
}
