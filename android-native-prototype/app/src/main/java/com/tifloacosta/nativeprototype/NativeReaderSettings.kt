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
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.semantics.semantics
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
    Text(label + ": " + choices[index], modifier = Modifier.clearAndSetSemantics {})
    if (choices.size > 1) {
        Slider(
            value = index.toFloat(),
            onValueChange = { onSelected(it.roundToInt().coerceIn(0, choices.lastIndex)) },
            valueRange = 0f..choices.lastIndex.toFloat(),
            steps = (choices.size - 2).coerceAtLeast(0),
            modifier = Modifier.fillMaxWidth().semantics {
                contentDescription = label
                stateDescription = choices[index]
            }
        )
    }
}

/** Shared native defaults; book-specific overrides are edited inside each open book. */
@Composable
fun NativeReaderGeneralSettings(english: Boolean, onBack: () -> Unit) {
    val context = LocalContext.current
    val prefs = remember {
        context.getSharedPreferences("native-reader-preferences", 0)
    }
    val speaker = remember { NativeReaderSpeaker(context.applicationContext) }
    DisposableEffect(speaker) { onDispose { speaker.close() } }
    var expanded by remember { mutableIntStateOf(-1) }
    var speed by remember { mutableIntStateOf(
        SPEEDS.indices.minByOrNull { kotlin.math.abs(SPEEDS[it] - prefs.getFloat("rate", 1f)) } ?: 2
    ) }
    var mode by remember { mutableIntStateOf(prefs.getInt("mode", 0).coerceIn(0, 1)) }
    var unit by remember { mutableIntStateOf(prefs.getInt("unit", 1).coerceIn(0, 2)) }
    var font by remember { mutableIntStateOf(prefs.getInt("font", 3).coerceIn(0, 13)) }
    var spacing by remember { mutableIntStateOf(prefs.getInt("spacing", 0).coerceIn(0, 2)) }
    var bold by remember { mutableIntStateOf(prefs.getInt("bold", 0).coerceIn(0, 1)) }
    var voice by remember { mutableStateOf(prefs.getString("voice", "").orEmpty()) }
    var voiceFilter by remember { mutableIntStateOf(0) }
    val groups = if (english)
        listOf("Audio and voices", "Reading mode", "Visual presentation",
            "Navigation and steps", "Supported formats")
    else listOf("Audio y voces", "Modo de lectura", "Presentación visual",
        "Navegación y avances", "Formatos compatibles")

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
                        if (english) "Show voices" else "Mostrar voces",
                        if (english) listOf("All", "Spanish", "English")
                        else listOf("Todas", "Español", "Inglés"), voiceFilter
                    ) { voiceFilter = it }
                    val voices = speaker.voices().filter { v ->
                        voiceFilter == 0 ||
                            (voiceFilter == 1 && v.locale.language == "es") ||
                            (voiceFilter == 2 && v.locale.language == "en")
                    }
                    val choices = listOf(if (english) "System default" else "Predeterminada del sistema") +
                        voices.map { it.name + ", " + it.locale.displayLanguage }
                    val selected = voices.indexOfFirst { it.name == voice }.let {
                        if (it == -1) 0 else it + 1
                    }
                    ReaderAdjustableChoice(
                        if (english) "Voice" else "Voz", choices, selected
                    ) { idx ->
                        voice = voices.getOrNull(idx - 1)?.name.orEmpty()
                        prefs.edit().putString("voice", voice).apply()
                    }
                    Button(onClick = {
                        val intent = Intent("com.android.settings.TTS_SETTINGS")
                        if (intent.resolveActivity(context.packageManager) != null) {
                            context.startActivity(intent)
                        } else context.startActivity(Intent(Settings.ACTION_SETTINGS))
                    }) { Text(if (english) "Find more voices in Android" else "Buscar más voces en Android") }
                }
                1 -> ReaderAdjustableChoice(
                    if (english) "When opening a document" else "Al abrir un documento",
                    if (english) listOf("Manual", "Automatic speech on opening")
                    else listOf("Manual", "Leer automáticamente al abrir"), mode
                ) { mode = it; prefs.edit().putInt("mode", it).apply() }
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
                        if (english) "Supported: TXT, Markdown, HTML, RTF (basic text), PDF with embedded text, " +
                            "EPUB, DOCX, PPTX, XLSX, ZIP, DAISY text/audio, MP3, M4A, M4B, AAC, WAV and OGG. " +
                            "Legacy PPT/PPS/XLS, OCR and synchronized DAISY navigation are not yet supported."
                        else "Disponibles: TXT, Markdown, HTML, RTF (texto básico), PDF con texto, EPUB, " +
                            "DOCX, PPTX, XLSX, ZIP, DAISY de texto y audio, MP3, M4A, M4B, AAC, WAV y OGG. " +
                            "No se admiten todavía PPT/PPS/XLS antiguos, OCR ni navegación DAISY sincronizada."
                    )
                }
            }
        }
    }
}
