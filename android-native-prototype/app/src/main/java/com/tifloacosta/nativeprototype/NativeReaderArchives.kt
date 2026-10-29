package com.tifloacosta.nativeprototype

import com.github.junrar.Archive
import org.apache.commons.compress.archivers.sevenz.SevenZFile
import java.io.BufferedInputStream
import java.io.BufferedOutputStream
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.IOException
import java.io.InputStream
import java.io.OutputStream
import java.util.Locale
import java.util.zip.ZipInputStream

/**
 * Staged archive extraction for audio books: all members are stored under
 * GENERATED filenames in a private temporary directory. Archive names never
 * become filesystem paths; all limits apply to *uncompressed* data.
 */
object NativeReaderArchives {
    const val MAX_SOURCE_BYTES = 1024L * 1024L * 1024L
    private const val MAX_MEMBER_BYTES = 400L * 1024L * 1024L
    private const val MAX_EXPANDED_BYTES = 1536L * 1024L * 1024L
    private const val MAX_ENTRIES = 4000

    fun validLogicalPath(path: String): String? {
        val name = path.replace('\\', '/').trim()
        if (name.isBlank() || name.startsWith('/') || name.startsWith("~/") ||
            Regex("^[A-Za-z]:").containsMatchIn(name) ||
            name.split('/').any { it == ".." || it == "." }) return null
        return name
    }

    fun naturalKey(path: String): String {
        return Regex("\\d+").replace(path.lowercase(Locale.ROOT)) {
            it.value.padStart(12, '0')
        }
    }

    fun copyBounded(from: InputStream, into: OutputStream, maximum: Long): Long {
        val buffer = ByteArray(32768)
        var count = 0L
        while (true) {
            if (Thread.currentThread().isInterrupted) throw IOException("Importación interrumpida.")
            val n = from.read(buffer)
            if (n < 0) return count
            if (n == 0) continue
            count += n
            if (count > maximum) throw IOException("El archivo supera el límite de tamaño.")
            into.write(buffer, 0, n)
        }
    }

