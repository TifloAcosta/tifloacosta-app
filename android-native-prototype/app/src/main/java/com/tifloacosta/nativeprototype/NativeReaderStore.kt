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
    val marks: List<Int> = emptyList()
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
                    Regex("[^.!?¿¡]+[.!?]*").findAll(text.substring(pStart, pEnd))
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
                    marks = (0 until marks.length()).map { marks.optInt(it, 0).coerceAtLeast(0) }
                )
            }
        } catch (_: Exception) { emptyList() }
    }

    @Synchronized private fun save(books: List<ReaderBook>) {
        val array = JSONArray()
        books.forEach { book ->
            array.put(JSONObject().put("id", book.id).put("title", book.title)
                .put("length", book.length).put("offset", book.offset)
                .put("createdAt", book.createdAt).put("marks", JSONArray(book.marks)))
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

    @Synchronized fun import(uri: Uri): ReaderBook {
        val resolver = context.contentResolver
        var title = "Documento"
        resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
            if (cursor.moveToFirst()) title = cursor.getString(0) ?: title
        }
        title = title.substringAfterLast('/').take(180).ifBlank { "Documento" }
        val ext = title.substringAfterLast('.', "").lowercase(Locale.ROOT)
        if (ext !in setOf("txt", "text", "md", "markdown", "html", "htm")) {
            throw IOException("Por ahora solo se admiten TXT, Markdown y HTML.")
        }
        val bytes = resolver.openInputStream(uri)?.use { stream ->
            val output = ByteArrayOutputStream()
            val buffer = ByteArray(8192)
            while (true) {
                val count = stream.read(buffer)
                if (count < 0) break
                if (output.size() + count > 4 * 1024 * 1024) {
                    throw IOException("El documento supera el límite de 4 MB de esta prueba.")
                }
                output.write(buffer, 0, count)
            }
            output.toByteArray()
        } ?: throw IOException("No se pudo abrir el documento.")
        if (bytes.isEmpty()) throw IOException("El documento está vacío.")
        var raw = bytes.toString(Charsets.UTF_8).removePrefix("\uFEFF")
        if ('\uFFFD' in raw) raw = bytes.toString(Charset.forName("windows-1252"))
        val plain = if (ext == "html" || ext == "htm") {
            val withoutCode = raw.replace(
                Regex("<(script|style)\\b[^>]*>[\\s\\S]*?</\\1>", RegexOption.IGNORE_CASE), " "
            )
            Html.fromHtml(withoutCode, Html.FROM_HTML_MODE_COMPACT).toString()
        } else raw
        if (plain.isBlank()) throw IOException("El documento no contiene texto legible.")
        val book = ReaderBook(UUID.randomUUID().toString(), title, plain.length)
        val document = File(folder, book.id + ".txt")
        document.writeText(plain, Charsets.UTF_8)
        try {
            save(list() + book)
        } catch (e: Exception) {
            document.delete()
            throw e
        }
        return book
    }
}

/** Speech is deliberately separate from TalkBack: no live progress announcements. */
class NativeReaderSpeaker(context: Context) : TextToSpeech.OnInitListener {
    val ready = mutableStateOf(false)
    private val main = Handler(Looper.getMainLooper())
    private val engine = TextToSpeech(context.applicationContext, this)
    private var active: String? = null
    private var done: (() -> Unit)? = null

    init {
        engine.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
            override fun onStart(utteranceId: String?) {}
            override fun onError(utteranceId: String?) {
                main.post {
                    if (utteranceId == active) { active = null; done = null }
                }
            }
            override fun onDone(utteranceId: String?) {
                main.post {
                    if (utteranceId == active) {
                        active = null
                        val complete = done
                        done = null
                        complete?.invoke()
                    }
                }
            }
        })
    }

    override fun onInit(status: Int) {
        main.post {
            ready.value = status == TextToSpeech.SUCCESS
            if (ready.value) engine.language = Locale.getDefault()
        }
    }

    fun speak(fragment: String, speed: Float, after: () -> Unit) {
        if (!ready.value || fragment.isBlank()) return
        val id = UUID.randomUUID().toString()
        active = id
        done = after
        engine.setSpeechRate(speed)
        if (engine.speak(fragment, TextToSpeech.QUEUE_FLUSH, null, id) != TextToSpeech.SUCCESS) {
            active = null
            done = null
        }
    }

    fun stop() {
        active = null
        done = null
        engine.stop()
    }

    fun close() {
        stop()
        engine.shutdown()
    }
}
