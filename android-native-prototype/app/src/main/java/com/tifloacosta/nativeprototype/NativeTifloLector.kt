package com.tifloacosta.nativeprototype

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
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlin.math.roundToInt

/** Compact TifloLector home: Importar, Ajustes, Filtros y Mi biblioteca. */
@Composable
fun NativeTifloLector(english: Boolean, onBack: () -> Unit) {
    val context = LocalContext.current
    val store = remember { NativeReaderStore(context.applicationContext) }
    val scope = rememberCoroutineScope()
    var library by remember { mutableStateOf<List<ReaderBook>>(emptyList()) }
    var selectedBook by remember { mutableStateOf<ReaderBook?>(null) }
    var selectedText by remember { mutableStateOf("") }
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
    val preferences = remember { context.getSharedPreferences("native-reader-preferences", 0) }
    var rate by remember {
        mutableFloatStateOf(preferences.getFloat("rate", 1f).coerceIn(.6f, 1.8f))
    }

    fun refresh() {
        scope.launch { library = withContext(Dispatchers.IO) { store.list() } }
    }
    LaunchedEffect(Unit) {
        library = withContext(Dispatchers.IO) { store.list() }
        loading = false
    }
    fun open(book: ReaderBook) {
        error = ""
        scope.launch {
            try {
                selectedText = withContext(Dispatchers.IO) { store.read(book) }
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
            for (uri in uris) {
                try { withContext(Dispatchers.IO) { store.import(uri) } }
                catch (e: Exception) { error += (e.message ?: "No se pudo importar.") + "\n" }
            }
            refresh()
            screen = "home"
        }
    }
    fun back() {
        if (selectedBook != null) { selectedBook = null; selectedText = "" }
        else if (screen == "catalogs") screen = "import"
        else if (screen != "home") screen = "home"
        else onBack()
    }
    BackHandler { back() }
    selectedBook?.let { book ->
        NativeReadingScreen(
            book = book,
            fullText = selectedText,
            english = english,
            rate = rate,
            onRateChange = { rate = it; preferences.edit().putFloat("rate", it).apply() },
            onUpdate = ::save,
            onBack = { selectedBook = null; selectedText = "" }
        )
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
                modifier = Modifier.fillMaxWidth()) {
                Text(if (english) "Device and cloud files" else "Archivos del dispositivo y nubes")
            }
            Button(onClick = { screen = "catalogs" }, modifier = Modifier.fillMaxWidth()) {
                Text(if (english) "External libraries (OPDS)" else "Bibliotecas externas (OPDS)")
            }
            Text(if (english)
                "Android shows device storage and available cloud providers in its document picker."
                else "El selector de documentos de Android ofrece archivos locales y proveedores de nube instalados.")
            if (error.isNotBlank()) Text(error)
        }
        return
    }

    val folders = library.map { it.folder }.filter { it.isNotBlank() }.distinct().sorted()
    val folderChoices = listOf(
        if (english) "All folders" else "Todas las carpetas",
        if (english) "Unfiled" else "Sin carpeta"
    ) + folders
    val selectedFolder = when(folderFilter) {
        0 -> ""
        1 -> "__none__"
        else -> folders.getOrNull(folderFilter - 2).orEmpty()
    }
    val shown = NativeReaderBookFilters.apply(library, filter, order, selectedFolder)
    val actions = if (english)
        listOf("Open", "Play", "Bookmarks", "Favorite", "Information", "Rename", "Move to folder", "Delete")
    else listOf("Abrir", "Reproducir", "Marcas", "Favorito", "Información",
        "Cambiar título", "Mover a carpeta", "Eliminar")

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
                    0, 1, 2 -> open(book)
                    3 -> save(book.copy(favorite = !book.favorite))
                    4 -> info = book
                    5 -> { proposedTitle = book.title; rename = book }
                    6 -> { proposedFolder = book.folder; moveBook = book }
                    7 -> deleteBook = book
                }
            }
            OutlinedButton(onClick = { run(action) },
                modifier = Modifier.fillMaxWidth().semantics {
                    contentDescription = book.title
                    stateDescription = actions[action]
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
                "\n" + (if (english) "Bookmarks: " else "Marcas: ") + book.marks.size +
                "\n" + (if (english) "Read: " else "Leído: ") +
                ReaderUnits.percent(book.offset, book.length) + "%") },
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
                folders.forEach { folder ->
                    TextButton(onClick = { proposedFolder = folder }) { Text(folder) }
                }
            } },
            confirmButton = { TextButton(onClick = {
                save(book.copy(folder = proposedFolder.trim()))
                moveBook = null
                folderFilter = 0
            }) { Text(if (english) "Move" else "Mover") } },
            dismissButton = { TextButton(onClick = { moveBook = null }) { Text("Cancelar") } })
    }
    deleteBook?.let { book ->
        AlertDialog(onDismissRequest = { deleteBook = null },
            title = { Text(if (english) "Delete book permanently?" else "¿Eliminar esta obra definitivamente?") },
            text = { Text(book.title) },
            confirmButton = { TextButton(onClick = {
                scope.launch {
                    withContext(Dispatchers.IO) { store.delete(book) }
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
    rate: Float,
    onRateChange: (Float) -> Unit,
    onUpdate: (ReaderBook) -> Unit,
    onBack: () -> Unit
) {
    val context = LocalContext.current
    if (book.tracks.isNotEmpty()) {
        val store = remember { NativeReaderStore(context.applicationContext) }
        NativeReaderAudioScreen(book, store, english, onUpdate, onBack)
        return
    }
    val speaker = remember(book.id) { NativeReaderSpeaker(context.applicationContext) }
    DisposableEffect(speaker) { onDispose { speaker.close() } }
    var playing by remember(book.id) { mutableStateOf(false) }
    var offset by remember(book.id) { mutableIntStateOf(book.offset) }
    var unitType by rememberSaveable(book.id) { mutableIntStateOf(1) }
    var showAudio by rememberSaveable(book.id) { mutableStateOf(false) }
    var showVisual by rememberSaveable(book.id) { mutableStateOf(false) }
    var showNavigation by rememberSaveable(book.id) { mutableStateOf(false) }
    var selectedAction by rememberSaveable(book.id) { mutableIntStateOf(0) }
    var showMarks by rememberSaveable(book.id) { mutableStateOf(false) }
    var jumping by rememberSaveable(book.id) { mutableStateOf(false) }
    var jumpTo by rememberSaveable(book.id) { mutableFloatStateOf(0f) }

    val units = remember(fullText, unitType) { ReaderUnits.split(fullText, unitType) }
    val currentIndex = ReaderUnits.indexForOffset(units, offset)
    val current = units.getOrNull(currentIndex)
    val steps = if (english) listOf("Block", "Paragraph", "Sentence")
        else listOf("Bloque", "Párrafo", "Frase")

    fun setOffset(value: Int) {
        val next = value.coerceIn(0, fullText.length)
        offset = next
        onUpdate(book.copy(offset = next))
    }

    val actions = if (english)
        listOf("Play or pause", "Stop", "Previous", "Next", "Bookmark", "More actions")
    else listOf("Reproducir o pausar", "Detener", "Anterior", "Siguiente",
        "Añadir marca", "Más acciones")
    fun execute(which: Int) {
        when (which) {
            0 -> playing = !playing
            1 -> { playing = false; speaker.stop() }
            2, 3 -> if (units.isNotEmpty()) {
                val index = (currentIndex + if (which == 2) -1 else 1).coerceIn(0, units.lastIndex)
                setOffset(units[index].start)
            }
            4 -> {
                val mark = offset.coerceIn(0, fullText.length)
                if (mark !in book.marks) onUpdate(book.copy(marks = book.marks + mark, offset = offset))
            }
            5 -> jumping = true
        }
    }

    LaunchedEffect(playing, offset, unitType, rate, speaker.ready.value, fullText) {
        if (playing && speaker.ready.value && current != null) {
            val nextOffset = units.getOrNull(currentIndex + 1)?.start ?: fullText.length
            speaker.speak(current.text, rate) {
                if (nextOffset >= fullText.length) playing = false
                setOffset(nextOffset)
            }
        } else if (!playing) speaker.stop()
    }

    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        TextButton(onClick = { playing = false; speaker.stop(); onBack() }) {
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
            onClick = { playing = !playing },
            enabled = speaker.ready.value && units.isNotEmpty(),
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
            onValueChange = { unitType = it.roundToInt().coerceIn(0, 2) },
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
            (if (english) "Read: " else "Leído: ") + ReaderUnits.percent(offset, fullText.length) + "%",
            modifier = Modifier.semantics {
                contentDescription = if (english) "Reading progress" else "Progreso de lectura"
            }
        )
        if (current != null) {
            Text(
                if (english) "Reading text" else "Texto de lectura",
                style = MaterialTheme.typography.titleMedium,
                modifier = Modifier.semantics { heading() }
            )
            Text(current.text)
        }
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
            Text(if (english) "Speech rate" else "Velocidad")
            Slider(
                value = rate,
                onValueChange = onRateChange,
                valueRange = 0.6f..1.8f,
                steps = 5,
                modifier = Modifier.semantics {
                    contentDescription = if (english) "Speech rate" else "Velocidad de lectura"
                }
            )
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
            if (book.marks.isEmpty()) Text(if (english) "No bookmarks" else "No hay marcas")
            book.marks.forEach { mark ->
                OutlinedButton(onClick = { setOffset(mark) }) {
                    Text((if (english) "Go to " else "Ir al ") +
                        ReaderUnits.percent(mark, fullText.length) + "%")
                }
            }
        }
    }
}
