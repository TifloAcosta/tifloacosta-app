package com.tifloacosta.nativeprototype

import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class ReaderPhononLanguagePreviewTest {
    @Test fun previewCoversEverySelectablePhononLanguage() {
        val source = File("src/main/java/com/tifloacosta/nativeprototype/NativeReaderExternalVoiceKeys.kt").readText()
        for (language in listOf("es", "fr", "de", "pt")) {
            assertTrue("Missing preview for $language", source.contains("\"$language\" ->"))
        }
        assertTrue(source.contains("Hello. This is a sample of the Phonon voice."))
        assertTrue(source.contains("phononVoice.ifBlank { names.first() }, phononLanguage"))
    }
}
