package com.tifloacosta.nativeprototype

import android.speech.tts.Voice
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import java.util.Locale

/** Android's Voice API exposes name, locale, quality and network need, not reliable gender. */
internal fun voiceQualityDescription(quality: Int, english: Boolean): String = when (quality) {
    Voice.QUALITY_VERY_HIGH -> if (english) "Very high" else "Muy alta"
    Voice.QUALITY_HIGH -> if (english) "High" else "Alta"
    Voice.QUALITY_NORMAL -> if (english) "Normal" else "Normal"
    Voice.QUALITY_LOW -> if (english) "Low" else "Baja"
    Voice.QUALITY_VERY_LOW -> if (english) "Very low" else "Muy baja"
    else -> if (english) "Not specified" else "No indicada"
}

private fun sampleFor(language: String): String = when (language) {
    "es" -> "Hola, estás escuchando una muestra de voz de TifloLector. Así sonará la lectura de tus documentos."
    "en" -> "Hello, this is a voice sample from TifloLector. This is how your documents will sound."
    else -> "Uno, dos, tres. One, two, three."
}

@Composable
fun NativeReaderVoicePicker(
    english: Boolean,
    speaker: NativeReaderSpeaker,
    selectedVoice: String,
    speed: Float,
    filter: Int,
    onVoiceSelected: (String) -> Unit,
    onBeforePreview: () -> Unit = {}
) {
    var showing by remember { mutableStateOf(false) }
    var restoreSettingsFocus by remember { mutableStateOf(false) }
    val voiceListToggleFocus = remember { FocusRequester() }
    LaunchedEffect(showing, restoreSettingsFocus) {
        if (!showing && restoreSettingsFocus) {
            voiceListToggleFocus.requestFocus()
            restoreSettingsFocus = false
        }
    }
    var playingName by remember { mutableStateOf<String?>(null) }
    var status by remember { mutableStateOf("") }
    val installed = speaker.voices()
    val voices = installed.filter { candidate ->
        filter == 0 || (filter == 1 && candidate.locale.language == "es") ||
            (filter == 2 && candidate.locale.language == "en")
    }
    val locale = if (english) Locale.ENGLISH else Locale.forLanguageTag("es-ES")
    val selected = installed.firstOrNull { it.name == selectedVoice }
    val selectedDescription = if (selected == null)
        (if (english) "System default" else "Predeterminada del sistema")
    else selected.locale.getDisplayName(locale) + ", " + selected.name

    Text((if (english) "Current reading voice: " else "Voz de lectura actual: ") + selectedDescription)
    Text((if (english) "Speech engine: " else "Motor de voz: ") + speaker.engineLabel())
    Text(
        if (english) "Some engines do not provide male/female labels. Use the listening sample to recognize each voice."
        else "Android no informa de forma fiable si una voz es masculina o femenina. Escucha la muestra para identificarla."
    )
    if (!speaker.ready.value) {
        Text(if (english) "Loading installed voices…" else "Cargando voces instaladas…")
        return
    }
    Button(modifier = Modifier.fillMaxWidth().focusRequester(voiceListToggleFocus),
        onClick = { showing = !showing }) {
        Text(if (showing) (if (english) "Hide voices" else "Ocultar voces")
            else (if (english) "Show available voices (" else "Mostrar voces disponibles (") +
                voices.size + ")")
    }
    if (!showing) return

    fun preview(name: String, language: String) {
        status = ""
        onBeforePreview()
        playingName = name
        val success = speaker.preview(sampleFor(language), speed, name) {
            if (playingName == name) playingName = null
        }
        if (!success) {
            playingName = null
            status = if (english) "Could not play this voice. Check its download and connection."
                else "No se pudo escuchar esta voz. Comprueba su descarga y la conexión."
        }
    }

    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        if (playingName != null) {
            TextButton(onClick = {
                speaker.stop()
                playingName = null
            }) { Text(if (english) "Stop sample" else "Detener muestra") }
        }
        Text(if (english) "System default voice" else "Voz predeterminada del sistema")
        OutlinedButton(modifier = Modifier.fillMaxWidth(), onClick = {
            speaker.stop()
            playingName = null
            onVoiceSelected("")
            showing = false
            restoreSettingsFocus = true
            status = if (english) "System voice selected" else "Voz del sistema seleccionada"
        }) {
            Text(if (english) "Use system voice" else "Utilizar voz del sistema")
        }
        OutlinedButton(modifier = Modifier.fillMaxWidth(), onClick = {
            preview("", locale.language)
        }) {
            Text(if (english) "Listen to system voice" else "Escuchar voz del sistema")
        }
        voices.forEachIndexed { index, v ->
            val number = index + 1
            val caption = (if (english) "Voice " else "Voz ") + number +
                ". " + v.locale.getDisplayName(locale) +
                ". " + (if (english) "Technical name: " else "Nombre técnico: ") + v.name +
                ". " + (if (english) "Quality: " else "Calidad: ") +
                voiceQualityDescription(v.quality, english) +
                ". " + (if (v.isNetworkConnectionRequired)
                    (if (english) "Internet required" else "Necesita Internet")
                else (if (english) "Offline capable" else "Puede funcionar sin conexión")) +
                (if (selectedVoice == v.name) (if (english) ". Selected" else ". Seleccionada") else "")
            Text(caption)
            OutlinedButton(modifier = Modifier.fillMaxWidth(), onClick = {
                preview(v.name, v.locale.language)
            }) {
                Text((if (english) "Listen to voice " else "Escuchar muestra de voz ") + number)
            }
            Button(modifier = Modifier.fillMaxWidth(), onClick = {
                speaker.stop()
                playingName = null
                onVoiceSelected(v.name)
                showing = false
                restoreSettingsFocus = true
                status = if (english) "Voice $number selected for reading"
                    else "Voz $number seleccionada para leer"
            }) {
                Text((if (english) "Use voice " else "Utilizar voz ") + number +
                    (if (selectedVoice == v.name) (if (english) ", selected" else ", seleccionada") else ""))
            }
        }
        if (voices.isEmpty()) {
            Text(if (english) "No installed voices match this language filter."
                else "No hay voces instaladas para este filtro de idioma.")
        }
    }
    if (status.isNotBlank()) {
        Text(status, modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite })
    }
}
