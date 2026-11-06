package com.tifloacosta.nativeprototype

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class ReaderPhaseTwoNavigationTest {
    @Test fun nextAndPreviousBookmarksUseStrictBoundaries() {
        val marks = listOf(320, 80, 80, 500)
        assertEquals(320, ReaderNavigation.adjacentMark(marks, 80, true))
        assertEquals(80, ReaderNavigation.adjacentMark(marks, 320, false))
        assertNull(ReaderNavigation.adjacentMark(marks, 500, true))
        assertNull(ReaderNavigation.adjacentMark(marks, 80, false))
    }

    @Test fun minuteStepUsesSpeechRateAndWordBoundaries() {
        val text = (1..900).joinToString(" ") { "palabra$it" }
        val normal = ReaderNavigation.estimatedMinuteStep(text, 0, true, 1f)
        val faster = ReaderNavigation.estimatedMinuteStep(text, 0, true, 1.5f)
        assertEquals(text.indexOf("palabra181"), normal)
        assertEquals(text.indexOf("palabra271"), faster)
        assertEquals(0, ReaderNavigation.estimatedMinuteStep(text, normal, false, 1f))
    }

    @Test fun minuteStepStaysInsideTextBounds() {
        assertEquals(0, ReaderNavigation.estimatedMinuteStep("", 0, true, 1f))
        assertEquals(0, ReaderNavigation.estimatedMinuteStep("one two", 0, false, 1f))
        assertEquals("one two".length,
            ReaderNavigation.estimatedMinuteStep("one two", 0, true, 1f))
    }
}
