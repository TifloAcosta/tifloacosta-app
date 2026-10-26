package com.tifloacosta.nativeprototype

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ReaderParityTest {
    private val now = 1_790_000_000_000L
    private val books = listOf(
        ReaderBook("a", "Braille y Android", 400, createdAt = now, format = "epub", favorite = true),
        ReaderBook("b", "Hoja de gastos", 300, createdAt = now - 5000, format = "xlsx", folder = "Trabajo"),
        ReaderBook("c", "Libro DAISY", 0, createdAt = now - 8000, marks = listOf(3000),
            format = "daisy", tracks = listOf("voice.mp3")),
        ReaderBook("d", "Guía PDF", 600, createdAt = now - 10000, format = "pdf")
    )

    @Test fun defaultFilterShowsEverything() {
        assertEquals(4, NativeReaderBookFilters.apply(books, now = now).size)
    }
    @Test fun groupsMatchIOS() {
        assertEquals(listOf("Braille y Android"),
            NativeReaderBookFilters.apply(books, 3, now = now).map { it.title })
        assertEquals(listOf("Hoja de gastos"),
            NativeReaderBookFilters.apply(books, 4, now = now).map { it.title })
        assertEquals(listOf("Libro DAISY"),
            NativeReaderBookFilters.apply(books, 5, now = now).map { it.title })
        assertEquals(listOf("Libro DAISY"),
            NativeReaderBookFilters.apply(books, 6, now = now).map { it.title })
        assertEquals(listOf("Braille y Android"),
            NativeReaderBookFilters.apply(books, 7, now = now).map { it.title })
    }
    @Test fun foldersAndSortAreIndependent() {
        assertEquals("Hoja de gastos",
            NativeReaderBookFilters.apply(books, folder = "Trabajo", now = now).single().title)
        assertEquals(3, NativeReaderBookFilters.apply(books, folder = "__none__", now = now).size)
        assertEquals("Braille y Android",
            NativeReaderBookFilters.apply(books, order = 2, now = now).first().title)
        assertEquals("Libro DAISY",
            NativeReaderBookFilters.apply(books, order = 3, now = now).first().title)
    }
    @Test fun acceptedExtensionsAreNotLegacyBinaryOffice() {
        for (ext in listOf("epub", "pdf", "docx", "pptx", "xlsx", "zip", "daisy",
            "mp3", "m4a", "m4b", "txt")) {
            assertTrue(ext, ext in NativeReaderFormats.supported)
        }
        assertFalse("ppt" in NativeReaderFormats.supported)
        assertFalse("pps" in NativeReaderFormats.supported)
        assertFalse("xls" in NativeReaderFormats.supported)
    }
    @Test fun opdsEnforcesHttps() {
        assertEquals("https://example.org/book.epub",
            NativeReaderOPDS.secure("/book.epub", "https://example.org/opds/"))
        try {
            NativeReaderOPDS.secure("http://example.org/a")
            throw AssertionError("Unsecured URL accepted")
        } catch (_: java.io.IOException) {
            // Expected.
        }
    }
}
