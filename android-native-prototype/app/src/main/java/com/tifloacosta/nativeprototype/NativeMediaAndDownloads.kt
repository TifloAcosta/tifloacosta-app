package com.tifloacosta.nativeprototype

import android.app.DownloadManager
import android.content.Context
import android.media.MediaPlayer
import android.net.Uri
import android.os.Environment
import android.util.Xml
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Slider
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import org.xmlpull.v1.XmlPullParser
import java.net.HttpURLConnection
import java.net.URL

private fun limitedResponse(url: String, post: JSONObject? = null): String {
    val connection = (URL(url).openConnection() as HttpURLConnection)
    connection.connectTimeout = 12000
    connection.readTimeout = 12000
    connection.instanceFollowRedirects = false
    connection.setRequestProperty("Accept", "application/json, application/xml, text/xml")
    if (post != null) {
        connection.requestMethod = "POST"
        connection.doOutput = true
        connection.setRequestProperty("Content-Type", "application/json")
        connection.outputStream.use { it.write(post.toString().toByteArray()) }
    }
    return try {
        check(connection.responseCode in 200..299) { "Servicio no disponible" }
        connection.inputStream.use { input ->
            val out = java.io.ByteArrayOutputStream()
            val buffer = ByteArray(8192)
            var total = 0
            while (true) {
                val n = input.read(buffer)
                if (n < 0) break
                total += n
                require(total <= 2_000_000) { "Respuesta demasiado grande" }
                out.write(buffer, 0, n)
            }
            out.toString("UTF-8")
        }
    } finally { connection.disconnect() }
}

@Composable
fun NativeDownloadScreen(english: Boolean, initialUrl: String = "") {
    val context = LocalContext.current
    var url by remember(initialUrl) { mutableStateOf(initialUrl) }
    var status by remember { mutableStateOf("") }
    Column(verticalArrangement = Arrangement.spacedBy(9.dp)) {
        Text(if (english) "Direct file download" else "Descargar archivo por enlace",
            style = MaterialTheme.typography.titleMedium)
        OutlinedTextField(url, { url = it.take(2048) }, modifier = Modifier.fillMaxWidth(),
            label = { Text(if (english) "HTTPS file address" else "Dirección HTTPS del archivo") })
        Button(modifier = Modifier.fillMaxWidth(), onClick = {
            try {
                val parsed = Uri.parse(url.trim())
                require(parsed.scheme == "https" && !parsed.host.isNullOrBlank())
                val file = parsed.lastPathSegment?.substringBefore('?')
                    ?.takeIf { it.length in 2..100 && !it.contains('/') && !it.contains('\\') }
                    ?: "archivo-descargado"
                val request = DownloadManager.Request(parsed)
                    .setTitle(file)
                    .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                    .setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, file)
                val dm = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
                dm.enqueue(request)
                status = if (english) "Download added to Android Downloads" else
                    "Descarga enviada al gestor de descargas de Android"
            } catch (_: Exception) {
                status = if (english) "Enter a valid direct HTTPS download link" else
                    "Introduce un enlace HTTPS directo válido"
            }
        }) { Text(if (english) "Download" else "Descargar") }
        Text(if (english)
            "Cloud links that require authentication should be opened in the provider's application."
            else "Los enlaces de nubes que requieren autenticación deben abrirse con la aplicación del proveedor.")
        if (status.isNotEmpty()) Text(status)
    }
}

data class NativeSound(val name: String, val page: String, val preview: String)

@Composable
fun NativeSoundSearchScreen(english: Boolean) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var term by remember { mutableStateOf("") }
    var status by remember { mutableStateOf("") }
    var results by remember { mutableStateOf<List<NativeSound>>(emptyList()) }
    var busy by remember { mutableStateOf(false) }
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        OutlinedTextField(term, { term = it.take(120) }, modifier = Modifier.fillMaxWidth(),
            label = { Text(if (english) "Sound to find" else "Sonido que buscas") })
        Button(enabled = !busy && term.trim().length >= 2, onClick = {
            busy = true
            scope.launch {
                try {
                    val found = withContext(Dispatchers.IO) {
                        val body = JSONObject().put("query", term.trim()).put("category", "").put("page", 1)
                        val response = JSONObject(limitedResponse(
                            "https://download.tifloacosta.com/sounds/search", body))
                        if (response.optString("status") != "ok") throw IllegalStateException()
                        val items = response.optJSONArray("items")
                        (0 until (items?.length() ?: 0)).mapNotNull { i ->
                            val item = items?.optJSONObject(i) ?: return@mapNotNull null
                            val name = item.optString("name")
                            if (name.isBlank()) null
                            else NativeSound(name, item.optString("pageUrl"), item.optString("previewUrl"))
                        }
                    }
                    results = found
                    status = if (english) "${found.size} sounds found" else "${found.size} sonidos encontrados"
                } catch (_: Exception) {
                    status = if (english) "Sound search unavailable" else "No se pudo consultar el banco de sonidos"
                } finally { busy = false }
            }
        }) { Text(if (english) "Search sounds" else "Buscar sonidos") }
        Text(status)
        listOf(
            "Mixkit" to "https://mixkit.co/free-sound-effects/",
            "Pixabay" to "https://pixabay.com/sound-effects/"
        ).forEach { (title, link) ->
            TextButton(onClick = { nativeExternal(context, link) }) { Text(title) }
        }
        LazyColumn(modifier = Modifier.heightIn(max = 360.dp)) {
            items(results) { sound ->
                if (MediaLogic.validWebUrl(sound.page)) {
                    OutlinedButton(modifier = Modifier.fillMaxWidth(),
                        onClick = { nativeExternal(context, sound.page) }) {
                        Text(sound.name)
                    }
                } else Text(sound.name)
            }
        }
    }
}

