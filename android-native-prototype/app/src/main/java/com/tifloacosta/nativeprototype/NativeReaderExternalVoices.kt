package com.tifloacosta.nativeprototype

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp

data class ExternalVoiceProvider(val name: String, val uri: String)

/** Existing Android compatible voice-provider catalog, not an in-app voice store. */
object NativeVoiceProviders {
    val providers = listOf(
        ExternalVoiceProvider("Acapela TTS Voices",
            "https://play.google.com/store/apps/details?id=com.acapelagroup.android.tts"),
        ExternalVoiceProvider("Vocalizer TTS",
            "https://play.google.com/store/apps/details?id=es.codefactory.vocalizertts"),
        ExternalVoiceProvider("Eloquence TTS",
            "https://play.google.com/store/apps/details?id=com.codefactoryglobal.eloquencetts")
    )
}

@Composable
fun NativeExternalVoiceProvidersScreen(english: Boolean, onBack: () -> Unit) {
    val context = LocalContext.current
    val uiLanguage = LocalNativeUiLanguage.current
    var pending by remember { mutableStateOf<ExternalVoiceProvider?>(null) }
    var error by remember { mutableStateOf("") }

    Column(modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)) {
        TextButton(onClick = onBack) {
            Text(NativeReaderExternalVoiceStrings.get(uiLanguage, "back"))
        }
        Text(NativeReaderExternalVoiceStrings.get(uiLanguage, "title"),
            style = MaterialTheme.typography.headlineSmall,
            modifier = Modifier.semantics { heading() })
        Text(
            NativeReaderExternalVoiceStrings.get(uiLanguage, "help")
        )
        NativeVoiceProviders.providers.forEach { provider ->
            Button(
                modifier = Modifier.fillMaxWidth(),
                onClick = { pending = provider }
            ) { Text(NativeReaderExternalVoiceStrings.get(uiLanguage, "visit") + provider.name) }
        }
        if (error.isNotBlank()) Text(error)
    }
    pending?.let { provider ->
        AlertDialog(
            onDismissRequest = { pending = null },
            title = { Text(NativeReaderExternalVoiceStrings.get(uiLanguage, "confirm")) },
            text = {
                Text(
                    NativeReaderExternalVoiceStrings.get(uiLanguage, "warning") + provider.name +
                        NativeReaderExternalVoiceStrings.get(uiLanguage, "warningTail")
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    try {
                        context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(provider.uri)))
                        error = ""
                    } catch (_: Exception) {
                        error = NativeReaderExternalVoiceStrings.get(uiLanguage, "error")
                    }
                    pending = null
                }) { Text(NativeReaderExternalVoiceStrings.get(uiLanguage, "continue")) }
            },
            dismissButton = {
                TextButton(onClick = { pending = null }) {
                    Text(NativeReaderExternalVoiceStrings.get(uiLanguage, "cancel"))
                }
            }
        )
    }
}
