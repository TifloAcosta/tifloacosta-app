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
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.LiveRegionMode
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
    val uiLanguage = LocalNativeUiLanguage.current
    val store = remember { NativeReaderStore(context.applicationContext) }
    val organization = remember { NativeReaderOrganization(context.applicationContext) }
    val scope = rememberCoroutineScope()
    var library by remember { mutableStateOf<List<ReaderBook>>(emptyList()) }
    var legacyState by remember { mutableStateOf<LegacyLibraryState?>(null) }
    var legacyBooks by remember { mutableStateOf<List<LegacyLibraryBook>>(emptyList()) }
    var legacyReadError by remember { mutableStateOf("") }
    // La biblioteca nueva es la predeterminada. El historial anterior permanece
    // recuperable solo si el usuario solicita expresamente verlo.
    var showPreviousLibrary by rememberSaveable { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        try {
            val previous = withContext(Dispatchers.IO) {
                NativeLegacyLibraryCheck.inspect(context.applicationContext)
            }
            legacyState = previous
            if ((previous.bookCount ?: 0) > 0) {
                legacyBooks = withContext(Dispatchers.IO) {
                    NativeLegacyLibraryCheck.listBooks(context.applicationContext)
                }
            }
        } catch (failure: Exception) {
            legacyReadError = NativeReaderLegacyStrings.get(uiLanguage, "earlierError")
        }
    }
    var folderNames by remember { mutableStateOf<List<String>>(emptyList()) }
    var queuedIds by remember { mutableStateOf<List<String>>(emptyList()) }
    var bookmarkBook by remember { mutableStateOf<ReaderBook?>(null) }
    var selectedBook by remember { mutableStateOf<ReaderBook?>(null) }
    var selectedText by remember { mutableStateOf("") }
    var playOnOpen by remember { mutableStateOf(false) }
    var exportBookId by remember { mutableStateOf<String?>(null) }
    var screen by rememberSaveable { mutableStateOf("home") }
    var filtersExpanded by rememberSaveable { mutableStateOf(false) }
    var filter by rememberSaveable { mutableIntStateOf(0) }
    var order by rememberSaveable { mutableIntStateOf(0) }
    val preferences = remember { context.getSharedPreferences("native-reader-preferences", 0) }
    var talkBackDetail by rememberSaveable {
        mutableIntStateOf(preferences.getInt("talkback-library-details", 0).coerceIn(0, 2))
    }
    var visibleCount by rememberSaveable { mutableIntStateOf(10) }
    var error by remember { mutableStateOf("") }
    var info by remember { mutableStateOf<ReaderBook?>(null) }
    var rename by remember { mutableStateOf<ReaderBook?>(null) }
    var proposedTitle by remember { mutableStateOf("") }
    var moveBook by remember { mutableStateOf<ReaderBook?>(null) }
    var proposedFolder by remember { mutableStateOf("") }
    var deleteBook by remember { mutableStateOf<ReaderBook?>(null) }
    var selectionMode by remember { mutableStateOf(false) }
    var selectedBookIds by remember { mutableStateOf<Set<String>>(emptySet()) }
    var confirmMultipleDeletion by remember { mutableStateOf(false) }
    var loading by remember { mutableStateOf(true) }
    var importStatus by remember { mutableStateOf("") }
    var importResult by remember { mutableStateOf("") }
    var sharedImportNotice by remember { mutableStateOf("") }
    val mainHandler = remember { Handler(Looper.getMainLooper()) }
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
                    if (match != null) {
                        val text = store.read(match)
                        val opened = store.changeBook(match.id) {
                            latest -> latest.copy(lastOpenedAt = System.currentTimeMillis())
                        } ?: match
                        opened to text
                    } else null
                }
                if (selection != null) {
                    selectedText = selection.second
                    selectedBook = selection.first
                    library = library.map { if (it.id == selection.first.id) selection.first else it }
                    playOnOpen = false
                    screen = "home"
                } else error = NativeReaderLegacyStrings.get(uiLanguage, "missingBook")
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
                    importStatus = NativeReaderLegacyStrings.get(uiLanguage, "sharedProgress", index + 1, sharedUris.size)
                    try {
                        val importedBook = withContext(Dispatchers.IO) { store.import(uri) }
                        importedSharedBooks.add(importedBook)
                    } catch (e: Exception) {
                        error += (e.message ?: NativeReaderLegacyStrings.get(uiLanguage, "sharedFailure")) + "\n"
                    }
                }
                sharedImportNotice = NativeReaderLegacyStrings.get(uiLanguage, "sharedDone", importedSharedBooks.size, sharedUris.size)
                // Opening a single shared document immediately avoids making TalkBack
                // users find the just-imported book again. Multiple documents remain
                // grouped in the library instead of opening an arbitrary last item.
                if (sharedUris.size == 1 && importedSharedBooks.size == 1) {
                    try {
                        val book = importedSharedBooks.single()
                        val (text, opened) = withContext(Dispatchers.IO) {
                            val text = store.read(book)
                            val opened = store.changeBook(book.id) {
                                latest -> latest.copy(lastOpenedAt = System.currentTimeMillis())
                            } ?: book
                            text to opened
                        }
                        selectedText = text
                        selectedBook = opened
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

    fun open(book: ReaderBook, startSpeech: Boolean = false, openExport: Boolean = false) {
        exportBookId = if (openExport) book.id else null
        error = ""
        scope.launch {
            try {
                val (text, openedBook) = withContext(Dispatchers.IO) {
                    val text = store.read(book)
                    // Opening a document must count even if playback never starts.
                    val latest = store.changeBook(book.id) {
                        latest -> latest.copy(lastOpenedAt = System.currentTimeMillis())
                    } ?: book
                    text to latest
                }
                selectedText = text
                playOnOpen = startSpeech
                selectedBook = openedBook
                library = library.map { if (it.id == openedBook.id) openedBook else it }
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
            importResult = ""
            var imported = 0
            val failures = mutableListOf<String>()
            try {
                uris.forEachIndexed { index, uri ->
                    importStatus = NativeReaderLegacyStrings.get(uiLanguage, "importProgress", index + 1, uris.size)
                    try {
                        withContext(Dispatchers.IO) {
                            store.import(uri) { page, total ->
                                mainHandler.post {
                                    importStatus = when {
                                        total < 0 -> NativeReaderLegacyStrings.get(uiLanguage, "extracting", page)
                                        else -> NativeReaderLegacyStrings.get(uiLanguage, "recognizing", page, total)
                                    }
                                }
                            }
                        }
                        imported++
                    } catch (e: Exception) {
                        failures.add(e.message ?: "No se pudo importar.")
                    }
                }
            } finally {
                importStatus = ""
                refresh()
                importResult = NativeReaderLegacyStrings.get(uiLanguage, "imported", imported) +
                    (if (failures.isEmpty()) ""
                    else NativeReaderLegacyStrings.get(uiLanguage, "failures", failures.size) + failures.joinToString(" "))
                screen = "home"
            }
        }
    }
    fun back() {
        if (selectedBook != null) { selectedBook = null; selectedText = ""; playOnOpen = false; exportBookId = null; refresh() }
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
            openExportOnStart = exportBookId == book.id,
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
            onDeleteRequest = { deleteBook = book; selectedBook = null; selectedText = "" },
            onBack = { selectedBook = null; selectedText = ""; playOnOpen = false; refresh() }
        )
        return
    }
    if (screen == "folders") {
        NativeReaderFolderManager(english, library, folderNames, organization, store,
            onChanged = { refresh() },
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
                Text(NativeReaderLegacyStrings.get(uiLanguage, "backReader"))
            }
            Text(NativeReaderLibraryStrings.get(uiLanguage, "import"),
                style = MaterialTheme.typography.headlineSmall)
            Button(onClick = { importer.launch(arrayOf("*/*")) },
                enabled = importStatus.isBlank(),
                modifier = Modifier.fillMaxWidth()) {
                Text(NativeReaderLegacyStrings.get(uiLanguage, "files"))
            }
            Button(onClick = { screen = "catalogs" }, modifier = Modifier.fillMaxWidth()) {
                Text(NativeReaderLegacyStrings.get(uiLanguage, "opds"))
            }
            Text(NativeReaderLegacyStrings.get(uiLanguage, "storageHint"))
            if (importStatus.isNotBlank()) Text(importStatus)
            if (error.isNotBlank()) Text(error)
        }
        return
    }

    val folders = folderNames
    val shown = NativeReaderBookFilters.apply(library, filter, order, folder = "",
        queueIds = queuedIds)
    val actions = NativeReaderLegacyStrings.actions(uiLanguage)

    /**
     * Continue with the existing TifloLector for an older book. No copying,
     * deletion or position conversion: the original reader retains all marks.
     */
    fun openPreviousBook(bookId: String? = null) {
        val navigation = context.getSharedPreferences(
            "tiflo-reader-navigation", android.content.Context.MODE_PRIVATE
        )
        val change = navigation.edit().putBoolean("open-existing-library", true)
        if (bookId.isNullOrBlank()) change.remove("open-existing-book-id")
        else change.putString("open-existing-book-id", bookId)
        if (!change.commit()) {
            error = NativeReaderLegacyStrings.get(uiLanguage, "previousOpenError")
            return
        }
        try {
            val backIntent = Intent().setClassName(
                context.packageName, "com.tifloacosta.app.MainActivity"
            ).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            context.startActivity(backIntent)
            (context as? android.app.Activity)?.finish()
        } catch (failure: Exception) {
            navigation.edit().remove("open-existing-library")
                .remove("open-existing-book-id").apply()
            error = NativeReaderLegacyStrings.get(uiLanguage, "previousUnavailable")
        }
    }

    Column(modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)) {
        TextButton(onClick = onBack) { Text(NativeReaderLibraryStrings.get(uiLanguage, "home")) }
        if (sharedImportNotice.isNotBlank()) Text(sharedImportNotice)
        Text("TifloLector", style = MaterialTheme.typography.headlineSmall,
            modifier = Modifier.semantics { heading() })
        Button(onClick = { screen = "import" }, modifier = Modifier.fillMaxWidth()) {
            Text(NativeReaderLibraryStrings.get(uiLanguage, "import"))
        }
        // The library must be immediately reachable after Import with TalkBack.
        Text(NativeReaderLibraryStrings.get(uiLanguage, "myLibrary"),
            style = MaterialTheme.typography.titleMedium,
            modifier = Modifier.semantics { heading() })
        TextButton(onClick = {
            selectionMode = !selectionMode
            if (!selectionMode) selectedBookIds = emptySet()
        }) {
            Text(NativeReaderLibraryStrings.get(uiLanguage, if (selectionMode) "done" else "select"))
        }
        if (selectionMode) {
            Text(NativeReaderLibraryStrings.get(uiLanguage, "selectedCount") + ": " + selectedBookIds.size)
            Button(onClick = { confirmMultipleDeletion = true },
                enabled = selectedBookIds.isNotEmpty()) {
                Text(NativeReaderLibraryStrings.get(uiLanguage, "delete"))
            }
        }
        if (loading) Text(NativeReaderLibraryStrings.get(uiLanguage, "loading"))
        else if (shown.isEmpty()) Text(
            NativeReaderLibraryStrings.get(uiLanguage, "empty")
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
                    10 -> open(book, openExport = true)
                }
            }
            // One TalkBack stop per book: title, selected action, then progress.
            // Clear the Material button/text semantics before assigning the final
            // accessible name. Otherwise the title can be announced twice.
            val readingStatus = when {
                book.finished -> NativeReaderLibraryStrings.get(uiLanguage, "finished")
                book.tracks.isNotEmpty() ->
                    NativeReaderLibraryStrings.get(uiLanguage, "audioSection") + " " +
                    (book.trackIndex + 1) + " / " +
                    book.audioSegments.ifEmpty { book.tracks.map { ReaderAudioSegment(0) } }.size
                else -> NativeReaderLibraryStrings.get(uiLanguage, "read") + " " +
                    ReaderUnits.percent(book.offset, book.length) +
                    " " + NativeReaderLibraryStrings.get(uiLanguage, "percent")
            }
            if (selectionMode) {
                OutlinedButton(onClick = {
                    selectedBookIds = if (book.id in selectedBookIds) selectedBookIds - book.id
                        else selectedBookIds + book.id
                }, modifier = Modifier.fillMaxWidth().semantics {
                    stateDescription = NativeReaderLibraryStrings.get(uiLanguage,
                        if (book.id in selectedBookIds) "selected" else "notSelected")
                }) {
                    Text(book.title + ", " + NativeReaderLibraryStrings.get(uiLanguage,
                        if (book.id in selectedBookIds) "selected" else "notSelected"))
                }
            } else {
            OutlinedButton(onClick = { run(action) },
                modifier = Modifier.fillMaxWidth().clearAndSetSemantics {
                    // One TalkBack stop: title followed by reading progress.
                    // Only the currently selected gesture action appears as state.
                    contentDescription = NativeReaderRowPresentation.label(book, readingStatus, talkBackDetail, uiLanguage)
                    stateDescription = actions[action]
                    progressBarRangeInfo = ProgressBarRangeInfo(
                        action.toFloat(), 0f..actions.lastIndex.toFloat(), actions.size - 2
                    )
                    setProgress { v ->
                        action = v.roundToInt().coerceIn(0, actions.lastIndex)
                        true
                    }
                    onClick(label = NativeReaderLibraryStrings.get(uiLanguage, "bookAction")) {
                        run(action)
                        true
                    }
                    customActions = actions.mapIndexed { i, label ->
                        CustomAccessibilityAction(label) { run(i); true }
                    }
                }) { Text(book.title + ". " + readingStatus) }
            }
        }
        if (shown.size > visibleCount) {
            TextButton(onClick = { visibleCount += 10 }) {
                Text(NativeReaderLibraryStrings.get(uiLanguage, "more"))
            }
        }
        TextButton(onClick = { screen = "settings" }, modifier = Modifier.fillMaxWidth()) {
            Text(NativeReaderLibraryStrings.get(uiLanguage, "settings"))
        }
        // Folders are an everyday library operation, not a hidden filter.
        TextButton(onClick = { screen = "folders" }, modifier = Modifier.fillMaxWidth()) {
            Text(NativeReaderLibraryStrings.get(uiLanguage, "folders"))
        }
        TextButton(onClick = { filtersExpanded = !filtersExpanded },
            modifier = Modifier.fillMaxWidth().semantics {
                stateDescription = NativeReaderLibraryStrings.get(uiLanguage,
                    if (filtersExpanded) "expanded" else "collapsed")
            }) { Text(NativeReaderLibraryStrings.get(uiLanguage, "filters")) }
        if (filtersExpanded) {
            ReaderAdjustableChoice(
                NativeReaderLibraryStrings.get(uiLanguage, "details"),
                NativeReaderLibraryStrings.detailLevels(uiLanguage),
                talkBackDetail
            ) {
                talkBackDetail = it
                preferences.edit().putInt("talkback-library-details", it).apply()
            }
            ReaderAdjustableChoice(
                NativeReaderLibraryStrings.get(uiLanguage, "filter"),
                NativeReaderBookFilters.formatFilters(uiLanguage), filter
            ) { filter = it; visibleCount = 10 }
            ReaderAdjustableChoice(
                NativeReaderLibraryStrings.get(uiLanguage, "sort"),
                NativeReaderBookFilters.sortChoices(uiLanguage), order
            ) { order = it }
            TextButton(onClick = { screen = "queue" }, modifier = Modifier.fillMaxWidth()) {
                Text(NativeReaderLibraryStrings.get(uiLanguage, "queue"))
            }
        }
        // La biblioteca de la versión antigua NO forma parte de la biblioteca
        // predeterminada. Los archivos originales no se borran ni se modifican.
        if (legacyState?.databasePresent == true && legacyState?.bookCount != 0) {
            TextButton(
                onClick = { showPreviousLibrary = !showPreviousLibrary },
                modifier = Modifier.fillMaxWidth().semantics {
                    stateDescription = NativeReaderLibraryStrings.get(uiLanguage,
                        if (showPreviousLibrary) "expanded" else "collapsed")
                }
            ) {
                Text(NativeReaderLegacyStrings.get(uiLanguage, "legacyRecover"))
            }
        }
        if (showPreviousLibrary) legacyState?.let { state ->
            if (legacyReadError.isNotBlank()) Text(legacyReadError)
            if (state.databasePresent && state.bookCount == null) {
                Text(NativeReaderLegacyStrings.get(uiLanguage, "legacyUnreadable"))
            } else if ((state.bookCount ?: 0) > 0) {
                Text(
                    NativeReaderLegacyStrings.get(uiLanguage, "legacyCount", state.bookCount ?: 0),
                    style = MaterialTheme.typography.titleMedium,
                    modifier = Modifier.semantics { heading() }
                )
                legacyBooks.forEach { previous ->
                    TextButton(
                        onClick = { openPreviousBook(previous.id) },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(NativeReaderLegacyStrings.get(uiLanguage, "legacyOpen") + previous.title)
                    }
                }
                if (legacyBooks.size < (state.bookCount ?: 0)) {
                    TextButton(
                        onClick = {
                            scope.launch {
                                try {
                                    val next = withContext(Dispatchers.IO) {
                                        NativeLegacyLibraryCheck.listBooks(
                                            context.applicationContext,
                                            offset = legacyBooks.size, limit = 20
                                        )
                                    }
                                    legacyBooks = legacyBooks + next
                                } catch (failure: Exception) {
                                    legacyReadError = NativeReaderLegacyStrings.get(uiLanguage, "legacyLoadError")
                                }
                            }
                        }, modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(NativeReaderLegacyStrings.get(uiLanguage, "legacyMore"))
                    }
                }
            }
            if (state.databasePresent && state.bookCount != 0) {
                TextButton(onClick = { openPreviousBook() }, modifier = Modifier.fillMaxWidth()) {
                    Text(NativeReaderLegacyStrings.get(uiLanguage, "legacyComplete"))
                }
            }
        }
        if (importResult.isNotBlank()) Text(importResult,
            modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite })
        if (error.isNotBlank()) Text(error)
    }

    info?.let { book ->
        AlertDialog(onDismissRequest = { info = null },
            title = { Text(NativeReaderBookDialogStrings.get(uiLanguage, "info")) },
            text = { Text(book.title + "\n" + book.format.uppercase() +
                "\n" + NativeReaderBookDialogStrings.get(uiLanguage, "marks") +
                (if (book.tracks.isNotEmpty()) book.audioMarks.size else book.marks.size) +
                "\n" + when {
                    book.finished -> NativeReaderBookDialogStrings.get(uiLanguage, "finished")
                    book.tracks.isNotEmpty() -> NativeReaderBookDialogStrings.get(uiLanguage, "audioSection") +
                        (book.trackIndex + 1) + " / " +
                        (if (book.audioSegments.isNotEmpty()) book.audioSegments.size else book.tracks.size) +
                        ", " + (book.audioPositionMs / 1000) + " s"
                    else -> NativeReaderBookDialogStrings.get(uiLanguage, "read") +
                        ReaderUnits.percent(book.offset, book.length) + "%"
                } + "\n" + NativeReaderBookDialogStrings.get(uiLanguage, "lastRead") +
                if (book.lastReadAt > 0L)
                    java.text.DateFormat.getDateTimeInstance().format(java.util.Date(book.lastReadAt))
                else NativeReaderBookDialogStrings.get(uiLanguage, "never")) },
            confirmButton = { TextButton(onClick = { info = null }) { Text(NativeReaderBookDialogStrings.get(uiLanguage, "ok")) } })
    }
    rename?.let { book ->
        AlertDialog(onDismissRequest = { rename = null },
            title = { Text(NativeReaderBookDialogStrings.get(uiLanguage, "rename")) },
            text = { TextField(value = proposedTitle, onValueChange = { proposedTitle = it.take(180) }) },
            confirmButton = { TextButton(onClick = {
                if (proposedTitle.isNotBlank()) save(book.copy(title = proposedTitle.trim()))
                rename = null
            }) { Text(NativeReaderBookDialogStrings.get(uiLanguage, "save")) } },
            dismissButton = { TextButton(onClick = { rename = null }) { Text(NativeReaderBookDialogStrings.get(uiLanguage, "cancel")) } })
    }
    moveBook?.let { book ->
        AlertDialog(onDismissRequest = { moveBook = null },
            title = { Text(NativeReaderLegacyStrings.get(uiLanguage, "move")) },
            text = { Column {
                TextField(value = proposedFolder, onValueChange = { proposedFolder = it.take(70) },
                    label = { Text(NativeReaderBookDialogStrings.get(uiLanguage, "folder")) })
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
                            refresh()
                        } catch (e: Exception) {
                            error = e.message ?: "No se pudo crear la carpeta."
                        }
                    }
                }) {
                    Text(NativeReaderBookDialogStrings.get(uiLanguage, "createFolder"))
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
                        refresh()
                    } catch (e: Exception) { error = e.message.orEmpty() }
                }
            }) { Text(NativeReaderBookDialogStrings.get(uiLanguage, "move")) } },
            dismissButton = { TextButton(onClick = { moveBook = null }) { Text(NativeReaderBookDialogStrings.get(uiLanguage, "cancel")) } })
    }
    if (confirmMultipleDeletion) {
        AlertDialog(
            onDismissRequest = { confirmMultipleDeletion = false },
            title = { Text(NativeReaderBookDialogStrings.get(uiLanguage, "deleteMultiple")) },
            text = { Text(NativeReaderBookDialogStrings.get(uiLanguage, "deleteMultipleBody", selectedBookIds.size)) },
            confirmButton = { TextButton(onClick = {
                val targetIDs = selectedBookIds
                confirmMultipleDeletion = false
                scope.launch {
                    var failed = 0
                    withContext(Dispatchers.IO) {
                        val snapshot = store.list()
                        for (book in snapshot.filter { it.id in targetIDs }) {
                            try {
                                if (NativeReaderPlaybackService.snapshot.value.bookId == book.id) {
                                    NativeReaderPlaybackService.send(
                                        context, NativeReaderPlaybackService.ACTION_STOP)
                                }
                                store.delete(book)
                            } catch (_: Exception) { failed++ }
                        }
                        organization.pruneQueue(store.list())
                    }
                    selectedBookIds = emptySet()
                    selectionMode = false
                    refresh()
                    if (failed > 0) error = NativeReaderBookDialogStrings.get(uiLanguage, "failedDelete", failed)
                }
            }) { Text(NativeReaderBookDialogStrings.get(uiLanguage, "delete")) } },
            dismissButton = { TextButton(onClick = {
                confirmMultipleDeletion = false
            }) { Text(NativeReaderBookDialogStrings.get(uiLanguage, "cancel")) } }
        )
    }
    deleteBook?.let { book ->
        AlertDialog(onDismissRequest = { deleteBook = null },
            title = { Text(NativeReaderBookDialogStrings.get(uiLanguage, "deleteSingle")) },
            text = { Text(book.title) },
            confirmButton = { TextButton(onClick = {
                if (NativeReaderPlaybackService.snapshot.value.bookId == book.id) {
                    NativeReaderPlaybackService.send(context, NativeReaderPlaybackService.ACTION_STOP)
                }
                scope.launch {
                    try {
                        withContext(Dispatchers.IO) {
                            store.delete(book)
                            organization.pruneQueue(store.list())
                        }
                        if (selectedBook?.id == book.id) {
                            selectedBook = null
                            selectedText = ""
                        }
                        refresh()
                    } catch (e: Exception) {
                        error = e.message ?: "No se pudo eliminar la obra."
                    }
                }
                deleteBook = null
            }) { Text(NativeReaderBookDialogStrings.get(uiLanguage, "delete")) } },
            dismissButton = { TextButton(onClick = { deleteBook = null }) { Text(NativeReaderBookDialogStrings.get(uiLanguage, "cancel")) } })
    }
}

