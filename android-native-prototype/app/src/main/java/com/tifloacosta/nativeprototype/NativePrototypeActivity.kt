package com.tifloacosta.nativeprototype

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Slider
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.CustomAccessibilityAction
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.customActions
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.unit.dp
import java.util.Locale
import kotlin.math.roundToInt

object PrototypeNavigation {
    const val HOME = -1
    const val NEWS = 0
    const val RESOURCES = 1
    fun parentOf(destination: Int): Int = HOME
}

class NativePrototypeActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme(colorScheme = if (isSystemInDarkTheme()) darkColorScheme() else lightColorScheme()) {
                PrototypeHome()
            }
        }
    }
}

@Composable
private fun AdjustableSelector(
    label: String,
    choices: List<String>,
    selected: Int,
    english: Boolean,
    onSelected: (Int) -> Unit
) {
    if (choices.isEmpty()) return
    val index = selected.coerceIn(0, choices.lastIndex)
    val value = choices[index]
    val previous = if (english) "Previous option" else "Opción anterior"
    val next = if (english) "Next option" else "Opción siguiente"

    Column(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
        Text(
            "$label: $value",
            style = MaterialTheme.typography.titleMedium,
            // The native adjustable Slider is the single TalkBack stop.
            modifier = Modifier.clearAndSetSemantics { }
        )
        if (choices.size > 1) {
            Slider(
                value = index.toFloat(),
                onValueChange = { onSelected(it.roundToInt().coerceIn(0, choices.lastIndex)) },
                valueRange = 0f..choices.lastIndex.toFloat(),
                steps = (choices.size - 2).coerceAtLeast(0),
                modifier = Modifier
                    .fillMaxWidth()
                    .semantics {
                        contentDescription = label
                        stateDescription = value
                        customActions = listOf(
                            CustomAccessibilityAction(previous) {
                                onSelected((index - 1).coerceAtLeast(0))
                                true
                            },
                            CustomAccessibilityAction(next) {
                                onSelected((index + 1).coerceAtMost(choices.lastIndex))
                                true
                            }
                        )
                    }
            )
        }
    }
}

