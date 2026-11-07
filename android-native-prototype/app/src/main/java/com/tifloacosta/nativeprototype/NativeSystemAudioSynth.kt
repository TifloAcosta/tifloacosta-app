package com.tifloacosta.nativeprototype

import android.content.Context
import android.os.Bundle
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import java.io.File
import java.io.IOException
import java.util.Locale
import java.nio.ByteBuffer
import java.nio.ByteOrder
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
        val engine = tts ?: run {
            val initialized = CompletableDeferred<Int>()
            val created = TextToSpeech(context.applicationContext) { status ->
                initialized.complete(status)
            }
            try {
                if (initialized.await() != TextToSpeech.SUCCESS)
                    throw IOException("No se pudo inicializar la voz del sistema.")
                currentCoroutineContext().ensureActive()
                tts = created
                created
            } catch (error: Exception) {
                created.shutdown()
                throw error
            }
        }

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
            return normalizeWav(result)
        } finally {
            temp.delete()
        }
    }

    /**
     * DAISY and MP3 encoders expect 24 kHz mono PCM16. System engines commonly
     * output 16, 22.05 or 48 kHz WAV; convert rather than mislabel their audio.
     */
    private fun normalizeWav(wav: ByteArray): ByteArray {
        val buffer = ByteBuffer.wrap(wav).order(ByteOrder.LITTLE_ENDIAN)
        var cursor = 12
        var sampleRate = 0
        var channels = 0
        var bits = 0
        var format = 0
        var pcmOffset = -1
        var pcmLength = 0
        while (cursor + 8 <= wav.size) {
            val chunk = String(wav, cursor, 4, Charsets.US_ASCII)
            val length = buffer.getInt(cursor + 4)
            if (length < 0 || cursor + 8L + length > wav.size) break
            if (chunk == "fmt " && length >= 16) {
                format = buffer.getShort(cursor + 8).toInt() and 65535
                channels = buffer.getShort(cursor + 10).toInt() and 65535
                sampleRate = buffer.getInt(cursor + 12)
                bits = buffer.getShort(cursor + 22).toInt() and 65535
            } else if (chunk == "data") {
                pcmOffset = cursor + 8
                pcmLength = length
            }
            cursor += 8 + length + (length and 1)
        }
        if (format != 1 || channels !in 1..2 || bits != 16 ||
            sampleRate !in 8000..96000 || pcmOffset < 0) {
            throw IOException("La voz del sistema no generó audio PCM16 compatible.")
        }
        val frames = pcmLength / (channels * 2)
        if (frames == 0) throw IOException("El archivo TTS no contiene muestras.")
        fun read(frame: Int): Int {
            val f = frame.coerceIn(0, frames - 1)
            var sum = 0
            repeat(channels) { channel ->
                sum += buffer.getShort(pcmOffset + (f * channels + channel) * 2).toInt()
            }
            return sum / channels
        }
        val target = ((frames.toLong() * 24000) / sampleRate).toInt()
        val output = ByteBuffer.allocate(target * 2).order(ByteOrder.LITTLE_ENDIAN)
        repeat(target) { i ->
            val source = i.toDouble() * sampleRate / 24000
            val left = source.toInt().coerceIn(0, frames - 1)
            val weight = source - left
            val value = (read(left) * (1.0 - weight) + read(left + 1) * weight)
                .toInt().coerceIn(-32768, 32767)
            output.putShort(value.toShort())
        }
        return NativeGeminiAudioExport.wav(output.array())
    }

    override fun close() {
        tts?.stop()
        tts?.shutdown()
        tts = null
    }
}
