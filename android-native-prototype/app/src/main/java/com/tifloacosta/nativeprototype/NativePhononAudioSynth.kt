package com.tifloacosta.nativeprototype

import android.content.Context
import java.io.ByteArrayOutputStream
import java.io.Closeable
import java.io.IOException

/**
 * A model stays loaded for the entire export. Unlike the foreground reader,
 * this writes PCM/WAV to memory without touching an AudioTrack or Internet.
 */
internal class NativePhononAudioSynth(context: Context, language: String = "en") : Closeable {
    private val tts: PhononTTS

    init {
        if (!NativePhononReader.isAvailable(context)) {
            throw IOException("Falta el motor nativo Phonon o su modelo.")
        }
        try { android.system.Os.setenv("RAYON_NUM_THREADS", "2", false) }
        catch (_: Exception) {}
        tts = PhononTTS(NativePhononModelStore.directory(context).absolutePath, language)
    }

    val voices: List<String> get() = tts.voices

    fun render(text: String, voice: String): ByteArray {
        if (voice.isNotBlank()) tts.setVoice(voice)
        val pcm = ByteArrayOutputStream()
        tts.speak(text) { samples ->
            // 24 kHz mono floating PCM from Phonon -> signed LE 16-bit WAV.
            for (sample in samples) {
                val clamped = sample.coerceIn(-1f, 1f)
                val value = (clamped * 32767).toInt().coerceIn(-32768, 32767)
                pcm.write(value and 255)
                pcm.write((value ushr 8) and 255)
            }
            if (pcm.size() > 24_000 * 2 * 60 * 10)
                throw IOException("Un fragmento de audio supera diez minutos.")
            true
        }
        if (pcm.size() == 0) throw IOException("Phonon no ha generado audio.")
        return NativeGeminiAudioExport.wav(pcm.toByteArray())
    }

    override fun close() { tts.close() }
}
