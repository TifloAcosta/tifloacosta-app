package com.tifloacosta.nativeprototype

import android.content.Context
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TextField
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import org.xmlpull.v1.XmlPullParser
import org.xmlpull.v1.XmlPullParserFactory
import java.io.IOException
import java.io.StringReader
import java.net.HttpURLConnection
import java.net.URI
import java.net.URL

data class ReaderCatalog(val name: String, val url: String)
data class ReaderCatalogEntry(
    val title: String,
    val author: String = "",
    val link: String = "",
    val navigation: String = "",
    val mime: String = ""
)
data class ReaderCatalogPage(val entries: List<ReaderCatalogEntry>, val next: String = "")

/** Secure public OPDS v1 Atom / OPDS v2 JSON catalog access. */
object NativeReaderOPDS {
    val gutenberg = ReaderCatalog("Proyecto Gutenberg", "https://www.gutenberg.org/ebooks/search.opds/")
    private const val MAX_FEED = 5 * 1024 * 1024

    fun secure(link: String, origin: String = ""): String {
        val uri = try { if (origin.isNotBlank()) URI(origin).resolve(link) else URI(link) }
            catch (_: Exception) { throw IOException("La dirección del catálogo es inválida.") }
        if (!uri.scheme.equals("https", true) || uri.host.isNullOrBlank() ||
            uri.userInfo != null) throw IOException("Solo se admiten enlaces HTTPS de bibliotecas.")
        return uri.toString()
    }

    private fun fetch(url: String, limit: Int): ByteArray {
        val connection = URL(secure(url)).openConnection() as HttpURLConnection
        connection.connectTimeout = 12000
        connection.readTimeout = 20000
        connection.setRequestProperty("Accept", "application/atom+xml,application/opds+json,application/json,application/epub+zip,*/*")
        try {
            if (connection.responseCode !in 200..299) throw IOException("La biblioteca no está disponible.")
            secure(connection.url.toString())
            return connection.inputStream.use { NativeReaderFormats.readBounded(it, limit) }
        } finally { connection.disconnect() }
    }

    fun page(address: String): ReaderCatalogPage {
        val url = secure(address)
        val body = fetch(url, MAX_FEED).toString(Charsets.UTF_8).trim()
        return if (body.startsWith("{")) parseJSON(body, url) else parseAtom(body, url)
    }

    private fun relOpen(s: String) =
        s.split(' ').any { it == "http://opds-spec.org/acquisition" ||
            it == "http://opds-spec.org/acquisition/open-access" }
    private fun supported(url: String, mime: String): Boolean {
        return formatOf(url, mime) in NativeReaderFormats.supported
    }

    fun formatOf(address: String, mime: String): String {
        val value = mime.substringBefore(";").lowercase()
        val fromMime = mapOf(
            "application/epub+zip" to "epub", "application/pdf" to "pdf",
            "text/plain" to "txt", "text/html" to "html", "application/zip" to "zip",
            "audio/mpeg" to "mp3", "audio/mp4" to "m4a",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document" to "docx",
            "application/vnd.openxmlformats-officedocument.presentationml.presentation" to "pptx",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" to "xlsx"
        )[value]
        return fromMime ?: try { URI(address).path.substringAfterLast('.').lowercase() }
            catch (_: Exception) { "" }
    }

