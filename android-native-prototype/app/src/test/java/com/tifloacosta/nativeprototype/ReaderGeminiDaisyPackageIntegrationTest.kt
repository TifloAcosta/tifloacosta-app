package com.tifloacosta.nativeprototype

import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.ByteArrayInputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.zip.ZipInputStream
import javax.xml.parsers.DocumentBuilderFactory
import org.w3c.dom.Document

class ReaderGeminiDaisyPackageIntegrationTest {
    private fun wav(): ByteArray {
        val pcm = ByteArray(4800) // 0.1 seconds at 24,000 Hz, 16 bit mono
        return ByteBuffer.allocate(44 + pcm.size).order(ByteOrder.LITTLE_ENDIAN)
            .put("RIFF".toByteArray()).putInt(36 + pcm.size)
            .put("WAVEfmt ".toByteArray()).putInt(16)
            .putShort(1.toShort()).putShort(1.toShort())
            .putInt(24000).putInt(48000)
            .putShort(2.toShort()).putShort(16.toShort())
            .put("data".toByteArray()).putInt(pcm.size).put(pcm).array()
    }

    private fun entries(bytes: ByteArray): Map<String, ByteArray> {
        val files = mutableMapOf<String, ByteArray>()
        ZipInputStream(ByteArrayInputStream(bytes)).use { archive ->
            while (true) {
                val entry = archive.nextEntry ?: break
                files[entry.name] = archive.readBytes()
                archive.closeEntry()
            }
        }
        return files
    }

    private fun parse(xml: ByteArray): Document {
        val text = xml.toString(Charsets.UTF_8)
            .replace(Regex("<!DOCTYPE[^>]*>"), "")
        val parser = DocumentBuilderFactory.newInstance()
        parser.isNamespaceAware = true
        parser.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true)
        parser.setFeature("http://xml.org/sax/features/external-general-entities", false)
        return parser.newDocumentBuilder().parse(ByteArrayInputStream(text.toByteArray()))
    }

    @Test fun exportedZipHasRealAudioAndResolvableManifestSmilNcxLinks() = runBlocking {
        val input = "## Capítulo primero\nUna frase.\nCapítulo 2: Segundo\nOtra frase."
        val generated = NativeGeminiDaisyExport.generateWithSynthesizer(
            input, "Libro de prueba", "Kore", { _, _ -> Unit },
            { _, _ -> wav() }
        )
        val files = entries(generated)
        for (required in listOf("book.opf", "book.xml", "book.ncx", "sync.smil")) {
            assertTrue("Missing $required", files.containsKey(required))
            parse(files.getValue(required))
        }
        val opf = parse(files.getValue("book.opf"))
        val ncx = parse(files.getValue("book.ncx"))
        val smil = parse(files.getValue("sync.smil"))
        val book = parse(files.getValue("book.xml"))
        val nodes = ncx.getElementsByTagNameNS("*", "navPoint")
        val pars = smil.getElementsByTagNameNS("*", "par")
        assertEquals(3, nodes.length) // Book plus two explicit chapters
        assertTrue(pars.length >= 2)
        val smilIDs = (0 until pars.length).map { pars.item(it).attributes.getNamedItem("id").nodeValue }.toSet()
        val textIDs = (0 until book.getElementsByTagName("*").length)
            .mapNotNull { book.getElementsByTagName("*").item(it).attributes?.getNamedItem("id")?.nodeValue }.toSet()
        val manifest = opf.getElementsByTagNameNS("*", "item")
        for (i in 0 until manifest.length) {
            val href = manifest.item(i).attributes.getNamedItem("href").nodeValue
            assertTrue("Missing referenced file $href", href in files)
        }
        val smilTextRefs = smil.getElementsByTagNameNS("*", "text")
        for (i in 0 until smilTextRefs.length) {
            val ref = smilTextRefs.item(i).attributes.getNamedItem("src").nodeValue
            assertTrue(ref.startsWith("book.xml#"))
            assertTrue(ref.substringAfter("#") in textIDs)
        }
        val smilAudioRefs = smil.getElementsByTagNameNS("*", "audio")
        for (i in 0 until smilAudioRefs.length) {
            val ref = smilAudioRefs.item(i).attributes.getNamedItem("src").nodeValue
            assertTrue(ref in files)
            assertTrue(files.getValue(ref).take(4).toByteArray().contentEquals("RIFF".toByteArray()))
            val clock = smilAudioRefs.item(i).attributes.getNamedItem("clipEnd").nodeValue
            assertTrue(clock.startsWith("00:00:00.100"))
        }
        val navTargets = ncx.getElementsByTagNameNS("*", "content")
        for (i in 0 until navTargets.length) {
            val src = navTargets.item(i).attributes.getNamedItem("src").nodeValue
            assertTrue(src.startsWith("sync.smil#"))
            assertTrue(src.substringAfter("#") in smilIDs)
        }
    }
}
