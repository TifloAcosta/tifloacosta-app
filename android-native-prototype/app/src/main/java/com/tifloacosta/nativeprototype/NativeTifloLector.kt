package com.tifloacosta.nativeprototype

import android.content.Intent
import android.net.Uri
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
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.isTraversalGroup
import androidx.compose.ui.semantics.onClick
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
    sharedUris: List<Uri> = emptyList(),
    sharedSerial: Int = 0,
    onSharedUrisConsumed: () -> Unit = {},
    onBack: () -> Unit
) {
    val context = LocalContext.current
    val store = remember { NativeReaderStore(context.applicationContext) }
    val organization = remember { NativeReaderOrganization(context.applicationContext) }
    val scope = rememberCoroutineScope()
    var library by remember { mutableStateOf<List<ReaderBook>>(emptyList()) }
    var legacyState by remember { mutableStateOf<LegacyLibraryState?>(null) }
    LaunchedEffect(Unit) {
        legacyState = withContext(Dispatchers.IO) {
            NativeLegacyLibraryCheck.inspect(context.applicationContext)
        }
    }
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
    var sharedImportNotice by remember { mutableStateOf("") }
    val mainHandler = remember { Handler(Looper.getMainLooper()) }
    val preferences = remember { context.getSharedPreferences("native-reader-preferences", 0) }
    var rate by remember {
        mutableFloatStateOf(preferences.getFloat("rate", 1f).coerceIn(.6f, 1.8f))
    }

    fun refresh() {
        scope.launch {
            try {
                val current = withContext(Dispatchers.IO) {
                    val books = store.list()
                    Triple(books, organization.folders(books), organization.queue(books))
                }
                library = current.first
                folderNames = current.second
                queuedIds = current.third
                error = ""
            } catch (e: Exception) {
                // Preserve the last visible library rather than showing an
                // empty one if metadata storage temporarily fails.
                error = e.message ?: "No se pudo recuperar la biblioteca. Los archivos no se han borrado."
            } finally { loading = false }
        }
    }
    LaunchedEffect(Unit) {
        try {
            val current = withContext(Dispatchers.IO) {
                val books = store.list()
                Triple(books, organization.folders(books), organization.queue(books))
            }
            library = current.first
            folderNames = current.second
            queuedIds = current.third
        } catch (e: Exception) {
            error = e.message ?: "No se pudo leer la biblioteca. Conserva sus documentos."
        } finally { loading = false }
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
    LaunchedEffect(sharedSerial) {
        if (sharedSerial != 0 && sharedUris.isNotEmpty()) {
            val importedSharedBooks = mutableListOf<ReaderBook>()
            error = ""
            sharedImportNotice = ""
            try {
                sharedUris.forEachIndexed { index, uri ->
                    importStatus = if (english)
                        "Importing shared document " + (index + 1) + " of " + sharedUris.size
                    else "Importando documento compartido " + (index + 1) + " de " + sharedUris.size
                    try {
                        val importedBook = withContext(Dispatchers.IO) { store.import(uri) }
                        importedSharedBooks.add(importedBook)
                    } catch (e: Exception) {
                        error += (e.message ?: "No se pudo importar el documento compartido.") + "\n"
                    }
                }
                sharedImportNotice = if (english)
                    "${importedSharedBooks.size} of ${sharedUris.size} shared documents added to the library."
                else "${importedSharedBooks.size} de ${sharedUris.size} documentos compartidos añadidos a la biblioteca."
                // Opening a single shared document immediately avoids making TalkBack
                // users find the just-imported book again. Multiple documents remain
                // grouped in the library instead of opening an arbitrary last item.
                if (sharedUris.size == 1 && importedSharedBooks.size == 1) {
                    try {
                        val book = importedSharedBooks.single()
                        selectedText = withContext(Dispatchers.IO) { store.read(book) }
                        selectedBook = book
                        playOnOpen = false
                        screen = "home"
                    } catch (e: Exception) {
                        error += (e.message ?: "No se pudo abrir el documento importado.") + "\n"
                    }
                }
            } finally {
                importStatus = ""
                refresh()
                onSharedUrisConsumed()
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
        // Detect which fields the UI actually edited, so a background audio
        // progress update cannot be overwritten by an older Compose snapshot.
        val previous = selectedBook?.takeIf { it.id == book.id }
            ?: library.firstOrNull { it.id == book.id } ?: book
        if (selectedBook?.id == book.id) selectedBook = book
        library = library.map { if (it.id == book.id) book else it }
        scope.launch {
            try {
                val saved = withContext(Dispatchers.IO) {
                    store.changeBook(book.id) { latest ->
                        latest.copy(
                            title = if (book.title != previous.title) book.title else latest.title,
                            favorite = if (book.favorite != previous.favorite) book.favorite
                                else latest.favorite,
                            folder = if (book.folder != previous.folder) book.folder else latest.folder,
                            finished = if (book.finished != previous.finished) book.finished
                                else latest.finished,
                            offset = if (book.offset != previous.offset) book.offset else latest.offset,
                            marks = if (book.marks != previous.marks) book.marks else latest.marks,
                            audioMarks = if (book.audioMarks != previous.audioMarks) book.audioMarks
                                else latest.audioMarks,
                            trackIndex = if (book.trackIndex != previous.trackIndex)
                                book.trackIndex else latest.trackIndex,
                            audioPositionMs = if (book.audioPositionMs != previous.audioPositionMs)
                                book.audioPositionMs else latest.audioPositionMs
                        )
                    }
                }
                if (saved != null) {
                    if (selectedBook?.id == saved.id) selectedBook = saved
                    library = library.map { if (it.id == saved.id) saved else it }
                }
            } catch (e: Exception) {
                error = e.message ?: "No se pudo guardar el cambio."
            }
        }
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
        NativeReaderGeneralSettings(english, onDataRestored = { refresh() }) {
            screen = "home"
            refresh()
        }
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
        if (sharedImportNotice.isNotBlank()) Text(sharedImportNotice)
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
        // An empty NEW index must not imply the pre-upgrade library was deleted.
        legacyState?.let { state ->
            if (state.databasePresent && state.bookCount == null) {
                Text(
                    if (english)
                        "The previous library could not be checked. Its files have not been removed. Return to the existing TifloLector until migration is verified."
                    else
                        "No se pudo comprobar la biblioteca anterior. Sus archivos no se han borrado. Vuelve al TifloLector actual hasta verificar la migración."
                )
            } else if ((state.bookCount ?: 0) > 0) {
                Text(
                    if (english)
                        "The previous reader contains ${state.bookCount} books. They are still in the existing TifloLector, not in this native preview. Return to the previous reader to use them; no data was migrated or deleted."
                    else
                        "El lector anterior contiene ${state.bookCount} libros. Siguen en el TifloLector actual, no en esta vista previa nativa. Vuelve al lector anterior para utilizarlos; no se han migrado ni borrado datos."
                )
            }
            if (state.databasePresent) {
                TextButton(
                    onClick = {
                        val nav = context.getSharedPreferences(
                            "tiflo-reader-navigation", android.content.Context.MODE_PRIVATE
                        )
                        if (!nav.edit().putBoolean("open-existing-library", true).commit()) {
                            error = if (english) "Could not open the previous library."
                                else "No se pudo solicitar la apertura de la biblioteca anterior."
                        } else {
                            try {
                                val backIntent = Intent().setClassName(
                                    context.packageName, "com.tifloacosta.app.MainActivity"
                                ).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or
                                    Intent.FLAG_ACTIVITY_SINGLE_TOP)
                                context.startActivity(backIntent)
                                (context as? android.app.Activity)?.finish()
                            } catch (failure: Exception) {
                                nav.edit().remove("open-existing-library").apply()
                                error = if (english) "Original reader is unavailable in this test build."
                                    else "La biblioteca original no está disponible en esta compilación."
                            }
                        }
                    },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(if (english) "Open existing reading library"
                        else "Abrir biblioteca anterior")
                }
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
            // One TalkBack stop per book: its title, progress and selected action.
            // Clear the Material button/text semantics before assigning the final
            // accessible name. Otherwise the title can be announced twice.
            val readingStatus = when {
                book.finished -> if (english) "Finished" else "Terminado"
                book.tracks.isNotEmpty() ->
                    (if (english) "Audio section " else "Sección de audio ") +
                    (book.trackIndex + 1) + " / " +
                    book.audioSegments.ifEmpty { book.tracks.map { ReaderAudioSegment(0) } }.size
                else -> (if (english) "Read " else "Leído ") +
                    ReaderUnits.percent(book.offset, book.length) +
                    (if (english) " percent" else " por ciento")
            }
            OutlinedButton(onClick = { run(action) },
                modifier = Modifier.fillMaxWidth().clearAndSetSemantics {
                    contentDescription = book.title
                    stateDescription = readingStatus +
                        (if (book.id in queuedIds) {
                            if (english) ". In reading queue" else ". En cola de lectura"
                        } else "") +
                        (if (english) ". Action: " else ". Acción: ") + actions[action]
                    progressBarRangeInfo = ProgressBarRangeInfo(
                        action.toFloat(), 0f..actions.lastIndex.toFloat(), actions.size - 2
                    )
                    setProgress { v ->
                        action = v.roundToInt().coerceIn(0, actions.lastIndex)
                        true
                    }
                    onClick(label = if (english) "Perform selected book action"
                        else "Ejecutar acción del libro") {
                        run(action)
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
                                store.changeBook(book.id) { it.copy(folder = name) }
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
                            store.changeBook(book.id) { it.copy(folder = candidate) }
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
    // Do not replace the accessible text excerpt at each TTS utterance.
    var previewOffset by remember(book.id) { mutableIntStateOf(book.offset) }
    val titleFocusRequester = remember(book.id) { FocusRequester() }
    var titleFocusedOnOpen by rememberSaveable(book.id) { mutableStateOf(false) }
    val documentPreferences = remember {
        context.getSharedPreferences("native-reader-preferences", 0)
    }
    var unitType by rememberSaveable(book.id) {
        mutableIntStateOf(documentPreferences.getInt("unit." + book.id,
            documentPreferences.getInt("unit", 1)).coerceIn(0, 5))
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

    val chapters = remember(fullText) { ReaderNavigation.chapterStarts(fullText) }
    val availableModes = if (english) {
        listOf(0 to "Block", 1 to "Paragraph", 2 to "Sentence", 3 to "Word") +
            (if (chapters.isNotEmpty()) listOf(4 to "Chapter or section") else emptyList()) +
            listOf(5 to "Percentage (10% steps)")
    } else {
        listOf(0 to "Bloque", 1 to "Párrafo", 2 to "Frase", 3 to "Palabra") +
            (if (chapters.isNotEmpty()) listOf(4 to "Capítulo o sección") else emptyList()) +
            listOf(5 to "Porcentaje (pasos del 10 %)")
    }
    // Audio synthesis keeps natural-length utterances in special navigation modes.
    val effectiveUnitType = if (unitType == 4 && chapters.isEmpty()) 1 else unitType
    val ttsUnit = effectiveUnitType.takeIf { it in 0..2 } ?: 1
    val units = remember(fullText, ttsUnit) { ReaderUnits.split(fullText, ttsUnit) }
    val visibleMarks = if (active) playback.textMarks else book.marks
    val displayOffset = if (active) playback.textOffset else offset
    val currentIndex = ReaderUnits.indexForOffset(units, displayOffset)
    val current = units.getOrNull(currentIndex)
    val preview = units.getOrNull(ReaderUnits.indexForOffset(units, previewOffset))
    val selectedModeIndex = availableModes.indexOfFirst { it.first == effectiveUnitType }
        .coerceAtLeast(0)
    val currentChapter = chapters.indexOfLast { it <= displayOffset }.coerceAtLeast(0)
    LaunchedEffect(active, playing, book.id) {
        if (active && !playing) previewOffset = playback.textOffset
    }

    fun setOffset(value: Int) {
        val next = value.coerceIn(0, fullText.length)
        offset = next
        previewOffset = next
        if (active) send(NativeReaderPlaybackService.ACTION_SEEK, next)
        else onUpdate(book.copy(offset = next))
    }

    fun moveOneUnit(forward: Boolean) {
        when (effectiveUnitType) {
            3 -> setOffset(if (forward) ReaderNavigation.nextWordStart(fullText, displayOffset)
                else ReaderNavigation.previousWordStart(fullText, displayOffset))
            4 -> if (chapters.isNotEmpty()) {
                val target = (currentChapter + if (forward) 1 else -1)
                    .coerceIn(0, chapters.lastIndex)
                setOffset(chapters[target])
            }
            5 -> setOffset(ReaderNavigation.percentageStep(
                displayOffset, fullText.length, forward))
            else -> if (units.isNotEmpty()) {
                if (active) send(if (forward) NativeReaderPlaybackService.ACTION_NEXT
                    else NativeReaderPlaybackService.ACTION_PREVIOUS)
                else setOffset(units[
                    (currentIndex + if (forward) 1 else -1).coerceIn(0, units.lastIndex)
                ].start)
            }
        }
    }

    val actions = if (english)
        listOf("Play or pause", "Stop", "Previous", "Next", "Bookmark", "More actions")
    else listOf("Reproducir o pausar", "Detener", "Anterior", "Siguiente",
        "Añadir marca", "Más acciones")
    fun execute(which: Int) {
        when (which) {
            0 -> toggleSpeech()
            1 -> if (active) send(NativeReaderPlaybackService.ACTION_STOP)
            2, 3 -> moveOneUnit(which == 3)
            4 -> {
                val mark = displayOffset.coerceIn(0, fullText.length)
                if (active) send(NativeReaderPlaybackService.ACTION_BOOKMARK)
                else if (mark !in book.marks) onUpdate(book.copy(marks = book.marks + mark, offset = mark))
            }
            5 -> jumping = true
        }
    }

    LaunchedEffect(book.id) {
        if (!titleFocusedOnOpen) {
            // Once per opening only; do not steal TalkBack focus on audio updates.
            withFrameNanos { }
            titleFocusedOnOpen = titleFocusRequester.requestFocus()
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
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState())
            .semantics { isTraversalGroup = true }.padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        Text(
            book.title,
            style = MaterialTheme.typography.headlineSmall,
            modifier = Modifier.fillMaxWidth().focusRequester(titleFocusRequester)
                .clickable { execute(selectedAction) }.clearAndSetSemantics {
                heading()
                contentDescription = book.title
                stateDescription = (if (english) "Action: " else "Acción: ") +
                    actions[selectedAction]
                progressBarRangeInfo = ProgressBarRangeInfo(
                    selectedAction.toFloat(), 0f..actions.lastIndex.toFloat(), actions.size - 2
                )
                setProgress { value ->
                    selectedAction = value.roundToInt().coerceIn(0, actions.lastIndex)
                    true
                }
                onClick(label = if (english) "Perform selected reading action"
                    else "Ejecutar acción de lectura") {
                    execute(selectedAction)
                    true
                }
                customActions = actions.mapIndexed { i, label ->
                    CustomAccessibilityAction(label) { execute(i); true }
                }
            }
        )
        TextButton(onClick = onBack) {
            Text(if (english) "Back to my library" else "Volver a Mi biblioteca")
        }
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
        ReaderCompactChoice(
            if (english) "Move by" else "Avanzar y retroceder por",
            availableModes.map { it.second }, selectedModeIndex, english
        ) { choice ->
            val chosen = availableModes[choice].first
            unitType = chosen
            prefs.edit().putInt("unit." + book.id, chosen).apply()
            // Changing navigation must not change the saved reading offset.
            if (active) send(NativeReaderPlaybackService.ACTION_UNIT,
                chosen.takeIf { it in 0..2 } ?: 1)
        }
        when (effectiveUnitType) {
            3 -> ReaderCompactOffsetPosition(
                label = if (english) "Reading position by word" else "Posición de lectura por palabra",
                valueLabel = ReaderNavigation.wordAt(fullText, displayOffset),
                current = displayOffset,
                maximum = fullText.length,
                english = english,
                onPrevious = { moveOneUnit(false) },
                onNext = { moveOneUnit(true) }
            )
            4 -> ReaderCompactPosition(
                label = if (english) "Reading position by chapter" else "Posición de lectura por capítulo",
                current = currentChapter,
                count = chapters.size,
                english = english
            ) { chosen -> chapters.getOrNull(chosen)?.let { position -> setOffset(position) } }
            5 -> ReaderCompactOffsetPosition(
                label = if (english) "Reading position by percentage" else "Posición de lectura por porcentaje",
                valueLabel = ReaderUnits.percent(displayOffset, fullText.length).toString() + "%",
                current = ReaderUnits.percent(displayOffset, fullText.length),
                maximum = 100,
                english = english,
                onPrevious = { moveOneUnit(false) },
                onNext = { moveOneUnit(true) }
            )
            else -> ReaderCompactPosition(
                label = (if (english) "Reading position by " else "Posición de lectura por ") +
                    availableModes[selectedModeIndex].second.lowercase(),
                current = currentIndex,
                count = units.size,
                english = english
            ) { chosen -> units.getOrNull(chosen)?.let { unit -> setOffset(unit.start) } }
        }
        // Show and announce the same complete message: never replace the
        // percentage with a content description that hides its value.
        Text(
            (if (english) "Reading progress: " else "Progreso de lectura: ") +
                ReaderUnits.percent(displayOffset, fullText.length) +
                (if (english) "% read" else "% leído")
        )
        ReaderCompactChoice(
            if (english) "Speech speed" else "Velocidad de lectura",
            listOf("0,75", "0,9", if (english) "Normal" else "Normal", "1,25", "1,5"),
            listOf(.75f, .9f, 1f, 1.25f, 1.5f).indices.minByOrNull { index ->
                kotlin.math.abs(listOf(.75f, .9f, 1f, 1.25f, 1.5f)[index] - perBookRate)
            } ?: 2,
            english
        ) { index ->
            perBookRate = listOf(.75f, .9f, 1f, 1.25f, 1.5f)[index]
            prefs.edit().putFloat("speed." + book.id, perBookRate).apply()
            if (active) send(NativeReaderPlaybackService.ACTION_SPEED,
                (perBookRate * 100f).toInt())
        }
        ReaderCompactChoice(
            if (english) "Sleep timer" else "Apagado automático",
            sleepChoices, sleepIndex, english
        ) { index ->
            sleepIndex = index
            if (active) send(NativeReaderPlaybackService.ACTION_SLEEP, sleepMinutes[index])
        }
        TextButton(
            onClick = { showAudio = !showAudio },
            modifier = Modifier.semantics {
                stateDescription = if (showAudio)
                    (if (english) "Expanded" else "Abierto")
                else (if (english) "Collapsed" else "Cerrado")
            }
        ) { Text(if (english) "Voice and pronunciation" else "Voz y pronunciación") }
        if (showAudio) {
            NativeReaderVoicePicker(
                english = english,
                speaker = speaker,
                selectedVoice = voiceName,
                speed = perBookRate,
                filter = 0,
                onBeforePreview = {
                    if (active && playing) send(NativeReaderPlaybackService.ACTION_PAUSE)
                },
                onVoiceSelected = { chosen ->
                    voiceName = chosen
                    prefs.edit().putString("voice." + book.id, chosen).apply()
                }
            )
            TextButton(onClick = {
                if (active) send(NativeReaderPlaybackService.ACTION_PAUSE)
                showPronunciation = true
            }) { Text(if (english) "Pronunciation dictionary" else "Diccionario de pronunciación") }
        }
        TextButton(
            onClick = { showVisual = !showVisual },
            modifier = Modifier.semantics {
                stateDescription = if (showVisual)
                    (if (english) "Expanded" else "Abierto")
                else (if (english) "Collapsed" else "Cerrado")
            }
        ) { Text(if (english) "Visual presentation" else "Presentación visual") }
        if (showVisual) {
            ReaderCompactChoice(
                if (english) "Text size" else "Tamaño de letra",
                (14..40 step 2).map { it.toString() }, textSize, english
            ) { textSize = it; prefs.edit().putInt("font." + book.id, it).apply() }
            ReaderCompactChoice(
                if (english) "Line spacing" else "Interlineado",
                listOf("Normal", "Cómodo", "Amplio"), lineSpacing, english
            ) { lineSpacing = it; prefs.edit().putInt("spacing." + book.id, it).apply() }
            ReaderCompactChoice(
                if (english) "Bold text" else "Texto reforzado",
                listOf("No", "Sí"), boldText, english
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

        if (preview != null) {
            Text(
                if (english) "Reading text" else "Texto de lectura",
                style = MaterialTheme.typography.titleMedium,
                modifier = Modifier.semantics { heading() }
            )
            Text(
                preview.text,
                fontSize = (14 + 2 * textSize).sp,
                lineHeight = (18 + 2 * textSize + 5 * lineSpacing).sp,
                fontWeight = if (boldText == 1) FontWeight.Bold else FontWeight.Normal
            )
        }

    }
}
