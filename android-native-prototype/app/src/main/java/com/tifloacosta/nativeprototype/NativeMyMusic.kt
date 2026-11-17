package com.tifloacosta.nativeprototype

import android.content.Intent
import android.net.Uri
import android.provider.OpenableColumns
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp

private data class ImportedSong(val uri: String, val title: String)

@Composable
fun NativeMyMusic(onBack: () -> Unit) {
    val context = LocalContext.current
    val prefs = remember { context.getSharedPreferences("mi-musica-library-v1", 0) }
    fun savedSongs(): List<ImportedSong> = prefs.getStringSet("songs", emptySet()).orEmpty()
        .mapNotNull { encoded ->
            val separator = encoded.indexOf('\n')
            if (separator > 0) ImportedSong(encoded.substring(0, separator), encoded.substring(separator + 1)) else null
        }.sortedBy { it.title.lowercase() }
    var songs by remember { mutableStateOf(savedSongs()) }
    var error by remember { mutableStateOf<String?>(null) }
    var query by remember { mutableStateOf("") }
    var folderName by remember { mutableStateOf("") }
    var editingFolder by remember { mutableStateOf(false) }
    var pendingRemoval by remember { mutableStateOf<ImportedSong?>(null) }
    var folders by remember { mutableStateOf(prefs.getStringSet("folders", emptySet()).orEmpty().sorted()) }
    var folderForTrack by remember { mutableStateOf<ImportedSong?>(null) }

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

    fun removeFromLibrary(song: ImportedSong) {
        val records = prefs.getStringSet("songs", emptySet()).orEmpty()
            .filterNot { it.substringBefore('\n') == song.uri }.toSet()
        prefs.edit().putStringSet("songs", records).apply()
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

    Column(modifier = Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        TextButton(onClick = onBack) { Text("Volver") }
        Text("Mi Música", modifier = Modifier.semantics { heading() })
        Button(onClick = { picker.launch(arrayOf("audio/*")) }, modifier = Modifier.fillMaxWidth()) {
            Text("Importar canciones")
        }
        Button(onClick = { editingFolder = true }, modifier = Modifier.fillMaxWidth()) { Text("Crear carpeta") }
        OutlinedTextField(value = query, onValueChange = { query = it }, label = { Text("Buscar canciones") }, modifier = Modifier.fillMaxWidth())
        error?.let { Text(it) }
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
        if (songs.isEmpty()) {
            Text("Todavía no hay canciones. Selecciona Importar canciones para empezar.")
        } else {
            LazyColumn {
                items(songs.filter { it.title.contains(query.trim(), ignoreCase = true) }, key = { it.uri }) { song ->
                    Column(modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp)) {
                        Text("Canción: ${song.title}")
                        TextButton(onClick = { folderForTrack = song }, enabled = folders.isNotEmpty()) { Text("Añadir a carpeta") }
                        TextButton(onClick = { pendingRemoval = song }) { Text("Eliminar de la biblioteca") }
                    }
                }
            }
        }
    }
    if (editingFolder) {
        AlertDialog(
            onDismissRequest = { editingFolder = false }, title = { Text("Crear carpeta") },
            text = { OutlinedTextField(value = folderName, onValueChange = { folderName = it }, label = { Text("Nombre") }) },
            confirmButton = { TextButton(onClick = ::createFolder) { Text("Crear") } },
            dismissButton = { TextButton(onClick = { editingFolder = false }) { Text("Cancelar") } }
        )
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
