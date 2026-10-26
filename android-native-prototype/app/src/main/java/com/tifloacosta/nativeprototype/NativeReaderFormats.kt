package com.tifloacosta.nativeprototype

import android.content.Context
import android.text.Html
import com.tom_roush.pdfbox.android.PDFBoxResourceLoader
import com.tom_roush.pdfbox.pdmodel.PDDocument
import com.tom_roush.pdfbox.text.PDFTextStripper
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.IOException
import java.io.InputStream
import java.nio.charset.Charset
import java.util.Locale
import java.util.zip.ZipInputStream
import javax.xml.parsers.DocumentBuilderFactory
import org.w3c.dom.Element
import org.w3c.dom.Node

data class DecodedReaderFile(
    val body: String,
    val format: String,
    val audio: List<Pair<String, ByteArray>> = emptyList()
)

/** Format availability is derived from decoders, never from the picker's MIME wildcard. */
object NativeReaderFormats {
    const val MAX_ARCHIVE_BYTES = 80 * 1024 * 1024
    private const val MAX_UNPACKED_BYTES = 120 * 1024 * 1024
    private const val MAX_TEXT = 6 * 1024 * 1024
    val AUDIO_EXTENSIONS = setOf("mp3", "m4a", "m4b", "wav", "ogg", "aac", "flac", "opus")
    val supported = setOf(
        "txt", "text", "md", "markdown", "html", "htm", "rtf", "csv", "json",
        "xml", "log", "srt", "epub", "pdf", "docx", "pptx", "xlsx",
        "zip", "daisy", "jpg", "jpeg", "png", "webp", "bmp", "heic", "heif",
        "odt", "ods", "odp", "ppsx", "xhtml"
    ) + AUDIO_EXTENSIONS

    fun readBounded(stream: InputStream, limit: Int): ByteArray {
        val buffer = ByteArray(16 * 1024)
        val out = ByteArrayOutputStream()
        while (true) {
            val read = stream.read(buffer)
            if (read == -1) break
            if (read == 0) continue
            if (out.size() + read > limit) throw IOException("El archivo supera el límite permitido.")
            out.write(buffer, 0, read)
        }
        return out.toByteArray()
    }

    fun decode(context: Context, extRaw: String, input: ByteArray,
               progress: ((Int, Int) -> Unit)? = null): DecodedReaderFile {
        val ext = extRaw.lowercase(Locale.ROOT)
        if (ext !in supported) throw IOException("El formato .$ext aún no dispone de lector compatible.")
        if (input.isEmpty()) throw IOException("El documento está vacío.")
        if (input.size > MAX_ARCHIVE_BYTES) throw IOException("El documento es demasiado grande.")
        if (ext in AUDIO_EXTENSIONS) return DecodedReaderFile("", ext, listOf("audio.$ext" to input))
        if (ext in setOf("jpg", "jpeg", "png", "webp", "bmp", "heic", "heif")) {
            val text = NativeReaderOcr.recognizeImage(input)
            if (text.isBlank()) throw IOException(
                "No se encontró texto reconocible en la imagen."
            )
            return DecodedReaderFile(text.take(MAX_TEXT), ext)
        }
        if (ext == "pdf") {
            return DecodedReaderFile(NativeReaderOcr.recognizePdf(context, input, progress), "pdf")
        }
        if (ext in setOf("zip", "epub", "docx", "pptx", "ppsx",
                "xlsx", "daisy", "odt", "ods", "odp")) {
            return decodeArchive(ext, input)
        }
        val text = input.toString(Charsets.UTF_8).removePrefix("\uFEFF").let {
            if ('\uFFFD' in it) input.toString(Charset.forName("windows-1252")) else it
        }
        val body = when (ext) {
            "rtf" -> NativeReaderRtf.extract(text)
            "html", "htm", "xhtml", "xml" -> asText(text)
            else -> text
        }
        if (body.isBlank()) throw IOException("No se ha encontrado texto legible.")
        return DecodedReaderFile(body.take(MAX_TEXT), ext)
    }

