package com.tifloacosta.nativeprototype

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

data class YouTubeNativeSearchPage(
    val videos: List<CatalogItem> = emptyList(),
    val nextPage: String = ""
)

object NativeYouTubeSearchRepository {
    suspend fun search(query: String, token: String = ""): YouTubeNativeSearchPage =
        withContext(Dispatchers.IO) {
            require(query.trim().length >= 2 && query.length <= 150)
            val url = StringBuilder("https://youtube-auth.tifloacosta.com/search?q=")
                .append(URLEncoder.encode(query.trim(), "UTF-8"))
            if (token.isNotBlank()) url.append("&pageToken=")
                .append(URLEncoder.encode(token, "UTF-8"))
            val connection = (URL(url.toString()).openConnection() as HttpURLConnection)
            connection.connectTimeout = 12_000
            connection.readTimeout = 12_000
            connection.instanceFollowRedirects = false
            try {
                check(connection.responseCode == 200) { "YouTube search unavailable" }
                val input = connection.inputStream.use { stream ->
                    val buffer = ByteArray(8192)
                    val out = java.io.ByteArrayOutputStream()
                    var count = 0
                    while (true) {
                        val n = stream.read(buffer)
                        if (n < 0) break
                        count += n
                        require(count <= 1_000_000)
                        out.write(buffer, 0, n)
                    }
                    JSONObject(out.toString("UTF-8"))
                }
                val items = input.optJSONArray("items")
                val list = (0 until (items?.length() ?: 0)).mapNotNull { i ->
                    val obj = items?.optJSONObject(i) ?: return@mapNotNull null
                    val id = obj.optString("id")
                    if (!id.matches(Regex("[A-Za-z0-9_-]{11}"))) return@mapNotNull null
                    CatalogItem(
                        id = id, title = obj.optString("title"),
                        language = "es", category = "youtube",
                        categories = listOf("youtube"),
                        summary = obj.optString("description"),
                        url = "https://www.youtube.com/watch?v=" + id
                    )
                }
                YouTubeNativeSearchPage(list, input.optString("nextPageToken"))
            } finally { connection.disconnect() }
        }
}

@Composable
fun NativeYouTubeSearch(
    english: Boolean,
    account: NativeYouTubeAccount,
    onAuthorize: () -> Unit,
    onPlay: (CatalogItem) -> Unit
) {
    val scope = rememberCoroutineScope()
    var input by remember { mutableStateOf("") }
    var lastQuery by remember { mutableStateOf("") }
    var page by remember { mutableStateOf(YouTubeNativeSearchPage()) }
    var results by remember { mutableStateOf<List<CatalogItem>>(emptyList()) }
    var busy by remember { mutableStateOf(false) }
    var status by remember { mutableStateOf("") }

    fun search(more: Boolean) {
        val q = if (more) lastQuery else input.trim()
        if (q.length < 2 || busy || (more && page.nextPage.isBlank())) return
        busy = true
        status = if (english) "Searching YouTube" else "Buscando en YouTube"
        scope.launch {
            try {
                val next = NativeYouTubeSearchRepository.search(q, if (more) page.nextPage else "")
                lastQuery = q
                page = next
                results = if (more) results + next.videos else next.videos
                status = if (english) "${results.size} results" else "${results.size} resultados"
            } catch (_: Exception) {
                status = if (english) "YouTube search unavailable" else "No se pudo completar la búsqueda de YouTube"
            } finally { busy = false }
        }
    }

    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(if (english) "Search public YouTube videos" else "Buscar vídeos públicos de YouTube",
            style = MaterialTheme.typography.titleMedium)
        OutlinedTextField(input, { input = it.take(150) }, modifier = Modifier.fillMaxWidth(),
            label = { Text(if (english) "YouTube search" else "Búsqueda en YouTube") },
            singleLine = true)
        Button(enabled = !busy && input.trim().length >= 2, onClick = { search(false) }) {
            Text(if (english) "Search" else "Buscar")
        }
        if (status.isNotEmpty()) Text(status)
        if (results.isNotEmpty()) {
            LazyColumn(modifier = Modifier.heightIn(max = 240.dp)) {
                items(results, key = { it.id }) { item ->
                    NativeYouTubeListRow(item = item, english = english,
                        account = account, onAuthorize = onAuthorize,
                        onPlay = { onPlay(item) })
                }
                if (page.nextPage.isNotBlank()) {
                    item { TextButton(enabled = !busy, onClick = { search(true) }) {
                        Text(if (english) "Show ten more" else "Mostrar diez más")
                    } }
                }
            }
        }
    }
}
