package com.tifloacosta.nativeprototype

import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class ReaderGeminiAudioFormatContractTest {
    private fun source(name: String) =
        File("src/main/java/com/tifloacosta/nativeprototype/$name").readText()

    @Test fun selectableFormatsMatchRealEncodersAndFileTypes() {
        val export = source("NativeGeminiAudioExport.kt")
        val actions = source("NativeReaderDocumentActions.kt")
        assertTrue(export.contains("MediaCodec.createEncoderByType"))
        assertTrue(export.contains("MediaMuxer"))
        assertTrue(export.contains("MIMETYPE_AUDIO_AAC"))
        assertTrue(export.contains("M4A(\"m4a\", \"audio/mp4\")"))
        assertTrue(export.contains("WAV(\"wav\", \"audio/wav\")"))
        assertTrue(actions.contains("listOf(\"M4A\", \"WAV\")"))
        assertTrue(actions.contains("CreateDocument(\"audio/mp4\")"))
        assertTrue(actions.contains("CreateDocument(\"audio/wav\")"))
        assertTrue(actions.contains("MP3 necesita un codificador adicional"))
    }
}