@Composable
private fun PrototypeHome() {
    val context = LocalContext.current
    val language = if (Locale.getDefault().language == "en") "en" else "es"
    val english = language == "en"
    var loaded by remember { mutableStateOf(CatalogLoad(Catalog())) }
    var loading by remember { mutableStateOf(true) }
    var section by rememberSaveable { mutableIntStateOf(PrototypeNavigation.HOME) }
    var mediaIndex by rememberSaveable { mutableIntStateOf(0) }
    var newsCategory by rememberSaveable { mutableIntStateOf(0) }
    var resourceCategory by rememberSaveable { mutableIntStateOf(0) }
    var visibleCount by rememberSaveable { mutableIntStateOf(10) }
    var selectedItem by remember { mutableStateOf<CatalogItem?>(null) }

    LaunchedEffect(Unit) {
        loaded = CatalogRepository.load(context)
        loading = false
    }

    val news = loaded.catalog.news.filter { it.language == language }
    val resources = loaded.catalog.resources.filter { it.language == language }
    val newsCategories = CatalogLogic.newsCategories(news)
    val resourceCategories = CatalogLogic.resourceCategories(resources)

    val newsChoices = listOf(
        if (english) "Choose a category" else "Selecciona una categoría",
        if (english) "All categories" else "Todas las categorías"
    ) + newsCategories.map(CatalogLogic::categoryLabel)

    val resourceChoices = listOf(
        if (english) "Choose a category" else "Selecciona una categoría"
    ) + resourceCategories

    val mediaChoices = if (english)
        listOf("News categories", "Podcasts", "YouTube channels", "All media")
    else listOf("Categorías de noticias", "Podcasts", "Canales de YouTube", "Todos los formatos")

    val filtered = if (section == PrototypeNavigation.NEWS) {
        if (mediaIndex == 0) CatalogLogic.newsForCategory(news, newsCategories, newsCategory)
        else emptyList()
    } else if (section == PrototypeNavigation.RESOURCES) {
        CatalogLogic.resourcesForCategory(resources, resourceCategories, resourceCategory)
    } else emptyList()

    val title = if (english) "TifloAcosta Native Trial" else "TifloAcosta Nativa Pruebas"
    val first = if (english) "News" else "Actualidad"
    val second = if (english) "Resources" else "Recursos"

    BackHandler(enabled = section != PrototypeNavigation.HOME && selectedItem == null) {
        section = PrototypeNavigation.parentOf(section)
    }

    Scaffold(modifier = Modifier.fillMaxSize()) { inner ->
        Column(modifier = Modifier.fillMaxSize().padding(inner).padding(horizontal = 16.dp)) {
            if (section == PrototypeNavigation.HOME) {
                Text(
                    title,
                    style = MaterialTheme.typography.headlineSmall,
                    modifier = Modifier.padding(vertical = 14.dp).semantics { heading() }
                )
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(
                        onClick = { section = PrototypeNavigation.NEWS; visibleCount = 10 },
                        modifier = Modifier.fillMaxWidth()
                    ) { Text(first) }
                    Button(
                        onClick = { section = PrototypeNavigation.RESOURCES; visibleCount = 10 },
                        modifier = Modifier.fillMaxWidth()
                    ) { Text(second) }
                }
            } else {
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    TextButton(
                        onClick = { section = PrototypeNavigation.parentOf(section) }
                    ) { Text(if (english) "Back" else "Volver") }
                    Text(
                        if (section == PrototypeNavigation.NEWS) first else second,
                        style = MaterialTheme.typography.headlineSmall,
                        modifier = Modifier.padding(vertical = 12.dp).semantics { heading() }
                    )
                }
                HorizontalDivider(Modifier.padding(vertical = 10.dp))
            }

            if (section == PrototypeNavigation.NEWS) {
                AdjustableSelector(
                    label = if (english) "Content type" else "Tipo de contenido",
                    choices = mediaChoices, selected = mediaIndex, english = english
                ) { mediaIndex = it; visibleCount = 10 }

                if (mediaIndex == 0) {
                    AdjustableSelector(
                        label = if (english) "Category" else "Categoría",
                        choices = newsChoices, selected = newsCategory, english = english
                    ) { newsCategory = it; visibleCount = 10 }
                }
            } else if (section == PrototypeNavigation.RESOURCES) {
                AdjustableSelector(
                    label = if (english) "Category" else "Categoría",
                    choices = resourceChoices, selected = resourceCategory, english = english
                ) { resourceCategory = it; visibleCount = 10 }
            }

            if (section != PrototypeNavigation.HOME && loading) {
                Text(if (english) "Loading..." else "Cargando…")
            }
            if (section != PrototypeNavigation.HOME && loaded.status.isNotEmpty()) Text(loaded.status)
            if (section == PrototypeNavigation.NEWS && mediaIndex != 0) {
                Text(
                    if (english) "Media options are not connected in this first prototype."
                    else "Los contenidos multimedia todavía no están conectados en este primer prototipo."
                )
            } else if (!loading && section != PrototypeNavigation.HOME && filtered.isEmpty()) {
                val selectionMade = if (section == PrototypeNavigation.NEWS) newsCategory > 0
                    else resourceCategory > 0
                if (selectionMade) {
                    Text(if (english) "No results." else "Sin resultados.")
                }
            } else if (!loading && section != PrototypeNavigation.HOME) {
                val count = filtered.size
                Text(
                    if (english) "$count results" else "$count resultados",
                    style = MaterialTheme.typography.titleMedium,
                    modifier = Modifier.padding(vertical = 8.dp).semantics { heading() }
                )
                LazyColumn(modifier = Modifier.weight(1f)) {
                    itemsIndexed(
                        items = filtered.take(visibleCount),
                        key = { index, item -> "$index-${item.id}" }
                    ) { _, item ->
                        OutlinedButton(
                            modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                            onClick = { selectedItem = item }
                        ) {
                            // Single accessible title; no metadata/buttons between rows.
                            Text(item.title)
                        }
                    }
                    if (count > visibleCount) {
                        item {
                            TextButton(onClick = { visibleCount += 10 }) {
                                Text(if (english) "Show ten more" else "Mostrar diez más")
                            }
                        }
                    }
                }
            }
        }
    }

    selectedItem?.let { item ->
        AlertDialog(
            onDismissRequest = { selectedItem = null },
            title = { Text(item.title) },
            text = {
                Column(
                    modifier = Modifier.heightIn(max = 340.dp).verticalScroll(rememberScrollState())
                ) {
                    Text(item.summary.ifBlank {
                        if (english) "No additional description." else "No hay descripción adicional."
                    })
                }
            },
            confirmButton = {
                if (item.url.isNotEmpty()) {
                    TextButton(onClick = {
                        context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(item.url)))
                    }) {
                        Text(if (english) "Open original" else "Abrir original")
                    }
                }
            },
            dismissButton = {
                TextButton(onClick = { selectedItem = null }) {
                    Text(if (english) "Close" else "Cerrar")
                }
            }
        )
    }
}
