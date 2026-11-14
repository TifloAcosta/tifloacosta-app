package com.tifloacosta.nativeprototype

import android.app.DownloadManager
import android.content.Context
import android.media.MediaPlayer
import android.net.Uri
import android.os.Environment
import android.util.Xml
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
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
import androidx.compose.runtime.mutableIntStateOf
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
import kotlinx.coroutines.delay
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

data class NativeDownloadItem(val name: String, val url: String, val source: String)

@Composable
fun NativeDownloadScreen(english: Boolean, initialUrl: String = "") {
    val context = LocalContext.current
    val uiLanguage = LocalNativeUiLanguage.current
    fun label(key: String, count: Int? = null) = NativeLinkDownloadStrings.get(uiLanguage, key, count)
    val scope = rememberCoroutineScope()
    var url by remember(initialUrl) { mutableStateOf(initialUrl) }
    var status by remember { mutableStateOf("") }
    var analyzing by remember { mutableStateOf(false) }
    var items by remember { mutableStateOf<List<NativeDownloadItem>>(emptyList()) }
    var external by remember { mutableStateOf("") }

    fun download(item: NativeDownloadItem) {
        try {
            val parsed = Uri.parse(item.url)
            require(parsed.scheme == "https" && !parsed.host.isNullOrBlank())
            val safe = item.name.replace(Regex("[^\\p{L}\\p{N} ._()-]"), "_")
                .take(100).trim('.', ' ').takeIf { it.isNotBlank() && it != ".." }
                ?: "archivo-descargado"
            val request = DownloadManager.Request(parsed)
                .setTitle(safe)
                .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                .setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, safe)
            (context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager).enqueue(request)
            status = label("queued")
        } catch (_: Exception) {
            status = label("failure")
        }
    }

    Column(verticalArrangement = Arrangement.spacedBy(9.dp)) {
        Text(label("title"),
            style = MaterialTheme.typography.titleMedium)
        OutlinedTextField(url, { url = it.take(2048) }, modifier = Modifier.fillMaxWidth(),
            label = { Text(label("url")) })
        Button(enabled = !analyzing, modifier = Modifier.fillMaxWidth(), onClick = {
            val parsed = Uri.parse(url.trim())
            if (parsed.scheme != "https" || parsed.host.isNullOrBlank()) {
                status = label("invalid")
            } else {
                analyzing = true
                items = emptyList()
                external = ""
                status = label("analyzing")
                scope.launch {
                    try {
                        val payload = withContext(Dispatchers.IO) {
                            JSONObject(limitedResponse("https://download.tifloacosta.com/analyze",
                                JSONObject().put("url", url.trim())))
                        }
                        val list = payload.optJSONArray("items")
                        val found = (0 until (list?.length() ?: 0)).mapNotNull { i ->
                            val o = list?.optJSONObject(i) ?: return@mapNotNull null
                            val address = o.optString("url")
                            if (!MediaLogic.validWebUrl(address)) return@mapNotNull null
                            NativeDownloadItem(o.optString("name", "Archivo"), address, o.optString("source"))
                        }
                        items = found
                        external = payload.optString("url", url.trim())
                        status = if (found.isEmpty())
                            label("notFound")
                        else label("files", found.size)
                    } catch (_: Exception) {
                        status = label("analyzerError")
                        external = url.trim()
                    } finally { analyzing = false }
                }
            }
        }) { Text(label("analyze")) }
        Text(status)
        LazyColumn(modifier = Modifier.heightIn(max = 340.dp)) {
            items(items, key = { it.url }) { file ->
                Button(modifier = Modifier.fillMaxWidth(), onClick = { download(file) }) {
                    Text(label("download") + file.name)
                }
                if (file.source.isNotBlank()) Text(file.source)
            }
        }
        if (items.isEmpty() && MediaLogic.validWebUrl(external))
            TextButton(onClick = { nativeExternal(context, external) }) {
                Text(label("open"))
            }
    }
}

data class NativeSound(val name: String, val page: String, val preview: String)

