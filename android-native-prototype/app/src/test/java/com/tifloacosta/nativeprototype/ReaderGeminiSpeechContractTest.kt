package com.tifloacosta.nativeprototype

import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class ReaderGeminiSpeechContractTest {
    private fun source(file: String) =
        File("src/main/java/com/tifloacosta/nativeprototype/$file").readText()

    @Test fun ttsUsesGeminiAudioEndpointAndSecureHeader() {
        val tts = source("NativeGeminiSpeech.kt")
        assertTrue(tts.contains(":generateContent"))
        assertTrue(tts.contains("responseModalities"))
        assertTrue(tts.contains("x-goog-api-key"))
        assertTrue(tts.contains("NativeVoiceCredentials"))
        assertTrue(!tts.contains("?key="))
        assertTrue(tts.contains("inlineData"))
        assertTrue(tts.contains("RIFF"))
    }

    @Test fun userRequestsSampleAndCanStopPlayback() {
        val ui = source("NativeReaderExternalVoiceKeys.kt")
        assertTrue(ui.contains("NativeGeminiSpeech.generate"))
        assertTrue(ui.contains("preview.play(wav)"))
        assertTrue(ui.contains("preview.stop()"))
        assertTrue(ui.contains("puede consumir cuota"))
    }
}
