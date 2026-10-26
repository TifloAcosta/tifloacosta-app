package com.tifloacosta.app;

import android.net.Uri;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Arrays;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/**
 * YouTube user actions for Android. Google consent runs in the system browser;
 * this plugin exchanges the bound OAuth ticket and holds the sealed session
 * ONLY in Android Keystore-backed storage. WebView JavaScript never sees a
 * bearer credential, Google token, refresh token or client secret.
 *
 * The existing Worker has native PKCE and Bearer routes originally used by
 * iOS. Its protocol is platform-neutral and needs no production redeploy.
 */
@CapacitorPlugin(name = "TifloYouTubeAccount")
public final class TifloYouTubeAccountPlugin extends Plugin {
    private static final String ENDPOINT = "https://youtube-auth.tifloacosta.com";
    private static final String CALLBACK_SCHEME = "tifloacosta";
    private static final String CALLBACK_HOST = "youtube-auth";
    private static final String PREFS = "tifloacosta-youtube-android";
    private static final String STORED = "sealed-session";
    private static final String KEY_ALIAS = "com.tifloacosta.app.youtube-session-v1";
    private static final String VALID_VIDEO = "^[A-Za-z0-9_-]{11}$";
    private static final int CONNECT_TIMEOUT_MS = 12000;
    private static final int READ_TIMEOUT_MS = 20000;
    private static final int MAX_RESPONSE_BYTES = 65536;

    private final SecureRandom random = new SecureRandom();
    private String pendingVerifier;
    private long pendingStartedAt;

    private static class ApiFailure extends Exception {
        final String code;
        ApiFailure(String code) {
            super(code);
            this.code = code;
        }
    }

    private byte[] bytes(int size) {
        byte[] result = new byte[size];
        random.nextBytes(result);
        return result;
    }

    private String base64(byte[] value) {
        return Base64.encodeToString(value, Base64.URL_SAFE | Base64.NO_WRAP | Base64.NO_PADDING);
    }

    private String challenge(String verifier) throws Exception {
        return base64(MessageDigest.getInstance("SHA-256").digest(verifier.getBytes(StandardCharsets.UTF_8)));
    }

    private synchronized String nextVerifier() {
        pendingVerifier = base64(bytes(32));
        pendingStartedAt = System.currentTimeMillis();
        return pendingVerifier;
    }

    private synchronized String consumeVerifier() {
        String value = pendingVerifier;
        pendingVerifier = null;
        if (value == null || System.currentTimeMillis() - pendingStartedAt > 10L * 60 * 1000) {
            return null;
        }
        return value;
    }

