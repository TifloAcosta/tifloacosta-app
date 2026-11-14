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
    onDeleteRequest: () -> Unit,
    onBack: () -> Unit
) {
    val context = LocalContext.current
    val uiLanguage = LocalNativeUiLanguage.current
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
    var navigationMode by remember(book.id) { mutableIntStateOf(0) }
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
    fun seekAudio(segment: Int, milliseconds: Int) {
        if (active) {
            if (segment != current) command(NativeReaderPlaybackService.ACTION_SEGMENT, segment)
            command(NativeReaderPlaybackService.ACTION_SEEK, milliseconds)
        } else {
            onUpdate(book.copy(trackIndex = segment, audioPositionMs = milliseconds))
        }
    }
    fun navigate(forward: Boolean) {
        if (navigationMode == 0) {
            val here = current to position
            val ordered = marks.distinct().sortedWith(
                compareBy<ReaderAudioMark> { it.segmentIndex }.thenBy { it.positionMs })
            val target = if (forward) ordered.firstOrNull {
                it.segmentIndex > here.first ||
                    (it.segmentIndex == here.first && it.positionMs > here.second)
            } else ordered.lastOrNull {
                it.segmentIndex < here.first ||
                    (it.segmentIndex == here.first && it.positionMs < here.second)
            }
            if (target != null) seekAudio(target.segmentIndex, target.positionMs)
        } else {
            // Seek by an exact minute on the current audio timeline.
            val proposed = (position.toLong() + if (forward) 60_000L else -60_000L)
                .coerceIn(0, Int.MAX_VALUE.toLong()).toInt()
            seekAudio(current, proposed)
        }
    }
    fun previous() {
        if (!active) start()
        else command(NativeReaderPlaybackService.ACTION_PREVIOUS)
    }
    fun next() {
        if (!active) start()
        else command(NativeReaderPlaybackService.ACTION_NEXT)
    }
    val actions = NativeReaderAudioStrings.actions(uiLanguage)
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
    // Never auto-start a DAISY/MP3 simply by opening its document.
    LaunchedEffect(book.id, startOnOpen) {
        if (startOnOpen && !reading) start()
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
        if (!expandedMore) {
        TextButton(onClick = onBack) {
            Text(NativeReaderAudioStrings.get(uiLanguage, "back"))
        }
        TextButton(onClick = onDeleteRequest) {
            Text(NativeReaderAudioStrings.get(uiLanguage, "delete"))
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
                Text(NativeReaderAudioStrings.get(uiLanguage, if (reading) "pause" else "play"))
            }
            TextButton(onClick = { if (active) command(NativeReaderPlaybackService.ACTION_STOP) }) {
                Text(NativeReaderAudioStrings.get(uiLanguage, "stop"))
            }
        }
        Text(NativeReaderAudioStrings.get(uiLanguage, "section") + " " +
            (current + 1) + " / " + segments.size +
            ", " + (position / 1000) + " / " + (duration / 1000) + " s")
        TextButton(onClick = { showTools = true },
            modifier = Modifier.fillMaxWidth()) {
            Text(NativeReaderAudioStrings.get(uiLanguage, "details"))
        }
        if (book.format == "daisy" || book.daisyNavigation.isNotEmpty()) {
            TextButton(onClick = { showDaisyNavigation = true },
                modifier = Modifier.fillMaxWidth()) {
                Text(NativeReaderAudioStrings.get(uiLanguage, "daisyNavigation"))
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
                Text(NativeReaderAudioStrings.get(uiLanguage, "returnPosition"))
            }
        }
        if (active && state.synchronizedText.isNotBlank()) {
            Text(NativeReaderAudioStrings.get(uiLanguage, "synchronized"),
                style = MaterialTheme.typography.titleMedium,
                modifier = Modifier.semantics { heading() })
            Text(state.synchronizedText)
        }
        ReaderCompactChoice(
            NativeReaderAudioStrings.get(uiLanguage, "navigationMode"),
            listOf(NativeReaderAudioStrings.get(uiLanguage, "marks"),
                NativeReaderAudioStrings.get(uiLanguage, "minute")),
            navigationMode, english
        ) { navigationMode = it }
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Button(onClick = { navigate(false) }) {
                Text(NativeReaderAudioStrings.get(uiLanguage, "previous"))
            }
            Button(onClick = { navigate(true) }) {
                Text(NativeReaderAudioStrings.get(uiLanguage, "next"))
            }
        }
        // One adjustable control for each direction-based navigation action.
        // Flick up/down for an exact +30/-30-second jump, not a percentage seek.
        if (active && duration > 0) {
            ReaderCompactPosition(
                label = NativeReaderAudioStrings.get(uiLanguage, "skip30"),
                current = (position / 1000).coerceAtLeast(0),
                count = (duration / 1000) + 1,
                english = english
            ) { requestedSecond ->
                val delta = if (requestedSecond > position / 1000) 30000 else -30000
                command(NativeReaderPlaybackService.ACTION_SEEK, position + delta)
            }
        }
        ReaderCompactPosition(
            label = NativeReaderAudioStrings.get(uiLanguage, "section"),
            current = current,
            count = segments.size,
            english = english
        ) { chosen ->
            if (active) command(NativeReaderPlaybackService.ACTION_SEGMENT, chosen)
            else NativeReaderPlaybackService.start(context, book.id,
                audio = true, speedPercent = speeds[speedIndex],
                sleepMinutes = sleepTimes[sleepIndex], segmentIndex = chosen)
        }
        ReaderCompactChoice(
            NativeReaderAudioStrings.get(uiLanguage, "speed"),
            listOf("0,75", "0,9", "Normal", "1,25", "1,5"),
            speedIndex, english
        ) { chosen ->
            speedIndex = chosen
            prefs.edit().putInt("audio.speed." + book.id, chosen).apply()
            if (active) command(NativeReaderPlaybackService.ACTION_SPEED, speeds[chosen])
        }
        ReaderCompactChoice(
            NativeReaderAudioStrings.get(uiLanguage, "sleep"),
            NativeReaderPlaybackStrings.sleepChoices(uiLanguage),
            sleepIndex, english
        ) { chosen ->
            sleepIndex = chosen
            if (active) command(NativeReaderPlaybackService.ACTION_SLEEP, sleepTimes[chosen])
        }
        TextButton(onClick = { expandedMore = true }) {
            Text(NativeReaderAudioStrings.get(uiLanguage, "more"))
        }
        }
        if (expandedMore) {
            TextButton(onClick = { expandedMore = false }) {
                Text(NativeReaderAudioStrings.get(uiLanguage, "back"))
            }
            Text(NativeReaderAudioStrings.get(uiLanguage, "more"),
                style = MaterialTheme.typography.titleMedium,
                modifier = Modifier.semantics { heading() })
            Button(onClick = { bookmark() }, enabled = active) {
                Text(NativeReaderAudioStrings.get(uiLanguage, "saveMark"))
            }
            marks.forEachIndexed { index, mark ->
                TextButton(onClick = {
                    // The service can jump to a target section and exact saved clip offset.
                    if (active) {
                        command(NativeReaderPlaybackService.ACTION_SEGMENT, mark.segmentIndex)
                        command(NativeReaderPlaybackService.ACTION_SEEK, mark.positionMs)
                    }
                }) {
                    Text(NativeReaderAudioStrings.get(uiLanguage, "mark") + " " + (index + 1) +
                        ", " + NativeReaderAudioStrings.get(uiLanguage, "section") + " " + (mark.segmentIndex + 1))
                }
            }
        }
        if (active && state.error.isNotBlank()) Text(state.error)
        if (reading) Text(NativeReaderAudioStrings.get(uiLanguage, "lockScreen"))
    }
}
