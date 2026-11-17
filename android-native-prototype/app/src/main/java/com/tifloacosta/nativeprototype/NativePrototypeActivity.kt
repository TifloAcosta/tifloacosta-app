package com.tifloacosta.nativeprototype

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Slider
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Density
import androidx.compose.ui.semantics.CustomAccessibilityAction
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.customActions
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.unit.dp
import java.util.Locale
import kotlin.math.roundToInt

object PrototypeNavigation {
    const val HOME = -1
    const val NEWS = 0
    const val RESOURCES = 1
    const val VIDEOS = 2
    const val READER = 3
    const val MUSIC = 4
    fun parentOf(destination: Int): Int = HOME
}

/** A new share gets a distinct serial even if the same document is shared again. */
private data class SharedReaderFiles(val serial: Int, val uris: List<Uri>)

class NativePrototypeActivity : ComponentActivity() {
    private var serial = 0
    private var pendingSharedFiles by mutableStateOf<SharedReaderFiles?>(null)
    private var pendingSharedText by mutableStateOf<String?>(null)

    @Suppress("DEPRECATION")
    private fun acceptSharedFiles(incoming: Intent?) {
        if (incoming?.action != Intent.ACTION_SEND &&
            incoming?.action != Intent.ACTION_SEND_MULTIPLE) return
        val collected = mutableListOf<Uri>()
        incoming.clipData?.let { clip ->
            for (index in 0 until clip.itemCount.coerceAtMost(40))
                clip.getItemAt(index).uri?.let(collected::add)
        }
        incoming.getParcelableExtra<Uri>(Intent.EXTRA_STREAM)?.let(collected::add)
        incoming.getParcelableArrayListExtra<Uri>(Intent.EXTRA_STREAM)?.let(collected::addAll)
        incoming.data?.let(collected::add)
        val files = collected.distinct().filter { it.scheme == "content" || it.scheme == "file" }.take(40)
        if (files.isNotEmpty()) pendingSharedFiles = SharedReaderFiles(++serial, files)
        if (files.isEmpty() && incoming.action == Intent.ACTION_SEND) {
            pendingSharedText = incoming.getStringExtra(Intent.EXTRA_TEXT)
                ?.trim()?.take(2048)?.takeIf { it.isNotEmpty() }
        }
    }
    val youTubeAccount by lazy { NativeYouTubeAccount(applicationContext) }
    private var oauthCallback by mutableStateOf<Uri?>(null)
    private var requestedReaderBookId by mutableStateOf<String?>(null)
    private var requestedSection by mutableStateOf<String?>(null)
    private var selectedLanguage by mutableStateOf("")
    private var selectedTheme by mutableStateOf("system")
    private var selectedEnlarged by mutableStateOf(false)
    private val settings by lazy { getSharedPreferences("native-app-settings-v1", MODE_PRIVATE) }
    private val settingsListener = android.content.SharedPreferences.OnSharedPreferenceChangeListener { prefs, key ->
        if (key == "language") selectedLanguage = prefs.getString("language", "").orEmpty()
        if (key == "theme") selectedTheme = prefs.getString("theme", "system").orEmpty()
        if (key == "enlarged") selectedEnlarged = prefs.getBoolean("enlarged", false)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        selectedLanguage = settings.getString("language", "").orEmpty()
        selectedTheme = settings.getString("theme", "system").orEmpty()
        selectedEnlarged = settings.getBoolean("enlarged", false)
        settings.registerOnSharedPreferenceChangeListener(settingsListener)
        if (intent?.action == Intent.ACTION_VIEW) oauthCallback = intent?.data
        requestedReaderBookId = intent?.getStringExtra("tiflolector-open-book")
            ?.takeIf { it.isNotBlank() }
        if (savedInstanceState == null) acceptSharedFiles(intent)
        requestedSection = intent?.getStringExtra("tifloacosta-open-section")
        setContent {
            val dark = when (selectedTheme) {
                "dark" -> true
                "light" -> false
                else -> isSystemInDarkTheme()
            }
            val density = LocalDensity.current
            CompositionLocalProvider(LocalNativeUiLanguage provides NativeUiText.normalize(selectedLanguage), LocalDensity provides Density(
                density.density,
                (density.fontScale * if (selectedEnlarged) 1.25f else 1f).coerceAtMost(3.5f)
            )) {
            MaterialTheme(colorScheme = if (dark) darkColorScheme() else lightColorScheme()) {
                PrototypeHome(
                    languageOverride = selectedLanguage,
                    account = youTubeAccount,
                    callback = oauthCallback,
                    onCallbackHandled = { oauthCallback = null },
                    requestedReaderBookId = requestedReaderBookId,
                    onReaderRequestHandled = { requestedReaderBookId = null },
                    requestedSection = requestedSection,
                    onRequestedSectionHandled = { requestedSection = null },
                    sharedFiles = pendingSharedFiles,
                    onSharedFilesHandled = { pendingSharedFiles = null },
                    sharedText = pendingSharedText,
                    onSharedTextHandled = { pendingSharedText = null },
                    onSignIn = {
                        val url = youTubeAccount.startAuthorization()
                        startActivity(Intent(Intent.ACTION_VIEW, url))
                    }
                )
            }
            }
        }
    }

