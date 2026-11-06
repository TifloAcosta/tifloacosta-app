package com.tifloacosta.nativeprototype

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioTrack
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicInteger

/**
 * Optional, strictly offline Phonon CPU player.
 *
 * The official Kotlin JNA wrapper is installed separately from the matching
 * Rust .so; no missing native library may crash an ordinary TifloAcosta build.
 * One dedicated worker serializes Phonon model calls.
 */
internal class NativePhononReader(private val context: Context) : AutoCloseable {
    companion object {
        fun isAvailable(context: Context): Boolean {
            if (!NativePhononModelStore.installed(context)) return false
            return try {
                System.loadLibrary("ptts_ffi")
                true
            } catch (_: UnsatisfiedLinkError) {
                false
            } catch (_: SecurityException) {
                false
            }
        }
    }

    private val worker = Executors.newSingleThreadExecutor()
    private val sequence = AtomicInteger()
    @Volatile private var paused = false
    @Volatile private var closed = false
    @Volatile private var track: AudioTrack? = null
    private var synthesizer: PhononTTS? = null
    private var loadedLanguage = ""

    /**
     * Callback is made on worker thread; callers must marshal any UI updates.
     * Pausing waits before each audio write and keeps the current segment.
     */
    fun speak(text: String, voice: String, language: String = "en",
              completed: () -> Unit, error: (String) -> Unit) {
        require(text.isNotBlank()) { "No hay texto para leer." }
        val request = sequence.incrementAndGet()
        paused = false
        worker.execute {
            if (closed || request != sequence.get()) return@execute
            try {
                if (!isAvailable(context)) {
                    throw IllegalStateException("Falta el motor nativo o el modelo Phonon.")
                }
                // Avoid oversubscribing efficiency cores on phones.
                try { android.system.Os.setenv("RAYON_NUM_THREADS", "2", false) }
                catch (_: Exception) {}
                val model = synthesizer ?: PhononTTS(
                    NativePhononModelStore.directory(context).absolutePath, language
                ).also {
                    synthesizer = it
                    loadedLanguage = language
                }
                if (language != loadedLanguage) {
                    model.setLanguage(language)
                    loadedLanguage = language
                }
                if (voice.isNotBlank()) model.setVoice(voice)
                val bufferSize = AudioTrack.getMinBufferSize(
                    24000, AudioFormat.CHANNEL_OUT_MONO, AudioFormat.ENCODING_PCM_FLOAT)
                    .coerceAtLeast(24000)
                val audio = AudioTrack.Builder()
                    .setAudioAttributes(AudioAttributes.Builder()
                        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                        .setUsage(AudioAttributes.USAGE_MEDIA).build())
                    .setAudioFormat(AudioFormat.Builder()
                        .setSampleRate(24000)
                        .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                        .setEncoding(AudioFormat.ENCODING_PCM_FLOAT).build())
                    .setBufferSizeInBytes(bufferSize)
                    .setTransferMode(AudioTrack.MODE_STREAM)
                    .build()
                track = audio
                audio.play()
                var frames = 0L
                try {
                    model.speak(text) { pcm ->
                        while (paused && request == sequence.get() && !closed) {
                            Thread.sleep(30)
                        }
                        if (closed || request != sequence.get()) return@speak false
                        var offset = 0
                        while (offset < pcm.size && request == sequence.get() && !closed) {
                            val done = audio.write(pcm, offset, pcm.size - offset,
                                AudioTrack.WRITE_BLOCKING)
                            if (done <= 0) return@speak false
                            frames += done
                            offset += done
                        }
                        request == sequence.get() && !closed
                    }
                    // The last encoded audio may still be buffered in AudioTrack.
                    while (!closed && request == sequence.get() &&
                        audio.playbackHeadPosition.toLong() < frames) {
                        Thread.sleep(20)
                    }
                    if (!closed && request == sequence.get()) completed()
                } finally {
                    track = null
                    try { audio.pause() } catch (_: Exception) {}
                    try { audio.flush() } catch (_: Exception) {}
                    audio.release()
                }
            } catch (ex: Exception) {
                if (!closed && request == sequence.get())
                    error(ex.localizedMessage ?: "No se pudo reproducir Phonon.")
            }
        }
    }

    /**
     * Discard a cached native checkpoint after importing or removing a model.
     * All model operations stay serialized on the dedicated Phonon worker.
     */
    fun refreshModel() {
        if (closed) return
        stop()
        worker.execute {
            try { synthesizer?.close() } catch (_: Exception) {}
            synthesizer = null
            loadedLanguage = ""
        }
    }

    fun pause() {
        paused = true
        try { track?.pause() } catch (_: Exception) {}
    }

    fun resume() {
        paused = false
        try { track?.play() } catch (_: Exception) {}
    }

    fun stop() {
        sequence.incrementAndGet()
        paused = false
        try { track?.pause() } catch (_: Exception) {}
        try { track?.flush() } catch (_: Exception) {}
        try { track?.stop() } catch (_: Exception) {}
    }

    override fun close() {
        closed = true
        stop()
        worker.execute {
            try { synthesizer?.close() } catch (_: Exception) {}
            synthesizer = null
        }
        worker.shutdown()
    }
}
