package com.tifloacosta.nativeprototype

import android.os.Handler
import android.os.Looper
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.clickable
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import androidx.compose.material3.AlertDialog
import androidx.compose.ui.semantics.CustomAccessibilityAction
import androidx.compose.ui.semantics.customActions
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.semantics.progressBarRangeInfo
import androidx.compose.ui.semantics.setProgress
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Slider
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TextField
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlin.math.roundToInt

/** Compact TifloLector home: Importar, Ajustes, Filtros y Mi biblioteca. */
@Composable
fun NativeTifloLector(
    english: Boolean,
    requestedBookId: String? = null,
    onReaderRequestHandled: () -> Unit = {},
    onBack: () -> Unit
) {
    val context = LocalContext.current
    val store = remember { NativeReaderStore(context.applicationContext) }
    val organization = remember { NativeReaderOrganization(context.applicationContext) }
    val scope = rememberCoroutineScope()
    var library by remember { mutableStateOf<List<ReaderBook>>(emptyList()) }
    var folderNames by remember { mutableStateOf<List<String>>(emptyList()) }
    var queuedIds by remember { mutableStateOf<List<String>>(emptyList()) }
    var bookmarkBook by remember { mutableStateOf<ReaderBook?>(null) }
    var selectedBook by remember { mutableStateOf<ReaderBook?>(null) }
    var selectedText by remember { mutableStateOf("") }
    var playOnOpen by remember { mutableStateOf(false) }
    var screen by rememberSaveable { mutableStateOf("home") }
    var filtersExpanded by rememberSaveable { mutableStateOf(false) }
    var filter by rememberSaveable { mutableIntStateOf(0) }
    var order by rememberSaveable { mutableIntStateOf(0) }
    var folderFilter by rememberSaveable { mutableIntStateOf(0) }
    var visibleCount by rememberSaveable { mutableIntStateOf(10) }
    var error by remember { mutableStateOf("") }
    var info by remember { mutableStateOf<ReaderBook?>(null) }
    var rename by remember { mutableStateOf<ReaderBook?>(null) }
    var proposedTitle by remember { mutableStateOf("") }
    var moveBook by remember { mutableStateOf<ReaderBook?>(null) }
    var proposedFolder by remember { mutableStateOf("") }
    var deleteBook by remember { mutableStateOf<ReaderBook?>(null) }
    var loading by remember { mutableStateOf(true) }
    var importStatus by remember { mutableStateOf("") }
    val mainHandler = remember { Handler(Looper.getMainLooper()) }
    val preferences = remember { context.getSharedPreferences("native-reader-preferences", 0) }
    var rate by remember {
        mutableFloatStateOf(preferences.getFloat("rate", 1f).coerceIn(.6f, 1.8f))
    }

    fun refresh() {
        scope.launch {
            val current = withContext(Dispatchers.IO) {
                val books = store.list()
                Triple(books, organization.folders(books), organization.queue(books))
            }
            library = current.first
            folderNames = current.second
            queuedIds = current.third
        }
    }
    LaunchedEffect(Unit) {
        val current = withContext(Dispatchers.IO) {
            val books = store.list()
            Triple(books, organization.folders(books), organization.queue(books))
        }
        library = current.first
        folderNames = current.second
        queuedIds = current.third
        loading = false
    }
    LaunchedEffect(requestedBookId) {
        if (!requestedBookId.isNullOrBlank()) {
            try {
                val selection = withContext(Dispatchers.IO) {
                    val match = store.list().firstOrNull { it.id == requestedBookId }
                    if (match != null) match to store.read(match) else null
                }
                if (selection != null) {
                    selectedText = selection.second
                    selectedBook = selection.first
                    playOnOpen = false
                    screen = "home"
                } else error = "El documento ya no está disponible en la biblioteca."
            } catch (e: Exception) {
                error = e.message ?: "No se pudo recuperar el documento."
            } finally {
                onReaderRequestHandled()
            }
        }
    }
    fun open(book: ReaderBook, startSpeech: Boolean = false) {
        error = ""
        scope.launch {
            try {
                selectedText = withContext(Dispatchers.IO) { store.read(book) }
                playOnOpen = startSpeech
                selectedBook = book
            } catch (e: Exception) { error = e.message ?: "No se pudo abrir el documento." }
        }
    }
    fun save(book: ReaderBook) {
        if (selectedBook?.id == book.id) selectedBook = book
        library = library.map { if (it.id == book.id) book else it }
        scope.launch(Dispatchers.IO) { store.update(book) }
    }
    val importer = rememberLauncherForActivityResult(ActivityResultContracts.OpenMultipleDocuments()) { uris ->
        if (uris.isNotEmpty()) scope.launch {
            error = ""
            try {
                uris.forEachIndexed { index, uri ->
                    importStatus = if (english)
                        "Importing file " + (index + 1) + " of " + uris.size
                    else "Importando archivo " + (index + 1) + " de " + uris.size
                    try {
                        withContext(Dispatchers.IO) {
                            store.import(uri) { page, total ->
                                mainHandler.post {
                                    importStatus = when {
                                        total < 0 && english -> "Extracting audiobook: " + page + " files"
                                        total < 0 -> "Extrayendo audiolibro: " + page + " archivos"
                                        english -> "Recognizing PDF: page " + page + " of " + total
                                        else -> "Reconociendo PDF: página " + page + " de " + total
                                    }
                                }
                            }
                        }
                    } catch (e: Exception) {
                        error += (e.message ?: "No se pudo importar.") + "\n"
                    }
                }
            } finally {
                importStatus = ""
                refresh()
                screen = "home"
            }
        }
    }
    fun back() {
        if (selectedBook != null) { selectedBook = null; selectedText = ""; playOnOpen = false; refresh() }
        else if (screen == "catalogs") screen = "import"
        else if (screen == "folders" || screen == "queue") screen = "home"
        else if (screen != "home") screen = "home"
        else onBack()
    }
    BackHandler { back() }
    bookmarkBook?.let { book ->
        NativeReaderBookmarksPanel(english, book,
            onTextMark = { mark ->
                bookmarkBook = null
                val target = book.copy(offset = mark.coerceIn(0, book.length))
                if (NativeReaderPlaybackService.snapshot.value.bookId == book.id) {
                    NativeReaderPlaybackService.send(context,
                        NativeReaderPlaybackService.ACTION_SEEK, book.id, target.offset)
                } else save(target)
                open(target)
            },
            onAudioMark = { mark ->
                bookmarkBook = null
                NativeReaderPlaybackService.start(context, book.id, audio = true,
                    segmentIndex = mark.segmentIndex, positionMs = mark.positionMs)
                open(book)
            },
            onBack = { bookmarkBook = null })
        return
    }
    selectedBook?.let { book ->
        NativeReadingScreen(
            book = book,
            fullText = selectedText,
            english = english,
            startOnOpen = playOnOpen,
            rate = rate,
            onRateChange = { rate = it; preferences.edit().putFloat("rate", it).apply() },
            onUpdate = ::save,
            onOcrCompleted = {
                scope.launch {
                    val fresh = withContext(Dispatchers.IO) {
                        val updated = store.list().firstOrNull { it.id == book.id }
                        if (updated != null) updated to store.read(updated) else null
                    }
                    if (fresh != null) {
                        selectedBook = fresh.first
                        selectedText = fresh.second
                        library = library.map { if (it.id == fresh.first.id) fresh.first else it }
                    }
                }
            },
            onBack = { selectedBook = null; selectedText = ""; playOnOpen = false; refresh() }
        )
        return
    }
    if (screen == "folders") {
        NativeReaderFolderManager(english, library, folderNames, organization, store,
            onChanged = { folderFilter = 0; refresh() },
            onBack = { screen = "home"; refresh() })
        return
    }
    if (screen == "queue") {
        NativeReaderQueueManager(english, library, queuedIds, organization,
            onChanged = { refresh() },
            onOpen = { open(it) },
            onBack = { screen = "home"; refresh() })
        return
    }
    if (screen == "settings") {
        NativeReaderGeneralSettings(english) { screen = "home" }
        return
    }
    if (screen == "catalogs") {
        NativeReaderCatalogsScreen(english,
            onImport = { entry ->
                scope.launch {
                    error = ""
                    try {
                        val book = withContext(Dispatchers.IO) {
                            val (ext, bytes) = NativeReaderOPDS.download(entry)
                            store.importBytes(entry.title.take(120) + "." + ext, ext, bytes)
                        }
                        refresh()
                        screen = "home"
                        open(book)
                    } catch (e: Exception) { error = e.message.orEmpty() }
                }
            },
            onBack = { screen = "import" }
        )
        return
    }
    if (screen == "import") {
        Column(modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)) {
            TextButton(onClick = { screen = "home" }) {
                Text(if (english) "Back to TifloLector" else "Volver a TifloLector")
            }
            Text(if (english) "Import" else "Importar",
                style = MaterialTheme.typography.headlineSmall)
            Button(onClick = { importer.launch(arrayOf("*/*")) },
                enabled = importStatus.isBlank(),
                modifier = Modifier.fillMaxWidth()) {
                Text(if (english) "Device and cloud files" else "Archivos del dispositivo y nubes")
            }
            Button(onClick = { screen = "catalogs" }, modifier = Modifier.fillMaxWidth()) {
                Text(if (english) "External libraries (OPDS)" else "Bibliotecas externas (OPDS)")
            }
            Text(if (english)
                "Android shows device storage and available cloud providers in its document picker."
                else "El selector de documentos de Android ofrece archivos locales y proveedores de nube instalados.")
            if (importStatus.isNotBlank()) Text(importStatus)
            if (error.isNotBlank()) Text(error)
        }
        return
    }

    val folders = folderNames
    val folderChoices = listOf(
        if (english) "All folders" else "Todas las carpetas",
        if (english) "Unfiled" else "Sin carpeta"
    ) + folders
    val selectedFolder = when(folderFilter) {
        0 -> ""
        1 -> "__none__"
        else -> folders.getOrNull(folderFilter - 2).orEmpty()
    }
    val shown = NativeReaderBookFilters.apply(library, filter, order, selectedFolder,
        queueIds = queuedIds)
    val actions = if (english)
        listOf("Open", "Play", "Bookmarks", "Favorite", "Information", "Rename",
            "Move to folder", "Delete", "Add or remove from queue", "Mark read or unread")
    else listOf("Abrir", "Reproducir", "Marcas", "Favorito", "Información",
        "Cambiar título", "Mover a carpeta", "Eliminar",
        "Añadir o quitar de cola", "Marcar como terminado o pendiente")

    Column(modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)) {
        TextButton(onClick = onBack) { Text(if (english) "Back to home" else "Volver al inicio") }
        Text("TifloLector", style = MaterialTheme.typography.headlineSmall,
            modifier = Modifier.semantics { heading() })
        Button(onClick = { screen = "import" }, modifier = Modifier.fillMaxWidth()) {
            Text(if (english) "Import" else "Importar")
        }
        TextButton(onClick = { screen = "settings" }, modifier = Modifier.fillMaxWidth()) {
            Text(if (english) "Settings" else "Ajustes")
        }
        TextButton(onClick = { filtersExpanded = !filtersExpanded },
            modifier = Modifier.fillMaxWidth().semantics {
                stateDescription = if (filtersExpanded) (if (english) "Expanded" else "Abierto")
                else (if (english) "Collapsed" else "Cerrado")
            }) { Text(if (english) "Filters" else "Filtros") }
        if (filtersExpanded) {
            ReaderAdjustableChoice(
                if (english) "Filter documents" else "Filtrar documentos",
                if (english) NativeReaderBookFilters.formatFiltersEn
                else NativeReaderBookFilters.formatFiltersEs, filter
            ) { filter = it; visibleCount = 10 }
            ReaderAdjustableChoice(
                if (english) "Sort documents" else "Ordenar",
                if (english) NativeReaderBookFilters.sortEn else NativeReaderBookFilters.sortEs, order
            ) { order = it }
            ReaderAdjustableChoice(
                if (english) "Folder" else "Carpeta",
                folderChoices, folderFilter.coerceIn(0, folderChoices.lastIndex)
            ) { folderFilter = it; visibleCount = 10 }
            TextButton(onClick = { screen = "folders" }, modifier = Modifier.fillMaxWidth()) {
                Text(if (english) "Manage folders and create new folder"
                    else "Gestionar carpetas y crear nueva carpeta")
            }
            TextButton(onClick = { screen = "queue" }, modifier = Modifier.fillMaxWidth()) {
                Text(if (english) "Manage reading queue" else "Gestionar cola de lectura")
            }
        }
        Text(if (english) "My library" else "Mi biblioteca",
            style = MaterialTheme.typography.titleMedium,
            modifier = Modifier.semantics { heading() })
        if (loading) Text(if (english) "Loading library" else "Cargando biblioteca")
        else if (shown.isEmpty()) Text(
            if (english) "No books match this selection." else "No hay obras con estos filtros."
        )
        shown.take(visibleCount).forEach { book ->
            var action by remember(book.id) { mutableIntStateOf(0) }
            fun run(which: Int) {
                when (which) {
                    0 -> open(book)
                    2 -> bookmarkBook = book
                    1 -> open(book, startSpeech = true)
                    3 -> save(book.copy(favorite = !book.favorite))
                    4 -> info = book
                    5 -> { proposedTitle = book.title; rename = book }
                    6 -> { proposedFolder = book.folder; moveBook = book }
                    7 -> deleteBook = book
                    8 -> scope.launch {
                        withContext(Dispatchers.IO) {
                            if (book.id in queuedIds)
                                organization.removeFromQueue(book.id, store.list())
                            else organization.enqueue(book.id, store.list())
                        }
                        refresh()
                    }
                    9 -> save(book.copy(finished = !book.finished))
                }
            }
            OutlinedButton(onClick = { run(action) },
                modifier = Modifier.fillMaxWidth().semantics {
                    contentDescription = book.title
                    stateDescription = actions[action] + ". " + when {
                        book.finished -> if (english) "Finished" else "Terminado"
                        book.tracks.isNotEmpty() ->
                            (if (english) "Audio section " else "Sección de audio ") +
                            (book.trackIndex + 1) + " / " +
                            book.audioSegments.ifEmpty { book.tracks.map { ReaderAudioSegment(0) } }.size
                        else -> (if (english) "Read " else "Leído ") +
                            ReaderUnits.percent(book.offset, book.length) + "%"
                    } + if (book.id in queuedIds) {
                        if (english) ". In reading queue" else ". En cola de lectura"
                    } else ""
                    progressBarRangeInfo = ProgressBarRangeInfo(
                        action.toFloat(), 0f..actions.lastIndex.toFloat(), actions.size - 2
                    )
                    setProgress { v ->
                        action = v.roundToInt().coerceIn(0, actions.lastIndex)
                        true
                    }
                    customActions = actions.mapIndexed { i, label ->
                        CustomAccessibilityAction(label) { run(i); true }
                    }
                }) { Text(book.title) }
        }
        if (shown.size > visibleCount) {
            TextButton(onClick = { visibleCount += 10 }) {
                Text(if (english) "Show ten more" else "Mostrar diez más")
            }
        }
        if (error.isNotBlank()) Text(error)
    }

    info?.let { book ->
        AlertDialog(onDismissRequest = { info = null },
            title = { Text(if (english) "Book information" else "Información de la obra") },
            text = { Text(book.title + "\n" + book.format.uppercase() +
                "\n" + (if (english) "Bookmarks: " else "Marcas: ") +
                (if (book.tracks.isNotEmpty()) book.audioMarks.size else book.marks.size) +
                "\n" + when {
                    book.finished -> if (english) "Finished" else "Terminado"
                    book.tracks.isNotEmpty() -> (if (english) "Audio section " else "Sección de audio ") +
                        (book.trackIndex + 1) + " / " +
                        (if (book.audioSegments.isNotEmpty()) book.audioSegments.size else book.tracks.size) +
                        ", " + (book.audioPositionMs / 1000) + " s"
                    else -> (if (english) "Read: " else "Leído: ") +
                        ReaderUnits.percent(book.offset, book.length) + "%"
                } + "\n" + (if (english) "Last read: " else "Última lectura: ") +
                if (book.lastReadAt > 0L)
                    java.text.DateFormat.getDateTimeInstance().format(java.util.Date(book.lastReadAt))
                else (if (english) "Never" else "Nunca")) },
            confirmButton = { TextButton(onClick = { info = null }) { Text("Aceptar") } })
    }
    rename?.let { book ->
        AlertDialog(onDismissRequest = { rename = null },
            title = { Text(if (english) "Rename book" else "Cambiar título") },
            text = { TextField(value = proposedTitle, onValueChange = { proposedTitle = it.take(180) }) },
            confirmButton = { TextButton(onClick = {
                if (proposedTitle.isNotBlank()) save(book.copy(title = proposedTitle.trim()))
                rename = null
            }) { Text(if (english) "Save" else "Guardar") } },
            dismissButton = { TextButton(onClick = { rename = null }) { Text("Cancelar") } })
    }
    moveBook?.let { book ->
        AlertDialog(onDismissRequest = { moveBook = null },
            title = { Text(if (english) "Move to folder" else "Mover a carpeta") },
            text = { Column {
                TextField(value = proposedFolder, onValueChange = { proposedFolder = it.take(70) },
                    label = { Text(if (english) "Folder" else "Carpeta") })
                if (error.isNotBlank()) Text(error)
                folders.forEach { folder ->
                    TextButton(onClick = { proposedFolder = folder }) { Text(folder) }
                }
                TextButton(enabled = proposedFolder.isNotBlank(), onClick = {
                    val proposed = proposedFolder
                    scope.launch {
                        try {
                            withContext(Dispatchers.IO) {
                                val name = organization.createFolder(proposed, store.list())
                                store.update(book.copy(folder = name))
                            }
                            moveBook = null
                            folderFilter = 0
                            refresh()
                        } catch (e: Exception) {
                            error = e.message ?: "No se pudo crear la carpeta."
                        }
                    }
                }) {
                    Text(if (english) "Create new folder and move this book"
                        else "Crear carpeta nueva y mover este libro")
                }
            } },
            confirmButton = { TextButton(onClick = {
                val requested = proposedFolder.trim()
                scope.launch {
                    try {
                        withContext(Dispatchers.IO) {
                            val candidate = if (requested.isBlank()) ""
                                else organization.folders(store.list())
                                    .firstOrNull { it.equals(requested, ignoreCase = true) }
                                    ?: throw java.io.IOException(
                                        "Esa carpeta no existe. Usa Crear carpeta nueva y mover este libro.")
                            store.update(book.copy(folder = candidate))
                        }
                        moveBook = null
                        folderFilter = 0
                        refresh()
                    } catch (e: Exception) { error = e.message.orEmpty() }
                }
            }) { Text(if (english) "Move" else "Mover") } },
            dismissButton = { TextButton(onClick = { moveBook = null }) { Text("Cancelar") } })
    }
    deleteBook?.let { book ->
        AlertDialog(onDismissRequest = { deleteBook = null },
            title = { Text(if (english) "Delete book permanently?" else "¿Eliminar esta obra definitivamente?") },
            text = { Text(book.title) },
            confirmButton = { TextButton(onClick = {
                if (NativeReaderPlaybackService.snapshot.value.bookId == book.id) {
                    NativeReaderPlaybackService.send(context, NativeReaderPlaybackService.ACTION_STOP)
                }
                scope.launch {
                    withContext(Dispatchers.IO) {
                        store.delete(book)
                        organization.pruneQueue(store.list())
                    }
                    refresh()
                }
                deleteBook = null
            }) { Text(if (english) "Delete" else "Eliminar") } },
            dismissButton = { TextButton(onClick = { deleteBook = null }) { Text("Cancelar") } })
    }
}

