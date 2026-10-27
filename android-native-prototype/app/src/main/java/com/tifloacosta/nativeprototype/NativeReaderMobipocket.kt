package com.tifloacosta.nativeprototype

import org.jsoup.Jsoup
import org.jsoup.nodes.TextNode
import java.io.ByteArrayOutputStream
import java.io.IOException
import java.nio.charset.Charset
import java.util.Locale

/** Basic unencrypted PalmDOC / Mobipocket reader. Never removes DRM. */
object NativeReaderMobipocket {
    private const val MAX_TEXT_BYTES = 6 * 1024 * 1024
    private const val MAX_RECORDS = 4000

    private fun u16(a: ByteArray, p: Int): Int {
        if (p < 0 || p + 2 > a.size) throw IOException("Cabecera MOBI incompleta.")
        return (a[p].toInt() and 255 shl 8) or (a[p + 1].toInt() and 255)
    }
    private fun u32(a: ByteArray, p: Int): Long {
        if (p < 0 || p + 4 > a.size) throw IOException("Cabecera MOBI incompleta.")
        return ((a[p].toLong() and 255) shl 24) or
            ((a[p + 1].toLong() and 255) shl 16) or
            ((a[p + 2].toLong() and 255) shl 8) or
            (a[p + 3].toLong() and 255)
    }
    private fun str(a: ByteArray, p: Int, n: Int): String {
        if (p < 0 || n < 0 || p + n > a.size) throw IOException("Cabecera MOBI incompleta.")
        return String(a, p, n, Charsets.US_ASCII)
    }

    /** PalmDOC LZ77, tested with overlapping backward references. */
    fun decompressPalmDoc(data: ByteArray, limit: Int = MAX_TEXT_BYTES): ByteArray {
        val out = ByteArrayOutputStream()
        var p = 0
        fun write(b: Int) {
            if (out.size() >= limit) throw IOException("El texto MOBI supera el límite.")
            out.write(b and 255)
        }
        while (p < data.size) {
            val token = data[p++].toInt() and 255
            when {
                token == 0 || token in 9..0x7f -> write(token)
                token in 1..8 -> {
                    if (p + token > data.size) throw IOException("Compresión PalmDOC incompleta.")
                    repeat(token) { write(data[p++].toInt()) }
                }
                token in 0x80..0xbf -> {
                    if (p >= data.size) throw IOException("Referencia PalmDOC incompleta.")
                    val code = ((token and 0x3f) shl 8) or (data[p++].toInt() and 255)
                    val distance = code shr 3
                    val count = (code and 7) + 3
                    if (distance == 0 || distance > out.size()) throw IOException(
                        "Referencia PalmDOC fuera del texto."
                    )
                    repeat(count) {
                        val a = out.toByteArray()
                        write(a[a.size - distance].toInt())
                    }
                }
                token in 0xc0..0xff -> {
                    write(32)
                    write(token xor 0x80)
                }
                else -> write(token)
            }
        }
        return out.toByteArray()
    }

    fun extract(format: String, bytes: ByteArray): String {
        if (format.lowercase(Locale.ROOT) !in setOf("mobi", "prc", "pdb", "azw", "azw3")) {
            throw IOException("Extensión de libro Mobipocket incorrecta.")
        }
        if (bytes.size < 86) throw IOException("Libro PalmDB demasiado corto.")
        val identity = str(bytes, 60, 8)
        if (identity != "BOOKMOBI" && identity != "TEXtREAd") {
            throw IOException("No es un libro Mobipocket o PalmDOC reconocido.")
        }
        val count = u16(bytes, 76)
        if (count < 2 || count > MAX_RECORDS || 78L + count * 8L > bytes.size) {
            throw IOException("Índice de registros PalmDB no válido.")
        }
        val positions = (0 until count).map { u32(bytes, 78 + it * 8) }
        if (positions.any { it < 78 + count * 8 || it >= bytes.size } ||
            positions.zipWithNext().any { it.first >= it.second }) {
            throw IOException("Registros Mobipocket fuera de orden.")
        }
        val start = positions[0].toInt()
        val recordEnd = positions[1].toInt()
        if (recordEnd - start < 16) throw IOException("Cabecera PalmDOC incompleta.")
        val compression = u16(bytes, start)
        val total = u32(bytes, start + 4)
        val textRecords = u16(bytes, start + 8)
        val encryption = if (identity == "BOOKMOBI") u16(bytes, start + 12) else 0
        if (encryption != 0) throw IOException(
            "Este libro contiene DRM o está cifrado. No se puede leer ni descifrar."
        )
        if (compression !in setOf(1, 2)) throw IOException(
            "La compresión HUFF/CDIC u otra variante de este MOBI no está admitida."
        )
        if (total == 0L || total > MAX_TEXT_BYTES || textRecords == 0 ||
            textRecords >= count || textRecords > MAX_RECORDS) {
            throw IOException("El libro declara una longitud o registros excesivos.")
        }
        val mobi = identity == "BOOKMOBI" && recordEnd - start >= 40 &&
            str(bytes, start + 16, 4) == "MOBI"
        val encoding = if (mobi) u32(bytes, start + 28).toInt() else 1252
        val version = if (mobi) u32(bytes, start + 36).toInt() else 0
        if (version >= 8 && compression != 1 && compression != 2) {
            throw IOException("Variante Kindle KF8 no compatible.")
        }
        val out = ByteArrayOutputStream()
        for (record in 1..textRecords) {
            val begin = positions[record].toInt()
            val end = positions.getOrNull(record + 1)?.toInt() ?: bytes.size
            if (end < begin || end - begin > 1024 * 1024)
                throw IOException("Registro de texto Mobipocket demasiado grande.")
            val data = bytes.copyOfRange(begin, end)
            val decompressed = if (compression == 2)
                decompressPalmDoc(data, (MAX_TEXT_BYTES - out.size()).coerceAtLeast(0))
                else data
            if (out.size().toLong() + decompressed.size > MAX_TEXT_BYTES)
                throw IOException("El libro supera el tamaño permitido.")
            out.write(decompressed)
            if (out.size() >= total) break
        }
        val raw = out.toByteArray()
        val document = raw.copyOfRange(0, minOf(total.toInt(), raw.size))
        val codec = when (encoding) {
            65001 -> Charsets.UTF_8
            1252 -> Charset.forName("windows-1252")
            else -> throw IOException("Codificación Mobipocket todavía no compatible: $encoding.")
        }
        val text = document.toString(codec).replace("\u0000", "").trim()
        if (text.isBlank()) throw IOException("El libro Mobipocket no contiene texto legible.")
        val visible = if (text.contains(Regex("<(?:html|body|p|div|h[1-6]|br)\\b",
                RegexOption.IGNORE_CASE))) {
            val doc = Jsoup.parse(text)
            doc.select("script,style,svg").remove()
            doc.body().wholeText().replace(Regex("[ \\t]+"), " ")
                .replace(Regex("\\n{4,}"), "\n\n").trim()
        } else text
        if (visible.isBlank()) throw IOException("El libro no contiene texto extraíble.")
        return visible.take(MAX_TEXT_BYTES)
    }
}