data class NativeEpisode(val title: String, val url: String)

private fun episodesFromRss(xml: String): List<NativeEpisode> {
    val parser = Xml.newPullParser()
    parser.setInput(xml.reader())
    var inside = false
    var title = ""
    var url = ""
    val result = mutableListOf<NativeEpisode>()
    var event = parser.eventType
    while (event != XmlPullParser.END_DOCUMENT && result.size < 150) {
        if (event == XmlPullParser.START_TAG) when (parser.name) {
            "item" -> { inside = true; title = ""; url = "" }
            "title" -> if (inside) title = parser.nextText().trim().take(250)
            "enclosure" -> if (inside) url = parser.getAttributeValue(null, "url").orEmpty()
        } else if (event == XmlPullParser.END_TAG && parser.name == "item") {
            if (title.isNotBlank() && MediaLogic.validWebUrl(url))
                result.add(NativeEpisode(title, url))
            inside = false
        }
        event = parser.next()
    }
    return result
}

@Composable
fun NativePodcastScreen(english: Boolean, media: List<MediaItem>) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var episodes by remember { mutableStateOf<List<NativeEpisode>>(emptyList()) }
    var status by remember { mutableStateOf("") }
    var chosen by remember { mutableStateOf<NativeEpisode?>(null) }
    var playing by remember { mutableStateOf(false) }
    var position by remember { mutableStateOf(0f) }
    var duration by remember { mutableStateOf(0f) }
    val player = remember { MediaPlayer() }
    DisposableEffect(player) { onDispose { runCatching { player.stop(); player.release() } } }
    LaunchedEffect(Unit) {
        status = if (english) "Loading episodes" else "Cargando episodios"
        try {
            episodes = withContext(Dispatchers.IO) {
                episodesFromRss(limitedResponse("https://anchor.fm/s/5b48ca28/podcast/rss"))
            }
            status = if (episodes.isEmpty()) (if (english) "No episodes" else "Sin episodios")
                else ""
        } catch (_: Exception) {
            episodes = media.filter { it.type == "audio" && MediaLogic.validWebUrl(it.openUrl) }
                .map { NativeEpisode(it.title, it.openUrl) }
            status = if (english) "Using the saved podcast list" else "Utilizando la lista de podcasts guardada"
        }
    }
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        if (status.isNotBlank()) Text(status)
        chosen?.let { current ->
            Text(current.title, style = MaterialTheme.typography.titleMedium)
            androidx.compose.foundation.layout.Row {
                Button(onClick = {
                    runCatching {
                        if (player.isPlaying) { player.pause(); playing = false }
                        else { player.start(); playing = true }
                    }
                }) { Text(if (playing) (if (english) "Pause" else "Pausar")
                    else (if (english) "Play" else "Reproducir")) }
                TextButton(onClick = {
                    runCatching { player.seekTo((player.currentPosition - 30_000).coerceAtLeast(0)) }
                }) { Text("-30 s") }
                TextButton(onClick = {
                    runCatching { player.seekTo((player.currentPosition + 30_000)
                        .coerceAtMost(player.duration.coerceAtLeast(0))) }
                }) { Text("+30 s") }
            }
            if (duration > 0f) Slider(
                value = position.coerceIn(0f, duration),
                onValueChange = { value ->
                    position = value
                    runCatching { player.seekTo(value.toInt()) }
                },
                valueRange = 0f..duration,
                modifier = Modifier.fillMaxWidth())
            TextButton(onClick = { nativeExternal(context, current.url) }) {
                Text(if (english) "Open episode source" else "Abrir origen del episodio")
            }
        }
        Text(if (english) "Episodes" else "Episodios", style = MaterialTheme.typography.titleMedium,
            modifier = Modifier.semantics { heading() })
        LazyColumn {
            items(episodes.take(100), key = { it.url }) { episode ->
                OutlinedButton(modifier = Modifier.fillMaxWidth(), onClick = {
                    chosen = episode
                    playing = false
                    status = if (english) "Preparing audio" else "Preparando audio"
                    runCatching {
                        player.reset()
                        player.setDataSource(episode.url)
                        player.setOnPreparedListener {
                            duration = it.duration.coerceAtLeast(0).toFloat()
                            position = 0f
                            status = ""
                            it.start()
                            playing = true
                        }
                        player.setOnErrorListener { _, _, _ ->
                            status = if (english) "Cannot play episode" else "No se puede reproducir"
                            playing = false
                            true
                        }
                        player.prepareAsync()
                    }.onFailure { status = if (english) "Audio error" else "Error de audio" }
                }) { Text(episode.title) }
            }
        }
    }
}
