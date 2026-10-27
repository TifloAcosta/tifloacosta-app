package com.tifloacosta.nativeprototype

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ReaderDocumentToolsTest {
    @Test fun translationChunksPreserveOriginalCharactersExactly() {
        val source = ("Un capítulo con párrafos y signos. Segunda frase!\n").repeat(380)
        val chunks = NativeReaderTranslation.chunks(source)
        assertTrue(chunks.size > 1)
        assertTrue(chunks.all { it.isNotEmpty() && it.length <= 1200 })
        assertEquals(source, chunks.joinToString(""))
    }

    @Test fun translationChunksSupportMultilingualTextWithoutDiscardingCharacters() {
        val source = "Hola, mundo. العربية 日本語 中文. " + "áéíóú ".repeat(100)
        val chunks = NativeReaderTranslation.chunks(source, 120)
        assertEquals(source, chunks.joinToString(""))
        assertTrue(chunks.size >= 2)
    }

    @Test fun languageListHasRecognizableLanguagesAndNoDuplicates() {
        val tags = NativeReaderTranslation.languages.map { it.tag }
        assertTrue(tags.containsAll(listOf("es", "en", "pt", "fr", "de", "it")))
        assertEquals(tags.distinct(), tags)
    }
}
