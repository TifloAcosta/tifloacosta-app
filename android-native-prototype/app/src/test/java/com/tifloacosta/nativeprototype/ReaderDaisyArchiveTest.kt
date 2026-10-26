package com.tifloacosta.nativeprototype

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.io.FileOutputStream
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

class ReaderDaisyArchiveTest {
    @Test fun protectsPathsAndSortsNumericTracks() {
        assertEquals(null, NativeReaderArchives.validLogicalPath("../sdcard/audio.mp3"))
        assertEquals(null, NativeReaderArchives.validLogicalPath("/absolute/file.mp3"))
        assertEquals(null, NativeReaderArchives.validLogicalPath("C:\\temp\\foo.mp3"))
        assertEquals("books/track.mp3",
            NativeReaderArchives.validLogicalPath("books\\track.mp3"))
        val files = listOf("p10.mp3", "p2.mp3", "p1.mp3")
        assertEquals(listOf("p1.mp3", "p2.mp3", "p10.mp3"),
            files.sortedBy { NativeReaderArchives.naturalKey(it) })
    }

    @Test fun smilAndNccControlAudioOrderAndClipBoundaries() {
        val folder = java.nio.file.Files.createTempDirectory("reader-daisy-").toFile()
        try {
            var counter = 0
            fun put(value: String): File {
                val file = File(folder, "test-" + counter++)
                file.writeText(value)
                return file
            }
            val files = linkedMapOf<String, File>(
                "book/ncc.html" to put("""
                    <html><body>
                      <a href="ch2.smil#fragment">Capítulo segundo</a>
                      <a href="ch1.smil#fragment">Capítulo primero</a>
                    </body></html>
                """.trimIndent()),
                "book/ch1.smil" to put("""
                    <smil xmlns="http://www.w3.org/2001/SMIL20/Language">
                      <body><seq><par>
                        <audio src="p1.mp3" clipBegin="npt=1.25s" clipEnd="npt=3.5s"/>
                      </par></seq></body>
                    </smil>
                """.trimIndent()),
                "book/ch2.smil" to put("""
                    <smil xmlns="http://www.w3.org/2001/SMIL20/Language">
                      <body><seq>
                        <audio src="p2.mp3" clip-begin="npt=0s" clip-end="npt=1.25s"/>
                        <audio src="p2.mp3" clip-begin="npt=1.25s" clip-end="npt=2.5s"/>
                      </seq></body>
                    </smil>
                """.trimIndent()),
                "book/p1.mp3" to put("dummy"),
                "book/p2.mp3" to put("dummy")
            )
            val plan = NativeReaderDaisy.plan(files)
            assertTrue(plan.daisy)
            assertEquals(listOf("book/p2.mp3", "book/p1.mp3"), plan.audioPaths)
            assertEquals(3, plan.segments.size)
            assertEquals(0, plan.segments[0].fileIndex)
            assertEquals(0, plan.segments[1].fileIndex)
            assertEquals(1, plan.segments[2].fileIndex)
            assertEquals(1250, plan.segments[1].startMs)
            assertEquals(3500, plan.segments[2].endMs)
        } finally { folder.deleteRecursively() }
    }

    @Test fun zipDaisyIsExtractedWithoutFollowingArchivePaths() {
        val archive = File.createTempFile("reader-zip-", ".zip")
        val staging = java.nio.file.Files.createTempDirectory("reader-stage-").toFile()
        try {
            ZipOutputStream(FileOutputStream(archive)).use { zip ->
                for ((name, body) in listOf(
                    "book/p2.mp3" to "second",
                    "book/p1.mp3" to "first",
                    "../private.mp3" to "never write here",
                    "book/ncc.html" to "<html>Book</html>"
                )) {
                    zip.putNextEntry(ZipEntry(name))
                    zip.write(body.toByteArray())
                    zip.closeEntry()
                }
            }
            val entries = NativeReaderArchives.extract(archive, "zip", staging)
            assertEquals(3, entries.size)
            assertFalse(entries.keys.any { it.contains("..") })
            assertTrue(entries.values.all { it.canonicalPath.startsWith(staging.canonicalPath) })
            val plan = NativeReaderDaisy.plan(entries)
            assertEquals(listOf("book/p1.mp3", "book/p2.mp3"), plan.audioPaths)
        } finally { archive.delete(); staging.deleteRecursively() }
    }

    @Test fun recognizesTimeFormats() {
        assertEquals(2350, NativeReaderDaisy.clock("npt=2.35s"))
        assertEquals(61000, NativeReaderDaisy.clock("0:01:01"))
        assertEquals(-1, NativeReaderDaisy.clock("invalid"))
    }
}
