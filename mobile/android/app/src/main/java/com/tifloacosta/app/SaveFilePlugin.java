package com.tifloacosta.app;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.util.Base64;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.OutputStream;

@CapacitorPlugin(name = "SaveFile")
public class SaveFilePlugin extends Plugin {

    @PluginMethod
    public void save(PluginCall call) {
        String fileName = call.getString("fileName", "TifloAcosta-download");
        String mimeType = call.getString("mimeType", "application/octet-stream");
        String base64Data = call.getString("base64Data");
        if (base64Data == null) {
            call.reject("Missing file data");
            return;
        }

        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(mimeType);
        intent.putExtra(Intent.EXTRA_TITLE, fileName);
        startActivityForResult(call, intent, "saveResult");
    }

    @ActivityCallback
    private void saveResult(PluginCall call, ActivityResult result) {
        JSObject response = new JSObject();
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            response.put("saved", false);
            call.resolve(response);
            return;
        }

        Uri destination = result.getData().getData();
        if (destination == null) {
            response.put("saved", false);
            call.resolve(response);
            return;
        }

        try {
            byte[] data = Base64.decode(call.getString("base64Data", ""), Base64.DEFAULT);
            try (OutputStream output = getContext().getContentResolver().openOutputStream(destination)) {
                if (output == null) throw new IllegalStateException("Unable to open destination");
                output.write(data);
                output.flush();
            }
            response.put("saved", true);
            call.resolve(response);
        } catch (Exception error) {
            call.reject("Unable to save file", error);
        }
    }
}