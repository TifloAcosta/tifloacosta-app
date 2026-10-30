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
    fun parentOf(destination: Int): Int = HOME
}

/** A new share gets a distinct serial even if the same document is shared again. */
private data class SharedReaderFiles(val serial: Int, val uris: List<Uri>)

class NativePrototypeActivity : ComponentActivity() {
    private var serial = 0
    private var pendingSharedFiles by mutableStateOf<SharedReaderFiles?>(null)

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
    }
    val youTubeAccount by lazy { NativeYouTubeAccount(applicationContext) }
    private var oauthCallback by mutableStateOf<Uri?>(null)
    private var requestedReaderBookId by mutableStateOf<String?>(null)
    private var requestedSection by mutableStateOf<String?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (intent?.action == Intent.ACTION_VIEW) oauthCallback = intent?.data
        requestedReaderBookId = intent?.getStringExtra("tiflolector-open-book")
            ?.takeIf { it.isNotBlank() }
        if (savedInstanceState == null) acceptSharedFiles(intent)
        requestedSection = intent?.getStringExtra("tifloacosta-open-section")
        setContent {
            MaterialTheme(colorScheme = if (isSystemInDarkTheme()) darkColorScheme() else lightColorScheme()) {
                PrototypeHome(
                    account = youTubeAccount,
                    callback = oauthCallback,
                    onCallbackHandled = { oauthCallback = null },
                    requestedReaderBookId = requestedReaderBookId,
                    onReaderRequestHandled = { requestedReaderBookId = null },
                    requestedSection = requestedSection,
                    onRequestedSectionHandled = { requestedSection = null },
                    sharedFiles = pendingSharedFiles,
                    onSharedFilesHandled = { pendingSharedFiles = null },
                    onSignIn = {
                        val url = youTubeAccount.startAuthorization()
                        startActivity(Intent(Intent.ACTION_VIEW, url))
                    }
                )
            }
        }
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
    if (choices.isEmpty()) return
    val index = selected.coerceIn(0, choices.lastIndex)
    val value = choices[index]
    val previous = if (english) "Previous option" else "Opción anterior"
    val next = if (english) "Next option" else "Opción siguiente"

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
    account: NativeYouTubeAccount,
    callback: Uri?,
    onCallbackHandled: () -> Unit,
    requestedReaderBookId: String?,
    onReaderRequestHandled: () -> Unit,
    requestedSection: String?,
    onRequestedSectionHandled: () -> Unit,
    sharedFiles: SharedReaderFiles?,
    onSharedFilesHandled: () -> Unit,
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
    val language = if (Locale.getDefault().language == "en") "en" else "es"
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

    val news = loaded.catalog.news.filter { it.language == language }
    val resources = loaded.catalog.resources.filter { it.language == language }
    val videoCatalog = loaded.catalog.videos.filter { it.language == language }
    val newsCategories = CatalogLogic.newsCategories(news)
    val resourceCategories = CatalogLogic.resourceCategories(resources)

    val newsChoices = listOf(
        if (english) "Choose a category" else "Selecciona una categoría",
        if (english) "All categories" else "Todas las categorías"
    ) + newsCategories.map(CatalogLogic::categoryLabel)

    val resourceChoices = listOf(
        if (english) "Choose a category" else "Selecciona una categoría"
    ) + resourceCategories

    val mediaSourceChoices = listOf(if (english) "All sources" else "Todas las fuentes") +
        MediaLogic.sources(mediaLoad.items, mediaIndex)
    val mediaSource = mediaSourceChoices.getOrNull(mediaSourceIndex)?.takeIf { mediaSourceIndex > 0 }
    val filteredMedia = MediaLogic.select(mediaLoad.items, mediaIndex, mediaSource, mediaLanguageIndex)
    val mediaLanguages = if (english) listOf("All languages", "Spanish", "English")
        else listOf("Todos los idiomas", "Español", "Inglés")

    val mediaChoices = if (english)
        listOf("News categories", "Podcasts", "YouTube channels", "All media")
    else listOf("Categorías de noticias", "Podcasts", "Canales de YouTube", "Todos los formatos")

    val filtered = if (section == PrototypeNavigation.NEWS) {
        if (mediaIndex == 0) CatalogLogic.newsForCategory(news, newsCategories, newsCategory)
        else emptyList()
    } else if (section == PrototypeNavigation.RESOURCES) {
        CatalogLogic.resourcesForCategory(resources, resourceCategories, resourceCategory)
    } else emptyList()

    val title = if (context.packageName == "com.tifloacosta.app") "TifloAcosta"
        else if (english) "TifloAcosta Native Trial" else "TifloAcosta Nativa Pruebas"
    val first = if (english) "News" else "Actualidad"
    val second = if (english) "Resources" else "Recursos"
    val third = if (english) "Videos" else "Vídeos"
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

    if (section in NativeDestinations.SEARCH..NativeDestinations.SOUND_SEARCH) {
        NativeSecondaryScreen(
            destination = section, english = english,
            catalog = loaded.catalog, media = mediaLoad.items,
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
                        Text(if (english) "Search" else "Buscar")
                    }
                    Button(onClick = { section = NativeDestinations.NEW_CONTENT }, modifier = Modifier.fillMaxWidth()) {
                        Text(if (english) "New content" else "Novedades")
                    }
                    Button(onClick = { section = PrototypeNavigation.NEWS; visibleCount = 10 }, modifier = Modifier.fillMaxWidth()) { Text(first) }
                    Button(onClick = { section = PrototypeNavigation.RESOURCES; visibleCount = 10 }, modifier = Modifier.fillMaxWidth()) { Text(second) }
                    Button(onClick = { section = PrototypeNavigation.READER }, modifier = Modifier.fillMaxWidth()) { Text(readerLabel) }
                    Button(onClick = { section = NativeDestinations.DOWNLOADS }, modifier = Modifier.fillMaxWidth()) {
                        Text(if (english) "Downloads" else "Descargas")
                    }
                    Button(onClick = { section = NativeDestinations.FAVORITES }, modifier = Modifier.fillMaxWidth()) {
                        Text(if (english) "Favorites" else "Favoritos")
                    }
                    Button(onClick = { section = PrototypeNavigation.VIDEOS; visibleCount = 10 }, modifier = Modifier.fillMaxWidth()) { Text(third) }
                    Button(onClick = { section = NativeDestinations.PODCAST }, modifier = Modifier.fillMaxWidth()) { Text(if (english) "Podcasts" else "Podcasts") }
                    Button(onClick = { section = NativeDestinations.CONTACT }, modifier = Modifier.fillMaxWidth()) { Text(if (english) "Contact" else "Contacto") }
                    Button(onClick = { section = NativeDestinations.PRIVACY }, modifier = Modifier.fillMaxWidth()) { Text(if (english) "Privacy" else "Privacidad") }
                    Button(onClick = { section = NativeDestinations.SETTINGS }, modifier = Modifier.fillMaxWidth()) { Text(if (english) "Settings" else "Configuración") }
                }
            } else {
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    TextButton(
                        onClick = { section = PrototypeNavigation.parentOf(section) }
                    ) { Text(if (english) "Back" else "Volver") }
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
                    label = if (english) "Content type" else "Tipo de contenido",
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
                        label = if (english) "Category" else "Categoría",
                        choices = newsChoices, selected = newsCategory, english = english
                    ) { newsCategory = it; visibleCount = 10 }
                } else {
                    AdjustableSelector(
                        label = if (english) "Source or channel" else "Fuente o canal",
                        choices = mediaSourceChoices, selected = mediaSourceIndex, english = english
                    ) { mediaSourceIndex = it; visibleCount = 10 }
                    AdjustableSelector(
                        label = if (english) "Language" else "Idioma",
                        choices = mediaLanguages, selected = mediaLanguageIndex, english = english
                    ) { mediaLanguageIndex = it; visibleCount = 10 }
                }
            } else if (section == PrototypeNavigation.RESOURCES) {
                AdjustableSelector(
                    label = if (english) "Category" else "Categoría",
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
                        Text(if (english) "Sign in with Google" else "Iniciar sesión con Google")
                    }
                    Text(
                        if (english) "You can watch videos without logging in. Sign in to like, subscribe and comment."
                        else "Puedes ver los vídeos sin iniciar sesión. Conecta Google para indicar Me gusta, suscribirte y comentar."
                    )
                } else {
                    Text(if (english) "YouTube account connected" else "Cuenta de YouTube conectada")
                    TextButton(onClick = account::signOut) {
                        Text(if (english) "Sign out" else "Cerrar sesión de YouTube")
                    }
                }
                if (account.message.isNotEmpty()) Text(account.message)
                Text(
                    if (english) "Videos on TifloAcosta" else "Vídeos de TifloAcosta",
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
                                Text(if (english) "Show ten more" else "Mostrar diez más")
                            }
                        }
                    }
                }
            } else if (section == PrototypeNavigation.NEWS && mediaIndex != 0) {
                if (mediaLoading) {
                    Text(if (english) "Loading channels..." else "Cargando canales…")
                } else {
                    if (mediaLoad.status.isNotEmpty()) Text(mediaLoad.status)
                    if (filteredMedia.isEmpty()) {
                        Text(if (english) "No media found." else "No hay contenidos multimedia en esta selección.")
                    } else {
                        Text(
                            if (english) "${filteredMedia.size} results" else "${filteredMedia.size} resultados",
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
                                        Text(if (english) "Show ten more" else "Mostrar diez más")
                                    }
                                }
                            }
                        }
                    }
                }
            } else {
                if (section != PrototypeNavigation.HOME && loading) {
                    Text(if (english) "Loading..." else "Cargando…")
                }
                if (section != PrototypeNavigation.HOME && loaded.status.isNotEmpty()) Text(loaded.status)
                if (!loading && section != PrototypeNavigation.HOME && filtered.isEmpty()) {
                val selectionMade = if (section == PrototypeNavigation.NEWS) newsCategory > 0
                    else resourceCategory > 0
                if (selectionMade) {
                    Text(if (english) "No results." else "Sin resultados.")
                }
            } else if (!loading && section != PrototypeNavigation.HOME) {
                val count = filtered.size
                Text(
                    if (english) "$count results" else "$count resultados",
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
                                Text(if (english) "Show ten more" else "Mostrar diez más")
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
                            ". " + (if (english) "Source: " else "Fuente: ") + item.sourceName
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
                                if (english) "Listen at source" else "Escuchar en la fuente"
                            } else {
                                if (english) "Open YouTube video" else "Ver vídeo en YouTube"
                            }
                        )
                    }
                }
            },
            dismissButton = {
                TextButton(onClick = { selectedMediaItem = null }) {
                    Text(if (english) "Close" else "Cerrar")
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
                        if (english) "No additional description." else "No hay descripción adicional."
                    })
                }
            },
            confirmButton = {
                if (item.url.isNotEmpty()) {
                    TextButton(onClick = {
                        context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(item.url)))
                    }) {
                        Text(if (english) "Open original" else "Abrir original")
                    }
                }
            },
            dismissButton = {
                TextButton(onClick = { selectedItem = null }) {
                    Text(if (english) "Close" else "Cerrar")
                }
            }
        )
    }
}