    override fun onDestroy() {
        settings.unregisterOnSharedPreferenceChangeListener(settingsListener)
        super.onDestroy()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        acceptSharedFiles(intent)
        requestedSection = intent.getStringExtra("tifloacosta-open-section")
        if (intent.action == Intent.ACTION_VIEW) oauthCallback = intent.data
        intent.getStringExtra("tiflolector-open-book")
            ?.takeIf { it.isNotBlank() }?.let { requestedReaderBookId = it }
    }
}

@Composable
private fun AdjustableSelector(
    label: String,
    choices: List<String>,
    selected: Int,
    english: Boolean,
    onSelected: (Int) -> Unit
) {
    val uiLanguage = LocalNativeUiLanguage.current
    if (choices.isEmpty()) return
    val index = selected.coerceIn(0, choices.lastIndex)
    val value = choices[index]
    val previous = NativeHomeAdjustableStrings.get(uiLanguage, "previous")
    val next = NativeHomeAdjustableStrings.get(uiLanguage, "next")

    Column(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
        Text(
            "$label: $value",
            style = MaterialTheme.typography.titleMedium,
            // The native adjustable Slider is the single TalkBack stop.
            modifier = Modifier.clearAndSetSemantics { }
        )
        if (choices.size > 1) {
            Slider(
                value = index.toFloat(),
                onValueChange = { onSelected(it.roundToInt().coerceIn(0, choices.lastIndex)) },
                valueRange = 0f..choices.lastIndex.toFloat(),
                steps = (choices.size - 2).coerceAtLeast(0),
                modifier = Modifier
                    .fillMaxWidth()
                    .semantics {
                        contentDescription = label
                        stateDescription = value
                        customActions = listOf(
                            CustomAccessibilityAction(previous) {
                                onSelected((index - 1).coerceAtLeast(0))
                                true
                            },
                            CustomAccessibilityAction(next) {
                                onSelected((index + 1).coerceAtMost(choices.lastIndex))
                                true
                            }
                        )
                    }
            )
        }
    }
}

