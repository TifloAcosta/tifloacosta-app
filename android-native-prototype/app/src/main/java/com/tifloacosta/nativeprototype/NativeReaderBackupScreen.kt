package com.tifloacosta.nativeprototype

import android.net.Uri
import android.os.Handler
import android.os.Looper
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.isActive
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@Composable
fun NativeReaderBackupScreen(english: Boolean, onRestored: () -> Unit, onBack: () -> Unit) {
    val context = LocalContext.current
    val uiLanguage = LocalNativeUiLanguage.current
    val scope = rememberCoroutineScope()
    val main = remember { Handler(Looper.getMainLooper()) }
    var working by remember { mutableStateOf(false) }
    var running by remember { mutableStateOf<Job?>(null) }
    var progress by remember { mutableStateOf("") }
    var message by remember { mutableStateOf("") }
    var selectedBackup by remember { mutableStateOf<Uri?>(null) }
    fun run(isRestore: Boolean, uri: Uri) {
        if (working) return
        working = true
        message = ""
        progress = NativeReaderToolsStrings.get(uiLanguage, "preparing")
        running = scope.launch {
            val task = currentCoroutineContext()
            try {
                if (isRestore) {
                    val result = withContext(Dispatchers.IO) {
                        NativeReaderBackup.restore(context, uri,
                            onProgress = { count, _ ->
                                main.post { progress = NativeReaderToolsStrings.get(uiLanguage, "checking") + " " + count }
                            }, keepWorking = { task.isActive })
                    }
                    onRestored()
                    message = NativeReaderToolsStrings.get(uiLanguage, "restoredCount") + ": " +
                        result.added + ". " + NativeReaderToolsStrings.get(uiLanguage, "alreadyExisted") +
                        ": " + result.skipped + ". " +
                        NativeReaderToolsStrings.get(uiLanguage, "foldersCount") + ": " + result.folders
                } else {
                    withContext(Dispatchers.IO) {
                        NativeReaderBackup.export(context, uri,
                            onProgress = { count, total ->
                                main.post { progress = NativeReaderToolsStrings.get(uiLanguage, "backing") + " " +
                                    count + " / " + total }
                            }, keepWorking = { task.isActive })
                    }
                    message = NativeReaderToolsStrings.get(uiLanguage, "backupCreated")
                }
            } catch (e: Exception) {
                if (!isRestore) {
                    // Remove an unfinished copy from the user's chosen destination.
                    try { context.contentResolver.delete(uri, null, null) } catch (_: Exception) {}
                }
                message = if (e is CancellationException || e is InterruptedException)
                    NativeReaderToolsStrings.get(uiLanguage, "operationCanceled")
                else e.message ?: NativeReaderToolsStrings.get(uiLanguage, "failed")
            } finally { working = false; progress = ""; running = null }
        }
    }
    val save = rememberLauncherForActivityResult(
        ActivityResultContracts.CreateDocument("application/zip")
    ) { uri -> if (uri != null) run(false, uri) }
    val open = rememberLauncherForActivityResult(
        ActivityResultContracts.OpenDocument()
    ) { uri -> if (uri != null) selectedBackup = uri }

    BackHandler(enabled = !working) { onBack() }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)) {
        TextButton(enabled = !working, onClick = onBack) {
            Text(NativeReaderToolsStrings.get(uiLanguage, "backupBack"))
        }
        Text(NativeReaderToolsStrings.get(uiLanguage, "backupTitle"),
            style = MaterialTheme.typography.headlineSmall,
            modifier = Modifier.semantics { heading() })
        Text(NativeReaderToolsStrings.get(uiLanguage, "backupIntro"))
        Text(NativeReaderToolsStrings.get(uiLanguage, "backupCompat"))
        Button(enabled = !working, onClick = { save.launch(NativeReaderBackup.ARCHIVE_NAME) },
            modifier = Modifier.fillMaxWidth()) {
            Text(NativeReaderToolsStrings.get(uiLanguage, "backupExport"))
        }
        Button(enabled = !working,
            onClick = { open.launch(arrayOf("application/zip", "application/octet-stream", "*/*")) },
            modifier = Modifier.fillMaxWidth()) {
            Text(NativeReaderToolsStrings.get(uiLanguage, "backupRestore"))
        }
        Text(NativeReaderToolsStrings.get(uiLanguage, "backupNote"))
        if (working) {
            TextButton(onClick = { running?.cancel() }) {
                Text(NativeReaderToolsStrings.get(uiLanguage, "cancelOperation"))
            }
        }
        if (progress.isNotBlank()) Text(progress,
            modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite })
        if (message.isNotBlank()) Text(message,
            modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite })
    }
    selectedBackup?.let { uri ->
        AlertDialog(onDismissRequest = { selectedBackup = null },
            title = { Text(NativeReaderToolsStrings.get(uiLanguage, "restoreConfirm")) },
            text = { Text(NativeReaderToolsStrings.get(uiLanguage, "restoreWarning")) },
            confirmButton = { TextButton(onClick = {
                selectedBackup = null
                run(true, uri)
            }) { Text(NativeReaderToolsStrings.get(uiLanguage, "restore")) } },
            dismissButton = { TextButton(onClick = { selectedBackup = null }) {
                Text(NativeReaderToolsStrings.get(uiLanguage, "cancel"))
            } })
    }
}
