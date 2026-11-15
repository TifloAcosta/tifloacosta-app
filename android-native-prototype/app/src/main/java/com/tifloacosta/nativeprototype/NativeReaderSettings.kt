package com.tifloacosta.nativeprototype

import android.content.Intent
import android.provider.Settings
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Slider
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.semantics.CustomAccessibilityAction
import androidx.compose.ui.semantics.customActions
import androidx.compose.ui.semantics.progressBarRangeInfo
import androidx.compose.ui.semantics.setProgress
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.onClick
import androidx.compose.ui.unit.dp
import kotlin.math.roundToInt

private val SPEEDS = listOf(.75f, .9f, 1f, 1.25f, 1.5f)

@Composable
fun ReaderAdjustableChoice(
    label: String,
    choices: List<String>,
    selected: Int,
    onSelected: (Int) -> Unit
) {
    ReaderCompactChoice(label, choices, selected, onSelected = onSelected)
}

/**
 * Single visual and TalkBack stop. Swipe up/down changes a discrete choice;
 * tapping cycles for users who do not use a screen reader. No popup or pair
 * of previous/next buttons is needed.
 */
@Composable
fun ReaderCompactChoice(
    label: String,
    choices: List<String>,
    selected: Int,
    english: Boolean = false,
    onSelected: (Int) -> Unit
) {
    val uiLanguage = LocalNativeUiLanguage.current
    if (choices.isEmpty()) return
    val index = selected.coerceIn(0, choices.lastIndex)
    TextButton(
        onClick = { onSelected(NativeReaderGestureSteps.wrapNext(index, choices.size)) },
        // Replace the button's merged text/click semantics with one clear
        // TalkBack stop: accessible name, current value and actions.
        modifier = Modifier.fillMaxWidth().clearAndSetSemantics {
            contentDescription = label
            stateDescription = choices[index]
            onClick(label = NativeReaderAccessibilityStrings.get(uiLanguage, "nextValue")) {
                onSelected(NativeReaderGestureSteps.wrapNext(index, choices.size))
                true
            }
            if (choices.size > 1) {
                customActions = listOf(
                    CustomAccessibilityAction(
                        NativeReaderAccessibilityStrings.get(uiLanguage, "previousOption")
                    ) {
                        onSelected((index - 1).coerceAtLeast(0))
                        true
                    },
                    CustomAccessibilityAction(
                        NativeReaderAccessibilityStrings.get(uiLanguage, "nextOption")
                    ) {
                        onSelected((index + 1).coerceAtMost(choices.lastIndex))
                        true
                    }
                )
            }
            if (choices.size > 1) {
                progressBarRangeInfo = ProgressBarRangeInfo(
                    index.toFloat(), 0f..choices.lastIndex.toFloat(),
                    (choices.size - 2).coerceAtLeast(0)
                )
                setProgress { requested ->
                    val next = requested.roundToInt().coerceIn(0, choices.lastIndex)
                    if (next != index) onSelected(next)
                    next != index
                }
            }
        }
    ) { Text("${label}: ${choices[index]}") }
}

/**
 * Reading position is intentionally stepped, not a percentage jump.
 * TalkBack often sends large setProgress increments for long documents:
 * each flick must move just one reading unit. Sighted users can tap to
 * move forward, and use the position slider in More actions for long jumps.
 */
