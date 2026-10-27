package com.tifloacosta.nativeprototype

import android.util.AtomicFile
import java.io.File
import java.io.IOException
import java.nio.charset.StandardCharsets

/**
 * Crash-safe metadata writes. AtomicFile recovers .bak/.new when Android loses
 * power or kills the process during a rename/write. Never silently initialize
 * an existing, invalid database as an empty library.
 */
object NativeReaderPersistence {
    private const val MAX_JSON_BYTES = 64 * 1024 * 1024
    val lock = Any()

    fun read(file: File): String? = synchronized(lock) {
        val backup = File(file.path + ".bak")
        if (!file.exists() && !backup.exists()) return@synchronized null
        try {
            val raw = AtomicFile(file).openRead().use { stream ->
                val buffer = ByteArray(8192)
                val collected = java.io.ByteArrayOutputStream()
                while (true) {
                    val length = stream.read(buffer)
                    if (length == -1) break
                    if (collected.size() + length > MAX_JSON_BYTES)
                        throw IOException("Los metadatos del lector superan el límite de seguridad.")
                    collected.write(buffer, 0, length)
                }
                collected.toByteArray()
            }
            val decoded = String(raw, StandardCharsets.UTF_8)
            // JSON parser throws if interrupted/corrupted, protecting original data.
            org.json.JSONArray(decoded)
            decoded
        } catch (e: Exception) {
            throw IOException(
                "No se pueden leer los datos del lector. No se borrará ni reiniciará la biblioteca. " +
                "Conserva los archivos y solicita una recuperación.", e
            )
        }
    }

    fun write(file: File, json: String) = synchronized(lock) {
        if (json.toByteArray(StandardCharsets.UTF_8).size > MAX_JSON_BYTES)
            throw IOException("El índice del lector supera el límite de seguridad.")
        org.json.JSONArray(json) // Reject malformed metadata before touching the previous file.
        val atomic = AtomicFile(file)
        var stream: java.io.FileOutputStream? = null
        try {
            stream = atomic.startWrite()
            stream.write(json.toByteArray(StandardCharsets.UTF_8))
            atomic.finishWrite(stream)
        } catch (e: Exception) {
            if (stream != null) atomic.failWrite(stream)
            throw IOException("No fue posible guardar los datos del lector. Se conservará la versión anterior.", e)
        }
    }
}
