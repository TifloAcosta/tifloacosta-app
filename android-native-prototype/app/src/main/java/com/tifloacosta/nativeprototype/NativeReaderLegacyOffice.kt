package com.tifloacosta.nativeprototype

import org.apache.poi.hssf.extractor.ExcelExtractor
import org.apache.poi.hssf.usermodel.HSSFWorkbook
import org.apache.poi.sl.extractor.SlideShowExtractor
import org.apache.poi.hslf.usermodel.HSLFSlideShow
import org.apache.poi.hwpf.extractor.WordExtractor
import java.io.ByteArrayInputStream
import java.io.IOException
import java.util.Locale

/** Read-only Office 97-2003, including .pps slideshow. Macros are never executed. */
object NativeReaderLegacyOffice {
    private val magic = byteArrayOf(
        0xD0.toByte(), 0xCF.toByte(), 0x11, 0xE0.toByte(),
        0xA1.toByte(), 0xB1.toByte(), 0x1A, 0xE1.toByte()
    )
    private const val MAX_BYTES = 40 * 1024 * 1024
    private const val MAX_TEXT = 6 * 1024 * 1024

    fun hasOle2Header(data: ByteArray): Boolean = data.size >= magic.size &&
        magic.indices.all { data[it] == magic[it] }

    fun extract(extension: String, data: ByteArray): String {
        val ext = extension.lowercase(Locale.ROOT)
        if (ext !in setOf("doc", "xls", "ppt", "pps"))
            throw IOException("El conversor no reconoce este formato de Office.")
        if (data.size > MAX_BYTES) throw IOException(
            "El documento Office antiguo supera el límite de 40 MB."
        )
        if (!hasOle2Header(data)) throw IOException(
            "El archivo no tiene una cabecera Office 97-2003 válida."
        )
        val readable = try {
            when (ext) {
                "doc" -> WordExtractor(ByteArrayInputStream(data)).use { extractor ->
                    extractor.text
                }
                "xls" -> HSSFWorkbook(ByteArrayInputStream(data)).use { workbook ->
                    ExcelExtractor(workbook).use { extractor ->
                        extractor.setIncludeSheetNames(true)
                        extractor.setFormulasNotResults(false)
                        extractor.text
                    }
                }
                else -> HSLFSlideShow(ByteArrayInputStream(data)).use { slides ->
                    SlideShowExtractor(slides).text
                }
            }
        } catch (e: Exception) {
            throw IOException(
                "No se pudo leer este archivo Office antiguo. Puede estar protegido, dañado o utilizar funciones no compatibles.",
                e
            )
        }
        val cleaned = readable.replace("\r\n", "\n")
            .replace("\r", "\n").replace(Regex("\\n{4,}"), "\n\n").trim()
        if (cleaned.isBlank()) throw IOException(
            "No se encontró texto legible. Si solo contiene imágenes, hará falta OCR."
        )
        return cleaned.take(MAX_TEXT)
    }
}