    private fun asText(source: String): String {
        val cleaned = source.replace(
            Regex("<(script|style)\\b[^>]*>[\\s\\S]*?</\\1>", RegexOption.IGNORE_CASE), ""
        )
        return Html.fromHtml(cleaned, Html.FROM_HTML_MODE_COMPACT).toString()
            .replace(Regex("\\n{4,}"), "\n\n")
    }

    private fun unpack(input: ByteArray): Map<String, ByteArray> {
        if (input.size < 4 || input[0] != 'P'.code.toByte() || input[1] != 'K'.code.toByte()) {
            throw IOException("El archivo no es un ZIP válido.")
        }
        val files = linkedMapOf<String, ByteArray>()
        var unpacked = 0L
        ZipInputStream(ByteArrayInputStream(input)).use { zip ->
            var count = 0
            while (true) {
                val entry = zip.nextEntry ?: break
                count++
                if (count > 1500) throw IOException("Demasiados archivos en el ZIP.")
                val name = entry.name.replace('\\', '/')
                if (!entry.isDirectory && name.isNotBlank() &&
                    !name.startsWith("/") && !name.split('/').contains("..")) {
                    val maxFile = if (name.substringAfterLast('.').lowercase() in AUDIO_EXTENSIONS)
                        70 * 1024 * 1024 else MAX_TEXT
                    val data = readBounded(zip, maxFile)
                    unpacked += data.size.toLong()
                    if (unpacked > MAX_UNPACKED_BYTES) {
                        throw IOException("El ZIP descomprimido supera el límite.")
                    }
                    files[name] = data
                }
                zip.closeEntry()
            }
        }
        return files
    }

