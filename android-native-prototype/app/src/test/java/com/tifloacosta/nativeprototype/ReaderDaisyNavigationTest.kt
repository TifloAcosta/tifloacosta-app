package com.tifloacosta.nativeprototype

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.nio.file.Files

class ReaderDaisyNavigationTest {
    @Test fun nccHeadingsPagesNotesAndSynchronizedTextReachActualSmilClips() {
        val directory = Files.createTempDirectory("tiflo-daisy-nav-").toFile()
        try {
            var i = 0
            fun add(text: String): File = File(directory, "item" + i++).also { it.writeText(text) }
            val files = linkedMapOf<String, File>(
                "book/ncc.html" to add("""
                    <html><body>
                      <h1><a href="one.smil#first">Introducción</a></h1>
                      <span class="page-normal"><a href="one.smil#second">12</a></span>
                      <h2><a href="two.smil#last">Detalles</a></h2>
                      <div class="footnote"><a href="two.smil#last">Nota al pie</a></div>
                    </body></html>""".trimIndent()),
                "book/one.smil" to add("""
                    <!DOCTYPE smil PUBLIC "-//W3C//DTD SMIL 1.0//EN" "http://www.w3.org/TR/REC-smil/SMIL10.dtd">
                    <smil><body><seq>
                      <par id="first"><text src="text.html#s1" id="t1"/>
                        <audio src="a.mp3" clipBegin="npt=0s" clipEnd="npt=4s"/></par>
                      <par id="second"><text src="text.html#s2"/>
                        <audio src="a.mp3" clipBegin="npt=4s" clipEnd="npt=8s"/></par>
                    </seq></body></smil>""".trimIndent()),
                "book/two.smil" to add("""
                    <smil><body><seq><par id="last">
                      <audio src="b.mp3" clipBegin="npt=2s" clipEnd="npt=5s"/>
                    </par></seq></body></smil>""".trimIndent()),
                "book/text.html" to add("""
                    <html><body><p id="s1">Un párrafo en voz alta.</p>
                    <p id="s2">Segundo fragmento sincronizado.</p></body></html>""".trimIndent()),
                "book/a.mp3" to add("dummy audio bytes"),
                "book/b.mp3" to add("dummy audio bytes")
            )
            val plan = NativeReaderDaisy.plan(files)
            assertTrue(plan.daisy)
            assertEquals(3, plan.segments.size)
            assertEquals("Un párrafo en voz alta.", plan.segments[0].synchronizedText)
            assertEquals("Segundo fragmento sincronizado.", plan.segments[1].synchronizedText)
            assertEquals("", plan.segments[2].synchronizedText)
            assertEquals(2, NativeDaisyNavigation.filter(plan.navigation, "heading").size)
            assertEquals(1, NativeDaisyNavigation.filter(plan.navigation, "heading", 2).size)
            assertEquals(1, NativeDaisyNavigation.filter(plan.navigation, "page").size)
            assertEquals("12", NativeDaisyNavigation.filter(plan.navigation, "page")[0].label)
            assertEquals(1, NativeDaisyNavigation.filter(plan.navigation, "page")[0].segmentIndex)
            assertEquals(2, NativeDaisyNavigation.filter(plan.navigation, "note")[0].segmentIndex)
            assertEquals(2, NativeDaisyNavigation.adjacent(
                NativeDaisyNavigation.filter(plan.navigation, "heading"), 0, true
            )?.segmentIndex)
        } finally {
            NativeReaderDaisyText.clear()
            directory.deleteRecursively()
        }
    }

    @Test fun ncxNavMapAndPageListResolveThroughSmilWithoutInventingPoints() {
        val directory = Files.createTempDirectory("tiflo-daisy-ncx-").toFile()
        try {
            var i = 0
            fun put(text: String) = File(directory, "entry" + i++).also { it.writeText(text) }
            val files = linkedMapOf(
                "book/book.ncx" to put("""
                    <?xml version="1.0"?>
                    <ncx xmlns="http://www.daisy.org/z3986/2005/ncx/">
                      <navMap><navPoint id="top">
                        <navLabel><text>Parte I</text></navLabel>
                        <content src="one.smil#a"/>
                        <navPoint id="section"><navLabel><text>Capítulo A</text></navLabel>
                        <content src="one.smil#b"/></navPoint>
                      </navPoint></navMap>
                      <pageList><pageTarget><navLabel><text>37</text></navLabel>
                        <content src="one.smil#b"/></pageTarget></pageList>
                    </ncx>""".trimIndent()),
                "book/one.smil" to put("""
                    <smil><body><seq>
                    <par id="a"><audio src="one.mp3" clipBegin="0s" clipEnd="2s"/></par>
                    <par id="b"><audio src="one.mp3" clipBegin="2s" clipEnd="5s"/></par>
                    </seq></body></smil>""".trimIndent()),
                "book/one.mp3" to put("dummy audio")
            )
            val plan = NativeReaderDaisy.plan(files)
            assertEquals(listOf(1, 2), NativeDaisyNavigation.filter(
                plan.navigation, "heading").map { it.level })
            assertEquals(listOf("Parte I", "Capítulo A"),
                NativeDaisyNavigation.filter(plan.navigation, "heading").map { it.label })
            assertEquals(1, NativeDaisyNavigation.filter(plan.navigation, "page")[0].segmentIndex)
            assertTrue(NativeDaisyNavigation.filter(plan.navigation, "note").isEmpty())
        } finally { directory.deleteRecursively(); NativeReaderDaisyText.clear() }
    }

    @Test fun headingFilteringIsExactAndNearbyNavigationIsMonotonic() {
        val points = listOf(
            ReaderDaisyNavPoint("heading", 1, "Inicio", 0),
            ReaderDaisyNavPoint("heading", 2, "Sección", 3),
            ReaderDaisyNavPoint("page", 0, "7", 4),
            ReaderDaisyNavPoint("heading", 1, "Otro capítulo", 9)
        )
        assertEquals(2, NativeDaisyNavigation.filter(points, "heading", 1).size)
        assertEquals(1, NativeDaisyNavigation.filter(points, "heading", 2).size)
        assertEquals(9, NativeDaisyNavigation.adjacent(
            NativeDaisyNavigation.filter(points, "heading", 1), 3, true)?.segmentIndex)
        assertEquals(0, NativeDaisyNavigation.adjacent(
            NativeDaisyNavigation.filter(points, "heading", 1), 3, false)?.segmentIndex)
    }
}
