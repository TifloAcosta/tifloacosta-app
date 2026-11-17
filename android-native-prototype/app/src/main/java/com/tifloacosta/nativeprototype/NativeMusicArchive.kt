package com.tifloacosta.nativeprototype

import android.content.Context
import android.net.Uri
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.UUID
import java.util.zip.ZipEntry
import java.util.zip.ZipInputStream
import java.util.zip.ZipOutputStream

internal class NativeMusicArchive(private val context: Context) {
    data class Restored(
        val songs: Set<String>,
        val folders: Map<String, Set<String>>,
        val playlists: Map<String, Set<String>>,
        val smartFolders: List<Pair<String, String>>,
    )

    fun export(destination: Uri, snapshot: JSONObject) {
        val manifest = JSONObject(snapshot.toString())
        val tracks = manifest.getJSONObject("catalog").getJSONObject("tracks")
        context.contentResolver.openOutputStream(destination)?.use { output ->
            ZipOutputStream(output.buffered()).use { archive ->
                var count = 0
                for (id in tracks.keys()) {
                    val track = tracks.getJSONObject(id)
                    val sources = track.getJSONArray("locations")
                    val sourceUri = (0 until sources.length()).map { sources.getJSONObject(it) }
                        .firstOrNull { it.optString("provider") == "android-document" }
                        ?.optString("remoteId") ?: throw IllegalStateException("No se puede completar la copia: falta el origen de ${track.optString("title")}")
                    val extension = track.optString("title").substringAfterLast('.', "mp3").lowercase()
                    val safeExtension = if (extension in setOf("mp3", "m4a", "wav", "aac", "flac", "ogg")) extension else "mp3"
                    val relative = "audio/${UUID.randomUUID()}.$safeExtension"
                    val stream = context.contentResolver.openInputStream(Uri.parse(sourceUri))
                        ?: throw IllegalStateException("No se puede completar la copia: no se puede leer ${track.optString("title")}")
                    stream.use {
                        archive.putNextEntry(ZipEntry(relative))
                        it.copyTo(archive)
                        archive.closeEntry()
                    }
                    sources.put(JSONObject().put("provider", "archive").put("remoteId", relative))
                    count++
                }
                manifest.put("includesAudioFiles", true)
                manifest.put("audioFileCount", count)
                archive.putNextEntry(ZipEntry("manifest.json"))
                archive.write(manifest.toString().toByteArray(Charsets.UTF_8))
                archive.closeEntry()
            }
        } ?: throw IllegalStateException("No se pudo crear el archivo ZIP")
    }

    fun restore(source: Uri): Restored {
        val staging = File(context.cacheDir, "music-restore-${UUID.randomUUID()}")
        val createdFiles = mutableListOf<File>()
        staging.mkdirs()
        try {
            var manifest: JSONObject? = null
            var totalBytes = 0L
            context.contentResolver.openInputStream(source)?.use { input ->
                ZipInputStream(input.buffered()).use { archive ->
                    while (true) {
                        val entry = archive.nextEntry ?: break
                        val name = entry.name
                        require(name == "manifest.json" || Regex("audio/[a-zA-Z0-9-]+\\.(mp3|m4a|wav|aac|flac|ogg)").matches(name)) {
                            "El ZIP contiene una ruta no permitida"
                        }
                        if (!entry.isDirectory) {
                            val file = File(staging, name)
                            file.parentFile?.mkdirs()
                            file.outputStream().use { output ->
                                val buffer = ByteArray(65536)
                                while (true) {
                                    val read = archive.read(buffer)
                                    if (read < 0) break
                                    totalBytes += read
                                    require(totalBytes <= 2_147_483_648L) { "Respaldo superior al límite de seguridad de 2 GB" }
                                    output.write(buffer, 0, read)
                                }
                            }
                            if (name == "manifest.json") {
                                require(file.length() <= 8_388_608) { "Manifiesto demasiado grande" }
                                manifest = JSONObject(file.readText())
                            }
                        }
                        archive.closeEntry()
                    }
                }
            } ?: throw IllegalStateException("No se pudo leer el ZIP")
            val data = manifest ?: throw IllegalArgumentException("Falta el manifiesto")
            require(data.optString("format") == "tifloacosta-mi-musica" && data.optInt("version") == 1 && data.optBoolean("includesAudioFiles")) {
                "Formato de respaldo incompatible"
            }
            val tracks = data.getJSONObject("catalog").getJSONObject("tracks")
            val restored = mutableSetOf<String>()
            val idToUri = mutableMapOf<String, String>()
            val destination = File(context.filesDir, "MiMusica")
            destination.mkdirs()
            for (id in tracks.keys()) {
                val track = tracks.getJSONObject(id)
                val locations = track.getJSONArray("locations")
                val path = (0 until locations.length()).map { locations.getJSONObject(it) }
                    .firstOrNull { it.optString("provider") == "archive" }?.optString("remoteId") ?: continue
                require(Regex("audio/[a-zA-Z0-9-]+\\.(mp3|m4a|wav|aac|flac|ogg)").matches(path))
                val original = File(staging, path)
                require(original.isFile) { "No se encontró una canción incluida en el manifiesto" }
                val local = File(destination, "${UUID.randomUUID()}.${path.substringAfterLast('.')}")
                original.copyTo(local)
                createdFiles.add(local)
                val uri = Uri.fromFile(local).toString()
                idToUri[id] = uri
                restored.add("$uri\n${track.getString("title")}")
            }
            val folders = mutableMapOf<String, Set<String>>()
            val entries = data.getJSONArray("folders")
            for (index in 0 until entries.length()) {
                val folder = entries.getJSONObject(index)
                val name = folder.getString("name")
                val ids = folder.getJSONArray("trackIds")
                folders[name] = (0 until ids.length()).mapNotNull { idToUri[ids.getString(it)] }.toSet()
            }
            val playlists = mutableMapOf<String, Set<String>>()
            val listEntries = data.getJSONArray("playlists")
            for (index in 0 until listEntries.length()) {
                val item = listEntries.getJSONObject(index)
                val ids = item.getJSONArray("trackIds")
                playlists[item.getString("name")] = (0 until ids.length()).mapNotNull { idToUri[ids.getString(it)] }.toSet()
            }
            val smart = data.optJSONArray("smartFolders") ?: JSONArray()
            val smartFolders = (0 until smart.length()).map { index ->
                val item = smart.getJSONObject(index)
                item.getString("name") to item.getString("titleContains")
            }
            return Restored(restored, folders, playlists, smartFolders)
        } catch (failure: Exception) {
            createdFiles.forEach { it.delete() }
            throw failure
        } finally { staging.deleteRecursively() }
    }
}