    private fun parseXml(bytes: ByteArray): org.w3c.dom.Document {
        val factory = DocumentBuilderFactory.newInstance()
        factory.isNamespaceAware = false
        factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true)
        factory.setFeature("http://xml.org/sax/features/external-general-entities", false)
        factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false)
        factory.setFeature("http://apache.org/xml/features/nonvalidating/load-external-dtd", false)
        factory.isXIncludeAware = false
        factory.isExpandEntityReferences = false
        return factory.newDocumentBuilder().parse(ByteArrayInputStream(bytes))
    }

    private fun tagText(bytes: ByteArray, paragraphTag: String, textTag: String): String {
        return try {
            val doc = parseXml(bytes)
            val paragraphs = doc.getElementsByTagName(paragraphTag)
            (0 until paragraphs.length).mapNotNull { idx ->
                val p = paragraphs.item(idx) as? Element ?: return@mapNotNull null
                val texts = p.getElementsByTagName(textTag)
                val value = (0 until texts.length).joinToString("") { i ->
                    texts.item(i)?.textContent.orEmpty()
                }
                value.takeIf { it.isNotBlank() }
            }.joinToString("\n")
        } catch (_: Exception) {
            throw IOException("Contenido de Office no válido o protegido.")
        }
    }

    private fun excelText(files: Map<String, ByteArray>): String {
        val shared = files["xl/sharedStrings.xml"]?.let { data ->
            val doc = parseXml(data)
            val strings = doc.getElementsByTagName("si")
            (0 until strings.length).map { i ->
                val node = strings.item(i) as Element
                val children = node.getElementsByTagName("t")
                (0 until children.length).joinToString("") { n -> children.item(n).textContent }
            }
        } ?: emptyList()
        val sheets = files.keys.filter { Regex("xl/worksheets/sheet\\d+\\.xml").matches(it) }
            .sortedWith(compareBy { it.substringAfter("sheet").substringBefore(".").toIntOrNull() ?: 9999 })
        return sheets.joinToString("\n\n") { name ->
            val doc = parseXml(files.getValue(name))
            val rows = doc.getElementsByTagName("row")
            val lines = (0 until rows.length).mapNotNull { n ->
                val row = rows.item(n) as Element
                val cells = row.getElementsByTagName("c")
                val data = (0 until cells.length).map { c ->
                    val cell = cells.item(c) as Element
                    val v = cell.getElementsByTagName("v").item(0)?.textContent.orEmpty()
                    val inline = cell.getElementsByTagName("t").item(0)?.textContent.orEmpty()
                    val value = if (cell.getAttribute("t") == "s") {
                        shared.getOrNull(v.toIntOrNull() ?: -1).orEmpty()
                    } else inline.ifBlank { v }
                    cell.getAttribute("r") + ": " + value
                }.filter { it.substringAfter(": ").isNotBlank() }
                data.takeIf { it.isNotEmpty() }?.joinToString(", ")
            }
            "Hoja " + name.substringAfter("sheet").substringBefore(".") + "\n" + lines.joinToString("\n")
        }
    }

    private fun decodeArchive(ext: String, bytes: ByteArray): DecodedReaderFile {
        val files = unpack(bytes)
        if (files.isEmpty()) throw IOException("El archivo comprimido está vacío.")
        fun find(pattern: Regex): List<String> = files.keys.filter { pattern.matches(it) }
        fun pages(paths: List<String>): String = paths.joinToString("\n\n") { name ->
            val raw = files.getValue(name).toString(Charsets.UTF_8)
            asText(raw)
        }.take(MAX_TEXT)
        return when (ext) {
            "odt", "ods", "odp" -> {
                DecodedReaderFile(NativeReaderOpenDocument.extract(ext, files), ext)
            }
            "docx" -> {
                val body = files["word/document.xml"]?.let { tagText(it, "w:p", "w:t") }.orEmpty()
                if (body.isBlank()) throw IOException("El DOCX no contiene texto extraíble.")
                DecodedReaderFile(body.take(MAX_TEXT), ext)
            }
            "pptx", "ppsx" -> {
                val paths = find(Regex("ppt/slides/slide\\d+\\.xml"))
                    .sortedBy { it.substringAfter("slide").substringBefore(".").toIntOrNull() ?: 9999 }
                val text = paths.joinToString("\n\n") {
                    "Diapositiva " + it.substringAfter("slide").substringBefore(".") +
                        "\n" + tagText(files.getValue(it), "a:p", "a:t")
                }
                if (text.isBlank()) throw IOException("La presentación no contiene texto extraíble.")
                DecodedReaderFile(text.take(MAX_TEXT), ext)
            }
            "xlsx" -> {
                val body = excelText(files)
                if (body.isBlank()) throw IOException("El Excel no contiene celdas legibles.")
                DecodedReaderFile(body.take(MAX_TEXT), ext)
            }
            else -> {
                val names = files.keys
                val daisy = ext == "daisy" || names.any {
                    it.endsWith("ncc.html", true) || it.endsWith(".smil", true) || it.endsWith(".ncx", true)
                }
                val epub = ext == "epub" || files["mimetype"]?.toString(Charsets.UTF_8)
                    ?.trim() == "application/epub+zip"
                val textPaths = names.filter { path ->
                    val lower = path.lowercase(Locale.ROOT)
                    (lower.endsWith(".html") || lower.endsWith(".xhtml") ||
                        (!epub && (lower.endsWith(".txt") || lower.endsWith(".md")))) &&
                        !lower.contains("toc.") && !lower.contains("nav.") &&
                        !lower.endsWith("ncc.html")
                }.sorted()
                val orderedTextPaths = if (epub) NativeReaderEpub.orderedPages(files)
                    else textPaths
                val text = pages(orderedTextPaths)
                val audio = names.filter { path ->
                    path.substringAfterLast('.').lowercase(Locale.ROOT) in AUDIO_EXTENSIONS
                }.sorted().map { name -> name to files.getValue(name) }
                val type = when {
                    daisy -> "daisy"
                    epub -> "epub"
                    else -> "zip"
                }
                if (text.isBlank() && audio.isEmpty()) {
                    throw IOException("No hay texto o pistas de audio compatibles en el archivo.")
                }
                DecodedReaderFile(text, type, audio)
            }
        }
    }
}
