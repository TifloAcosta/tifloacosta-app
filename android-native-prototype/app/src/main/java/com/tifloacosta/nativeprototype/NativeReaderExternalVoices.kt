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
    var pending by remember { mutableStateOf<ExternalVoiceProvider?>(null) }
    var error by remember { mutableStateOf("") }

    Column(modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)) {
        TextButton(onClick = onBack) {
            Text(if (english) "Back to audio and voices" else "Volver a Audio y voces")
        }
        Text(if (english) "External voice providers" else "Voces de otros proveedores",
            style = MaterialTheme.typography.headlineSmall,
            modifier = Modifier.semantics { heading() })
        Text(
            if (english) "You can explore Android TTS voices from other developers. " +
                "Availability, languages, trials and purchases depend on each provider. " +
                "Install and configure its Android TTS engine, then return and refresh the voice list."
            else "Puedes consultar voces TTS de otros desarrolladores. Los idiomas, pruebas, " +
                "precios y disponibilidad dependen de cada proveedor. Si instalas uno, " +
                "configúralo como motor de síntesis de Android y vuelve para actualizar las voces."
        )
        NativeVoiceProviders.providers.forEach { provider ->
            Button(
                modifier = Modifier.fillMaxWidth(),
                onClick = { pending = provider }
            ) { Text((if (english) "Visit " else "Visitar ") + provider.name) }
        }
        if (error.isNotBlank()) Text(error)
    }
    pending?.let { provider ->
        AlertDialog(
            onDismissRequest = { pending = null },
            title = { Text(if (english) "Open external provider?" else "¿Abrir un proveedor externo?") },
            text = {
                Text(
                    if (english) "You will leave TifloLector to visit " + provider.name +
                        ". Any installation or payment is managed by the provider."
                    else "Vas a salir de TifloLector para visitar " + provider.name +
                        ". La instalación y los posibles pagos se gestionan con el proveedor."
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    try {
                        context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(provider.uri)))
                        error = ""
                    } catch (_: Exception) {
                        error = if (english) "Could not open the voice provider."
                            else "No se pudo abrir el proveedor de voces."
                    }
                    pending = null
                }) { Text(if (english) "Continue" else "Continuar") }
            },
            dismissButton = {
                TextButton(onClick = { pending = null }) {
                    Text(if (english) "Cancel" else "Cancelar")
                }
            }
        )
    }
}
