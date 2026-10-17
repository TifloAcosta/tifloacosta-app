package com.tifloacosta.app;

import android.app.Activity;
import android.view.WindowManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Prevents AUTOMATIC screen timeout only while an on-screen YouTube video
 * is playing. It does not play videos in the background, override the power
 * button or take ownership of audio playback.
 */
@CapacitorPlugin(name = "TifloVideoScreen")
public final class TifloVideoScreenPlugin extends Plugin {
    @PluginMethod
    public void setKeepScreenOn(PluginCall call) {
        final Boolean requested = call.getBoolean("enabled");
        if (requested == null) {
            call.reject("enabled must be a boolean");
            return;
        }
        final Activity activity = getActivity();
        if (activity == null || activity.isFinishing() || activity.isDestroyed()) {
            call.reject("Video activity unavailable");
            return;
        }
        activity.runOnUiThread(() -> {
            if (requested) {
                activity.getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            } else {
                activity.getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            }
            JSObject result = new JSObject();
            result.put("enabled", requested);
            call.resolve(result);
        });
    }
}