@Composable
private fun PrototypeHome(
    languageOverride: String,
    account: NativeYouTubeAccount,
    callback: Uri?,
    onCallbackHandled: () -> Unit,
    requestedReaderBookId: String?,
    onReaderRequestHandled: () -> Unit,
    requestedSection: String?,
    onRequestedSectionHandled: () -> Unit,
    sharedFiles: SharedReaderFiles?,
    onSharedFilesHandled: () -> Unit,
    sharedText: String?,
    onSharedTextHandled: () -> Unit,
    onSignIn: () -> Unit
) {
    val context = LocalContext.current

    LaunchedEffect(callback) {
        if (callback != null) {
            account.acceptCallback(callback)
            onCallbackHandled()
        }
    }
    LaunchedEffect(Unit) { account.checkSession() }
    val language = NativeUiText.normalize(languageOverride, Locale.getDefault().language)
    val english = language == "en"
    var loaded by remember { mutableStateOf(CatalogLoad(Catalog())) }
    var loading by remember { mutableStateOf(true) }
    var mediaLoad by remember { mutableStateOf(MediaLoad()) }
    var mediaLoading by remember { mutableStateOf(true) }
    var section by rememberSaveable { mutableIntStateOf(PrototypeNavigation.HOME) }
    LaunchedEffect(requestedReaderBookId) {
        if (requestedReaderBookId != null) section = PrototypeNavigation.READER
    }
    LaunchedEffect(requestedSection) {
        when (requestedSection) {
            "reader" -> section = PrototypeNavigation.READER
            "videos" -> section = PrototypeNavigation.VIDEOS
            "search" -> section = NativeDestinations.SEARCH
            "contact" -> section = NativeDestinations.CONTACT
        }
        if (requestedSection != null) onRequestedSectionHandled()
    }
    LaunchedEffect(sharedFiles?.serial) {
        if (sharedFiles != null) section = PrototypeNavigation.READER
    }
    var initialSharedText by remember { mutableStateOf("") }
    LaunchedEffect(sharedText) {
        if (!sharedText.isNullOrBlank()) {
            initialSharedText = sharedText
            section = if (sharedText.startsWith("https://")) NativeDestinations.DOWNLOADS
                else NativeDestinations.SEARCH
            onSharedTextHandled()
        }
    }
    var mediaIndex by rememberSaveable { mutableIntStateOf(0) }
    var mediaSourceIndex by rememberSaveable { mutableIntStateOf(0) }
    var mediaLanguageIndex by rememberSaveable { mutableIntStateOf(0) }
    var newsCategory by rememberSaveable { mutableIntStateOf(0) }
    var resourceCategory by rememberSaveable { mutableIntStateOf(0) }
    var visibleCount by rememberSaveable { mutableIntStateOf(10) }
    var selectedItem by remember { mutableStateOf<CatalogItem?>(null) }
    var selectedMediaItem by remember { mutableStateOf<MediaItem?>(null) }
    var playingMediaItem by remember { mutableStateOf<MediaItem?>(null) }

    LaunchedEffect(Unit) {
        loaded = CatalogRepository.load(context)
        loading = false
    }
    LaunchedEffect(Unit) {
        mediaLoad = MediaRepository.load(context)
        mediaLoading = false
    }

    // Editorial material stays in its source language; changing the app
    // interface must not hide publications in another language.
    val news = loaded.catalog.news
    val resources = loaded.catalog.resources
    val videoCatalog = loaded.catalog.videos
    val newsCategories = CatalogLogic.newsCategories(news)
    val resourceCategories = CatalogLogic.resourceCategories(resources)

    val newsChoices = listOf(
        NativeUiText.get(language, "chooseCategory"),
        NativeUiText.get(language, "allCategories")
    ) + newsCategories.map { NativeNewsResourcesStrings.categoryLabel(language, it) }

    val resourceChoices = listOf(
        NativeUiText.get(language, "chooseCategory")
    ) + resourceCategories.map { NativeNewsResourcesStrings.categoryLabel(language, it) }

    val mediaSourceChoices = listOf(NativeNewsResourcesStrings.get(language, "allSources")) +
        MediaLogic.sources(mediaLoad.items, mediaIndex)
    val mediaSource = mediaSourceChoices.getOrNull(mediaSourceIndex)?.takeIf { mediaSourceIndex > 0 }
    val filteredMedia = MediaLogic.select(mediaLoad.items, mediaIndex, mediaSource, mediaLanguageIndex)
    val mediaLanguages = listOf("allLanguages", "spanish", "english").map {
        NativeNewsResourcesStrings.get(language, it)
    }

    val mediaChoices = listOf("mediaCategories", "mediaPodcasts", "mediaChannels", "mediaAll").map {
        NativeNewsResourcesStrings.get(language, it)
    }

    val filtered = if (section == PrototypeNavigation.NEWS) {
        if (mediaIndex == 0) CatalogLogic.newsForCategory(news, newsCategories, newsCategory)
        else emptyList()
    } else if (section == PrototypeNavigation.RESOURCES) {
        CatalogLogic.resourcesForCategory(resources, resourceCategories, resourceCategory)
    } else emptyList()

    val title = if (context.packageName == "com.tifloacosta.app") "TifloAcosta"
        else NativeHomeAdjustableStrings.get(language, "trial")
    val first = NativeUiText.get(language, "news")
    val second = NativeUiText.get(language, "resources")
    val third = NativeUiText.get(language, "videos")
    val readerLabel = "TifloLector"

    BackHandler(enabled = playingMediaItem != null) { playingMediaItem = null }

    BackHandler(
        enabled = section != PrototypeNavigation.HOME &&
            selectedItem == null && selectedMediaItem == null && playingMediaItem == null
    ) {
        section = PrototypeNavigation.parentOf(section)
    }

    val activeVideo = playingMediaItem
    if (activeVideo != null) {
        NativeYouTubePlayer(
            item = activeVideo,
            english = english,
            account = account,
            onAuthorize = onSignIn,
            onBack = { playingMediaItem = null }
        )
        return
    }

    if (section == PrototypeNavigation.READER) {
        NativeTifloLector(
            english = english,
            requestedBookId = requestedReaderBookId,
            onReaderRequestHandled = onReaderRequestHandled,
            sharedUris = sharedFiles?.uris.orEmpty(),
            sharedSerial = sharedFiles?.serial ?: 0,
            onSharedUrisConsumed = onSharedFilesHandled,
            onBack = { section = PrototypeNavigation.HOME }
        )
        return
    }

    if (section == PrototypeNavigation.MUSIC) {
        NativeMyMusic(onBack = { section = PrototypeNavigation.HOME })
        return
    }

    if (section in NativeDestinations.SEARCH..NativeDestinations.SOUND_SEARCH) {
        NativeSecondaryScreen(
            destination = section, english = english,
            catalog = loaded.catalog, media = mediaLoad.items,
            initialText = initialSharedText,
            onBack = { section = PrototypeNavigation.HOME },
            onOpenVideo = { item ->
                val url = item.url.ifBlank { "https://www.youtube.com/watch?v=" + item.id }
                playingMediaItem = MediaItem(item.id, "video", item.title,
                    "YouTube", "https://www.youtube.com/", url, "", item.language, "", item.summary)
            },
            onSearchYouTube = { section = PrototypeNavigation.VIDEOS }
        )
        return
    }

    Scaffold(modifier = Modifier.fillMaxSize()) { inner ->
        Column(modifier = Modifier.fillMaxSize().padding(inner).padding(horizontal = 16.dp)) {
            if (section == PrototypeNavigation.HOME) {
                Text(
                    title,
                    style = MaterialTheme.typography.headlineSmall,
                    modifier = Modifier.padding(vertical = 14.dp).semantics { heading() }
                )
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(onClick = { section = NativeDestinations.SEARCH }, modifier = Modifier.fillMaxWidth()) {
                        Text(NativeUiText.get(language, "search"))
                    }
                    Button(onClick = { section = NativeDestinations.NEW_CONTENT }, modifier = Modifier.fillMaxWidth()) {
                        Text(NativeUiText.get(language, "newContent"))
                    }
                    Button(onClick = { section = PrototypeNavigation.NEWS; visibleCount = 10 }, modifier = Modifier.fillMaxWidth()) { Text(first) }
                    Button(onClick = { section = PrototypeNavigation.RESOURCES; visibleCount = 10 }, modifier = Modifier.fillMaxWidth()) { Text(second) }
                    Button(onClick = { section = PrototypeNavigation.READER }, modifier = Modifier.fillMaxWidth()) { Text(readerLabel) }
                    Button(onClick = { section = PrototypeNavigation.MUSIC }, modifier = Modifier.fillMaxWidth()) { Text("Mi Música") }
                    Button(onClick = { section = NativeDestinations.DOWNLOADS }, modifier = Modifier.fillMaxWidth()) {
                        Text(NativeUiText.get(language, "downloads"))
                    }
                    Button(onClick = { section = NativeDestinations.FAVORITES }, modifier = Modifier.fillMaxWidth()) {
                        Text(NativeUiText.get(language, "favorites"))
                    }
                    Button(onClick = { section = PrototypeNavigation.VIDEOS; visibleCount = 10 }, modifier = Modifier.fillMaxWidth()) { Text(third) }
                    Button(onClick = { section = NativeDestinations.PODCAST }, modifier = Modifier.fillMaxWidth()) { Text(NativePodcastStrings.get(language, "title")) }
                    Button(onClick = { section = NativeDestinations.SETTINGS }, modifier = Modifier.fillMaxWidth()) { Text(NativeUiText.get(language, "settings")) }
                }
            } else {
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    TextButton(
                        onClick = { section = PrototypeNavigation.parentOf(section) }
                    ) { Text(NativeUiText.get(language, "back")) }
                    Text(
                        when (section) {
                            PrototypeNavigation.NEWS -> first
                            PrototypeNavigation.RESOURCES -> second
                            else -> third
                        },
                        style = MaterialTheme.typography.headlineSmall,
                        modifier = Modifier.padding(vertical = 12.dp).semantics { heading() }
                    )
                }
                HorizontalDivider(Modifier.padding(vertical = 10.dp))
            }

            if (section == PrototypeNavigation.NEWS) {
                AdjustableSelector(
                    label = NativeNewsResourcesStrings.get(language, "contentType"),
                    choices = mediaChoices, selected = mediaIndex, english = english
                ) {
                    if (mediaIndex != it) {
                        mediaIndex = it
                        mediaSourceIndex = 0
                        visibleCount = 10
                    }
                }

                if (mediaIndex == 0) {
                    AdjustableSelector(
                        label = NativeNewsResourcesStrings.get(language, "category"),
                        choices = newsChoices, selected = newsCategory, english = english
                    ) { newsCategory = it; visibleCount = 10 }
                } else {
                    AdjustableSelector(
                        label = NativeNewsResourcesStrings.get(language, "source"),
                        choices = mediaSourceChoices, selected = mediaSourceIndex, english = english
                    ) { mediaSourceIndex = it; visibleCount = 10 }
                    AdjustableSelector(
                        label = NativeNewsResourcesStrings.get(language, "language"),
                        choices = mediaLanguages, selected = mediaLanguageIndex, english = english
                    ) { mediaLanguageIndex = it; visibleCount = 10 }
                }
            } else if (section == PrototypeNavigation.RESOURCES) {
                AdjustableSelector(
                    label = NativeNewsResourcesStrings.get(language, "category"),
                    choices = resourceChoices, selected = resourceCategory, english = english
                ) { resourceCategory = it; visibleCount = 10 }
            }

            if (section == PrototypeNavigation.VIDEOS) {
                NativeYouTubeSearch(english, account, onSignIn) { item ->
                    playingMediaItem = MediaItem(item.id, "video", item.title,
                        "YouTube", "https://www.youtube.com/", item.url,
                        "", item.language, "", item.summary)
                }
                if (!account.authenticated) {
                    Button(onClick = onSignIn) {
                        Text(NativeNewsResourcesStrings.get(language, "signIn"))
                    }
                    Text(
                        NativeNewsResourcesStrings.get(language, "signInHelp")
                    )
                } else {
                    Text(NativeNewsResourcesStrings.get(language, "connected"))
                    TextButton(onClick = account::signOut) {
                        Text(NativeNewsResourcesStrings.get(language, "signOut"))
                    }
                }
                if (account.message.isNotEmpty()) Text(account.message)
                Text(
                    NativeNewsResourcesStrings.get(language, "myVideos"),
                    style = MaterialTheme.typography.titleMedium,
                    modifier = Modifier.semantics { heading() }
                )
                LazyColumn(modifier = Modifier.weight(1f)) {
                    itemsIndexed(
                        videoCatalog.take(visibleCount),
                        key = { i, item -> "video-$i-${item.id}" }
                    ) { _, item ->
                        NativeYouTubeListRow(
                            item = item,
                            english = english,
                            account = account,
                            onAuthorize = onSignIn,
                            onPlay = {
                                val original = if (item.url.isNotBlank()) item.url
                                    else if (item.id.matches(Regex("[A-Za-z0-9_-]{11}")))
                                        "https://www.youtube.com/watch?v=" + item.id else ""
                                playingMediaItem = MediaItem(
                                    id = item.id, type = "video", title = item.title,
                                    sourceName = "TifloAcosta", sourceUrl = "https://www.youtube.com/",
                                    originalUrl = original, directMediaUrl = "",
                                    language = item.language, publishedAt = "", summary = item.summary
                                )
                            }
                        )
                    }
                    if (videoCatalog.size > visibleCount) {
                        item {
                            TextButton(onClick = { visibleCount += 10 }) {
                                Text(NativeNewsResourcesStrings.get(language, "more"))
                            }
                        }
                    }
                }
            } else if (section == PrototypeNavigation.NEWS && mediaIndex != 0) {
                if (mediaLoading) {
                    Text(NativeNewsResourcesStrings.get(language, "mediaLoading"))
                } else {
                    if (mediaLoad.status.isNotEmpty()) Text(mediaLoad.status)
                    if (filteredMedia.isEmpty()) {
                        Text(NativeNewsResourcesStrings.get(language, "noMedia"))
                    } else {
                        Text(
                            "${filteredMedia.size} " + NativeNewsResourcesStrings.get(language, "result"),
                            style = MaterialTheme.typography.titleMedium,
                            modifier = Modifier.padding(vertical = 8.dp).semantics { heading() }
                        )
                        LazyColumn(modifier = Modifier.weight(1f)) {
                            itemsIndexed(
                                items = filteredMedia.take(visibleCount),
                                key = { i, item -> "media-$i-${item.id}" }
                            ) { _, item ->
                                OutlinedButton(
                                    modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                                    onClick = {
                                        if (item.type == "video") playingMediaItem = item
                                        else selectedMediaItem = item
                                    }
                                ) {
                                    Text(item.title)
                                }
                            }
                            if (filteredMedia.size > visibleCount) {
                                item {
                                    TextButton(onClick = { visibleCount += 10 }) {
                                        Text(NativeUiText.get(language, "more"))
                                    }
                                }
                            }
                        }
                    }
                }
            } else {
                if (section != PrototypeNavigation.HOME && loading) {
                    Text(NativeUiText.get(language, "loading"))
                }
                if (section != PrototypeNavigation.HOME && loaded.status.isNotEmpty()) Text(loaded.status)
                if (!loading && section != PrototypeNavigation.HOME && filtered.isEmpty()) {
                val selectionMade = if (section == PrototypeNavigation.NEWS) newsCategory > 0
                    else resourceCategory > 0
                if (selectionMade) {
                    Text(NativeUiText.get(language, "noResults"))
                }
            } else if (!loading && section != PrototypeNavigation.HOME) {
                val count = filtered.size
                Text(
                    "$count " + NativeNewsResourcesStrings.get(language, "result"),
                    style = MaterialTheme.typography.titleMedium,
                    modifier = Modifier.padding(vertical = 8.dp).semantics { heading() }
                )
                LazyColumn(modifier = Modifier.weight(1f)) {
                    itemsIndexed(
                        items = filtered.take(visibleCount),
                        key = { index, item -> "$index-${item.id}" }
                    ) { _, item ->
                        OutlinedButton(
                            modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                            onClick = { selectedItem = item }
                        ) {
                            // Single accessible title; no metadata/buttons between rows.
                            Text(item.title)
                        }
                    }
                    if (count > visibleCount) {
                        item {
                            TextButton(onClick = { visibleCount += 10 }) {
                                Text(NativeNewsResourcesStrings.get(language, "more"))
                            }
                        }
                    }
                }
            }
            }
        }
    }

    selectedMediaItem?.let { item ->
        AlertDialog(
            onDismissRequest = { selectedMediaItem = null },
            title = { Text(item.title) },
            text = {
                Column(
                    modifier = Modifier.heightIn(max = 340.dp).verticalScroll(rememberScrollState())
                ) {
                    Text(
                        (if (item.type == "audio") "Podcast" else "YouTube") +
                            ". " + NativeNewsResourcesStrings.get(language, "sourcePrefix") + item.sourceName
                    )
                    if (item.summary.isNotBlank()) Text(item.summary)
                }
            },
            confirmButton = {
                if (item.openUrl.isNotEmpty()) {
                    TextButton(onClick = {
                        context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(item.openUrl)))
                    }) {
                        Text(
                            if (item.type == "audio") {
                                NativeNewsResourcesStrings.get(language, "listenSource")
                            } else {
                                NativeNewsResourcesStrings.get(language, "openVideo")
                            }
                        )
                    }
                }
            },
            dismissButton = {
                TextButton(onClick = { selectedMediaItem = null }) {
                    Text(NativeNewsResourcesStrings.get(language, "close"))
                }
            }
        )
    }

    selectedItem?.let { item ->
        AlertDialog(
            onDismissRequest = { selectedItem = null },
            title = { Text(item.title) },
            text = {
                Column(
                    modifier = Modifier.heightIn(max = 340.dp).verticalScroll(rememberScrollState())
                ) {
                    Text(item.summary.ifBlank {
                        NativeNewsResourcesStrings.get(language, "description")
                    })
                }
            },
            confirmButton = {
                if (item.url.isNotEmpty()) {
                    TextButton(onClick = {
                        context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(item.url)))
                    }) {
                        Text(NativeNewsResourcesStrings.get(language, "original"))
                    }
                }
            },
            dismissButton = {
                TextButton(onClick = { selectedItem = null }) {
                    Text(NativeNewsResourcesStrings.get(language, "close"))
                }
            }
        )
    }
}