    private fun parseAtom(body: String, base: String): ReaderCatalogPage {
        val parser = XmlPullParserFactory.newInstance().newPullParser()
        parser.setInput(StringReader(body))
        val result = mutableListOf<ReaderCatalogEntry>()
        var inside = false
        var author = false
        var title = ""
        var creator = ""
        var link = ""
        var nav = ""
        var mime = ""
        var next = ""
        var field = ""
        while (parser.eventType != XmlPullParser.END_DOCUMENT) {
            when (parser.eventType) {
                XmlPullParser.START_TAG -> {
                    val name = parser.name.substringAfter(':').lowercase()
                    when {
                        name == "entry" -> {
                            inside = true
                            title = ""; creator = ""; link = ""; nav = ""; mime = ""
                        }
                        name == "author" -> author = true
                        name == "title" || (name == "name" && author) -> field = name
                        name == "link" -> {
                            val href = parser.getAttributeValue(null, "href") ?: ""
                            val rel = parser.getAttributeValue(null, "rel") ?: ""
                            val type = parser.getAttributeValue(null, "type") ?: ""
                            val safe = try { secure(href, base) } catch (_: Exception) { "" }
                            if (safe.isNotBlank()) {
                                if (inside && relOpen(rel) && supported(safe, type) && link.isBlank()) {
                                    link = safe; mime = type
                                } else if (inside && (rel == "subsection" ||
                                    rel == "alternate" || type.contains("atom+xml")) && nav.isBlank()) {
                                    nav = safe
                                } else if (!inside && rel == "next") next = safe
                            }
                        }
                    }
                }
                XmlPullParser.TEXT -> if (inside) {
                    when (field) {
                        "title" -> title += parser.text
                        "name" -> creator += parser.text
                    }
                }
                XmlPullParser.END_TAG -> {
                    val name = parser.name.substringAfter(':').lowercase()
                    if (name == field) field = ""
                    if (name == "author") author = false
                    if (name == "entry") {
                        if (title.isNotBlank())
                            result.add(ReaderCatalogEntry(title.trim(), creator.trim(), link, nav, mime))
                        inside = false
                    }
                }
            }
            parser.next()
        }
        return ReaderCatalogPage(result.take(100), next)
    }

    private fun parseJSON(body: String, base: String): ReaderCatalogPage {
        val root = JSONObject(body)
        val links = root.optJSONArray("links") ?: JSONArray()
        var next = ""
        for (i in 0 until links.length()) {
            val l = links.optJSONObject(i) ?: continue
            if (l.optString("rel") == "next") {
                next = try { secure(l.optString("href"), base) } catch (_: Exception) { "" }
            }
        }
        val entries = mutableListOf<ReaderCatalogEntry>()
        for (group in listOf("navigation", "publications")) {
            val array = root.optJSONArray(group) ?: continue
            for (i in 0 until array.length()) {
                val item = array.optJSONObject(i) ?: continue
                val metadata = item.optJSONObject("metadata") ?: JSONObject()
                val title = metadata.optString("title", item.optString("title")).trim()
                if (title.isBlank()) continue
                val author = metadata.optString("author")
                var link = ""
                var nav = ""
                var mime = ""
                val itemLinks = item.optJSONArray("links") ?: JSONArray()
                for (j in 0 until itemLinks.length()) {
                    val l = itemLinks.optJSONObject(j) ?: continue
                    val rels = l.optJSONArray("rel")
                    val rel = if (rels != null) (0 until rels.length()).joinToString(" ") {
                        rels.optString(it) } else l.optString("rel")
                    val candidate = try { secure(l.optString("href"), base) } catch (_: Exception) { "" }
                    val type = l.optString("type")
                    if (candidate.isNotBlank() && relOpen(rel) && supported(candidate, type) && link.isBlank()) {
                        link = candidate; mime = type
                    } else if (candidate.isNotBlank() && (type.contains("opds") ||
                        type.contains("atom")) && nav.isBlank()) nav = candidate
                }
                if (nav.isBlank() && item.has("href")) nav = try {
                    secure(item.optString("href"), base)
                } catch (_: Exception) { "" }
                entries.add(ReaderCatalogEntry(title, author, link, nav, mime))
            }
        }
        return ReaderCatalogPage(entries.take(100), next)
    }

    fun download(entry: ReaderCatalogEntry): Pair<String, ByteArray> {
        if (entry.link.isBlank()) throw IOException("Este catálogo no ofrece una descarga directa.")
        val ext = formatOf(entry.link, entry.mime)
        if (ext !in NativeReaderFormats.supported) throw IOException("Formato de adquisición no compatible.")
        val bytes = fetch(entry.link, NativeReaderFormats.MAX_ARCHIVE_BYTES)
        return ext to bytes
    }
}

