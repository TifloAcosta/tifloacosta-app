package com.tifloacosta.app.reading;

import org.junit.Test;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertThrows;
import static org.junit.Assert.assertTrue;

public final class ReadingTranslationServiceTest {
    @Test
    public void preservesUndeterminedLanguage() throws Exception {
        ReadingTranslationService service = new ReadingTranslationService(
                text -> "und",
                new FakeTranslations()
        );
        assertEquals("und", service.identifyLanguage("12345"));
    }

    @Test
    public void exposesSupportedLanguagesAndRejectsUnsupportedPairs() {
        FakeTranslations translations = new FakeTranslations();
        translations.languages.addAll(Arrays.asList("en", "es", "fr"));
        ReadingTranslationService service = new ReadingTranslationService(text -> "en", translations);

        assertEquals(Arrays.asList("en", "es", "fr"), service.listTranslationLanguages());
        assertThrows(ReadingTranslationService.UnsupportedLanguageException.class,
                () -> service.translateBatch("zz", "es", Collections.singletonList("hello")));
        assertThrows(ReadingTranslationService.UnsupportedLanguageException.class,
                () -> service.translateBatch("en", "zz", Collections.singletonList("hello")));
    }

    @Test
    public void refusesTranslationUntilBothModelsAreAvailable() {
        FakeTranslations translations = new FakeTranslations();
        translations.languages.addAll(Arrays.asList("en", "es"));
        translations.downloaded.add("es");
        ReadingTranslationService service = new ReadingTranslationService(text -> "en", translations);

        assertThrows(ReadingTranslationService.ModelUnavailableException.class,
                () -> service.translateBatch("en", "es", Collections.singletonList("hello")));
    }

    @Test
    public void downloadsOneExplicitLanguageModel() throws Exception {
        FakeTranslations translations = new FakeTranslations();
        translations.languages.addAll(Arrays.asList("en", "es"));
        ReadingTranslationService service = new ReadingTranslationService(text -> "en", translations);

        assertTrue(service.downloadTranslationModel("es"));
        assertTrue(translations.downloaded.contains("es"));
    }

    @Test
    public void translatesAtMostFiftyStringsInInputOrder() throws Exception {
        FakeTranslations translations = new FakeTranslations();
        translations.languages.addAll(Arrays.asList("en", "es"));
        translations.downloaded.addAll(Arrays.asList("en", "es"));
        ReadingTranslationService service = new ReadingTranslationService(text -> "en", translations);

        List<String> result = service.translateBatch("en", "es", Arrays.asList("one", "two", "three"));
        assertEquals(Arrays.asList("es:one", "es:two", "es:three"), result);
        assertEquals(Arrays.asList("one", "two", "three"), translations.seen);

        List<String> tooMany = new ArrayList<>();
        for (int i = 0; i < 51; i++) tooMany.add("x" + i);
        assertThrows(IllegalArgumentException.class,
                () -> service.translateBatch("en", "es", tooMany));
    }

    @Test
    public void partialTaskFailureDoesNotReturnAReorderedPartialBatch() {
        FakeTranslations translations = new FakeTranslations();
        translations.languages.addAll(Arrays.asList("en", "es"));
        translations.downloaded.addAll(Arrays.asList("en", "es"));
        translations.failOn = "two";
        ReadingTranslationService service = new ReadingTranslationService(text -> "en", translations);

        assertThrows(IllegalStateException.class,
                () -> service.translateBatch("en", "es", Arrays.asList("one", "two", "three")));
        assertEquals(Arrays.asList("one", "two"), translations.seen);
    }

    private static final class FakeTranslations implements ReadingTranslationService.TranslationAdapter {
        final List<String> languages = new ArrayList<>();
        final Set<String> downloaded = new HashSet<>();
        final List<String> seen = new ArrayList<>();
        String failOn = "";

        @Override
        public List<String> supportedLanguages() {
            return new ArrayList<>(languages);
        }

        @Override
        public boolean isModelDownloaded(String language) {
            return downloaded.contains(language);
        }

        @Override
        public void downloadModel(String language) {
            downloaded.add(language);
        }

        @Override
        public String translate(String sourceLanguage, String targetLanguage, String text) {
            seen.add(text);
            if (text.equals(failOn)) throw new IllegalStateException("translation failed");
            return targetLanguage + ":" + text;
        }
    }
}
