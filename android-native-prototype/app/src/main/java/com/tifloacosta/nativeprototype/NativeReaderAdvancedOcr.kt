package com.tifloacosta.nativeprototype

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.pdf.PdfRenderer
import android.os.ParcelFileDescriptor
import com.tom_roush.pdfbox.android.PDFBoxResourceLoader
import com.tom_roush.pdfbox.io.MemoryUsageSetting
import com.tom_roush.pdfbox.pdmodel.PDDocument
import com.tom_roush.pdfbox.text.PDFTextStripper
import java.io.File
import java.io.IOException
import java.util.Locale
import java.util.zip.ZipFile

/** One checkpoint per finished page/image. Crash-safe and resumable by design. */
object NativeReaderAdvancedOcr {
    const val MAX_PDF_BYTES = 400L * 1024 * 1024
    const val MAX_PAGES = 4000
    const val MAX_IMAGE_ITEMS = 600
    const val MAX_TEXT_CHARS = 12 * 1024 * 1024
    private const val MAX_SINGLE_IMAGE = 12 * 1024 * 1024
    private const val MAX_IMAGE_TOTAL = 150L * 1024 * 1024

    data class Progress(val finished: Int, val total: Int) {
        val complete: Boolean get() = total > 0 && finished >= total
    }

    fun sourceSupportsEmbeddedImages(ext: String): Boolean =
        ext.lowercase(Locale.ROOT) in setOf("docx", "pptx", "ppsx", "xlsx",
            "epub", "odt", "ods", "odp")

    fun checkpointRoot(context: Context, book: ReaderBook, kind: String): File {
        require(book.id.matches(Regex("[a-f0-9-]{36}")))
        require(kind == "pdf" || kind == "images")
        return File(File(context.filesDir, "tiflolector-native"), book.id + ".ocr-" + kind)
    }

    /** Fraction remains known after process death, even if no UI is running. */
    fun progress(context: Context, book: ReaderBook, kind: String): Progress {
        val root = checkpointRoot(context, book, kind)
        val total = File(root, "total.txt").takeIf { it.isFile }
            ?.readText()?.trim()?.toIntOrNull()?.coerceIn(0, MAX_PAGES) ?: 0
        val done = (1..total).count { File(root, "page-" + it.toString().padStart(5, '0') + ".txt").isFile }
        return Progress(done, total)
    }

    fun imagePathAccepted(path: String, kind: String): Boolean {
        val normalized = path.replace('\\', '/').lowercase(Locale.ROOT)
        if (normalized.startsWith("/") || normalized.split('/').contains("..")) return false
        if (normalized.contains("cover") || normalized.contains("thumbnail")) return false
        if (!normalized.substringAfterLast('.').let { it in setOf("jpg", "jpeg", "png", "webp", "bmp") })
            return false
        return when (kind) {
            "docx" -> normalized.startsWith("word/media/")
            "pptx", "ppsx" -> normalized.startsWith("ppt/media/")
            "xlsx" -> normalized.startsWith("xl/media/")
            "odt", "ods", "odp" -> normalized.startsWith("pictures/")
            "epub" -> true
            else -> false
        }
    }

    fun isCheckpointComplete(root: File, index: Int): Boolean =
        File(root, "page-" + index.toString().padStart(5, '0') + ".txt").isFile

    private fun checkpoint(root: File, index: Int, text: String) {
        if (!root.isDirectory && !root.mkdirs()) throw IOException("No se pudo guardar el avance OCR.")
        val target = File(root, "page-" + index.toString().padStart(5, '0') + ".txt")
        val pending = File(root, target.name + ".tmp")
        pending.writeText(text.take(60000), Charsets.UTF_8)
        if (!pending.renameTo(target)) {
            pending.copyTo(target, overwrite = true)
            pending.delete()
        }
    }

    fun checkpointOrder(root: File, total: Int): List<Int> =
        (1..total).filter { isCheckpointComplete(root, it) }

    private fun assemble(root: File, total: Int): String {
        val text = StringBuilder()
        for (page in 1..total) {
            val file = File(root, "page-" + page.toString().padStart(5, '0') + ".txt")
            if (!file.isFile) continue
            val content = file.readText(Charsets.UTF_8).trim()
            if (content.isNotEmpty()) {
                val size = content.length + 30
                if (text.length.toLong() + size > MAX_TEXT_CHARS)
                    throw IOException("Se alcanzó el límite de texto OCR (12 MB).")
                text.append(if (root.name.endsWith("ocr-pdf")) "Página " else "Imagen ")
                    .append(page).append('\n').append(content).append("\n\n")
            }
        }
        return text.toString().trim()
    }

    private fun check(continueWork: () -> Boolean) {
        if (!continueWork()) throw InterruptedException("OCR pausado por el usuario.")
    }

