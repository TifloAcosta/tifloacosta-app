package com.tifloacosta.nativeprototype

import android.content.Context
import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaFormat
import android.media.MediaMuxer
import java.io.File
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.currentCoroutineContext
import java.io.ByteArrayOutputStream
import java.io.IOException
import co.ntbl.lame.mp3.Lame
import co.ntbl.lame.mp3.MPEGMode

/** Full-document audio export via user-owned Gemini quota.
 * Guard against silent truncation and preserve the original library book.
 */
internal object NativeGeminiAudioExport {
    const val MAX_CHARACTERS = 60_000
    const val CHUNK_SIZE = 1_200
    enum class Format(val extension: String, val mime: String) {
        MP3("mp3", "audio/mpeg"),
        M4A("m4a", "audio/mp4"),
        WAV("wav", "audio/wav")
    }

    fun chunks(text: String): List<String> {
        require(text.isNotBlank()) { "El documento está vacío." }
        require(text.length <= MAX_CHARACTERS) {
            "El documento supera el límite de 60.000 caracteres."
        }
        val parts = mutableListOf<String>()
        var begin = 0
        while (begin < text.length) {
            var end = (begin + CHUNK_SIZE).coerceAtMost(text.length)
            if (end < text.length) {
                val boundary = (end - 1 downTo begin + CHUNK_SIZE / 2)
                    .firstOrNull { text[it] in ".!?\n " }
                if (boundary != null) end = boundary + 1
            }
            parts += text.substring(begin, end)
            begin = end
        }
        return parts
    }

    fun pcm(wav: ByteArray): ByteArray {
        require(wav.size >= 44 && String(wav, 0, 4, Charsets.US_ASCII) == "RIFF"
            && String(wav, 8, 4, Charsets.US_ASCII) == "WAVE") {
            "Gemini devolvió un archivo de audio incompatible."
        }
        var cursor = 12
        while (cursor + 8 <= wav.size) {
            val name = String(wav, cursor, 4, Charsets.US_ASCII)
            val size = (wav[cursor + 4].toInt() and 255) or
                ((wav[cursor + 5].toInt() and 255) shl 8) or
                ((wav[cursor + 6].toInt() and 255) shl 16) or
                ((wav[cursor + 7].toInt() and 255) shl 24)
            if (size < 0 || size > wav.size - cursor - 8)
                throw IOException("El audio recibido está incompleto.")
            if (name == "data") {
                if (size % 2 != 0) throw IOException("El audio tiene una longitud incorrecta.")
                return wav.copyOfRange(cursor + 8, cursor + 8 + size)
            }
            cursor += 8 + size + size % 2
        }
        throw IOException("No se ha encontrado el audio generado.")
    }

    suspend fun generate(context: Context, text: String, voice: String,
                         format: Format,
                         progress: suspend (Int, Int) -> Unit): ByteArray =
        generateWithSynthesizer(context, text, voice, format, progress) { fragment, chosen ->
            NativeGeminiSpeech.generate(context, fragment, chosen)
        }

    internal suspend fun generateWithSynthesizer(
        context: Context, text: String, voice: String, format: Format,
        progress: suspend (Int, Int) -> Unit,
        synthesize: suspend (String, String) -> ByteArray
    ): ByteArray {
        val fragments = chunks(text)
        val combined = ByteArrayOutputStream()
        fragments.forEachIndexed { index, part ->
            currentCoroutineContext().ensureActive()
            if (part.isNotBlank()) {
                val audio = synthesize(part, voice)
                combined.write(pcm(audio))
            }
            progress(index + 1, fragments.size)
        }
        currentCoroutineContext().ensureActive()
        require(combined.size() > 0) { "No se recibió audio." }
        val raw = combined.toByteArray()
        return when (format) {
            Format.WAV -> wav(raw)
            Format.M4A -> encodeAAC(context, raw)
            Format.MP3 -> encodeMP3(raw)
        }
    }

