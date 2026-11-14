package com.tifloacosta.nativeprototype

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp

/** One topic at a time prevents TalkBack from announcing the entire guide at once. */
@Composable
internal fun NativeUsageGuideScreen() {
    val uiLanguage = LocalNativeUiLanguage.current
    var selected by rememberSaveable { mutableStateOf("") }
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        if (selected.isNotEmpty()) {
            TextButton(onClick = { selected = "" }) { Text(NativeUiText.get(uiLanguage, "back")) }
            Text(
                NativeUsageGuideStrings.title(uiLanguage, selected),
                style = MaterialTheme.typography.titleLarge,
                modifier = Modifier.semantics { heading() }
            )
            NativeUsageGuideStrings.paragraphs(uiLanguage, selected).forEach { paragraph ->
                Text(paragraph, modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp))
            }
        } else {
            NativeUsageGuideStrings.topics().forEach { topic ->
                OutlinedButton(modifier = Modifier.fillMaxWidth(), onClick = { selected = topic }) {
                    Text(NativeUsageGuideStrings.title(uiLanguage, topic))
                }
            }
        }
    }
}
