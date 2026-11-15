package com.tifloacosta.nativeprototype

import android.content.Context
import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaFormat
import android.media.MediaMuxer
import java.io.File
import java.io.IOException
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive

/** One AAC encoder/muxer for the complete locally synthesized book.
 * Each source WAV is discarded after feeding PCM to the encoder.
 */
internal object NativeStreamingLocalM4a {
    private const val MAX_PCM_BYTES = 1024L * 1024L * 1024L
    private const val SAMPLE_RATE = 24000L

    suspend fun generate(
        context: Context,
        text: String,
        voice: String,
        progress: suspend (Int, Int) -> Unit,
        synthesize: suspend (String, String) -> ByteArray
    ): File {
        val total = NativeGeminiAudioExport.streamingChunks(text).count()
        val file = File.createTempFile("tiflo-generated-", ".m4a", context.cacheDir)
        var codec: MediaCodec? = null
        var muxer: MediaMuxer? = null
        var muxerStarted = false
        try {
            val format = MediaFormat.createAudioFormat(MediaFormat.MIMETYPE_AUDIO_AAC,
                SAMPLE_RATE.toInt(), 1).apply {
                setInteger(MediaFormat.KEY_AAC_PROFILE,
                    MediaCodecInfo.CodecProfileLevel.AACObjectLC)
                setInteger(MediaFormat.KEY_BIT_RATE, 64000)
                setInteger(MediaFormat.KEY_MAX_INPUT_SIZE, 32768)
            }
            val encoder = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_AUDIO_AAC)
            codec = encoder
            encoder.configure(format, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
            encoder.start()
            val info = MediaCodec.BufferInfo()
            var track = -1
            var samplesSubmitted = 0L
            var pcmBytes = 0L
            var ended = false

            fun drain(waitForEnd: Boolean) {
                var attempts = 0
                while (true) {
                    val slot = encoder.dequeueOutputBuffer(info, if (waitForEnd) 10000 else 0)
                    when (slot) {
                        MediaCodec.INFO_TRY_AGAIN_LATER -> {
                            if (!waitForEnd) return
                            if (++attempts > 2000)
                                throw IOException("No responde el codificador M4A.")
                        }
                        MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> {
                            if (muxerStarted) throw IOException("Formato M4A inesperado.")
                            val writer = MediaMuxer(file.absolutePath,
                                MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
                            muxer = writer
                            track = writer.addTrack(encoder.outputFormat)
                            writer.start()
                            muxerStarted = true
                        }
                        else -> if (slot >= 0) {
                            val data = encoder.getOutputBuffer(slot)
                                ?: throw IOException("No se recibió audio M4A.")
                            if (info.size > 0 &&
                                info.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG == 0) {
                                if (!muxerStarted) throw IOException("M4A sin pista de audio.")
                                data.position(info.offset)
                                data.limit(info.offset + info.size)
                                muxer!!.writeSampleData(track, data, info)
                            }
                            if (info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0)
                                ended = true
                            encoder.releaseOutputBuffer(slot, false)
                            if (ended) return
                        }
                    }
                }
            }

            fun feed(pcm: ByteArray, end: Boolean = false) {
                var position = 0
                do {
                    val slot = encoder.dequeueInputBuffer(10000)
                    if (slot < 0) {
                        drain(false)
                        continue
                    }
                    val input = encoder.getInputBuffer(slot)
                        ?: throw IOException("No se puede enviar audio al codificador.")
                    input.clear()
                    var count = minOf(input.remaining(), pcm.size - position)
                    count -= count % 2 // 16-bit mono samples cannot be split.
                    if (pcm.size > position && count == 0)
                        throw IOException("El codificador no admite muestras PCM de 16 bits.")
                    val isFinal = end && position + count >= pcm.size
                    if (count > 0) input.put(pcm, position, count)
                    encoder.queueInputBuffer(slot, 0, count,
                        samplesSubmitted * 1_000_000L / SAMPLE_RATE,
                        if (isFinal) MediaCodec.BUFFER_FLAG_END_OF_STREAM else 0)
                    position += count
                    samplesSubmitted += count / 2
                    drain(false)
                } while (position < pcm.size)
            }

            NativeGeminiAudioExport.streamingChunks(text).forEachIndexed { index, part ->
                currentCoroutineContext().ensureActive()
                if (part.isNotBlank()) {
                    val pcm = NativeGeminiAudioExport.pcm(synthesize(part, voice))
                    if (pcmBytes + pcm.size > MAX_PCM_BYTES)
                        throw IOException("El audio supera el espacio temporal permitido (1 GB).")
                    feed(pcm)
                    pcmBytes += pcm.size
                }
                progress(index + 1, total)
            }
            currentCoroutineContext().ensureActive()
            if (pcmBytes == 0L) throw IOException("No se recibió audio.")
            feed(ByteArray(0), end = true)
            drain(true)
            if (!ended || !muxerStarted) throw IOException("No se completó el audio M4A.")
            muxer!!.stop()
            muxerStarted = false
            return file
        } catch (failure: Exception) {
            file.delete()
            throw failure
        } finally {
            try { if (muxerStarted) muxer?.stop() } catch (_: Exception) {}
            try { muxer?.release() } catch (_: Exception) {}
            try { codec?.stop() } catch (_: Exception) {}
            try { codec?.release() } catch (_: Exception) {}
        }
    }
}
