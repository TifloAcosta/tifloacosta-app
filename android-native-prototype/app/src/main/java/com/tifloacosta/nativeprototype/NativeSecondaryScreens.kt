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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
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
    val uiLanguage = LocalNativeUiLanguage.current
    var details by remember(item.id, kind) { mutableStateOf(false) }
    Column(modifier = Modifier.fillMaxWidth().padding(vertical = 5.dp)) {
        OutlinedButton(modifier = Modifier.fillMaxWidth(), onClick = {
            if (kind == "video") onOpenVideo(item) else details = true
        }) {
            Text(item.title)
        }
        if (favorites.list().contains(kind to item.id)) {
            Text(NativeSecondaryStrings.get(uiLanguage, "favorite"))
        }
    }
    if (details) AlertDialog(
        onDismissRequest = { details = false },
        title = { Text(item.title) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(item.summary.ifBlank { NativeSecondaryStrings.get(uiLanguage, "noDescription") })
                TextButton(onClick = {
                    favorites.toggle(kind, item.id)
                    onFavoriteChange()
                }) {
                    Text(if (favorites.list().contains(kind to item.id))
                        NativeSecondaryStrings.get(uiLanguage, "remove")
                    else NativeSecondaryStrings.get(uiLanguage, "add"))
                }
            }
        },
        confirmButton = {
            if (item.url.isNotBlank()) TextButton(onClick = {
                nativeExternal(context, item.url)
            }) { Text(NativeSecondaryStrings.get(uiLanguage, "openSource")) }
        },
        dismissButton = { TextButton(onClick = { details = false }) {
            Text(NativeSecondaryStrings.get(uiLanguage, "close"))
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
    val uiLanguage = LocalNativeUiLanguage.current
    val filtered = when (destination) {
        NativeDestinations.NEW_CONTENT -> all.filter {
            it.first == "resource" && it.second.isNew
        }.sortedByDescending { it.second.newsDate }
        NativeDestinations.FAVORITES -> {
            favoriteGeneration
            val refs = favorites.list().toSet()
            all.filter { (kind, item) -> refs.contains(kind to item.id) }
        }
        NativeDestinations.SEARCH -> all.filter { (_, item) ->
            query.length >= 2 &&
                (item.title.contains(query.trim(), ignoreCase = true) ||
                    item.summary.contains(query.trim(), ignoreCase = true))
        }
        else -> emptyList()
    }
    val heading = when (destination) {
        NativeDestinations.SEARCH -> NativeUiText.get(uiLanguage, "search")
        NativeDestinations.NEW_CONTENT -> NativeUiText.get(uiLanguage, "newContent")
        NativeDestinations.DOWNLOADS -> NativeUiText.get(uiLanguage, "downloads")
        NativeDestinations.FAVORITES -> NativeUiText.get(uiLanguage, "favorites")
        NativeDestinations.PODCAST -> NativePodcastStrings.get(uiLanguage, "title")
        NativeDestinations.CONTACT -> NativeUiText.get(uiLanguage, "contact")
        NativeDestinations.PRIVACY -> NativeUiText.get(uiLanguage, "privacy")
        NativeDestinations.SETTINGS -> NativeUiText.get(uiLanguage, "settings")
        NativeDestinations.SOUND_SEARCH -> NativeUiText.get(uiLanguage, "sounds")
        else -> NativeUiText.get(uiLanguage, "youtubeSearch")
    }
    Column(modifier = Modifier.fillMaxWidth().padding(16.dp).then(
        if (destination == NativeDestinations.SETTINGS) Modifier.verticalScroll(rememberScrollState())
        else Modifier
    ),
        verticalArrangement = Arrangement.spacedBy(6.dp)) {
        TextButton(onClick = onBack) { Text(NativeUiText.get(uiLanguage, "back")) }
        Text(heading, style = MaterialTheme.typography.headlineSmall,
            modifier = Modifier.semantics { heading() })
        if (destination in setOf(NativeDestinations.SEARCH, NativeDestinations.NEW_CONTENT, NativeDestinations.FAVORITES)) {
            if (destination == NativeDestinations.SEARCH) {
                OutlinedTextField(query, { query = it.take(160) },
                    label = { Text(NativeSecondaryStrings.get(uiLanguage, "searchLabel")) },
                    modifier = Modifier.fillMaxWidth(), singleLine = true)
            }
            if (filtered.isEmpty()) Text(NativeSecondaryStrings.get(uiLanguage, "empty"))
            else {
                Text("${filtered.size} " + NativeSecondaryStrings.get(uiLanguage, "result"))
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
                        Text(NativeSecondaryStrings.get(uiLanguage, "backDownloads"))
                    }
                    NativeSoundSearchScreen(english)
                } else {
                    TextButton(onClick = { showSounds = true }) {
                        Text(NativeSecondaryStrings.get(uiLanguage, "sounds"))
                    }
                    NativeDownloadScreen(english, initialText)
                }
            }
            NativeDestinations.PODCAST -> NativePodcastScreen(english, media)
            NativeDestinations.CONTACT -> NativeContactScreen()
            NativeDestinations.PRIVACY -> NativePrivacyScreen()
            NativeDestinations.SETTINGS -> NativeSettingsScreen(english)
            NativeDestinations.SOUND_SEARCH -> NativeSoundSearchScreen(english)
            NativeDestinations.YOUTUBE_SEARCH -> {
                Text(NativeSecondaryStrings.get(uiLanguage, "youtubeResults"))
                TextButton(onClick = onSearchYouTube) {
                    Text(NativeSecondaryStrings.get(uiLanguage, "searchVideos"))
                }
            }
        }
        if (status.isNotEmpty()) Text(status)
    }
}

