package com.tifloacosta.nativeprototype

import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class ReaderImportPreservesHeadingsTest {
    @Test fun epubAndDocxHeadingPreservationExists() {
        val text = File("src/main/java/com/tifloacosta/nativeprototype/NativeReaderFormats.kt")
            .readText()
        assertTrue(text.contains("document.select(\"h\$level\")"))
        assertTrue(text.contains("heading.prependText"))
        assertTrue(text.contains("docxWithHeadings"))
        assertTrue(text.contains("w:pStyle"))
    }
}
