package com.tifloacosta.nativeprototype

import android.content.Intent
import android.content.Context
import android.net.Uri
import android.media.MediaPlayer
import android.provider.OpenableColumns
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.delay
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject

private data class ImportedSong(val uri: String, val title: String)

@Composable
fun NativeMyMusic(onBack: () -> Unit) {
    val context = LocalContext.current
    val player = remember { NativeMusicPlayer(context.applicationContext) }
    val scope = rememberCoroutineScope()
    DisposableEffect(player) { onDispose { player.stop() } }
    LaunchedEffect(player.playing) {
        while (player.playing) {
            player.updateProgress()
            delay(500)
        }
    }
    val prefs = remember { context.getSharedPreferences("mi-musica-library-v1", 0) }
    fun savedSongs(): List<ImportedSong> = prefs.getStringSet("songs", emptySet()).orEmpty()
        .mapNotNull { encoded ->
            val separator = encoded.indexOf('\n')
            if (separator > 0) ImportedSong(encoded.substring(0, separator), encoded.substring(separator + 1)) else null
        }.sortedBy { it.title.lowercase() }
    var songs by remember { mutableStateOf(savedSongs()) }
    var jamendoQuery by remember { mutableStateOf("") }
    var jamendoTracks by remember { mutableStateOf<List<JamendoSong>>(emptyList()) }
    var jamendoBusy by remember { mutableStateOf(false) }
    var jamendoMessage by remember { mutableStateOf<String?>(null) }
    var jamendoPlayer by remember { mutableStateOf<MediaPlayer?>(null) }
    DisposableEffect(Unit) { onDispose { jamendoPlayer?.release() } }
    var error by remember { mutableStateOf<String?>(null) }
    var query by remember { mutableStateOf("") }
    var folderName by remember { mutableStateOf("") }
    var editingFolder by remember { mutableStateOf(false) }
    var pendingRemoval by remember { mutableStateOf<ImportedSong?>(null) }
    var folders by remember { mutableStateOf(prefs.getStringSet("folders", emptySet()).orEmpty().sorted()) }
    var folderForTrack by remember { mutableStateOf<ImportedSong?>(null) }
    var playlists by remember { mutableStateOf(prefs.getStringSet("playlists", emptySet()).orEmpty().sorted()) }
    var playlistName by remember { mutableStateOf("") }
    var editingPlaylist by remember { mutableStateOf(false) }
    var playlistForTrack by remember { mutableStateOf<ImportedSong?>(null) }
    var smartFolderName by remember { mutableStateOf("") }
    var smartFolderKeyword by remember { mutableStateOf("") }
    var editingSmartFolder by remember { mutableStateOf(false) }
    var smartFolders by remember { mutableStateOf(prefs.getStringSet("smart-folders", emptySet()).orEmpty().mapNotNull {
        val parts = it.split('\n', limit = 2)
        if (parts.size == 2) parts[0] to parts[1] else null
    }) }
    var autoBackupDays by remember { mutableStateOf(prefs.getInt("auto-backup-days", 0)) }
    var archiveBusy by remember { mutableStateOf(false) }

    fun backupSnapshot(): JSONObject {
        val tracks = JSONObject().apply { songs.forEach { song ->
            put(song.uri, JSONObject().put("id", song.uri).put("title", song.title)
                .put("locations", JSONArray().put(JSONObject().put("provider", "android-document").put("remoteId", song.uri))))
        } }
        val folderArray = JSONArray().apply { folders.forEach { folder ->
            put(JSONObject().put("id", "folder:$folder").put("name", folder)
                .put("trackIds", JSONArray(prefs.getStringSet("folder:$folder", emptySet()).orEmpty().toList())))
        } }
        val playlistArray = JSONArray().apply { playlists.forEach { name ->
            put(JSONObject().put("id", "playlist:$name").put("name", name)
                .put("trackIds", JSONArray(prefs.getStringSet("playlist:$name", emptySet()).orEmpty().toList())))
        } }
        val smartArray = JSONArray().apply { smartFolders.forEach { (name, keyword) ->
            put(JSONObject().put("id", "smart:$name").put("name", name).put("titleContains", keyword))
        } }
        return JSONObject().put("format", "tifloacosta-mi-musica")
            .put("version", 1).put("createdAt", java.time.Instant.now().toString())
            .put("includesAudioFiles", false)
            .put("catalog", JSONObject().put("version", 1).put("tracks", tracks))
            .put("folders", folderArray).put("playlists", playlistArray)
            .put("smartFolders", smartArray).put("audioProfiles", JSONObject())
    }

    fun performAutomaticBackupIfDue() {
        if (autoBackupDays == 0) return
        val now = System.currentTimeMillis()
        val previous = prefs.getLong("last-auto-backup", 0L)
        if (previous > 0 && now - previous < autoBackupDays * 86_400_000L) return
        try {
            context.openFileOutput("mi-musica-auto-index.json", Context.MODE_PRIVATE).use {
                it.write(backupSnapshot().toString(2).toByteArray(Charsets.UTF_8))
            }
            prefs.edit().putLong("last-auto-backup", now).apply()
        } catch (failure: Exception) { error = "No se pudo guardar la copia automática: ${failure.localizedMessage}" }
    }

    LaunchedEffect(autoBackupDays) { performAutomaticBackupIfDue() }

    fun setAutomaticBackup(days: Int) {
        if (days !in listOf(0, 7, 30)) return
        autoBackupDays = days
        prefs.edit().putInt("auto-backup-days", days).apply()
    }

    val exportBackup = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("application/json")) { destination ->
        if (destination != null) try {
            val snapshot = backupSnapshot()
            context.contentResolver.openOutputStream(destination)?.use { stream ->
                stream.write(snapshot.toString(2).toByteArray(Charsets.UTF_8))
            } ?: throw IllegalStateException("No se pudo abrir el destino del respaldo")
        } catch (failure: Exception) { error = "No se pudo exportar el respaldo: ${failure.localizedMessage}" }
    }
    val restoreBackup = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { source ->
        if (source != null) try {
            val raw = context.contentResolver.openInputStream(source)?.bufferedReader()?.use { it.readText() }
                ?: throw IllegalStateException("No se pudo leer el respaldo")
            val snapshot = JSONObject(raw)
            require(snapshot.optString("format") == "tifloacosta-mi-musica" && snapshot.optInt("version") == 1 && !snapshot.optBoolean("includesAudioFiles")) {
                "El archivo no es un índice de Mi Música compatible"
            }
            val importedTracks = snapshot.getJSONObject("catalog").getJSONObject("tracks")
            val importedFolders = snapshot.getJSONArray("folders")
            val importedPlaylists = snapshot.getJSONArray("playlists")
            val importedSmart = snapshot.optJSONArray("smartFolders") ?: JSONArray()
            val records = prefs.getStringSet("songs", emptySet()).orEmpty().toMutableSet()
            var unavailable = 0
            for (key in importedTracks.keys()) {
                val entry = importedTracks.getJSONObject(key)
                val title = entry.getString("title")
                val locations = entry.getJSONArray("locations")
                val uri = (0 until locations.length()).map { locations.getJSONObject(it) }
                    .firstOrNull { it.getString("provider") == "android-document" }
                    ?.getString("remoteId")
                if (uri != null && uri.isNotBlank() && !uri.contains('\n') && title.isNotBlank()) {
                    val permission = context.contentResolver.persistedUriPermissions.any {
                        it.uri.toString() == uri && it.isReadPermission
                    }
                    if (permission) records.add("$uri\n$title") else unavailable++
                } else unavailable++
            }
            val nextFolders = folders.toMutableSet()
            val memberships = mutableMapOf<String, Set<String>>()
            for (index in 0 until importedFolders.length()) {
                val entry = importedFolders.getJSONObject(index)
                val name = entry.getString("name")
                require(name.isNotBlank())
                nextFolders.add(name)
                val members = entry.getJSONArray("trackIds")
                memberships[name] = (0 until members.length()).map { members.getString(it) }.toSet()
            }
            val editor = prefs.edit().putStringSet("songs", records).putStringSet("folders", nextFolders)
            memberships.forEach { (name, members) -> editor.putStringSet("folder:$name", prefs.getStringSet("folder:$name", emptySet()).orEmpty() + members) }
            val nextPlaylists = playlists.toMutableSet()
            for (index in 0 until importedPlaylists.length()) {
                val entry = importedPlaylists.getJSONObject(index)
                val name = entry.getString("name")
                nextPlaylists.add(name)
                val refs = entry.getJSONArray("trackIds")
                val selected = (0 until refs.length()).map { refs.getString(it) }.toSet()
                editor.putStringSet("playlist:$name", prefs.getStringSet("playlist:$name", emptySet()).orEmpty() + selected)
            }
            editor.putStringSet("playlists", nextPlaylists)
            val smartEntries = smartFolders.toMutableList()
            for (index in 0 until importedSmart.length()) {
                val item = importedSmart.getJSONObject(index)
                smartEntries.removeAll { it.first == item.getString("name") }
                smartEntries.add(item.getString("name") to item.getString("titleContains"))
            }
            editor.putStringSet("smart-folders", smartEntries.map { it.first + "\n" + it.second }.toSet())
            editor.apply()
            songs = savedSongs()
            folders = nextFolders.sorted()
            playlists = nextPlaylists.sorted()
            smartFolders = smartEntries
            if (unavailable > 0) error = "Organización restaurada. Hay $unavailable canciones sin permisos de audio; impórtalas para reproducirlas."
        } catch (failure: Exception) { error = "No se pudo restaurar el respaldo: ${failure.localizedMessage}" }
    }
    val exportCompleteBackup = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("application/zip")) { destination ->
        if (destination != null) {
            val snapshot = backupSnapshot()
            scope.launch {
                archiveBusy = true
                try {
                    withContext(Dispatchers.IO) { NativeMusicArchive(context).export(destination, snapshot) }
                } catch (failure: Exception) { error = "No se pudo exportar la copia con audio: ${failure.localizedMessage}" }
                finally { archiveBusy = false }
            }
        }
    }
    val restoreCompleteBackup = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { source ->
        if (source != null) {
            scope.launch {
                archiveBusy = true
                try {
                    val restored = withContext(Dispatchers.IO) { NativeMusicArchive(context).restore(source) }
                    val existing = prefs.getStringSet("songs", emptySet()).orEmpty()
                    val editor = prefs.edit().putStringSet("songs", existing + restored.songs)
                        .putStringSet("folders", (folders + restored.folders.keys).toSet())
                        .putStringSet("playlists", (playlists + restored.playlists.keys).toSet())
                    restored.folders.forEach { (name, uris) ->
                        editor.putStringSet("folder:$name", prefs.getStringSet("folder:$name", emptySet()).orEmpty() + uris)
                    }
                    restored.playlists.forEach { (name, uris) ->
                        editor.putStringSet("playlist:$name", prefs.getStringSet("playlist:$name", emptySet()).orEmpty() + uris)
                    }
                    val newSmart = (smartFolders + restored.smartFolders).distinctBy { it.first }
                    editor.putStringSet("smart-folders", newSmart.map { it.first + "\n" + it.second }.toSet())
                    editor.apply()
                    songs = savedSongs()
                    folders = (folders + restored.folders.keys).distinct().sorted()
                    playlists = (playlists + restored.playlists.keys).distinct().sorted()
                    smartFolders = newSmart
                } catch (failure: Exception) { error = "No se pudo restaurar la copia con audio: ${failure.localizedMessage}" }
                finally { archiveBusy = false }
            }
        }
    }

    fun createFolder() {
        val name = folderName.trim()
        if (name.isNotEmpty()) {
            val next = (folders + name).distinct().sorted()
            prefs.edit().putStringSet("folders", next.toSet()).apply()
            folders = next
        }
        folderName = ""
        editingFolder = false
    }

    fun createPlaylist() {
        val name = playlistName.trim()
        if (name.isNotEmpty()) {
            val next = (playlists + name).distinct().sorted()
            prefs.edit().putStringSet("playlists", next.toSet()).apply()
            playlists = next
        }
        playlistName = ""
        editingPlaylist = false
    }

    fun createSmartFolder() {
        val name = smartFolderName.trim().replace("\n", " ")
        val keyword = smartFolderKeyword.trim().replace("\n", " ")
        if (name.isNotEmpty() && keyword.isNotEmpty()) {
            val next = smartFolders.filterNot { it.first == name } + (name to keyword)
            prefs.edit().putStringSet("smart-folders", next.map { it.first + "\n" + it.second }.toSet()).apply()
            smartFolders = next
        }
        smartFolderName = ""
        smartFolderKeyword = ""
        editingSmartFolder = false
    }

    fun removeFromLibrary(song: ImportedSong) {
        val records = prefs.getStringSet("songs", emptySet()).orEmpty()
            .filterNot { it.substringBefore('\n') == song.uri }.toSet()
        prefs.edit().putStringSet("songs", records).apply()
        playlists.forEach { name ->
            val key = "playlist:$name"
            prefs.edit().putStringSet(key, prefs.getStringSet(key, emptySet()).orEmpty() - song.uri).apply()
        }
        songs = savedSongs()
        pendingRemoval = null
    }

    val picker = rememberLauncherForActivityResult(ActivityResultContracts.OpenMultipleDocuments()) { uris ->
        val records = prefs.getStringSet("songs", emptySet()).orEmpty().toMutableSet()
        uris.forEach { uri ->
            try {
                context.contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
                val title = context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
                    if (cursor.moveToFirst()) cursor.getString(0) else null
                } ?: uri.lastPathSegment ?: "Audio"
                records.removeAll { it.substringBefore('\n') == uri.toString() }
                records.add(uri.toString() + "\n" + title)
            } catch (failure: Exception) {
                error = "No se pudo incorporar un archivo: ${failure.localizedMessage ?: "permiso denegado"}"
            }
        }
        prefs.edit().putStringSet("songs", records).apply()
        songs = savedSongs()
    }
    val folderPicker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocumentTree()) { treeUri ->
        if (treeUri != null) {
            try {
                context.contentResolver.takePersistableUriPermission(treeUri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
                scope.launch {
                    try {
                        val discovered = withContext(Dispatchers.IO) { NativeMusicFolderScanner(context).scan(treeUri) }
                        val records = prefs.getStringSet("songs", emptySet()).orEmpty().toMutableSet()
                        discovered.forEach { (uri, title) ->
                            records.removeAll { it.substringBefore('\n') == uri }
                            records.add("$uri\n$title")
                        }
                        prefs.edit().putStringSet("songs", records).apply()
                        songs = savedSongs()
                    } catch (failure: Exception) {
                        error = "No se pudo leer la carpeta seleccionada: ${failure.localizedMessage}"
                    }
                }
            } catch (failure: Exception) { error = "No se pudo autorizar la carpeta: ${failure.localizedMessage}" }
        }
    }

    Column(modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        TextButton(onClick = onBack) { Text("Volver") }
        Text("Mi Música", modifier = Modifier.semantics { heading() })
        Text("Jamendo", modifier = Modifier.semantics { heading() })
        Text("Música del catálogo Jamendo. No necesitas iniciar sesión para buscar y escuchar.")
        OutlinedTextField(value = jamendoQuery, onValueChange = { jamendoQuery = it },
            label = { Text("Buscar en Jamendo") }, modifier = Modifier.fillMaxWidth())
        Button(onClick = {
            scope.launch {
                jamendoBusy = true
                try {
                    jamendoTracks = NativeJamendo.search(jamendoQuery)
                    jamendoMessage = if (jamendoTracks.isEmpty()) "No se encontraron canciones en Jamendo" else null
                } catch (failure: Exception) {
                    jamendoTracks = emptyList()
                    jamendoMessage = "No se pudo consultar Jamendo: ${failure.localizedMessage}"
                } finally { jamendoBusy = false }
            }
        }, enabled = !jamendoBusy) { Text("Buscar canciones en Jamendo") }
        if (jamendoBusy) Text("Consultando Jamendo")
        jamendoTracks.forEach { track ->
            Button(onClick = {
                try {
                    player.stop()
                    jamendoPlayer?.release()
                    jamendoPlayer = NativeJamendo.start(track) { jamendoMessage = it }
                    jamendoMessage = "Iniciando ${track.title}, de ${track.artist}, desde Jamendo"
                } catch (failure: Exception) {
                    jamendoMessage = "No se pudo iniciar Jamendo: ${failure.localizedMessage}"
                }
            }) { Text("Reproducir ${track.title}, ${track.artist}, Jamendo") }
        }
        Button(onClick = { jamendoPlayer?.pause() }, enabled = jamendoPlayer != null) { Text("Pausar Jamendo") }
        jamendoMessage?.let { Text(it) }
        Button(onClick = { picker.launch(arrayOf("audio/*")) }, modifier = Modifier.fillMaxWidth()) {
            Text("Importar canciones")
        }
        Button(onClick = { folderPicker.launch(null) }, modifier = Modifier.fillMaxWidth()) {
            Text("Añadir carpeta local o en la nube")
        }
        Text("Puedes combinar canciones del dispositivo y de proveedores de archivos compatibles. Si se pierde la conexión o el permiso, el archivo externo podría dejar de reproducirse.")
        Button(onClick = { editingFolder = true }, modifier = Modifier.fillMaxWidth()) { Text("Crear carpeta") }
        Button(onClick = { editingPlaylist = true }, modifier = Modifier.fillMaxWidth()) { Text("Crear lista de reproducción") }
        Button(onClick = { editingSmartFolder = true }, modifier = Modifier.fillMaxWidth()) { Text("Crear carpeta inteligente") }
        Text("Copias de seguridad", modifier = Modifier.semantics { heading() })
        Button(onClick = { exportBackup.launch("MiMusica-respaldo.json") }) { Text("Exportar respaldo de biblioteca") }
        Button(onClick = { restoreBackup.launch("application/json") }) { Text("Restaurar respaldo de biblioteca") }
        Button(onClick = { exportCompleteBackup.launch("MiMusica-completa.zip") }, enabled = !archiveBusy) { Text("Exportar copia completa con audio") }
        Button(onClick = { restoreCompleteBackup.launch("application/zip") }, enabled = !archiveBusy) { Text("Restaurar copia completa con audio") }
        if (archiveBusy) { Text("Procesando copia de seguridad con audio. Espera a que termine.") }
        Text("Copia automática: ${if (autoBackupDays == 0) "desactivada" else "cada $autoBackupDays días"}")
        Button(onClick = { setAutomaticBackup(0) }) { Text("Desactivar copia automática") }
        Button(onClick = { setAutomaticBackup(7) }) { Text("Cada 7 días") }
        Button(onClick = { setAutomaticBackup(30) }) { Text("Cada 30 días") }
        Text("La copia automática del índice se guarda al abrir Mi Música cuando corresponde, sin ejecutarse en segundo plano.")
        Text("El respaldo guarda canciones y carpetas como referencias, sin copiar los archivos de audio. En otro teléfono deberás importar también tus canciones.")
        OutlinedTextField(value = query, onValueChange = { query = it }, label = { Text("Buscar canciones") }, modifier = Modifier.fillMaxWidth())
        error?.let { Text(it) }
        player.error?.let { Text(it) }
        if (folders.isNotEmpty()) {
            Text("Mis carpetas", modifier = Modifier.semantics { heading() })
            folders.forEach { folder ->
                TextButton(onClick = {
                    val next = folders.filterNot { it == folder }
                    prefs.edit().putStringSet("folders", next.toSet()).apply()
                    folders = next
                }) { Text("Eliminar carpeta $folder") }
            }
        }
        if (playlists.isNotEmpty()) {
            Text("Listas de reproducción", modifier = Modifier.semantics { heading() })
            playlists.forEach { name ->
                val refs = prefs.getStringSet("playlist:$name", emptySet()).orEmpty()
                val entries = refs.mapNotNull { uri -> songs.firstOrNull { it.uri == uri } }
                Text("$name, ${entries.size} canciones")
                Button(onClick = {
                    entries.firstOrNull()?.let { first -> player.play(first.uri, first.title, entries.map { it.uri to it.title }) }
                }, enabled = entries.isNotEmpty()) { Text("Reproducir lista $name") }
                TextButton(onClick = {
                    val next = playlists - name
                    prefs.edit().putStringSet("playlists", next.toSet()).remove("playlist:$name").apply()
                    playlists = next
                }) { Text("Eliminar lista $name") }
            }
        }
        if (smartFolders.isNotEmpty()) {
            Text("Carpetas inteligentes", modifier = Modifier.semantics { heading() })
            smartFolders.forEach { (name, keyword) ->
                val matches = songs.filter { it.title.contains(keyword, ignoreCase = true) }
                Text("$name, título contiene $keyword, ${matches.size} canciones")
                Button(onClick = {
                    matches.firstOrNull()?.let { first -> player.play(first.uri, first.title, matches.map { it.uri to it.title }) }
                }, enabled = matches.isNotEmpty()) { Text("Reproducir carpeta inteligente $name") }
                TextButton(onClick = {
                    val next = smartFolders.filterNot { it.first == name }
                    prefs.edit().putStringSet("smart-folders", next.map { it.first + "\n" + it.second }.toSet()).apply()
                    smartFolders = next
                }) { Text("Eliminar carpeta inteligente $name") }
            }
        }
        if (songs.isEmpty()) {
            Text("Todavía no hay canciones. Selecciona Importar canciones para empezar.")
        } else {
            Column {
                songs.filter { it.title.contains(query.trim(), ignoreCase = true) }.forEach { song ->
                    Column(modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp)) {
                        Text("Canción: ${song.title}")
                        Button(onClick = {
                            player.play(song.uri, song.title, songs.map { it.uri to it.title })
                        }) { Text("Reproducir ${song.title}") }
                        TextButton(onClick = { folderForTrack = song }, enabled = folders.isNotEmpty()) { Text("Añadir a carpeta") }
                        TextButton(onClick = { playlistForTrack = song }, enabled = playlists.isNotEmpty()) { Text("Añadir a lista de reproducción") }
                        TextButton(onClick = { pendingRemoval = song }) { Text("Eliminar de la biblioteca") }
                    }
                }
            }
        }
        Text("Reproductor", modifier = Modifier.semantics { heading() })
        Text(player.currentTitle.ifBlank { "Ninguna canción en reproducción" })
        Button(onClick = { player.toggle() }, enabled = player.currentTitle.isNotEmpty()) { Text(if (player.playing) "Pausar" else "Reproducir") }
        Button(onClick = { player.previous() }, enabled = player.currentTitle.isNotEmpty()) { Text("Canción anterior") }
        Button(onClick = { player.skip(-15) }, enabled = player.currentTitle.isNotEmpty()) { Text("Retroceder 15 segundos") }
        Button(onClick = { player.skip(15) }, enabled = player.currentTitle.isNotEmpty()) { Text("Avanzar 15 segundos") }
        Button(onClick = { player.next() }, enabled = player.currentTitle.isNotEmpty()) { Text("Canción siguiente") }
        Button(onClick = { player.toggleShuffle() }) {
            Text("Reproducción aleatoria: ${if (player.shuffleEnabled) "activada" else "desactivada"}")
        }
        Button(onClick = { player.changeRepeat() }) {
            Text("Repetición: ${when (player.repeatMode) { "all" -> "toda la lista"; "one" -> "una canción"; else -> "desactivada" }}")
        }
        Button(onClick = { player.setSleep(15) }, enabled = player.currentTitle.isNotEmpty()) { Text("Temporizador de 15 minutos") }
        Button(onClick = { player.setSleep(30) }, enabled = player.currentTitle.isNotEmpty()) { Text("Temporizador de 30 minutos") }
        if (player.sleepRemainingSeconds > 0) {
            Text("Temporizador: ${player.sleepRemainingSeconds} segundos restantes")
            TextButton(onClick = { player.cancelSleep() }) { Text("Cancelar temporizador") }
        }
        Text("Posición: ${player.progressMs / 1000} de ${player.durationMs / 1000} segundos")
        Text("Ecualizador", modifier = Modifier.semantics { heading() })
        Button(onClick = { player.equalizer.saveAsGeneral() }) { Text("Guardar como perfil general") }
        Button(onClick = { player.equalizer.saveForCurrentSong() }, enabled = player.currentTitle.isNotEmpty()) { Text("Guardar perfil para esta canción") }
        if (player.equalizer.currentHasOverride) {
            Button(onClick = { player.equalizer.removeCurrentSongOverride() }) { Text("Quitar perfil de esta canción") }
        }
        Text("Perfil actual: ${player.equalizer.selectedPreset}")
        player.equalizer.presets.keys.forEach { preset ->
            TextButton(onClick = { player.equalizer.selectPreset(preset) }) { Text("Perfil $preset") }
        }
        player.equalizer.frequencies.forEachIndexed { index, frequency ->
            Text("$frequency hercios: ${player.equalizer.gains[index]} decibelios")
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                TextButton(onClick = { player.equalizer.adjustBand(index, -1f) }) { Text("Reducir $frequency hercios") }
                TextButton(onClick = { player.equalizer.adjustBand(index, 1f) }) { Text("Aumentar $frequency hercios") }
            }
        }
        player.equalizer.error?.let { Text(it) }
    }
    if (editingFolder) {
        AlertDialog(
            onDismissRequest = { editingFolder = false }, title = { Text("Crear carpeta") },
            text = { OutlinedTextField(value = folderName, onValueChange = { folderName = it }, label = { Text("Nombre") }) },
            confirmButton = { TextButton(onClick = ::createFolder) { Text("Crear") } },
            dismissButton = { TextButton(onClick = { editingFolder = false }) { Text("Cancelar") } }
        )
    }
    if (editingPlaylist) {
        AlertDialog(onDismissRequest = { editingPlaylist = false }, title = { Text("Crear lista de reproducción") },
            text = { OutlinedTextField(value = playlistName, onValueChange = { playlistName = it }, label = { Text("Nombre") }) },
            confirmButton = { TextButton(onClick = ::createPlaylist) { Text("Crear") } },
            dismissButton = { TextButton(onClick = { editingPlaylist = false }) { Text("Cancelar") } })
    }
    if (editingSmartFolder) {
        AlertDialog(onDismissRequest = { editingSmartFolder = false }, title = { Text("Crear carpeta inteligente") },
            text = { Column {
                OutlinedTextField(value = smartFolderName, onValueChange = { smartFolderName = it }, label = { Text("Nombre") })
                OutlinedTextField(value = smartFolderKeyword, onValueChange = { smartFolderKeyword = it }, label = { Text("El título contiene") })
            } },
            confirmButton = { TextButton(onClick = ::createSmartFolder) { Text("Crear") } },
            dismissButton = { TextButton(onClick = { editingSmartFolder = false }) { Text("Cancelar") } })
    }
    playlistForTrack?.let { song ->
        AlertDialog(onDismissRequest = { playlistForTrack = null }, title = { Text("Añadir a lista de reproducción") },
            text = { Column { playlists.forEach { name ->
                TextButton(onClick = {
                    val key = "playlist:$name"
                    prefs.edit().putStringSet(key, prefs.getStringSet(key, emptySet()).orEmpty() + song.uri).apply()
                    playlistForTrack = null
                }) { Text(name) }
            } } },
            confirmButton = { TextButton(onClick = { playlistForTrack = null }) { Text("Cerrar") } })
    }
    pendingRemoval?.let { song ->
        AlertDialog(onDismissRequest = { pendingRemoval = null },
            title = { Text("Eliminar de la biblioteca") },
            text = { Text("El archivo original no se eliminará.") },
            confirmButton = { TextButton(onClick = { removeFromLibrary(song) }) { Text("Eliminar de la biblioteca") } },
            dismissButton = { TextButton(onClick = { pendingRemoval = null }) { Text("Cancelar") } })
    }
    folderForTrack?.let { song ->
        AlertDialog(onDismissRequest = { folderForTrack = null },
            title = { Text("Añadir a carpeta") },
            text = { Column { folders.forEach { folder ->
                TextButton(onClick = {
                    val key = "folder:" + folder
                    val references = prefs.getStringSet(key, emptySet()).orEmpty() + song.uri
                    prefs.edit().putStringSet(key, references).apply()
                    folderForTrack = null
                }) { Text(folder) }
            } } },
            confirmButton = { TextButton(onClick = { folderForTrack = null }) { Text("Cerrar") } })
    }
}
