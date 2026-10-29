package com.tifloacosta.nativeprototype

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TextField
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp

/** Independent DAISY navigation page: opens from inside an audiobook only. */
@Composable
fun NativeDaisyNavigationScreen(
    book: ReaderBook,
    english: Boolean,
    currentSegment: Int,
    onGo: (Int) -> Unit,
    onBack: () -> Unit
) {
    val points = book.daisyNavigation
    val clips = book.audioSegments
    val choices = if (english)
        listOf("Headings", "Pages", "Notes", "Other references", "Audio fragments")
    else listOf("Encabezados", "Páginas", "Notas", "Otros puntos", "Fragmentos de audio")
    var kind by remember(book.id) {
        mutableIntStateOf(if (points.any { it.kind == "heading" }) 0 else 4)
    }
    var level by remember(book.id) { mutableIntStateOf(0) }
    var requestedPage by remember(book.id) { mutableStateOf("") }
    var pageMessage by remember(book.id) { mutableStateOf("") }
    var count by remember(book.id, kind, level) { mutableIntStateOf(10) }
    val filtered = when (kind) {
        0 -> NativeDaisyNavigation.filter(points, "heading", level)
        1 -> NativeDaisyNavigation.filter(points, "page")
        2 -> NativeDaisyNavigation.filter(points, "note")
        3 -> NativeDaisyNavigation.filter(points, "landmark")
        else -> clips.indices.map { i ->
            ReaderDaisyNavPoint("fragment", 0, clips[i].label.ifBlank {
                (if (english) "Fragment " else "Fragmento ") + (i + 1)
            }, i)
        }
    }
    BackHandler { onBack() }
    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        TextButton(onClick = onBack) {
            Text(if (english) "Back to audiobook" else "Volver al audiolibro")
        }
        Text(if (english) "DAISY navigation" else "Navegación DAISY",
            style = MaterialTheme.typography.headlineSmall,
            modifier = Modifier.semantics { heading() })
        Text(book.title)
        ReaderAdjustableChoice(
            if (english) "Navigate by" else "Navegar por",
            choices, kind
        ) { kind = it; count = 10; level = 0 }
        if (kind == 0) {
            ReaderAdjustableChoice(
                if (english) "Heading level" else "Nivel de encabezado",
                if (english) listOf("All levels", "Level 1", "Level 2",
                    "Level 3", "Level 4", "Level 5", "Level 6")
                else listOf("Todos los niveles", "Nivel 1", "Nivel 2",
                    "Nivel 3", "Nivel 4", "Nivel 5", "Nivel 6"), level
            ) { level = it; count = 10 }
        }
        if (kind == 1 && filtered.isNotEmpty()) {
            TextField(value = requestedPage,
                onValueChange = { requestedPage = it.take(30); pageMessage = "" },
                singleLine = true,
                label = { Text(if (english) "Printed page number" else "Número de página") },
                modifier = Modifier.fillMaxWidth())
            Button(onClick = {
                val match = filtered.firstOrNull {
                    it.label.trim().equals(requestedPage.trim(), ignoreCase = true)
                }
                if (match == null) pageMessage = if (english)
                    "That page number is not indexed in this DAISY."
                    else "Esa página no está identificada en este DAISY."
                else onGo(match.segmentIndex)
            }, enabled = requestedPage.isNotBlank()) {
                Text(if (english) "Go to page" else "Ir a página")
            }
            if (pageMessage.isNotBlank()) Text(pageMessage)
        }
        Text((if (english) "Entries: " else "Entradas: ") + filtered.size)
        if (filtered.isEmpty()) {
            Text(if (english) "This DAISY book does not include navigation points of this type."
                else "Este DAISY no contiene puntos de navegación de esta clase.")
        }
        filtered.take(count).forEachIndexed { ordinal, point ->
            val caption = if (point.kind == "heading") {
                (if (english) "Level " else "Nivel ") + point.level + ", " + point.label
            } else if (point.kind == "fragment") {
                (if (english) "Fragment " else "Fragmento ") + (point.segmentIndex + 1) +
                    ", " + point.label
            } else point.label
            Button(
                onClick = { onGo(point.segmentIndex) },
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(caption + if (point.segmentIndex == currentSegment)
                    (if (english) ", current" else ", actual") else "")
            }
        }
        if (filtered.size > count) {
            TextButton(onClick = { count += 10 }) {
                Text(if (english) "Show ten more" else "Mostrar diez más")
            }
        }
    }
}
