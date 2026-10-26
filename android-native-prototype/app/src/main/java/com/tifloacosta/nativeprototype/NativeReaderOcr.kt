package com.tifloacosta.nativeprototype

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.pdf.PdfRenderer
import android.os.ParcelFileDescriptor
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import com.tom_roush.pdfbox.android.PDFBoxResourceLoader
import com.tom_roush.pdfbox.pdmodel.PDDocument
import com.tom_roush.pdfbox.text.PDFTextStripper
import java.io.ByteArrayInputStream
import java.io.File
import java.io.IOException
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/** Offline, bundled Latin-script OCR. No document content is sent to our server. */
object NativeReaderOcr {
    const val MAX_OCR_PAGES = 250
    private const val MAX_SIDE = 2000
    private const val MAX_PIXELS = 3_200_000
    private const val MAX_OUTPUT_CHARS = 6 * 1024 * 1024

    fun scaledDimensions(width: Int, height: Int): Pair<Int, Int> {
        require(width > 0 && height > 0)
        val ratio = min(1.0, min(
            MAX_SIDE.toDouble() / max(width, height),
            kotlin.math.sqrt(MAX_PIXELS.toDouble() / (width.toLong() * height.toLong()))
        ))
        return max(1, (width * ratio).roundToInt()) to
            max(1, (height * ratio).roundToInt())
    }

    fun recognizeImage(bytes: ByteArray): String {
        val boundaries = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeByteArray(bytes, 0, bytes.size, boundaries)
        if (boundaries.outWidth <= 0 || boundaries.outHeight <= 0) {
            throw IOException("No se pudo interpretar esta imagen.")
        }
        val target = scaledDimensions(boundaries.outWidth, boundaries.outHeight)
        var factor = 1
        while (boundaries.outWidth / factor > target.first * 2 ||
            boundaries.outHeight / factor > target.second * 2) factor *= 2
        val opts = BitmapFactory.Options().apply {
            inSampleSize = factor
            inPreferredConfig = Bitmap.Config.ARGB_8888
        }
        val decoded = try {
            BitmapFactory.decodeByteArray(bytes, 0, bytes.size, opts)
        } catch (_: OutOfMemoryError) { null }
            ?: throw IOException("No hay memoria suficiente para reconocer esta imagen.")
        val oriented = applyExifOrientation(decoded, bytes)
        if (oriented !== decoded) decoded.recycle()
        val (w, h) = scaledDimensions(oriented.width, oriented.height)
        val bitmap = if (w != oriented.width || h != oriented.height) {
            try { Bitmap.createScaledBitmap(oriented, w, h, true) }
            catch (_: OutOfMemoryError) { oriented }
        } else oriented
        try { return ocrBitmap(bitmap) }
        finally {
            if (bitmap !== oriented) bitmap.recycle()
            oriented.recycle()
        }
    }

    private fun applyExifOrientation(bitmap: Bitmap, bytes: ByteArray): Bitmap {
        val orientation = try {
            android.media.ExifInterface(ByteArrayInputStream(bytes))
                .getAttributeInt(android.media.ExifInterface.TAG_ORIENTATION,
                    android.media.ExifInterface.ORIENTATION_NORMAL)
        } catch (_: Exception) { android.media.ExifInterface.ORIENTATION_NORMAL }
        val rotate = when (orientation) {
            android.media.ExifInterface.ORIENTATION_ROTATE_90 -> 90f
            android.media.ExifInterface.ORIENTATION_ROTATE_180 -> 180f
            android.media.ExifInterface.ORIENTATION_ROTATE_270 -> 270f
            else -> 0f
        }
        if (rotate == 0f) return bitmap
        return try {
            val matrix = android.graphics.Matrix().apply { postRotate(rotate) }
            Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
        } catch (_: OutOfMemoryError) { bitmap }
    }

    private fun ocrBitmap(bitmap: Bitmap): String {
        val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
        try {
            return Tasks.await(recognizer.process(InputImage.fromBitmap(bitmap, 0)))
                .text.trim()
        } catch (e: Exception) {
            throw IOException("No se pudo reconocer el texto de la imagen.", e)
        } finally { recognizer.close() }
    }

    /**
     * Preserve readable PDF text, and OCR pages without a selectable text layer.
     * Render only one page at a time; close bitmap/page before proceeding.
     */
    fun recognizePdf(context: Context, bytes: ByteArray,
                     progress: ((Int, Int) -> Unit)? = null): String {
        if (bytes.size > 40 * 1024 * 1024) {
            throw IOException("El PDF supera los 40 MB admitidos en esta prueba.")
        }
        PDFBoxResourceLoader.init(context.applicationContext)
        val temp = File.createTempFile("tiflolector-ocr-", ".pdf", context.cacheDir)
        try {
            temp.writeBytes(bytes)
            val printable = StringBuilder()
            PDDocument.load(temp).use { document ->
                if (document.isEncrypted) throw IOException("El PDF tiene contraseña.")
                if (document.numberOfPages > MAX_OCR_PAGES) {
                    throw IOException(
                        "Este PDF contiene más de $MAX_OCR_PAGES páginas. " +
                            "Hay que incorporar OCR por lotes antes de importarlo completo."
                    )
                }
                val stripper = PDFTextStripper().apply { sortByPosition = true }
                ParcelFileDescriptor.open(temp, ParcelFileDescriptor.MODE_READ_ONLY).use { descriptor ->
                    PdfRenderer(descriptor).use { renderer ->
                        if (renderer.pageCount != document.numberOfPages) {
                            throw IOException("No coinciden las páginas del PDF.")
                        }
                        for (pageNumber in 1..document.numberOfPages) {
                            if (Thread.currentThread().isInterrupted) {
                                throw IOException("Se ha interrumpido el reconocimiento.")
                            }
                            stripper.startPage = pageNumber
                            stripper.endPage = pageNumber
                            var text = stripper.getText(document).trim()
                            // Also recognize hybrid PDFs where the scanned body
                            // is an image but a short selectable footer/header exists.
                            if (text.count { it.isLetterOrDigit() } < 40) {
                                val recognized = try {
                                    renderer.openPage(pageNumber - 1).use { page ->
                                        val (w, h) = scaledDimensions(page.width * 2, page.height * 2)
                                        val bitmap = try {
                                            Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
                                        } catch (_: OutOfMemoryError) {
                                            throw IOException("No hay memoria suficiente para leer la página $pageNumber.")
                                        }
                                        try {
                                            bitmap.eraseColor(android.graphics.Color.WHITE)
                                            page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
                                            ocrBitmap(bitmap)
                                        } finally { bitmap.recycle() }
                                    }
                                } catch (e: Exception) {
                                    if (text.isBlank()) throw e
                                    "" // Preserve selectable text if optional OCR fails.
                                }
                                if (recognized.length > text.length) text = recognized
                            }
                            if (text.isNotBlank()) {
                                printable.append("Página ").append(pageNumber).append('\n')
                                    .append(text).append("\n\n")
                            }
                            progress?.invoke(pageNumber, document.numberOfPages)
                            if (printable.length > MAX_OUTPUT_CHARS) {
                                throw IOException("El texto reconocido supera el tamaño permitido.")
                            }
                        }
                    }
                }
            }
            if (printable.isBlank()) {
                throw IOException("No se ha reconocido texto legible en este PDF.")
            }
            return printable.toString().trim()
        } catch (e: IOException) { throw e }
        catch (e: Exception) {
            throw IOException("No se pudo leer o reconocer el PDF.", e)
        } finally { temp.delete() }
    }
}
