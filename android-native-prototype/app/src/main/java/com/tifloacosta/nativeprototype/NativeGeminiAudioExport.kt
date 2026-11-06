package com.tifloacosta.nativeprototype

import android.content.Context
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.currentCoroutineContext
import java.io.ByteArrayOutputStream
import java.io.IOException

/** Full-document audio export via user-owned Gemini quota.
 * Guard against silent truncation and preserve the original library book.
 */
internal object NativeGeminiAudioExport {
    const val MAX_CHARACTERS = 60_000
    const val CHUNK_SIZE = 1_200

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
                         progress: suspend (Int, Int) -> Unit): ByteArray {
        val fragments = chunks(text)
        val combined = ByteArrayOutputStream()
        fragments.forEachIndexed { index, part ->
            currentCoroutineContext().ensureActive()
            if (part.isNotBlank()) {
                val audio = NativeGeminiSpeech.generate(context, part, voice)
                combined.write(pcm(audio))
            }
            progress(index + 1, fragments.size)
        }
        currentCoroutineContext().ensureActive()
        require(combined.size() > 0) { "No se recibió audio." }
        return wav(combined.toByteArray())
    }

    private fun wav(data: ByteArray, rate: Int = 24000): ByteArray {
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
}
