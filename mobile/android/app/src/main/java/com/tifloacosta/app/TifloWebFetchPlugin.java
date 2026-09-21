package com.tifloacosta.app;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.SocketTimeoutException;
import java.net.URL;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@CapacitorPlugin(name = "TifloWebFetch")
public class TifloWebFetchPlugin extends Plugin {
    private static final int MAX_REDIRECTS = 5;
    private static final int TOTAL_TIMEOUT_MS = 15000;
    private static final int MAX_BODY_BYTES = 5 * 1024 * 1024;
    private static final String USER_AGENT = "TifloAcosta/1.0";
    private static final Pattern CHARSET_PATTERN = Pattern.compile("charset\\s*=\\s*['\\\"]?([^;\\s'\\\"]+)", Pattern.CASE_INSENSITIVE);

    @PluginMethod
    public void fetchPage(PluginCall call) {
        String value = call.getString("url");
        URL initial;
        try {
            initial = checkedUrl(value);
        } catch (Exception error) {
            reject(call, "invalid_url", "The URL is not a valid HTTP or HTTPS address", error);
            return;
        }
        getBridge().execute(() -> fetch(call, initial));
    }

    private void fetch(PluginCall call, URL initial) {
        long deadline = System.nanoTime() + TOTAL_TIMEOUT_MS * 1_000_000L;
        URL current = initial;
        int redirects = 0;

        try {
            while (true) {
                int remaining = remainingMillis(deadline);
                HttpURLConnection connection = (HttpURLConnection) current.openConnection();
                try {
                    connection.setInstanceFollowRedirects(false);
                    connection.setConnectTimeout(remaining);
                    connection.setReadTimeout(remaining);
                    connection.setRequestProperty("User-Agent", USER_AGENT);
                    connection.setRequestMethod("GET");

                    int status = connection.getResponseCode();
                    if (isRedirect(status)) {
                        if (redirects >= MAX_REDIRECTS) {
                            throw new FetchFailure("too_many_redirects", "Too many redirects");
                        }
                        String location = connection.getHeaderField("Location");
                        if (location == null || location.trim().isEmpty()) {
                            throw new FetchFailure("http_error", "Redirect response has no Location header");
                        }
                        current = checkedUrl(new URL(current, location).toString());
                        redirects += 1;
                        continue;
                    }

                    if (status < 200 || status >= 300) {
                        throw new FetchFailure("http_error", "HTTP status " + status);
                    }

                    String rawContentType = connection.getContentType();
                    String contentType = mimeType(rawContentType);
                    if (!isSupportedContentType(contentType)) {
                        throw new FetchFailure("unsupported_type", "Unsupported content type");
                    }

                    long declaredLength = connection.getContentLengthLong();
                    if (declaredLength > MAX_BODY_BYTES) {
                        throw new FetchFailure("too_large", "Response is larger than the allowed limit");
                    }

                    byte[] bytes = readLimited(connection, deadline);
                    Charset charset = charset(rawContentType);
                    String body = new String(bytes, charset);

                    JSObject result = new JSObject();
                    result.put("ok", true);
                    result.put("finalUrl", current.toString());
                    result.put("status", status);
                    result.put("contentType", contentType);
                    result.put("body", body);
                    call.resolve(result);
                    return;
                } finally {
                    connection.disconnect();
                }
            }
        } catch (FetchFailure error) {
            reject(call, error.code, error.getMessage(), error);
        } catch (SocketTimeoutException error) {
            reject(call, "timeout", "The request timed out", error);
        } catch (Exception error) {
            if (System.nanoTime() >= deadline) {
                reject(call, "timeout", "The request timed out", error);
            } else {
                reject(call, "unreachable", "The page could not be reached", error);
            }
        }
    }

    private byte[] readLimited(HttpURLConnection connection, long deadline) throws Exception {
        try (InputStream input = connection.getInputStream(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192];
            int total = 0;
            while (true) {
                connection.setReadTimeout(remainingMillis(deadline));
                int read = input.read(buffer);
                if (read == -1) break;
                total += read;
                if (total > MAX_BODY_BYTES) {
                    throw new FetchFailure("too_large", "Response is larger than the allowed limit");
                }
                output.write(buffer, 0, read);
            }
            return output.toByteArray();
        }
    }

    private URL checkedUrl(String value) throws Exception {
        if (value == null || value.trim().isEmpty()) throw new IllegalArgumentException("Missing URL");
        URL url = new URL(value.trim());
        String protocol = url.getProtocol();
        if (!"http".equalsIgnoreCase(protocol) && !"https".equalsIgnoreCase(protocol)) {
            throw new IllegalArgumentException("Unsupported protocol");
        }
        return url;
    }

    private int remainingMillis(long deadline) throws FetchFailure {
        long nanos = deadline - System.nanoTime();
        if (nanos <= 0) throw new FetchFailure("timeout", "The request timed out");
        return Math.max(1, (int) Math.min(Integer.MAX_VALUE, (nanos + 999_999L) / 1_000_000L));
    }

    private boolean isRedirect(int status) {
        return status == 301 || status == 302 || status == 303 || status == 307 || status == 308;
    }

    private String mimeType(String raw) {
        if (raw == null) return "";
        int separator = raw.indexOf(';');
        String type = separator >= 0 ? raw.substring(0, separator) : raw;
        return type.trim().toLowerCase(Locale.ROOT);
    }

    private boolean isSupportedContentType(String type) {
        return "text/html".equals(type) || "application/xhtml+xml".equals(type) || "text/plain".equals(type);
    }

    private Charset charset(String rawContentType) {
        if (rawContentType != null) {
            Matcher match = CHARSET_PATTERN.matcher(rawContentType);
            if (match.find()) {
                try {
                    return Charset.forName(match.group(1));
                } catch (Exception ignored) {
                    // Fall back to UTF-8 for invalid or unsupported declarations.
                }
            }
        }
        return StandardCharsets.UTF_8;
    }

    private void reject(PluginCall call, String code, String message, Exception error) {
        call.reject(message, code, error);
    }

    private static class FetchFailure extends Exception {
        final String code;

        FetchFailure(String code, String message) {
            super(message);
            this.code = code;
        }
    }
}
