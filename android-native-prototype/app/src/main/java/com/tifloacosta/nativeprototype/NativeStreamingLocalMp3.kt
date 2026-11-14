package com.tifloacosta.nativeprototype

import android.content.Context
import co.ntbl.lame.mp3.Lame
import co.ntbl.lame.mp3.MPEGMode
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive

/** Long-document MP3 generation: one 1,200-character TTS fragment and one
 * encoder frame at a time. The intermediate PCM is never held for a book.
 */
internal object NativeStreamingLocalMp3 {
    private const val MAX_FILE_BYTES = 1024L * 1024L * 1024L

    suspend fun generate(
        context: Context,
        text: String,
        voice: String,
        progress: suspend (Int, Int) -> Unit,
        synthesize: suspend (String, String) -> ByteArray
    ): File {
        val total = NativeGeminiAudioExport.streamingChunks(text).count()
        val file = File.createTempFile("tiflo-generated-", ".mp3", context.cacheDir)
        val lame = Lame()
        try {
            val flags = lame.flags
            flags.inNumChannels = 1
            flags.inSampleRate = 24000
            flags.mode = MPEGMode.MONO
            flags.bitRate = 64
            flags.setWriteId3tagAutomatic(false)
            flags.setFindReplayGain(false)
            if (lame.initParams() < 0) throw IOException("No se pudo iniciar el codificador MP3.")

            var written = 0L
            var frames = 0L
            FileOutputStream(file).use { output ->
                fun write(bytes: ByteArray, count: Int) {
                    if (count < 0) throw IOException("Error al codificar el MP3.")
                    if (written + count > MAX_FILE_BYTES)
                        throw IOException("El MP3 supera el espacio temporal permitido (1 GB).")
                    output.write(bytes, 0, count)
                    written += count
                }
                val left = FloatArray(1152)
                val right = FloatArray(1152)
                val buffer = ByteArray(16384)
                NativeGeminiAudioExport.streamingChunks(text).forEachIndexed { index, part ->
                    currentCoroutineContext().ensureActive()
                    if (part.isNotBlank()) {
                        val pcm = NativeGeminiAudioExport.pcm(synthesize(part, voice))
                        var cursor = 0
                        while (cursor < pcm.size) {
                            currentCoroutineContext().ensureActive()
                            val count = minOf(left.size, (pcm.size - cursor) / 2)
                            for (i in 0 until count) {
                                val low = pcm[cursor + i * 2].toInt() and 255
                                val high = pcm[cursor + i * 2 + 1].toInt() shl 8
                                left[i] = (high or low).toShort().toFloat()
                            }
                            write(buffer, lame.encodeBuffer(left, right, count, buffer))
                            frames += count
                            cursor += count * 2
                        }
                    }
                    progress(index + 1, total)
                }
                currentCoroutineContext().ensureActive()
                if (frames == 0L) throw IOException("No se recibió audio.")
                val last = ByteArray(16384)
                write(last, lame.encodeFlush(last))
                if (written == 0L) throw IOException("El MP3 generado está vacío.")
            }
            return file
        } catch (failure: Exception) {
            file.delete()
            throw failure
        } finally {
            lame.close()
        }
    }
}
