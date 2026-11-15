package com.tifloacosta.nativeprototype

import android.os.Handler
import android.os.Looper
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * OCR is opt-in for heavyweight books, and the foreground UI owns the job.
 * Navigation away pauses after current page; checkpoint persists for next visit.
 */
@Composable
fun NativeReaderAdvancedOcrPanel(
    book: ReaderBook,
    store: NativeReaderStore,
    english: Boolean,
    onTextRefreshed: () -> Unit
) {
    val context = androidx.compose.ui.platform.LocalContext.current
    val uiLanguage = LocalNativeUiLanguage.current
    val scope = rememberCoroutineScope()
    val main = remember { Handler(Looper.getMainLooper()) }
    val mode = when {
        book.format == "pdf" -> "pdf"
        NativeReaderAdvancedOcr.sourceSupportsEmbeddedImages(book.format) -> "images"
        else -> ""
    }
    if (mode.isBlank()) return
    var progress by remember(book.id, mode) {
        mutableStateOf(NativeReaderAdvancedOcr.progress(context, book, mode))
    }
    var message by remember(book.id) { mutableStateOf("") }
    var busy by remember(book.id) { mutableStateOf(false) }
    var job by remember(book.id) { mutableStateOf<Job?>(null) }
    fun runRecognition() {
        if (busy) return
        busy = true
        message = NativeReaderOcrStrings.get(uiLanguage, "preparing")
        job = scope.launch {
            val parent = currentCoroutineContext()
            try {
                val final = withContext(Dispatchers.IO) {
                    val next = { parent.isActive }
                    val report: (NativeReaderAdvancedOcr.Progress) -> Unit = { value ->
                        main.post { progress = value }
                    }
                    if (mode == "pdf") NativeReaderAdvancedOcr.pdf(
                        context, book, store, next, report)
                    else NativeReaderAdvancedOcr.embeddedImages(
                        context, book, store, next, report)
                }
                progress = final
                onTextRefreshed()
                message = NativeReaderOcrStrings.get(uiLanguage, "completed")
            } catch (_: CancellationException) {
                message = NativeReaderOcrStrings.get(uiLanguage, "interrupted")
                onTextRefreshed()
            } catch (_: InterruptedException) {
                message = NativeReaderOcrStrings.get(uiLanguage, "paused")
                onTextRefreshed()
            } catch (e: Exception) {
                message = e.message ?: NativeReaderOcrStrings.get(uiLanguage, "error")
                onTextRefreshed()
            } finally {
                progress = NativeReaderAdvancedOcr.progress(context, book, mode)
                busy = false
            }
        }
    }
    val currentJob by rememberUpdatedState(job)
    DisposableEffect(book.id, mode) {
        onDispose { currentJob?.cancel() }
    }
    Column(verticalArrangement = Arrangement.spacedBy(8.dp),
        modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp)) {
        Text(NativeReaderOcrStrings.get(uiLanguage, "title"),
            style = MaterialTheme.typography.titleMedium,
            modifier = Modifier.semantics { heading() })
        Text(NativeReaderOcrStrings.get(uiLanguage,
            if (mode == "pdf") "pdfInfo" else "imagesInfo"))
        if (progress.total > 0) Text(
            NativeReaderOcrStrings.get(uiLanguage, "savedProgress") + ": " +
                progress.finished + " / " + progress.total +
                if (progress.complete) ". " + NativeReaderOcrStrings.get(uiLanguage, "complete") else ""
        )
        Button(enabled = !busy, modifier = Modifier.fillMaxWidth(), onClick = { runRecognition() }) {
            Text(when {
                progress.complete -> NativeReaderOcrStrings.get(uiLanguage, "review")
                progress.finished > 0 -> NativeReaderOcrStrings.get(uiLanguage, "resume")
                mode == "pdf" -> NativeReaderOcrStrings.get(uiLanguage, "recognizePdf")
                else -> NativeReaderOcrStrings.get(uiLanguage, "recognizeImages")
            })
        }
        if (busy) TextButton(onClick = { job?.cancel() }) {
            Text(NativeReaderOcrStrings.get(uiLanguage, "cancel"))
        }
        if (message.isNotBlank()) Text(message)
        Text(NativeReaderOcrStrings.get(uiLanguage, "help"))
    }
}
