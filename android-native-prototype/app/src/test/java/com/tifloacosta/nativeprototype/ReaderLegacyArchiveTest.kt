package com.tifloacosta.nativeprototype

import org.apache.commons.compress.archivers.sevenz.SevenZOutputFile
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.nio.file.Files
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

/** End-to-end archives with Office-like legacy and ebook entry names. */
class ReaderLegacyArchiveTest {
    @Test fun sevenZipArchiveContainsBookFileWithPathNotUsedAsDiskDestination() {
        val source = Files.createTempFile("tiflo-sevenzip-", ".7z").toFile()
        val stage = Files.createTempDirectory("tiflo-sevenzip-stage-").toFile()
        try {
            SevenZOutputFile(source).use { seven ->
                val original = File(stage, "source.txt")
                original.writeText("Un libro de prueba en 7Z")
                val entry = seven.createArchiveEntry(original, "libros/lectura.txt")
                seven.putArchiveEntry(entry)
                seven.write(original.readBytes())
                seven.closeArchiveEntry()
                seven.finish()
            }
            val unpacked = NativeReaderArchives.extract(source, "7z", stage)
            assertTrue(unpacked.containsKey("libros/lectura.txt"))
            assertEquals("Un libro de prueba en 7Z",
                unpacked.getValue("libros/lectura.txt").readText())
            assertTrue(unpacked.values.all { it.canonicalPath.startsWith(stage.canonicalPath) })
        } finally {
            source.delete()
            stage.deleteRecursively()
        }
    }

    @Test fun compressedOlderDocumentsAreRecognizedButDoNotEscapeTempDirectory() {
        val source = Files.createTempFile("tiflo-legacy-", ".zip").toFile()
        val stage = Files.createTempDirectory("tiflo-legacy-stage-").toFile()
        try {
            ZipOutputStream(source.outputStream()).use { out ->
                for ((name, contents) in mapOf(
                    "libros/antiguo.doc" to "documento",
                    "libros/antiguo.pps" to "presentación",
                    "libros/prueba.mobi" to "libro",
                    "../fuera.xls" to "no permitir",
                    "datos/tabla.xls" to "hoja"
                )) {
                    out.putNextEntry(ZipEntry(name))
                    out.write(contents.toByteArray())
                    out.closeEntry()
                }
            }
            val files = NativeReaderArchives.extract(source, "zip", stage)
            assertTrue(files.containsKey("libros/antiguo.doc"))
            assertTrue(files.containsKey("libros/antiguo.pps"))
            assertTrue(files.containsKey("libros/prueba.mobi"))
            assertTrue(files.containsKey("datos/tabla.xls"))
            assertFalse(files.keys.any { it.startsWith("..") })
        } finally { source.delete(); stage.deleteRecursively() }
    }
}