    internal fun wav(data: ByteArray, rate: Int = 24000): ByteArray {
        val out = ByteArrayOutputStream()
        fun word(value: Int) { for (i in 0..3) out.write((value ushr (8 * i)) and 255) }
        fun half(value: Int) { out.write(value and 255); out.write((value ushr 8) and 255) }
        out.write("RIFF".toByteArray(Charsets.US_ASCII))
        word(data.size + 36)
        out.write("WAVEfmt ".toByteArray(Charsets.US_ASCII))
        word(16); half(1); half(1)
        word(rate); word(rate * 2)
        half(2); half(16)
        out.write("data".toByteArray(Charsets.US_ASCII))
        word(data.size)
        out.write(data)
        return out.toByteArray()
    }
    /** Encode PCM as real MPEG Layer III, not a renamed WAV.
     * The 24 kHz mono samples are supported by LAME as MPEG-2 Layer III.
     */
    internal fun encodeMP3(pcm: ByteArray): ByteArray {
        require(pcm.size % 2 == 0) { "El audio PCM está incompleto." }
        val lame = Lame()
        val flags = lame.flags
        flags.inNumChannels = 1
        flags.inSampleRate = 24000
        flags.mode = MPEGMode.MONO
        flags.bitRate = 64
        flags.setWriteId3tagAutomatic(false)
        flags.setFindReplayGain(false)
        require(lame.initParams() >= 0) { "No se pudo iniciar el codificador MP3." }
        try {
            val output = ByteArrayOutputStream()
            val left = FloatArray(1152)
            val right = FloatArray(1152)
            var cursor = 0
            while (cursor < pcm.size) {
                val count = minOf(left.size, (pcm.size - cursor) / 2)
                for (i in 0 until count) {
                    val low = pcm[cursor + i * 2].toInt() and 255
                    val high = pcm[cursor + i * 2 + 1].toInt() shl 8
                    left[i] = ((high or low).toShort()).toFloat()
                }
                val buffer = ByteArray(16384)
                val encoded = lame.encodeBuffer(left, right, count, buffer)
                require(encoded >= 0) { "Error al codificar el MP3." }
                output.write(buffer, 0, encoded)
                cursor += count * 2
            }
            val last = ByteArray(16384)
            val finalSize = lame.encodeFlush(last)
            require(finalSize >= 0) { "No se pudo completar el MP3." }
            output.write(last, 0, finalSize)
            return output.toByteArray().also {
                require(it.size > 0) { "El MP3 generado está vacío." }
            }
        } finally {
            lame.close()
        }
    }

    private fun encodeAAC(context: Context, pcm: ByteArray): ByteArray {
        val audioFormat = MediaFormat.createAudioFormat(MediaFormat.MIMETYPE_AUDIO_AAC, 24000, 1)
        audioFormat.setInteger(MediaFormat.KEY_AAC_PROFILE,
            MediaCodecInfo.CodecProfileLevel.AACObjectLC)
        audioFormat.setInteger(MediaFormat.KEY_BIT_RATE, 64000)
        audioFormat.setInteger(MediaFormat.KEY_MAX_INPUT_SIZE, 32768)
        val file = File.createTempFile("tiflo-audio-", ".m4a", context.cacheDir)
        val codec = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_AUDIO_AAC)
        var muxer: MediaMuxer? = null
        var started = false
        try {
            codec.configure(audioFormat, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
            codec.start()
            val metadata = MediaCodec.BufferInfo()
            var offset = 0
            var inputFinished = false
            var outputFinished = false
            var track = -1
            while (!outputFinished) {
                if (!inputFinished) {
                    val slot = codec.dequeueInputBuffer(10000)
                    if (slot >= 0) {
                        val buffer = codec.getInputBuffer(slot)
                            ?: throw IOException("No se pudo acceder al codificador.")
                        buffer.clear()
                        val size = minOf(buffer.remaining(), pcm.size - offset)
                        val presentationTime = (offset.toLong() / 2L) * 1000000L / 24000L
                        if (size > 0) {
                            buffer.put(pcm, offset, size)
                            codec.queueInputBuffer(slot, 0, size, presentationTime, 0)
                            offset += size
                        } else {
                            codec.queueInputBuffer(slot, 0, 0, presentationTime,
                                MediaCodec.BUFFER_FLAG_END_OF_STREAM)
                            inputFinished = true
                        }
                    }
                }
                when (val slot = codec.dequeueOutputBuffer(metadata, 10000)) {
                    MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> {
                        if (started) throw IOException("Formato de audio inesperado.")
                        muxer = MediaMuxer(file.absolutePath,
                            MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
                        track = muxer!!.addTrack(codec.outputFormat)
                        muxer!!.start()
                        started = true
                    }
                    else -> if (slot >= 0) {
                        val data = codec.getOutputBuffer(slot)
                            ?: throw IOException("No se recibió audio codificado.")
                        if (metadata.size > 0 &&
                            metadata.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG == 0) {
                            if (!started) throw IOException("El archivo M4A no está preparado.")
                            data.position(metadata.offset)
                            data.limit(metadata.offset + metadata.size)
                            muxer!!.writeSampleData(track, data, metadata)
                        }
                        outputFinished = metadata.flags and
                            MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0
                        codec.releaseOutputBuffer(slot, false)
                    }
                }
            }
            if (!started) throw IOException("No se pudo codificar el audio.")
            muxer!!.stop()
            started = false
            return file.readBytes()
        } finally {
            try { if (started) muxer?.stop() } catch (_: Exception) {}
            try { muxer?.release() } catch (_: Exception) {}
            try { codec.stop() } catch (_: Exception) {}
            codec.release()
            file.delete()
        }
    }

}
