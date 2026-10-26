package com.tifloacosta.nativeprototype

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ReaderExpandedFormatsTest {
    @Test fun ocrImagesAndOpenDocumentFormatsAreSelectable() {
        val formats = setOf(
            "jpg", "jpeg", "png", "webp", "bmp", "heic", "heif",
            "odt", "ods", "odp", "ppsx", "flac", "opus", "rtf"
        )
        assertTrue(NativeReaderFormats.supported.containsAll(formats))
        assertFalse(NativeReaderFormats.supported.contains("rar"))
        assertFalse(NativeReaderFormats.supported.contains("azw3"))
    }

    @Test fun imageResizeIsBoundedWithNoUpscaling() {
        assertEquals(800 to 600, NativeReaderOcr.scaledDimensions(800, 600))
        val large = NativeReaderOcr.scaledDimensions(12000, 8000)
        assertTrue(large.first <= 2000)
        assertTrue(large.second <= 2000)
        assertTrue(large.first.toLong() * large.second <= 3_200_000L)
    }

    @Test fun rtfParsesParagraphsAndWordEscapes() {
        val text = "{\\rtf1\\ansi Hola\\par mundo\\tab espa\\'f1ol}"
        val parsed = NativeReaderRtf.extract(text)
        assertTrue(parsed.contains("Hola"))
        assertTrue(parsed.contains("mundo"))
        assertTrue(parsed.contains("español"))
        assertFalse(parsed.contains("\\par"))
    }

    @Test fun odtExtractsVisibleParagraphs() {
        val document = """
            <?xml version="1.0" encoding="UTF-8"?>
            <office:document-content xmlns:office="urn:o" xmlns:text="urn:t">
              <office:body><office:text>
                <text:p>Hola desde Android</text:p>
                <text:p>Segundo párrafo</text:p>
              </office:text></office:body>
            </office:document-content>
        """.trimIndent().toByteArray()
        val parsed = NativeReaderOpenDocument.extract("odt", mapOf("content.xml" to document))
        assertTrue(parsed.contains("Hola desde Android"))
        assertTrue(parsed.contains("Segundo párrafo"))
    }

    @Test fun odsExtractsSheetRows() {
        val document = """
            <?xml version="1.0" encoding="UTF-8"?>
            <office:document-content xmlns:office="urn:o" xmlns:text="urn:t"
                xmlns:table="urn:ta"><office:body><office:spreadsheet>
              <table:table table:name="Gastos"><table:table-row>
                <table:table-cell><text:p>Concepto</text:p></table:table-cell>
                <table:table-cell><text:p>Precio</text:p></table:table-cell>
              </table:table-row></table:table>
              </office:spreadsheet></office:body></office:document-content>
        """.trimIndent().toByteArray()
        val parsed = NativeReaderOpenDocument.extract("ods", mapOf("content.xml" to document))
        assertTrue(parsed.contains("Gastos"))
        assertTrue(parsed.contains("Concepto"))
        assertTrue(parsed.contains("Precio"))
    }

    @Test fun rejectsExternalEntitiesInOdf() {
        val exploit = """
            <?xml version="1.0"?>
            <!DOCTYPE content [ <!ENTITY attack SYSTEM "file:///etc/passwd"> ]>
            <office:document-content><text:p>&attack;</text:p></office:document-content>
        """.trimIndent().toByteArray()
        try {
            NativeReaderOpenDocument.extract("odt", mapOf("content.xml" to exploit))
            throw AssertionError("External entities unexpectedly permitted")
        } catch (_: java.io.IOException) { }
    }
}
