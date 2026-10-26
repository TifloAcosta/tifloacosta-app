package com.tifloacosta.nativeprototype

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
import androidx.compose.material3.TextField
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp

/** Accessible global dictionary: changes speech only; readable book body stays intact. */
@Composable
fun NativePronunciationSettings(english: Boolean, onBack: () -> Unit) {
    val context = LocalContext.current
    val store = remember { NativePronunciationStore(context.applicationContext) }
    var rules by remember { mutableStateOf(store.read()) }
    var original by remember { mutableStateOf("") }
    var spoken by remember { mutableStateOf("") }
    var removing by remember { mutableStateOf<PronunciationRule?>(null) }
    var feedback by remember { mutableStateOf("") }

    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        TextButton(onClick = onBack) {
            Text(if (english) "Back to audio and voices" else "Volver a Audio y voces")
        }
        Text(
            if (english) "Pronunciation dictionary" else "Diccionario de pronunciación",
            style = MaterialTheme.typography.headlineSmall,
            modifier = Modifier.semantics { heading() }
        )
        Text(
            if (english) "Replace a word or phrase only while TifloLector speaks. " +
                "The original book, reading position and bookmarks remain unchanged."
            else "Cambia la pronunciación de una palabra o expresión al escucharla. " +
                "El documento original, su posición y sus marcas no se modifican."
        )
        TextField(
            value = original,
            onValueChange = { original = it.take(80) },
            label = { Text(if (english) "Written word" else "Palabra escrita") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )
        TextField(
            value = spoken,
            onValueChange = { spoken = it.take(120) },
            label = { Text(if (english) "Speak as" else "Pronunciar como") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )
        Button(
            modifier = Modifier.fillMaxWidth(),
            onClick = {
                val next = NativePronunciation.normalize(
                    rules.filterNot { it.original.equals(original.trim(), true) } +
                        PronunciationRule(original, spoken)
                )
                if (original.isBlank() || spoken.isBlank() || next.size == rules.size &&
                    next.none { it.original.equals(original.trim(), true) }) {
                    feedback = if (english) "Enter both fields." else "Completa los dos campos."
                } else {
                    store.save(next)
                    rules = next
                    original = ""
                    spoken = ""
                    feedback = if (english) "Pronunciation saved" else "Pronunciación guardada"
                }
            }
        ) { Text(if (english) "Save pronunciation" else "Guardar pronunciación") }
        if (rules.isEmpty()) {
            Text(if (english) "No pronunciation entries yet." else "Todavía no hay pronunciaciones guardadas.")
        } else {
            rules.forEach { rule ->
                TextButton(
                    modifier = Modifier.fillMaxWidth(),
                    onClick = { removing = rule }
                ) {
                    Text(rule.original + ": " + rule.spoken +
                        (if (english) ", delete" else ", eliminar"))
                }
            }
        }
        if (feedback.isNotBlank()) Text(feedback)
    }

    removing?.let { rule ->
        AlertDialog(
            onDismissRequest = { removing = null },
            title = { Text(if (english) "Delete pronunciation?" else "¿Eliminar pronunciación?") },
            text = { Text(rule.original + ": " + rule.spoken) },
            confirmButton = {
                TextButton(onClick = {
                    val next = rules.filterNot { it.original == rule.original }
                    store.save(next)
                    rules = next
                    removing = null
                }) { Text(if (english) "Delete" else "Eliminar") }
            },
            dismissButton = {
                TextButton(onClick = { removing = null }) {
                    Text(if (english) "Cancel" else "Cancelar")
                }
            }
        )
    }
}