@Composable
private fun NativeReadingScreen(
    book: ReaderBook,
    fullText: String,
    english: Boolean,
    startOnOpen: Boolean,
    rate: Float,
    onRateChange: (Float) -> Unit,
    onUpdate: (ReaderBook) -> Unit,
    onOcrCompleted: () -> Unit,
    onBack: () -> Unit
) {
    val context = LocalContext.current
    if (book.tracks.isNotEmpty()) {
        val store = remember { NativeReaderStore(context.applicationContext) }
        NativeReaderAudioScreen(book, store, english, startOnOpen, onUpdate, onBack)
        return
    }
    val speaker = remember(book.id) { NativeReaderSpeaker(context.applicationContext) }
    DisposableEffect(speaker) { onDispose { speaker.close() } }
    val playback by NativeReaderPlaybackService.snapshot.collectAsState()
    val active = playback.bookId == book.id && playback.kind == "text"
    val playing = active && playback.playing
    var offset by remember(book.id) { mutableIntStateOf(book.offset) }
    val documentPreferences = remember {
        context.getSharedPreferences("native-reader-preferences", 0)
    }
    var unitType by rememberSaveable(book.id) {
        mutableIntStateOf(documentPreferences.getInt("unit." + book.id,
            documentPreferences.getInt("unit", 1)).coerceIn(0, 2))
    }
    var showAudio by rememberSaveable(book.id) { mutableStateOf(false) }
    var showPronunciation by rememberSaveable(book.id) { mutableStateOf(false) }
    var showTools by rememberSaveable(book.id) { mutableStateOf(false) }
    val dictionary = remember { NativePronunciationStore(context.applicationContext) }
    var sleepIndex by remember(book.id) { mutableIntStateOf(0) }
    val sleepMinutes = listOf(0, 5, 10, 15, 30, 45, 60)
    val sleepChoices = if (english)
        listOf("Off", "5 minutes", "10 minutes", "15 minutes",
            "30 minutes", "45 minutes", "60 minutes")
    else listOf("Desactivado", "5 minutos", "10 minutos", "15 minutos",
        "30 minutos", "45 minutos", "60 minutos")
    var showVisual by rememberSaveable(book.id) { mutableStateOf(false) }
    var showNavigation by rememberSaveable(book.id) { mutableStateOf(false) }
    var selectedAction by rememberSaveable(book.id) { mutableIntStateOf(0) }
    val prefs = remember { context.getSharedPreferences("native-reader-preferences", 0) }
    var textSize by rememberSaveable(book.id) {
        mutableIntStateOf(prefs.getInt("font." + book.id, prefs.getInt("font", 3)).coerceIn(0, 13))
    }
    var lineSpacing by rememberSaveable(book.id) {
        mutableIntStateOf(prefs.getInt("spacing." + book.id, prefs.getInt("spacing", 0)).coerceIn(0, 2))
    }
    var boldText by rememberSaveable(book.id) {
        mutableIntStateOf(prefs.getInt("bold." + book.id, prefs.getInt("bold", 0)).coerceIn(0, 1))
    }
    var voiceName by rememberSaveable(book.id) {
        mutableStateOf(prefs.getString("voice." + book.id, prefs.getString("voice", "")).orEmpty())
    }
    var perBookRate by rememberSaveable(book.id) {
        mutableFloatStateOf(prefs.getFloat("speed." + book.id, rate))
    }
    var showMarks by rememberSaveable(book.id) { mutableStateOf(false) }
    var jumping by rememberSaveable(book.id) { mutableStateOf(false) }
    var jumpTo by rememberSaveable(book.id) { mutableFloatStateOf(0f) }
    fun send(action: String, value: Int = 0) {
        NativeReaderPlaybackService.send(context, action, book.id, value)
    }
    fun startSpeech() {
        NativeReaderPlaybackService.start(context, book.id, audio = false,
            speedPercent = (perBookRate * 100f).toInt(),
            sleepMinutes = sleepMinutes[sleepIndex])
    }
    fun toggleSpeech() {
        if (playing) send(NativeReaderPlaybackService.ACTION_PAUSE)
        else if (active) send(NativeReaderPlaybackService.ACTION_PLAY)
        else startSpeech()
    }

    val units = remember(fullText, unitType) { ReaderUnits.split(fullText, unitType) }
    val visibleMarks = if (active) playback.textMarks else book.marks
    val displayOffset = if (active) playback.textOffset else offset
    val currentIndex = ReaderUnits.indexForOffset(units, displayOffset)
    val current = units.getOrNull(currentIndex)
    val steps = if (english) listOf("Block", "Paragraph", "Sentence")
        else listOf("Bloque", "Párrafo", "Frase")

    fun setOffset(value: Int) {
        val next = value.coerceIn(0, fullText.length)
        offset = next
        if (active) send(NativeReaderPlaybackService.ACTION_SEEK, next)
        else onUpdate(book.copy(offset = next))
    }

    val actions = if (english)
        listOf("Play or pause", "Stop", "Previous", "Next", "Bookmark", "More actions")
    else listOf("Reproducir o pausar", "Detener", "Anterior", "Siguiente",
        "Añadir marca", "Más acciones")
    fun execute(which: Int) {
        when (which) {
            0 -> toggleSpeech()
            1 -> if (active) send(NativeReaderPlaybackService.ACTION_STOP)
            2, 3 -> if (units.isNotEmpty()) {
                if (active) send(if (which == 2)
                    NativeReaderPlaybackService.ACTION_PREVIOUS else NativeReaderPlaybackService.ACTION_NEXT)
                else {
                    val index = (currentIndex + if (which == 2) -1 else 1)
                        .coerceIn(0, units.lastIndex)
                    setOffset(units[index].start)
                }
            }
            4 -> {
                val mark = displayOffset.coerceIn(0, fullText.length)
                if (active) send(NativeReaderPlaybackService.ACTION_BOOKMARK)
                else if (mark !in book.marks) onUpdate(book.copy(marks = book.marks + mark, offset = mark))
            }
            5 -> jumping = true
        }
    }

    LaunchedEffect(book.id) {
        val choice = prefs.getInt("autoplay." + book.id, -1)
        val enabled = when (choice) {
            1 -> true
            0 -> false
            else -> prefs.getInt("mode", 0) == 1
        }
        if ((startOnOpen || enabled) && !playing) startSpeech()
    }

    if (showPronunciation) {
        NativePronunciationSettings(english, onBack = { showPronunciation = false })
        return
    }
    if (showTools) {
        NativeReaderDocumentActions(book, english, current?.text.orEmpty(),
            onUnitChange = { next ->
                unitType = next
                if (active) send(NativeReaderPlaybackService.ACTION_UNIT, next)
            },
            onOcrCompleted = onOcrCompleted,
            onBack = { showTools = false })
        return
    }

    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        TextButton(onClick = onBack) {
            Text(if (english) "Back to my library" else "Volver a Mi biblioteca")
        }
        Text(
            book.title,
            style = MaterialTheme.typography.headlineSmall,
            modifier = Modifier.fillMaxWidth().clickable { execute(selectedAction) }.semantics {
                heading()
                contentDescription = book.title
                stateDescription = actions[selectedAction]
                progressBarRangeInfo = ProgressBarRangeInfo(
                    selectedAction.toFloat(), 0f..actions.lastIndex.toFloat(), actions.size - 2
                )
                setProgress { value ->
                    selectedAction = value.roundToInt().coerceIn(0, actions.lastIndex)
                    true
                }
                customActions = actions.mapIndexed { i, label ->
                    CustomAccessibilityAction(label) { execute(i); true }
                }
            }
        )
        Button(
            onClick = { toggleSpeech() },
            enabled = units.isNotEmpty(),
            modifier = Modifier.fillMaxWidth()
        ) {
            Text(
                if (playing) (if (english) "Pause" else "Pausar")
                else (if (english) "Play" else "Reproducir")
            )
        }
        if (!speaker.ready.value) {
            Text(if (english) "Initializing Android speech…" else "Preparando la voz de Android…")
        }
        TextButton(onClick = { showTools = true },
            modifier = Modifier.fillMaxWidth()) {
            Text(if (english) "Book details and tools" else "Detalles y herramientas")
        }
        TextButton(
            onClick = { showNavigation = !showNavigation },
            modifier = Modifier.semantics {
                stateDescription = if (showNavigation) "Abierto" else "Cerrado"
            }
        ) { Text(if (english) "Navigation" else "Navegación") }
        if (showNavigation) {
        Text(
            (if (english) "Move by: " else "Avanzar y retroceder por: ") + steps[unitType],
            modifier = Modifier.clearAndSetSemantics { }
        )
        Slider(
            value = unitType.toFloat(),
            onValueChange = {
                unitType = it.roundToInt().coerceIn(0, 2)
                prefs.edit().putInt("unit." + book.id, unitType).apply()
                if (active) send(NativeReaderPlaybackService.ACTION_UNIT, unitType)
            },
            valueRange = 0f..2f,
            steps = 1,
            modifier = Modifier.semantics {
                contentDescription = if (english) "Move by" else "Avanzar y retroceder por"
                stateDescription = steps[unitType]
            }
        )
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            OutlinedButton(
                enabled = units.isNotEmpty(),
                onClick = { setOffset(units[(currentIndex - 1).coerceAtLeast(0)].start) }
            ) { Text(if (english) "Previous" else "Anterior") }
            OutlinedButton(
                enabled = units.isNotEmpty(),
                onClick = { setOffset(units[(currentIndex + 1).coerceAtMost(units.lastIndex)].start) }
            ) { Text(if (english) "Next" else "Siguiente") }
        }
        }
        Text(
            (if (english) "Read: " else "Leído: ") + ReaderUnits.percent(displayOffset, fullText.length) + "%",
            modifier = Modifier.semantics {
                contentDescription = if (english) "Reading progress" else "Progreso de lectura"
            }
        )
        TextButton(
            onClick = { showAudio = !showAudio },
            modifier = Modifier.semantics {
                stateDescription = if (showAudio)
                    (if (english) "Expanded" else "Abierto")
                else (if (english) "Collapsed" else "Cerrado")
            }
        ) {
            Text(if (english) "Audio and voice" else "Audio y voz")
        }
        if (showAudio) {
            ReaderAdjustableChoice(
                if (english) "Speech speed" else "Velocidad",
                listOf("0,75", "0,9", "Normal", "1,25", "1,5"),
                listOf(.75f, .9f, 1f, 1.25f, 1.5f).indices.minByOrNull { index ->
                    kotlin.math.abs(listOf(.75f, .9f, 1f, 1.25f, 1.5f)[index] - perBookRate)
                } ?: 2
            ) { index ->
                perBookRate = listOf(.75f, .9f, 1f, 1.25f, 1.5f)[index]
                prefs.edit().putFloat("speed." + book.id, perBookRate).apply()
                if (active) send(NativeReaderPlaybackService.ACTION_SPEED,
                    (perBookRate * 100f).toInt())
            }
            val voices = speaker.voices()
            ReaderAdjustableChoice(
                if (english) "Voice" else "Voz",
                listOf(if (english) "System default" else "Predeterminada") +
                    voices.map { it.name + ", " + it.locale.displayLanguage },
                voices.indexOfFirst { it.name == voiceName }.let { if (it < 0) 0 else it + 1 }
            ) { index ->
                voiceName = voices.getOrNull(index - 1)?.name.orEmpty()
                prefs.edit().putString("voice." + book.id, voiceName).apply()
            }
            ReaderAdjustableChoice(
                if (english) "Sleep timer" else "Apagado automático",
                sleepChoices, sleepIndex
            ) {
                sleepIndex = it
                if (active) send(NativeReaderPlaybackService.ACTION_SLEEP, sleepMinutes[it])
            }
            TextButton(onClick = {
                if (active) send(NativeReaderPlaybackService.ACTION_PAUSE)
                showPronunciation = true
            }) { Text(if (english) "Pronunciation dictionary" else "Diccionario de pronunciación") }
        }
        TextButton(
            onClick = { showVisual = !showVisual },
            modifier = Modifier.semantics {
                stateDescription = if (showVisual) "Abierto" else "Cerrado"
            }
        ) { Text("Visual") }
        if (showVisual) {
            ReaderAdjustableChoice(
                if (english) "Text size" else "Tamaño de letra",
                (14..40 step 2).map { it.toString() }, textSize
            ) { textSize = it; prefs.edit().putInt("font." + book.id, it).apply() }
            ReaderAdjustableChoice(
                if (english) "Line spacing" else "Interlineado",
                listOf("Normal", "Cómodo", "Amplio"), lineSpacing
            ) { lineSpacing = it; prefs.edit().putInt("spacing." + book.id, it).apply() }
            ReaderAdjustableChoice(
                if (english) "Bold text" else "Texto reforzado",
                listOf("No", "Sí"), boldText
            ) { boldText = it; prefs.edit().putInt("bold." + book.id, it).apply() }
        }
        TextButton(
            onClick = { jumping = !jumping },
            modifier = Modifier.semantics {
                stateDescription = if (jumping)
                    (if (english) "Expanded" else "Abierto")
                else (if (english) "Collapsed" else "Cerrado")
            }
        ) {
            Text(if (english) "More actions" else "Más acciones")
        }
        if (jumping) {
            Text(if (english) "Go to position" else "Ir a posición")
            Slider(
                value = jumpTo,
                onValueChange = { jumpTo = it.roundToInt().toFloat() },
                valueRange = 0f..100f,
                steps = 9,
                modifier = Modifier.semantics {
                    contentDescription = if (english) "Position percentage" else "Porcentaje de posición"
                    stateDescription = jumpTo.roundToInt().toString() + "%"
                }
            )
            Button(onClick = {
                setOffset((fullText.length * jumpTo / 100f).roundToInt())
            }) {
                Text(if (english) "Go" else "Ir")
            }
            Button(onClick = {
                val mark = offset.coerceIn(0, fullText.length)
                if (mark !in book.marks) onUpdate(book.copy(marks = book.marks + mark, offset = offset))
            }) {
                Text(if (english) "Add bookmark" else "Añadir marca")
            }
            TextButton(
                onClick = { showMarks = !showMarks },
                modifier = Modifier.semantics {
                    stateDescription = if (showMarks)
                        (if (english) "Expanded" else "Abierto")
                    else (if (english) "Collapsed" else "Cerrado")
                }
            ) {
                Text(if (english) "Bookmarks" else "Marcas")
            }
            if (showMarks) {
                if (visibleMarks.isEmpty()) Text(if (english) "No bookmarks" else "No hay marcas")
                visibleMarks.forEach { mark ->
                    OutlinedButton(onClick = { setOffset(mark) }) {
                        Text((if (english) "Go to " else "Ir al ") +
                            ReaderUnits.percent(mark, fullText.length) + "%")
                    }
                }
            }
        }

        if (current != null) {
            Text(
                if (english) "Reading text" else "Texto de lectura",
                style = MaterialTheme.typography.titleMedium,
                modifier = Modifier.semantics { heading() }
            )
            Text(
                current.text,
                fontSize = (14 + 2 * textSize).sp,
                lineHeight = (18 + 2 * textSize + 5 * lineSpacing).sp,
                fontWeight = if (boldText == 1) FontWeight.Bold else FontWeight.Normal
            )
        }

    }
}
