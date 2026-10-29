package com.tifloacosta.nativeprototype

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ReaderFinalAuditTest {
    @Test fun backupAcceptsOnlyPrivateBookFilesAndCheckpointNames() {
        val id = "f1a1ddf4-cc39-4aea-8095-222222222222"
        assertTrue(NativeReaderBackup.safeDataPath(id + ".txt"))
        assertTrue(NativeReaderBackup.safeDataPath(id + ".source.epub"))
        assertTrue(NativeReaderBackup.safeDataPath(id + ".007.mp3"))
        assertTrue(NativeReaderBackup.safeDataPath(id + ".ocr-pdf/page-00250.txt"))
        assertTrue(NativeReaderBackup.safeDataPath(id + ".ocr-images/source.txt"))
        assertTrue(NativeReaderBackup.safeDataPath(id + ".ocr-images/total.txt"))
        for (unsafe in listOf(
            "../index.json", "index.json", "folders.json", "/tmp/book.txt",
            "book/../index.json", id + ".source.html/../index.json",
            id + ".ocr-pdf/page-00001.txt.tmp", id + ".ocr-pdf/other.txt",
            id + ".source.sh", "bad-id.txt", id + ".abc.exe",
            id + ".ocr-images/../../index.json", id + ".txt/another"
        )) {
            assertFalse(unsafe, NativeReaderBackup.safeDataPath(unsafe))
        }
    }

    @Test fun doNotLoseProgressWhenSplittingReadingUnitsAfterOcr() {
        val original = "Primer párrafo.\nSegundo párrafo con acento.\nTercero."
        val offset = original.indexOf("Segundo")
        assertTrue(ReaderUnits.indexForOffset(ReaderUnits.split(original, 1), offset) > 0)
        val expanded = "Página 1\n" + original
        assertTrue(ReaderUnits.percent(offset, expanded.length) <= 100)
        assertEquals(0, ReaderUnits.percent(10, 0))
    }

    @Test fun existingFolderAndQueueRulesStillPreserveOrderAndUnicode() {
        assertEquals("Novelas clásicas", ReaderLibraryRules.folderName(" Novelas clásicas "))
        assertEquals(listOf("B", "A", "C"),
            ReaderLibraryRules.move(listOf("A","B","C"), "B", -1))
    }
}
