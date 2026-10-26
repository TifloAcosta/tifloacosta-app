package com.tifloacosta.nativeprototype

import android.media.MediaPlayer
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
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
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
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlin.math.roundToInt

/** Simple foreground audio reader; MediaSession/background playback still pending. */
@Composable
fun NativeReaderAudioScreen(
    book: ReaderBook,
    store: NativeReaderStore,
    english: Boolean,
    startOnOpen: Boolean,
    onUpdate: (ReaderBook) -> Unit,
    onBack: () -> Unit
) {
    val tracks = remember(book.id) { store.audioFiles(book) }
    // SMIL may refer repeatedly to different clips of the SAME audio file.
    // A playlist item therefore means a DAISY segment, not a duplicated MP3.
    val playlist = remember(book.id) {
        val items = book.audioSegments.ifEmpty {
            tracks.indices.map { ReaderAudioSegment(it) }
        }
        items.filter { it.fileIndex in tracks.indices }
    }
    var player by remember(book.id) { mutableStateOf<MediaPlayer?>(null) }
    var track by remember(book.id) {
        mutableIntStateOf(book.trackIndex.coerceIn(0, (playlist.size - 1).coerceAtLeast(0)))
    }
    var position by remember(book.id) { mutableIntStateOf(book.audioPositionMs) }
    var duration by remember(book.id) { mutableIntStateOf(0) }
    var playing by remember(book.id) { mutableStateOf(false) }
    var actionsIndex by remember(book.id) { mutableIntStateOf(0) }
    var more by remember(book.id) { mutableStateOf(false) }
    var audioExpanded by remember(book.id) { mutableStateOf(false) }
    var sleepIndex by remember(book.id) { mutableIntStateOf(0) }
    val timerMinutes = listOf(0, 5, 10, 15, 30, 45, 60)
    val timerChoices = if (english)
        listOf("Off", "5 minutes", "10 minutes", "15 minutes",
            "30 minutes", "45 minutes", "60 minutes")
    else listOf("Desactivado", "5 minutos", "10 minutos", "15 minutos",
        "30 minutos", "45 minutos", "60 minutos")
    var speedIndex by remember(book.id) { mutableIntStateOf(2) }
    var message by remember(book.id) { mutableStateOf("") }
    val speeds = listOf(.75f, .9f, 1f, 1.25f, 1.5f)

    fun persist() {
        onUpdate(book.copy(trackIndex = track, audioPositionMs = position))
    }
    fun openTrack(target: Int, seekPosition: Int = 0) {
        val segment = playlist.getOrNull(target) ?: return
        try {
            player?.release()
            val media = MediaPlayer()
            media.setDataSource(tracks[segment.fileIndex].absolutePath)
            media.prepare()
            track = target
            duration = media.duration
            val clipStart = segment.startMs.coerceIn(0, duration.coerceAtLeast(0))
            val clipEnd = segment.endMs.takeIf { it > clipStart }
                ?.coerceAtMost(duration) ?: duration
            position = (if (seekPosition > 0) seekPosition else clipStart)
                .coerceIn(clipStart, clipEnd)
            media.seekTo(position)
            media.playbackParams = media.playbackParams.setSpeed(speeds[speedIndex])
            media.setOnCompletionListener {
                if (track < playlist.lastIndex) openTrack(track + 1, 0)
                else {
                    playing = false
                    position = 0
                    persist()
                }
            }
            player = media
            media.start()
            playing = true
            persist()
        } catch (e: Exception) {
            message = e.message ?: "No se pudo iniciar la pista de audio."
            playing = false
            player?.release()
            player = null
        }
    }
    fun toggle() {
        if (playing) {
            player?.pause()
            position = player?.currentPosition ?: position
            playing = false
            persist()
        } else if (player != null) {
            player?.start()
            playing = true
        } else openTrack(track, position)
    }
    fun stop() {
        playing = false
        player?.release()
        player = null
        position = 0
        persist()
    }
    fun skip(millis: Int) {
        val currentClip = playlist.getOrNull(track)
        val first = currentClip?.startMs?.toLong()?.coerceAtLeast(0) ?: 0L
        val last = currentClip?.endMs?.takeIf { it > first }
            ?.toLong()?.coerceAtMost(duration.toLong()) ?: duration.toLong()
        val next = (position.toLong() + millis).coerceIn(first, last).toInt()
        player?.seekTo(next)
        position = next
        persist()
    }
    fun bookmark() {
        val mark = ReaderAudioMark(track, position)
        if (mark !in book.audioMarks) {
            onUpdate(book.copy(audioMarks = book.audioMarks + mark,
                trackIndex = track, audioPositionMs = position))
            message = if (english) "Bookmark saved" else "Marca guardada"
        }
    }

    val actions = if (english)
        listOf("Play or pause", "Back 30 seconds", "Forward 30 seconds",
            "Previous track", "Next track", "Bookmark", "More actions")
    else listOf("Reproducir o pausar", "Retroceder 30 segundos", "Avanzar 30 segundos",
        "Pista anterior", "Pista siguiente", "Añadir marca", "Más acciones")
    fun runAction(idx: Int) {
        when (idx) {
            0 -> toggle()
            1 -> skip(-30000)
            2 -> skip(30000)
            3 -> if (track > 0) openTrack(track - 1)
            4 -> if (track < playlist.lastIndex) openTrack(track + 1)
            5 -> bookmark()
            6 -> more = !more
        }
    }

    LaunchedEffect(book.id) {
        if (startOnOpen) toggle()
    }
    LaunchedEffect(playing, sleepIndex) {
        if (playing && sleepIndex > 0) {
            delay(timerMinutes[sleepIndex] * 60_000L)
            if (playing) {
                try {
                    position = player?.currentPosition ?: position
                    player?.pause()
                } catch (_: Exception) { }
                playing = false
                persist()
            }
        }
    }
    DisposableEffect(book.id) {
        onDispose {
            val current = player
            if (current != null) {
                try {
                    onUpdate(book.copy(trackIndex = track, audioPositionMs = current.currentPosition))
                } catch (_: Exception) {}
            }
            current?.release()
        }
    }
    LaunchedEffect(player, playing, track) {
        var previousSave = 0
        while (isActive && playing) {
            delay(250)
            val observed = try { player?.currentPosition ?: 0 } catch (_: Exception) { 0 }
            position = observed
            // Honor clip-end from SMIL even if the physical MP3 file continues.
            val limit = playlist.getOrNull(track)?.endMs ?: -1
            if (limit > 0 && observed >= limit - 100) {
                if (track < playlist.lastIndex) openTrack(track + 1)
                else {
                    playing = false
                    player?.pause()
                    persist()
                }
                break
            }
            if (++previousSave >= 20) {
                persist()
                previousSave = 0
            }
        }
    }
    BackHandler { onBack() }
    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        TextButton(onClick = {
            player?.pause()
            persist()
            onBack()
        }) { Text(if (english) "Back to library" else "Volver a Mi biblioteca") }
        Text(book.title,
            style = MaterialTheme.typography.titleLarge,
            modifier = Modifier.fillMaxWidth().clickable { runAction(actionsIndex) }.semantics {
                heading()
                contentDescription = book.title
                stateDescription = actions[actionsIndex]
                progressBarRangeInfo = ProgressBarRangeInfo(
                    actionsIndex.toFloat(), 0f..actions.lastIndex.toFloat(), actions.size - 2
                )
                setProgress { value ->
                    actionsIndex = value.roundToInt().coerceIn(0, actions.lastIndex)
                    true
                }
                customActions = actions.mapIndexed { i, name ->
                    CustomAccessibilityAction(name) { runAction(i); true }
                }
            }
        )
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Button(onClick = { toggle() }) {
                Text(if (playing) (if (english) "Pause" else "Pausar")
                    else (if (english) "Play" else "Reproducir"))
            }
            TextButton(onClick = { stop() }) { Text(if (english) "Stop" else "Detener") }
        }
        Text((if (english) "Section " else "Sección ") + (track + 1) + " / " +
            playlist.size + ", " + (position / 1000) + " / " + (duration / 1000) + " s")
        playlist.getOrNull(track)?.label?.takeIf { it.isNotBlank() }?.let {
            Text(it)
        }
        Row {
            TextButton(onClick = { skip(-30000) }) {
                Text(if (english) "Back 30 s" else "Retroceder 30 s")
            }
            TextButton(onClick = { skip(30000) }) {
                Text(if (english) "Forward 30 s" else "Avanzar 30 s")
            }
        }
        TextButton(
            onClick = { audioExpanded = !audioExpanded },
            modifier = Modifier.semantics {
                stateDescription = if (audioExpanded) (if (english) "Expanded" else "Abierto")
                    else (if (english) "Collapsed" else "Cerrado")
            }
        ) { Text(if (english) "Audio" else "Audio") }
        if (audioExpanded) {
            ReaderAdjustableChoice(
                if (english) "Playback speed" else "Velocidad de reproducción",
                listOf("0,75", "0,9", "Normal", "1,25", "1,5"), speedIndex
            ) { idx ->
                speedIndex = idx
                try { player?.playbackParams = player!!.playbackParams.setSpeed(speeds[idx]) }
                catch (_: Exception) { }
            }
            ReaderAdjustableChoice(
                if (english) "Sleep timer" else "Apagado automático",
                timerChoices, sleepIndex
            ) { sleepIndex = it }
        }
        TextButton(
            onClick = { more = !more },
            modifier = Modifier.semantics {
                stateDescription = if (more) (if (english) "Expanded" else "Abierto")
                    else (if (english) "Collapsed" else "Cerrado")
            }
        ) { Text(if (english) "More actions" else "Más acciones") }
        if (more) {
            Row {
                TextButton(enabled = track > 0, onClick = { openTrack(track - 1) }) {
                    Text(if (english) "Previous section" else "Sección anterior")
                }
                TextButton(enabled = track < playlist.lastIndex, onClick = {
                    openTrack(track + 1)
                }) { Text(if (english) "Next section" else "Sección siguiente") }
            }
            if (playlist.size in 2..80) {
                ReaderAdjustableChoice(
                    if (english) "Section" else "Sección",
                    playlist.indices.map { (it + 1).toString() }, track
                ) { idx -> openTrack(idx) }
            }
            Button(onClick = { bookmark() }) {
                Text(if (english) "Save bookmark" else "Guardar marca")
            }
            book.audioMarks.forEachIndexed { i, mark ->
                TextButton(onClick = { openTrack(mark.segmentIndex, mark.positionMs) }) {
                    Text((if (english) "Bookmark " else "Marca ") + (i + 1) +
                        ", " + (if (english) "section " else "sección ") +
                        (mark.segmentIndex + 1))
                }
            }
        }
        if (message.isNotBlank()) Text(message)
    }
}
