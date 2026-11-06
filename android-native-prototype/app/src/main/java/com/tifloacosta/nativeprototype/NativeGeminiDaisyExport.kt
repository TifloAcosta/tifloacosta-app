package com.tifloacosta.nativeprototype

import android.content.Context
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import java.io.ByteArrayOutputStream
import java.util.UUID
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

/** DAISY 3 text/audio with genuine per-segment synchronization. */
internal object NativeGeminiDaisyExport {
    private fun xml(text: String) = text.replace("&", "&amp;").replace("<", "&lt;")
        .replace(">", "&gt;").replace("\"", "&quot;").replace("'", "&apos;")

    private fun clock(seconds: Double): String {
        val hours = seconds.toInt() / 3600
        val minutes = (seconds.toInt() / 60) % 60
        val remainder = seconds - (hours * 3600 + minutes * 60)
        return "%02d:%02d:%06.3f".format(java.util.Locale.ROOT, hours, minutes, remainder)
    }


    internal data class TextUnit(val text: String, val heading: String? = null)

    /** Detect only headings explicitly preserved in extracted text, without guessing. */
    internal fun units(text: String): List<TextUnit> {
        NativeGeminiAudioExport.chunks(text) // Reject empty/oversized documents.
        val headingPattern = Regex(
            "^(?:#{1,6}[ \t]+|(?:capítulo|capitulo|sección|seccion)[ \t]+[0-9IVXLCDM]+(?:[.: -]|$))",
            RegexOption.IGNORE_CASE
        )
        val result = mutableListOf<TextUnit>()
        val lines = text.split("\n")
        lines.forEachIndexed { index, line ->
            val full = line + if (index == lines.lastIndex) "" else "\n"
            val recognized = line.trim().matchesHeading(headingPattern)
            if (recognized && line.isNotBlank()) {
                result += TextUnit(full, line.trim())
            } else if (full.isNotEmpty()) {
                if (result.isNotEmpty() && result.last().heading == null &&
                    result.last().text.length + full.length <= NativeGeminiAudioExport.CHUNK_SIZE) {
                    val previous = result.removeAt(result.lastIndex)
                    result += TextUnit(previous.text + full)
                } else if (full.length <= NativeGeminiAudioExport.CHUNK_SIZE) {
                    result += TextUnit(full)
                } else {
                    NativeGeminiAudioExport.chunks(full).forEach { result += TextUnit(it) }
                }
            }
        }
        return result
    }

    private fun String.matchesHeading(pattern: Regex) = pattern.containsMatchIn(this)

