package com.tifloacosta.nativeprototype

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.foundation.layout.Row
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.DisposableEffect
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import java.security.KeyStore
import java.net.HttpURLConnection
import java.net.URL
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/** Device-only credential storage. No API key is stored in plain SharedPreferences
 * or included in TifloLector library backups.
 */
internal class NativeVoiceCredentials(private val context: Context) {
    private val alias = "tifloacosta-reader-voice-keys"
    private val store = context.getSharedPreferences("native-reader-voice-secure", Context.MODE_PRIVATE)

    private fun secret(): SecretKey {
        val keys = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (keys.getKey(alias, null) as? SecretKey)?.let { return it }
        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        generator.init(KeyGenParameterSpec.Builder(alias,
            KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .build())
        return generator.generateKey()
    }

    fun save(provider: String, value: String) {
        val clean = value.trim()
        require(clean.isNotBlank()) { "Pega una clave antes de guardar." }
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, secret())
        val encrypted = cipher.doFinal(clean.toByteArray(Charsets.UTF_8))
        val packed = cipher.iv + encrypted
        check(store.edit().putString(provider,
            Base64.encodeToString(packed, Base64.NO_WRAP)).commit()) {
            "No se pudo guardar la clave."
        }
    }

    fun read(provider: String): String? {
        val packed = store.getString(provider, null) ?: return null
        val bytes = Base64.decode(packed, Base64.NO_WRAP)
        require(bytes.size > 12) { "La clave guardada no es válida." }
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, secret(),
            GCMParameterSpec(128, bytes.copyOfRange(0, 12)))
        return String(cipher.doFinal(bytes.copyOfRange(12, bytes.size)), Charsets.UTF_8)
    }

    fun hasKey(provider: String): Boolean = store.contains(provider)
    fun delete(provider: String) {
        check(store.edit().remove(provider).commit()) { "No se pudo eliminar la clave." }
    }
}