@Composable
private fun NativeContactScreen() {
    val context = LocalContext.current
    val uiLanguage = LocalNativeUiLanguage.current
    val contacts = listOf(
        "WhatsApp" to "https://wa.me/34603516398",
        "Instagram" to "https://www.instagram.com/tifloacosta/",
        "Facebook" to "https://www.facebook.com/profile.php?id=61586738581998"
    )
    var book by rememberSaveable { mutableStateOf(false) }
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(NativeSettingsDetailStrings.get(uiLanguage, "directContact"),
            style = MaterialTheme.typography.titleMedium)
        contacts.forEach { (label, url) ->
            Button(modifier = Modifier.fillMaxWidth(), onClick = { nativeExternal(context, url) }) {
                Text(label)
            }
        }
        Button(modifier = Modifier.fillMaxWidth(), onClick = {
            val email = Intent(Intent.ACTION_SENDTO, Uri.parse("mailto:tifloacosta@gmail.com"))
            runCatching { context.startActivity(email) }
        }) { Text(NativeSettingsDetailStrings.get(uiLanguage, "email")) }
        OutlinedButton(modifier = Modifier.fillMaxWidth(), onClick = { book = true }) {
            Text(NativeSettingsDetailStrings.get(uiLanguage, "myBook"))
        }
    }
    if (book) AlertDialog(
        onDismissRequest = { book = false },
        title = { Text("La vida vista desde donde estoy") },
        text = { Text(NativeSettingsDetailStrings.get(uiLanguage, "bookDescription")) },
        confirmButton = { TextButton(onClick = {
            nativeExternal(context, "https://www.amazon.es/s?k=9798185909218&i=stripbooks")
        }) { Text(NativeSettingsDetailStrings.get(uiLanguage, "print")) } },
        dismissButton = { TextButton(onClick = { book = false }) { Text(NativeSettingsDetailStrings.get(uiLanguage, "close")) } }
    )
}

@Composable
private fun NativePrivacyScreen() {
    val context = LocalContext.current
    val uiLanguage = LocalNativeUiLanguage.current
    Column(verticalArrangement = Arrangement.spacedBy(9.dp)) {
        Text(NativeSettingsDetailStrings.get(uiLanguage, "account"))
        Text(NativeSettingsDetailStrings.get(uiLanguage, "storage"))
        Text(NativeSettingsDetailStrings.get(uiLanguage, "notifications"))
        Text(NativeSettingsDetailStrings.get(uiLanguage, "sharing"))
        Button(onClick = { nativeExternal(context, "https://tifloacosta.com/privacidad/") }) {
            Text(NativeSettingsDetailStrings.get(uiLanguage, "fullPolicy"))
        }
    }
}