@Composable
fun NativeSoundSearchScreen(english: Boolean) {
    val context = LocalContext.current
    val uiLanguage = LocalNativeUiLanguage.current
    fun label(key: String, count: Int? = null) = NativeSoundStrings.get(uiLanguage, key, count)
    val scope = rememberCoroutineScope()
    var term by remember { mutableStateOf("") }
    var status by remember { mutableStateOf("") }
    var results by remember { mutableStateOf<List<NativeSound>>(emptyList()) }
    var busy by remember { mutableStateOf(false) }
    var category by remember { mutableStateOf(0) }
    val categories = listOf(
        "" to label("all"),
        "ringtones" to label("ringtones"),
        "notifications" to label("notifications"),
        "alarms" to label("alarms"),
        "phones" to label("phones"),
        "technology" to label("technology"),
        "nature" to label("nature"),
        "animals" to label("animals"),
        "ambience" to label("ambience"),
        "funny" to label("funny"),
        "games" to label("games")
    )
    var preview by remember { mutableStateOf<MediaPlayer?>(null) }
    DisposableEffect(Unit) {
        onDispose { preview?.let { runCatching { it.stop(); it.release() } } }
    }
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        ReaderAdjustableChoice(label("category"),
            categories.map { it.second }, category) { category = it }

        OutlinedTextField(term, { term = it.take(120) }, modifier = Modifier.fillMaxWidth(),
            label = { Text(label("query")) })
        Button(enabled = !busy && term.trim().length >= 2, onClick = {
            busy = true
            scope.launch {
                try {
                    val found = withContext(Dispatchers.IO) {
                        val id = categories[category].first
                        val body = JSONObject().put("query", term.trim())
                            .put("category", id).put("page", 1)
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
                    status = label("found", found.size)
                } catch (_: Exception) {
                    status = label("unavailable")
                } finally { busy = false }
            }
        }) { Text(label("search")) }
        Text(status)
        listOf(
            "Mixkit" to "https://mixkit.co/free-sound-effects/",
            "Pixabay" to "https://pixabay.com/sound-effects/"
        ).forEach { (title, link) ->
            TextButton(onClick = { nativeExternal(context, link) }) { Text(title) }
        }
        LazyColumn(modifier = Modifier.heightIn(max = 360.dp)) {
            items(results) { sound ->
                if (MediaLogic.validWebUrl(sound.preview)) {
                    Button(modifier = Modifier.fillMaxWidth(), onClick = {
                        preview?.let { runCatching { it.stop(); it.release() } }
                        val player = MediaPlayer()
                        preview = player
                        runCatching {
                            player.setDataSource(sound.preview)
                            player.setOnPreparedListener { it.start() }
                            player.setOnErrorListener { _, _, _ -> true }
                            player.prepareAsync()
                        }.onFailure { runCatching { player.release() }; preview = null }
                    }) { Text(label("listen") + sound.name) }
                }
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
    val uiLanguage = LocalNativeUiLanguage.current
    fun label(key: String, value: Any? = null) = NativePodcastStrings.get(uiLanguage, key, value)
    val library = remember { NativePodcastLibrary(context) }
    var favorites by remember { mutableStateOf(library.favorites()) }
    var followed by remember { mutableStateOf(library.subscriptions()) }
    var libraryNotice by remember { mutableStateOf("") }
    var followedEpisodes by remember { mutableStateOf<List<NativeEpisode>>(emptyList()) }
    var followedTitle by remember { mutableStateOf("") }
    var followedBusy by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    var opmlImportBusy by remember { mutableStateOf(false) }
    val importOPML = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null && !opmlImportBusy) {
            opmlImportBusy = true
            libraryNotice = label("importing")
            scope.launch {
                try {
                    val count = withContext(Dispatchers.IO) { library.importOPML(uri) }
                    followed = library.subscriptions()
                    libraryNotice = label("importSuccess", count)
                } catch (_: Exception) {
                    libraryNotice = label("importError")
                } finally {
                    opmlImportBusy = false
                }
            }
        }
    }
    var episodes by remember { mutableStateOf<List<NativeEpisode>>(emptyList()) }
    var visibleEpisodes by remember { mutableIntStateOf(10) }
    var status by remember { mutableStateOf("") }
    var chosen by remember { mutableStateOf<NativeEpisode?>(null) }
    var playing by remember { mutableStateOf(false) }
    var position by remember { mutableStateOf(0f) }
    var duration by remember { mutableStateOf(0f) }
    val player = remember { MediaPlayer() }
    DisposableEffect(player) { onDispose { runCatching { player.stop(); player.release() } } }
    LaunchedEffect(player, chosen, playing) {
        while (playing) {
            position = runCatching { player.currentPosition.coerceAtLeast(0).toFloat() }
                .getOrDefault(position)
            delay(750)
        }
    }
    LaunchedEffect(Unit) {
        status = label("loading")
        try {
            episodes = withContext(Dispatchers.IO) {
                episodesFromRss(limitedResponse("https://anchor.fm/s/5b48ca28/podcast/rss"))
            }
            status = if (episodes.isEmpty()) label("none")
                else ""
        } catch (_: Exception) {
            episodes = media.filter { it.type == "audio" && MediaLogic.validWebUrl(it.openUrl) }
                .map { NativeEpisode(it.title, it.openUrl) }
            status = label("savedList")
        }
    }
    fun playEpisode(episode: NativeEpisode) {
        chosen = episode
        playing = false
        status = label("preparing")
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
                status = label("playError")
                playing = false
                true
            }
            player.setOnCompletionListener {
                playing = false
                position = duration
            }
            player.prepareAsync()
        }.onFailure { status = label("audioError") }
    }
    LazyColumn(modifier = Modifier.fillMaxWidth()) {
      item {
       Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        if (status.isNotBlank()) Text(status)
        Text(label("library"),
            style = MaterialTheme.typography.titleMedium, modifier = Modifier.semantics { heading() })
        Button(onClick = {
            library.follow("Canal TifloAcosta", "https://anchor.fm/s/5b48ca28/podcast/rss")
            followed = library.subscriptions()
            libraryNotice = label("subscriptionSaved")
        }) { Text(label("follow")) }
        Button(enabled = !opmlImportBusy, onClick = { importOPML.launch(arrayOf("text/xml", "application/xml", "text/x-opml", "*/*")) }) {
            Text(label("import"))
        }
        Text(label("favoritesCount", favorites.size))
        library.savedEpisodes().forEach { saved ->
            TextButton(onClick = { playEpisode(NativeEpisode(saved.title, saved.url)) }) {
                Text(label("favoritePlay") + saved.title)
            }
            TextButton(onClick = {
                library.toggleFavoriteEpisode(saved.title, saved.url)
                favorites = library.favorites()
            }) {
                Text(label("favoriteRemove") + saved.title)
            }
        }
        if (libraryNotice.isNotBlank()) Text(libraryNotice)
        followed.forEach { podcast ->
            Text(podcast.title)
            TextButton(enabled = !followedBusy, onClick = {
                followedTitle = podcast.title
                followedBusy = true
                libraryNotice = label("followedLoading")
                scope.launch {
                    try {
                        followedEpisodes = withContext(Dispatchers.IO) {
                            episodesFromRss(limitedResponse(podcast.url))
                        }
                        val newCount = withContext(Dispatchers.IO) {
                            library.recordFeedCheck(podcast.url, followedEpisodes.map { it.url })
                        }
                        libraryNotice = if (followedEpisodes.isEmpty()) {
                            label("noPlayable")
                        } else label("newEpisodes", newCount)
                    } catch (_: Exception) {
                        followedEpisodes = emptyList()
                        libraryNotice = label("feedError")
                    } finally { followedBusy = false }
                }
            }) { Text(label("browse") + podcast.title) }
            TextButton(onClick = {
                library.unfollow(podcast.url)
                followed = library.subscriptions()
            }) { Text(label("unfollow") + podcast.title) }
        }
        if (followedBusy) Text(label("loading"))
        if (followedEpisodes.isNotEmpty()) {
            Text(followedTitle, style = MaterialTheme.typography.titleMedium)
            followedEpisodes.take(100).forEach { episode ->
                TextButton(onClick = { playEpisode(episode) }) {
                    Text(label("playEpisode") + episode.title)
                }
                TextButton(onClick = {
                    library.toggleFavoriteEpisode(episode.title, episode.url)
                    favorites = library.favorites()
                }) { Text(label(if (episode.url in favorites) "removeFavorite" else "addFavorite") + episode.title) }
            }
        }
        chosen?.let { current ->
            Text(current.title, style = MaterialTheme.typography.titleMedium)
            androidx.compose.foundation.layout.Row {
                Button(onClick = {
                    runCatching {
                        if (player.isPlaying) { player.pause(); playing = false }
                        else { player.start(); playing = true }
                    }
                }) { Text(label(if (playing) "pause" else "play")) }
                TextButton(onClick = {
                    runCatching { player.seekTo((player.currentPosition - 30_000).coerceAtLeast(0)) }
                }) { Text(label("skipBack")) }
                TextButton(onClick = {
                    runCatching { player.seekTo((player.currentPosition + 30_000)
                        .coerceAtMost(player.duration.coerceAtLeast(0))) }
                }) { Text(label("skipForward")) }
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
                Text(label("source"))
            }
        }
        Text(label("episodes"), style = MaterialTheme.typography.titleMedium,
            modifier = Modifier.semantics { heading() })
       }
      }
            items(episodes.take(visibleEpisodes), key = { it.url }) { episode ->
              Column {
                OutlinedButton(modifier = Modifier.fillMaxWidth(), onClick = {
                    playEpisode(episode)
                }) { Text(episode.title) }
                TextButton(onClick = {
                    val added = library.toggleFavoriteEpisode(episode.title, episode.url)
                    favorites = library.favorites()
                    libraryNotice = label(if (added) "added" else "removed")
                }) { Text(label(if (episode.url in favorites) "removeFavorite" else "addFavorite") + episode.title) }
              }
            }
            if (episodes.size > visibleEpisodes) {
                item {
                    TextButton(onClick = { visibleEpisodes += 10 }, modifier = Modifier.fillMaxWidth()) {
                        Text(label("more"))
                    }
                }
            }
    }
}
