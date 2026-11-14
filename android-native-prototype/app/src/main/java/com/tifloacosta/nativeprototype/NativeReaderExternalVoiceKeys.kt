package com.tifloacosta.nativeprototype

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Handler
import android.os.Looper
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
    val uiLanguage = LocalNativeUiLanguage.current
    val credentials = remember { NativeVoiceCredentials(context.applicationContext) }
    var key by remember { mutableStateOf("") }
    var present by remember { mutableStateOf(credentials.hasKey("gemini")) }
    var message by remember { mutableStateOf("") }
    // Only the selected provider belongs to the accessible tree.
    var selectedProvider by remember { mutableStateOf<String?>(null) }
    var confirmingDelete by remember { mutableStateOf(false) }
    var checking by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    var phononModelInstalled by remember {
        mutableStateOf(NativePhononModelStore.installed(context))
    }
    var phononImportBusy by remember { mutableStateOf(false) }
    var phononTermsAccepted by remember { mutableStateOf(false) }
    var phononDeleteConfirm by remember { mutableStateOf(false) }
    val phononPreview = remember { NativePhononReader(context.applicationContext) }
    val mainHandler = remember { Handler(Looper.getMainLooper()) }
    var phononSamplePlaying by remember { mutableStateOf(false) }
    var phononVoiceExpanded by remember { mutableStateOf(false) }
    var phononVoice by remember {
        mutableStateOf(context.getSharedPreferences("native-reader-preferences", Context.MODE_PRIVATE)
            .getString("phonon.voice", "").orEmpty())
    }
    val importPhonon = rememberLauncherForActivityResult(
        ActivityResultContracts.OpenDocument()
    ) { uri ->
        if (uri != null && !phononImportBusy) {
            phononImportBusy = true
            message = NativeReaderPhononStrings.get(uiLanguage, "installing")
            scope.launch {
                message = try {
                    withContext(Dispatchers.IO) {
                        NativePhononModelStore.importZip(context, uri)
                    }
                    phononPreview.refreshModel()
                    phononModelInstalled = true
                    NativeReaderPhononStrings.get(uiLanguage, "installed")
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
    DisposableEffect(Unit) {
        onDispose {
            preview.stop()
            phononPreview.close()
        }
    }

    fun open(url: String) {
        try {
            context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
        } catch (_: Exception) {
            message = NativeReaderPhononStrings.get(uiLanguage, "siteError")
        }
    }

    fun backFromProvider() {
        preview.stop()
        phononPreview.stop()
        samplePlaying = false
        phononSamplePlaying = false
        key = ""
        message = ""
        selectedProvider = null
    }
    BackHandler {
        if (selectedProvider != null) backFromProvider() else onBack()
    }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)) {
        TextButton(onClick = {
            if (selectedProvider != null) backFromProvider() else onBack()
        }) {
            Text(NativeReaderPhononStrings.get(uiLanguage,
                if (selectedProvider != null) "backEngines" else "back"))
        }
        Text(NativeReaderPhononStrings.get(uiLanguage, "external"))
        if (selectedProvider == null) {
            Button(onClick = { selectedProvider = "phonon" },
                modifier = Modifier.fillMaxWidth()) {
                Text("Phonon")
            }
            Button(onClick = { selectedProvider = "gemini" },
                modifier = Modifier.fillMaxWidth()) {
                Text("Gemini")
            }
        }
        if (selectedProvider == "phonon") {
        Text("Phonon")
        Text(NativeReaderPhononStrings.get(uiLanguage, "help"))
        Button(onClick = { open("https://gradium.ai/phonon") }) {
            Text("Phonon")
        }
        Button(onClick = { open("https://huggingface.co/gradium/phonon-31m-en") }) {
            Text(NativeReaderPhononStrings.get(uiLanguage, "englishModel"))
        }
        Button(onClick = { open("https://huggingface.co/gradium/phonon-40m-multilingual") }) {
            Text(NativeReaderPhononStrings.get(uiLanguage, "multilingual"))
        }
        Text(NativeReaderPhononStrings.get(uiLanguage, "zipHelp"))
        Text(
            if (phononModelInstalled) {
                NativeReaderPhononStrings.get(uiLanguage, "cpuInstalled")
            } else {
                NativeReaderPhononStrings.get(uiLanguage, "cpuMissing")
            }
        )
        Row {
            Checkbox(
                checked = phononTermsAccepted,
                onCheckedChange = { phononTermsAccepted = it }
            )
            Text(NativeReaderPhononStrings.get(uiLanguage, "license"))
        }
        Button(
            enabled = !phononImportBusy && phononTermsAccepted,
            onClick = { importPhonon.launch(arrayOf("application/zip", "application/octet-stream")) }
        ) { Text(NativeReaderPhononStrings.get(uiLanguage, "importZip")) }
        Button(onClick = { phononLanguagesExpanded = true }) {
            Text(NativeReaderPhononStrings.get(uiLanguage, "modelLanguage") +
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
        Text(NativeReaderPhononStrings.get(uiLanguage, "selectLanguage"))
        Text(NativeReaderPhononStrings.get(uiLanguage, "legalHelp"))
        if (phononModelInstalled &&
            NativePhononReader.isAvailable(context.applicationContext)) {
            val names = NativePhononModelStore.voices(context)
            if (names.isNotEmpty()) {
                Button(onClick = { phononVoiceExpanded = true }) {
                    Text(NativeReaderPhononStrings.get(uiLanguage, "voice") +
                        phononVoice.ifBlank { names.first() })
                }
                DropdownMenu(expanded = phononVoiceExpanded,
                    onDismissRequest = { phononVoiceExpanded = false }) {
                    names.forEach { name ->
                        DropdownMenuItem(text = { Text(name) }, onClick = {
                            phononVoice = name
                            prefs.edit().putString("phonon.voice", name).apply()
                            phononVoiceExpanded = false
                        })
                    }
                }
                Button(onClick = {
                    phononPreview.stop()
                    phononSamplePlaying = true
                    message = NativeReaderPhononStrings.get(uiLanguage, "playing")
                    phononPreview.speak(
                        when (phononLanguage) {
                            "es" -> "Hola. Esta es una prueba de la voz Phonon."
                            "fr" -> "Bonjour. Voici un exemple de la voix Phonon."
                            "de" -> "Hallo. Dies ist eine Hörprobe der Phonon-Stimme."
                            "pt" -> "Olá. Esta é uma amostra da voz Phonon."
                            else -> "Hello. This is a sample of the Phonon voice."
                        },
                        phononVoice.ifBlank { names.first() }, phononLanguage,
                        completed = {
                            mainHandler.post { phononSamplePlaying = false }
                        },
                        error = { reason ->
                            mainHandler.post {
                                phononSamplePlaying = false
                                message = "Phonon: " + reason
                            }
                        }
                    )
                }) {
                    Text(NativeReaderPhononStrings.get(uiLanguage, "listen"))
                }
                if (phononSamplePlaying) {
                    Button(onClick = {
                        phononPreview.stop()
                        phononSamplePlaying = false
                    }) { Text(NativeReaderPhononStrings.get(uiLanguage, "stop")) }
                }
            }
        }
        if (phononModelInstalled) {
            if (phononDeleteConfirm) {
                Text(NativeReaderPhononStrings.get(uiLanguage, "deleteQuestion"))
                Button(onClick = {
                    phononPreview.refreshModel()
                    phononModelInstalled = !NativePhononModelStore.remove(context)
                    phononDeleteConfirm = false
                    message = NativeReaderPhononStrings.get(uiLanguage,
                        if (phononModelInstalled) "deleteFailed" else "deleteSuccess")
                }) { Text(NativeReaderPhononStrings.get(uiLanguage, "confirm")) }
                TextButton(onClick = { phononDeleteConfirm = false }) {
                    Text(NativeReaderPhononStrings.get(uiLanguage, "cancel"))
                }
            } else {
                TextButton(onClick = { phononDeleteConfirm = true }) {
                    Text(NativeReaderPhononStrings.get(uiLanguage, "deleteModel"))
                }
            }
        }

        }
        if (selectedProvider == "gemini") {
        Text("Gemini")
        Text(NativeReaderGeminiStrings.get(uiLanguage, if (present) "keySaved" else "noKey"))
        Button(onClick = { open("https://aistudio.google.com/api-keys") }) {
            Text(NativeReaderGeminiStrings.get(uiLanguage, "create"))
        }
        OutlinedTextField(
            value = key,
            onValueChange = { key = it },
            label = { Text(NativeReaderGeminiStrings.get(uiLanguage, "paste")) },
            visualTransformation = PasswordVisualTransformation(),
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )
        Button(enabled = key.isNotBlank(), onClick = {
            try {
                credentials.save("gemini", key)
                key = ""
                present = true
                message = NativeReaderGeminiStrings.get(uiLanguage, "saved")
            } catch (_: Exception) {
                message = NativeReaderGeminiStrings.get(uiLanguage, "saveError")
            }
        }) { Text(NativeReaderGeminiStrings.get(uiLanguage, "save")) }
        if (present) {
            Button(onClick = { voicesExpanded = true }) {
                Text(NativeReaderGeminiStrings.get(uiLanguage, "voice") + voice)
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
                message = NativeReaderGeminiStrings.get(uiLanguage, "quota")
                scope.launch {
                    try {
                        val wav = withContext(Dispatchers.IO) {
                            NativeGeminiSpeech.generate(context,
                                NativeReaderGeminiStrings.get(uiLanguage, "sample"),
                                voice)
                        }
                        preview.play(wav)
                        samplePlaying = true
                        message = NativeReaderGeminiStrings.get(uiLanguage, "playing")
                    } catch (_: Exception) {
                        message = NativeReaderGeminiStrings.get(uiLanguage, "playError")
                    }
                    generating = false
                }
            }) { Text(NativeReaderGeminiStrings.get(uiLanguage, "listen")) }
            if (samplePlaying) {
                Button(onClick = {
                    preview.stop()
                    samplePlaying = false
                }) { Text(NativeReaderGeminiStrings.get(uiLanguage, "stop")) }
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
                            in 200..299 -> NativeReaderGeminiStrings.get(uiLanguage, "connected")
                            401, 403 -> NativeReaderGeminiStrings.get(uiLanguage, "rejected")
                            429 -> NativeReaderGeminiStrings.get(uiLanguage, "exhausted")
                            else -> NativeReaderGeminiStrings.get(uiLanguage, "providerError") + responseCode
                        }
                    } catch (_: Exception) {
                        NativeReaderGeminiStrings.get(uiLanguage, "checkError")
                    }
                    checking = false
                }
            }) { Text(NativeReaderGeminiStrings.get(uiLanguage, "check")) }
            if (confirmingDelete) {
                Text(NativeReaderGeminiStrings.get(uiLanguage, "deleteQuestion"))
                Button(onClick = {
                    try {
                        credentials.delete("gemini")
                        present = false
                        confirmingDelete = false
                        message = NativeReaderGeminiStrings.get(uiLanguage, "deleted")
                    } catch (_: Exception) {
                        message = NativeReaderGeminiStrings.get(uiLanguage, "deleteError")
                    }
                }) { Text(NativeReaderPhononStrings.get(uiLanguage, "confirm")) }
                TextButton(onClick = { confirmingDelete = false }) {
                    Text(NativeReaderPhononStrings.get(uiLanguage, "cancel"))
                }
            } else {
                TextButton(onClick = { confirmingDelete = true }) {
                    Text(NativeReaderGeminiStrings.get(uiLanguage, "delete"))
                }
            }
        }
        Text(NativeReaderGeminiStrings.get(uiLanguage, "help"))
        }
        if (selectedProvider != null && message.isNotBlank()) {
            Text(message, modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite })
        }
    }
}
