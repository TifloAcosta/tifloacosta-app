package com.tifloacosta.nativeprototype

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ReaderPronunciationTest {
    @Test fun changesSpokenTextButNotSource() {
        val source = "JAWS ayuda. JAWS, sin tocar el texto del libro."
        val result = NativePronunciation.apply(source, listOf(PronunciationRule("JAWS","yos")))
        assertEquals("yos ayuda. yos, sin tocar el texto del libro.", result)
        assertEquals("JAWS ayuda. JAWS, sin tocar el texto del libro.", source)
    }

    @Test fun doesNotReplaceInsideOtherWordsAndPreservesAccents() {
        val rules = listOf(PronunciationRule("voz", "vos"), PronunciationRule("año","anio"))
        assertEquals("vos, portavoz, anio; cañón",
            NativePronunciation.apply("voz, portavoz, año; cañón", rules))
    }

    @Test fun replacesInOnePassWithoutRecursing() {
        val rules = listOf(PronunciationRule("uno", "dos"), PronunciationRule("dos", "tres"))
        assertEquals("dos tres", NativePronunciation.apply("uno dos", rules))
    }

    @Test fun rejectsEmptyAndDuplicateRules() {
        val rules = NativePronunciation.normalize(listOf(
            PronunciationRule("  ", "otro"), PronunciationRule("Apple", "ápel"),
            PronunciationRule("APPLE", "manzana"), PronunciationRule("NVDA", "ene uve de a")
        ))
        assertEquals(2, rules.size)
        assertTrue(rules.any { it.original == "Apple" && it.spoken == "ápel" })
    }
}
