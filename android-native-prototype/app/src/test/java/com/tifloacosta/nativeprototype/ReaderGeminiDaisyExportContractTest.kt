package com.tifloacosta.nativeprototype

import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class ReaderGeminiDaisyExportContractTest {
    private fun source(name: String) =
        File("src/main/java/com/tifloacosta/nativeprototype/$name").readText()

    @Test fun packageIncludesTextNavigationSynchronizationAndGeneratedAudio() {
        val daisy = source("NativeGeminiDaisyExport.kt")
        listOf("book.opf", "book.xml", "book.ncx", "sync.smil",
            "smilref", "clipBegin", "clipEnd", "ZipOutputStream",
            "NativeGeminiSpeech.generate", "PLACEHOLDER_UNITS",
            "written.joinToString", "parallel.joinToString"
        ).forEach { part -> assertTrue("Missing $part", daisy.contains(part)) }
    }

    @Test fun outputIsOfferedWithARealZipMimeAndSavedAsZip() {
        val actions = source("NativeReaderDocumentActions.kt")
        assertTrue(actions.contains("listOf(\"M4A\", \"WAV\", \"DAISY\")"))
        assertTrue(actions.contains("NativeGeminiDaisyExport.generate"))
        assertTrue(actions.contains("CreateDocument(\"application/zip\")"))
        assertTrue(actions.contains("exportAudioDAISY.launch(labelFile(\"zip\"))"))
    }
}
