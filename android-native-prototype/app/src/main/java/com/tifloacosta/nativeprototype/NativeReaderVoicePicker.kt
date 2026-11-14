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
internal fun voiceQualityDescription(quality: Int, language: String): String =
    NativeReaderVoicePickerStrings.quality(language, quality)

private fun sampleFor(language: String): String = NativeReaderVoicePickerStrings.sample(language)

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
    val uiLanguage = LocalNativeUiLanguage.current
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
    val locale = Locale.forLanguageTag(uiLanguage)
    val selected = installed.firstOrNull { it.name == selectedVoice }
    val selectedDescription = if (selected == null)
        NativeReaderVoicePickerStrings.get(uiLanguage, "systemDefault")
    else selected.locale.getDisplayName(locale) + ", " + selected.name

    Text(NativeReaderVoicePickerStrings.get(uiLanguage, "voice") + selectedDescription)
    Text(NativeReaderVoicePickerStrings.get(uiLanguage, "engine") + speaker.engineLabel())
     if (!speaker.ready.value) {
        Text(NativeReaderVoicePickerStrings.get(uiLanguage, "loading"))
        return
    }
    Button(modifier = Modifier.fillMaxWidth().focusRequester(voiceListToggleFocus),
        onClick = { showing = !showing }) {
        Text(if (showing) NativeReaderVoicePickerStrings.get(uiLanguage, "close")
            else NativeReaderVoicePickerStrings.get(uiLanguage, "voices") +
                voices.size + ")")
    }
    if (status.isNotBlank()) {
        Text(status, modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite })
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
            status = NativeReaderVoicePickerStrings.get(uiLanguage, "previewError")
        }
    }

    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        if (playingName != null) {
            TextButton(onClick = {
                speaker.stop()
                playingName = null
            }) { Text(NativeReaderVoicePickerStrings.get(uiLanguage, "stop")) }
        }
        Text(NativeReaderVoicePickerStrings.get(uiLanguage, "defaultVoice"))
        OutlinedButton(modifier = Modifier.fillMaxWidth(), onClick = {
            speaker.stop()
            playingName = null
            onVoiceSelected("")
            showing = false
            restoreSettingsFocus = true
            status = NativeReaderVoicePickerStrings.get(uiLanguage, "selectedSystem")
        }) {
            Text(NativeReaderVoicePickerStrings.get(uiLanguage, "select"))
        }
        OutlinedButton(modifier = Modifier.fillMaxWidth(), onClick = {
            preview("", locale.language)
        }) {
            Text(NativeReaderVoicePickerStrings.get(uiLanguage, "listen"))
        }
        voices.forEachIndexed { index, v ->
            val number = index + 1
            val caption = NativeReaderVoicePickerStrings.get(uiLanguage, "voice") + number +
                ". " + v.locale.getDisplayName(locale) +
                ". " + NativeReaderVoicePickerStrings.get(uiLanguage, "technical") + v.name +
                ". " + NativeReaderVoicePickerStrings.get(uiLanguage, "quality") +
                voiceQualityDescription(v.quality, uiLanguage) +
                ". " + (if (v.isNetworkConnectionRequired)
                    NativeReaderVoicePickerStrings.get(uiLanguage, "online")
                else NativeReaderVoicePickerStrings.get(uiLanguage, "offline")) +
                (if (selectedVoice == v.name) NativeReaderVoicePickerStrings.get(uiLanguage, "selected") else "")
            Text(caption)
            OutlinedButton(modifier = Modifier.fillMaxWidth(), onClick = {
                preview(v.name, v.locale.language)
            }) {
                Text(NativeReaderVoicePickerStrings.get(uiLanguage, "listen"))
            }
            Button(modifier = Modifier.fillMaxWidth(), onClick = {
                speaker.stop()
                playingName = null
                onVoiceSelected(v.name)
                showing = false
                restoreSettingsFocus = true
                status = NativeReaderVoicePickerStrings.get(uiLanguage, "voiceSelected") + " $number"
            }) {
                Text(NativeReaderVoicePickerStrings.get(uiLanguage, "select"))
            }
        }
        if (voices.isEmpty()) {
            Text(NativeReaderVoicePickerStrings.get(uiLanguage, "empty"))
        }
    }
}
