package com.tifloacosta.nativeprototype

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TextField
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.CustomAccessibilityAction
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.customActions
import androidx.compose.ui.semantics.progressBarRangeInfo
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.setProgress
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import kotlin.math.roundToInt

/**
 * Uses the same single-title TalkBack action selector as TifloLector.
 * Account actions can be performed from the list, without opening the player.
 * This composable never changes playback, Google authorization or stored data.
 */
@Composable
fun NativeYouTubeListRow(
    item: CatalogItem,
    english: Boolean,
    account: NativeYouTubeAccount,
    onAuthorize: () -> Unit,
    onPlay: () -> Unit
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val videoId = remember(item.id, item.url) {
        MediaLogic.youTubeVideoId(item.url)
            ?: item.id.takeIf { it.matches(Regex("[A-Za-z0-9_-]{11}")) }
    }
    val link = videoId?.let { "https://www.youtube.com/watch?v=$it" }.orEmpty()
    val actions = buildList<Pair<String, String>> {
        add("play" to if (english) "Play video" else "Reproducir vídeo")
        if (videoId != null) {
            if (account.authenticated) {
                add("like" to if (english) "Like" else "Me gusta")
                add("subscribe" to if (english) "Subscribe" else "Suscribirme")
                add("comment" to if (english) "Comment" else "Comentar")
            } else {
                add("sign-in" to if (english) "Sign in with Google" else "Iniciar sesión con Google")
            }
            add("share" to if (english) "Share" else "Compartir")
            add("youtube" to if (english) "Open on YouTube" else "Abrir en YouTube")
        }
    }
    var selectedAction by remember(item.id, account.authenticated) { mutableIntStateOf(0) }
    val selected = selectedAction.coerceIn(0, actions.lastIndex)
    var editingComment by remember(item.id) { mutableStateOf(false) }
    var commentText by remember(item.id) { mutableStateOf("") }

    fun runAction(id: String) {
        when (id) {
            "play" -> onPlay()
            "sign-in" -> onAuthorize()
            "like", "subscribe" -> {
                if (videoId != null && account.authenticated && !account.busy) {
                    scope.launch { account.act(id, videoId) }
                }
            }
            "comment" -> {
                if (videoId != null && account.authenticated) editingComment = true
                else onAuthorize()
            }
            "share" -> {
                if (link.isNotEmpty()) {
                    context.startActivity(Intent.createChooser(
                        Intent(Intent.ACTION_SEND).apply {
                            type = "text/plain"
                            putExtra(Intent.EXTRA_TEXT, link)
                        }, if (english) "Share video" else "Compartir vídeo"
                    ))
                }
            }
            "youtube" -> {
                if (link.isNotEmpty()) {
                    context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(link)))
                }
            }
        }
    }

    OutlinedButton(
        onClick = { runAction(actions[selected].first) },
        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp).semantics {
            contentDescription = item.title
            stateDescription = (if (english) "Selected action: " else "Acción: ") +
                actions[selected].second
            if (actions.size > 1) {
                progressBarRangeInfo = ProgressBarRangeInfo(
                    selected.toFloat(), 0f..actions.lastIndex.toFloat(),
                    (actions.size - 2).coerceAtLeast(0)
                )
                setProgress { value ->
                    selectedAction = value.roundToInt().coerceIn(0, actions.lastIndex)
                    true
                }
            }
            customActions = actions.map { (id, label) ->
                CustomAccessibilityAction(label) { runAction(id); true }
            }
        }
    ) { Text(item.title) }

    if (editingComment && videoId != null) {
        AlertDialog(
            onDismissRequest = { editingComment = false },
            title = { Text(if (english) "Comment on YouTube" else "Comentar en YouTube") },
            text = {
                TextField(
                    value = commentText,
                    onValueChange = { commentText = it },
                    label = { Text(if (english) "Your comment" else "Tu comentario") },
                    maxLines = 5
                )
            },
            confirmButton = {
                TextButton(
                    enabled = commentText.isNotBlank() && !account.busy,
                    onClick = {
                        scope.launch {
                            if (account.act("comment", videoId, commentText)) {
                                commentText = ""
                                editingComment = false
                            }
                        }
                    }
                ) { Text(if (english) "Publish comment" else "Publicar comentario") }
            },
            dismissButton = {
                TextButton(onClick = { editingComment = false }) {
                    Text(if (english) "Cancel" else "Cancelar")
                }
            }
        )
    }
}
