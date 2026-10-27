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
        message = if (english) "Preparing OCR…" else "Preparando OCR…"
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
                message = if (english) "OCR completed. The accessible text is available in the reader."
                    else "OCR terminado. El texto accesible está disponible en el lector."
            } catch (_: CancellationException) {
                message = if (english) "OCR paused. Progress was saved; tap Resume to continue."
                    else "OCR interrumpido. El avance está guardado; pulsa Reanudar para continuar."
                onTextRefreshed()
            } catch (_: InterruptedException) {
                message = if (english) "OCR paused. You can resume it."
                    else "OCR pausado. Puedes reanudarlo."
                onTextRefreshed()
            } catch (e: Exception) {
                message = e.message ?: "No se pudo completar el OCR."
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
        Text(if (english) "Advanced OCR" else "OCR avanzado",
            style = MaterialTheme.typography.titleMedium,
            modifier = Modifier.semantics { heading() })
        Text(if (mode == "pdf") {
            if (english) "Processes large PDFs page by page; retains selectable text where available."
            else "Reconoce PDF grandes por páginas y conserva el texto seleccionable que ya exista."
        } else {
            if (english) "Recognizes compatible embedded images in this EPUB/Office document."
            else "Reconoce las imágenes incrustadas compatibles de este EPUB o documento Office."
        })
        if (progress.total > 0) Text(
            (if (english) "Saved progress: " else "Avance guardado: ") +
                progress.finished + " / " + progress.total +
                if (progress.complete) (if (english) ". Complete" else ". Completo") else ""
        )
        Button(enabled = !busy, modifier = Modifier.fillMaxWidth(), onClick = { runRecognition() }) {
            Text(when {
                progress.complete -> if (english) "Review OCR again" else "Comprobar OCR nuevamente"
                progress.finished > 0 -> if (english) "Resume OCR" else "Reanudar OCR"
                mode == "pdf" -> if (english) "Recognize PDF in batches" else "Reconocer PDF por lotes"
                else -> if (english) "Recognize embedded images" else "Reconocer imágenes incrustadas"
            })
        }
        if (busy) TextButton(onClick = { job?.cancel() }) {
            Text(if (english) "Cancel OCR and save progress" else "Cancelar OCR y guardar el avance")
        }
        if (message.isNotBlank()) Text(message)
        Text(if (english)
            "Pages or images are saved individually. After a cancellation or app closure, start OCR again to resume. The original stays intact."
            else "Cada página o imagen queda guardada por separado. Tras cancelar o cerrar la aplicación, puedes reanudar desde aquí. El original no se modifica.")
    }
}
