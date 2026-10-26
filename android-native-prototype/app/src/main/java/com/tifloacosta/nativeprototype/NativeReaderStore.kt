package com.tifloacosta.nativeprototype

import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import android.text.Html
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.os.Handler
import android.os.Looper
import androidx.compose.runtime.mutableStateOf
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.IOException
import java.nio.charset.Charset
import java.util.Locale
import java.util.UUID

data class ReaderBook(
    val id: String,
    val title: String,
    val length: Int,
    val offset: Int = 0,
    val createdAt: Long = System.currentTimeMillis(),
    val marks: List<Int> = emptyList(),
    val format: String = "txt",
    val favorite: Boolean = false,
    val folder: String = "",
    val tracks: List<String> = emptyList(),
    val trackIndex: Int = 0,
    val audioPositionMs: Int = 0
)

data class ReadingUnit(val start: Int, val end: Int, val text: String)

/** Offset-based navigation, so a change of unit never loses the saved position. */
object ReaderUnits {
    fun percent(offset: Int, length: Int): Int =
        if (length <= 0) 0 else (offset.coerceIn(0, length).toLong() * 100 / length).toInt()

    fun indexForOffset(units: List<ReadingUnit>, offset: Int): Int {
        if (units.isEmpty()) return 0
        return units.indexOfFirst { it.end > offset }.takeIf { it >= 0 } ?: units.lastIndex
    }

    fun split(text: String, mode: Int): List<ReadingUnit> {
        if (text.isBlank()) return emptyList()
        val pieces = Regex("[^\\r\\n]+").findAll(text)
            .map { it.range.first to (it.range.last + 1) }
            .filter { (start, end) -> text.substring(start, end).isNotBlank() }.toList()
        if (pieces.isEmpty()) return emptyList()
        val spans = when (mode) {
            2 -> { // Sentences within each paragraph.
                pieces.flatMap { (pStart, pEnd) ->
                    Regex("[^.!?]+[.!?]*").findAll(text.substring(pStart, pEnd))
                        .map { (pStart + it.range.first) to (pStart + it.range.last + 1) }
                        .filter { (start, end) -> text.substring(start, end).isNotBlank() }.toList()
                }
            }
            1 -> pieces // Paragraphs.
            else -> { // Groups of up to three paragraphs, bounded for TTS.
                val grouped = mutableListOf<Pair<Int, Int>>()
                var first = pieces.first().first
                var last = first
                var count = 0
                for ((start, end) in pieces) {
                    if (count >= 3 || (count > 0 && end - first > 1800)) {
                        grouped.add(first to last)
                        first = start
                        count = 0
                    }
                    last = end
                    count++
                }
                grouped.add(first to last)
                grouped
            }
        }
        // Android TTS has a maximum input length. Very long paragraphs are
        // broken at word boundaries without dropping text from the document.
        val result = mutableListOf<ReadingUnit>()
        for ((start, end) in spans) {
            var cursor = start
            while (cursor < end) {
                var stop = (cursor + 1500).coerceAtMost(end)
                if (stop < end) {
                    val space = text.lastIndexOf(' ', stop - 1)
                    if (space > cursor + 300) stop = space + 1
                }
                val fragment = text.substring(cursor, stop)
                if (fragment.isNotBlank()) result.add(ReadingUnit(cursor, stop, fragment.trim()))
                cursor = stop
            }
        }
        return result
    }
}

/** Private files owned by this prototype; never reads the released Android app's library. */
class NativeReaderStore(private val context: Context) {
    private val folder = File(context.filesDir, "tiflolector-native").apply { mkdirs() }
    private val index = File(folder, "index.json")
    private val ids = Regex("[a-f0-9\\-]{36}")

    @Synchronized fun list(): List<ReaderBook> {
        if (!index.isFile) return emptyList()
        return try {
            val array = JSONArray(index.readText(Charsets.UTF_8))
            (0 until array.length()).mapNotNull { i ->
                val obj = array.optJSONObject(i) ?: return@mapNotNull null
                val id = obj.optString("id")
                if (!ids.matches(id) || !File(folder, id + ".txt").isFile) return@mapNotNull null
                val marks = obj.optJSONArray("marks") ?: JSONArray()
                ReaderBook(
                    id = id,
                    title = obj.optString("title", "Documento"),
                    length = obj.optInt("length", 0),
                    offset = obj.optInt("offset", 0).coerceAtLeast(0),
                    createdAt = obj.optLong("createdAt", 0),
                    marks = (0 until marks.length()).map { marks.optInt(it, 0).coerceAtLeast(0) },
                    format = obj.optString("format", "txt"),
                    favorite = obj.optBoolean("favorite", false),
                    folder = obj.optString("folder", ""),
                    trackIndex = obj.optInt("trackIndex", 0).coerceAtLeast(0),
                    audioPositionMs = obj.optInt("audioPositionMs", 0).coerceAtLeast(0),
                    tracks = obj.optJSONArray("tracks")?.let { arr ->
                        (0 until arr.length()).mapNotNull { n ->
                            arr.optString(n).takeIf { value -> value.matches(Regex("[a-f0-9-]{36}\\.\\d{3}\\.[A-Za-z0-9]{2,5}")) }
                        }
                    } ?: emptyList()
                )
            }
        } catch (_: Exception) { emptyList() }
    }