    /**
     * Streams one page at a time; checkpoints survive cancellation, navigation
     * and activity/process recreation. Original PDF is never rewritten.
     */
    fun pdf(context: Context, book: ReaderBook, store: NativeReaderStore,
        continueWork: () -> Boolean, onProgress: (Progress) -> Unit): Progress {
        val original = store.originalFile(book)?.takeIf { it.extension.equals("pdf", true) }
            ?: throw IOException("No se conserva el PDF original.")
        if (original.length() > MAX_PDF_BYTES)
            throw IOException("El PDF supera el límite de 400 MB.")
        PDFBoxResourceLoader.init(context.applicationContext)
        val root = checkpointRoot(context, book, "pdf").apply { mkdirs() }
        // PDFBox spills temporary data to disk instead of storing whole PDFs in RAM.
        PDDocument.load(original, MemoryUsageSetting.setupTempFileOnly()).use { document ->
            if (document.isEncrypted) throw IOException("El PDF tiene contraseña.")
            val total = document.numberOfPages
            if (total !in 1..MAX_PAGES) throw IOException("PDF sin páginas válidas o superior a 4000 páginas.")
            File(root, "total.txt").writeText(total.toString())
            val stripper = PDFTextStripper().apply { sortByPosition = true }
            val descriptor = ParcelFileDescriptor.open(original, ParcelFileDescriptor.MODE_READ_ONLY)
            descriptor.use {
                PdfRenderer(it).use { renderer ->
                    if (renderer.pageCount != total)
                        throw IOException("El número de páginas del PDF es incompatible.")
                    try {
                        for (i in 1..total) {
                            check(continueWork)
                            if (!isCheckpointComplete(root, i)) {
                                stripper.startPage = i
                                stripper.endPage = i
                                var recognized = stripper.getText(document).trim()
                                if (recognized.count(Char::isLetterOrDigit) < 40) {
                                    val extra = renderer.openPage(i - 1).use { page ->
                                        val target = NativeReaderOcr.scaledDimensions(
                                            page.width * 2, page.height * 2)
                                        val bitmap = Bitmap.createBitmap(
                                            target.first, target.second, Bitmap.Config.ARGB_8888)
                                        try {
                                            bitmap.eraseColor(Color.WHITE)
                                            page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
                                            NativeReaderOcr.recognizeBitmap(bitmap)
                                        } finally { bitmap.recycle() }
                                    }
                                    if (extra.length > recognized.length) recognized = extra
                                }
                                checkpoint(root, i, recognized)
                            }
                            val status = progress(context, book, "pdf")
                            onProgress(status)
                            // Surface partial reading text and persist all finished pages.
                            if (i % 10 == 0 || i == total) {
                                store.replaceAccessibleText(book.id, assemble(root, total),
                                    if (i == total) "" else "OCR parcial. Puede reanudarse.")
                            }
                        }
                    } finally {
                        // Cancelling leaves usable recognized pages in the reader.
                        store.replaceAccessibleText(book.id, assemble(root, total),
                            if (progress(context, book, "pdf").complete) ""
                            else "OCR parcial. Puede reanudarse.")
                    }
                }
            }
        }
        return progress(context, book, "pdf")
    }

    /**
     * On-demand OCR for image resources in ZIP-based Office and EPUB.
     * Keeps the pre-existing book text as a frozen baseline; no duplicate text on resume.
     */
    fun embeddedImages(context: Context, book: ReaderBook, store: NativeReaderStore,
        continueWork: () -> Boolean, onProgress: (Progress) -> Unit): Progress {
        if (!sourceSupportsEmbeddedImages(book.format)) throw IOException(
            "Este formato no permite todavía OCR de imágenes incrustadas.")
        val original = store.originalFile(book) ?: throw IOException("Falta el archivo original.")
        val root = checkpointRoot(context, book, "images").apply { mkdirs() }
        val baseline = File(root, "source.txt")
        if (!baseline.isFile) {
            val text = store.read(book)
            if (text.length > MAX_TEXT_CHARS) throw IOException("El documento es demasiado extenso.")
            baseline.writeText(text, Charsets.UTF_8)
        }
        ZipFile(original).use { zip ->
            val entries = zip.entries().asSequence().filter {
                !it.isDirectory && imagePathAccepted(it.name, book.format)
            }.sortedBy { it.name }.toList()
            if (entries.size > MAX_IMAGE_ITEMS)
                throw IOException("Más de 600 imágenes: el OCR debe dividirse en lotes.")
            if (entries.isEmpty()) throw IOException("No hay imágenes incrustadas compatibles.")
            File(root, "total.txt").writeText(entries.size.toString())
            var accumulated = 0L
            try {
                for ((n, entry) in entries.withIndex()) {
                    check(continueWork)
                    val number = n + 1
                    if (!isCheckpointComplete(root, number)) {
                        if (entry.size !in 0..MAX_SINGLE_IMAGE.toLong())
                            throw IOException("Imagen demasiado grande: " + entry.name.take(100))
                        accumulated += entry.size
                        if (accumulated > MAX_IMAGE_TOTAL) throw IOException(
                            "Las imágenes superan el límite OCR de 150 MB.")
                        val bytes = zip.getInputStream(entry).use {
                            NativeReaderFormats.readBounded(it, MAX_SINGLE_IMAGE)
                        }
                        val text = try { NativeReaderOcr.recognizeImage(bytes) }
                            catch (e: IOException) { "" } // Preserve remaining valid images.
                        checkpoint(root, number, text)
                    }
                    onProgress(progress(context, book, "images"))
                    if (number % 10 == 0 || number == entries.size) {
                        updateImagesText(book, store, root, entries.size)
                    }
                }
            } finally {
                updateImagesText(book, store, root, entries.size)
            }
        }
        return progress(context, book, "images")
    }

    private fun updateImagesText(book: ReaderBook, store: NativeReaderStore,
        root: File, total: Int) {
        val base = File(root, "source.txt").readText(Charsets.UTF_8)
        val images = assemble(root, total)
        val combined = if (images.isBlank()) base
            else base + "\n\nTexto reconocido en imágenes incrustadas:\n\n" + images
        store.replaceAccessibleText(book.id, combined, "")
    }
}
