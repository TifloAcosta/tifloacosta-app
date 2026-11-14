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
    val uiLanguage = LocalNativeUiLanguage.current
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
    var audioExportFile by remember(book.id) { mutableStateOf<java.io.File?>(null) }
    DisposableEffect(audioExportFile) {
        val staged = audioExportFile
        onDispose { staged?.delete() }
    }
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
                status = NativeReaderToolsStrings.get(uiLanguage, "fileExported")
                error = ""
            } catch (e: Exception) {
                alert(e.message ?: "No se pudo exportar el archivo.")
            }
        }
    }
    fun saveGeneratedAudio(uri: Uri?) {
        val bytes = audioExport
        val file = audioExportFile
        if (uri == null) {
            if (audioExport != null || audioExportFile != null) {
                status = NativeReaderToolsStrings.get(uiLanguage, "audioLater")
            }
            return
        }
        if (bytes != null || file != null) {
            actionJob = scope.launch {
                try {
                    withContext(Dispatchers.IO) {
                        val stream = context.contentResolver.openOutputStream(uri, "w")
                            ?: throw IOException("No se pudo abrir el archivo de destino.")
                        stream.use { output ->
                            if (file != null) {
                                file.inputStream().use { input -> input.copyTo(output) }
                            } else if (bytes != null) output.write(bytes)
                        }
                    }
                    status = NativeReaderToolsStrings.get(uiLanguage, "audioSaved")
                    error = ""
                } catch (e: Exception) {
                    // A partial MP3/DAISY is worse than no file; keep the
                    // finished conversion available for another save attempt.
                    try { context.contentResolver.delete(uri, null, null) }
                    catch (_: Exception) { /* Some providers do not support deletion. */ }
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
                NativeReaderToolsStrings.get(uiLanguage, "shareTextChooser")))
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
                NativeReaderToolsStrings.get(uiLanguage, "shareOriginalChooser")))
            error = ""
        } catch (e: Exception) {
            alert(e.message ?: "No se pudo compartir el archivo.")
        }
    }

    DisposableEffect(book.id) {
        onDispose { actionJob?.cancel() }
    }
    fun backFromTools() {
        if (showAudioExport || showOtherActions) {
            showAudioExport = false
            showOtherActions = false
        } else onBack()
    }
    BackHandler { backFromTools() }
    Column(modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)) {
        TextButton(onClick = { backFromTools() }) {
            Text(if (showAudioExport || showOtherActions) NativeUiText.get(uiLanguage, "back")
                else NativeReaderToolsStrings.get(uiLanguage, "backReading"))
        }
        Text(NativeReaderToolsStrings.get(uiLanguage,
            if (showAudioExport) "audioExport" else if (showOtherActions) "otherTools" else "toolsTitle"),
            style = MaterialTheme.typography.headlineSmall,
            modifier = Modifier.semantics { heading() })
        if (!showAudioExport && !showOtherActions) {
        Text(book.title)
        Button(onClick = { showAudioExport = true }, modifier = Modifier.fillMaxWidth()) {
            Text(NativeReaderToolsStrings.get(uiLanguage, "convert"))
        }
        TextButton(onClick = { showOtherActions = true }, modifier = Modifier.fillMaxWidth()) {
            Text(NativeReaderToolsStrings.get(uiLanguage, "otherTools"))
        }
        }
        if (showAudioExport) {
        ReaderAdjustableChoice(
            NativeReaderToolsStrings.get(uiLanguage, "engine"),
            availableExportEngines.map {
                if (it == "Sistema") NativeReaderToolsStrings.get(uiLanguage, "systemEngine") else it
            }, audioEngineIndex
        ) { index -> audioEngineIndex = index; audioExport = null; audioExportFile = null }
        if (audioEngineIndex == 2 && phononReady && phononVoices.isNotEmpty()) {
            ReaderAdjustableChoice(
                NativeReaderToolsStrings.get(uiLanguage, "voice"),
                phononVoices, phononVoiceIndex
            ) { index ->
                phononVoiceIndex = index
                prefs.edit().putString("phonon.voice", phononVoices[index]).apply()
            }
        } else if (audioEngineIndex == 1) {
            ReaderAdjustableChoice(
                NativeReaderToolsStrings.get(uiLanguage, "voice"),
                NativeGeminiSpeech.voices, audioVoice
            ) { index ->
                audioVoice = index
                prefs.edit().putString("gemini.voice", NativeGeminiSpeech.voices[index]).apply()
            }
        } else {
            Text(NativeReaderToolsStrings.get(uiLanguage, "systemVoice"))
        }
        ReaderAdjustableChoice(
            NativeReaderToolsStrings.get(uiLanguage, "format"),
            listOf("MP3", "M4A", "WAV", "DAISY"), audioFormatIndex
        ) { audioFormatIndex = it; audioExport = null; audioExportFile = null }
        if (audioFormatIndex == 3) {
            Text(NativeReaderToolsStrings.get(uiLanguage, "daisyNote"))
        }
        Text(NativeReaderToolsStrings.get(uiLanguage, when (audioEngineIndex) {
            0 -> "systemExportNote"
            2 -> "phononExportNote"
            else -> "geminiExportNote"
        }))
        Button(enabled = !audioExportBusy, onClick = {
            audioExportBusy = true
            audioExport = null
            audioExportFile = null
            error = ""
            status = NativeReaderToolsStrings.get(uiLanguage, "generating")
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
                    val localStreaming = systemTts || localPhonon
                    if (localStreaming) {
                        audioExportFile = withContext(Dispatchers.IO) {
                            val notifyProgress: suspend (Int, Int) -> Unit = { n, total ->
                                withContext(Dispatchers.Main) {
                                    status = NativeReaderToolsStrings.get(uiLanguage, "generatingProgress") + " " + n + " / " + total
                                }
                            }
                            val generateLocal: suspend (suspend (String, String) -> ByteArray) -> java.io.File = { render ->
                                if (wantsDaisy)
                                    NativeGeminiDaisyExport.generateToFile(context, text, book.title, voice, notifyProgress, render)
                                else if (format == NativeGeminiAudioExport.Format.MP3)
                                    NativeStreamingLocalMp3.generate(context, text, voice, notifyProgress, render)
                                else if (format == NativeGeminiAudioExport.Format.M4A)
                                    NativeStreamingLocalM4a.generate(context, text, voice, notifyProgress, render)
                                else NativeStreamingLocalWav.generate(context, text, voice, notifyProgress, render)
                            }
                            if (systemTts) NativeSystemAudioSynth(context).use { synth ->
                                generateLocal { part, selected -> synth.render(part, selected) }
                            } else NativePhononAudioSynth(context,
                                prefs.getString("phonon.language", "en") ?: "en").use { synth ->
                                generateLocal { part, selected -> synth.render(part, selected) }
                            }
                        }
                    } else {
                    audioExport = withContext(Dispatchers.IO) {
                        val notifyProgress: suspend (Int, Int) -> Unit = { n, total ->
                            withContext(Dispatchers.Main) {
                                status = NativeReaderToolsStrings.get(uiLanguage, "generatingProgress") + " " +
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
                    }
                    audioDaisyReady = wantsDaisy
                    completedAudioFormat = format
                    status = NativeReaderToolsStrings.get(uiLanguage, "ready")
                } catch (e: kotlinx.coroutines.CancellationException) {
                    status = NativeReaderToolsStrings.get(uiLanguage, "cancelled")
                } catch (e: Exception) {
                    alert(e.message ?: "No se pudo generar el audio.")
                } finally {
                    audioExportBusy = false
                }
            }
        }, modifier = Modifier.fillMaxWidth()) {
            Text(NativeReaderToolsStrings.get(uiLanguage, "generate"))
        }
        if (audioExportBusy) {
            TextButton(onClick = { actionJob?.cancel() }) {
                Text(NativeReaderToolsStrings.get(uiLanguage, "cancel"))
            }
        }
        if (audioExport != null || audioExportFile != null) {
            Button(onClick = {
                if (audioDaisyReady) exportAudioDAISY.launch(labelFile("zip"))
                else if (completedAudioFormat == NativeGeminiAudioExport.Format.MP3)
                    exportAudioMP3.launch(labelFile("mp3"))
                else if (completedAudioFormat == NativeGeminiAudioExport.Format.M4A)
                    exportAudioM4A.launch(labelFile("m4a"))
                else exportAudioWAV.launch(labelFile("wav"))
            },
                modifier = Modifier.fillMaxWidth()) {
                Text(NativeReaderToolsStrings.get(uiLanguage, "save"))
            }
        }

        }
        if (showOtherActions) {
        Text(NativeReaderToolsStrings.get(uiLanguage, "originalFormat") + ": " +
            book.format.uppercase())
        Text(NativeReaderToolsStrings.get(uiLanguage, "textLength") + ": " +
            book.length + " " + NativeReaderToolsStrings.get(uiLanguage, "characters"))
        if (book.tracks.isNotEmpty()) {
            Text(NativeReaderToolsStrings.get(uiLanguage, "audioTracks") + ": " +
                book.tracks.size)
        }
        Text(NativeReaderToolsStrings.get(uiLanguage, "marks") + ": " +
            (book.marks.size + book.audioMarks.size))

        NativeReaderAdvancedOcrPanel(book, store, english,
            onTextRefreshed = onOcrCompleted)

        Text(NativeReaderToolsStrings.get(uiLanguage, "shareExport"),
            style = MaterialTheme.typography.titleMedium,
            modifier = Modifier.semantics { heading() })
        Button(onClick = { shareOriginal() }, modifier = Modifier.fillMaxWidth()) {
            Text(NativeReaderToolsStrings.get(uiLanguage, "shareOriginal"))
        }
        Button(onClick = {
            error = ""
            val suffix = store.originalFile(book)?.extension?.ifBlank { book.format }
                ?: book.format
            exportOriginal.launch(labelFile(suffix))
        }, modifier = Modifier.fillMaxWidth()) {
            Text(NativeReaderTranslationStrings.get(uiLanguage, "saveOriginal"))
        }
        Button(onClick = {
            actionJob = scope.launch {
                try {
                    val text = withContext(Dispatchers.IO) { store.read(book) }
                    shareText(text)
                } catch (e: Exception) { alert(e.message.orEmpty()) }
            }
        }, modifier = Modifier.fillMaxWidth()) {
            Text(NativeReaderTranslationStrings.get(uiLanguage, "shareText"))
        }
        Button(onClick = {
            exportContent = ""
            exportText.launch(labelFile("txt"))
        }, modifier = Modifier.fillMaxWidth()) {
            Text(NativeReaderTranslationStrings.get(uiLanguage, "exportTxt"))
        }

        Text(NativeReaderTranslationStrings.get(uiLanguage, "translation"),
            style = MaterialTheme.typography.titleMedium,
            modifier = Modifier.semantics { heading() })
        Text(NativeReaderTranslationStrings.get(uiLanguage, "help"))
        ReaderAdjustableChoice(NativeReaderTranslationStrings.get(uiLanguage, "source"),
            languages.map { it.label }, sourceIndex
        ) {
            sourceIndex = it
            prefs.edit().putString("translate.source." + book.id, languages[it].tag).apply()
        }
        ReaderAdjustableChoice(NativeReaderTranslationStrings.get(uiLanguage, "target"),
            languages.map { it.label }, targetIndex
        ) {
            targetIndex = it
            prefs.edit().putString("translate.target." + book.id, languages[it].tag).apply()
        }
        ReaderAdjustableChoice(NativeReaderTranslationStrings.get(uiLanguage, "scope"),
            NativeReaderTranslationStrings.scopeChoices(uiLanguage),
            translationScope
        ) { translationScope = it }
        Button(enabled = !translating, onClick = {
            translating = true
            error = ""
            translated = ""
            status = NativeReaderTranslationStrings.get(uiLanguage, "preparing")
            actionJob = scope.launch {
                try {
                    val input = if (translationScope == 0) fragment
                        else withContext(Dispatchers.IO) { store.read(book) }
                    val result = NativeReaderTranslation.translate(
                        input, languages[sourceIndex].tag, languages[targetIndex].tag
                    ) { n, total ->
                        status = NativeReaderTranslationStrings.get(uiLanguage, "translating") +
                            n + " / " + total
                    }
                    translated = result
                    status = NativeReaderTranslationStrings.get(uiLanguage, "done")
                } catch (e: Exception) {
                    if (e !is kotlinx.coroutines.CancellationException)
                        alert(e.message ?: NativeReaderTranslationStrings.get(uiLanguage, "error"))
                } finally { translating = false }
            }
        }, modifier = Modifier.fillMaxWidth()) {
            Text(NativeReaderTranslationStrings.get(uiLanguage, "translateNow"))
        }
        if (translating) {
            TextButton(onClick = { actionJob?.cancel(); translating = false }) {
                Text(NativeReaderTranslationStrings.get(uiLanguage, "cancel"))
            }
        }
        if (translated.isNotBlank()) {
            Text(NativeReaderTranslationStrings.get(uiLanguage, "translated"),
                style = MaterialTheme.typography.titleMedium,
                modifier = Modifier.semantics { heading() })
            androidx.compose.foundation.text.selection.SelectionContainer {
                Text(translated)
            }
            Button(onClick = { shareText(translated) },
                modifier = Modifier.fillMaxWidth()) {
                Text(NativeReaderTranslationStrings.get(uiLanguage, "share"))
            }
            Button(onClick = {
                exportContent = translated
                exportText.launch(labelFile("traducido.txt"))
            }, modifier = Modifier.fillMaxWidth()) {
                Text(NativeReaderTranslationStrings.get(uiLanguage, "exportTranslated"))
            }
        }

        Text(NativeReaderTranslationStrings.get(uiLanguage, "bookSettings"),
            style = MaterialTheme.typography.titleMedium,
            modifier = Modifier.semantics { heading() })
        Text(NativeReaderTranslationStrings.get(uiLanguage, "opening"))
        if (book.tracks.isEmpty()) {
            ReaderAdjustableChoice(
                NativeReaderTranslationStrings.get(uiLanguage, "unit"),
                NativeReaderTranslationStrings.navigationChoices(uiLanguage), unit
            ) {
                unit = it
                prefs.edit().putInt("unit." + book.id, it).apply()
                onUnitChange(it)
            }
        }
        Text(NativeReaderTranslationStrings.get(uiLanguage, "voiceSettings"))
        }
        if (status.isNotBlank()) Text(status)
        if (error.isNotBlank()) Text(error)
    }
}