    @Synchronized private fun save(books: List<ReaderBook>) {
        val array = JSONArray()
        books.forEach { book ->
            array.put(JSONObject().put("id", book.id).put("title", book.title)
                .put("length", book.length).put("offset", book.offset)
                .put("createdAt", book.createdAt).put("marks", JSONArray(book.marks))
                .put("format", book.format).put("favorite", book.favorite)
                .put("folder", book.folder).put("tracks", JSONArray(book.tracks))
                .put("trackIndex", book.trackIndex).put("audioPositionMs", book.audioPositionMs))
        }
        val temp = File(folder, "index.tmp")
        temp.writeText(array.toString(), Charsets.UTF_8)
        if (!temp.renameTo(index)) {
            // Some filesystems do not replace an existing file on rename.
            index.writeText(array.toString(), Charsets.UTF_8)
            temp.delete()
        }
    }

    @Synchronized fun read(book: ReaderBook): String {
        require(ids.matches(book.id))
        return File(folder, book.id + ".txt").readText(Charsets.UTF_8)
    }

    @Synchronized fun update(book: ReaderBook) {
        val books = list().map { if (it.id == book.id) book else it }
        if (books.any { it.id == book.id }) save(books)
    }

    @Synchronized fun audioFiles(book: ReaderBook): List<File> {
        return book.tracks.map { File(folder, it) }.filter { it.isFile }
    }

    @Synchronized fun import(uri: Uri): ReaderBook {
        val resolver = context.contentResolver
        var title = "Documento"
        resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
            if (cursor.moveToFirst()) title = cursor.getString(0) ?: title
        }
        title = title.substringAfterLast('/').take(180).ifBlank { "Documento" }
        val ext = title.substringAfterLast('.', "").lowercase(Locale.ROOT)
        val bytes = resolver.openInputStream(uri)?.use { stream ->
            NativeReaderFormats.readBounded(stream, NativeReaderFormats.MAX_ARCHIVE_BYTES)
        } ?: throw IOException("No se pudo abrir el documento.")
        return importBytes(title, ext, bytes)
    }

    @Synchronized fun importBytes(title: String, ext: String, bytes: ByteArray): ReaderBook {
        val payload = NativeReaderFormats.decode(context, ext, bytes)
        if (payload.body.isBlank() && payload.audio.isEmpty()) {
            throw IOException("No se ha encontrado contenido accesible en el documento.")
        }
        val id = UUID.randomUUID().toString()
        val names = mutableListOf<String>()
        val files = mutableListOf<File>()
        try {
            // Keep the original bytes for future OCR retries, alternative
            // decoders and export. Never replace the original with OCR text.
            val suffix = ext.lowercase(Locale.ROOT).takeIf {
                it.matches(Regex("[a-z0-9]{2,8}"))
            } ?: "bin"
            val original = File(folder, id + ".source." + suffix)
            original.writeBytes(bytes)
            files.add(original)
            payload.audio.forEachIndexed { index, audio ->
                val safeExt = audio.first.substringAfterLast('.', "mp3")
                    .lowercase(Locale.ROOT).takeIf { it in NativeReaderFormats.AUDIO_EXTENSIONS } ?: "mp3"
                val name = id + "." + index.toString().padStart(3, '0') + "." + safeExt
                val file = File(folder, name)
                file.writeBytes(audio.second)
                names.add(name)
                files.add(file)
            }
            val body = File(folder, id + ".txt")
            body.writeText(payload.body, Charsets.UTF_8)
            files.add(body)
            val book = ReaderBook(
                id = id, title = title.take(180), length = payload.body.length,
                format = payload.format, tracks = names
            )
            save(list() + book)
            return book
        } catch (e: Exception) {
            files.forEach { it.delete() }
            throw e
        }
    }

    @Synchronized fun folders(): List<String> = list().map { it.folder }
        .filter { it.isNotBlank() }.distinct().sorted()

    @Synchronized fun rename(book: ReaderBook, title: String) {
        val clean = title.trim().take(180)
        if (clean.isNotEmpty()) update(book.copy(title = clean))
    }

    @Synchronized fun delete(book: ReaderBook) {
        list().firstOrNull { it.id == book.id }?.let { current ->
            save(list().filterNot { it.id == book.id })
            File(folder, book.id + ".txt").delete()
            // Source files use a generated UUID and are never resolved from
            // untrusted document titles or ZIP entry paths.
            folder.listFiles()?.filter { it.name.startsWith(book.id + ".source.") }
                ?.forEach { it.delete() }
            current.tracks.forEach { File(folder, it).delete() }
        }
    }

}
