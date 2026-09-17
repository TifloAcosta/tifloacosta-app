package com.tifloacosta.app;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLConnection;

@CapacitorPlugin(name = "TifloSave")
public class TifloSavePlugin extends Plugin {

    @PluginMethod
    public void saveUrl(PluginCall call) {
        String sourceUrl = call.getString("url");
        String filename = sanitizeFilename(call.getString("filename"));
        String mimeType = call.getString("mimeType");

        if (!isAllowedUrl(sourceUrl)) {
            call.reject("Only HTTP or HTTPS downloads are allowed");
            return;
        }
        if (filename.isEmpty()) filename = "tifloacosta-documento";
        if (mimeType == null || mimeType.trim().isEmpty()) mimeType = "application/octet-stream";

        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(mimeType);
        intent.putExtra(Intent.EXTRA_TITLE, filename);
        startActivityForResult(call, intent, "saveDocumentResult");
    }

    @ActivityCallback
    private void saveDocumentResult(PluginCall call, ActivityResult result) {
        if (call == null) return;

        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
            JSObject cancelled = new JSObject();
            cancelled.put("saved", false);
            cancelled.put("cancelled", true);
            call.resolve(cancelled);
            return;
        }

        Uri destination = result.getData().getData();
        String sourceUrl = call.getString("url");
        getBridge().execute(() -> downloadToUri(call, sourceUrl, destination));
    }

    private void downloadToUri(PluginCall call, String sourceUrl, Uri destination) {
        URLConnection connection = null;
        try {
            URL url = new URL(sourceUrl);
            connection = url.openConnection();
            connection.setConnectTimeout(15000);
            connection.setReadTimeout(30000);
            connection.setRequestProperty("User-Agent", "TifloAcosta/1.0");

            if (connection instanceof HttpURLConnection) {
                HttpURLConnection http = (HttpURLConnection) connection;
                http.setInstanceFollowRedirects(true);
                int status = http.getResponseCode();
                if (status < 200 || status >= 300) {
                    throw new IllegalStateException("Download failed with HTTP status " + status);
                }
            }

            try (
                InputStream input = connection.getInputStream();
                OutputStream output = getContext().getContentResolver().openOutputStream(destination, "w")
            ) {
                if (output == null) throw new IllegalStateException("Unable to open selected destination");
                byte[] buffer = new byte[8192];
                int read;
                while ((read = input.read(buffer)) != -1) {
                    output.write(buffer, 0, read);
                }
                output.flush();
            }

            JSObject saved = new JSObject();
            saved.put("saved", true);
            saved.put("cancelled", false);
            call.resolve(saved);
        } catch (Exception error) {
            call.reject("Unable to save the selected document", error);
        } finally {
            if (connection instanceof HttpURLConnection) {
                ((HttpURLConnection) connection).disconnect();
            }
        }
    }

    private boolean isAllowedUrl(String value) {
        if (value == null) return false;
        try {
            String protocol = new URL(value).getProtocol();
            return "https".equalsIgnoreCase(protocol) || "http".equalsIgnoreCase(protocol);
        } catch (Exception error) {
            return false;
        }
    }

    private String sanitizeFilename(String value) {
        if (value == null) return "";
        return value.replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]", "-").trim();
    }
}
