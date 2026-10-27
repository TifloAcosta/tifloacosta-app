package com.tifloacosta.nativeprototype

import org.jsoup.Jsoup
import org.jsoup.parser.Parser
import java.io.File

/** DAISY SMIL text@src preview; no claims of speech-to-text transcription. */
object NativeReaderDaisyText {
    private val sourceCache = mutableMapOf<String, org.jsoup.nodes.Document>()
    private const val MAX_CACHE_DOCS = 16

    fun excerpt(reference: String, files: Map<String, File>): String {
        val path = reference.substringBefore('#')
        val fragment = reference.substringAfter('#', "")
        if (fragment.isBlank()) return ""
        val file = files[path] ?: return ""
        if (file.length() > 4L * 1024 * 1024) return ""
        return try {
            if (sourceCache.size > MAX_CACHE_DOCS) sourceCache.clear()
            // Different DAISY books frequently use the SAME relative path,
            // e.g. text/chapter.xhtml. Cache by real temporary file identity.
            val doc = sourceCache.getOrPut(file.absolutePath) {
                val bytes = file.readBytes()
                val decoded = bytes.toString(Charsets.UTF_8).removePrefix("\uFEFF")
                val source = if ('\uFFFD' in decoded) bytes.toString(Charsets.ISO_8859_1)
                    else decoded
                if (path.endsWith(".xml", true)) Jsoup.parse(source, "", Parser.xmlParser())
                else Jsoup.parse(source)
            }
            val node = doc.getElementById(fragment) ?: return ""
            val raw = node.text().replace(Regex("\\s+"), " ").trim()
            raw.take(200)
        } catch (_: Exception) { "" }
    }

    fun clear() { sourceCache.clear() }
}