@Composable
fun NativeReaderExternalVoiceKeysScreen(english: Boolean, onBack: () -> Unit) {
    val context = LocalContext.current
    val credentials = remember { NativeVoiceCredentials(context.applicationContext) }
    var key by remember { mutableStateOf("") }
    var present by remember { mutableStateOf(credentials.hasKey("gemini")) }
    var message by remember { mutableStateOf("") }
    var confirmingDelete by remember { mutableStateOf(false) }
    var checking by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    var phononModelInstalled by remember {
        mutableStateOf(NativePhononModelStore.installed(context))
    }
    var phononImportBusy by remember { mutableStateOf(false) }
    var phononTermsAccepted by remember { mutableStateOf(false) }
    var phononDeleteConfirm by remember { mutableStateOf(false) }
    val importPhonon = rememberLauncherForActivityResult(
        ActivityResultContracts.OpenDocument()
    ) { uri ->
        if (uri != null && !phononImportBusy) {
            phononImportBusy = true
            message = if (english) "Installing Phonon model…" else "Instalando modelo Phonon…"
            scope.launch {
                message = try {
                    withContext(Dispatchers.IO) {
                        NativePhononModelStore.importZip(context, uri)
                    }
                    phononModelInstalled = true
                    if (english) "Phonon model installed locally."
                    else "Modelo Phonon instalado en el dispositivo."
                } catch (error: Exception) {
                    error.localizedMessage ?: "No se pudo importar el modelo Phonon."
                }
                phononImportBusy = false
            }
        }
    }
    val preview = remember { NativeGeminiAudioPreview(context.applicationContext) }
    val prefs = remember {
        context.getSharedPreferences("native-reader-preferences", Context.MODE_PRIVATE)
    }
    var voice by remember { mutableStateOf(prefs.getString("gemini.voice", "Kore") ?: "Kore") }
    var phononLanguage by remember {
        mutableStateOf(prefs.getString("phonon.language", "en") ?: "en")
    }
    var phononLanguagesExpanded by remember { mutableStateOf(false) }
    val phononLanguageOptions = listOf(
        "en" to "English", "es" to "Español", "fr" to "Français",
        "de" to "Deutsch", "pt" to "Português"
    )
    var voicesExpanded by remember { mutableStateOf(false) }
    var generating by remember { mutableStateOf(false) }
    var samplePlaying by remember { mutableStateOf(false) }
    DisposableEffect(Unit) { onDispose { preview.stop() } }

    fun open(url: String) {
        try {
            context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
        } catch (_: Exception) {
            message = if (english) "Could not open the site." else "No se pudo abrir el sitio."
        }
    }

    BackHandler { onBack() }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)) {
        TextButton(onClick = onBack) { Text(if (english) "Back" else "Volver") }
        Text(if (english) "External engines" else "Motores externos")
        Text("Phonon")
        Text(if (english) "On-device voices. No API key needed. VoiceOver integration does not automatically make the engine available inside TifloLector."
            else "Voces locales, sin clave API. La integración con VoiceOver no implica que el motor esté disponible directamente en TifloLector.")
        Button(onClick = { open("https://gradium.ai/phonon") }) {
            Text(if (english) "Phonon" else "Phonon")
        }
        Text(
            if (phononModelInstalled) {
                if (english) "CPU model installed." else "Modelo CPU instalado."
            } else {
                if (english) "No CPU model installed." else "Sin modelo CPU instalado."
            }
        )
        Row {
            Checkbox(
                checked = phononTermsAccepted,
                onCheckedChange = { phononTermsAccepted = it }
            )
            Text(if (english)
                "I will respect the model and voice licenses, including non-commercial restrictions."
                else "Respetaré las licencias del modelo y de las voces, incluidas sus restricciones no comerciales.")
        }
        Button(
            enabled = !phononImportBusy && phononTermsAccepted,
            onClick = { importPhonon.launch(arrayOf("application/zip", "application/octet-stream")) }
        ) { Text(if (english) "Import model ZIP" else "Importar modelo ZIP") }
        Button(onClick = { phononLanguagesExpanded = true }) {
            Text((if (english) "Model language: " else "Idioma del modelo: ") +
                (phononLanguageOptions.firstOrNull { it.first == phononLanguage }?.second ?: phononLanguage))
        }
        DropdownMenu(
            expanded = phononLanguagesExpanded,
            onDismissRequest = { phononLanguagesExpanded = false }
        ) {
            phononLanguageOptions.forEach { (language, label) ->
                DropdownMenuItem(text = { Text(label) }, onClick = {
                    phononLanguage = language
                    prefs.edit().putString("phonon.language", language).apply()
                    phononLanguagesExpanded = false
                })
            }
        }
        Text(if (english) "Choose the actual language of your installed checkpoint."
            else "Selecciona el idioma real del modelo que hayas instalado.")
        Text(if (english)
            "Import only a complete CPU checkpoint with its own license. Phonon 31m speaks English; the Spanish 40m model has non-commercial restrictions. A model alone does not install the native engine."
            else "Importa un modelo CPU completo y respeta su licencia. Phonon 31m habla inglés; el modelo español 40m tiene restricciones de uso no comercial. Importar el modelo no instala por sí solo el motor nativo.")
        if (phononModelInstalled) {
            if (phononDeleteConfirm) {
                Text(if (english) "Delete installed Phonon model?" else "¿Eliminar el modelo Phonon?")
                Button(onClick = {
                    phononModelInstalled = !NativePhononModelStore.remove(context)
                    phononDeleteConfirm = false
                    message = if (phononModelInstalled) "No se pudo eliminar el modelo."
                        else "Modelo Phonon eliminado."
                }) { Text(if (english) "Confirm" else "Confirmar") }
                TextButton(onClick = { phononDeleteConfirm = false }) {
                    Text(if (english) "Cancel" else "Cancelar")
                }
            } else {
                TextButton(onClick = { phononDeleteConfirm = true }) {
                    Text(if (english) "Delete model" else "Eliminar modelo")
                }
            }
        }

        Text("Gemini")
        Text(if (present) (if (english) "Key saved" else "Clave guardada")
            else (if (english) "No key" else "Sin clave"))
        Button(onClick = { open("https://aistudio.google.com/api-keys") }) {
            Text(if (english) "Create key" else "Crear clave")
        }
        OutlinedTextField(
            value = key,
            onValueChange = { key = it },
            label = { Text(if (english) "Paste key" else "Pegar clave") },
            visualTransformation = PasswordVisualTransformation(),
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )
        Button(enabled = key.isNotBlank(), onClick = {
            try {
                credentials.save("gemini", key)
                key = ""
                present = true
                message = if (english) "Key saved on this device."
                    else "Clave guardada en este dispositivo."
            } catch (_: Exception) {
                message = if (english) "Could not save key." else "No se pudo guardar la clave."
            }
        }) { Text(if (english) "Save" else "Guardar") }
        if (present) {
            Button(onClick = { voicesExpanded = true }) {
                Text((if (english) "Voice: " else "Voz: ") + voice)
            }
            DropdownMenu(expanded = voicesExpanded, onDismissRequest = { voicesExpanded = false }) {
                NativeGeminiSpeech.voices.forEach { option ->
                    DropdownMenuItem(text = { Text(option) }, onClick = {
                        voice = option
                        prefs.edit().putString("gemini.voice", option).apply()
                        voicesExpanded = false
                    })
                }
            }
            Button(enabled = !generating, onClick = {
                generating = true
                preview.stop()
                samplePlaying = false
                message = if (english) "Generating audio; your account quota may be used."
                    else "Generando audio; puede consumir cuota de tu cuenta."
                scope.launch {
                    try {
                        val wav = withContext(Dispatchers.IO) {
                            NativeGeminiSpeech.generate(context,
                                if (english) "Hello. This is a Gemini voice sample in TifloLector."
                                else "Hola. Esta es una prueba de voz Gemini en TifloLector.",
                                voice)
                        }
                        preview.play(wav)
                        samplePlaying = true
                        message = if (english) "Playing Gemini sample."
                            else "Reproduciendo muestra Gemini."
                    } catch (_: Exception) {
                        message = if (english) "Could not generate or play Gemini audio."
                            else "No se pudo generar o reproducir audio Gemini."
                    }
                    generating = false
                }
            }) { Text(if (english) "Listen" else "Escuchar") }
            if (samplePlaying) {
                Button(onClick = {
                    preview.stop()
                    samplePlaying = false
                }) { Text(if (english) "Stop" else "Detener") }
            }
            Button(enabled = !checking, onClick = {
                checking = true
                scope.launch {
                    message = try {
                        val responseCode = withContext(Dispatchers.IO) {
                            val token = credentials.read("gemini")
                                ?: error("Missing key")
                            val connection = URL(
                                "https://generativelanguage.googleapis.com/v1beta/models"
                            ).openConnection() as HttpURLConnection
                            try {
                                connection.requestMethod = "GET"
                                connection.connectTimeout = 15000
                                connection.readTimeout = 15000
                                connection.setRequestProperty("x-goog-api-key", token)
                                connection.responseCode
                            } finally {
                                connection.disconnect()
                            }
                        }
                        when (responseCode) {
                            in 200..299 -> if (english)
                                "Connection OK. Audio generation is not active yet."
                                else "Conexión correcta. La generación de audio aún no está activa."
                            401, 403 -> if (english) "Key rejected or insufficient permissions."
                                else "Clave rechazada o sin permisos."
                            429 -> if (english) "Quota exceeded." else "Cuota agotada."
                            else -> if (english) "Provider error: $responseCode"
                                else "Error del proveedor: $responseCode"
                        }
                    } catch (_: Exception) {
                        if (english) "Could not check connection."
                        else "No se pudo comprobar la conexión."
                    }
                    checking = false
                }
            }) { Text(if (english) "Check" else "Comprobar") }
            if (confirmingDelete) {
                Text(if (english) "Delete the saved key?" else "¿Eliminar la clave guardada?")
                Button(onClick = {
                    try {
                        credentials.delete("gemini")
                        present = false
                        confirmingDelete = false
                        message = if (english) "Key deleted." else "Clave eliminada."
                    } catch (_: Exception) {
                        message = if (english) "Could not delete key." else "No se pudo eliminar la clave."
                    }
                }) { Text(if (english) "Confirm" else "Confirmar") }
                TextButton(onClick = { confirmingDelete = false }) {
                    Text(if (english) "Cancel" else "Cancelar")
                }
            } else {
                TextButton(onClick = { confirmingDelete = true }) {
                    Text(if (english) "Delete" else "Eliminar")
                }
            }
        }
        Text(if (english) "Your API key and quota belong to you. The app does not provide a shared key. Gemini sample generates real audio and may use quota. Full document playback is not yet integrated."
            else "Cada usuario gestiona su clave, cuota y posibles costes. TifloAcosta no proporciona una clave compartida. La muestra genera audio real y puede consumir cuota. La lectura completa de documentos todavía no está integrada.")
        if (message.isNotBlank()) {
            Text(message, modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite })
        }
    }
}