@Composable
fun ReaderCompactPosition(
    label: String,
    current: Int,
    count: Int,
    english: Boolean = false,
    onSelected: (Int) -> Unit
) {
    val uiLanguage = LocalNativeUiLanguage.current
    val last = (count - 1).coerceAtLeast(0)
    val index = current.coerceIn(0, last)
    TextButton(
        enabled = count > 0,
        onClick = { if (index < last) onSelected(index + 1) },
        // One focusable reading-position control, never a separate
        // unlabeled progress bar plus repeated explanatory text.
        modifier = Modifier.fillMaxWidth().clearAndSetSemantics {
            contentDescription = label
            stateDescription = "${index + 1} ${NativeReaderAccessibilityStrings.get(uiLanguage, "of")} ${count.coerceAtLeast(1)}"
            onClick(label = NativeReaderAccessibilityStrings.get(uiLanguage, "nextUnit")) {
                if (index < last) onSelected(index + 1)
                true
            }
            if (count > 1) {
                customActions = listOf(
                    CustomAccessibilityAction(
                        NativeReaderAccessibilityStrings.get(uiLanguage, "previous")
                    ) {
                        if (index > 0) onSelected(index - 1)
                        true
                    },
                    CustomAccessibilityAction(
                        NativeReaderAccessibilityStrings.get(uiLanguage, "next")
                    ) {
                        if (index < last) onSelected(index + 1)
                        true
                    }
                )
            }
            if (count > 1) {
                progressBarRangeInfo = ProgressBarRangeInfo(
                    index.toFloat(), 0f..last.toFloat()
                )
                setProgress { requested ->
                    val next = NativeReaderGestureSteps.next(index, requested, last)
                    if (next != index) onSelected(next)
                    next != index
                }
            }
        }
    ) { Text("${label}: ${index + 1} / ${count.coerceAtLeast(1)}") }
}

/**
 * Single TalkBack stop for non-linear positions (word / percentage).
 * The requested absolute accessibility progress is interpreted as a direction:
 * each flick triggers exactly one user-defined navigation step.
 */
@Composable
fun ReaderCompactOffsetPosition(
    label: String,
    valueLabel: String,
    current: Int,
    maximum: Int,
    english: Boolean = false,
    onPrevious: () -> Unit,
    onNext: () -> Unit
) {
    val uiLanguage = LocalNativeUiLanguage.current
    TextButton(
        enabled = maximum > 0,
        onClick = onNext,
        modifier = Modifier.fillMaxWidth().clearAndSetSemantics {
            contentDescription = label
            stateDescription = valueLabel
            onClick(label = NativeReaderAccessibilityStrings.get(uiLanguage, "nextPosition")) {
                onNext()
                true
            }
            customActions = listOf(
                CustomAccessibilityAction(NativeReaderAccessibilityStrings.get(uiLanguage, "previousPosition")) {
                    onPrevious()
                    true
                },
                CustomAccessibilityAction(NativeReaderAccessibilityStrings.get(uiLanguage, "nextPosition")) {
                    onNext()
                    true
                }
            )
            progressBarRangeInfo = ProgressBarRangeInfo(
                current.coerceIn(0, maximum).toFloat(), 0f..maximum.coerceAtLeast(1).toFloat()
            )
            setProgress { requested ->
                when {
                    requested > current.toFloat() -> { onNext(); true }
                    requested < current.toFloat() -> { onPrevious(); true }
                    else -> false
                }
            }
        }
    ) { Text("$label: $valueLabel") }
}

