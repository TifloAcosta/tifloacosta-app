package com.tifloacosta.nativeprototype

import java.io.File
import java.net.URI
import java.util.Locale
import javax.xml.parsers.DocumentBuilderFactory
import org.w3c.dom.Element

data class ReaderAudioSegment(
    val fileIndex: Int,
    val startMs: Int = 0,
    val endMs: Int = -1,
    val label: String = ""
)

data class ReaderAudioMark(val segmentIndex: Int, val positionMs: Int)

data class NativeDaisyPlan(
    val audioPaths: List<String>,
    val segments: List<ReaderAudioSegment>,
    val daisy: Boolean
)

/** DAISY 2.02: NCC orders SMIL, SMIL orders audio clips and subpositions. */
object NativeReaderDaisy {
    private val audioTypes get() = NativeReaderFormats.AUDIO_EXTENSIONS

    fun clock(value: String?): Int {
        if (value.isNullOrBlank()) return -1
        val stripped = value.trim().removePrefix("npt=").removeSuffix("s")
        return try {
            val fields = stripped.split(':').map { it.toDouble() }
            if (fields.any { !it.isFinite() || it < 0 }) return -1
            val seconds = fields.fold(0.0) { total, amount -> total * 60 + amount }
            if (seconds > Int.MAX_VALUE / 1000.0) -1 else (seconds * 1000).toInt()
        } catch (_: Exception) { -1 }
    }

    fun resolve(base: String, target: String, available: Set<String>): String? {
        if (target.isBlank() || target.startsWith("//") || Regex("^[A-Za-z]+:").containsMatchIn(target))
            return null
        return try {
            val resolved = URI("https://local.invalid/" + base)
                .resolve(target).normalize().path.removePrefix("/")
            val valid = NativeReaderArchives.validLogicalPath(resolved) ?: return null
            available.firstOrNull { it == valid }
                ?: available.firstOrNull { it.equals(valid, ignoreCase = true) }
        } catch (_: Exception) { null }
    }

