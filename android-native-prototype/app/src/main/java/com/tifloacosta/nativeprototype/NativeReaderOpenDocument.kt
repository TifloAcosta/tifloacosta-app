package com.tifloacosta.nativeprototype

import java.io.ByteArrayInputStream
import java.io.IOException
import javax.xml.parsers.DocumentBuilderFactory
import org.w3c.dom.Element
import org.w3c.dom.Node
import org.w3c.dom.Document

/** Read basic text from OpenDocument XML without executing embedded objects. */
object NativeReaderOpenDocument {
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
    private fun all(root: Node, local: String): List<Element> {
        val list = mutableListOf<Element>()
        fun walk(current: Node) {
            if (current is Element && current.localName == local) list.add(current)
            val children = current.childNodes
            for (i in 0 until children.length) walk(children.item(i))
        }
        walk(root)
        return list
    }
    private fun text(element: Node): String {
        val out = StringBuilder()
        fun add(n: Node) {
            if (n.nodeType == Node.TEXT_NODE) {
                out.append(n.nodeValue ?: "")
                return
            }
            if (n.localName == "s") {
                val attr = n.attributes?.getNamedItem("text:c")?.nodeValue?.toIntOrNull()
                out.append(" ".repeat((attr ?: 1).coerceIn(1, 80)))
                return
            }
            if (n.localName == "tab") { out.append('\t'); return }
            if (n.localName == "line-break") { out.append('\n'); return }
            for (i in 0 until n.childNodes.length) add(n.childNodes.item(i))
        }
        add(element)
        return out.toString().trim()
    }
    fun extract(format: String, files: Map<String, ByteArray>): String {
        val content = files["content.xml"]
            ?: throw IOException("Falta el contenido principal del documento OpenDocument.")
        val body = try { xml(content) }
        catch (_: Exception) { throw IOException("El archivo OpenDocument contiene XML inválido.") }
        val lines = mutableListOf<String>()
        when (format) {
            "odt" -> {
                val paragraphs = all(body.documentElement, "p") + all(body.documentElement, "h")
                paragraphs.forEach { p ->
                    val value = text(p)
                    if (value.isNotBlank()) lines.add(value)
                }
            }
            "ods" -> {
                all(body.documentElement, "table").forEachIndexed { sheet, table ->
                    val title = table.getAttribute("table:name").ifBlank { "Hoja " + (sheet + 1) }
                    lines.add(title)
                    all(table, "table-row").take(20000).forEach { row ->
                        val cells = all(row, "table-cell")
                            .mapNotNull { cell ->
                                val value = all(cell, "p").joinToString(" ") { text(it) }
                                    .ifBlank { cell.getAttribute("office:value") }
                                value.takeIf { it.isNotBlank() }
                            }
                        if (cells.isNotEmpty()) lines.add(cells.joinToString(", "))
                    }
                }
            }
            "odp" -> {
                all(body.documentElement, "page").forEachIndexed { index, slide ->
                    lines.add("Diapositiva " + (index + 1))
                    val contents = (all(slide, "p") + all(slide, "h"))
                        .map { text(it) }.filter { it.isNotBlank() }
                    lines.addAll(contents)
                }
            }
            else -> throw IOException("Extensión OpenDocument no reconocida.")
        }
        val result = lines.joinToString("\n").take(6 * 1024 * 1024)
        if (result.isBlank()) throw IOException("No hay texto accesible en el archivo OpenDocument.")
        return result
    }
}