@Composable
private fun NativeReadingScreen(
    book: ReaderBook,
    fullText: String,
    english: Boolean,
    startOnOpen: Boolean,
    openExportOnStart: Boolean,
    rate: Float,
    onRateChange: (Float) -> Unit,
    onUpdate: (ReaderBook) -> Unit,
    onOcrCompleted: () -> Unit,
    onDeleteRequest: () -> Unit,
    onBack: () -> Unit
) {
    val context = LocalContext.current
    val uiLanguage = LocalNativeUiLanguage.current
    if (book.tracks.isNotEmpty()) {
        val store = remember { NativeReaderStore(context.applicationContext) }
        NativeReaderAudioScreen(book, store, english, startOnOpen, onUpdate,
            onDeleteRequest, onBack)
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
            documentPreferences.getInt("unit", 1)).coerceIn(0, 7))
    }
    var showAudio by rememberSaveable(book.id) { mutableStateOf(false) }
    var showPronunciation by rememberSaveable(book.id) { mutableStateOf(false) }
    var showTools by rememberSaveable(book.id) { mutableStateOf(openExportOnStart) }
    val dictionary = remember { NativePronunciationStore(context.applicationContext) }
    var sleepIndex by remember(book.id) { mutableIntStateOf(0) }
    val sleepMinutes = listOf(0, 5, 10, 15, 30, 45, 60)
    val sleepChoices = NativeReaderPlaybackStrings.sleepChoices(uiLanguage)
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
    val phononReady = remember(book.id) {
        NativePhononReader.isAvailable(context.applicationContext)
    }
    val phononVoices = remember(book.id, phononReady) {
        if (phononReady) NativePhononModelStore.voices(context) else emptyList()
    }
    var phononVoice by rememberSaveable(book.id) {
        mutableStateOf(prefs.getString("phonon.voice", "").orEmpty())
    }
    var readingEngine by rememberSaveable(book.id) {
        mutableIntStateOf(prefs.getInt("engine." + book.id, 0))
    }
    var engineMessage by remember(book.id) { mutableStateOf("") }
    var bookmarkMessage by remember(book.id) { mutableStateOf("") }
    var geminiVoiceIndex by rememberSaveable(book.id) {
        mutableIntStateOf(
            NativeGeminiSpeech.voices.indexOf(prefs.getString("gemini.voice", "Kore"))
                .coerceAtLeast(0))
    }
    var showMarks by rememberSaveable(book.id) { mutableStateOf(false) }
    var jumping by rememberSaveable(book.id) { mutableStateOf(false) }
    var jumpTo by rememberSaveable(book.id) { mutableFloatStateOf(0f) }
    fun send(action: String, value: Int = 0) {
        NativeReaderPlaybackService.send(context, action, book.id, value)
    }
    fun startSpeech() {
        if (readingEngine == 2 && !phononReady) {
            engineMessage = NativeReaderInlineStrings.get(uiLanguage, "phononMissing")
            return
        }
        if (readingEngine == 1 && !NativeVoiceCredentials(context).hasKey("gemini")) {
            engineMessage = NativeReaderInlineStrings.get(uiLanguage, "geminiMissing")
            return
        }
        engineMessage = ""
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
    val availableModes = NativeReaderPlaybackStrings.modes(uiLanguage, chapters.isNotEmpty())
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
            6 -> ReaderNavigation.adjacentMark(visibleMarks, displayOffset, forward)
                ?.let { setOffset(it) }
            7 -> setOffset(ReaderNavigation.estimatedMinuteStep(
                fullText, displayOffset, forward, perBookRate))
            else -> if (units.isNotEmpty()) {
                if (active) send(if (forward) NativeReaderPlaybackService.ACTION_NEXT
                    else NativeReaderPlaybackService.ACTION_PREVIOUS)
                else setOffset(units[
                    (currentIndex + if (forward) 1 else -1).coerceIn(0, units.lastIndex)
                ].start)
            }
        }
    }

    val actions = NativeReaderPlaybackStrings.actions(uiLanguage)
    fun execute(which: Int) {
        when (which) {
            0 -> toggleSpeech()
            1 -> if (active) send(NativeReaderPlaybackService.ACTION_STOP)
            2, 3 -> moveOneUnit(which == 3)
            4 -> {
                val mark = displayOffset.coerceIn(0, fullText.length)
                if (mark in visibleMarks) {
                    bookmarkMessage = NativeReaderInlineStrings.get(uiLanguage, "bookmarkExists")
                } else {
                    if (active) send(NativeReaderPlaybackService.ACTION_BOOKMARK)
                    else onUpdate(book.copy(marks = book.marks + mark, offset = mark))
                    bookmarkMessage = NativeReaderInlineStrings.get(uiLanguage, "bookmarkCreated")
                }
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
    // Never start speaking from a stored setting merely because a document opened.
    // Explicit "Play" in the library remains the only automatic-start request.
    LaunchedEffect(book.id, startOnOpen) {
        if (startOnOpen && !playing) startSpeech()
    }

    if (showPronunciation) {
        NativePronunciationSettings(english, onBack = { showPronunciation = false })
        return
    }
    if (showTools) {
        NativeReaderDocumentActions(book, english, current?.text.orEmpty(),
            initialAudioExport = openExportOnStart,
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
                stateDescription = NativeReaderPlaybackStrings.get(uiLanguage, "actionLabel") + ": " +
                    actions[selectedAction]
                progressBarRangeInfo = ProgressBarRangeInfo(
                    selectedAction.toFloat(), 0f..actions.lastIndex.toFloat(), actions.size - 2
                )
                setProgress { value ->
                    selectedAction = value.roundToInt().coerceIn(0, actions.lastIndex)
                    true
                }
                onClick(label = NativeReaderInlineStrings.get(uiLanguage, "readingAction")) {
                    execute(selectedAction)
                    true
                }
                customActions = actions.mapIndexed { i, label ->
                    CustomAccessibilityAction(label) { execute(i); true }
                }
            }
        )
        TextButton(onClick = {
            if (active) send(NativeReaderPlaybackService.ACTION_STOP)
            onBack()
        }) {
            Text(NativeReaderPlaybackStrings.get(uiLanguage, "back"))
        }
        Button(
            onClick = { toggleSpeech() },
            enabled = units.isNotEmpty(),
            modifier = Modifier.fillMaxWidth()
        ) {
            Text(
                if (playing) NativeReaderPlaybackStrings.get(uiLanguage, "pause")
                else NativeReaderPlaybackStrings.get(uiLanguage, "play")
            )
        }
        ReaderCompactChoice(
            NativeReaderPlaybackStrings.get(uiLanguage, "moveBy"),
            availableModes.map { it.second }, selectedModeIndex, english
        ) { choice ->
            val chosen = availableModes[choice].first
            unitType = chosen
            prefs.edit().putInt("unit." + book.id, chosen).apply()
            // Changing navigation must not change the saved reading offset.
            if (active) send(NativeReaderPlaybackService.ACTION_UNIT,
                chosen.takeIf { it in 0..2 } ?: 1)
        }
        Button(onClick = { if (active) send(NativeReaderPlaybackService.ACTION_STOP) },
            modifier = Modifier.fillMaxWidth()) {
            Text(NativeReaderPlaybackStrings.get(uiLanguage, "stop"))
        }
        TextButton(onClick = { showTools = true }, modifier = Modifier.fillMaxWidth()) {
            Text(NativeReaderPlaybackStrings.get(uiLanguage, "convert"))
        }
        if (bookmarkMessage.isNotEmpty()) Text(bookmarkMessage,
            modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite })
        if (!speaker.ready.value && readingEngine == 0) {
            Text(NativeReaderPlaybackStrings.get(uiLanguage, "initializing"))
        }

        when (effectiveUnitType) {
            3 -> ReaderCompactOffsetPosition(
                label = NativeReaderInlineStrings.get(uiLanguage, "word"),
                valueLabel = ReaderNavigation.wordAt(fullText, displayOffset),
                current = displayOffset,
                maximum = fullText.length,
                english = english,
                onPrevious = { moveOneUnit(false) },
                onNext = { moveOneUnit(true) }
            )
            4 -> ReaderCompactPosition(
                label = NativeReaderInlineStrings.get(uiLanguage, "chapter"),
                current = currentChapter,
                count = chapters.size,
                english = english
            ) { chosen -> chapters.getOrNull(chosen)?.let { position -> setOffset(position) } }
            5 -> ReaderCompactOffsetPosition(
                label = NativeReaderInlineStrings.get(uiLanguage, "percentage"),
                valueLabel = ReaderUnits.percent(displayOffset, fullText.length).toString() + "%",
                current = ReaderUnits.percent(displayOffset, fullText.length),
                maximum = 100,
                english = english,
                onPrevious = { moveOneUnit(false) },
                onNext = { moveOneUnit(true) }
            )
            6, 7 -> ReaderCompactOffsetPosition(
                label = NativeReaderInlineStrings.get(uiLanguage, "position"),
                valueLabel = ReaderUnits.percent(displayOffset, fullText.length).toString() + "%",
                current = ReaderUnits.percent(displayOffset, fullText.length),
                maximum = 100,
                english = english,
                onPrevious = { moveOneUnit(false) },
                onNext = { moveOneUnit(true) }
            )
            else -> ReaderCompactPosition(
                label = NativeReaderInlineStrings.get(uiLanguage, "positionBy") +
                    availableModes[selectedModeIndex].second.lowercase(),
                current = currentIndex,
                count = units.size,
                english = english
            ) { chosen -> units.getOrNull(chosen)?.let { unit -> setOffset(unit.start) } }
        }
        // Show and announce the same complete message: never replace the
        // percentage with a content description that hides its value.
        Text(
            NativeReaderPlaybackStrings.get(uiLanguage, "progress") + ": " +
                ReaderUnits.percent(displayOffset, fullText.length) +
                NativeReaderPlaybackStrings.get(uiLanguage, "percentRead")
        )
        ReaderCompactChoice(
            NativeReaderPlaybackStrings.get(uiLanguage, "speed"),
            listOf("0,75", "0,9", NativeReaderInlineStrings.get(uiLanguage, "speedNormal"), "1,25", "1,5"),
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
            NativeReaderPlaybackStrings.get(uiLanguage, "sleep"),
            sleepChoices, sleepIndex, english
        ) { index ->
            sleepIndex = index
            if (active) send(NativeReaderPlaybackService.ACTION_SLEEP, sleepMinutes[index])
        }
        TextButton(
            onClick = { showAudio = !showAudio },
            modifier = Modifier.semantics {
                stateDescription = NativeReaderLibraryStrings.get(uiLanguage,
                    if (showAudio) "expanded" else "collapsed")
            }
        ) { Text(NativeReaderInlineStrings.get(uiLanguage, "audio")) }
        if (showAudio) {
        ReaderCompactChoice(
            NativeReaderInlineStrings.get(uiLanguage, "engine"),
            if (phononReady) {
                listOf(NativeReaderInlineStrings.get(uiLanguage, "system"), "Gemini", "Phonon")
            } else {
                listOf(NativeReaderInlineStrings.get(uiLanguage, "system"), "Gemini")
            },
            readingEngine.coerceIn(0, if (phononReady) 2 else 1), english
        ) { chosen ->
            readingEngine = chosen
            prefs.edit().putInt("engine." + book.id, chosen).apply()
            if (active) send(NativeReaderPlaybackService.ACTION_VOICE)
        }
        if (readingEngine == 2 && phononReady) {
            if (phononVoices.isNotEmpty()) {
                ReaderCompactChoice(
                    NativeReaderInlineStrings.get(uiLanguage, "phononVoice"),
                    phononVoices,
                    phononVoices.indexOf(phononVoice).coerceAtLeast(0),
                    english
                ) { index ->
                    val chosenVoice = phononVoices[index]
                    phononVoice = chosenVoice
                    prefs.edit().putString("phonon.voice", chosenVoice).apply()
                    if (active) send(NativeReaderPlaybackService.ACTION_VOICE)
                }
            }
            Text(NativeReaderInlineStrings.get(uiLanguage, "phononHelp"))
        }
        if (readingEngine == 1) {
            ReaderCompactChoice(
                NativeReaderInlineStrings.get(uiLanguage, "voice"),
                NativeGeminiSpeech.voices, geminiVoiceIndex, english
            ) { selected ->
                geminiVoiceIndex = selected
                prefs.edit().putString("gemini.voice", NativeGeminiSpeech.voices[selected]).apply()
                if (active) send(NativeReaderPlaybackService.ACTION_VOICE)
            }
            Text(NativeReaderInlineStrings.get(uiLanguage, "geminiPrivacy"))
        }
        if (engineMessage.isNotEmpty()) Text(engineMessage)
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
                    if (active) send(NativeReaderPlaybackService.ACTION_VOICE)
                }
            )
            TextButton(onClick = {
                if (active) send(NativeReaderPlaybackService.ACTION_PAUSE)
                showPronunciation = true
            }) { Text(NativeReaderInlineStrings.get(uiLanguage, "pronunciation")) }
        }
        TextButton(
            onClick = { showVisual = !showVisual },
            modifier = Modifier.semantics {
                stateDescription = NativeReaderLibraryStrings.get(uiLanguage,
                    if (showVisual) "expanded" else "collapsed")
            }
        ) { Text(NativeReaderInlineStrings.get(uiLanguage, "visual")) }
        if (showVisual) {
            ReaderCompactChoice(
                NativeReaderInlineStrings.get(uiLanguage, "textSize"),
                (14..40 step 2).map { it.toString() }, textSize, english
            ) { textSize = it; prefs.edit().putInt("font." + book.id, it).apply() }
            ReaderCompactChoice(
                NativeReaderInlineStrings.get(uiLanguage, "lineSpacing"),
                listOf("lineNormal", "lineComfort", "lineWide").map { NativeReaderInlineStrings.get(uiLanguage, it) }, lineSpacing, english
            ) { lineSpacing = it; prefs.edit().putInt("spacing." + book.id, it).apply() }
            ReaderCompactChoice(
                NativeReaderInlineStrings.get(uiLanguage, "bold"),
                listOf("no", "yes").map { NativeReaderInlineStrings.get(uiLanguage, it) }, boldText, english
            ) { boldText = it; prefs.edit().putInt("bold." + book.id, it).apply() }
        }
        TextButton(onClick = onDeleteRequest) {
            Text(NativeReaderInlineStrings.get(uiLanguage, "delete"))
        }
        TextButton(
            onClick = { jumping = !jumping },
            modifier = Modifier.semantics {
                stateDescription = NativeReaderPlaybackStrings.get(uiLanguage,
                    if (jumping) "expanded" else "collapsed")
            }
        ) {
            Text(NativeReaderPlaybackStrings.get(uiLanguage, "moreActions"))
        }
        if (jumping) {
            Text(NativeReaderInlineStrings.get(uiLanguage, "goPosition"))
            Slider(
                value = jumpTo,
                onValueChange = { jumpTo = it.roundToInt().toFloat() },
                valueRange = 0f..100f,
                steps = 9,
                modifier = Modifier.semantics {
                    contentDescription = NativeReaderInlineStrings.get(uiLanguage, "positionPercent")
                    stateDescription = jumpTo.roundToInt().toString() + "%"
                }
            )
            Button(onClick = {
                setOffset((fullText.length * jumpTo / 100f).roundToInt())
            }) {
                Text(NativeReaderInlineStrings.get(uiLanguage, "go"))
            }
            Button(onClick = {
                val mark = offset.coerceIn(0, fullText.length)
                if (mark in visibleMarks) {
                    bookmarkMessage = NativeReaderInlineStrings.get(uiLanguage, "bookmarkExists")
                } else {
                    if (active) send(NativeReaderPlaybackService.ACTION_BOOKMARK)
                    else onUpdate(book.copy(marks = book.marks + mark, offset = mark))
                    bookmarkMessage = NativeReaderInlineStrings.get(uiLanguage, "bookmarkCreated")
                }
            }) {
                Text(NativeReaderPlaybackStrings.get(uiLanguage, "addBookmark"))
            }
            TextButton(
                onClick = { showMarks = !showMarks },
                modifier = Modifier.semantics {
                    stateDescription = NativeReaderPlaybackStrings.get(uiLanguage,
                        if (showMarks) "expanded" else "collapsed")
                }
            ) {
                Text(NativeReaderPlaybackStrings.get(uiLanguage, "bookmarks"))
            }
            if (showMarks) {
                if (visibleMarks.isEmpty()) Text(NativeReaderPlaybackStrings.get(uiLanguage, "noBookmarks"))
                visibleMarks.forEach { mark ->
                    OutlinedButton(onClick = { setOffset(mark) }) {
                        Text(NativeReaderInlineStrings.get(uiLanguage, "goTo") +
                            ReaderUnits.percent(mark, fullText.length) + "%")
                    }
                }
            }
        }

        if (preview != null) {
            Text(
                NativeReaderInlineStrings.get(uiLanguage, "readingText"),
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
