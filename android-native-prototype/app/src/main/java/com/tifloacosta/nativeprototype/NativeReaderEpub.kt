package com.tifloacosta.nativeprototype

import java.io.ByteArrayInputStream
import java.net.URI
import javax.xml.parsers.DocumentBuilderFactory
import org.w3c.dom.Document
import org.w3c.dom.Element

/** Reading order from the EPUB OPF spine, not alphabetical XHTML file names. */
object NativeReaderEpub {
    private fun xml(bytes: ByteArray): Document {
        val factory = DocumentBuilderFactory.newInstance()
        factory.isNamespaceAware = true
        factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true)
        factory.setFeature("http://xml.org/sax/features/external-general-entities", false)
        factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false)
        factory.setFeature("http://apache.org/xml/features/nonvalidating/load-external-dtd", false)
        factory.isXIncludeAware = false
        factory.isExpandEntityReferences = false
        return factory.newDocumentBuilder().parse(ByteArrayInputStream(bytes))
    }
    fun orderedPages(files: Map<String, ByteArray>): List<String> {
        val fallback = files.keys.filter { path ->
            path.endsWith(".xhtml", true) || path.endsWith(".html", true) || path.endsWith(".htm", true)
        }.filterNot {
            it.contains("nav.", true) || it.contains("toc.", true)
        }.sorted()
        return try {
            val root = files["META-INF/container.xml"]?.let { xml(it) } ?: return fallback
            val roots = root.getElementsByTagNameNS("*", "rootfile")
            val opf = (roots.item(0) as? Element)?.getAttribute("full-path")
                ?.takeIf { it.isNotBlank() } ?: return fallback
            val packageFile = files[opf] ?: return fallback
            val packageXml = xml(packageFile)
            val manifest = packageXml.getElementsByTagNameNS("*", "item")
            val byId = mutableMapOf<String, String>()
            for (i in 0 until manifest.length) {
                val item = manifest.item(i) as? Element ?: continue
                val id = item.getAttribute("id")
                val href = item.getAttribute("href")
                if (id.isNotBlank() && href.isNotBlank()) {
                    val resolved = URI("https://example.invalid/" + opf)
                        .resolve(href).path.removePrefix("/")
                    if (files.containsKey(resolved)) byId[id] = resolved
                }
            }
            val spine = packageXml.getElementsByTagNameNS("*", "itemref")
            val ordered = (0 until spine.length).mapNotNull { i ->
                val ref = spine.item(i) as? Element ?: return@mapNotNull null
                byId[ref.getAttribute("idref")]
            }.filter { it in fallback }.distinct()
            // Files outside the spine are frequently page lists or auxiliary
            // XHTML navigation documents; never append them to the spoken book.
            if (ordered.isEmpty()) fallback else ordered
        } catch (_: Exception) { fallback }
    }
}
