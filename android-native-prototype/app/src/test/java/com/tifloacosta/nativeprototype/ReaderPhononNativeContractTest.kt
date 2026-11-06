package com.tifloacosta.nativeprototype

import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class ReaderPhononNativeContractTest {
    private fun source(filename: String) = File(
        "src/main/java/com/tifloacosta/nativeprototype/" + filename
    ).readText()

    @Test fun runtimeOnlyEnabledWithLibraryAndInstalledModel() {
        val runtime = source("NativePhononReader.kt")
        assertTrue(runtime.contains("NativePhononModelStore.installed(context)"))
        assertTrue(runtime.contains("System.loadLibrary(\"ptts_ffi\")"))
        assertTrue(runtime.contains("PhononTTS("))
        assertTrue(runtime.contains("AudioTrack(") || runtime.contains("AudioTrack.Builder()"))
        assertTrue(runtime.contains("phononReader"))
    }

    @Test fun phononReadingAndVoiceSelectionRemainExplicit() {
        val ui = source("NativeTifloLector.kt")
        val service = source("NativeReaderPlaybackService.kt")
        assertTrue(ui.contains("NativePhononReader.isAvailable"))
        assertTrue(ui.contains("listOf(\"Sistema\", \"Gemini\", \"Phonon\")"))
        assertTrue(service.contains("phononEnabled = chosenEngine == 2"))
        assertTrue(service.contains("phononReader?.pause()"))
        assertTrue(service.contains("phononReader?.stop()"))
        assertTrue(service.contains("if (playing && kind == \"text\" && !geminiEnabled && !phononEnabled)"))
    }

    @Test fun modelInstallationDoesNotRequireApiKeysOrBackups() {
        val model = source("NativePhononModelStore.kt")
        assertTrue(model.contains("context.noBackupFilesDir"))
        assertTrue(model.contains("old.renameTo(backup)"))
        assertTrue(model.contains("ZipInputStream"))
        assertTrue(model.contains("config.json"))
        assertTrue(model.contains("model.q8.gguf"))
        assertTrue(model.contains("tokenizer.json"))
        assertTrue(model.contains("fun voices(context: Context)"))
    }

    @Test fun offlineExportCanReuseModelForDaisyOrMp3() {
        val actions = source("NativeReaderDocumentActions.kt")
        val synth = source("NativePhononAudioSynth.kt")
        assertTrue(actions.contains("NativePhononAudioSynth(context"))
        assertTrue(actions.contains("NativeGeminiDaisyExport.generateWithSynthesizer"))
        assertTrue(actions.contains("NativeGeminiAudioExport.generateWithSynthesizer"))
        assertTrue(synth.contains("tts.speak(text)"))
    }
}
