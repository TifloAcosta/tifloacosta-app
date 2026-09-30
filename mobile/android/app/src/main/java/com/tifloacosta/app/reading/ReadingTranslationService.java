package com.tifloacosta.app.reading;

import com.google.android.gms.tasks.Tasks;
import com.google.mlkit.common.model.DownloadConditions;
import com.google.mlkit.common.model.RemoteModelManager;
import com.google.mlkit.nl.languageid.LanguageIdentification;
import com.google.mlkit.nl.languageid.LanguageIdentifier;
import com.google.mlkit.nl.translate.TranslateLanguage;
import com.google.mlkit.nl.translate.TranslateRemoteModel;
import com.google.mlkit.nl.translate.Translation;
import com.google.mlkit.nl.translate.Translator;
import com.google.mlkit.nl.translate.TranslatorOptions;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.ExecutionException;

public final class ReadingTranslationService {
    public static final int MAX_BATCH_SIZE = 50;

    interface LanguageIdentifierAdapter {
        String identify(String text) throws Exception;
    }

    interface TranslationAdapter {
        List<String> supportedLanguages();
        boolean isModelDownloaded(String language) throws Exception;
        void downloadModel(String language) throws Exception;
        String translate(String sourceLanguage, String targetLanguage, String text) throws Exception;
    }

    public static final class UnsupportedLanguageException extends Exception {
        public UnsupportedLanguageException(String message) { super(message); }
    }

    public static final class ModelUnavailableException extends Exception {
        public ModelUnavailableException(String message) { super(message); }
    }

    private final LanguageIdentifierAdapter languageIdentifier;
    private final TranslationAdapter translations;

    public ReadingTranslationService() {
        this(new MlKitLanguageIdentifier(), new MlKitTranslations());
    }

    ReadingTranslationService(LanguageIdentifierAdapter languageIdentifier, TranslationAdapter translations) {
        if (languageIdentifier == null) throw new IllegalArgumentException("languageIdentifier is required");
        if (translations == null) throw new IllegalArgumentException("translations is required");
        this.languageIdentifier = languageIdentifier;
        this.translations = translations;
    }

    public String identifyLanguage(String text) throws Exception {
        String value = text == null ? "" : text.trim();
        if (value.isEmpty()) return "und";
        String language = cleanLanguage(languageIdentifier.identify(value));
        return language.isEmpty() ? "und" : language;
    }

    public List<String> listTranslationLanguages() {
        Set<String> unique = new LinkedHashSet<>();
        for (String value : translations.supportedLanguages()) {
            String language = cleanLanguage(value);
            if (!language.isEmpty()) unique.add(language);
        }
        List<String> result = new ArrayList<>(unique);
        Collections.sort(result);
        return result;
    }

    public boolean downloadTranslationModel(String language) throws Exception {
        String normalized = cleanLanguage(language);
        requireSupported(normalized);
        translations.downloadModel(normalized);
        return translations.isModelDownloaded(normalized);
    }

    public List<String> translateBatch(String sourceLanguage, String targetLanguage, List<String> texts) throws Exception {
        String source = cleanLanguage(sourceLanguage);
        String target = cleanLanguage(targetLanguage);
        requireSupported(source);
        requireSupported(target);
        if (source.equals(target)) throw new IllegalArgumentException("Source and target languages must differ");
        List<String> values = texts == null ? Collections.emptyList() : texts;
        if (values.size() > MAX_BATCH_SIZE) throw new IllegalArgumentException("Translation batch exceeds 50 strings");
        if (!translations.isModelDownloaded(source) || !translations.isModelDownloaded(target)) {
            throw new ModelUnavailableException("Translation model is not available yet");
        }

        List<String> result = new ArrayList<>(values.size());
        for (String value : values) {
            result.add(translations.translate(source, target, value == null ? "" : value));
        }
        return result;
    }

    private void requireSupported(String language) throws UnsupportedLanguageException {
        if (language.isEmpty() || !listTranslationLanguages().contains(language)) {
            throw new UnsupportedLanguageException("Unsupported translation language: " + language);
        }
    }

    private static String cleanLanguage(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }

    private static final class MlKitLanguageIdentifier implements LanguageIdentifierAdapter {
        @Override
        public String identify(String text) throws Exception {
            LanguageIdentifier identifier = LanguageIdentification.getClient();
            try {
                return await(identifier.identifyLanguage(text));
            } finally {
                identifier.close();
            }
        }
    }

    private static final class MlKitTranslations implements TranslationAdapter {
        private final RemoteModelManager modelManager = RemoteModelManager.getInstance();

        @Override
        public List<String> supportedLanguages() {
            return new ArrayList<>(TranslateLanguage.getAllLanguages());
        }

        @Override
        public boolean isModelDownloaded(String language) throws Exception {
            TranslateRemoteModel model = new TranslateRemoteModel.Builder(language).build();
            Boolean downloaded = await(modelManager.isModelDownloaded(model));
            return Boolean.TRUE.equals(downloaded);
        }

        @Override
        public void downloadModel(String language) throws Exception {
            TranslateRemoteModel model = new TranslateRemoteModel.Builder(language).build();
            await(modelManager.download(model, new DownloadConditions.Builder().build()));
        }

        @Override
        public String translate(String sourceLanguage, String targetLanguage, String text) throws Exception {
            TranslatorOptions options = new TranslatorOptions.Builder()
                    .setSourceLanguage(sourceLanguage)
                    .setTargetLanguage(targetLanguage)
                    .build();
            Translator translator = Translation.getClient(options);
            try {
                return await(translator.translate(text));
            } finally {
                translator.close();
            }
        }
    }

    private static <T> T await(com.google.android.gms.tasks.Task<T> task) throws Exception {
        try {
            return Tasks.await(task);
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
            throw interrupted;
        } catch (ExecutionException execution) {
            Throwable cause = execution.getCause();
            if (cause instanceof Exception) throw (Exception) cause;
            throw execution;
        }
    }
}
