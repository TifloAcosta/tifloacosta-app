package com.tifloacosta.app;

import android.app.Activity;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.BufferedInputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLConnection;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

@CapacitorPlugin(name = "TifloSave")
public class TifloSavePlugin extends Plugin {
    private static final String DOWNLOAD_CHANNEL_ID = "tifloacosta_downloads";
    private static final int DOWNLOAD_NOTIFICATION_ID = 2401;

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
            connection.setRequestProperty("Accept", "*/*");

            if (connection instanceof HttpURLConnection) {
                HttpURLConnection http = (HttpURLConnection) connection;
                http.setInstanceFollowRedirects(true);
                int status = http.getResponseCode();
                if (status < 200 || status >= 300) {
                    throw new IllegalStateException("Download failed with HTTP status " + status);
                }
            }

            String contentType = normalizeContentType(connection.getContentType());
            String contentDisposition = connection.getHeaderField("Content-Disposition");
            boolean attachment = isAttachment(contentDisposition);

            try (
                BufferedInputStream input = new BufferedInputStream(connection.getInputStream());
                OutputStream output = getContext().getContentResolver().openOutputStream(destination, "w")
            ) {
                if (output == null) throw new IllegalStateException("Unable to open selected destination");

                input.mark(1024);
                byte[] probe = new byte[512];
                int probeLength = input.read(probe);
                input.reset();

                if (!attachment && (isHtmlContentType(contentType) || looksLikeHtml(probe, probeLength))) {
                    throw new IllegalStateException("The selected address returned a web page instead of the requested file");
                }

                byte[] buffer = new byte[8192];
                int read;
                while ((read = input.read(buffer)) != -1) {
                    output.write(buffer, 0, read);
                }
                output.flush();
            }

            String completedFilename = sanitizeFilename(call.getString("filename"));
            if (completedFilename.isEmpty()) completedFilename = "tifloacosta-documento";
            notifyDownloadCompleted(completedFilename);

            JSObject saved = new JSObject();
            saved.put("saved", true);
            saved.put("cancelled", false);
            saved.put("filename", completedFilename);
            call.resolve(saved);
        } catch (Exception error) {
            call.reject("Unable to save the selected document", error);
        } finally {
            if (connection instanceof HttpURLConnection) {
                ((HttpURLConnection) connection).disconnect();
            }
        }
    }

    private void notifyDownloadCompleted(String filename) {
        if (Build.VERSION.SDK_INT >= 33
            && getContext().checkSelfPermission("android.permission.POST_NOTIFICATIONS") != PackageManager.PERMISSION_GRANTED) {
            return;
        }

        NotificationManager manager = (NotificationManager) getContext().getSystemService("notification");
        if (manager == null) return;

        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel channel = new NotificationChannel(
                DOWNLOAD_CHANNEL_ID,
                "Descargas de TifloAcosta",
                NotificationManager.IMPORTANCE_DEFAULT
            );
            channel.setDescription("Avisos cuando termina una descarga iniciada desde TifloAcosta");
            manager.createNotificationChannel(channel);
        }

        Notification.Builder builder = Build.VERSION.SDK_INT >= 26
            ? new Notification.Builder(getContext(), DOWNLOAD_CHANNEL_ID)
            : new Notification.Builder(getContext());

        builder
            .setSmallIcon(getContext().getApplicationInfo().icon)
            .setContentTitle("TifloAcosta")
            .setContentText("Descarga completada: " + filename)
            .setAutoCancel(true);

        manager.notify(DOWNLOAD_NOTIFICATION_ID, builder.build());
    }

    private String normalizeContentType(String value) {
        if (value == null) return "";
        int separator = value.indexOf(';');
        String clean = separator >= 0 ? value.substring(0, separator) : value;
        return clean.trim().toLowerCase(Locale.ROOT);
    }

    private boolean isHtmlContentType(String value) {
        return "text/html".equals(value) || "application/xhtml+xml".equals(value);
    }

    private boolean isAttachment(String contentDisposition) {
        if (contentDisposition == null) return false;
        return contentDisposition.toLowerCase(Locale.ROOT).contains("attachment");
    }

    private boolean looksLikeHtml(byte[] bytes, int length) {
        if (bytes == null || length <= 0) return false;
        int safeLength = Math.min(length, bytes.length);
        String prefix = new String(bytes, 0, safeLength, StandardCharsets.UTF_8)
            .replace("\uFEFF", "")
            .trim()
            .toLowerCase(Locale.ROOT);
        return prefix.startsWith("<!doctype html")
            || prefix.startsWith("<html")
            || prefix.startsWith("<head")
            || prefix.startsWith("<body");
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