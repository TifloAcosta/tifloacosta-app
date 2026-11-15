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
    english: Boolean, books: List<ReaderBook>, folderNames: List<String>,
    organization: NativeReaderOrganization, store: NativeReaderStore,
    onChanged: () -> Unit, onBack: () -> Unit
) {
    val uiLanguage = LocalNativeUiLanguage.current
    var name by remember { mutableStateOf("") }
    var rename by remember { mutableStateOf<String?>(null) }
    var deletion by remember { mutableStateOf<String?>(null) }
    var error by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val folders = folderNames
    fun task(action: () -> Unit) {
        busy = true
        scope.launch {
            try {
                withContext(Dispatchers.IO) { action() }
                error = ""
                onChanged()
            } catch (e: Exception) { error = e.message ?: NativeReaderPanelStrings.get(uiLanguage, "folderError") }
            finally { busy = false }
        }
    }
    BackHandler { onBack() }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)) {
        TextButton(onClick = onBack) { Text(NativeReaderPanelStrings.get(uiLanguage, "backFilters")) }
        Text(NativeReaderPanelStrings.get(uiLanguage, "folders"),
            style = MaterialTheme.typography.headlineSmall,
            modifier = Modifier.semantics { heading() })
        TextField(value = name, onValueChange = { name = it.take(70) },
            singleLine = true,
            label = { Text(NativeReaderPanelStrings.get(uiLanguage, "newFolder")) },
            modifier = Modifier.fillMaxWidth())
        Button(enabled = !busy && name.isNotBlank(), onClick = {
            val proposed = name
            task { organization.createFolder(proposed, store.list()) }
            name = ""
        }, modifier = Modifier.fillMaxWidth()) {
            Text(NativeReaderPanelStrings.get(uiLanguage, "create"))
        }
        if (folders.isEmpty()) Text(NativeReaderPanelStrings.get(uiLanguage, "noFolders"))
        folders.forEach { entry ->
            val count = books.count { it.folder == entry }
            Text(entry + ", " + count + NativeReaderPanelStrings.get(uiLanguage, "books"),
                style = MaterialTheme.typography.titleMedium)
            Row {
                TextButton(enabled = !busy, onClick = { rename = entry; name = entry }) {
                    Text(NativeReaderPanelStrings.get(uiLanguage, "rename"))
                }
                TextButton(enabled = !busy, onClick = { deletion = entry }) {
                    Text(NativeReaderPanelStrings.get(uiLanguage, "deleteFolder"))
                }
            }
        }
        if (error.isNotBlank()) Text(error)
    }
    rename?.let { old ->
        AlertDialog(onDismissRequest = { rename = null },
            title = { Text(NativeReaderPanelStrings.get(uiLanguage, "renameTitle")) },
            text = { TextField(value = name, onValueChange = { name = it.take(70) },
                label = { Text(NativeReaderPanelStrings.get(uiLanguage, "folderName")) }) },
            confirmButton = { TextButton(enabled = !busy && name.isNotBlank(), onClick = {
                val proposed = name
                rename = null
                task { organization.renameFolder(old, proposed, store) }
                name = ""
            }) { Text(NativeReaderPanelStrings.get(uiLanguage, "save")) } },
            dismissButton = { TextButton(onClick = { rename = null; name = "" }) {
                Text(NativeReaderPanelStrings.get(uiLanguage, "cancel"))
            } })
    }
    deletion?.let { old ->
        AlertDialog(onDismissRequest = { deletion = null },
            title = { Text(NativeReaderPanelStrings.get(uiLanguage, "deleteConfirm")) },
            text = { Text(NativeReaderPanelStrings.get(uiLanguage, "deleteWarning")) },
            confirmButton = { TextButton(enabled = !busy, onClick = {
                deletion = null
                task { organization.deleteFolder(old, store) }
            }) { Text(NativeReaderPanelStrings.get(uiLanguage, "deleteFolder")) } },
            dismissButton = { TextButton(onClick = { deletion = null }) {
                Text(NativeReaderPanelStrings.get(uiLanguage, "cancel"))
            } })
    }
}

@Composable
fun NativeReaderQueueManager(
    english: Boolean, books: List<ReaderBook>, queuedIds: List<String>,
    organization: NativeReaderOrganization,
    onChanged: () -> Unit, onOpen: (ReaderBook) -> Unit, onBack: () -> Unit
) {
    val uiLanguage = LocalNativeUiLanguage.current
    val scope = rememberCoroutineScope()
    var error by remember { mutableStateOf("") }
    val ids = queuedIds
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
        TextButton(onClick = onBack) { Text(NativeReaderPanelStrings.get(uiLanguage, "backFilters")) }
        Text(NativeReaderPanelStrings.get(uiLanguage, "queue"),
            style = MaterialTheme.typography.headlineSmall, modifier = Modifier.semantics { heading() })
        if (ids.isEmpty()) Text(NativeReaderPanelStrings.get(uiLanguage, "queueEmpty"))
        ids.forEachIndexed { i, id ->
            val book = mapped[id] ?: return@forEachIndexed
            Text((i + 1).toString() + ". " + book.title, style = MaterialTheme.typography.titleMedium)
            Row {
                TextButton(onClick = { onOpen(book) }) { Text(NativeReaderPanelStrings.get(uiLanguage, "open")) }
                TextButton(enabled = i > 0,
                    onClick = { modify { organization.moveInQueue(id, -1, books) } }) {
                    Text(NativeReaderPanelStrings.get(uiLanguage, "up"))
                }
                TextButton(enabled = i < ids.lastIndex,
                    onClick = { modify { organization.moveInQueue(id, 1, books) } }) {
                    Text(NativeReaderPanelStrings.get(uiLanguage, "down"))
                }
                TextButton(onClick = {
                    modify { organization.removeFromQueue(id, books) }
                }) { Text(NativeReaderPanelStrings.get(uiLanguage, "remove")) }
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
    val uiLanguage = LocalNativeUiLanguage.current
    BackHandler { onBack() }
    val marks = book.audioMarks.ifEmpty {
        book.marks.map { ReaderAudioMark(book.trackIndex, it) }
    }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)) {
        TextButton(onClick = onBack) {
            Text(NativeReaderPanelStrings.get(uiLanguage, "backLibrary"))
        }
        Text(NativeReaderPanelStrings.get(uiLanguage, "marks") + book.title,
            style = MaterialTheme.typography.headlineSmall,
            modifier = Modifier.semantics { heading() })
        if (book.tracks.isNotEmpty()) {
            if (marks.isEmpty()) Text(NativeReaderPanelStrings.get(uiLanguage, "noMarks"))
            marks.forEachIndexed { i, mark ->
                OutlinedButton(onClick = { onAudioMark(mark) }, modifier = Modifier.fillMaxWidth()) {
                    Text(NativeReaderPanelStrings.get(uiLanguage, "mark") + (i + 1) +
                        NativeReaderPanelStrings.get(uiLanguage, "section") + (mark.segmentIndex + 1) +
                        NativeReaderPanelStrings.get(uiLanguage, "at") + (mark.positionMs / 1000) + " s")
                }
            }
        } else {
            if (book.marks.isEmpty()) Text(NativeReaderPanelStrings.get(uiLanguage, "noMarks"))
            book.marks.forEachIndexed { i, offset ->
                OutlinedButton(onClick = { onTextMark(offset) }, modifier = Modifier.fillMaxWidth()) {
                    Text(NativeReaderPanelStrings.get(uiLanguage, "mark") + (i + 1) +
                        ", " + ReaderUnits.percent(offset, book.length) + "%")
                }
            }
        }
    }
}
