package com.tifloacosta.app;

import android.content.Intent;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Temporary integration bridge; never changes package identity or wipes existing reader data. */
@CapacitorPlugin(name = "TifloNativeFeatures")
public class TifloNativeFeaturesPlugin extends Plugin {
    private void open(PluginCall call, String target) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            call.reject("Native features require Android 8 or later.");
            return;
        }
        getActivity().runOnUiThread(() -> {
            try {
                Intent intent = new Intent();
                intent.setClassName(getContext().getPackageName(),
                        "com.tifloacosta.nativeprototype.NativePrototypeActivity");
                intent.putExtra("tifloacosta-open-section", target);
                getActivity().startActivity(intent);
                JSObject result = new JSObject();
                result.put("opened", true);
                call.resolve(result);
            } catch (RuntimeException error) {
                call.reject("Could not open native preview.", error);
            }
        });
    }

    @PluginMethod
    public void openNativeReader(PluginCall call) { open(call, "reader"); }

    @PluginMethod
    public void openNativeVideos(PluginCall call) { open(call, "videos"); }
}
