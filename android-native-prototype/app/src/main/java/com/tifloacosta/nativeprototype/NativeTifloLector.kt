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

/** First native TifloLector chapter: a REAL offline text library, not a mock screen. */
@Composable
fun NativeTifloLector(english: Boolean, onBack: () -> Unit) {
    val context = LocalContext.current
    val store = remember { NativeReaderStore(context.applicationContext) }
    val scope = rememberCoroutineScope()
    var library by remember { mutableStateOf<List<ReaderBook>>(emptyList()) }
    var selectedBook by remember { mutableStateOf<ReaderBook?>(null) }
    var selectedText by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf("") }
    var query by rememberSaveable { mutableStateOf("") }
    var order by rememberSaveable { mutableIntStateOf(0) }
    var visibleCount by rememberSaveable { mutableIntStateOf(10) }
    var showSettings by rememberSaveable { mutableStateOf(false) }
    var showFilters by rememberSaveable { mutableStateOf(false) }
    var showList by rememberSaveable { mutableStateOf(true) }
    var showMarks by rememberSaveable { mutableStateOf(false) }
    val preferences = remember { context.getSharedPreferences("native-reader-preferences", 0) }
    var rate by remember {
        mutableFloatStateOf(preferences.getFloat("rate", 1f).coerceIn(0.6f, 1.8f))
    }

    LaunchedEffect(Unit) {
        library = withContext(Dispatchers.IO) { store.list() }
        loading = false
    }

    fun open(book: ReaderBook) {
        error = ""
        scope.launch {
            try {
                val contents = withContext(Dispatchers.IO) { store.read(book) }
                selectedText = contents
                selectedBook = book
            } catch (e: Exception) {
                error = e.message ?: "No se pudo leer el documento."
            }
        }
    }

    fun save(book: ReaderBook) {
        selectedBook = book
        library = library.map { if (it.id == book.id) book else it }
        scope.launch(Dispatchers.IO) { store.update(book) }
    }

    val importer = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) {
            error = ""
            scope.launch {
                try {
                    val book = withContext(Dispatchers.IO) { store.import(uri) }
                    library = withContext(Dispatchers.IO) { store.list() }
                    open(book)
                } catch (e: Exception) {
                    error = e.message ?: "No se pudo importar el archivo."
                }
            }
        }
    }

    val back: () -> Unit = {
        if (selectedBook != null) {
            selectedBook = null
            selectedText = ""
        } else onBack()
    }
    BackHandler { back() }

    val current = selectedBook
    if (current != null) {
        NativeReadingScreen(
            book = current,
            fullText = selectedText,
            english = english,
            rate = rate,
            onRateChange = { rate = it; preferences.edit().putFloat("rate", it).apply() },
            onUpdate = ::save,
            onBack = back
        )
        return
    }

    val ordered = library.filter { it.title.contains(query, ignoreCase = true) }
        .let { matched ->
            when (order) {
                1 -> matched.sortedBy { it.createdAt }
                2 -> matched.sortedBy { it.title.lowercase() }
                else -> matched.sortedByDescending { it.createdAt }
            }
        }

    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        TextButton(onClick = onBack) {
            Text(if (english) "Back to home" else "Volver al inicio")
        }
        Text(
            "TifloLector",
            style = MaterialTheme.typography.headlineSmall,
            modifier = Modifier.semantics { heading() }
        )
        Button(onClick = { importer.launch(arrayOf("*/*")) }, modifier = Modifier.fillMaxWidth()) {
            Text(if (english) "Import" else "Importar")
        }
        TextButton(
            onClick = { showSettings = !showSettings },
            modifier = Modifier.fillMaxWidth().semantics {
                stateDescription = if (showSettings)
                    (if (english) "Expanded" else "Abierto")
                else (if (english) "Collapsed" else "Cerrado")
            }
        ) {
            Text(if (english) "Settings" else "Ajustes")
        }
        if (showSettings) {
            Text(if (english) "Speech rate" else "Velocidad de lectura")
            Slider(
                value = rate, onValueChange = {
                    rate = it
                    preferences.edit().putFloat("rate", it).apply()
                },
                valueRange = 0.6f..1.8f, steps = 5,
                modifier = Modifier.semantics {
                    contentDescription = if (english) "Speech rate" else "Velocidad de lectura"
                    stateDescription = ((rate * 100).roundToInt()).toString() + "%"
                }
            )
            Text(
                if (english) "Uses the text-to-speech engine and voices installed in Android."
                else "Se utiliza el motor de texto a voz y las voces instaladas en Android."
            )
        }
        TextButton(
            onClick = { showFilters = !showFilters },
            modifier = Modifier.fillMaxWidth().semantics {
                stateDescription = if (showFilters)
                    (if (english) "Expanded" else "Abierto")
                else (if (english) "Collapsed" else "Cerrado")
            }
        ) {
            Text(if (english) "Filters" else "Filtros")
        }
        if (showFilters) {
            TextField(
                value = query,
                onValueChange = { query = it; visibleCount = 10 },
                label = { Text(if (english) "Search titles" else "Buscar títulos") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )
            val options = if (english) listOf("Newest", "Oldest", "Title")
                else listOf("Más recientes", "Más antiguos", "Por título")
            Text(
                (if (english) "Order: " else "Orden: ") + options[order],
                modifier = Modifier.clearAndSetSemantics { }
            )
            Slider(
                value = order.toFloat(),
                onValueChange = { order = it.roundToInt().coerceIn(0, 2) },
                valueRange = 0f..2f,
                steps = 1,
                modifier = Modifier.semantics {
                    contentDescription = if (english) "Sort library" else "Ordenar biblioteca"
                    stateDescription = options[order]
                }
            )
        }
        TextButton(
            onClick = { showList = !showList },
            modifier = Modifier.fillMaxWidth().semantics {
                stateDescription = if (showList)
                    (if (english) "Expanded" else "Abierto")
                else (if (english) "Collapsed" else "Cerrado")
            }
        ) {
            Text(if (english) "My library" else "Mi biblioteca")
        }
        if (showList) {
            if (loading) Text(if (english) "Loading library" else "Cargando biblioteca")
            else if (ordered.isEmpty()) {
                Text(if (english) "No documents in this selection." else "No hay documentos en esta selección.")
            } else {
                ordered.take(visibleCount).forEach { book ->
                    OutlinedButton(
                        onClick = { open(book) },
                        modifier = Modifier.fillMaxWidth()
                    ) { Text(book.title) }
                }
                if (ordered.size > visibleCount) {
                    TextButton(onClick = { visibleCount += 10 }) {
                        Text(if (english) "Show ten more" else "Mostrar diez más")
                    }
                }
            }
        }
        TextButton(
            onClick = { showMarks = !showMarks },
            modifier = Modifier.fillMaxWidth().semantics {
                stateDescription = if (showMarks)
                    (if (english) "Expanded" else "Abierto")
                else (if (english) "Collapsed" else "Cerrado")
            }
        ) {
            Text(if (english) "Bookmarks" else "Marcas")
        }
        if (showMarks) {
            val marked = library.flatMap { book -> book.marks.map { book to it } }
            if (marked.isEmpty()) {
                Text(if (english) "No bookmarks saved yet." else "Todavía no hay marcas guardadas.")
            }
            marked.forEach { (book, offset) ->
                OutlinedButton(
                    modifier = Modifier.fillMaxWidth(),
                    onClick = { open(book.copy(offset = offset)) }
                ) {
                    Text(book.title + ", " + ReaderUnits.percent(offset, book.length) + "%")
                }
            }
        }
        if (error.isNotBlank()) Text(error)
        Text(
            if (english) "First native reader phase: TXT, HTML and Markdown text up to 4 MB. " +
                "Books are saved privately in this trial app, independently of Google Play."
            else "Primera fase del lector nativo: TXT, HTML y Markdown de hasta 4 MB. " +
                "Los documentos se guardan en esta aplicación de pruebas, separada de Google Play."
        )
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
    val speaker = remember(book.id) { NativeReaderSpeaker(context.applicationContext) }
    DisposableEffect(speaker) { onDispose { speaker.close() } }
    var playing by remember(book.id) { mutableStateOf(false) }
    var offset by remember(book.id) { mutableIntStateOf(book.offset) }
    var unitType by rememberSaveable(book.id) { mutableIntStateOf(1) }
    var showAudio by rememberSaveable(book.id) { mutableStateOf(false) }
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
            modifier = Modifier.semantics { heading() }
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
