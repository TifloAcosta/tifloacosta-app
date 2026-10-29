package com.tifloacosta.nativeprototype

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import java.net.HttpURLConnection
import java.net.URI
import java.net.URLDecoder
import java.net.URL
import java.util.Locale

/**
 * Editorial audio/video feed also used by the native iOS app.
 * This is not a YouTube search API or a media player.
 */
data class MediaItem(
    val id: String,
    val type: String,
    val title: String,
    val sourceName: String,
    val sourceUrl: String,
    val originalUrl: String,
    val directMediaUrl: String,
    val language: String,
    val publishedAt: String,
    val summary: String
) {
    val openUrl: String
        get() = sequenceOf(
            if (type == "audio") directMediaUrl else "",
            originalUrl,
            sourceUrl
        ).firstOrNull(MediaLogic::validWebUrl).orEmpty()

    val channelUrl: String
        get() = sourceUrl.takeIf(MediaLogic::validWebUrl).orEmpty()
}

data class MediaLoad(
    val items: List<MediaItem> = emptyList(),
    val status: String = ""
)

object MediaLogic {
    private val videoIdPattern = Regex("^[A-Za-z0-9_-]{11}$")

    /**
     * Accept only actual YouTube video links. Never pass untrusted URLs/ids
     * through to HTML/JavaScript or try to turn channel URLs into video links.
     */
    fun youTubeVideoId(raw: String): String? {
        return try {
        val url = URI(raw.trim())
        if (url.scheme?.lowercase(Locale.ROOT) != "https") return null
        val host = url.host?.lowercase(Locale.ROOT) ?: return null
        val segments = (url.path ?: "").split('/').filter { it.isNotBlank() }
        val id = when {
            host == "youtu.be" || host == "www.youtu.be" -> segments.firstOrNull()
            host in setOf("youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com",
                "www.youtube-nocookie.com", "youtube-nocookie.com") -> when (segments.firstOrNull()) {
                "watch" -> url.rawQuery?.split('&')?.firstOrNull { it.startsWith("v=") }
                    ?.substringAfter("v=")?.let { URLDecoder.decode(it, "UTF-8") }
                "shorts", "embed", "live", "v" -> segments.getOrNull(1)
                else -> null
            }
            else -> null
        }
        id?.takeIf { videoIdPattern.matches(it) }
        } catch (_: Exception) { null }
    }

    fun validWebUrl(value: String): Boolean = try {
        val url = URL(value)
        url.protocol.lowercase(Locale.ROOT) == "https" && !url.host.isNullOrBlank()
    } catch (_: Exception) { false }

    fun sources(items: List<MediaItem>, selectedFormat: Int): List<String> =
        items.asSequence()
            .filter { selectedFormat == 3 || matchesFormat(it, selectedFormat) }
            .map { it.sourceName.trim() }
            .filter { it.isNotBlank() }
            .distinct()
            .sorted()
            .toList()

    // Actualidad selector: 0 = noticias, 1 = podcast, 2 = canales, 3 = todos.
    private fun matchesFormat(item: MediaItem, format: Int): Boolean = when (format) {
        1 -> item.type == "audio"
        2 -> item.type == "video"
        3 -> item.type == "audio" || item.type == "video"
        else -> false
    }

    fun select(
        items: List<MediaItem>,
        format: Int,
        source: String? = null,
        language: Int = 0
    ): List<MediaItem> {
        if (format !in 1..3) return emptyList()
        return items.filter { item ->
            matchesFormat(item, format) &&
                (source == null || item.sourceName == source) &&
                (language == 0 || item.language == if (language == 1) "es" else "en")
        }.sortedWith(compareByDescending<MediaItem> { it.publishedAt }.thenBy { it.title })
    }
}

object MediaRepository {
    private const val URL_MEDIA = "https://tifloacosta.com/actualidad-media.json"
    private const val FILE_CACHE = "native-prototype-media.json"

    internal fun parse(text: String): List<MediaItem> {
        val list = JSONArray(text)
        return (0 until list.length()).mapNotNull { i ->
            val o = list.optJSONObject(i) ?: return@mapNotNull null
            val type = o.optString("type")
            val title = o.optString("title").trim()
            if ((type != "audio" && type != "video") || title.isEmpty()) return@mapNotNull null
            MediaItem(
                id = o.optString("id", "media-$i"),
                type = type,
                title = title,
                sourceName = o.optString("sourceName"),
                sourceUrl = o.optString("sourceUrl"),
                originalUrl = o.optString("originalUrl"),
                directMediaUrl = o.optString("mediaUrl"),
                language = o.optString("originalLanguage"),
                publishedAt = o.optString("publishedAt"),
                summary = o.optString("summary")
            )
        }
    }

    suspend fun load(context: Context): MediaLoad = withContext(Dispatchers.IO) {
        val cache = context.getFileStreamPath(FILE_CACHE)
        try {
            val connection = URL(URL_MEDIA).openConnection() as HttpURLConnection
            connection.connectTimeout = 15000
            connection.readTimeout = 15000
            connection.setRequestProperty("Accept", "application/json")
            val bytes = try {
                check(connection.responseCode == 200) { "No multimedia feed" }
                connection.inputStream.use { it.readBytes() }
            } finally { connection.disconnect() }
            val items = parse(bytes.toString(Charsets.UTF_8))
            context.openFileOutput(FILE_CACHE, Context.MODE_PRIVATE).use { it.write(bytes) }
            MediaLoad(items)
        } catch (_: Exception) {
            if (cache.isFile) {
                try {
                    MediaLoad(parse(cache.readText()), "Sin conexión. Se muestran los canales guardados.")
                } catch (_: Exception) {
                    MediaLoad(status = "No se pudieron cargar los canales multimedia.")
                }
            } else {
                MediaLoad(status = "No se pudieron cargar los canales multimedia.")
            }
        }
    }
}
