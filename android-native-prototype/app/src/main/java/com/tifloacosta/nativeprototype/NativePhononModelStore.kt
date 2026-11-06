package com.tifloacosta.nativeprototype

import android.content.Context
import android.net.Uri
import java.io.File
import java.io.IOException
import java.util.UUID
import java.util.zip.ZipInputStream

/**
 * Installs a user-supplied Phonon CPU checkpoint ZIP into private app storage.
 * No provider credentials, remote code or models are bundled in TifloAcosta.
 * The archive must contain config.json, tokenizer.json, model weights, and a voice.
 */
internal object NativePhononModelStore {
    fun directory(context: Context) = File(context.noBackupFilesDir, "phonon/cpu-model")
    fun installed(context: Context): Boolean = valid(directory(context))
    fun voices(context: Context): List<String> {
        val dir = directory(context)
        if (!valid(dir)) return emptyList()
        val found = mutableSetOf<String>()
        if (File(dir, "default-voice.safetensors").isFile) found += "default"
        for (folder in listOf("voices", "embeddings")) {
            File(dir, folder).listFiles()?.filter {
                it.isFile && it.extension == "safetensors"
            }?.forEach { found += it.nameWithoutExtension }
        }
        return found.sorted()
    }

    private fun valid(dir: File): Boolean {
        if (!dir.isDirectory) return false
        val config = File(dir, "config.json")
        val tokenizer = File(dir, "tokenizer.json")
        val weights = listOf("model.q8.gguf", "model.safetensors")
            .any { File(dir, it).isFile }
        val voice = File(dir, "default-voice.safetensors").isFile ||
            listOf("voices", "embeddings").any { folder ->
                File(dir, folder).listFiles()?.any {
                    it.isFile && it.extension == "safetensors"
                } == true
            }
        return config.isFile && tokenizer.isFile && weights && voice
    }

    /**
     * Streaming extraction limits malicious/corrupted archives; old models are
     * kept until a complete new checkpoint has been extracted and inspected.
     */
    fun importZip(context: Context, source: Uri): File {
        val parent = File(context.noBackupFilesDir, "phonon")
        check(parent.exists() || parent.mkdirs()) { "No se pudo crear la carpeta de Phonon." }
        val staging = File(parent, "model-partial-" + UUID.randomUUID())
        val incoming = File(staging, "unpacked")
        if (!incoming.mkdirs()) throw IOException("No se pudo preparar el modelo.")
        val old = directory(context)
        val backup = File(parent, "model-previous-" + UUID.randomUUID())
        try {
            val input = context.contentResolver.openInputStream(source)
                ?: throw IOException("No se pudo abrir el archivo del modelo.")
            var entries = 0
            var expanded = 0L
            ZipInputStream(input.buffered()).use { zip ->
                while (true) {
                    val entry = zip.nextEntry ?: break
                    val path = entry.name.replace('\\', '/')
                    val parts = path.split('/').filter { it.isNotBlank() }
                    if (parts.isEmpty()) continue
                    if (path.startsWith('/') || parts.any { it == "." || it == ".." } ||
                        path.contains('\u0000') || entries++ > 2048) {
                        throw IOException("El ZIP del modelo contiene rutas no permitidas.")
                    }
                    val destination = File(incoming, parts.joinToString("/"))
                    if (!destination.canonicalPath.startsWith(incoming.canonicalPath + "/")) {
                        throw IOException("Ruta de modelo no permitida.")
                    }
                    if (entry.isDirectory) {
                        if (!destination.isDirectory && !destination.mkdirs())
                            throw IOException("No se pudo crear la carpeta del modelo.")
                    } else {
                        if (!destination.parentFile!!.isDirectory &&
                            !destination.parentFile!!.mkdirs())
                            throw IOException("No se pudo crear la carpeta del modelo.")
                        destination.outputStream().buffered().use { output ->
                            val buf = ByteArray(64 * 1024)
                            while (true) {
                                val n = zip.read(buf)
                                if (n < 0) break
                                expanded += n
                                if (expanded > 512L * 1024 * 1024)
                                    throw IOException("El ZIP del modelo supera 512 MB.")
                                output.write(buf, 0, n)
                            }
                        }
                    }
                    zip.closeEntry()
                }
            }
            // Accept archives rooted directly at the checkpoint or with one
            // enclosing folder (as exported by common Hugging Face tools).
            var root = incoming
            if (!valid(root)) {
                val candidates = incoming.listFiles()?.filter { it.isDirectory }.orEmpty()
                if (candidates.size != 1 || !valid(candidates.single())) {
                    throw IOException("El ZIP no contiene un modelo Phonon CPU completo.")
                }
                root = candidates.single()
            }
            if (old.exists() && !old.renameTo(backup)) {
                throw IOException("No se pudo conservar el modelo anterior.")
            }
            if (!root.renameTo(old)) {
                if (backup.exists()) backup.renameTo(old)
                throw IOException("No se pudo instalar el modelo Phonon.")
            }
            backup.deleteRecursively()
            return old
        } finally {
            staging.deleteRecursively()
        }
    }

    fun remove(context: Context): Boolean {
        val dir = directory(context)
        return !dir.exists() || dir.deleteRecursively()
    }
}
