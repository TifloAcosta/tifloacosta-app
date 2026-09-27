package com.tifloacosta.app;

import android.content.Context;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.tifloacosta.app.reading.ReadingTtsController;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

@CapacitorPlugin(name = "TifloReadingTts")
public class TifloReadingTtsPlugin extends Plugin {
    private static final Set<String> TTS_EVENTS = new HashSet<>(Arrays.asList(
            "ttsStarted",
            "ttsDone",
            "ttsError",
            "ttsInterrupted"
    ));

    private ReadingTtsController ttsController;

    @Override
    public void load() {
        Context context = getContext().getApplicationContext();
        ttsController = ReadingTtsController.create(context, this::emitTtsEvent);
    }

    @PluginMethod
    public void listTtsVoices(PluginCall call) {
        getBridge().execute(() -> {
            try {
                JSArray voices = new JSArray();
                for (ReadingTtsController.VoiceInfo voice : ttsController.listVoices()) {
                    JSObject item = new JSObject();
                    item.put("id", voice.getId());
                    item.put("name", voice.getName());
                    item.put("language", voice.getLanguage());
                    item.put("locale", voice.getLocale());
                    item.put("networkRequired", voice.isNetworkRequired());
                    voices.put(item);
                }
                JSObject result = new JSObject();
                result.put("voices", voices);
                call.resolve(result);
            } catch (RuntimeException error) {
                call.reject("Unable to list TTS voices", error);
            }
        });
    }

    @PluginMethod
    public void startTts(PluginCall call) {
        String sessionId = clean(call.getString("sessionId"));
        String utteranceId = clean(call.getString("utteranceId"));
        String text = call.getString("text");
        String voiceId = clean(call.getString("voiceId"));
        Double rawRate = call.getDouble("rate");
        float rate = rawRate == null ? 1.0f : rawRate.floatValue();

        if (sessionId.isEmpty() || utteranceId.isEmpty() || text == null || text.trim().isEmpty()) {
            call.reject("TTS session, utterance and text are required");
            return;
        }

        getBridge().execute(() -> {
            try {
                boolean accepted = ttsController.start(sessionId, utteranceId, text, voiceId, rate);
                JSObject result = new JSObject();
                result.put("accepted", accepted);
                call.resolve(result);
            } catch (RuntimeException error) {
                call.reject("Unable to start TTS", error);
            }
        });
    }

    @PluginMethod
    public void stopTts(PluginCall call) {
        getBridge().execute(() -> {
            try {
                ttsController.stop();
                JSObject result = new JSObject();
                result.put("stopped", true);
                call.resolve(result);
            } catch (RuntimeException error) {
                call.reject("Unable to stop TTS", error);
            }
        });
    }

    @Override
    protected void handleOnDestroy() {
        if (ttsController != null) ttsController.shutdown();
        super.handleOnDestroy();
    }

    private void emitTtsEvent(ReadingTtsController.Event event) {
        if (event == null || !TTS_EVENTS.contains(event.getName())) return;
        JSObject data = new JSObject();
        data.put("sessionId", event.getSessionId());
        if (!event.getUtteranceId().isEmpty()) data.put("utteranceId", event.getUtteranceId());
        if (event.getMessage() != null && !event.getMessage().isEmpty()) data.put("message", event.getMessage());
        getActivity().runOnUiThread(() -> notifyListeners(event.getName(), data, true));
    }

    private static String clean(String value) {
        return value == null ? "" : value.trim();
    }
}
