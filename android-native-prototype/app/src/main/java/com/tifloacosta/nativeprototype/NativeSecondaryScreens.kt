package com.tifloacosta.nativeprototype

import android.app.DownloadManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Environment
import android.provider.Settings
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import org.json.JSONArray
import org.json.JSONObject

/** Only Android/Compose destinations. No WebView is needed to use these screens. */
object NativeDestinations {
    const val SEARCH = 4
    const val NEW_CONTENT = 5
    const val DOWNLOADS = 6
    const val FAVORITES = 7
    const val PODCAST = 8
    const val CONTACT = 9
    const val PRIVACY = 10
    const val SETTINGS = 11
    const val SOUND_SEARCH = 12
    const val YOUTUBE_SEARCH = 13
}

/** Separate from the reader's bookmarks and folders. Never clear older localStorage. */
class NativeContentFavorites(context: Context) {
    private val prefs = context.getSharedPreferences("native-content-favorites-v1", Context.MODE_PRIVATE)
    private val key = "favorites"

    @Synchronized fun list(): List<Pair<String, String>> {
        return try {
            val array = JSONArray(prefs.getString(key, "[]"))
            (0 until array.length()).mapNotNull { i ->
                val entry = array.optJSONObject(i) ?: return@mapNotNull null
                val kind = entry.optString("kind")
                val id = entry.optString("id")
                if (kind !in setOf("news", "resource", "video") || id.isBlank()) null
                else kind to id
            }.distinct()
        } catch (_: Exception) { emptyList() }
    }

    @Synchronized fun toggle(kind: String, id: String): Boolean {
        if (kind !in setOf("news", "resource", "video") || id.isBlank()) return false
        val current = list().toMutableList()
        val ref = kind to id
        val active = if (current.contains(ref)) { current.remove(ref); false }
            else { current.add(ref); true }
        val payload = JSONArray()
        current.forEach { (k, i) -> payload.put(JSONObject().put("kind", k).put("id", i)) }
        if (!prefs.edit().putString(key, payload.toString()).commit()) return !active
        return active
    }
}

internal fun nativeExternal(context: Context, url: String): Boolean {
    if (!MediaLogic.validWebUrl(url)) return false
    return try {
        context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
        true
    } catch (_: Exception) { false }
}

@Composable
private fun NativeCatalogResult(
    item: CatalogItem,
    kind: String,
    english: Boolean,
    favorites: NativeContentFavorites,
    onOpenVideo: (CatalogItem) -> Unit,
    onFavoriteChange: () -> Unit
) {
    val context = LocalContext.current
    var details by remember(item.id, kind) { mutableStateOf(false) }
    Column(modifier = Modifier.fillMaxWidth().padding(vertical = 5.dp)) {
        OutlinedButton(modifier = Modifier.fillMaxWidth(), onClick = {
            if (kind == "video") onOpenVideo(item) else details = true
        }) {
            Text(item.title)
        }
        if (favorites.list().contains(kind to item.id)) {
            Text(if (english) "Favorite" else "Favorito")
        }
    }
    if (details) AlertDialog(
        onDismissRequest = { details = false },
        title = { Text(item.title) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(item.summary.ifBlank { if (english) "No additional description" else "Sin descripción adicional" })
                TextButton(onClick = {
                    favorites.toggle(kind, item.id)
                    onFavoriteChange()
                }) {
                    Text(if (favorites.list().contains(kind to item.id))
                        (if (english) "Remove favorite" else "Quitar favorito")
                    else (if (english) "Add favorite" else "Añadir a favoritos"))
                }
            }
        },
        confirmButton = {
            if (item.url.isNotBlank()) TextButton(onClick = {
                nativeExternal(context, item.url)
            }) { Text(if (english) "Open source" else "Abrir origen") }
        },
        dismissButton = { TextButton(onClick = { details = false }) {
            Text(if (english) "Close" else "Cerrar")
        } }
    )
}