@Composable
private fun NativeAccessibilityScreen() {
    val uiLanguage = LocalNativeUiLanguage.current
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text(NativeSettingsAccessibilityStrings.get(uiLanguage, "talkBack"))
        Text(NativeSettingsAccessibilityStrings.get(uiLanguage, "navigation"))
        Text(NativeSettingsAccessibilityStrings.get(uiLanguage, "largerText"))
        Text(NativeSettingsAccessibilityStrings.get(uiLanguage, "reading"))
        Text(NativeSettingsAccessibilityStrings.get(uiLanguage, "originalContent"))
        Text(NativeSettingsAccessibilityStrings.get(uiLanguage, "feedback"))
    }
}

@Composable
private fun NativeSettingsScreen(english: Boolean) {
    val context = LocalContext.current
    val uiLanguage = LocalNativeUiLanguage.current
    val prefs = remember(context) {
        context.getSharedPreferences("native-app-settings-v1", Context.MODE_PRIVATE)
    }
    var language by remember { mutableStateOf(prefs.getString("language", "") ?: "") }
    var theme by remember { mutableStateOf(prefs.getString("theme", "system") ?: "system") }
    var enlarged by remember { mutableStateOf(prefs.getBoolean("enlarged", false)) }
    var details by rememberSaveable { mutableStateOf("") }
    if (details.isNotEmpty()) {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            TextButton(onClick = { details = "" }) { Text(NativeUiText.get(uiLanguage, "back")) }
            Text(if (details == "guide") NativeUsageGuideStrings.get(uiLanguage, "guide")
                else NativeUiText.get(uiLanguage, details),
                style = MaterialTheme.typography.titleMedium,
                modifier = Modifier.semantics { heading() })
            when (details) {
                "privacy" -> NativePrivacyScreen()
                "accessibility" -> NativeAccessibilityScreen()
                "guide" -> NativeUsageGuideScreen()
                else -> NativeContactScreen()
            }
        }
        return
    }
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text(NativeUiText.get(uiLanguage, "language"), style = MaterialTheme.typography.titleMedium)
        NativeUiText.choices.forEach { (code, label) ->
            OutlinedButton(modifier = Modifier.fillMaxWidth(), onClick = {
                language = code; prefs.edit().putString("language", code).apply()
            }) { Text(label + if (language == code) " ✓" else "") }
        }
        Text(NativeUiText.get(uiLanguage, "appearance"), style = MaterialTheme.typography.titleMedium)
        listOf("system" to NativeUiText.get(uiLanguage, "system"),
            "light" to NativeUiText.get(uiLanguage, "light"),
            "dark" to NativeUiText.get(uiLanguage, "dark")).forEach { (code, label) ->
            OutlinedButton(modifier = Modifier.fillMaxWidth(), onClick = {
                theme = code; prefs.edit().putString("theme", code).apply()
            }) { Text(label + if (theme == code) " ✓" else "") }
        }
        androidx.compose.foundation.layout.Row {
            Checkbox(checked = enlarged, onCheckedChange = {
                enlarged = it; prefs.edit().putBoolean("enlarged", it).apply()
            })
            Text(NativeUiText.get(uiLanguage, "largerText"))
        }
        Text(NativeUiText.get(uiLanguage, "settingsNote"))
        Button(onClick = { details = "guide" }, modifier = Modifier.fillMaxWidth()) {
            Text(NativeUsageGuideStrings.get(uiLanguage, "guide"))
        }
        Button(onClick = { details = "privacy" }, modifier = Modifier.fillMaxWidth()) {
            Text(NativeUiText.get(uiLanguage, "privacy"))
        }
        Button(onClick = { details = "accessibility" }, modifier = Modifier.fillMaxWidth()) {
            Text(NativeUiText.get(uiLanguage, "accessibility"))
        }
        Button(onClick = { details = "contact" }, modifier = Modifier.fillMaxWidth()) {
            Text(NativeUiText.get(uiLanguage, "contact"))
        }
        Button(onClick = {
            prefs.edit().putBoolean("push-consent", true).apply()
            val consent = Intent("com.tifloacosta.app.ENABLE_NOTIFICATIONS").apply {
                setClassName(context.packageName, "com.tifloacosta.app.NativePushConsentReceiver")
            }
            runCatching { context.sendBroadcast(consent) }
        }) {
            Text(NativeUiText.get(uiLanguage, "notifications"))
        }
        Button(onClick = {
            val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                Uri.parse("package:" + context.packageName))
            runCatching { context.startActivity(intent) }
        }) { Text(NativeUiText.get(uiLanguage, "androidPermissions")) }
    }
}