    private SecretKey secretKey() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore");
        store.load(null);
        KeyStore.Entry entry = store.getEntry(KEY_ALIAS, null);
        if (entry instanceof KeyStore.SecretKeyEntry) {
            return ((KeyStore.SecretKeyEntry) entry).getSecretKey();
        }
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(
            KEY_ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .setUserAuthenticationRequired(false)
            .build());
        return generator.generateKey();
    }

    private synchronized void saveSession(String bearer, long expiresAt) throws Exception {
        JSONObject content = new JSONObject();
        content.put("token", bearer);
        content.put("expiresAt", expiresAt);

        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, secretKey());
        byte[] iv = cipher.getIV();
        byte[] ciphertext = cipher.doFinal(content.toString().getBytes(StandardCharsets.UTF_8));
        JSONObject wrapped = new JSONObject();
        wrapped.put("iv", base64(iv));
        wrapped.put("data", base64(ciphertext));
        getContext().getSharedPreferences(PREFS, 0).edit().putString(STORED, wrapped.toString()).apply();
    }

    private synchronized void eraseSession() {
        getContext().getSharedPreferences(PREFS, 0).edit().remove(STORED).apply();
    }

    private synchronized String bearer() {
        String stored = getContext().getSharedPreferences(PREFS, 0).getString(STORED, null);
        if (stored == null || stored.isEmpty()) return null;
        try {
            JSONObject wrapped = new JSONObject(stored);
            byte[] iv = Base64.decode(wrapped.getString("iv"), Base64.URL_SAFE | Base64.NO_WRAP);
            byte[] data = Base64.decode(wrapped.getString("data"), Base64.URL_SAFE | Base64.NO_WRAP);
            if (iv.length != 12 || data.length > 16384) throw new Exception("Invalid encrypted payload");
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, secretKey(), new GCMParameterSpec(128, iv));
            JSONObject content = new JSONObject(new String(cipher.doFinal(data), StandardCharsets.UTF_8));
            long expiresAt = content.getLong("expiresAt");
            String token = content.getString("token");
            if (expiresAt <= System.currentTimeMillis() || token.length() < 20 || token.length() > 8192) {
                eraseSession();
                return null;
            }
            return token;
        } catch (Exception error) {
            eraseSession();
            return null;
        }
    }

    private JSONObject request(String route, String method, JSONObject body, String token) throws Exception {
        if (!route.startsWith("/") || route.contains("://") || route.contains("..")) {
            throw new ApiFailure("INVALID_ROUTE");
        }
        URL url = new URL(ENDPOINT + route);
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        try {
            connection.setInstanceFollowRedirects(false);
            connection.setConnectTimeout(CONNECT_TIMEOUT_MS);
            connection.setReadTimeout(READ_TIMEOUT_MS);
            connection.setRequestMethod(method);
            connection.setRequestProperty("Accept", "application/json");
            if (token != null && !token.isEmpty()) {
                connection.setRequestProperty("Authorization", "Bearer " + token);
            }
            if (body != null) {
                connection.setDoOutput(true);
                connection.setRequestProperty("Content-Type", "application/json; charset=UTF-8");
                try (OutputStream stream = connection.getOutputStream()) {
                    stream.write(body.toString().getBytes(StandardCharsets.UTF_8));
                }
            }
            int status = connection.getResponseCode();
            InputStream source = status >= 400 ? connection.getErrorStream() : connection.getInputStream();
            JSONObject data = new JSONObject();
            if (source != null) {
                try (InputStream stream = source; ByteArrayOutputStream output = new ByteArrayOutputStream()) {
                    byte[] buffer = new byte[4096];
                    int read;
                    while ((read = stream.read(buffer)) != -1) {
                        if (output.size() + read > MAX_RESPONSE_BYTES) throw new ApiFailure("RESPONSE_TOO_LARGE");
                        output.write(buffer, 0, read);
                    }
                    String result = output.toString("UTF-8").trim();
                    if (!result.isEmpty()) data = new JSONObject(result);
                }
            }
            if (status < 200 || status >= 300) {
                throw new ApiFailure(data.optString("error", "YOUTUBE_ERROR"));
            }
            return data;
        } finally {
            connection.disconnect();
        }
    }

    private JSONObject authenticatedRequest(String route, String method, JSONObject payload) throws Exception {
        String token = bearer();
        if (token == null) throw new ApiFailure("SESSION_EXPIRED");
        try {
            return request(route, method, payload, token);
        } catch (ApiFailure error) {
            if ("SESSION_EXPIRED".equals(error.code)) eraseSession();
            throw error;
        }
    }

    private void background(PluginCall call, RemoteCall operation) {
        new Thread(() -> {
            try {
                JSONObject response = operation.execute();
                JSObject result = new JSObject();
                for (java.util.Iterator<String> keys = response.keys(); keys.hasNext();) {
                    String key = keys.next();
                    result.put(key, response.opt(key));
                }
                call.resolve(result);
            } catch (ApiFailure error) {
                call.reject(error.code);
            } catch (Exception error) {
                // Never emit Google API responses, tickets, refresh tokens, or bearer credentials.
                call.reject("NETWORK");
            }
        }, "TifloYouTubeAccount").start();
    }

    private interface RemoteCall {
        JSONObject execute() throws Exception;
    }

    @PluginMethod
    public void beginSignIn(PluginCall call) {
        try {
            String verifier = nextVerifier();
            String url = ENDPOINT + "/auth/native/start?challenge=" + Uri.encode(challenge(verifier));
            JSObject result = new JSObject();
            result.put("url", url);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("NATIVE_AUTH_INVALID");
        }
    }

    @PluginMethod
    public void completeSignIn(PluginCall call) {
        String callback = call.getString("url", "");
        Uri uri;
        try { uri = Uri.parse(callback); }
        catch (Exception error) { call.reject("NATIVE_AUTH_INVALID"); return; }

        if (!CALLBACK_SCHEME.equals(uri.getScheme()) || !CALLBACK_HOST.equals(uri.getHost()) ||
            (uri.getPath() != null && !uri.getPath().isEmpty())) {
            call.reject("NATIVE_AUTH_INVALID");
            return;
        }
        String verifier = consumeVerifier();
        if (verifier == null) { call.reject("NATIVE_AUTH_INVALID"); return; }
        String returnedError = uri.getQueryParameter("error");
        if (returnedError != null) {
            call.reject("denied".equals(returnedError) ? "AUTH_DENIED" : "NATIVE_AUTH_INVALID");
            return;
        }
        String ticket = uri.getQueryParameter("ticket");
        if (ticket == null || ticket.isEmpty() || ticket.length() > 8192) {
            call.reject("NATIVE_AUTH_INVALID");
            return;
        }

        background(call, () -> {
            JSONObject input = new JSONObject();
            input.put("ticket", ticket);
            input.put("verifier", verifier);
            JSONObject result = request("/auth/native/exchange", "POST", input, null);
            if (!result.optBoolean("authenticated") || result.optLong("expiresAt") <= System.currentTimeMillis()) {
                throw new ApiFailure("NATIVE_AUTH_INVALID");
            }
            String token = result.optString("token", "");
            if (token.length() < 20 || token.length() > 8192) throw new ApiFailure("NATIVE_AUTH_INVALID");
            saveSession(token, result.getLong("expiresAt"));
            return new JSONObject().put("authenticated", true);
        });
    }

    @PluginMethod
    public void getSession(PluginCall call) {
        JSObject result = new JSObject();
        result.put("authenticated", bearer() != null);
        call.resolve(result);
    }

    @PluginMethod
    public void signOut(PluginCall call) {
        eraseSession();
        consumeVerifier();
        JSObject result = new JSObject();
        result.put("authenticated", false);
        call.resolve(result);
    }

    @PluginMethod
    public void getVideoState(PluginCall call) {
        String id = call.getString("videoId", "");
        if (!id.matches(VALID_VIDEO)) { call.reject("INVALID_VIDEO"); return; }
        background(call, () -> authenticatedRequest("/state?videoId=" + Uri.encode(id), "GET", null));
    }

    @PluginMethod
    public void performAction(PluginCall call) {
        String action = call.getString("action", "");
        if (!Arrays.asList("subscribe", "unsubscribe", "like", "unlike", "comment").contains(action)) {
            call.reject("INVALID_ACTION");
            return;
        }
        String id = call.getString("videoId", "");
        if (!id.matches(VALID_VIDEO)) { call.reject("INVALID_VIDEO"); return; }
        String comment = call.getString("text", "");
        if ("comment".equals(action) && (comment.trim().isEmpty() || comment.length() > 10000)) {
            call.reject("INVALID_COMMENT");
            return;
        }
        background(call, () -> {
            JSONObject input = new JSONObject().put("videoId", id);
            if ("comment".equals(action)) input.put("text", comment);
            return authenticatedRequest("/" + action, "POST", input);
        });
    }
}
