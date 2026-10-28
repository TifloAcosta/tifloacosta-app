package com.tifloacosta.nativeprototype

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ReaderNavigationTest {
    @Test fun tenPercentIsRelativeToCurrentReadingProgress() {
        assertEquals(47, ReaderNavigation.percentageStep(37, 100, true))
        assertEquals(27, ReaderNavigation.percentageStep(37, 100, false))
        assertEquals(100, ReaderNavigation.percentageStep(96, 100, true))
        assertEquals(0, ReaderNavigation.percentageStep(3, 100, false))
    }

    @Test fun percentagesAreSafeForEmptyAndSmallDocuments() {
        assertEquals(0, ReaderNavigation.percentageStep(0, 0, true))
        assertEquals(1, ReaderNavigation.percentageStep(0, 2, true))
        assertEquals(1, ReaderNavigation.percentageStep(2, 2, false))
    }

    @Test fun navigationByWordDoesNotAllocateAllWordUnits() {
        val text = "Uno dos tres"
        assertEquals(4, ReaderNavigation.nextWordStart(text, 0))
        assertEquals(8, ReaderNavigation.nextWordStart(text, 4))
        assertEquals(8, ReaderNavigation.nextWordStart(text, 8))
        assertEquals(4, ReaderNavigation.previousWordStart(text, 8))
        assertEquals(0, ReaderNavigation.previousWordStart(text, 4))
        assertEquals("dos", ReaderNavigation.wordAt(text, 4))
    }

    @Test fun chapterNavigationOnlyRecognizesHeadings() {
        val text = "Prólogo\nAlgo de texto.\nCapítulo 1. Comienzo\nTexto\nCAPÍTULO II. Continúa\nFin"
        val headings = ReaderNavigation.chapterStarts(text)
        assertEquals(3, headings.size)
        assertEquals(0, headings.first())
        assertTrue(headings[1] < headings[2])
        assertTrue(ReaderNavigation.chapterStarts("Texto sin capítulos reconocibles.").isEmpty())
    }
}
