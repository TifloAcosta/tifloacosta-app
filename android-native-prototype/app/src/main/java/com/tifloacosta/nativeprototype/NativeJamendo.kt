package com.tifloacosta.nativeprototype

import android.media.MediaPlayer
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

internal data class JamendoSong(val id: String, val title: String, val artist: String, val streamUrl: String)

/** Solo búsquedas públicas: no se solicita una cuenta Jamendo al oyente. */
internal object NativeJamendo {
    private const val CLIENT_ID = "7e385841"

    suspend fun search(query: String): List<JamendoSong> = withContext(Dispatchers.IO) {
        val trimmed = query.trim()
        if (trimmed.isEmpty()) return@withContext emptyList()
        val encoded = URLEncoder.encode(trimmed, "UTF-8")
        val url = URL("https://api.jamendo.com/v3.0/tracks/?client_id=$CLIENT_ID&format=json&limit=20&search=$encoded")
        val connection = (url.openConnection() as HttpURLConnection).apply {
            connectTimeout = 10_000
            readTimeout = 12_000
        }
        try {
            if (connection.responseCode != 200) throw IllegalStateException("Jamendo HTTP ${connection.responseCode}")
            val payload = connection.inputStream.bufferedReader().use { it.readText() }
            val json = JSONObject(payload)
            if (json.optJSONObject("headers")?.optString("status") != "success") {
                throw IllegalStateException("Jamendo no pudo completar la consulta")
            }
            val results = json.optJSONArray("results") ?: return@withContext emptyList()
            buildList {
                for (index in 0 until results.length()) {
                    val item = results.optJSONObject(index) ?: continue
                    val stream = item.optString("audio")
                    val streamURL = runCatching { URL(stream) }.getOrNull()
                    if (streamURL?.protocol != "https" || streamURL.host.isNullOrBlank()) continue
                    val id = item.optString("id")
                    val title = item.optString("name")
                    if (id.isNotEmpty() && title.isNotEmpty()) add(JamendoSong(id, title, item.optString("artist_name"), stream))
                }
            }
        } finally { connection.disconnect() }
    }

    fun start(song: JamendoSong, onError: (String) -> Unit): MediaPlayer {
        val player = MediaPlayer()
        player.setDataSource(song.streamUrl)
        player.setOnPreparedListener { it.start() }
        player.setOnErrorListener { _, _, _ ->
            onError("No se pudo reproducir ${song.title} desde Jamendo")
            true
        }
        player.prepareAsync()
        return player
    }
}
