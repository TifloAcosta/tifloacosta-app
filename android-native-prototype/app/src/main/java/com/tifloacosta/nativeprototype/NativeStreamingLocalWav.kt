package com.tifloacosta.nativeprototype

import android.content.Context
import java.io.File
import java.io.IOException
import java.io.RandomAccessFile
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive

/** Disk-backed synthesis for long documents with installed/local voices.
 * No character limit: only the WAV container and available disk space bound
 * output. A maximum temporary-file size prevents exhausting device storage.
 */
internal object NativeStreamingLocalWav {
    private const val MAX_PCM_BYTES = 1024L * 1024L * 1024L

    suspend fun generate(
        context: Context,
        text: String,
        voice: String,
        progress: suspend (Int, Int) -> Unit,
        synthesize: suspend (String, String) -> ByteArray
    ): File {
        val total = NativeGeminiAudioExport.streamingChunks(text).count()
        val file = File.createTempFile("tiflo-generated-", ".wav", context.cacheDir)
        try {
            RandomAccessFile(file, "rw").use { output ->
                output.setLength(0)
                output.write(ByteArray(44)) // Header is finalized after synthesis.
                var pcmBytes = 0L
                NativeGeminiAudioExport.streamingChunks(text).forEachIndexed { index, part ->
                    currentCoroutineContext().ensureActive()
                    if (part.isNotBlank()) {
                        val pcm = NativeGeminiAudioExport.pcm(synthesize(part, voice))
                        if (pcmBytes + pcm.size > MAX_PCM_BYTES)
                            throw IOException("El audio supera el espacio temporal permitido (1 GB).")
                        output.write(pcm)
                        pcmBytes += pcm.size
                    }
                    progress(index + 1, total)
                }
                currentCoroutineContext().ensureActive()
                if (pcmBytes == 0L) throw IOException("No se recibió audio.")
                output.seek(0)
                fun four(value: Long) {
                    for (i in 0..3) output.write(((value ushr (i * 8)) and 255).toInt())
                }
                fun two(value: Int) {
                    output.write(value and 255)
                    output.write((value ushr 8) and 255)
                }
                output.write("RIFF".toByteArray(Charsets.US_ASCII))
                four(36 + pcmBytes)
                output.write("WAVEfmt ".toByteArray(Charsets.US_ASCII))
                four(16); two(1); two(1)
                four(24000); four(48000)
                two(2); two(16)
                output.write("data".toByteArray(Charsets.US_ASCII))
                four(pcmBytes)
            }
            return file
        } catch (failure: Exception) {
            file.delete()
            throw failure
        }
    }
}
