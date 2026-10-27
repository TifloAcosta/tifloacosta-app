package com.tifloacosta.nativeprototype

import android.content.Context
import android.net.Uri
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.IOException
import java.util.UUID
import java.util.zip.ZipEntry
import java.util.zip.ZipInputStream
import java.util.zip.ZipOutputStream

/**
 * Explicit, user-owned portable safety copy for debug-signature changes.
 * No cloud account, broad storage permission or hidden automatic upload.
 */
object NativeReaderBackup {
    const val ARCHIVE_NAME = "Copia TifloLector.zip"
    private const val SIGNATURE = "TIFLOLECTOR-PORTABLE-BACKUP-V1"
    private const val MAX_ENTRIES = 25000
    private const val MAX_TOTAL_BYTES = 3L * 1024 * 1024 * 1024
    private const val MAX_ENTRY_BYTES = 1024L * 1024 * 1024
    private val uuid = Regex("[a-f0-9-]{36}")
    private val source = Regex("[a-f0-9-]{36}\\.source\\.[a-z0-9]{2,8}")
    private val track = Regex("[a-f0-9-]{36}\\.\\d{3}\\.[A-Za-z0-9]{2,5}")
    private val ocrRoot = Regex("[a-f0-9-]{36}\\.ocr-(pdf|images)")
    private val ocrPart = Regex("(total|source)\\.txt|page-\\d{5}\\.txt")

    /** Paths are relative to the private library root, never absolute. */
    fun safeDataPath(relative: String): Boolean {
        val path = relative.replace('\\', '/')
        if (path != relative || path.startsWith('/') || path.contains("//")) return false
        val pieces = path.split('/')
        if (pieces.any { it == "." || it == ".." || it.isEmpty() }) return false
        if (pieces.size == 1) {
            val id = path.substringBefore('.')
            val extension = path.substringAfterLast('.', "").lowercase()
            return uuid.matches(id) && (path == "$id.txt" ||
                (source.matches(path) &&
                    (extension in NativeReaderFormats.supported || extension == "bin")) ||
                (track.matches(path) && extension in NativeReaderFormats.AUDIO_EXTENSIONS))
        }
        if (pieces.size == 2) {
            val parent = pieces[0]
            return ocrRoot.matches(parent) && ocrPart.matches(pieces[1])
        }
        return false
    }

    private fun bookId(relative: String): String = relative.substringBefore('.')

    fun export(context: Context, uri: Uri, onProgress: (Int, Int) -> Unit,
        keepWorking: () -> Boolean = { true }) {
        val directory = File(context.filesDir, "tiflolector-native")
        val store = NativeReaderStore(context.applicationContext)
        val books = store.list()
        val allowed = books.map { it.id }.toSet()
        val entries = directory.walkTopDown().filter { it.isFile }
            .mapNotNull { file ->
                val relative = file.relativeTo(directory).invariantSeparatorsPath
                relative.takeIf { safeDataPath(it) && bookId(it) in allowed }
                    ?.let { relative to file }
            }.sortedBy { it.first }.toList()
        if (entries.size > MAX_ENTRIES || entries.sumOf { it.second.length() } > MAX_TOTAL_BYTES)
            throw IOException("La biblioteca supera el límite de copia de seguridad (3 GB).")
        if (entries.any { it.second.length() > MAX_ENTRY_BYTES })
            throw IOException("Un documento supera el límite de copia de 1 GB.")
        val jsonNames = listOf("index.json", "folders.json", "reading-queue.json")
        val metadata = jsonNames.map { name ->
            name to (NativeReaderPersistence.read(File(directory, name)) ?: "[]")
        } + ("preferences.json" to exportPreferences(context))
        val dest = context.contentResolver.openOutputStream(uri, "w")
            ?: throw IOException("No se concedió permiso para guardar la copia.")
        dest.use { output ->
            ZipOutputStream(output.buffered()).use { zip ->
                fun write(name: String, body: ByteArray) {
                    zip.putNextEntry(ZipEntry(name))
                    zip.write(body)
                    zip.closeEntry()
                }
                write("manifest.txt", SIGNATURE.toByteArray(Charsets.UTF_8))
                metadata.forEach { (name, content) ->
                    write(name, content.toByteArray(Charsets.UTF_8))
                }
                entries.forEachIndexed { i, (name, file) ->
                    if (!keepWorking()) throw InterruptedException("Copia cancelada.")
                    zip.putNextEntry(ZipEntry("data/$name"))
                    file.inputStream().buffered().use { input ->
                        val bytes = ByteArray(32768)
                        while (true) {
                            if (!keepWorking()) throw InterruptedException("Copia cancelada.")
                            val n = input.read(bytes)
                            if (n < 0) break
                            zip.write(bytes, 0, n)
                        }
                    }
                    zip.closeEntry()
                    if (i % 10 == 0 || i + 1 == entries.size)
                        onProgress(i + 1, entries.size)
                }
            }
        }
    }

