package com.tifloacosta.app;

import android.content.Intent;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "TifloShare")
public class TifloSharePlugin extends Plugin {
    private Intent launchIntent;
    private String initialText = "";
    private boolean initialConsumed = false;

    @Override
    public void load() {
        launchIntent = getActivity().getIntent();
        initialText = sharedText(launchIntent);
    }

    @PluginMethod
    public void getInitialShare(PluginCall call) {
        JSObject result = new JSObject();
        if (!initialConsumed && !initialText.isEmpty()) {
            initialConsumed = true;
            result.put("shared", true);
            result.put("text", initialText);
        } else {
            result.put("shared", false);
            result.put("text", "");
        }
        call.resolve(result);
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        if (intent == null || intent == launchIntent) return;
        String text = sharedText(intent);
        if (text.isEmpty()) return;

        JSObject payload = new JSObject();
        payload.put("text", text);
        notifyListeners("shareReceived", payload, true);
    }

    @PluginMethod
    public void finishShare(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            boolean finished = getActivity().moveTaskToBack(true);
            JSObject result = new JSObject();
            result.put("finished", finished);
            call.resolve(result);
        });
    }

    private String sharedText(Intent intent) {
        if (intent == null || !Intent.ACTION_SEND.equals(intent.getAction())) return "";
        String type = intent.getType();
        if (type != null && !type.startsWith("text/")) return "";
        CharSequence value = intent.getCharSequenceExtra(Intent.EXTRA_TEXT);
        return value == null ? "" : value.toString().trim();
    }
}