@Composable
fun NativeSecondaryScreen(
    destination: Int,
    english: Boolean,
    catalog: Catalog,
    media: List<MediaItem>,
    initialText: String = "",
    onBack: () -> Unit,
    onOpenVideo: (CatalogItem) -> Unit,
    onSearchYouTube: () -> Unit
) {
    val context = LocalContext.current
    val favorites = remember(context) { NativeContentFavorites(context.applicationContext) }
    var favoriteGeneration by remember { mutableIntStateOf(0) }
    var query by rememberSaveable(destination, initialText) {
        mutableStateOf(if (destination == NativeDestinations.SEARCH) initialText else "")
    }
    var status by remember(destination) { mutableStateOf("") }
    var showSounds by rememberSaveable(destination) { mutableStateOf(false) }
    val all = catalog.news.map { "news" to it } +
        catalog.resources.map { "resource" to it } +
        catalog.videos.map { "video" to it }
    val lang = if (english) "en" else "es"
    val filtered = when (destination) {
        NativeDestinations.NEW_CONTENT -> all.filter {
            it.first == "resource" && it.second.language == lang && it.second.isNew
        }.sortedByDescending { it.second.newsDate }
        NativeDestinations.FAVORITES -> {
            favoriteGeneration
            val refs = favorites.list().toSet()
            all.filter { (kind, item) -> refs.contains(kind to item.id) }
        }
        NativeDestinations.SEARCH -> all.filter { (_, item) ->
            item.language == lang && query.length >= 2 &&
                (item.title.contains(query.trim(), ignoreCase = true) ||
                    item.summary.contains(query.trim(), ignoreCase = true))
        }
        else -> emptyList()
    }
    val heading = when (destination) {
        NativeDestinations.SEARCH -> if (english) "Search" else "Buscar"
        NativeDestinations.NEW_CONTENT -> if (english) "What's new" else "Novedades"
        NativeDestinations.DOWNLOADS -> if (english) "Downloads" else "Descargas"
        NativeDestinations.FAVORITES -> if (english) "Favorites" else "Favoritos"
        NativeDestinations.PODCAST -> "Podcasts"
        NativeDestinations.CONTACT -> if (english) "Contact" else "Contacto"
        NativeDestinations.PRIVACY -> if (english) "Privacy and accessibility" else "Privacidad y accesibilidad"
        NativeDestinations.SETTINGS -> if (english) "Settings" else "Configuración"
        NativeDestinations.SOUND_SEARCH -> if (english) "Sound effects" else "Bancos de sonidos"
        else -> if (english) "YouTube search" else "Buscar en YouTube"
    }
    Column(modifier = Modifier.fillMaxWidth().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp)) {
        TextButton(onClick = onBack) { Text(if (english) "Back" else "Volver") }
        Text(heading, style = MaterialTheme.typography.headlineSmall,
            modifier = Modifier.semantics { heading() })
        if (destination in setOf(NativeDestinations.SEARCH, NativeDestinations.NEW_CONTENT, NativeDestinations.FAVORITES)) {
            if (destination == NativeDestinations.SEARCH) {
                OutlinedTextField(query, { query = it.take(160) },
                    label = { Text(if (english) "Search news, resources and videos" else "Buscar noticias, recursos y vídeos") },
                    modifier = Modifier.fillMaxWidth(), singleLine = true)
            }
            if (filtered.isEmpty()) Text(if (english) "No results" else "Sin resultados")
            else {
                Text(if (english) "${filtered.size} results" else "${filtered.size} resultados")
                LazyColumn {
                    items(filtered, key = { it.first + ":" + it.second.id }) { (kind, item) ->
                        NativeCatalogResult(item, kind, english, favorites, onOpenVideo) {
                            favoriteGeneration++
                        }
                    }
                }
            }
        } else when (destination) {
            NativeDestinations.DOWNLOADS -> {
                if (showSounds) {
                    TextButton(onClick = { showSounds = false }) {
                        Text(if (english) "Back to Downloads" else "Volver a Descargas")
                    }
                    NativeSoundSearchScreen(english)
                } else {
                    TextButton(onClick = { showSounds = true }) {
                        Text(if (english) "Search sound effects" else "Buscar efectos de sonido")
                    }
                    NativeDownloadScreen(english, initialText)
                }
            }
            NativeDestinations.PODCAST -> NativePodcastScreen(english, media)
            NativeDestinations.CONTACT -> NativeContactScreen(english)
            NativeDestinations.PRIVACY -> NativePrivacyScreen(english)
            NativeDestinations.SETTINGS -> NativeSettingsScreen(english)
            NativeDestinations.SOUND_SEARCH -> NativeSoundSearchScreen(english)
            NativeDestinations.YOUTUBE_SEARCH -> {
                Text(if (english) "Public YouTube results" else "Resultados públicos de YouTube")
                TextButton(onClick = onSearchYouTube) {
                    Text(if (english) "Search videos" else "Buscar vídeos")
                }
            }
        }
        if (status.isNotEmpty()) Text(status)
    }
}

