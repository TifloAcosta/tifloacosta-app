package com.tifloacosta.nativeprototype

import org.apache.poi.hssf.usermodel.HSSFWorkbook
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.ByteArrayOutputStream
import java.io.IOException

/** Reproducible legacy fixtures, no network dependency or bundled copyrighted books. */
class ReaderLegacyFormatsTest {
    @Test fun excel97WorkbookContainsReadableSheetAndCells() {
        val bytes = HSSFWorkbook().use { workbook ->
            val sheet = workbook.createSheet("Resumen")
            sheet.createRow(0).apply {
                createCell(0).setCellValue("Concepto")
                createCell(1).setCellValue("Importe")
            }
            sheet.createRow(1).apply {
                createCell(0).setCellValue("Libro")
                createCell(1).setCellValue(12.0)
            }
            ByteArrayOutputStream().also { workbook.write(it) }.toByteArray()
        }
        assertTrue(NativeReaderLegacyOffice.hasOle2Header(bytes))
        val text = NativeReaderLegacyOffice.extract("xls", bytes)
        assertTrue(text.contains("Resumen"))
        assertTrue(text.contains("Concepto"))
        assertTrue(text.contains("Importe"))
        assertTrue(text.contains("Libro"))
    }

    @Test fun rejectsFakeOrEncryptedLookingBinaryInsteadOfReadingGarbage() {
        for (ext in listOf("doc", "ppt", "pps", "xls")) {
            try {
                NativeReaderLegacyOffice.extract(ext, "this is not office".toByteArray())
                throw AssertionError("Invalid legacy document accepted for $ext")
            } catch (_: IOException) {}
        }
        assertFalse(NativeReaderLegacyOffice.hasOle2Header("x".toByteArray()))
    }

    /** Creates a minimal valid PalmDB / Mobipocket container with one content record. */
    private fun palmBook(
        content: ByteArray,
        compression: Int = 1,
        encrypted: Int = 0,
        encoding: Int = 65001,
        mobi: Boolean = true
    ): ByteArray {
        val headerSize = 78 + 2 * 8
        val metadataSize = if (mobi) 64 else 16
        val offsetText = headerSize + metadataSize
        val data = ByteArray(offsetText + content.size)
        fun u16(at: Int, value: Int) {
            data[at] = (value ushr 8).toByte()
            data[at + 1] = value.toByte()
        }
        fun u32(at: Int, value: Int) {
            for (i in 0..3) data[at + i] = (value ushr (24 - i * 8)).toByte()
        }
        val id = if (mobi) "BOOKMOBI" else "TEXtREAd"
        id.toByteArray().copyInto(data, 60)
        u16(76, 2)
        u32(78, headerSize)
        u32(86, offsetText)
        u16(headerSize, compression)
        u32(headerSize + 4, if (compression == 2) 100 else content.size)
        u16(headerSize + 8, 1)
        u16(headerSize + 12, encrypted)
        if (mobi) {
            "MOBI".toByteArray().copyInto(data, headerSize + 16)
            u32(headerSize + 20, 48)
            u32(headerSize + 28, encoding)
            u32(headerSize + 36, 6)
        }
        content.copyInto(data, offsetText)
        return data
    }

    @Test fun unencryptedMobiPlainTextIsExtracted() {
        val content = "<html><body><p>Primer capítulo</p></body></html>".toByteArray()
        val file = palmBook(content)
        val decoded = NativeReaderMobipocket.extract("mobi", file)
        assertTrue(decoded.contains("Primer capítulo"))
        assertFalse(decoded.contains("<html"))
    }

    @Test fun palmDocBackReferenceExpandsAndPreservesSpacing() {
        // Literal "ABC" followed by back-reference distance=3, length=3.
        val compressed = byteArrayOf(3, 'A'.code.toByte(), 'B'.code.toByte(),
            'C'.code.toByte(), 0x80.toByte(), 0x18.toByte())
        assertEquals("ABCABC", NativeReaderMobipocket.decompressPalmDoc(compressed).toString(Charsets.UTF_8))
        // 0xE1 => ASCII space + 'a'
        assertEquals(" a", NativeReaderMobipocket.decompressPalmDoc(
            byteArrayOf(0xE1.toByte())).toString(Charsets.UTF_8))
    }

    @Test fun drmFilesAndUnsupportedHuffmanAreExplicitlyRejected() {
        try {
            NativeReaderMobipocket.extract("azw3", palmBook("Hola".toByteArray(), encrypted = 2))
            throw AssertionError("DRM book accepted")
        } catch (e: IOException) { assertTrue(e.message.orEmpty().contains("DRM")) }
        try {
            NativeReaderMobipocket.extract("mobi", palmBook("Hola".toByteArray(),
                compression = 17480))
            throw AssertionError("HUFF/CDIC book accepted")
        } catch (e: IOException) { assertTrue(e.message.orEmpty().contains("HUFF")) }
    }

    @Test fun newExtensionsAreActuallySelectable() {
        assertTrue(NativeReaderFormats.supported.containsAll(
            setOf("doc", "xls", "ppt", "pps", "mobi", "prc", "pdb", "azw", "azw3")))
    }
}
