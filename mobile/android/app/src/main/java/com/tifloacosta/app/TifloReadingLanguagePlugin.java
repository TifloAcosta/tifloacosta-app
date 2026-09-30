package com.tifloacosta.app;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.tifloacosta.app.reading.ReadingTranslationService;

import org.json.JSONException;

import java.util.ArrayList;
import java.util.List;

@CapacitorPlugin(name = "TifloReadingLanguage")
public class TifloReadingLanguagePlugin extends Plugin {
    private ReadingTranslationService service;

    @Override
    public void load() {
        service = new ReadingTranslationService();
    }

    @PluginMethod
    public void identifyLanguage(PluginCall call) {
        String text = call.getString("text");
        getBridge().execute(() -> {
            try {
                JSObject result = new JSObject();
                result.put("language", service.identifyLanguage(text));
                call.resolve(result);
            } catch (Exception error) {
                call.reject("Unable to identify reading language", error);
            }
        });
    }

    @PluginMethod
    public void listTranslationLanguages(PluginCall call) {
        getBridge().execute(() -> {
            JSArray languages = new JSArray();
            for (String language : service.listTranslationLanguages()) languages.put(language);
            JSObject result = new JSObject();
            result.put("languages", languages);
            call.resolve(result);
        });
    }

    @PluginMethod
    public void downloadTranslationModel(PluginCall call) {
        String language = clean(call.getString("language"));
        if (language.isEmpty()) {
            call.reject("Translation language is required");
            return;
        }
        getBridge().execute(() -> {
            try {
                JSObject result = new JSObject();
                result.put("downloaded", service.downloadTranslationModel(language));
                result.put("language", language);
                call.resolve(result);
            } catch (ReadingTranslationService.UnsupportedLanguageException unsupported) {
                call.reject("Unsupported translation language", unsupported);
            } catch (Exception error) {
                call.reject("Unable to download translation model", error);
            }
        });
    }

    @PluginMethod
    public void translateBatch(PluginCall call) {
        String sourceLanguage = clean(call.getString("sourceLanguage"));
        String targetLanguage = clean(call.getString("targetLanguage"));
        JSArray values = call.getArray("texts");
        if (sourceLanguage.isEmpty() || targetLanguage.isEmpty() || values == null) {
            call.reject("Translation languages and texts are required");
            return;
        }

        List<String> texts = new ArrayList<>();
        try {
            for (int index = 0; index < values.length(); index += 1) {
                Object value = values.get(index);
                texts.add(value == null ? "" : String.valueOf(value));
            }
        } catch (JSONException error) {
            call.reject("Invalid translation text batch", error);
            return;
        }

        if (texts.size() > ReadingTranslationService.MAX_BATCH_SIZE) {
            call.reject("Translation batch exceeds 50 strings");
            return;
        }

        getBridge().execute(() -> {
            try {
                List<String> translated = service.translateBatch(sourceLanguage, targetLanguage, texts);
                JSArray translations = new JSArray();
                for (String value : translated) translations.put(value);
                JSObject result = new JSObject();
                result.put("translations", translations);
                call.resolve(result);
            } catch (ReadingTranslationService.ModelUnavailableException unavailable) {
                JSObject result = new JSObject();
                result.put("translations", new JSArray());
                result.put("status", "model-unavailable");
                call.resolve(result);
            } catch (ReadingTranslationService.UnsupportedLanguageException unsupported) {
                JSObject result = new JSObject();
                result.put("translations", new JSArray());
                result.put("status", "unsupported-language");
                call.resolve(result);
            } catch (Exception error) {
                JSObject result = new JSObject();
                result.put("translations", new JSArray());
                result.put("status", "error");
                call.resolve(result);
            }
        });
    }

    private static String clean(String value) {
        return value == null ? "" : value.trim().toLowerCase(java.util.Locale.ROOT);
    }
}
