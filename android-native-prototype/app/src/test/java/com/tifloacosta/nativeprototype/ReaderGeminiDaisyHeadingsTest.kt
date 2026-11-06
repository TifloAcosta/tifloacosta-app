package com.tifloacosta.nativeprototype

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class ReaderGeminiDaisyHeadingsTest {
    @Test fun explicitHeadingsBecomeNavigableUnitsWithoutLosingText() {
        val source = "Prólogo.\n\n## Capítulo primero\nContenido.\n\nCapítulo 2: Otro tema\nFin.\n"
        val units = NativeGeminiDaisyExport.units(source)
        assertEquals(source, units.joinToString("") { it.text })
        assertEquals(listOf("## Capítulo primero", "Capítulo 2: Otro tema"),
            units.mapNotNull { it.heading })
        assertTrue(units.all { it.text.length <= NativeGeminiAudioExport.CHUNK_SIZE })
    }

    @Test fun ordinaryLinesAreNotInventedAsChapters() {
        val source = "Introducción\nSin numerar ni marcar\nEsta es una línea normal."
        val units = NativeGeminiDaisyExport.units(source)
        assertEquals(source, units.joinToString("") { it.text })
        assertTrue(units.none { it.heading != null })
    }

    @Test fun dtbookAndNCXIncludeHeadingLinks() {
        val file = File("src/main/java/com/tifloacosta/nativeprototype/NativeGeminiDaisyExport.kt")
            .readText()
        assertTrue(file.contains("<level2><h2 id="))
        assertTrue(file.contains("chapterPoints += it to par"))
        assertTrue(file.contains("CHAPTER_NAV"))
        assertTrue(file.contains("FIRST_PAR"))
    }
}