    private fun document(data: ByteArray): org.w3c.dom.Document {
        val factory = DocumentBuilderFactory.newInstance()
        factory.isNamespaceAware = true
        factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true)
        factory.setFeature("http://xml.org/sax/features/external-general-entities", false)
        factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false)
        factory.setFeature("http://apache.org/xml/features/nonvalidating/load-external-dtd", false)
        factory.isXIncludeAware = false
        factory.isExpandEntityReferences = false
        // Real DAISY 2.02 books normally declare an external SMIL 1.0 DTD.
        // Strip that declaration WITHOUT fetching external entities.
        val xml = data.toString(Charsets.UTF_8).replace(
            Regex("<!DOCTYPE\\s+smil\\b[^>]*>", RegexOption.IGNORE_CASE), ""
        )
        return factory.newDocumentBuilder().parse(xml.byteInputStream(Charsets.UTF_8))
    }

    /** Identifies referenced SMIL documents from NCC (or OPF spine) in reading order. */
    fun smilOrder(files: Map<String, File>): List<String> {
        val names = files.keys
        val allSmil = names.filter { it.endsWith(".smil", true) || it.endsWith(".smi", true) }
            .sortedBy { NativeReaderArchives.naturalKey(it) }
        val ncc = names.firstOrNull { it.endsWith("/ncc.html", true) ||
            it.equals("ncc.html", true) }
        if (ncc != null) {
            val html = files.getValue(ncc).takeIf { it.length() <= 2 * 1024 * 1024 }
                ?.readText(Charsets.UTF_8).orEmpty()
            val refs = Regex(
                """href\s*=\s*["']([^"']+\.smi(?:l)?(?:#[^"']*)?)["']""",
                RegexOption.IGNORE_CASE
            ).findAll(html).mapNotNull { match ->
                resolve(ncc, match.groupValues[1], names)
            }.filter { it in allSmil }.distinct().toList()
            if (refs.isNotEmpty()) return refs + allSmil.filterNot { it in refs }
        }
        val opf = names.firstOrNull { it.endsWith(".opf", true) }
        if (opf != null) try {
            val xml = files.getValue(opf).takeIf { it.length() < 2 * 1024 * 1024 }
                ?.readBytes()?.let(::document)
            if (xml != null) {
                val ids = mutableMapOf<String, String>()
                val manifest = xml.getElementsByTagNameNS("*", "item")
                for (i in 0 until manifest.length) {
                    val el = manifest.item(i) as? Element ?: continue
                    val href = resolve(opf, el.getAttribute("href"), names)
                    if (href != null && href in allSmil) ids[el.getAttribute("id")] = href
                }
                val spine = xml.getElementsByTagNameNS("*", "itemref")
                val refs = (0 until spine.length).mapNotNull { i ->
                    val el = spine.item(i) as? Element ?: return@mapNotNull null
                    ids[el.getAttribute("idref")]
                }.distinct()
                if (refs.isNotEmpty()) return refs + allSmil.filterNot { it in refs }
            }
        } catch (_: Exception) { /* Fall back to natural numeric order. */ }
        return allSmil
    }

    fun plan(files: Map<String, File>): NativeDaisyPlan {
        val names = files.keys
        val allAudio = names.filter { name ->
            name.substringAfterLast('.', "").lowercase(Locale.ROOT) in audioTypes
        }.sortedBy { NativeReaderArchives.naturalKey(it) }
        val smils = smilOrder(files)
        val daisy = smils.isNotEmpty() || names.any {
            it.endsWith("ncc.html", true) || it.endsWith(".ncx", true)
        }
        if (allAudio.isEmpty()) return NativeDaisyPlan(emptyList(), emptyList(), daisy)

        val ordered = mutableListOf<String>()
        val clips = mutableListOf<ReaderAudioSegment>()
        val indexByPath = mutableMapOf<String, Int>()
        for (smil in smils) {
            val f = files[smil] ?: continue
            if (f.length() > 4 * 1024 * 1024) continue
            try {
                val doc = document(f.readBytes())
                val nodes = doc.getElementsByTagNameNS("*", "audio")
                for (j in 0 until nodes.length) {
                    val element = nodes.item(j) as? Element ?: continue
                    val path = resolve(smil, element.getAttribute("src"), names)
                        ?.takeIf { it in allAudio } ?: continue
                    val index = indexByPath.getOrPut(path) {
                        ordered.add(path)
                        ordered.lastIndex
                    }
                    val begin = clock(element.getAttribute("clip-begin")
                        .ifBlank { element.getAttribute("clipBegin") }).coerceAtLeast(0)
                    val end = clock(element.getAttribute("clip-end")
                        .ifBlank { element.getAttribute("clipEnd") })
                    if (end >= 0 && end <= begin) continue
                    clips.add(ReaderAudioSegment(index, begin, end, smil.substringAfterLast('/')))
                    if (clips.size > 60000)
                        throw IllegalArgumentException("Demasiados segmentos DAISY.")
                }
            } catch (e: IllegalArgumentException) { throw e }
            catch (_: Exception) { /* Keep audio files even with invalid SMIL. */ }
        }
        // Metadata may omit files; keep them reachable after valid segments.
        for (path in allAudio) {
            if (path !in indexByPath) {
                indexByPath[path] = ordered.size
                ordered.add(path)
                clips.add(ReaderAudioSegment(ordered.lastIndex, 0, -1, path.substringAfterLast('/')))
            }
        }
        if (clips.isEmpty()) {
            return NativeDaisyPlan(allAudio, allAudio.indices.map {
                ReaderAudioSegment(it, 0, -1, allAudio[it].substringAfterLast('/'))
            }, daisy)
        }
        return NativeDaisyPlan(ordered, clips, daisy)
    }
}
