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
    if (choices.isEmpty()) return
    val index = selected.coerceIn(0, choices.lastIndex)
    // The adjustable control itself must announce its purpose AND selected value.
    // A separate visible-only label forces an unnecessary extra TalkBack stop.
    if (choices.size > 1) {
        Slider(
            value = index.toFloat(),
            onValueChange = { onSelected(it.roundToInt().coerceIn(0, choices.lastIndex)) },
            valueRange = 0f..choices.lastIndex.toFloat(),
            steps = (choices.size - 2).coerceAtLeast(0),
            modifier = Modifier.fillMaxWidth().semantics {
                contentDescription = label + ": " + choices[index]
                stateDescription = choices[index]
            }
        )
    } else {
        Text(label + ": " + choices[index])
    }
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
    if (choices.isEmpty()) return
    val index = selected.coerceIn(0, choices.lastIndex)
    TextButton(
        onClick = { onSelected(NativeReaderGestureSteps.wrapNext(index, choices.size)) },
        // Replace the button's merged text/click semantics with one clear
        // TalkBack stop: accessible name, current value and actions.
        modifier = Modifier.fillMaxWidth().clearAndSetSemantics {
            contentDescription = label
            stateDescription = choices[index]
            onClick(label = if (english) "Choose next value" else "Elegir el siguiente valor") {
                onSelected(NativeReaderGestureSteps.wrapNext(index, choices.size))
                true
            }
            if (choices.size > 1) {
                customActions = listOf(
                    CustomAccessibilityAction(
                        if (english) "Previous option" else "Opción anterior"
                    ) {
                        onSelected((index - 1).coerceAtLeast(0))
                        true
                    },
                    CustomAccessibilityAction(
                        if (english) "Next option" else "Opción siguiente"
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
    val last = (count - 1).coerceAtLeast(0)
    val index = current.coerceIn(0, last)
    TextButton(
        enabled = count > 0,
        onClick = { if (index < last) onSelected(index + 1) },
        // One focusable reading-position control, never a separate
        // unlabeled progress bar plus repeated explanatory text.
        modifier = Modifier.fillMaxWidth().clearAndSetSemantics {
            contentDescription = label
            stateDescription = "${index + 1} ${if (english) "of" else "de"} ${count.coerceAtLeast(1)}"
            onClick(label = if (english) "Next reading unit" else "Siguiente unidad de lectura") {
                if (index < last) onSelected(index + 1)
                true
            }
            if (count > 1) {
                customActions = listOf(
                    CustomAccessibilityAction(
                        if (english) "Previous" else "Anterior"
                    ) {
                        if (index > 0) onSelected(index - 1)
                        true
                    },
                    CustomAccessibilityAction(
                        if (english) "Next" else "Siguiente"
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
    TextButton(
        enabled = maximum > 0,
        onClick = onNext,
        modifier = Modifier.fillMaxWidth().clearAndSetSemantics {
            contentDescription = label
            stateDescription = valueLabel
            onClick(label = if (english) "Next position" else "Posición siguiente") {
                onNext()
                true
            }
            customActions = listOf(
                CustomAccessibilityAction(if (english) "Previous position" else "Posición anterior") {
                    onPrevious()
                    true
                },
                CustomAccessibilityAction(if (english) "Next position" else "Posición siguiente") {
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
    val prefs = remember {
        context.getSharedPreferences("native-reader-preferences", 0)
    }
    var nested by remember { mutableStateOf("") }
    var voiceRefresh by remember { mutableIntStateOf(0) }
    val speaker = remember(voiceRefresh) { NativeReaderSpeaker(context.applicationContext) }
    DisposableEffect(speaker) { onDispose { speaker.close() } }
    var expanded by remember { mutableIntStateOf(-1) }
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
    val groups = if (english)
        listOf("Audio and voices", "Reading mode", "Visual presentation",
            "Navigation and steps", "Supported formats", "Backup and restore")
    else listOf("Audio y voces", "Modo de lectura", "Presentación visual",
        "Navegación y avances", "Formatos compatibles", "Copias de seguridad")

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

    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        TextButton(onClick = onBack) { Text(if (english) "Back to reader" else "Volver a TifloLector") }
        Text(if (english) "TifloLector settings" else "Ajustes de TifloLector",
            style = MaterialTheme.typography.headlineSmall)
        groups.forEachIndexed { i, title ->
            TextButton(
                modifier = Modifier.fillMaxWidth().semantics {
                    stateDescription = if (expanded == i) (if (english) "Expanded" else "Abierto")
                    else (if (english) "Collapsed" else "Cerrado")
                },
                onClick = { expanded = if (expanded == i) -1 else i }
            ) { Text(title) }
            if (expanded == i) when (i) {
                0 -> {
                    ReaderAdjustableChoice(
                        if (english) "Speech speed" else "Velocidad de voz",
                        listOf("0,75", "0,9", "Normal", "1,25", "1,5"), speed
                    ) {
                        speed = it
                        prefs.edit().putFloat("rate", SPEEDS[it]).apply()
                    }
                    ReaderAdjustableChoice(
                        if (english) "System TTS pitch" else "Tono de la voz del sistema",
                        listOf("0,7", "0,85", "Normal", "1,15", "1,3"),
                        pitchIndex
                    ) {
                        pitchIndex = it
                        prefs.edit().putFloat("pitch", pitchValues[it]).apply()
                    }
                    ReaderAdjustableChoice(
                        if (english) "Pause after commas and semicolons" else "Pausa tras comas y punto y coma",
                        pauseCommaValues.map { it.toString() + " ms" }, commaIndex
                    ) {
                        commaIndex = it
                        prefs.edit().putInt("pause.comma", pauseCommaValues[it]).apply()
                    }
                    ReaderAdjustableChoice(
                        if (english) "Pause at sentence endings" else "Pausa al final de frase",
                        pausePeriodValues.map { it.toString() + " ms" }, periodIndex
                    ) {
                        periodIndex = it
                        prefs.edit().putInt("pause.period", pausePeriodValues[it]).apply()
                    }
                    Text(if (english)
                        "Pitch and punctuation pauses apply to the Android system speech engine. External engines manage their own prosody."
                        else "El tono y las pausas por puntuación se aplican a la voz del sistema Android. Los motores externos controlan su propia prosodia.")
                    ReaderAdjustableChoice(
                        if (english) "Show voices" else "Mostrar voces",
                        if (english) listOf("All", "Spanish", "English")
                        else listOf("Todas", "Español", "Inglés"), voiceFilter
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
                        Text(if (english) "External engines" else "Motores externos")
                    }
                    Button(onClick = { nested = "external" }) {
                        Text(if (english) "Find voices from other providers"
                            else "Buscar voces de otros proveedores")
                    }
                    Button(onClick = { nested = "pronunciation" }) {
                        Text(if (english) "Pronunciation dictionary"
                            else "Diccionario de pronunciación")
                    }
                    Button(onClick = { voiceRefresh++ }) {
                        Text(if (english) "Refresh installed voices"
                            else "Actualizar voces instaladas")
                    }
                    Button(onClick = {
                        val intent = Intent("com.android.settings.TTS_SETTINGS")
                        if (intent.resolveActivity(context.packageManager) != null) {
                            context.startActivity(intent)
                        } else context.startActivity(Intent(Settings.ACTION_SETTINGS))
                    }) { Text(if (english) "Find more voices in Android" else "Buscar más voces en Android") }
                }
                1 -> Text(if (english)
                    "Reading starts only when you press Play. Opening a book never starts speech."
                    else "La lectura comienza cuando pulsas Reproducir. Abrir un libro no activa la voz.")
                2 -> {
                    ReaderAdjustableChoice(if (english) "Text size" else "Tamaño de letra",
                        (14..40 step 2).map { "$it" }, font
                    ) { font = it; prefs.edit().putInt("font", it).apply() }
                    ReaderAdjustableChoice(if (english) "Line spacing" else "Interlineado",
                        if (english) listOf("Normal", "Comfortable", "Wide")
                        else listOf("Normal", "Cómodo", "Amplio"), spacing
                    ) { spacing = it; prefs.edit().putInt("spacing", it).apply() }
                    ReaderAdjustableChoice(if (english) "Bold text" else "Texto reforzado",
                        if (english) listOf("Off", "On") else listOf("No", "Sí"), bold
                    ) { bold = it; prefs.edit().putInt("bold", it).apply() }
                }
                3 -> ReaderAdjustableChoice(
                    if (english) "Movement unit" else "Unidad de avance",
                    if (english) listOf("Block", "Paragraph", "Sentence")
                    else listOf("Bloque", "Párrafo", "Frase"), unit
                ) { unit = it; prefs.edit().putInt("unit", it).apply() }
                4 -> {
                    Text(
                        if (english) "Reader formats: TXT, Markdown, HTML, XHTML, RTF, PDF with offline Latin OCR, " +
                            "JPEG, PNG, WebP, BMP, HEIC, EPUB, DOCX, PPTX, PPSX, XLSX, ODT, ODS, ODP, " +
                            "legacy DOC, PPT, PPS and XLS (text extraction), FB2, unencrypted " +
                            "PalmDOC/MOBI/PRC/PDB and compatible AZW/AZW3 files, ZIP, RAR and 7Z including DAISY, " +
                            "and MP3, M4A, M4B, AAC, WAV, OGG, FLAC, OPUS where supported by Android. " +
                            "DRM, Kindle HUFF/CDIC compression, some KF8 layouts and unsupported encoding " +
                            "remain unavailable. Office images still require separate OCR."
                        else "Formatos del lector: TXT, Markdown, HTML, XHTML, RTF, PDF con OCR latino local, " +
                            "JPEG, PNG, WebP, BMP, HEIC, EPUB, DOCX, PPTX, PPSX, XLSX, ODT, ODS, ODP, " +
                            "DOC, PPT, PPS y XLS antiguos (extracción de texto), FB2, PalmDOC/MOBI/PRC/PDB " +
                            "sin cifrar y algunos AZW/AZW3 compatibles, ZIP, RAR y 7Z incluidos DAISY, " +
                            "y MP3, M4A, M4B, AAC, WAV, OGG, FLAC y OPUS según Android. " +
                            "Quedan excluidos DRM, compresión Kindle HUFF/CDIC, algunos diseños KF8 " +
                            "e imágenes de Office que necesiten OCR."
                    )
                }
                5 -> {
                    Button(onClick = { nested = "backup" },
                        modifier = Modifier.fillMaxWidth()) {
                        Text(if (english) "Open backup and restore tools"
                            else "Abrir copia y restauración")
                    }
                }
            }
        }
    }
}
