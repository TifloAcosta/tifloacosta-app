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
import androidx.compose.ui.semantics.heading
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
        progress = if (english) "Preparing…" else "Preparando…"
        running = scope.launch {
            val task = currentCoroutineContext()
            try {
                if (isRestore) {
                    val result = withContext(Dispatchers.IO) {
                        NativeReaderBackup.restore(context, uri,
                            onProgress = { count, _ ->
                                main.post { progress = (if (english) "Checking file " else "Comprobando archivo ") + count }
                            }, keepWorking = { task.isActive })
                    }
                    onRestored()
                    message = if (english)
                        "Restored " + result.added + " books. " + result.skipped +
                        " already existed. Folders: " + result.folders
                    else "Libros incorporados: " + result.added + ". Ya existían: " +
                        result.skipped + ". Carpetas: " + result.folders
                } else {
                    withContext(Dispatchers.IO) {
                        NativeReaderBackup.export(context, uri,
                            onProgress = { count, total ->
                                main.post { progress = (if (english) "Backing up " else "Guardando ") +
                                    count + " / " + total }
                            }, keepWorking = { task.isActive })
                    }
                    message = if (english) "Backup created. Keep the ZIP outside this app."
                        else "Copia creada. Conserva el ZIP fuera de esta aplicación."
                }
            } catch (e: Exception) {
                if (!isRestore) {
                    // Remove an unfinished copy from the user's chosen destination.
                    try { context.contentResolver.delete(uri, null, null) } catch (_: Exception) {}
                }
                message = if (e is CancellationException || e is InterruptedException)
                    (if (english) "Operation canceled. No existing books were deleted."
                        else "Operación cancelada. No se ha eliminado ningún libro existente.")
                else e.message ?: if (english) "The operation failed."
                    else "No se pudo completar la operación."
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
            Text(if (english) "Back to settings" else "Volver a Ajustes")
        }
        Text(if (english) "Backup and restore" else "Copia de seguridad y restauración",
            style = MaterialTheme.typography.headlineSmall,
            modifier = Modifier.semantics { heading() })
        Text(if (english)
            "Create a portable copy before uninstalling a test build. Includes books, originals, audio, OCR checkpoints, bookmarks, folders and reading queue. Save outside this app."
            else "Haz una copia antes de desinstalar una versión de pruebas. Incluye libros, originales, audios, avances de OCR, marcas, carpetas y cola. Guárdala fuera de esta aplicación.")
        Button(enabled = !working, onClick = { save.launch(NativeReaderBackup.ARCHIVE_NAME) },
            modifier = Modifier.fillMaxWidth()) {
            Text(if (english) "Export library backup…" else "Exportar copia de la biblioteca…")
        }
        Button(enabled = !working,
            onClick = { open.launch(arrayOf("application/zip", "application/octet-stream", "*/*")) },
            modifier = Modifier.fillMaxWidth()) {
            Text(if (english) "Restore from backup ZIP…" else "Restaurar desde ZIP de copia…")
        }
        Text(if (english) "Restore adds missing books without overwriting existing ones. Only use your own backups."
            else "La restauración añade libros sin sobrescribir los existentes. Utiliza únicamente tus propias copias.")
        if (working) {
            TextButton(onClick = { running?.cancel() }) {
                Text(if (english) "Cancel operation" else "Cancelar operación")
            }
        }
        if (progress.isNotBlank()) Text(progress)
        if (message.isNotBlank()) Text(message)
    }
    selectedBackup?.let { uri ->
        AlertDialog(onDismissRequest = { selectedBackup = null },
            title = { Text(if (english) "Restore backup?" else "¿Restaurar esta copia?") },
            text = { Text(if (english)
                "This may require significant storage. Existing books stay untouched. Continue?"
                else "Puede necesitar bastante almacenamiento. Los libros existentes se conservarán. ¿Continuar?") },
            confirmButton = { TextButton(onClick = {
                selectedBackup = null
                run(true, uri)
            }) { Text(if (english) "Restore" else "Restaurar") } },
            dismissButton = { TextButton(onClick = { selectedBackup = null }) {
                Text(if (english) "Cancel" else "Cancelar")
            } })
    }
}
