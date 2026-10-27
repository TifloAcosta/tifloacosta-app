package com.tifloacosta.nativeprototype

import org.jsoup.Jsoup
import org.jsoup.parser.Parser
import org.jsoup.nodes.Element
import java.io.File
import java.util.Locale

/** Navigable anchor in actual narrated playback, not a guessed MP3 file position. */
data class ReaderDaisyNavPoint(
    val kind: String, // heading, page, note, landmark
    val level: Int,
    val label: String,
    val segmentIndex: Int,
    val target: String = ""
)

/** Pure navigation rules, used by playback, Compose and unit tests. */
object NativeDaisyNavigation {
    val kinds = setOf("heading", "page", "note", "landmark")
    fun filter(points: List<ReaderDaisyNavPoint>, kind: String, level: Int = 0):
        List<ReaderDaisyNavPoint> = points.filter {
        it.kind == kind && (kind != "heading" || level == 0 || it.level == level)
    }
    fun adjacent(points: List<ReaderDaisyNavPoint>, segment: Int, forward: Boolean): ReaderDaisyNavPoint? =
        if (forward) points.firstOrNull { it.segmentIndex > segment }
        else points.lastOrNull { it.segmentIndex < segment }

    /** DAISY 2.02 NCC: headings, printed page spans and optional note-like divisions. */
    fun ncc(
        path: String, files: Map<String, File>,
        anchorSegments: Map<String, Int>
    ): List<ReaderDaisyNavPoint> {
        val source = files[path]?.takeIf { it.length() < 4 * 1024 * 1024 } ?: return emptyList()
        val doc = Jsoup.parse(source.readText(Charsets.UTF_8))
        val result = mutableListOf<ReaderDaisyNavPoint>()
        val selector = "h1, h2, h3, h4, h5, h6, span, div"
        for (element in doc.body().select(selector)) {
            // NCC direct children are navigable, but tolerate div wrappers in the wild.
            val link = element.selectFirst("a[href]") ?: continue
            if (link.parents().any { p -> p !== element && p.tagName().matches(Regex("h[1-6]")) })
                continue
            val href = link.attr("href")
            val index = findSegment(path, href, files.keys, anchorSegments) ?: continue
            val tag = element.tagName().lowercase(Locale.ROOT)
            val cls = element.classNames().joinToString(" ").lowercase(Locale.ROOT)
            val kind = when {
                tag.matches(Regex("h[1-6]")) -> "heading"
                "page" in cls || tag == "span" -> "page"
                "footnote" in cls || "annotation" in cls || "note" in cls -> "note"
                tag == "div" -> "landmark"
                else -> continue
            }
            val label = link.text().trim().ifBlank { element.text().trim() }
            if (label.isBlank()) continue
            result.add(ReaderDaisyNavPoint(kind, if (kind == "heading") tag.last().digitToInt() else 0,
                label.take(200), index, href.take(250)))
            if (result.size >= 10000) break
        }
        return result
    }

    /** DAISY 3 NCX: navMap/navPoint, pageList/pageTarget and navList/navTarget. */
    fun ncx(
        path: String, files: Map<String, File>,
        anchorSegments: Map<String, Int>
    ): List<ReaderDaisyNavPoint> {
        val source = files[path]?.takeIf { it.length() < 4 * 1024 * 1024 } ?: return emptyList()
        val doc = Jsoup.parse(source.readText(Charsets.UTF_8), "", Parser.xmlParser())
        val found = mutableListOf<ReaderDaisyNavPoint>()
        fun name(element: Element): String = element.tagName().substringAfter(':').lowercase(Locale.ROOT)
        fun navigate(node: Element, level: Int = 0) {
            for (child in node.children()) {
                val tag = name(child)
                if (tag == "navpoint") {
                    val src = child.children().firstOrNull { name(it) == "content" }?.attr("src").orEmpty()
                    val pos = findSegment(path, src, files.keys, anchorSegments)
                    val caption = child.children().firstOrNull { name(it) == "navlabel" }
                        ?.text()?.trim().orEmpty()
                    if (pos != null && caption.isNotBlank()) {
                        found.add(ReaderDaisyNavPoint("heading", (level + 1).coerceAtMost(6),
                            caption.take(200), pos, src.take(250)))
                    }
                    navigate(child, level + 1)
                } else if (tag == "pagetarget" || tag == "navtarget") {
                    val src = child.children().firstOrNull { name(it) == "content" }?.attr("src").orEmpty()
                    val pos = findSegment(path, src, files.keys, anchorSegments)
                    val caption = child.children().firstOrNull { name(it) == "navlabel" }
                        ?.text()?.trim().orEmpty()
                    if (pos != null && caption.isNotBlank()) {
                        val kind = if (tag == "pagetarget") "page"
                            else if (node.attr("class").contains("note", ignoreCase = true) ||
                                node.attr("id").contains("note", ignoreCase = true)) "note"
                            else "landmark"
                        found.add(ReaderDaisyNavPoint(kind, 0,
                            caption.take(200), pos, src.take(250)))
                    }
                } else navigate(child, level)
                if (found.size >= 10000) return
            }
        }
        navigate(doc)
        return found.distinctBy { Triple(it.kind, it.label, it.segmentIndex) }
    }

    fun build(files: Map<String, File>, anchors: Map<String, Int>):
        List<ReaderDaisyNavPoint> {
        val paths = files.keys
        val nccs = paths.filter {
            it.endsWith("/ncc.html", true) || it.equals("ncc.html", true)
        }
        val ncxs = paths.filter { it.endsWith(".ncx", true) }
        val entries = mutableListOf<ReaderDaisyNavPoint>()
        for (ncc in nccs) {
            try { entries.addAll(ncc(ncc, files, anchors)) } catch (_: Exception) {}
        }
        for (ncx in ncxs) {
            try { entries.addAll(ncx(ncx, files, anchors)) } catch (_: Exception) {}
        }
        // Preserve the order in the source navigation tables for list presentation.
        return entries.distinctBy { Triple(it.kind, it.label, it.segmentIndex) }.take(10000)
    }

    private fun findSegment(
        base: String, href: String, available: Set<String>, anchors: Map<String, Int>
    ): Int? {
        val path = NativeReaderDaisy.resolve(base, href, available) ?: return null
        val fragment = href.substringAfter('#', "")
            .substringBefore('?').let { java.net.URLDecoder.decode(it.replace("+", "%2B"), "UTF-8") }
        val match = if (fragment.isBlank()) anchors[path]
            else anchors["$path#$fragment"] ?: anchors[path]
        return match
    }
}