@Composable
fun NativeReaderCatalogsScreen(
    english: Boolean,
    onImport: (ReaderCatalogEntry) -> Unit,
    onBack: () -> Unit
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val prefs = remember { context.getSharedPreferences("reader-opds-catalogs", Context.MODE_PRIVATE) }
    fun readSaved(): List<ReaderCatalog> {
        val array = try { JSONArray(prefs.getString("sources", "[]")) } catch (_: Exception) { JSONArray() }
        return (0 until array.length()).mapNotNull {
            val ob = array.optJSONObject(it) ?: return@mapNotNull null
            ReaderCatalog(ob.optString("name"), ob.optString("url")).takeIf { c ->
                c.name.isNotBlank() && c.url.isNotBlank()
            }
        }
    }
    var catalogs by remember { mutableStateOf(readSaved()) }
    var page by remember { mutableStateOf<ReaderCatalogPage?>(null) }
    var url by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf("") }
    var add by remember { mutableStateOf(false) }
    var newName by remember { mutableStateOf("") }
    var newUrl by remember { mutableStateOf("") }

    fun open(target: String) {
        error = ""
        loading = true
        scope.launch {
            try {
                val result = withContext(Dispatchers.IO) { NativeReaderOPDS.page(target) }
                url = target
                page = result
            } catch (e: Exception) { error = e.message.orEmpty() }
            finally { loading = false }
        }
    }

    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        TextButton(onClick = onBack) { Text(if (english) "Back to import" else "Volver a Importar") }
        Text(if (english) "External libraries (OPDS)" else "Bibliotecas externas (OPDS)")
        if (page == null) {
            OutlinedButton(onClick = { open(NativeReaderOPDS.gutenberg.url) },
                modifier = Modifier.fillMaxWidth()) { Text("Proyecto Gutenberg") }
            catalogs.forEach { library ->
                OutlinedButton(onClick = { open(library.url) },
                    modifier = Modifier.fillMaxWidth()) { Text(library.name) }
            }
            Button(onClick = { add = !add }) { Text(if (english) "Add library" else "Añadir biblioteca") }
            if (add) {
                TextField(value = newName, onValueChange = { newName = it.take(80) },
                    label = { Text(if (english) "Catalog name" else "Nombre del catálogo") })
                TextField(value = newUrl, onValueChange = { newUrl = it },
                    label = { Text(if (english) "OPDS HTTPS URL" else "Dirección HTTPS OPDS") })
                Button(onClick = {
                    try {
                        val link = NativeReaderOPDS.secure(newUrl.trim())
                        if (newName.isBlank() || catalogs.any { it.url == link } ||
                            link == NativeReaderOPDS.gutenberg.url) {
                            error = "Nombre o catálogo repetido."
                        } else {
                            catalogs = catalogs + ReaderCatalog(newName.trim(), link)
                            val arr = JSONArray()
                            catalogs.forEach { c ->
                                arr.put(JSONObject().put("name", c.name).put("url", c.url))
                            }
                            prefs.edit().putString("sources", arr.toString()).apply()
                            add = false
                            newName = ""
                            newUrl = ""
                        }
                    } catch (e: Exception) { error = e.message.orEmpty() }
                }) { Text(if (english) "Save library" else "Guardar biblioteca") }
            }
        } else {
            TextButton(onClick = { page = null }) {
                Text(if (english) "All libraries" else "Todas las bibliotecas")
            }
            val available = page!!
            if (available.entries.isEmpty()) Text(if (english) "No entries" else "Sin obras")
            available.entries.forEach { entry ->
                OutlinedButton(
                    modifier = Modifier.fillMaxWidth(),
                    onClick = {
                        if (entry.link.isNotBlank()) onImport(entry)
                        else if (entry.navigation.isNotBlank()) open(entry.navigation)
                    }
                ) {
                    Text(entry.title + (if (entry.author.isNotBlank()) ", " + entry.author else ""))
                }
            }
            if (available.next.isNotBlank()) {
                Button(onClick = { open(available.next) }) {
                    Text(if (english) "Next page" else "Página siguiente")
                }
            }
        }
        if (loading) Text(if (english) "Loading catalog" else "Cargando catálogo")
        if (error.isNotBlank()) Text(error)
    }
}
