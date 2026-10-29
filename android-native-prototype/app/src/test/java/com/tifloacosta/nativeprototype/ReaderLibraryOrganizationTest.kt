package com.tifloacosta.nativeprototype

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.IOException

class ReaderLibraryOrganizationTest {
    @Test fun folderNamesPreserveUnicodeAndNormalizeUnsafeCharacters() {
        assertEquals("Novelas clásicas", ReaderLibraryRules.folderName("  Novelas clásicas  "))
        assertEquals("DAISY históricos", ReaderLibraryRules.folderName("DAISY históricos"))
        assertEquals("A B", ReaderLibraryRules.folderName("A/B"))
        for (bad in listOf("", "  ", "__none__", "x".repeat(71))) {
            try {
                ReaderLibraryRules.folderName(bad)
                throw AssertionError("Folder accepted: " + bad)
            } catch (_: IOException) {}
        }
    }

    @Test fun queueMovesBoundedAndDoesNotDuplicateBooks() {
        val queue = listOf("uno", "dos", "tres")
        assertEquals(listOf("dos", "uno", "tres"),
            ReaderLibraryRules.move(queue, "dos", -1))
        assertEquals(listOf("uno", "tres", "dos"),
            ReaderLibraryRules.move(queue, "dos", 1))
        assertEquals(queue, ReaderLibraryRules.move(queue, "uno", -9))
        assertEquals(queue, ReaderLibraryRules.move(queue, "tres", 100))
        assertEquals(queue, ReaderLibraryRules.move(queue, "otro", -1))
        assertEquals(3, ReaderLibraryRules.move(queue, "dos", -1).distinct().size)
    }

    private fun book(id: String, title: String, folder: String = "",
        lastReadAt: Long = 0L, finished: Boolean = false,
        audioMarks: List<ReaderAudioMark> = emptyList()) = ReaderBook(
            id = id, title = title, length = 100,
            folder = folder, lastReadAt = lastReadAt,
            finished = finished, audioMarks = audioMarks
        )

    @Test fun queueFilterFollowsDeclaredQueueOrderInsteadOfImportDate() {
        val books = listOf(book("uno", "A"), book("dos", "B"), book("tres", "C"))
        assertEquals(listOf("tres", "uno"),
            NativeReaderBookFilters.apply(books, filter = 12,
                queueIds = listOf("tres", "uno")).map { it.id })
    }

    @Test fun inProgressFinishedAndAudioBookmarksAreSeparateFilters() {
        val books = listOf(
            book("a", "Started", lastReadAt = 123),
            book("b", "Finished", lastReadAt = 456, finished = true),
            book("c", "Unopened", audioMarks = listOf(ReaderAudioMark(0, 1200)))
        )
        assertEquals(listOf("a"), NativeReaderBookFilters.apply(books, 13).map { it.id })
        assertEquals(listOf("b"), NativeReaderBookFilters.apply(books, 14).map { it.id })
        assertEquals(listOf("c"), NativeReaderBookFilters.apply(books, 6).map { it.id })
    }

    @Test fun existingFilterNumbersStillReferToTheirOriginalCategories() {
        assertEquals("Favoritos", NativeReaderBookFilters.formatFiltersEs[7])
        assertEquals("Imágenes con OCR", NativeReaderBookFilters.formatFiltersEs[11])
        assertEquals("Cola de lectura", NativeReaderBookFilters.formatFiltersEs[12])
    }
}
