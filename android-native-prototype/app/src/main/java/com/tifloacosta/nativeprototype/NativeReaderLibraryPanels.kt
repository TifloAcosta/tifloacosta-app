package com.tifloacosta.nativeprototype

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@Composable
fun NativeReaderFolderManager(
    english: Boolean, books: List<ReaderBook>,
    organization: NativeReaderOrganization, store: NativeReaderStore,
    onChanged: () -> Unit, onBack: () -> Unit
) {
    var name by remember { mutableStateOf("") }
    var rename by remember { mutableStateOf<String?>(null) }
    var deletion by remember { mutableStateOf<String?>(null) }
    var error by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val folders = organization.folders(books)
    fun task(action: () -> Unit) {
        busy = true
        scope.launch {
            try {
                withContext(Dispatchers.IO) { action() }
                error = ""
                onChanged()
            } catch (e: Exception) { error = e.message ?: "No se pudo modificar la carpeta." }
            finally { busy = false }
        }
    }
    BackHandler { onBack() }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)) {
        TextButton(onClick = onBack) { Text(if (english) "Back to filters" else "Volver a filtros") }
        Text(if (english) "My folders" else "Mis carpetas",
            style = MaterialTheme.typography.headlineSmall,
            modifier = Modifier.semantics { heading() })
        TextField(value = name, onValueChange = { name = it.take(70) },
            singleLine = true,
            label = { Text(if (english) "New folder name" else "Nombre de nueva carpeta") },
            modifier = Modifier.fillMaxWidth())
        Button(enabled = !busy && name.isNotBlank(), onClick = {
            val proposed = name
            task { organization.createFolder(proposed, store.list()) }
            name = ""
        }, modifier = Modifier.fillMaxWidth()) {
            Text(if (english) "Create folder" else "Crear carpeta")
        }
        if (folders.isEmpty()) Text(if (english) "No folders yet." else "Todavía no hay carpetas.")
        folders.forEach { entry ->
            val count = books.count { it.folder == entry }
            Text(entry + ", " + count + (if (english) " books" else " libros"),
                style = MaterialTheme.typography.titleMedium)
            Row {
                TextButton(enabled = !busy, onClick = { rename = entry; name = entry }) {
                    Text(if (english) "Rename" else "Renombrar")
                }
                TextButton(enabled = !busy, onClick = { deletion = entry }) {
                    Text(if (english) "Delete folder" else "Eliminar carpeta")
                }
            }
        }
        if (error.isNotBlank()) Text(error)
    }
    rename?.let { old ->
        AlertDialog(onDismissRequest = { rename = null },
            title = { Text(if (english) "Rename folder" else "Renombrar carpeta") },
            text = { TextField(value = name, onValueChange = { name = it.take(70) },
                label = { Text(if (english) "Folder name" else "Nombre de carpeta") }) },
            confirmButton = { TextButton(enabled = !busy && name.isNotBlank(), onClick = {
                val proposed = name
                rename = null
                task { organization.renameFolder(old, proposed, store) }
                name = ""
            }) { Text(if (english) "Save" else "Guardar") } },
            dismissButton = { TextButton(onClick = { rename = null; name = "" }) {
                Text(if (english) "Cancel" else "Cancelar")
            } })
    }
    deletion?.let { old ->
        AlertDialog(onDismissRequest = { deletion = null },
            title = { Text(if (english) "Delete folder?" else "¿Eliminar carpeta?") },
            text = { Text(if (english)
                "Books remain in the library without a folder; no book is deleted."
                else "Sus libros permanecerán en Mi biblioteca como Sin carpeta. No se eliminará ningún libro.") },
            confirmButton = { TextButton(enabled = !busy, onClick = {
                deletion = null
                task { organization.deleteFolder(old, store) }
            }) { Text(if (english) "Delete folder" else "Eliminar carpeta") } },
            dismissButton = { TextButton(onClick = { deletion = null }) {
                Text(if (english) "Cancel" else "Cancelar")
            } })
    }
}

