package com.tifloacosta.nativeprototype

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.nio.file.Files

class ReaderAdvancedOcrTest {
    @Test fun embeddedImageFiltersAreScopedToActualDocumentMediaFolders() {
        assertTrue(NativeReaderAdvancedOcr.imagePathAccepted("word/media/image1.png", "docx"))
        assertTrue(NativeReaderAdvancedOcr.imagePathAccepted("ppt/media/image2.jpg", "ppsx"))
        assertTrue(NativeReaderAdvancedOcr.imagePathAccepted("xl/media/image3.jpeg", "xlsx"))
        assertTrue(NativeReaderAdvancedOcr.imagePathAccepted("Pictures/figura.png", "odt"))
        assertTrue(NativeReaderAdvancedOcr.imagePathAccepted("OEBPS/images/photo.jpg", "epub"))
        assertFalse(NativeReaderAdvancedOcr.imagePathAccepted("word/styles.xml", "docx"))
        assertFalse(NativeReaderAdvancedOcr.imagePathAccepted("pictures/photo.jpg", "docx"))
        assertFalse(NativeReaderAdvancedOcr.imagePathAccepted("../word/media/image.png", "docx"))
        assertFalse(NativeReaderAdvancedOcr.imagePathAccepted("/word/media/image.png", "docx"))
        assertFalse(NativeReaderAdvancedOcr.imagePathAccepted("word/media/cover.jpg", "docx"))
        assertFalse(NativeReaderAdvancedOcr.imagePathAccepted("word/media/photo.svg", "docx"))
        assertFalse(NativeReaderAdvancedOcr.sourceSupportsEmbeddedImages("pdf"))
        assertFalse(NativeReaderAdvancedOcr.sourceSupportsEmbeddedImages("doc"))
    }

    @Test fun checkpointsSkipCompletedWorkEvenAfterRestartOrPartialPage() {
        val dir = Files.createTempDirectory("reader-ocr-checkpoints").toFile()
        try {
            java.io.File(dir, "page-00001.txt").writeText("Texto de primera página")
            java.io.File(dir, "page-00002.txt.tmp").writeText("Incompleto")
            java.io.File(dir, "page-00003.txt").writeText("")
            assertTrue(NativeReaderAdvancedOcr.isCheckpointComplete(dir, 1))
            assertFalse(NativeReaderAdvancedOcr.isCheckpointComplete(dir, 2))
            assertTrue(NativeReaderAdvancedOcr.isCheckpointComplete(dir, 3))
            assertEquals(listOf(1,3), NativeReaderAdvancedOcr.checkpointOrder(dir,3))
        } finally { dir.deleteRecursively() }
    }

    @Test fun largePdfLimitsAreClearlyBounded() {
        assertEquals(400L * 1024 * 1024, NativeReaderAdvancedOcr.MAX_PDF_BYTES)
        assertTrue(NativeReaderAdvancedOcr.MAX_PAGES > NativeReaderOcr.MAX_OCR_PAGES)
        assertTrue(NativeReaderAdvancedOcr.MAX_TEXT_CHARS > 0)
    }
}