    suspend fun generate(context: Context, text: String, title: String, voice: String,
                         progress: suspend (Int, Int) -> Unit): ByteArray {
        val parts = units(text)
        val identifier = "urn:uuid:" + UUID.randomUUID().toString()
        val escapedTitle = xml(title)
        val written = mutableListOf<String>()
        val parallel = mutableListOf<String>()
        val manifest = mutableListOf<String>()
        val soundFiles = mutableListOf<Pair<String, ByteArray>>()
        var duration = 0.0
        val chapterPoints = mutableListOf<Pair<String, String>>()
        var firstPar = ""
        parts.forEachIndexed { index, fragment ->
            currentCoroutineContext().ensureActive()
            val spoken = fragment.text.trim()
            if (spoken.isNotEmpty()) {
                val number = index + 1
                val filename = "audio%04d.wav".format(java.util.Locale.ROOT, number)
                val wav = NativeGeminiSpeech.generate(context, spoken, voice)
                val pcm = NativeGeminiAudioExport.pcm(wav)
                val seconds = pcm.size.toDouble() / 48000.0
                require(seconds > 0) { "El fragmento de audio está vacío." }
                duration += seconds
                val id = "t$number"
                val par = "par$number"
                if (firstPar.isEmpty()) firstPar = par
                fragment.heading?.let { chapterPoints += it to par }
                written += "<p id=\"$id\" smilref=\"sync.smil#$par\">" + xml(fragment.text) + "</p>"
                parallel += "<par id=\"$par\"><text src=\"book.xml#$id\"/>" +
                    "<audio src=\"$filename\" clipBegin=\"00:00:00\" " +
                    "clipEnd=\"" + clock(seconds) + "\"/></par>"
                manifest += "<item id=\"audio$number\" href=\"$filename\" media-type=\"audio/x-wav\"/>"
                soundFiles += filename to wav
            }
            progress(index + 1, parts.size)
        }
        currentCoroutineContext().ensureActive()
        require(parallel.isNotEmpty()) { "No se ha generado audio." }
        val first = "par" + (parts.indexOfFirst { it.isNotBlank() } + 1)
        val total = clock(duration)
        val dtbook = """
            <?xml version="1.0" encoding="utf-8"?>
            <!DOCTYPE dtbook PUBLIC "-//NISO//DTD dtbook 2005-1//EN" "http://www.daisy.org/z3986/2005/dtbook-2005-1.dtd">
            <dtbook xmlns="http://www.daisy.org/z3986/2005/dtbook/" version="2005-1" xml:lang="es">
              <head><meta name="dc:Identifier" content="$identifier"/><meta name="dc:Title" content="$escapedTitle"/></head>
              <book><frontmatter><doctitle>$escapedTitle</doctitle></frontmatter>
              <bodymatter><level1><h1>$escapedTitle</h1>
              PLACEHOLDER_UNITS
              </level1></bodymatter></book>
            </dtbook>
        """.trimIndent().replace("PLACEHOLDER_UNITS", written.joinToString("\n"))
        val smil = """
            <?xml version="1.0" encoding="utf-8"?>
            <!DOCTYPE smil PUBLIC "-//NISO//DTD dtbsmil 2005-1//EN" "http://www.daisy.org/z3986/2005/dtbsmil-2005-1.dtd">
            <smil xmlns="http://www.w3.org/2001/SMIL20/" version="2005-1">
            <head><meta name="dc:format" content="ANSI/NISO Z39.86-2005"/></head>
            <body><seq id="seq1">PLACEHOLDER_PARS</seq></body></smil>
        """.trimIndent().replace("PLACEHOLDER_PARS", parallel.joinToString("\n"))
        val chapterNav = chapterPoints.mapIndexed { index, (name, target) ->
            "<navPoint id=\"chapter${index + 1}\" class=\"h2\" playOrder=\"${index + 2}\">" +
                "<navLabel><text>" + xml(name) + "</text></navLabel>" +
                "<content src=\"sync.smil#" + target + "\"/></navPoint>"
        }.joinToString("\n")
        val ncx = """
            <?xml version="1.0" encoding="utf-8"?>
            <!DOCTYPE ncx PUBLIC "-//NISO//DTD ncx 2005-1//EN" "http://www.daisy.org/z3986/2005/ncx-2005-1.dtd">
            <ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1" xml:lang="es">
            <head><meta name="dtb:uid" content="$identifier"/>
            <meta name="dtb:depth" content="DEPTH"/><meta name="dtb:totalPageCount" content="0"/>
            <meta name="dtb:maxPageNumber" content="0"/><meta name="dtb:totalTime" content="TOTALTIME"/></head>
            <docTitle><text>$escapedTitle</text></docTitle>
            <navMap><navPoint id="nav1" class="h1" playOrder="1">
            <navLabel><text>$escapedTitle</text></navLabel><content src="sync.smil#FIRST_PAR"/>
            CHAPTER_NAV
            </navPoint></navMap></ncx>
        """.trimIndent().replace("TOTALTIME", total)
            .replace("DEPTH", if (chapterPoints.isEmpty()) "1" else "2")
            .replace("FIRST_PAR", firstPar)
            .replace("CHAPTER_NAV", chapterNav)
        val opf = """
            <?xml version="1.0" encoding="utf-8"?>
            <!DOCTYPE package PUBLIC "+//ISBN 0-9673008-1-9//DTD OEB 1.2 Package//EN" "http://openebook.org/dtds/oeb-1.2/oebpkg12.dtd">
            <package xmlns="http://openebook.org/namespaces/oeb-package/1.0/" unique-identifier="bookid">
            <metadata><dc-metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
            <dc:Identifier id="bookid">$identifier</dc:Identifier>
            <dc:Title>$escapedTitle</dc:Title><dc:Language>es</dc:Language>
            <dc:Format>ANSI/NISO Z39.86-2005</dc:Format></dc-metadata>
            <x-metadata><meta name="dtb:multimediaType" content="audioFullText"/>
            <meta name="dtb:multimediaContent" content="audio,text"/>
            <meta name="dtb:totalTime" content="TOTALTIME"/></x-metadata></metadata>
            <manifest>
            <item id="opf" href="book.opf" media-type="text/xml"/>
            <item id="ncx" href="book.ncx" media-type="application/x-dtbncx+xml"/>
            <item id="text" href="book.xml" media-type="application/x-dtbook+xml"/>
            <item id="sync" href="sync.smil" media-type="application/smil"/>
            PLACEHOLDER_MANIFEST
            </manifest><spine toc="ncx"><itemref idref="sync"/></spine></package>
        """.trimIndent().replace("TOTALTIME", total)
            .replace("PLACEHOLDER_MANIFEST", manifest.joinToString("\n"))
        return ByteArrayOutputStream().use { bytes ->
            ZipOutputStream(bytes).use { zip ->
                fun add(name: String, data: ByteArray) {
                    zip.putNextEntry(ZipEntry(name))
                    zip.write(data)
                    zip.closeEntry()
                }
                for ((name, value) in listOf(
                    "book.opf" to opf, "book.xml" to dtbook,
                    "book.ncx" to ncx, "sync.smil" to smil
                )) add(name, value.toByteArray(Charsets.UTF_8))
                soundFiles.forEach { (name, audio) ->
                    currentCoroutineContext().ensureActive()
                    add(name, audio)
                }
            }
            bytes.toByteArray()
        }
    }
}
