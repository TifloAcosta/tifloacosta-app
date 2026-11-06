package com.tifloacosta.nativeprototype

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ReaderGeminiAudioExportTest {
    @Test fun chunksRejoinWithoutLoss() {
        val text = ("Capítulo uno. Una frase larga con tildes y signos! ¿Y ahora?\n").repeat(110)
        val parts = NativeGeminiAudioExport.chunks(text)
        assertTrue(parts.size > 1)
        assertTrue(parts.all { it.length in 1..NativeGeminiAudioExport.CHUNK_SIZE })
        assertEquals(text, parts.joinToString(""))
    }

    @Test(expected = IllegalArgumentException::class)
    fun rejectsDocumentsOverLimitRatherThanTruncating() {
        NativeGeminiAudioExport.chunks("a".repeat(NativeGeminiAudioExport.MAX_CHARACTERS + 1))
    }

    @Test fun wavDataExtractionRejectsTruncatedInput() {
        try {
            NativeGeminiAudioExport.pcm(byteArrayOf(1, 2, 3))
            throw AssertionError("Expected rejection")
        } catch (expected: IllegalArgumentException) {
            assertTrue(expected.message.orEmpty().isNotBlank())
        }
    }
}