    /** Simple typed backup of voice, typography, per-book navigation and TTS settings. */
    private fun exportPreferences(context: Context): String {
        val prefs = context.getSharedPreferences("native-reader-preferences", 0)
        val json = JSONObject()
        for ((key, value) in prefs.all) {
            val entry = JSONObject()
            when (value) {
                is String -> entry.put("kind", "string").put("value", value)
                is Int -> entry.put("kind", "int").put("value", value)
                is Long -> entry.put("kind", "long").put("value", value)
                is Float -> entry.put("kind", "float").put("value", value.toDouble())
                is Boolean -> entry.put("kind", "bool").put("value", value)
                else -> continue
            }
            json.put(key, entry)
        }
        return json.toString()
    }

    /** Merge settings non-destructively: local preferences take priority. */
    private fun restorePreferences(context: Context, json: String) {
        val values = JSONObject(json)
        val prefs = context.getSharedPreferences("native-reader-preferences", 0)
        val editor = prefs.edit()
        val keys = values.keys()
        while (keys.hasNext()) {
            val key = keys.next()
            if (prefs.contains(key)) continue
            val entry = values.optJSONObject(key) ?: continue
            when (entry.optString("kind")) {
                "string" -> editor.putString(key, entry.optString("value"))
                "int" -> editor.putInt(key, entry.optInt("value"))
                "long" -> editor.putLong(key, entry.optLong("value"))
                "float" -> editor.putFloat(key, entry.optDouble("value").toFloat())
                "bool" -> editor.putBoolean(key, entry.optBoolean("value"))
            }
        }
        editor.apply()
    }

    data class RestoreResult(val added: Int, val skipped: Int, val folders: Int)

