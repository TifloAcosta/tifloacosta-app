package com.tifloacosta.nativeprototype

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.clickable
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
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.CustomAccessibilityAction
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.customActions
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.progressBarRangeInfo
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.setProgress
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.unit.dp
import kotlin.math.roundToInt

/** Playback belongs to a foreground service: leaving this screen does not stop audio. */
@Composable
fun NativeReaderAudioScreen(
    book: ReaderBook,
    store: NativeReaderStore,
    english: Boolean,
    startOnOpen: Boolean,
    onUpdate: (ReaderBook) -> Unit,
    onBack: () -> Unit
) {
    val context = LocalContext.current
    val state by NativeReaderPlaybackService.snapshot.collectAsState()
    val active = state.bookId == book.id && state.kind == "audio"
    val reading = active && state.playing
    val segments = remember(book.id) {
        book.audioSegments.ifEmpty { store.audioFiles(book).indices.map { ReaderAudioSegment(it) } }
    }
    val current = if (active) state.segment else book.trackIndex
    val position = if (active) state.positionMs else book.audioPositionMs
    val duration = if (active) state.durationMs else 0
    var selectedAction by remember(book.id) { mutableIntStateOf(0) }
    var expandedMore by remember(book.id) { mutableStateOf(false) }
    var showDaisyNavigation by remember(book.id) { mutableStateOf(false) }
    var showTools by remember(book.id) { mutableStateOf(false) }
    var beforeDaisyJump by remember(book.id) { mutableStateOf<Pair<Int, Int>?>(null) }
    var sleepIndex by remember(book.id) { mutableIntStateOf(0) }
    val prefs = remember { context.getSharedPreferences("native-reader-preferences", 0) }
    var speedIndex by remember(book.id) {
        mutableIntStateOf(prefs.getInt("audio.speed." + book.id, 2).coerceIn(0, 4))
    }
    val speeds = listOf(75, 90, 100, 125, 150)
    val sleepTimes = listOf(0, 5, 10, 15, 30, 45, 60)
    val marks = if (active) state.audioMarks
    else book.audioMarks.ifEmpty {
        book.marks.map { ReaderAudioMark(book.trackIndex, it) }
    }

    fun command(action: String, value: Int = 0) {
        NativeReaderPlaybackService.send(context, action, book.id, value)
    }
    fun start() {
        NativeReaderPlaybackService.start(context, book.id, audio = true,
            speedPercent = speeds[speedIndex], sleepMinutes = sleepTimes[sleepIndex])
    }
    fun toggle() {
        if (reading) command(NativeReaderPlaybackService.ACTION_PAUSE)
        else if (active) command(NativeReaderPlaybackService.ACTION_PLAY)
        else start()
    }
    fun bookmark() { if (active) command(NativeReaderPlaybackService.ACTION_BOOKMARK) }
    fun previous() {
        if (!active) start()
        else command(NativeReaderPlaybackService.ACTION_PREVIOUS)
    }
    fun next() {
        if (!active) start()
        else command(NativeReaderPlaybackService.ACTION_NEXT)
    }
    val actions = if (english)
        listOf("Play or pause", "Back 30 seconds", "Forward 30 seconds",
            "Previous section", "Next section", "Bookmark", "More actions")
    else listOf("Reproducir o pausar", "Retroceder 30 segundos", "Avanzar 30 segundos",
        "Sección anterior", "Sección siguiente", "Añadir marca", "Más acciones")
    fun perform(index: Int) {
        when (index) {
            0 -> toggle()
            1 -> command(NativeReaderPlaybackService.ACTION_SKIP_BACK)
            2 -> command(NativeReaderPlaybackService.ACTION_SKIP_FORWARD)
            3 -> previous()
            4 -> next()
            5 -> bookmark()
            6 -> expandedMore = !expandedMore
        }
    }
    LaunchedEffect(book.id) {
        val perBook = prefs.getInt("autoplay." + book.id, -1)
        val automatically = when (perBook) {
            1 -> true
            0 -> false
            else -> prefs.getInt("mode", 0) == 1
        }
        if ((startOnOpen || automatically) && !reading) start()
    }
    if (showTools) {
        NativeReaderDocumentActions(book, english,
            fragment = if (active) state.synchronizedText else "",
            onBack = { showTools = false })
        return
    }
    if (showDaisyNavigation) {
        NativeDaisyNavigationScreen(book, english, current,
            onGo = { segment ->
                beforeDaisyJump = current to position
                if (active) command(NativeReaderPlaybackService.ACTION_SEGMENT, segment)
                else NativeReaderPlaybackService.start(context, book.id,
                    audio = true, speedPercent = speeds[speedIndex],
                    sleepMinutes = sleepTimes[sleepIndex], segmentIndex = segment)
                showDaisyNavigation = false
            },
            onBack = { showDaisyNavigation = false })
        return
    }
    BackHandler { onBack() }

    Column(modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)) {
        TextButton(onClick = onBack) {
            Text(if (english) "Back to My library" else "Volver a Mi biblioteca")
        }
        Text(book.title, style = MaterialTheme.typography.titleLarge,
            modifier = Modifier.fillMaxWidth().clickable { perform(selectedAction) }.semantics {
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
                    CustomAccessibilityAction(label) { perform(i); true }
                }
            })
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Button(onClick = { toggle() }) {
                Text(if (reading) (if (english) "Pause" else "Pausar")
                    else (if (english) "Play" else "Reproducir"))
            }
            TextButton(onClick = { if (active) command(NativeReaderPlaybackService.ACTION_STOP) }) {
                Text(if (english) "Stop" else "Detener")
            }
        }
        Text((if (english) "Section " else "Sección ") +
            (current + 1) + " / " + segments.size +
            ", " + (position / 1000) + " / " + (duration / 1000) + " s")
        TextButton(onClick = { showTools = true },
            modifier = Modifier.fillMaxWidth()) {
            Text(if (english) "Book details and tools" else "Detalles y herramientas")
        }
        if (book.format == "daisy" || book.daisyNavigation.isNotEmpty()) {
            TextButton(onClick = { showDaisyNavigation = true },
                modifier = Modifier.fillMaxWidth()) {
                Text(if (english) "DAISY navigation" else "Navegación DAISY")
            }
        }
        beforeDaisyJump?.let { origin ->
            TextButton(onClick = {
                if (active) {
                    command(NativeReaderPlaybackService.ACTION_SEGMENT, origin.first)
                    command(NativeReaderPlaybackService.ACTION_SEEK, origin.second)
                } else {
                    NativeReaderPlaybackService.start(context, book.id, audio = true,
                        speedPercent = speeds[speedIndex],
                        sleepMinutes = sleepTimes[sleepIndex],
                        segmentIndex = origin.first, positionMs = origin.second)
                }
                beforeDaisyJump = null
            }) {
                Text(if (english) "Return to position before navigation"
                    else "Volver a la posición anterior al salto")
            }
        }
        if (active && state.synchronizedText.isNotBlank()) {
            Text(if (english) "Synchronized text" else "Texto sincronizado",
                style = MaterialTheme.typography.titleMedium,
                modifier = Modifier.semantics { heading() })
            Text(state.synchronizedText)
        }
        // One adjustable control for each direction-based navigation action.
        // Flick up/down for an exact +30/-30-second jump, not a percentage seek.
        if (active && duration > 0) {
            ReaderCompactPosition(
                label = if (english) "Skip 30 seconds" else "Saltar 30 segundos",
                current = (position / 1000).coerceAtLeast(0),
                count = (duration / 1000) + 1
            ) { requestedSecond ->
                val delta = if (requestedSecond > position / 1000) 30000 else -30000
                command(NativeReaderPlaybackService.ACTION_SEEK, position + delta)
            }
        }
        ReaderCompactPosition(
            label = if (english) "Section" else "Sección",
            current = current,
            count = segments.size
        ) { chosen ->
            if (active) command(NativeReaderPlaybackService.ACTION_SEGMENT, chosen)
            else NativeReaderPlaybackService.start(context, book.id,
                audio = true, speedPercent = speeds[speedIndex],
                sleepMinutes = sleepTimes[sleepIndex], segmentIndex = chosen)
        }
        ReaderCompactChoice(
            if (english) "Playback speed" else "Velocidad de reproducción",
            listOf("0,75", "0,9", "Normal", "1,25", "1,5"),
            speedIndex
        ) { chosen ->
            speedIndex = chosen
            prefs.edit().putInt("audio.speed." + book.id, chosen).apply()
            if (active) command(NativeReaderPlaybackService.ACTION_SPEED, speeds[chosen])
        }
        ReaderCompactChoice(
            if (english) "Sleep timer" else "Apagado automático",
            if (english) listOf("Off", "5 minutes", "10 minutes", "15 minutes",
                "30 minutes", "45 minutes", "60 minutes")
            else listOf("Desactivado", "5 minutos", "10 minutos", "15 minutos",
                "30 minutos", "45 minutos", "60 minutos"),
            sleepIndex
        ) { chosen ->
            sleepIndex = chosen
            if (active) command(NativeReaderPlaybackService.ACTION_SLEEP, sleepTimes[chosen])
        }
        TextButton(onClick = { expandedMore = !expandedMore },
            modifier = Modifier.semantics {
                stateDescription = if (expandedMore) "Abierto" else "Cerrado"
            }) { Text(if (english) "More actions" else "Más acciones") }
        if (expandedMore) {
            Button(onClick = { bookmark() }, enabled = active) {
                Text(if (english) "Save bookmark" else "Guardar marca")
            }
            marks.forEachIndexed { index, mark ->
                TextButton(onClick = {
                    // The service can jump to a target section and exact saved clip offset.
                    if (active) {
                        command(NativeReaderPlaybackService.ACTION_SEGMENT, mark.segmentIndex)
                        command(NativeReaderPlaybackService.ACTION_SEEK, mark.positionMs)
                    }
                }) {
                    Text((if (english) "Bookmark " else "Marca ") + (index + 1) +
                        ", " + (if (english) "section " else "sección ") + (mark.segmentIndex + 1))
                }
            }
        }
        if (active && state.error.isNotBlank()) Text(state.error)
        if (reading) Text(if (english)
            "Playback continues when the screen is locked."
            else "La reproducción continúa al bloquear la pantalla.")
    }
}
