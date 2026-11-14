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
    val uiLanguage = LocalNativeUiLanguage.current
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
            Text(NativeReaderPronunciationStrings.get(uiLanguage, "back"))
        }
        Text(
            NativeReaderPronunciationStrings.get(uiLanguage, "title"),
            style = MaterialTheme.typography.headlineSmall,
            modifier = Modifier.semantics { heading() }
        )
        Text(
            NativeReaderPronunciationStrings.get(uiLanguage, "help")
        )
        TextField(
            value = original,
            onValueChange = { original = it.take(80) },
            label = { Text(NativeReaderPronunciationStrings.get(uiLanguage, "written")) },
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )
        TextField(
            value = spoken,
            onValueChange = { spoken = it.take(120) },
            label = { Text(NativeReaderPronunciationStrings.get(uiLanguage, "spoken")) },
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
                    feedback = NativeReaderPronunciationStrings.get(uiLanguage, "fields")
                } else {
                    store.save(next)
                    rules = next
                    original = ""
                    spoken = ""
                    feedback = NativeReaderPronunciationStrings.get(uiLanguage, "saved")
                }
            }
        ) { Text(NativeReaderPronunciationStrings.get(uiLanguage, "save")) }
        if (rules.isEmpty()) {
            Text(NativeReaderPronunciationStrings.get(uiLanguage, "empty"))
        } else {
            rules.forEach { rule ->
                TextButton(
                    modifier = Modifier.fillMaxWidth(),
                    onClick = { removing = rule }
                ) {
                    Text(rule.original + ": " + rule.spoken +
                        NativeReaderPronunciationStrings.get(uiLanguage, "deleteAction"))
                }
            }
        }
        if (feedback.isNotBlank()) Text(feedback)
    }

    removing?.let { rule ->
        AlertDialog(
            onDismissRequest = { removing = null },
            title = { Text(NativeReaderPronunciationStrings.get(uiLanguage, "confirm")) },
            text = { Text(rule.original + ": " + rule.spoken) },
            confirmButton = {
                TextButton(onClick = {
                    val next = rules.filterNot { it.original == rule.original }
                    store.save(next)
                    rules = next
                    removing = null
                }) { Text(NativeReaderPronunciationStrings.get(uiLanguage, "delete")) }
            },
            dismissButton = {
                TextButton(onClick = { removing = null }) {
                    Text(NativeReaderPronunciationStrings.get(uiLanguage, "cancel"))
                }
            }
        )
    }
}