@Composable
private fun NativeContactScreen(english: Boolean) {
    val context = LocalContext.current
    val contacts = listOf(
        "WhatsApp" to "https://wa.me/34603516398",
        "Instagram" to "https://www.instagram.com/tifloacosta/",
        "Facebook" to "https://www.facebook.com/profile.php?id=61586738581998"
    )
    var book by rememberSaveable { mutableStateOf(false) }
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(if (english) "Direct contact" else "Contacto directo",
            style = MaterialTheme.typography.titleMedium)
        contacts.forEach { (label, url) ->
            Button(modifier = Modifier.fillMaxWidth(), onClick = { nativeExternal(context, url) }) {
                Text(label)
            }
        }
        Button(modifier = Modifier.fillMaxWidth(), onClick = {
            val email = Intent(Intent.ACTION_SENDTO, Uri.parse("mailto:tifloacosta@gmail.com"))
            runCatching { context.startActivity(email) }
        }) { Text(if (english) "Send email" else "Enviar correo") }
        OutlinedButton(modifier = Modifier.fillMaxWidth(), onClick = { book = true }) {
            Text(if (english) "My book" else "Mi libro")
        }
    }
    if (book) AlertDialog(
        onDismissRequest = { book = false },
        title = { Text("La vida vista desde donde estoy") },
        text = { Text(if (english) "Tony Acosta's book, available in print and Kindle." else
            "Libro de Tony Acosta, disponible en papel y Kindle.") },
        confirmButton = { TextButton(onClick = {
            nativeExternal(context, "https://www.amazon.es/s?k=9798185909218&i=stripbooks")
        }) { Text(if (english) "Print edition" else "Edición en papel") } },
        dismissButton = { TextButton(onClick = { book = false }) { Text(if (english) "Close" else "Cerrar") } }
    )
}

@Composable
private fun NativePrivacyScreen(english: Boolean) {
    val context = LocalContext.current
    Column(verticalArrangement = Arrangement.spacedBy(9.dp)) {
        Text(if (english)
            "You can use TifloAcosta without creating an account."
            else "Puedes utilizar TifloAcosta sin crear una cuenta.")
        Text(if (english)
            "Imported documents, reading progress and bookmarks remain in the app's private storage."
            else "Los documentos, las posiciones de lectura y las marcas permanecen en el almacenamiento privado de la aplicación.")
        Text(if (english)
            "Notifications are optional. You can change Android permissions in system settings."
            else "Las notificaciones son opcionales. Puedes cambiar los permisos desde los ajustes de Android.")
        Text(if (english)
            "You control when a document or link is shared with another app."
            else "Tú decides cuándo compartir un documento o enlace con otras aplicaciones.")
        Button(onClick = { nativeExternal(context, "https://tifloacosta.com/privacidad/") }) {
            Text(if (english) "Full privacy policy" else "Política de privacidad completa")
        }
    }
}

@Composable
private fun NativeSettingsScreen(english: Boolean) {
    val context = LocalContext.current
    val prefs = remember(context) {
        context.getSharedPreferences("native-app-settings-v1", Context.MODE_PRIVATE)
    }
    var language by remember { mutableStateOf(prefs.getString("language", "") ?: "") }
    var theme by remember { mutableStateOf(prefs.getString("theme", "system") ?: "system") }
    var enlarged by remember { mutableStateOf(prefs.getBoolean("enlarged", false)) }
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text(if (english) "Language" else "Idioma", style = MaterialTheme.typography.titleMedium)
        listOf("es" to "Español", "en" to "English").forEach { (code, label) ->
            OutlinedButton(modifier = Modifier.fillMaxWidth(), onClick = {
                language = code; prefs.edit().putString("language", code).apply()
            }) { Text(label + if (language == code) " ✓" else "") }
        }
        Text(if (english) "Appearance" else "Aspecto", style = MaterialTheme.typography.titleMedium)
        listOf("system" to (if (english) "System" else "Sistema"),
            "light" to (if (english) "Light" else "Claro"),
            "dark" to (if (english) "Dark" else "Oscuro")).forEach { (code, label) ->
            OutlinedButton(modifier = Modifier.fillMaxWidth(), onClick = {
                theme = code; prefs.edit().putString("theme", code).apply()
            }) { Text(label + if (theme == code) " ✓" else "") }
        }
        androidx.compose.foundation.layout.Row {
            Checkbox(checked = enlarged, onCheckedChange = {
                enlarged = it; prefs.edit().putBoolean("enlarged", it).apply()
            })
            Text(if (english) "Larger text" else "Texto más grande")
        }
        Text(if (english)
            "Settings are saved on this device. Reader voice settings are inside TifloLector."
            else "Los ajustes se guardan en este dispositivo. Las voces se configuran dentro de TifloLector.")
        Button(onClick = {
            prefs.edit().putBoolean("push-consent", true).apply()
            val consent = Intent("com.tifloacosta.app.ENABLE_NOTIFICATIONS").apply {
                setClassName(context.packageName, "com.tifloacosta.app.NativePushConsentReceiver")
            }
            runCatching { context.sendBroadcast(consent) }
        }) {
            Text(if (english) "Enable notifications" else "Activar notificaciones")
        }
        Button(onClick = {
            val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                Uri.parse("package:" + context.packageName))
            runCatching { context.startActivity(intent) }
        }) { Text(if (english) "Android notification permissions" else "Permisos y notificaciones de Android") }
    }
}