    /**
     * Restore as an ADDITIVE merge. Existing books and their files are never
     * overwritten. Validate the entire ZIP and stage into cache first.
     */
    fun restore(context: Context, uri: Uri, onProgress: (Int, Int) -> Unit,
        keepWorking: () -> Boolean = { true }): RestoreResult {
        val library = File(context.filesDir, "tiflolector-native").apply { mkdirs() }
        val staging = File(context.cacheDir, "reader-backup-" + UUID.randomUUID()).apply {
            if (!mkdirs()) throw IOException("No se pudo preparar la restauración.")
        }
        val blobs = HashMap<String, File>()
        val headers = HashMap<String, String>()
        var total = 0L
        var count = 0
        try {
            (context.contentResolver.openInputStream(uri)
                ?: throw IOException("No se pudo abrir la copia.")).use { stream ->
                ZipInputStream(stream.buffered()).use { zip ->
                    while (true) {
                        if (!keepWorking()) throw InterruptedException("Restauración cancelada.")
                        val entry = zip.nextEntry ?: break
                        count++
                        if (count > MAX_ENTRIES + 5) throw IOException("Demasiados archivos en la copia.")
                        val name = entry.name
                        if (entry.isDirectory || name.startsWith("/") ||
                            name.contains("\\") || name.split('/').any { it == ".." || it == "." })
                            throw IOException("La copia incluye una ruta peligrosa.")
                        if (name in listOf("manifest.txt", "index.json",
                                "folders.json", "reading-queue.json", "preferences.json")) {
                            if (name in headers) throw IOException("La copia tiene metadatos duplicados.")
                            val bytes = NativeReaderFormats.readBounded(zip, 16 * 1024 * 1024)
                            headers[name] = bytes.toString(Charsets.UTF_8)
                        } else if (name.startsWith("data/")) {
                            val path = name.removePrefix("data/")
                            if (!safeDataPath(path) || path in blobs)
                                throw IOException("La copia contiene un archivo no permitido.")
                            val target = File(staging, path)
                            target.parentFile?.mkdirs()
                            target.outputStream().use { output ->
                                val buffer = ByteArray(32768)
                                var size = 0L
                                while (true) {
                                    if (!keepWorking()) throw InterruptedException("Restauración cancelada.")
                                    val n = zip.read(buffer)
                                    if (n < 0) break
                                    size += n
                                    total += n
                                    if (size > MAX_ENTRY_BYTES || total > MAX_TOTAL_BYTES)
                                        throw IOException("La copia supera el límite de tamaño.")
                                    output.write(buffer, 0, n)
                                }
                            }
                            blobs[path] = target
                        } else throw IOException("Contenido desconocido en la copia.")
                        zip.closeEntry()
                        if (count % 10 == 0) onProgress(count, -1)
                    }
                }
            }
            if (headers["manifest.txt"] != SIGNATURE)
                throw IOException("El archivo no es una copia TifloLector compatible.")
            val incoming = JSONArray(headers["index.json"]
                ?: throw IOException("Falta el índice de libros en la copia."))
            val candidates = mutableListOf<JSONObject>()
            val seen = HashSet<String>()
            for (i in 0 until incoming.length()) {
                val obj = incoming.optJSONObject(i)
                    ?: throw IOException("Entrada de libro no válida en la copia.")
                val id = obj.optString("id")
                if (!uuid.matches(id) || !seen.add(id) || !blobs.containsKey("$id.txt"))
                    throw IOException("El índice de la copia contiene libros inválidos o incompletos.")
                val tracks = obj.optJSONArray("tracks") ?: JSONArray()
                for (n in 0 until tracks.length()) {
                    val name = tracks.optString(n)
                    if (!track.matches(name) || bookId(name) != id || !blobs.containsKey(name))
                        throw IOException("Faltan archivos de audio de un libro en esta copia.")
                }
                candidates.add(obj)
            }
            val incomingFolders = JSONArray(headers["folders.json"] ?: "[]")
            val incomingQueue = JSONArray(headers["reading-queue.json"] ?: "[]")
            return synchronized(NativeReaderPersistence.lock) {
                val store = NativeReaderStore(context.applicationContext)
                val existing = store.list().map { it.id }.toSet()
                val toAdd = candidates.filterNot { it.optString("id") in existing }
                val selected = toAdd.map { it.optString("id") }.toSet()
                val copied = mutableListOf<File>()
                var committed = false
                try {
                    for ((name, staged) in blobs) {
                        if (!keepWorking()) throw InterruptedException("Restauración cancelada.")
                        if (bookId(name) !in selected) continue
                        val dest = File(library, name)
                        if (dest.exists()) throw IOException("Ya existe un archivo con ese identificador.")
                        dest.parentFile?.mkdirs()
                        staged.copyTo(dest, overwrite = false)
                        copied.add(dest)
                    }
                    val indexFile = File(library, "index.json")
                    val current = JSONArray(NativeReaderPersistence.read(indexFile) ?: "[]")
                    for (entry in toAdd) current.put(entry)
                    NativeReaderPersistence.write(indexFile, current.toString())
                    committed = true
                    val folderFile = File(library, "folders.json")
                    val originalFolders = JSONArray(NativeReaderPersistence.read(folderFile) ?: "[]")
                    val mergedFolders = mutableListOf<String>()
                    for (array in listOf(originalFolders, incomingFolders)) {
                        for (i in 0 until array.length()) {
                            val value = array.optString(i)
                            if (value.isNotBlank() && value.length <= 70 &&
                                mergedFolders.none { it.equals(value, ignoreCase = true) })
                                mergedFolders.add(value)
                        }
                    }
                    NativeReaderPersistence.write(folderFile, JSONArray(mergedFolders).toString())
                    val queueFile = File(library, "reading-queue.json")
                    val originalQueue = JSONArray(NativeReaderPersistence.read(queueFile) ?: "[]")
                    val mergedQueue = mutableListOf<String>()
                    for (array in listOf(originalQueue, incomingQueue)) {
                        for (i in 0 until array.length()) {
                            val id = array.optString(i)
                            if (uuid.matches(id) && (id in existing || id in selected) &&
                                id !in mergedQueue) mergedQueue.add(id)
                        }
                    }
                    NativeReaderPersistence.write(queueFile, JSONArray(mergedQueue).toString())
                    restorePreferences(context, headers["preferences.json"] ?: "{}")
                    RestoreResult(toAdd.size, candidates.size - toAdd.size, mergedFolders.size)
                } catch (e: Exception) {
                    // Before index commit no restored book is visible to the library.
                    if (!committed) copied.forEach { it.delete() }
                    throw e
                }
            }
        } finally { staging.deleteRecursively() }
    }
}