@Composable
fun NativeReaderQueueManager(
    english: Boolean, books: List<ReaderBook>, organization: NativeReaderOrganization,
    onChanged: () -> Unit, onOpen: (ReaderBook) -> Unit, onBack: () -> Unit
) {
    val scope = rememberCoroutineScope()
    var error by remember { mutableStateOf("") }
    val ids = organization.queue(books)
    val mapped = books.associateBy { it.id }
    fun modify(action: () -> Unit) {
        scope.launch {
            try {
                withContext(Dispatchers.IO) { action() }
                error = ""
                onChanged()
            } catch (e: Exception) { error = e.message.orEmpty() }
        }
    }
    BackHandler { onBack() }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)) {
        TextButton(onClick = onBack) { Text(if (english) "Back to filters" else "Volver a filtros") }
        Text(if (english) "Reading queue" else "Cola de lectura",
            style = MaterialTheme.typography.headlineSmall, modifier = Modifier.semantics { heading() })
        if (ids.isEmpty()) Text(if (english) "The queue is empty." else "La cola está vacía.")
        ids.forEachIndexed { i, id ->
            val book = mapped[id] ?: return@forEachIndexed
            Text((i + 1).toString() + ". " + book.title, style = MaterialTheme.typography.titleMedium)
            Row {
                TextButton(onClick = { onOpen(book) }) { Text(if (english) "Open" else "Abrir") }
                TextButton(enabled = i > 0,
                    onClick = { modify { organization.moveInQueue(id, -1, books) } }) {
                    Text(if (english) "Up" else "Subir")
                }
                TextButton(enabled = i < ids.lastIndex,
                    onClick = { modify { organization.moveInQueue(id, 1, books) } }) {
                    Text(if (english) "Down" else "Bajar")
                }
                TextButton(onClick = {
                    modify { organization.removeFromQueue(id, books) }
                }) { Text(if (english) "Remove" else "Quitar") }
            }
        }
        if (error.isNotBlank()) Text(error)
    }
}

@Composable
fun NativeReaderBookmarksPanel(
    english: Boolean, book: ReaderBook,
    onTextMark: (Int) -> Unit, onAudioMark: (ReaderAudioMark) -> Unit,
    onBack: () -> Unit
) {
    BackHandler { onBack() }
    val marks = book.audioMarks.ifEmpty {
        book.marks.map { ReaderAudioMark(book.trackIndex, it) }
    }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)) {
        TextButton(onClick = onBack) {
            Text(if (english) "Back to my library" else "Volver a Mi biblioteca")
        }
        Text((if (english) "Bookmarks: " else "Marcas: ") + book.title,
            style = MaterialTheme.typography.headlineSmall,
            modifier = Modifier.semantics { heading() })
        if (book.tracks.isNotEmpty()) {
            if (marks.isEmpty()) Text(if (english) "No bookmarks" else "No hay marcas")
            marks.forEachIndexed { i, mark ->
                OutlinedButton(onClick = { onAudioMark(mark) }, modifier = Modifier.fillMaxWidth()) {
                    Text((if (english) "Bookmark " else "Marca ") + (i + 1) +
                        (if (english) ", section " else ", sección ") + (mark.segmentIndex + 1) +
                        (if (english) ", at " else ", en ") + (mark.positionMs / 1000) + " s")
                }
            }
        } else {
            if (book.marks.isEmpty()) Text(if (english) "No bookmarks" else "No hay marcas")
            book.marks.forEachIndexed { i, offset ->
                OutlinedButton(onClick = { onTextMark(offset) }, modifier = Modifier.fillMaxWidth()) {
                    Text((if (english) "Bookmark " else "Marca ") + (i + 1) +
                        ", " + ReaderUnits.percent(offset, book.length) + "%")
                }
            }
        }
    }
}