/** Shared native defaults; book-specific overrides are edited inside each open book. */
@Composable
fun NativeReaderGeneralSettings(
    english: Boolean,
    onDataRestored: () -> Unit = {},
    onBack: () -> Unit
) {
    val context = LocalContext.current
    val uiLanguage = LocalNativeUiLanguage.current
    val prefs = remember {
        context.getSharedPreferences("native-reader-preferences", 0)
    }
    var nested by remember { mutableStateOf("") }
    var voiceRefresh by remember { mutableIntStateOf(0) }
    val speaker = remember(voiceRefresh) { NativeReaderSpeaker(context.applicationContext) }
    DisposableEffect(speaker) { onDispose { speaker.close() } }
    var selectedGroup by remember { mutableIntStateOf(-1) }
    var speed by remember { mutableIntStateOf(
        SPEEDS.indices.minByOrNull { kotlin.math.abs(SPEEDS[it] - prefs.getFloat("rate", 1f)) } ?: 2
    ) }
    val pitchValues = listOf(.7f, .85f, 1f, 1.15f, 1.3f)
    var pitchIndex by remember {
        mutableIntStateOf(pitchValues.indices.minByOrNull {
            kotlin.math.abs(pitchValues[it] - prefs.getFloat("pitch", 1f))
        } ?: 2)
    }
    val pauseCommaValues = listOf(0, 100, 200, 350, 500, 750)
    var commaIndex by remember {
        mutableIntStateOf(pauseCommaValues.indices.minByOrNull {
            kotlin.math.abs(pauseCommaValues[it] - prefs.getInt("pause.comma", 200))
        } ?: 2)
    }
    val pausePeriodValues = listOf(0, 200, 400, 600, 900, 1200)
    var periodIndex by remember {
        mutableIntStateOf(pausePeriodValues.indices.minByOrNull {
            kotlin.math.abs(pausePeriodValues[it] - prefs.getInt("pause.period", 400))
        } ?: 2)
    }
    var mode by remember { mutableIntStateOf(prefs.getInt("mode", 0).coerceIn(0, 1)) }
    var unit by remember { mutableIntStateOf(prefs.getInt("unit", 1).coerceIn(0, 2)) }
    var font by remember { mutableIntStateOf(prefs.getInt("font", 3).coerceIn(0, 13)) }
    var spacing by remember { mutableIntStateOf(prefs.getInt("spacing", 0).coerceIn(0, 2)) }
    var bold by remember { mutableIntStateOf(prefs.getInt("bold", 0).coerceIn(0, 1)) }
    var voice by remember { mutableStateOf(prefs.getString("voice", "").orEmpty()) }
    var voiceFilter by remember { mutableIntStateOf(0) }
    val groups = NativeReaderSettingsStrings.options(uiLanguage, "groups")

    if (nested == "backup") {
        NativeReaderBackupScreen(english, onRestored = onDataRestored,
            onBack = { nested = "" })
        return
    }
    if (nested == "external") {
        NativeExternalVoiceProvidersScreen(english, onBack = { nested = "" })
        return
    }
    if (nested == "keys") {
        NativeReaderExternalVoiceKeysScreen(english, onBack = { nested = "" })
        return
    }
    if (nested == "pronunciation") {
        NativePronunciationSettings(english, onBack = { nested = "" })
        return
    }
    if (nested == "licenses") {
        val notices = remember {
            runCatching {
                context.assets.open("THIRD_PARTY_NOTICES.txt").bufferedReader().use { it.readText() }
            }.getOrDefault("Avisos de licencias: https://github.com/TifloAcosta/tifloacosta-app")
        }
        Column(
            modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            TextButton(onClick = { nested = "" }) {
                Text(NativeReaderSettingsStrings.get(uiLanguage, "backSettings"))
            }
            Text(NativeReaderSettingsStrings.get(uiLanguage, "licenses"),
                style = MaterialTheme.typography.headlineSmall)
            Text(notices)
        }
        return
    }

    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        TextButton(onClick = { if (selectedGroup >= 0) selectedGroup = -1 else onBack() }) {
            Text(NativeReaderSettingsStrings.get(uiLanguage,
                if (selectedGroup >= 0) "backSettings" else "backReader"))
        }
        Text(if (selectedGroup >= 0) groups[selectedGroup]
            else NativeReaderSettingsStrings.get(uiLanguage, "title"),
            style = MaterialTheme.typography.headlineSmall)
        if (selectedGroup < 0) {
        TextButton(
            onClick = { nested = "licenses" },
            modifier = Modifier.fillMaxWidth()
        ) { Text(NativeReaderSettingsStrings.get(uiLanguage, "licenses")) }
        groups.forEachIndexed { i, title ->
            TextButton(
                modifier = Modifier.fillMaxWidth(),
                onClick = { selectedGroup = i }
            ) { Text(title) }
        }
        } else {
            when (selectedGroup) {
                0 -> {
                    ReaderAdjustableChoice(
                        NativeReaderSettingsStrings.get(uiLanguage, "speechSpeed"),
                        listOf("0,75", "0,9", "Normal", "1,25", "1,5"), speed
                    ) {
                        speed = it
                        prefs.edit().putFloat("rate", SPEEDS[it]).apply()
                    }
                    ReaderAdjustableChoice(
                        NativeReaderSettingsStrings.get(uiLanguage, "systemPitch"),
                        listOf("0,7", "0,85", "Normal", "1,15", "1,3"),
                        pitchIndex
                    ) {
                        pitchIndex = it
                        prefs.edit().putFloat("pitch", pitchValues[it]).apply()
                    }
                    ReaderAdjustableChoice(
                        NativeReaderSettingsStrings.get(uiLanguage, "pauseComma"),
                        pauseCommaValues.map { it.toString() + " ms" }, commaIndex
                    ) {
                        commaIndex = it
                        prefs.edit().putInt("pause.comma", pauseCommaValues[it]).apply()
                    }
                    ReaderAdjustableChoice(
                        NativeReaderSettingsStrings.get(uiLanguage, "pausePeriod"),
                        pausePeriodValues.map { it.toString() + " ms" }, periodIndex
                    ) {
                        periodIndex = it
                        prefs.edit().putInt("pause.period", pausePeriodValues[it]).apply()
                    }
                    Text(NativeReaderSettingsStrings.get(uiLanguage, "pauseHelp"))
                    ReaderAdjustableChoice(
                        NativeReaderSettingsStrings.get(uiLanguage, "voices"),
                        NativeReaderSettingsStrings.options(uiLanguage, "voiceFilters"), voiceFilter
                    ) { voiceFilter = it }
                    NativeReaderVoicePicker(
                        english = english,
                        speaker = speaker,
                        selectedVoice = voice,
                        speed = SPEEDS[speed],
                        filter = voiceFilter,
                        onVoiceSelected = { chosen ->
                            voice = chosen
                            prefs.edit().putString("voice", chosen).apply()
                        }
                    )
                    Button(onClick = { nested = "keys" }) {
                        Text(NativeReaderSettingsStrings.get(uiLanguage, "externalEngines"))
                    }
                    Button(onClick = { nested = "external" }) {
                        Text(NativeReaderSettingsStrings.get(uiLanguage, "otherVoices"))
                    }
                    Button(onClick = { nested = "pronunciation" }) {
                        Text(NativeReaderSettingsStrings.get(uiLanguage, "pronunciation"))
                    }
                    Button(onClick = { voiceRefresh++ }) {
                        Text(NativeReaderSettingsStrings.get(uiLanguage, "refreshVoices"))
                    }
                    Button(onClick = {
                        val intent = Intent("com.android.settings.TTS_SETTINGS")
                        if (intent.resolveActivity(context.packageManager) != null) {
                            context.startActivity(intent)
                        } else context.startActivity(Intent(Settings.ACTION_SETTINGS))
                    }) { Text(NativeReaderSettingsStrings.get(uiLanguage, "androidVoices")) }
                }
                1 -> Text(NativeReaderSettingsStrings.get(uiLanguage, "readingHelp"))
                2 -> {
                    ReaderAdjustableChoice(NativeReaderSettingsStrings.get(uiLanguage, "textSize"),
                        (14..40 step 2).map { "$it" }, font
                    ) { font = it; prefs.edit().putInt("font", it).apply() }
                    ReaderAdjustableChoice(NativeReaderSettingsStrings.get(uiLanguage, "spacing"),
                        NativeReaderSettingsStrings.options(uiLanguage, "spacingOptions"), spacing
                    ) { spacing = it; prefs.edit().putInt("spacing", it).apply() }
                    ReaderAdjustableChoice(NativeReaderSettingsStrings.get(uiLanguage, "bold"),
                        NativeReaderSettingsStrings.options(uiLanguage, "onOff"), bold
                    ) { bold = it; prefs.edit().putInt("bold", it).apply() }
                }
                3 -> ReaderAdjustableChoice(
                    NativeReaderSettingsStrings.get(uiLanguage, "movement"),
                    NativeReaderSettingsStrings.options(uiLanguage, "navigationOptions"), unit
                ) { unit = it; prefs.edit().putInt("unit", it).apply() }
                4 -> Text(NativeReaderSettingsStrings.get(uiLanguage, "formats"))
                5 -> {
                    Button(onClick = { nested = "backup" },
                        modifier = Modifier.fillMaxWidth()) {
                        Text(NativeReaderSettingsStrings.get(uiLanguage, "backupOpen"))
                    }
                }
            }
        }
    }
}
