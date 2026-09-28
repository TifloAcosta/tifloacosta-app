package com.tifloacosta.app;

import android.content.ClipData;
import android.content.Intent;
import android.net.Uri;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLConnection;

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

    @PluginMethod
    public void shareFile(PluginCall call) {
        String sourceUrl = call.getString("url");
        String filename = sanitizeFilename(call.getString("filename"));
        String mimeType = call.getString("mimeType");
        String title = call.getString("title");
        String dialogTitle = call.getString("dialogTitle");

        if (!isAllowedUrl(sourceUrl)) {
            call.reject("Only HTTP or HTTPS files can be shared");
            return;
        }
        if (filename.isEmpty()) filename = "tifloacosta-documento";
        if (mimeType == null || mimeType.trim().isEmpty()) mimeType = "application/octet-stream";
        if (dialogTitle == null || dialogTitle.trim().isEmpty()) dialogTitle = "TifloAcosta";

        final String safeFilename = filename;
        final String safeMimeType = mimeType;
        final String safeTitle = title == null ? "" : title.trim();
        final String safeDialogTitle = dialogTitle.trim();
        getBridge().execute(() -> downloadAndShare(call, sourceUrl, safeFilename, safeMimeType, safeTitle, safeDialogTitle));
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

    private void downloadAndShare(PluginCall call, String sourceUrl, String filename, String mimeType, String title, String dialogTitle) {
        URLConnection connection = null;
        File sharedFile = null;
        try {
            File shareDirectory = new File(getContext().getCacheDir(), "shared_resources");
            if (!shareDirectory.exists() && !shareDirectory.mkdirs()) {
                throw new IllegalStateException("Unable to prepare share cache");
            }

            sharedFile = new File(shareDirectory, filename);
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
                FileOutputStream output = new FileOutputStream(sharedFile, false)
            ) {
                byte[] buffer = new byte[8192];
                int read;
                while ((read = input.read(buffer)) != -1) {
                    output.write(buffer, 0, read);
                }
                output.flush();
            }

            Uri contentUri = FileProvider.getUriForFile(
                getContext(),
                getContext().getPackageName() + ".fileprovider",
                sharedFile
            );

            Intent shareIntent = new Intent(Intent.ACTION_SEND);
            shareIntent.setType(mimeType);
            shareIntent.putExtra(Intent.EXTRA_STREAM, contentUri);
            if (!title.isEmpty()) shareIntent.putExtra(Intent.EXTRA_SUBJECT, title);
            shareIntent.setClipData(ClipData.newRawUri(filename, contentUri));
            shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

            getActivity().runOnUiThread(() -> {
                try {
                    getActivity().startActivity(Intent.createChooser(shareIntent, dialogTitle));
                    JSObject result = new JSObject();
                    result.put("shared", true);
                    call.resolve(result);
                } catch (Exception error) {
                    call.reject("Unable to open the Android share sheet", error);
                }
            });
        } catch (Exception error) {
            if (sharedFile != null && sharedFile.exists()) sharedFile.delete();
            call.reject("Unable to prepare the selected document for sharing", error);
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
        String sanitized = value.replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]", "-").trim();
        while (sanitized.contains("..")) sanitized = sanitized.replace("..", ".");
        return sanitized;
    }

    private String sharedText(Intent intent) {
        if (intent == null || !Intent.ACTION_SEND.equals(intent.getAction())) return "";
        if (intent.hasExtra(Intent.EXTRA_STREAM)) return "";
        String type = intent.getType();
        if (type != null && !type.startsWith("text/")) return "";
        CharSequence value = intent.getCharSequenceExtra(Intent.EXTRA_TEXT);
        return value == null ? "" : value.toString().trim();
    }
}
