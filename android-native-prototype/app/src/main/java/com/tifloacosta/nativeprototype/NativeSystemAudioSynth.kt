package com.tifloacosta.nativeprototype

import android.content.Context
import android.os.Bundle
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import kotlinx.coroutines.suspendCancellableCoroutine
import java.io.File
import java.io.IOException
import java.util.Locale
import java.util.UUID
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

/**
 * Offline/on-device Android TTS export. The selected system speech engine must
 * support synthesizeToFile. Never record VoiceOver/TalkBack output.
 */
internal class NativeSystemAudioSynth(private val context: Context) : AutoCloseable {
    private var tts: TextToSpeech? = null

    suspend fun render(text: String, voice: String): ByteArray {
        val engine = tts ?: suspendCancellableCoroutine<TextToSpeech> { continuation ->
            var initialized: TextToSpeech? = null
            val created = TextToSpeech(context.applicationContext) { status ->
                if (!continuation.isActive) return@TextToSpeech
                if (status == TextToSpeech.SUCCESS) {
                    val ready = initialized
                    if (ready != null) continuation.resume(ready)
                    else continuation.resumeWithException(IOException("Android TTS no se inicializó correctamente."))
                } else continuation.resumeWithException(IOException("No se pudo inicializar la voz del sistema."))
            }
            initialized = created
            continuation.invokeOnCancellation { created.shutdown() }
        }.also { tts = it }

        val preferredName = voice.takeIf { it.isNotBlank() }
        preferredName?.let { name ->
            engine.voices?.firstOrNull { it.name == name }?.let { engine.voice = it }
        }
        if (engine.voice == null) engine.language = Locale.getDefault()
        val temp = File.createTempFile("tiflo-system-", ".wav", context.cacheDir)
        val utteranceId = UUID.randomUUID().toString()
        try {
            suspendCancellableCoroutine<Unit> { continuation ->
                engine.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                    override fun onStart(id: String?) {}
                    override fun onDone(id: String?) {
                        if (id == utteranceId && continuation.isActive) continuation.resume(Unit)
                    }
                    override fun onError(id: String?) {
                        if (id == utteranceId && continuation.isActive)
                            continuation.resumeWithException(IOException("El motor TTS no pudo generar el audio."))
                    }
                    override fun onError(id: String?, code: Int) { onError(id) }
                })
                continuation.invokeOnCancellation { engine.stop() }
                if (engine.synthesizeToFile(text, Bundle(), temp, utteranceId) != TextToSpeech.SUCCESS) {
                    if (continuation.isActive)
                        continuation.resumeWithException(IOException("Este motor Android no permite exportar voz a un archivo."))
                }
            }
            val result = temp.readBytes()
            require(result.size > 44 && result.copyOfRange(0, 4).toString(Charsets.US_ASCII) == "RIFF" &&
                result.copyOfRange(8, 12).toString(Charsets.US_ASCII) == "WAVE") {
                "El motor Android no devolvió un archivo WAV válido."
            }
            return result
        } finally {
            temp.delete()
        }
    }

    override fun close() {
        tts?.stop()
        tts?.shutdown()
        tts = null
    }
}
