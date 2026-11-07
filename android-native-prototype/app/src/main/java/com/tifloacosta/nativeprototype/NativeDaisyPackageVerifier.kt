package com.tifloacosta.nativeprototype

import java.io.ByteArrayInputStream
import java.io.IOException
import java.util.zip.ZipInputStream
import javax.xml.parsers.DocumentBuilderFactory
import org.w3c.dom.Document
import org.w3c.dom.Element

/** Preflight of a generated DAISY package, without external DTD/network access.
 * This validates structural links, not full DAISY 3 conformance.
 */
internal object NativeDaisyPackageVerifier {
    internal fun validate(data: ByteArray) {
        val files = mutableMapOf<String, ByteArray>()
        var totalBytes = 0L
        ZipInputStream(ByteArrayInputStream(data)).use { zip ->
            while (true) {
                val entry = zip.nextEntry ?: break
                if (entry.isDirectory || entry.name.contains("..") ||
                    entry.name.startsWith("/") || files.containsKey(entry.name)) {
                    throw IOException("DAISY: archivo o ruta inválida.")
                }
                if (files.size >= 2048) throw IOException("DAISY: demasiados archivos.")
                val stream = java.io.ByteArrayOutputStream()
                val buffer = ByteArray(16384)
                while (true) {
                    val count = zip.read(buffer)
                    if (count < 0) break
                    totalBytes += count
                    if (totalBytes > 512L * 1024 * 1024)
                        throw IOException("DAISY: libro demasiado grande para verificar.")
                    stream.write(buffer, 0, count)
                }
                files[entry.name] = stream.toByteArray()
                zip.closeEntry()
            }
        }

        fun xml(name: String): Document {
            val raw = files[name] ?: throw IOException("DAISY: falta $name.")
            // DAISY's external public DTD is declared for readers, but verification
            // never fetches the DTD and never allows general external entities.
            val sanitized = raw.toString(Charsets.UTF_8)
                .replace(Regex("<!DOCTYPE[^>]*>", RegexOption.IGNORE_CASE), "")
            val factory = DocumentBuilderFactory.newInstance().apply {
                isNamespaceAware = true
                setFeature("http://apache.org/xml/features/disallow-doctype-decl", true)
                setFeature("http://xml.org/sax/features/external-general-entities", false)
                setFeature("http://xml.org/sax/features/external-parameter-entities", false)
                setFeature("http://apache.org/xml/features/nonvalidating/load-external-dtd", false)
                isXIncludeAware = false
                isExpandEntityReferences = false
            }
            return try {
                factory.newDocumentBuilder().parse(ByteArrayInputStream(
                    sanitized.toByteArray(Charsets.UTF_8)))
            } catch (_: Exception) {
                throw IOException("DAISY: XML inválido en $name.")
            }
        }

        fun elements(doc: Document, name: String): List<Element> {
            val nodes = doc.getElementsByTagNameNS("*", name)
            return (0 until nodes.length).map { nodes.item(it) as Element }
        }

        val opf = xml("book.opf")
        val dtbook = xml("book.xml")
        val ncx = xml("book.ncx")
        val smil = xml("sync.smil")

        val manifest = elements(opf, "item")
        if (manifest.isEmpty() || manifest.any { it.getAttribute("href") !in files })
            throw IOException("DAISY: el manifiesto contiene referencias incorrectas.")

        val textIDs = elements(dtbook, "p").map { it.getAttribute("id") } +
            elements(dtbook, "h2").map { it.getAttribute("id") }
        val textTargets = textIDs.filter { it.isNotEmpty() }.toSet()
        if (textTargets.size != textIDs.count { it.isNotEmpty() })
            throw IOException("DAISY: identificadores de texto duplicados.")
        val parallels = elements(smil, "par")
        if (parallels.isEmpty()) throw IOException("DAISY: no hay audio sincronizado.")
        val parallelIDs = parallels.map { it.getAttribute("id") }.toSet()
        if (parallelIDs.size != parallels.size || "" in parallelIDs)
            throw IOException("DAISY: identificadores SMIL duplicados o vacíos.")
        val audioReferences = mutableSetOf<String>()
        for (par in parallels) {
            val texts = par.getElementsByTagNameNS("*", "text")
            val sounds = par.getElementsByTagNameNS("*", "audio")
            if (texts.length != 1 || sounds.length != 1)
                throw IOException("DAISY: sincronización incompleta.")
            val text = texts.item(0) as Element
            val sound = sounds.item(0) as Element
            if (!text.getAttribute("src").startsWith("book.xml#") ||
                text.getAttribute("src").substringAfter("#") !in textTargets)
                throw IOException("DAISY: falta una referencia de texto.")
            val file = sound.getAttribute("src")
            if (!audioReferences.add(file))
                throw IOException("DAISY: varias referencias a la misma pista de audio.")
            val bytes = files[file] ?: throw IOException("DAISY: falta una pista.")
            if (!file.endsWith(".mp3", ignoreCase = true) ||
                !isMP3(bytes)) throw IOException("DAISY: MP3 no válido.")
            val timeFormat = Regex("""\d{2}:\d{2}:\d{2}(?:\.\d{3})?""")
            fun milliseconds(value: String): Long {
                if (!timeFormat.matches(value))
                    throw IOException("DAISY: marca temporal incorrecta.")
                val components = value.split(':')
                val seconds = components[2].toDouble()
                if (components[1].toInt() >= 60 || seconds >= 60.0)
                    throw IOException("DAISY: tiempo fuera de rango.")
                return (components[0].toLong() * 3600 + components[1].toLong() * 60) * 1000 +
                    (seconds * 1000).toLong()
            }
            val begin = milliseconds(sound.getAttribute("clipBegin"))
            val end = milliseconds(sound.getAttribute("clipEnd"))
            if (end <= begin)
                throw IOException("DAISY: el intervalo de audio no tiene duración.")
        }
        val navPoints = elements(ncx, "navPoint")
        val orders = navPoints.map { it.getAttribute("playOrder") }
        if (orders.isEmpty() || orders.any { it.toIntOrNull() == null } ||
            orders.distinct().size != orders.size)
            throw IOException("DAISY: orden de navegación duplicado o inválido.")
        val nav = elements(ncx, "content")
        if (nav.isEmpty() || nav.any {
            !it.getAttribute("src").startsWith("sync.smil#") ||
                it.getAttribute("src").substringAfter("#") !in parallelIDs
            }) throw IOException("DAISY: índice con enlaces incorrectos.")
    }

    private fun isMP3(data: ByteArray): Boolean {
        if (data.size < 100) return false
        if (data.take(4).toByteArray().contentEquals("RIFF".toByteArray())) return false
        return (0 until data.size - 1).any { index ->
            (data[index].toInt() and 255) == 255 &&
                (data[index + 1].toInt() and 0xE0) == 0xE0
        }
    }
}
