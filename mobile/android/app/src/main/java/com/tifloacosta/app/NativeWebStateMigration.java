package com.tifloacosta.app;

import android.app.Activity;
import android.content.Context;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * One-off read-only import from the old Capacitor localStorage origin.
 * Never shows a web screen. Does not clear or rewrite the old values.
 * Only the four known first-party keys are read; all other web data stays private.
 */
public final class NativeWebStateMigration {
    private static final String ORIGIN = "https://localhost/";
    private static final String KEY_DONE = "native-web-state-migration-v1";
    private NativeWebStateMigration() {}

    public static void importIfNecessary(Activity activity) {
        if (activity.getPackageName().equals("com.tifloacosta.nativeprototype")) return;
        if (activity.getSharedPreferences("native-compatibility", Context.MODE_PRIVATE)
                .getBoolean(KEY_DONE, false)) return;
        final WebView view = new WebView(activity);
        view.getSettings().setJavaScriptEnabled(true);
        view.getSettings().setDomStorageEnabled(true);
        view.getSettings().setAllowFileAccess(false);
        view.getSettings().setAllowContentAccess(false);
        view.setWebViewClient(new WebViewClient() {
            private boolean completed = false;

            @Override
            public void onPageFinished(WebView web, String url) {
                if (completed) return;
                completed = true;
                // Read the exact Capacitor keys; never enumerate unrelated storage.
                final String script = "(function(){var r={};" +
                        "var k=['tiflo-mobile-favorites-v1','tiflo-mobile-preferences-v1'," +
                        "'tiflo-mobile-news-seen-v1','tiflo-mobile-notifications-opt-in-v1'];" +
                        "for(var i=0;i<k.length;i++){try{r[k[i]]=localStorage.getItem(k[i]);}" +
                        "catch(e){return null;}}return JSON.stringify(r);})()";
                web.evaluateJavascript(script, json -> {
                    try {
                        String decoded = new JSONArray("[" + json + "]").optString(0, "");
                        if (decoded.isEmpty() || decoded.equals("null"))
                            return;
                        JSONObject data = new JSONObject(decoded);
                        copyKnownKeys(activity, data);
                        activity.getSharedPreferences("native-compatibility", Context.MODE_PRIVATE)
                                .edit().putBoolean(KEY_DONE, true).apply();
                    } catch (Exception ignored) {
                        // Keep the original data. Retry next time.
                    } finally {
                        web.post(web::destroy);
                    }
                });
            }
        });
        // A local HTML document with the same origin as Capacitor; no network request.
        view.loadDataWithBaseURL(ORIGIN, "<!doctype html><html><body></body></html>",
                "text/html", "UTF-8", ORIGIN);
    }

    private static void copyKnownKeys(Activity activity, JSONObject data) {
        String rawFavorites = data.optString("tiflo-mobile-favorites-v1", "");
        if (!rawFavorites.isEmpty() && !rawFavorites.equals("null")) {
            try {
                JSONArray from = new JSONArray(rawFavorites);
                JSONArray valid = new JSONArray();
                for (int i = 0; i < from.length() && i < 1000; i++) {
                    JSONObject o = from.optJSONObject(i);
                    if (o == null) continue;
                    String kind = o.optString("kind");
                    String id = o.optString("id");
                    if ((!kind.equals("news") && !kind.equals("resource") && !kind.equals("video"))
                            || id.isEmpty()) continue;
                    valid.put(new JSONObject().put("kind", kind).put("id", id));
                }
                android.content.SharedPreferences dest = activity.getSharedPreferences(
                        "native-content-favorites-v1", Context.MODE_PRIVATE);
                if (!dest.contains("favorites"))
                    dest.edit().putString("favorites", valid.toString()).commit();
            } catch (Exception ignored) { /* Preserve original. */ }
        }

        String rawPrefs = data.optString("tiflo-mobile-preferences-v1", "");
        if (!rawPrefs.isEmpty() && !rawPrefs.equals("null")) {
            try {
                JSONObject prev = new JSONObject(rawPrefs);
                android.content.SharedPreferences dest = activity.getSharedPreferences(
                        "native-app-settings-v1", Context.MODE_PRIVATE);
                android.content.SharedPreferences.Editor edit = dest.edit();
                String language = prev.optString("lang");
                if (!dest.contains("language") && (language.equals("es") || language.equals("en")))
                    edit.putString("language", language);
                String theme = prev.optString("theme");
                if (!dest.contains("theme") && (theme.equals("dark") || theme.equals("light")
                        || theme.equals("auto"))) {
                    edit.putString("theme", theme.equals("auto") ? "system" : theme);
                }
                if (!dest.contains("enlarged"))
                    edit.putBoolean("enlarged",
                        prev.optString("textSize").equals("large")
                            || prev.optString("textSize").equals("xlarge")
                            || prev.optString("textSize").equals("max"));
                edit.commit();
            } catch (Exception ignored) { /* Preserve original. */ }
        }

        String rawSeen = data.optString("tiflo-mobile-news-seen-v1", "");
        if (!rawSeen.isEmpty() && !rawSeen.equals("null")) {
            activity.getSharedPreferences("native-compatibility", Context.MODE_PRIVATE)
                    .edit().putString("legacy-news-seen-json", rawSeen).apply();
        }

        // Prior consent is not inferred from OS permissions.
        if ("1".equals(data.optString("tiflo-mobile-notifications-opt-in-v1"))) {
            activity.getSharedPreferences("native-app-settings-v1", Context.MODE_PRIVATE)
                    .edit().putBoolean("push-consent", true).apply();
            com.onesignal.OneSignal.setConsentGiven(true);
        }
    }
}