    fun extract(file: File, kind: String, staging: File, status: ((Int) -> Unit)? = null):
        LinkedHashMap<String, File> {
        if (file.length() <= 0 || file.length() > MAX_SOURCE_BYTES) {
            throw IOException("El comprimido está vacío o supera 1 GB.")
        }
        if (!staging.isDirectory && !staging.mkdirs()) {
            throw IOException("No se pudo preparar la carpeta de extracción.")
        }
        val output = linkedMapOf<String, File>()
        var extracted = 0L
        var attempted = 0

        fun accept(name: String, stream: InputStream) {
            attempted++
            if (attempted > MAX_ENTRIES) throw IOException("El archivo tiene demasiadas entradas.")
            val logical = validLogicalPath(name) ?: return
            if (output.containsKey(logical)) return
            // Only import book contents, not executables, metadata caches or nested archives.
            val suffix = logical.substringAfterLast('.', "").lowercase(Locale.ROOT)
            val allowed = NativeReaderFormats.AUDIO_EXTENSIONS + setOf(
                "txt", "md", "markdown", "html", "htm", "xhtml",
                "xml", "smil", "smi", "ncx", "opf", "fb2", "rtf",
                "docx", "pptx", "ppsx", "xlsx", "odt", "ods", "odp",
                "epub", "pdf", "jpg", "jpeg", "png", "webp",
                "doc", "xls", "ppt", "pps", "mobi", "prc", "pdb", "azw", "azw3"
            )
            if (suffix !in allowed) return
            val temp = File(staging, "member-" + attempted.toString().padStart(5, '0'))
            try {
                BufferedOutputStream(FileOutputStream(temp)).use { sink ->
                    var consumed = 0L
                    val buffer = ByteArray(32768)
                    while (true) {
                        if (Thread.currentThread().isInterrupted)
                            throw IOException("Importación interrumpida.")
                        val count = stream.read(buffer)
                        if (count < 0) break
                        if (count == 0) continue
                        consumed += count
                        extracted += count
                        if (consumed > MAX_MEMBER_BYTES || extracted > MAX_EXPANDED_BYTES)
                            throw IOException("El archivo descomprimido supera los límites de seguridad.")
                        sink.write(buffer, 0, count)
                    }
                }
                output[logical] = temp
                status?.invoke(output.size)
            } catch (e: Exception) {
                temp.delete()
                throw e
            }
        }

        fun drainSafely(input: InputStream) {
            var own = 0L
            val buffer = ByteArray(32768)
            while (true) {
                if (Thread.currentThread().isInterrupted)
                    throw IOException("Importación interrumpida.")
                val n = input.read(buffer)
                if (n < 0) break
                if (n == 0) continue
                own += n
                extracted += n
                if (own > MAX_MEMBER_BYTES || extracted > MAX_EXPANDED_BYTES) {
                    throw IOException("El comprimido contiene una entrada demasiado grande.")
                }
            }
        }

        try {
            when (kind.lowercase(Locale.ROOT)) {
                "zip", "daisy" -> {
                    ZipInputStream(BufferedInputStream(FileInputStream(file))).use { zip ->
                        var totalEntries = 0
                        while (true) {
                            val entry = zip.nextEntry ?: break
                            totalEntries++
                            if (totalEntries > MAX_ENTRIES)
                                throw IOException("Demasiadas entradas en el ZIP.")
                            if (!entry.isDirectory) {
                                val before = output.size
                                accept(entry.name, zip)
                                // Even skipped files must be consumed under size limits:
                                // closeEntry() alone may otherwise inflate a ZIP bomb.
                                if (output.size == before) drainSafely(zip)
                            }
                            zip.closeEntry()
                        }
                    }
                }
                "7z" -> {
                    SevenZFile.builder().setFile(file)
                        .setMaxMemoryLimitKiB(64 * 1024).get().use { seven ->
                            while (true) {
                                val entry = seven.nextEntry ?: break
                                if (!entry.isDirectory && entry.name != null) {
                                    val stream = object : InputStream() {
                                        override fun read(): Int {
                                            val one = ByteArray(1)
                                            return if (read(one, 0, 1) < 0) -1
                                                else one[0].toInt() and 255
                                        }
                                        override fun read(b: ByteArray, off: Int, len: Int): Int =
                                            seven.read(b, off, len)
                                    }
                                    accept(entry.name, stream)
                                }
                            }
                        }
                }
                "rar" -> {
                    Archive(file).use { rar ->
                        for (header in rar.fileHeaders) {
                            if (header.isDirectory) continue
                            val name = header.fileName ?: continue
                            // Write directly through a bounded sink; never let the
                            // extractor materialize the entire member in RAM.
                            attempted++
                            if (attempted > MAX_ENTRIES)
                                throw IOException("El archivo tiene demasiadas entradas.")
                            val logical = validLogicalPath(name) ?: continue
                            if (output.containsKey(logical)) continue
                            val suffix = logical.substringAfterLast('.', "").lowercase(Locale.ROOT)
                            if (suffix !in (NativeReaderFormats.AUDIO_EXTENSIONS + setOf(
                                "txt","md","markdown","html","htm","xhtml","xml",
                                "smil","smi","ncx","opf","fb2","rtf","docx",
                                "pptx","ppsx","xlsx","odt","ods","odp","epub","pdf",
                                "doc","xls","ppt","pps","mobi","prc","pdb","azw","azw3"
                            ))) continue
                            if (header.fullUnpackSize > MAX_MEMBER_BYTES)
                                throw IOException("Una entrada del RAR supera 400 MB.")
                            val temp = File(staging, "member-" + attempted.toString().padStart(5, '0'))
                            try {
                                BufferedOutputStream(FileOutputStream(temp)).use { raw ->
                                    val capped = object : OutputStream() {
                                        var own = 0L
                                        override fun write(b: Int) {
                                            own++; extracted++
                                            if (own > MAX_MEMBER_BYTES || extracted > MAX_EXPANDED_BYTES)
                                                throw IOException("RAR demasiado grande al descomprimir.")
                                            raw.write(b)
                                        }
                                        override fun write(bytes: ByteArray, off: Int, len: Int) {
                                            own += len; extracted += len
                                            if (own > MAX_MEMBER_BYTES || extracted > MAX_EXPANDED_BYTES)
                                                throw IOException("RAR demasiado grande al descomprimir.")
                                            raw.write(bytes, off, len)
                                        }
                                    }
                                    rar.extractFile(header, capped)
                                }
                                output[logical] = temp
                                status?.invoke(output.size)
                            } catch (e: Exception) {
                                temp.delete()
                                throw IOException("No se pudo extraer una pista del RAR.", e)
                            }
                        }
                    }
                }
                else -> throw IOException("Comprimido no compatible: .$kind.")
            }
        } catch (e: Exception) {
            staging.listFiles()?.forEach { it.delete() }
            throw if (e is IOException) e
                else IOException("El comprimido está dañado, protegido o no se puede extraer.", e)
        }
        if (output.isEmpty()) throw IOException("No contiene texto o audio compatibles.")
        return LinkedHashMap(output)
    }
}
