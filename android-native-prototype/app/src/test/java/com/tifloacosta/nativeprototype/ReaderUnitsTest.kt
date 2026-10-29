package com.tifloacosta.nativeprototype

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ReaderUnitsTest {
    @Test fun positionsSurviveChangingReadingUnits() {
        val text = "Primera frase. Segunda frase.\nPárrafo dos.\nPárrafo tres."
        val blocks = ReaderUnits.split(text, 0)
        val paragraphs = ReaderUnits.split(text, 1)
        val sentences = ReaderUnits.split(text, 2)
        assertEquals(1, blocks.size)
        assertEquals(3, paragraphs.size)
        assertEquals(4, sentences.size)
        val saved = text.indexOf("Segunda")
        assertTrue(paragraphs[ReaderUnits.indexForOffset(paragraphs, saved)].text.contains("Primera"))
        assertTrue(sentences[ReaderUnits.indexForOffset(sentences, saved)].text.contains("Segunda"))
    }

    @Test fun longTextIsSplitBeforeSpeechLimit() {
        val text = "palabra ".repeat(700)
        for (mode in 0..2) {
            val units = ReaderUnits.split(text, mode)
            assertTrue(units.isNotEmpty())
            assertTrue(units.all { it.text.length <= 1500 && it.text.isNotBlank() })
            assertTrue(units.zipWithNext().all { (a, b) -> a.end <= b.start })
        }
    }

    @Test fun progressAndEmptyDocumentAreSafe() {
        assertEquals(0, ReaderUnits.percent(10, 0))
        assertEquals(0, ReaderUnits.percent(-5, 100))
        assertEquals(100, ReaderUnits.percent(200, 100))
        assertEquals(25, ReaderUnits.percent(25, 100))
        assertEquals(0, ReaderUnits.indexForOffset(emptyList(), 500))
        assertTrue(ReaderUnits.split("   \n   ", 1).isEmpty())
    }

    @Test fun startOffsetSelectsLastAvailableUnit() {
        val list = ReaderUnits.split("Una frase. Dos frases. Tres.", 2)
        assertEquals(list.lastIndex, ReaderUnits.indexForOffset(list, 99999))
    }

    @Test fun allModesKeepSpanishText() {
        val text = "¿Qué tal? ¡Muy bien! Un párrafo.\n\nOtro párrafo."
        for (mode in 0..2) {
            val list = ReaderUnits.split(text, mode)
            assertTrue(list.isNotEmpty())
            assertTrue(list.any { it.text.contains("párrafo") })
            assertTrue(list.all { it.start >= 0 && it.end <= text.length })
        }
    }
    @Test fun speechSkipsOnlyIsolatedTechnicalPageMarkers() {
        val body = "Primera frase.\\ntext/chapter01.xhtml\\nPágina 12\\nSegunda frase.\\nEn este curso aprendemos HTML."
        for (mode in 0..2) {
            val units = ReaderUnits.split(body, mode)
            assertTrue(units.any { it.text.contains("Primera frase") })
            assertTrue(units.any { it.text.contains("Segunda frase") })
            assertTrue(units.any { it.text.contains("aprendemos HTML") })
            assertTrue(units.none { it.text.contains("chapter01.xhtml") })
            assertTrue(units.none { it.text.contains("Página 12") })
            assertTrue(units.all { it.end <= body.length })
        }
        assertTrue(!ReaderSpeechMarkers.isTechnicalLine("Capítulo 12"))
        assertTrue(!ReaderSpeechMarkers.isTechnicalLine("12"))
        assertTrue(!ReaderSpeechMarkers.isTechnicalLine("Aprendemos HTML en español"))
        assertTrue(ReaderSpeechMarkers.isTechnicalLine("Page 4"))
        assertTrue(ReaderSpeechMarkers.isTechnicalLine("HTML, página 9"))
    }

}
