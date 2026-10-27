package com.tifloacosta.nativeprototype

import android.content.Context
import org.json.JSONArray
import java.io.File
import java.io.IOException
import java.util.Locale

/** Rules tested independently from Android storage. */
object ReaderLibraryRules {
    fun folderName(value: String): String {
        val name = value.trim().replace(Regex("[\\p{Cntrl}\\\\/]"), " ").trim()
        if (name.isBlank()) throw IOException("El nombre de la carpeta está vacío.")
        if (name.length > 70) throw IOException("La carpeta no puede superar 70 caracteres.")
        if (name.equals("__none__", true)) throw IOException("Nombre de carpeta reservado.")
        return name
    }
    fun move(values: List<String>, id: String, delta: Int): List<String> {
        val result = values.toMutableList()
        val from = result.indexOf(id)
        if (from < 0) return values
        val to = (from + delta).coerceIn(0, result.lastIndex)
        if (to != from) {
            val item = result.removeAt(from)
            result.add(to, item)
        }
        return result
    }
}

/** Durable empty folders and ordered reading queue, independently of book contents. */
class NativeReaderOrganization(context: Context) {
    private val directory = File(context.filesDir, "tiflolector-native").apply { mkdirs() }
    private val foldersFile = File(directory, "folders.json")
    private val queueFile = File(directory, "reading-queue.json")
    private val idFormat = Regex("[a-f0-9-]{36}")

    private fun readArray(file: File): List<String> {
        if (!file.isFile) return emptyList()
        return try {
            val json = JSONArray(file.readText(Charsets.UTF_8))
            (0 until json.length()).mapNotNull { json.optString(it).takeIf(String::isNotBlank) }
        } catch (_: Exception) { emptyList() }
    }
    private fun writeArray(file: File, values: List<String>) {
        val temp = File(directory, file.name + ".tmp")
        temp.writeText(JSONArray(values).toString(), Charsets.UTF_8)
        if (!temp.renameTo(file)) {
            file.writeText(JSONArray(values).toString(), Charsets.UTF_8)
            temp.delete()
        }
    }
    fun cleanedFolderName(value: String): String = ReaderLibraryRules.folderName(value)
    @Synchronized fun folders(existingBooks: List<ReaderBook>): List<String> {
        // Older versions had folder labels exclusively stored on each book.
        val old = existingBooks.map { it.folder }.filter { it.isNotBlank() }
        return (readArray(foldersFile) + old).distinctBy { it.lowercase(Locale.ROOT) }
            .sortedWith(String.CASE_INSENSITIVE_ORDER)
    }
    @Synchronized fun createFolder(requested: String, existingBooks: List<ReaderBook>): String {
        val name = cleanedFolderName(requested)
        if (folders(existingBooks).any { it.equals(name, true) })
            throw IOException("Ya existe una carpeta con ese nombre.")
        writeArray(foldersFile, readArray(foldersFile) + name)
        return name
    }
    /** Name change is committed to book index before changing the directory list. */
    @Synchronized fun renameFolder(oldName: String, newName: String, store: NativeReaderStore) {
        val name = cleanedFolderName(newName)
        val current = folders(store.list())
        if (oldName !in current) throw IOException("No se encontró la carpeta.")
        if (current.any { it.equals(name, true) && it != oldName })
            throw IOException("Ya existe una carpeta con ese nombre.")
        store.replaceFolder(oldName, name)
        val retained = readArray(foldersFile).filterNot { it == oldName } + name
        writeArray(foldersFile, retained.distinctBy { it.lowercase(Locale.ROOT) })
    }
    @Synchronized fun deleteFolder(name: String, store: NativeReaderStore) {
        if (name !in folders(store.list())) throw IOException("Carpeta no encontrada.")
        // Deleting a folder NEVER deletes books; they become 'Sin carpeta'.
        store.replaceFolder(name, "")
        writeArray(foldersFile, readArray(foldersFile).filterNot { it == name })
    }
    @Synchronized fun queue(validBooks: List<ReaderBook>): List<String> {
        val valid = validBooks.map { it.id }.toHashSet()
        return readArray(queueFile).filter { it.matches(idFormat) && it in valid }.distinct()
    }
    @Synchronized fun enqueue(id: String, validBooks: List<ReaderBook>) {
        val current = queue(validBooks)
        if (validBooks.none { it.id == id }) throw IOException("El libro ya no existe.")
        if (id !in current) writeArray(queueFile, current + id)
    }
    @Synchronized fun removeFromQueue(id: String, validBooks: List<ReaderBook>) {
        writeArray(queueFile, queue(validBooks).filterNot { it == id })
    }
    @Synchronized fun moveInQueue(id: String, delta: Int, validBooks: List<ReaderBook>) {
        val before = queue(validBooks)
        val reordered = ReaderLibraryRules.move(before, id, delta)
        if (before != reordered) writeArray(queueFile, reordered)
    }
    @Synchronized fun pruneQueue(validBooks: List<ReaderBook>) {
        writeArray(queueFile, queue(validBooks))
    }
}
