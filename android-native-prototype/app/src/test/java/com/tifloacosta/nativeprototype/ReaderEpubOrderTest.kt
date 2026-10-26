package com.tifloacosta.nativeprototype

import org.junit.Assert.assertEquals
import org.junit.Test

class ReaderEpubOrderTest {
    @Test fun followsSpineInsteadOfAlphabeticalChapterNames() {
        val files = mapOf(
            "META-INF/container.xml" to """
                <container xmlns="urn:o"><rootfiles>
                  <rootfile full-path="OEBPS/content.opf"/>
                </rootfiles></container>
            """.trimIndent().toByteArray(),
            "OEBPS/content.opf" to """
                <package xmlns="urn:o"><manifest>
                  <item id="begin" href="z-first.xhtml"/>
                  <item id="end" href="a-second.xhtml"/>
                </manifest><spine>
                  <itemref idref="begin"/>
                  <itemref idref="end"/>
                </spine></package>
            """.trimIndent().toByteArray(),
            "OEBPS/a-second.xhtml" to "<p>Segundo</p>".toByteArray(),
            "OEBPS/z-first.xhtml" to "<p>Primero</p>".toByteArray()
        )
        assertEquals(listOf("OEBPS/z-first.xhtml", "OEBPS/a-second.xhtml"),
            NativeReaderEpub.orderedPages(files))
    }

    @Test fun usesSafeFallbackIfContainerIsInvalid() {
        val files = mapOf(
            "META-INF/container.xml" to "<broken!".toByteArray(),
            "b.xhtml" to "<p>B</p>".toByteArray(),
            "a.xhtml" to "<p>A</p>".toByteArray()
        )
        assertEquals(listOf("a.xhtml", "b.xhtml"), NativeReaderEpub.orderedPages(files))
    }
}
