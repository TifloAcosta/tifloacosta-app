package com.tifloacosta.nativeprototype

import android.content.ClipData
import android.content.Intent
import android.net.Uri
import android.webkit.MimeTypeMap
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
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.unit.dp
import androidx.core.content.FileProvider
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.IOException

/** Deliberately nested in a single book: no new clutter on TifloLector home. */
@Composable
fun NativeReaderDocumentActions(
    book: ReaderBook,
    english: Boolean,
    fragment: String,
    initialAudioExport: Boolean = false,
    onUnitChange: (Int) -> Unit = {},
    onOcrCompleted: () -> Unit = {},
    onBack: () -> Unit
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val store = remember { NativeReaderStore(context.applicationContext) }
    val prefs = remember { context.getSharedPreferences("native-reader-preferences", 0) }
    val languages = NativeReaderTranslation.languages
    var sourceIndex by remember(book.id) { mutableIntStateOf(
        languages.indexOfFirst { it.tag == prefs.getString("translate.source." + book.id, "en") }
            .coerceAtLeast(0)
    ) }
    var targetIndex by remember(book.id) { mutableIntStateOf(
        languages.indexOfFirst { it.tag == prefs.getString("translate.target." + book.id, "es") }
            .coerceAtLeast(0)
    ) }
    var translationScope by remember(book.id) { mutableIntStateOf(0) }
    var translated by remember(book.id) { mutableStateOf("") }
    var status by remember(book.id) { mutableStateOf("") }
    var error by remember(book.id) { mutableStateOf("") }
    var translating by remember(book.id) { mutableStateOf(false) }
    var actionJob by remember(book.id) { mutableStateOf<Job?>(null) }
    var exportContent by remember(book.id) { mutableStateOf("") }
    var audioExport by remember(book.id) { mutableStateOf<ByteArray?>(null) }
    var audioFormatIndex by remember(book.id) { mutableIntStateOf(0) }
    var completedAudioFormat by remember(book.id) {
        mutableStateOf(NativeGeminiAudioExport.Format.MP3)
    }
    var audioDaisyReady by remember(book.id) { mutableStateOf(false) }
    var audioExportBusy by remember(book.id) { mutableStateOf(false) }
    var showAudioExport by remember(book.id) { mutableStateOf(initialAudioExport) }
    var showOtherActions by remember(book.id) { mutableStateOf(false) }
    var audioVoice by remember(book.id) {
        mutableIntStateOf(NativeGeminiSpeech.voices.indexOf(
            prefs.getString("gemini.voice", "Kore")).coerceAtLeast(0))
    }
    val phononReady = remember(book.id) {
        NativePhononReader.isAvailable(context.applicationContext)
    }
    val phononVoices = remember(book.id, phononReady) {
        if (phononReady) NativePhononModelStore.voices(context) else emptyList()
    }
    val availableExportEngines = if (phononReady && phononVoices.isNotEmpty()) {
        listOf("Sistema", "Gemini", "Phonon")
    } else listOf("Sistema", "Gemini")
    var audioEngineIndex by remember(book.id) {
        mutableIntStateOf(prefs.getInt("engine." + book.id, 0)
            .coerceIn(0, availableExportEngines.lastIndex))
    }
    var phononVoiceIndex by remember(book.id) {
        mutableIntStateOf(
            phononVoices.indexOf(prefs.getString("phonon.voice", "default")).coerceAtLeast(0)
        )
    }
    var unit by remember(book.id) {
        mutableIntStateOf(prefs.getInt("unit." + book.id, prefs.getInt("unit", 1))
            .coerceIn(0, 2))
    }
    var autoPlay by remember(book.id) {
        mutableIntStateOf(prefs.getInt("autoplay." + book.id, -1).coerceIn(-1, 1) + 1)
    }

    fun labelFile(suffix: String): String {
        val clean = book.title.substringBeforeLast('.')
            .replace(Regex("[\\\\/:*?\"<>|\\p{Cntrl}]"), " ")
            .trim().take(90).ifBlank { "TifloLector" }
        return clean + "." + suffix
    }
    fun alert(message: String) { error = message; status = "" }
    fun startExport(uri: Uri, original: Boolean, body: String = "") {
        actionJob = scope.launch {
            try {
                withContext(Dispatchers.IO) {
                    val file = if (original) store.originalFile(book)
                        ?: throw IOException("No se conserva el archivo original.")
                    else if (body.isBlank()) store.textFile(book) else null
                    val output = context.contentResolver.openOutputStream(uri, "w")
                        ?: throw IOException("Android no concedió permiso para guardar el archivo.")
                    output.use { out ->
                        if (file != null) file.inputStream().use { input -> input.copyTo(out) }
                        else out.write(body.toByteArray(Charsets.UTF_8))
                    }
                }
                status = if (english) "File exported successfully."
                    else "Archivo exportado correctamente."
                error = ""
            } catch (e: Exception) {
                alert(e.message ?: "No se pudo exportar el archivo.")
            }
        }
    }
    fun saveGeneratedAudio(uri: Uri?) {
        val bytes = audioExport
        if (uri != null && bytes != null) {
            actionJob = scope.launch {
                try {
                    withContext(Dispatchers.IO) {
                        val stream = context.contentResolver.openOutputStream(uri, "w")
                            ?: throw IOException("No se pudo abrir el archivo de destino.")
                        stream.use { it.write(bytes) }
                    }
                    status = if (english) "Audio saved." else "Audio guardado."
                    error = ""
                } catch (e: Exception) {
                    alert(e.message ?: "No se pudo guardar el audio.")
                }
            }
        }
    }
    val exportAudioMP3 = rememberLauncherForActivityResult(
        ActivityResultContracts.CreateDocument("audio/mpeg")
    ) { uri -> saveGeneratedAudio(uri) }
    val exportAudioM4A = rememberLauncherForActivityResult(
        ActivityResultContracts.CreateDocument("audio/mp4")
    ) { uri -> saveGeneratedAudio(uri) }
    val exportAudioWAV = rememberLauncherForActivityResult(
        ActivityResultContracts.CreateDocument("audio/wav")
    ) { uri -> saveGeneratedAudio(uri) }
    val exportAudioDAISY = rememberLauncherForActivityResult(
        ActivityResultContracts.CreateDocument("application/zip")
    ) { uri -> saveGeneratedAudio(uri) }
    val exportOriginal = rememberLauncherForActivityResult(
        ActivityResultContracts.CreateDocument("application/octet-stream")
    ) { uri -> if (uri != null) startExport(uri, original = true) }
    val exportText = rememberLauncherForActivityResult(
        ActivityResultContracts.CreateDocument("text/plain")
    ) { uri ->
        if (uri != null) {
            val body = exportContent
            startExport(uri, original = false, body = body)
        }
    }

    fun shareText(text: String) {
        if (text.isBlank()) { alert("No hay texto para compartir."); return }
        if (text.length > 80000) {
            alert("El texto es demasiado extenso para compartirlo directamente. Exporta un TXT.")
            return
        }
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_TEXT, text)
            putExtra(Intent.EXTRA_SUBJECT, book.title)
        }
        try {
            context.startActivity(Intent.createChooser(intent,
                if (english) "Share text" else "Compartir texto"))
        } catch (e: Exception) {
            alert("No se pudo abrir el menú para compartir.")
        }
    }
    fun shareOriginal() {
        try {
            val file = store.originalFile(book)
                ?: throw IOException("No se conserva el archivo original.")
            val extension = file.extension.lowercase()
            val mime = MimeTypeMap.getSingleton().getMimeTypeFromExtension(extension)
                ?: "application/octet-stream"
            val uri = FileProvider.getUriForFile(
                context, context.packageName + ".readerprovider", file,
                labelFile(file.extension.ifBlank { book.format })
            )
            val intent = Intent(Intent.ACTION_SEND).apply {
                type = mime
                putExtra(Intent.EXTRA_STREAM, uri)
                clipData = ClipData.newUri(context.contentResolver, book.title, uri)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                putExtra(Intent.EXTRA_SUBJECT, book.title)
            }
            context.startActivity(Intent.createChooser(intent,
                if (english) "Share original file" else "Compartir archivo original"))
            error = ""
        } catch (e: Exception) {
            alert(e.message ?: "No se pudo compartir el archivo.")
        }
    }

    DisposableEffect(book.id) {
        onDispose { actionJob?.cancel() }
    }
    BackHandler { onBack() }
    Column(modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)) {
        TextButton(onClick = onBack) {
            Text(if (english) "Back to reading" else "Volver a la lectura")
        }
        Text(if (english) "Book details and tools" else "Detalles y herramientas",
            style = MaterialTheme.typography.headlineSmall,
            modifier = Modifier.semantics { heading() })
        Text(book.title)
        Button(onClick = { showAudioExport = !showAudioExport },
            modifier = Modifier.fillMaxWidth().semantics {
                stateDescription = if (showAudioExport)
                    (if (english) "Expanded" else "Abierto")
                else (if (english) "Collapsed" else "Cerrado")
            }) {
            Text(if (english) "Convert to audio or DAISY" else "Convertir a audio o DAISY")
        }
        if (showAudioExport) {
        Text(if (english) "Audio export" else "Exportar audio",
            style = MaterialTheme.typography.titleMedium,
            modifier = Modifier.semantics { heading() })
        ReaderAdjustableChoice(
            if (english) "Engine" else "Motor",
            if (english) availableExportEngines.map { if (it == "Sistema") "System" else it }
            else availableExportEngines, audioEngineIndex
        ) { index -> audioEngineIndex = index; audioExport = null }
        if (audioEngineIndex == 2 && phononReady && phononVoices.isNotEmpty()) {
            ReaderAdjustableChoice(
                if (english) "Voice" else "Voz",
                phononVoices, phononVoiceIndex
            ) { index ->
                phononVoiceIndex = index
                prefs.edit().putString("phonon.voice", phononVoices[index]).apply()
            }
        } else if (audioEngineIndex == 1) {
            ReaderAdjustableChoice(
                if (english) "Voice" else "Voz",
                NativeGeminiSpeech.voices, audioVoice
            ) { index ->
                audioVoice = index
                prefs.edit().putString("gemini.voice", NativeGeminiSpeech.voices[index]).apply()
            }
        } else {
            Text(if (english) "Uses the installed Android system voice. No Gemini key needed."
                else "Utiliza la voz instalada del sistema Android. No necesita clave Gemini.")
        }
        ReaderAdjustableChoice(
            if (english) "Format" else "Formato",
            listOf("MP3", "M4A", "WAV", "DAISY"), audioFormatIndex
        ) { audioFormatIndex = it; audioExport = null }
        if (audioFormatIndex == 3) {
            Text(if (english) "DAISY includes full text, synchronized clips and navigation. External-player compatibility is not yet validated."
                else "DAISY incluye texto, audio sincronizado e índice. La compatibilidad externa aún no está validada.")
        }
        Text(when (audioEngineIndex) {
            0 -> if (english) "Android system TTS exports locally if supported by the installed voice. Maximum 60,000 characters."
                else "La voz del sistema genera audio localmente si permite exportarlo. Máximo 60.000 caracteres."
            2 -> if (english) "Phonon generates audio on your device. Maximum 60,000 characters."
                else "Phonon genera el audio en el dispositivo. Máximo 60.000 caracteres."
            else -> if (english) "Gemini may use your personal quota. Maximum 60,000 characters."
                else "Gemini puede consumir tu cuota personal. Máximo 60.000 caracteres."
        })
        Button(enabled = !audioExportBusy, onClick = {
            audioExportBusy = true
            audioExport = null
            error = ""
            status = if (english) "Generating audio." else "Generando audio."
            actionJob = scope.launch {
                try {
                    val text = withContext(Dispatchers.IO) { store.read(book) }
                    val localPhonon = audioEngineIndex == 2 && phononReady
                    val systemTts = audioEngineIndex == 0
                    val voice = when {
                        localPhonon -> phononVoices[phononVoiceIndex]
                        systemTts -> prefs.getString("voice", "").orEmpty()
                        else -> NativeGeminiSpeech.voices[audioVoice]
                    }
                    val format = when (audioFormatIndex) {
                        0 -> NativeGeminiAudioExport.Format.MP3
                        1 -> NativeGeminiAudioExport.Format.M4A
                        else -> NativeGeminiAudioExport.Format.WAV
                    }
                    val wantsDaisy = audioFormatIndex == 3
                    audioExport = withContext(Dispatchers.IO) {
                        val notifyProgress: suspend (Int, Int) -> Unit = { n, total ->
                            withContext(Dispatchers.Main) {
                                status = (if (english) "Generating " else "Generando ") +
                                    n + " / " + total
                            }
                        }
                        if (systemTts) {
                            NativeSystemAudioSynth(context).use { synth ->
                                val render: suspend (String, String) -> ByteArray = {
                                    fragment, selected -> synth.render(fragment, selected)
                                }
                                if (wantsDaisy) NativeGeminiDaisyExport.generateWithSynthesizer(
                                    text, book.title, voice, notifyProgress, render
                                ) else NativeGeminiAudioExport.generateWithSynthesizer(
                                    context, text, voice, format, notifyProgress, render
                                )
                            }
                        } else if (localPhonon) {
                            NativePhononAudioSynth(context,
                                prefs.getString("phonon.language", "en") ?: "en").use { synth ->
                                val render: suspend (String, String) -> ByteArray = {
                                        fragment, selected -> synth.render(fragment, selected)
                                }
                                if (wantsDaisy) NativeGeminiDaisyExport.generateWithSynthesizer(
                                    text, book.title, voice, notifyProgress, render
                                ) else NativeGeminiAudioExport.generateWithSynthesizer(
                                    context, text, voice, format, notifyProgress, render
                                )
                            }
                        } else if (wantsDaisy) NativeGeminiDaisyExport.generate(
                            context, text, book.title, voice, notifyProgress
                        ) else NativeGeminiAudioExport.generate(
                            context, text, voice, format, notifyProgress
                        )
                    }
                    audioDaisyReady = wantsDaisy
                    completedAudioFormat = format
                    status = if (english) "Audio ready. Press Save."
                        else "Audio preparado. Pulsa Guardar."
                } catch (e: kotlinx.coroutines.CancellationException) {
                    status = if (english) "Cancelled." else "Cancelado."
                } catch (e: Exception) {
                    alert(e.message ?: "No se pudo generar el audio.")
                } finally {
                    audioExportBusy = false
                }
            }
        }, modifier = Modifier.fillMaxWidth()) {
            Text(if (english) "Generate" else "Generar")
        }
        if (audioExportBusy) {
            TextButton(onClick = { actionJob?.cancel() }) {
                Text(if (english) "Cancel" else "Cancelar")
            }
        }
        if (audioExport != null) {
            Button(onClick = {
                if (audioDaisyReady) exportAudioDAISY.launch(labelFile("zip"))
                else if (completedAudioFormat == NativeGeminiAudioExport.Format.MP3)
                    exportAudioMP3.launch(labelFile("mp3"))
                else if (completedAudioFormat == NativeGeminiAudioExport.Format.M4A)
                    exportAudioM4A.launch(labelFile("m4a"))
                else exportAudioWAV.launch(labelFile("wav"))
            },
                modifier = Modifier.fillMaxWidth()) {
                Text(if (english) "Save" else "Guardar")
            }
        }

        }
        TextButton(onClick = { showOtherActions = !showOtherActions },
            modifier = Modifier.fillMaxWidth().semantics {
                stateDescription = if (showOtherActions)
                    (if (english) "Expanded" else "Abierto")
                else (if (english) "Collapsed" else "Cerrado")
            }) {
            Text(if (english) "Other document tools" else "Otras herramientas del documento")
        }
        if (showOtherActions) {
        Text((if (english) "Original format: " else "Formato original: ") +
            book.format.uppercase())
        Text((if (english) "Text length: " else "Extensión de texto: ") +
            book.length + (if (english) " characters" else " caracteres"))
        if (book.tracks.isNotEmpty()) {
            Text((if (english) "Audio tracks: " else "Pistas de audio: ") +
                book.tracks.size)
        }
        Text((if (english) "Bookmarks: " else "Marcas: ") +
            (book.marks.size + book.audioMarks.size))

        NativeReaderAdvancedOcrPanel(book, store, english,
            onTextRefreshed = onOcrCompleted)

        Text(if (english) "Share and export" else "Compartir y exportar",
            style = MaterialTheme.typography.titleMedium,
            modifier = Modifier.semantics { heading() })
        Button(onClick = { shareOriginal() }, modifier = Modifier.fillMaxWidth()) {
            Text(if (english) "Share original file" else "Compartir archivo original")
        }
        Button(onClick = {
            error = ""
            val suffix = store.originalFile(book)?.extension?.ifBlank { book.format }
                ?: book.format
            exportOriginal.launch(labelFile(suffix))
        }, modifier = Modifier.fillMaxWidth()) {
            Text(if (english) "Save original file to…" else "Guardar original en…")
        }
        Button(onClick = {
            actionJob = scope.launch {
                try {
                    val text = withContext(Dispatchers.IO) { store.read(book) }
                    shareText(text)
                } catch (e: Exception) { alert(e.message.orEmpty()) }
            }
        }, modifier = Modifier.fillMaxWidth()) {
            Text(if (english) "Share extracted text" else "Compartir texto extraído")
        }
        Button(onClick = {
            exportContent = ""
            exportText.launch(labelFile("txt"))
        }, modifier = Modifier.fillMaxWidth()) {
            Text(if (english) "Export accessible TXT…" else "Exportar TXT accesible…")
        }

        Text(if (english) "Translation" else "Traducción",
            style = MaterialTheme.typography.titleMedium,
            modifier = Modifier.semantics { heading() })
        Text(if (english)
            "Models are downloaded on the first use. Translation happens on the device; the original is never changed. Review automated translations before using them."
            else "La primera traducción requiere descargar el modelo. Después, la traducción se realiza en el dispositivo y no modifica el original. Revisa el resultado automático antes de utilizarlo.")
        ReaderAdjustableChoice(if (english) "Source language" else "Idioma de origen",
            languages.map { it.label }, sourceIndex
        ) {
            sourceIndex = it
            prefs.edit().putString("translate.source." + book.id, languages[it].tag).apply()
        }
        ReaderAdjustableChoice(if (english) "Target language" else "Idioma de destino",
            languages.map { it.label }, targetIndex
        ) {
            targetIndex = it
            prefs.edit().putString("translate.target." + book.id, languages[it].tag).apply()
        }
        ReaderAdjustableChoice(if (english) "Translate" else "Traducir",
            if (english) listOf("Current fragment", "Entire document (max. 60,000 chars)")
            else listOf("Fragmento actual", "Documento completo (máx. 60.000 caracteres)"),
            translationScope
        ) { translationScope = it }
        Button(enabled = !translating, onClick = {
            translating = true
            error = ""
            translated = ""
            status = if (english) "Preparing translation…" else "Preparando traducción…"
            actionJob = scope.launch {
                try {
                    val input = if (translationScope == 0) fragment
                        else withContext(Dispatchers.IO) { store.read(book) }
                    val result = NativeReaderTranslation.translate(
                        input, languages[sourceIndex].tag, languages[targetIndex].tag
                    ) { n, total ->
                        status = (if (english) "Translating " else "Traduciendo ") +
                            n + " / " + total
                    }
                    translated = result
                    status = if (english) "Translation finished."
                        else "Traducción terminada."
                } catch (e: Exception) {
                    if (e !is kotlinx.coroutines.CancellationException)
                        alert(e.message ?: "No se pudo traducir.")
                } finally { translating = false }
            }
        }, modifier = Modifier.fillMaxWidth()) {
            Text(if (english) "Translate now" else "Traducir ahora")
        }
        if (translating) {
            TextButton(onClick = { actionJob?.cancel(); translating = false }) {
                Text(if (english) "Cancel translation" else "Cancelar traducción")
            }
        }
        if (translated.isNotBlank()) {
            Text(if (english) "Translated text" else "Texto traducido",
                style = MaterialTheme.typography.titleMedium,
                modifier = Modifier.semantics { heading() })
            androidx.compose.foundation.text.selection.SelectionContainer {
                Text(translated)
            }
            Button(onClick = { shareText(translated) },
                modifier = Modifier.fillMaxWidth()) {
                Text(if (english) "Share translation" else "Compartir traducción")
            }
            Button(onClick = {
                exportContent = translated
                exportText.launch(labelFile("traducido.txt"))
            }, modifier = Modifier.fillMaxWidth()) {
                Text(if (english) "Export translated TXT…" else "Exportar traducción como TXT…")
            }
        }

        Text(if (english) "Settings for this book" else "Ajustes de esta obra",
            style = MaterialTheme.typography.titleMedium,
            modifier = Modifier.semantics { heading() })
        Text(if (english)
            "Opening a document never starts speech. Use Play when you want to listen."
            else "Abrir un documento no inicia la voz. Utiliza Reproducir cuando quieras escuchar.")
        if (book.tracks.isEmpty()) {
            ReaderAdjustableChoice(
                if (english) "Navigation unit" else "Unidad de navegación",
                if (english) listOf("Block", "Paragraph", "Sentence")
                else listOf("Bloque", "Párrafo", "Frase"), unit
            ) {
                unit = it
                prefs.edit().putInt("unit." + book.id, it).apply()
                onUnitChange(it)
            }
        }
        Text(if (english)
            "Voice, speed and presentation settings are available in the Audio and Visual sections of the reader and are kept separately for this book."
            else "La voz, la velocidad y la presentación están en los apartados Audio y Visual del lector y se conservan por separado para esta obra.")
        }
        if (status.isNotBlank()) Text(status)
        if (error.isNotBlank()) Text(error)
    }
}
