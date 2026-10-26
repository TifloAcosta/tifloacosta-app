package com.tifloacosta.nativeprototype

import java.io.ByteArrayInputStream
import java.io.IOException
import javax.xml.parsers.DocumentBuilderFactory
import org.w3c.dom.Node

/** FB2 FictionBook: retain the book's own paragraph order and readable headings. */
object NativeReaderFictionBook {
    fun extract(bytes: ByteArray): String {
        val factory = DocumentBuilderFactory.newInstance()
        factory.isNamespaceAware = true
        factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true)
        factory.setFeature("http://xml.org/sax/features/external-general-entities", false)
        factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false)
        factory.setFeature("http://apache.org/xml/features/nonvalidating/load-external-dtd", false)
        factory.isXIncludeAware = false
        factory.isExpandEntityReferences = false
        val doc = try { factory.newDocumentBuilder().parse(ByteArrayInputStream(bytes)) }
        catch (_: Exception) { throw IOException("El libro FB2 contiene XML inválido.") }
        if (doc.documentElement.localName != "FictionBook") {
            throw IOException("No es un archivo FictionBook FB2.")
        }
        val output = mutableListOf<String>()
        fun visit(node: Node) {
            val tag = node.localName ?: ""
            if (tag in setOf("p", "subtitle", "v", "text-author")) {
                val text = node.textContent.orEmpty().trim()
                if (text.isNotEmpty()) output.add(text)
                return
            }
            val nodes = node.childNodes
            for (i in 0 until nodes.length) visit(nodes.item(i))
        }
        val bodies = doc.getElementsByTagNameNS("*", "body")
        for (i in 0 until bodies.length) visit(bodies.item(i))
        val value = output.joinToString("\n").take(6 * 1024 * 1024)
        if (value.isBlank()) throw IOException("El libro FB2 no contiene texto legible.")
        return value
    }
}
