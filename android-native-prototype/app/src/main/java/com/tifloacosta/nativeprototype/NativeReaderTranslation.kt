package com.tifloacosta.nativeprototype

import com.google.mlkit.common.model.DownloadConditions
import com.google.mlkit.nl.translate.TranslateLanguage
import com.google.mlkit.nl.translate.Translation
import com.google.mlkit.nl.translate.TranslatorOptions
import kotlinx.coroutines.tasks.await
import java.io.IOException

data class ReaderTranslationLanguage(val label: String, val tag: String)

/** A small, explicit language list avoids unreliable automatic source guessing. */
object NativeReaderTranslation {
    val languages = listOf(
        ReaderTranslationLanguage("Español", "es"),
        ReaderTranslationLanguage("English", "en"),
        ReaderTranslationLanguage("Português", "pt"),
        ReaderTranslationLanguage("Français", "fr"),
        ReaderTranslationLanguage("Deutsch", "de"),
        ReaderTranslationLanguage("Italiano", "it"),
        ReaderTranslationLanguage("Polski", "pl"),
        ReaderTranslationLanguage("العربية", "ar"),
        ReaderTranslationLanguage("日本語", "ja"),
        ReaderTranslationLanguage("中文", "zh"),
        ReaderTranslationLanguage("हिन्दी", "hi")
    )
    const val MAX_DOCUMENT_CHARS = 60000
    private const val MAX_CHUNK_CHARS = 1200

    fun chunks(text: String, max: Int = MAX_CHUNK_CHARS): List<String> {
        require(max in 100..2000)
        if (text.isBlank()) return emptyList()
        val segments = mutableListOf<String>()
        var cursor = 0
        while (cursor < text.length) {
            var end = minOf(cursor + max, text.length)
            if (end < text.length) {
                val boundary = text.lastIndexOfAny(charArrayOf('\n', '.', '!', '?', ' '), end - 1)
                if (boundary > cursor + max / 2) end = boundary + 1
            }
            if (end <= cursor) end = minOf(cursor + max, text.length)
            segments.add(text.substring(cursor, end))
            cursor = end
        }
        return segments
    }

    /** ML Kit on-device translation. Models download only after explicit user action. */
    suspend fun translate(
        text: String, source: String, destination: String,
        onProgress: (Int, Int) -> Unit
    ): String {
        if (text.isBlank()) throw IOException("No hay texto que traducir.")
        if (text.length > MAX_DOCUMENT_CHARS) throw IOException(
            "El documento supera 60.000 caracteres. Traduce el fragmento actual."
        )
        if (source == destination) throw IOException("Selecciona dos idiomas diferentes.")
        val src = TranslateLanguage.fromLanguageTag(source)
            ?: throw IOException("No se reconoce el idioma de origen.")
        val dst = TranslateLanguage.fromLanguageTag(destination)
            ?: throw IOException("No se reconoce el idioma de destino.")
        val client = Translation.getClient(TranslatorOptions.Builder()
            .setSourceLanguage(src).setTargetLanguage(dst).build())
        return try {
            // First translation requires an internet connection to fetch an ML Kit model.
            // Subsequent translations can use the installed model offline.
            client.downloadModelIfNeeded(DownloadConditions.Builder().build()).await()
            val segments = chunks(text)
            val result = StringBuilder()
            for ((i, segment) in segments.withIndex()) {
                val translated = client.translate(segment).await()
                result.append(translated)
                onProgress(i + 1, segments.size)
            }
            result.toString()
        } catch (e: Exception) {
            if (e is kotlinx.coroutines.CancellationException) throw e
            throw IOException("No se pudo completar la traducción. Comprueba la conexión para descargar el modelo.", e)
        } finally {
            client.close()
        }
    }
}
