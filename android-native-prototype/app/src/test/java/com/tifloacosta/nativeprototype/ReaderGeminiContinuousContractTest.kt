package com.tifloacosta.nativeprototype

import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class ReaderGeminiContinuousContractTest {
    private fun source(name: String) =
        File("src/main/java/com/tifloacosta/nativeprototype/$name").readText()

    @Test fun engineChoiceIsExplicitAndLocalByDefault() {
        val ui = source("NativeTifloLector.kt")
        assertTrue(ui.contains("listOf(\"Sistema\", \"Gemini\")"))
        assertTrue(ui.contains("getInt(\"engine.\" + book.id, 0)"))
        assertTrue(ui.contains("NativeVoiceCredentials(context).hasKey(\"gemini\")"))
        assertTrue(ui.contains("envía fragmentos del documento a Google"))
    }

    @Test fun continuousAudioRunsInForegroundWithRealCursorAndCancellation() {
        val service = source("NativeReaderPlaybackService.kt")
        assertTrue(service.contains("geminiWorker.execute"))
        assertTrue(service.contains("NativeGeminiSpeech.generate"))
        assertTrue(service.contains("generation != geminiGeneration"))
        assertTrue(service.contains("textOffset = geminiNextOffset"))
        assertTrue(service.contains("geminiGeneration++"))
        assertTrue(service.contains("File.createTempFile"))
        assertTrue(service.contains("geminiAudioFile?.delete()"))
        assertTrue(service.contains("MediaPlayer()"))
    }
}
