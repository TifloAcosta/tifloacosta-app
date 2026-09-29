package com.tifloacosta.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.tifloacosta.app.reading.ReadingBackgroundTtsService;
import com.tifloacosta.app.reading.ReadingTtsController;
import com.tifloacosta.app.reading.ReadingTtsSessionStore;
import com.tifloacosta.app.reading.ReadingTtsUnit;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
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
    private ReadingTtsSessionStore sessionStore;
    private BroadcastReceiver backgroundReceiver;
    private boolean receiverRegistered;

    private String backgroundSessionId = "";
    private String backgroundBookId = "";
    private int backgroundBlockIndex;
    private int backgroundUnitIndex;
    private boolean backgroundPrepared;
    private boolean backgroundPlaying;
    private boolean backgroundEnded;

    @Override
    public void load() {
        Context context = getContext().getApplicationContext();
        // Kept temporarily for voice enumeration and the legacy per-utterance path
        // while the web reader is migrated to the persistent native service.
        ttsController = ReadingTtsController.create(context, this::emitTtsEvent);
        sessionStore = new ReadingTtsSessionStore(new File(context.getFilesDir(), "reading-tts-sessions"));
        registerBackgroundReceiver(context);
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
    public void beginTtsSession(PluginCall call) {
        String sessionId = clean(call.getString("sessionId"));
        String bookId = clean(call.getString("bookId"));
        String title = call.getString("title");
        String voiceId = clean(call.getString("voiceId"));
        Double rawRate = call.getDouble("rate");
        Integer rawBlockIndex = call.getInt("blockIndex");
        Integer rawUnitIndex = call.getInt("unitIndex");
        float rate = rawRate == null ? 1.0f : rawRate.floatValue();
        int blockIndex = rawBlockIndex == null ? 0 : rawBlockIndex;
        int unitIndex = rawUnitIndex == null ? 0 : rawUnitIndex;

        if (sessionId.isEmpty() || bookId.isEmpty()) {
            call.reject("TTS session and book id are required");
            return;
        }

        getBridge().execute(() -> {
            try {
                sessionStore.begin(sessionId, bookId, title, voiceId, rate, blockIndex, unitIndex);
                JSObject result = new JSObject();
                result.put("sessionId", sessionId);
                result.put("prepared", false);
                call.resolve(result);
            } catch (IOException | RuntimeException error) {
                call.reject("Unable to begin TTS session", error);
            }
        });
    }

    @PluginMethod
    public void appendTtsUnits(PluginCall call) {
        String sessionId = clean(call.getString("sessionId"));
        JSArray items = call.getArray("units");
        if (sessionId.isEmpty() || items == null) {
            call.reject("TTS session and units are required");
            return;
        }

        getBridge().execute(() -> {
            try {
                List<ReadingTtsUnit> units = new ArrayList<>(items.length());
                for (int index = 0; index < items.length(); index++) {
                    JSONObject item = items.getJSONObject(index);
                    units.add(new ReadingTtsUnit(
                            item.getInt("blockIndex"),
                            item.getInt("unitIndex"),
                            item.getString("text")
                    ));
                }
                sessionStore.append(sessionId, units);
                JSObject result = new JSObject();
                result.put("sessionId", sessionId);
                result.put("appended", units.size());
                call.resolve(result);
            } catch (JSONException | IOException | RuntimeException error) {
                call.reject("Unable to append TTS units", error);
            }
        });
    }

    @PluginMethod
    public void commitTtsSession(PluginCall call) {
        String sessionId = clean(call.getString("sessionId"));
        if (sessionId.isEmpty()) {
            call.reject("TTS session is required");
            return;
        }

        getBridge().execute(() -> {
            try {
                sessionStore.commit(sessionId);
                ReadingTtsSessionStore.Session session = sessionStore.load(sessionId);
                if (session == null) throw new IllegalStateException("TTS session was not committed");

                Intent prepare = serviceIntent(ReadingBackgroundTtsService.ACTION_PREPARE);
                prepare.putExtra(ReadingBackgroundTtsService.EXTRA_SESSION_ID, sessionId);
                startForegroundService(prepare);

                JSObject result = new JSObject();
                result.put("sessionId", sessionId);
                result.put("prepared", true);
                result.put("unitCount", session.getUnits().size());
                call.resolve(result);
            } catch (IOException | RuntimeException error) {
                call.reject("Unable to commit TTS session", error);
            }
        });
    }

    @PluginMethod
    public void playTts(PluginCall call) {
        try {
            startService(serviceIntent(ReadingBackgroundTtsService.ACTION_PLAY));
            JSObject result = new JSObject();
            result.put("accepted", true);
            call.resolve(result);
        } catch (RuntimeException error) {
            call.reject("Unable to play background TTS", error);
        }
    }

    @PluginMethod
    public void pauseTts(PluginCall call) {
        try {
            startService(serviceIntent(ReadingBackgroundTtsService.ACTION_PAUSE));
            JSObject result = new JSObject();
            result.put("paused", true);
            call.resolve(result);
        } catch (RuntimeException error) {
            call.reject("Unable to pause background TTS", error);
        }
    }

    @PluginMethod
    public void seekTts(PluginCall call) {
        Integer blockIndex = call.getInt("blockIndex");
        Integer unitIndex = call.getInt("unitIndex");
        if (blockIndex == null || unitIndex == null || blockIndex < 0 || unitIndex < 0) {
            call.reject("TTS block and unit indexes are required");
            return;
        }
        try {
            Intent intent = serviceIntent(ReadingBackgroundTtsService.ACTION_SEEK);
            intent.putExtra(ReadingBackgroundTtsService.EXTRA_BLOCK_INDEX, blockIndex);
            intent.putExtra(ReadingBackgroundTtsService.EXTRA_UNIT_INDEX, unitIndex);
            startService(intent);
            JSObject result = new JSObject();
            result.put("accepted", true);
            result.put("blockIndex", blockIndex);
            result.put("unitIndex", unitIndex);
            call.resolve(result);
        } catch (RuntimeException error) {
            call.reject("Unable to seek background TTS", error);
        }
    }

    @PluginMethod
    public void getTtsState(PluginCall call) {
        try {
            startService(serviceIntent(ReadingBackgroundTtsService.ACTION_QUERY_STATE));
            call.resolve(backgroundState());
        } catch (RuntimeException error) {
            call.reject("Unable to query background TTS", error);
        }
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
        try {
            // Preserve the old behavior until the JavaScript reader is fully migrated.
            if (ttsController != null) ttsController.stop();
            startService(serviceIntent(ReadingBackgroundTtsService.ACTION_STOP));
            resetBackgroundState();
            JSObject result = new JSObject();
            result.put("stopped", true);
            call.resolve(result);
        } catch (RuntimeException error) {
            call.reject("Unable to stop TTS", error);
        }
    }

    @Override
    protected void handleOnDestroy() {
        Context context = getContext().getApplicationContext();
        if (receiverRegistered && backgroundReceiver != null) {
            try {
                context.unregisterReceiver(backgroundReceiver);
            } catch (IllegalArgumentException ignored) {
                // Already unregistered by Android lifecycle cleanup.
            }
            receiverRegistered = false;
        }
        // Do not stop ReadingBackgroundTtsService here: it must outlive the WebView.
        if (ttsController != null) ttsController.shutdown();
        super.handleOnDestroy();
    }

    private void registerBackgroundReceiver(Context context) {
        IntentFilter filter = new IntentFilter();
        filter.addAction(ReadingBackgroundTtsService.ACTION_TTS_STATE);
        filter.addAction(ReadingBackgroundTtsService.ACTION_TTS_POSITION);
        filter.addAction(ReadingBackgroundTtsService.ACTION_TTS_INTERRUPTED);
        filter.addAction(ReadingBackgroundTtsService.ACTION_TTS_ENDED);
        filter.addAction(ReadingBackgroundTtsService.ACTION_TTS_ERROR);

        backgroundReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context receiverContext, Intent intent) {
                handleBackgroundEvent(intent);
            }
        };

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            context.registerReceiver(backgroundReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            context.registerReceiver(backgroundReceiver, filter);
        }
        receiverRegistered = true;
    }

    private void handleBackgroundEvent(Intent intent) {
        if (intent == null || intent.getAction() == null) return;
        String action = intent.getAction();
        updateBackgroundState(intent);

        String eventName;
        if (ReadingBackgroundTtsService.ACTION_TTS_STATE.equals(action)) {
            eventName = "ttsState";
        } else if (ReadingBackgroundTtsService.ACTION_TTS_POSITION.equals(action)) {
            eventName = "ttsPosition";
        } else if (ReadingBackgroundTtsService.ACTION_TTS_INTERRUPTED.equals(action)) {
            eventName = "ttsInterrupted";
        } else if (ReadingBackgroundTtsService.ACTION_TTS_ENDED.equals(action)) {
            backgroundPlaying = false;
            backgroundEnded = true;
            eventName = "ttsEnded";
        } else if (ReadingBackgroundTtsService.ACTION_TTS_ERROR.equals(action)) {
            eventName = "ttsError";
        } else {
            return;
        }

        JSObject data = backgroundState();
        String reason = intent.getStringExtra(ReadingBackgroundTtsService.EXTRA_REASON);
        if (reason != null && !reason.trim().isEmpty()) data.put("message", reason);
        notifyListeners(eventName, data, true);
    }

    private void updateBackgroundState(Intent intent) {
        String sessionId = intent.getStringExtra(ReadingBackgroundTtsService.EXTRA_SESSION_ID);
        String bookId = intent.getStringExtra(ReadingBackgroundTtsService.EXTRA_BOOK_ID);
        if (sessionId != null) backgroundSessionId = sessionId;
        if (bookId != null) backgroundBookId = bookId;
        if (intent.hasExtra(ReadingBackgroundTtsService.EXTRA_BLOCK_INDEX)) {
            backgroundBlockIndex = intent.getIntExtra(ReadingBackgroundTtsService.EXTRA_BLOCK_INDEX, backgroundBlockIndex);
        }
        if (intent.hasExtra(ReadingBackgroundTtsService.EXTRA_UNIT_INDEX)) {
            backgroundUnitIndex = intent.getIntExtra(ReadingBackgroundTtsService.EXTRA_UNIT_INDEX, backgroundUnitIndex);
        }
        if (intent.hasExtra(ReadingBackgroundTtsService.EXTRA_PREPARED)) {
            backgroundPrepared = intent.getBooleanExtra(ReadingBackgroundTtsService.EXTRA_PREPARED, backgroundPrepared);
        }
        if (intent.hasExtra(ReadingBackgroundTtsService.EXTRA_PLAYING)) {
            backgroundPlaying = intent.getBooleanExtra(ReadingBackgroundTtsService.EXTRA_PLAYING, backgroundPlaying);
        }
        if (intent.hasExtra(ReadingBackgroundTtsService.EXTRA_ENDED)) {
            backgroundEnded = intent.getBooleanExtra(ReadingBackgroundTtsService.EXTRA_ENDED, backgroundEnded);
        }
    }

    private JSObject backgroundState() {
        JSObject data = new JSObject();
        data.put("sessionId", backgroundSessionId);
        data.put("bookId", backgroundBookId);
        data.put("blockIndex", backgroundBlockIndex);
        data.put("unitIndex", backgroundUnitIndex);
        data.put("prepared", backgroundPrepared);
        data.put("playing", backgroundPlaying);
        data.put("ended", backgroundEnded);
        return data;
    }

    private void resetBackgroundState() {
        backgroundSessionId = "";
        backgroundBookId = "";
        backgroundBlockIndex = 0;
        backgroundUnitIndex = 0;
        backgroundPrepared = false;
        backgroundPlaying = false;
        backgroundEnded = false;
    }

    private Intent serviceIntent(String action) {
        Intent intent = new Intent(getContext().getApplicationContext(), ReadingBackgroundTtsService.class);
        intent.setAction(action);
        return intent;
    }

    private void startForegroundService(Intent intent) {
        Context context = getContext().getApplicationContext();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent);
        } else {
            context.startService(intent);
        }
    }

    private void startService(Intent intent) {
        getContext().getApplicationContext().startService(intent);
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
