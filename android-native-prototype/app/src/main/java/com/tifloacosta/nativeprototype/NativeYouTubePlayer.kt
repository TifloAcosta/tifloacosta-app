package com.tifloacosta.nativeprototype

import android.content.Intent
import android.net.Uri
import android.view.View
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Slider
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import org.json.JSONObject
import org.json.JSONTokener

private const val PLAYER_ORIGIN = "https://com.tifloacosta.nativeprototype"

/** Official YouTube IFrame API; YouTube content stays on YouTube's player. */
private fun embeddedHtml(id: String): String = """
<!doctype html>
<html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="referrer" content="strict-origin-when-cross-origin">
<style>html,body,#player{margin:0;width:100%;height:100%;overflow:hidden;background:#000}</style>
</head><body><div id="player"></div>
<script>
var yt=null,ready=false,ytError=0;
function onYouTubeIframeAPIReady(){
  yt=new YT.Player('player',{
    videoId:'VIDEO_ID_TOKEN', width:'100%',height:'100%',
    playerVars:{controls:1,playsinline:1,rel:0,origin:'ORIGIN_TOKEN'},
    events:{
      onReady:function(){ready=true;},
      onError:function(e){ytError=e.data || -1;}
    }
  });
}
function nativeSnapshot(){
  try {
    if(!ready||!yt) return JSON.stringify({ready:false,error:ytError});
    return JSON.stringify({ready:true,error:ytError,state:yt.getPlayerState(),
      position:yt.getCurrentTime(),duration:yt.getDuration()});
  }catch(e){return JSON.stringify({ready:false,error:ytError});}
}
</script><script src="https://www.youtube.com/iframe_api"></script>
</body></html>
""".trimIndent().replace("VIDEO_ID_TOKEN", id).replace("ORIGIN_TOKEN", PLAYER_ORIGIN)

private data class YouTubeState(
    val ready: Boolean = false,
    val playing: Boolean = false,
    val seconds: Double = 0.0,
    val length: Double = 0.0,
    val error: Int = 0
)

private fun timeText(value: Double): String {
    val sec = value.coerceAtLeast(0.0).toLong()
    return (sec / 60).toString() + ":" + (sec % 60).toString().padStart(2, '0')
}

@Composable
fun NativeYouTubePlayer(
    item: MediaItem,
    english: Boolean,
    onBack: () -> Unit
) {
    val context = LocalContext.current
    val videoId = remember(item.originalUrl) { MediaLogic.youTubeVideoId(item.originalUrl) }
    var view by remember(videoId) { mutableStateOf<WebView?>(null) }
    var state by remember(videoId) { mutableStateOf(YouTubeState()) }
    var seeking by remember(videoId) { mutableStateOf(false) }
    var seekValue by remember(videoId) { mutableFloatStateOf(0f) }

    DisposableEffect(videoId) {
        onDispose {
            view?.apply {
                stopLoading()
                loadUrl("about:blank")
                destroy()
            }
            view = null
        }
    }

    LaunchedEffect(videoId) {
        while (isActive) {
            view?.evaluateJavascript(
                "(typeof nativeSnapshot === 'function' ? nativeSnapshot() : '{}')"
            ) { raw ->
                try {
                    val jsonText = JSONTokener(raw).nextValue() as? String ?: "{}"
                    val json = JSONObject(jsonText)
                    state = YouTubeState(
                        ready = json.optBoolean("ready"),
                        playing = json.optInt("state", -1) == 1,
                        seconds = json.optDouble("position", 0.0),
                        length = json.optDouble("duration", 0.0),
                        error = json.optInt("error", 0)
                    )
                } catch (_: Exception) { }
            }
            delay(950)
        }
    }

    val issue: (String) -> Unit = { command ->
        view?.evaluateJavascript(
            "if(window.ready && window.yt){" + command + "}", null
        )
    }

    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        TextButton(onClick = onBack) {
            Text(if (english) "Back to media" else "Volver a multimedia")
        }
        Text(item.title, style = MaterialTheme.typography.headlineSmall)
        if (videoId != null) {
            // Show official iframe and branding; TalkBack uses the simpler native controls below.
            AndroidView(
                factory = { c ->
                    WebView(c).apply {
                        settings.javaScriptEnabled = true
                        settings.domStorageEnabled = true
                        settings.mediaPlaybackRequiresUserGesture = false
                        settings.allowFileAccess = false
                        settings.allowContentAccess = false
                        webChromeClient = WebChromeClient()
                        webViewClient = WebViewClient()
                        importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS
                        loadDataWithBaseURL(
                            PLAYER_ORIGIN + "/",
                            embeddedHtml(videoId),
                            "text/html", "UTF-8", null
                        )
                        view = this
                    }
                },
                modifier = Modifier.fillMaxWidth().height(250.dp)
            )
            if (!state.ready && state.error == 0) {
                Text(if (english) "Loading YouTube player…" else "Cargando reproductor de YouTube…")
            }
            if (state.error != 0) {
                Text(
                    if (english) "YouTube has blocked embedded playback (error " + state.error + "). Use the original link."
                    else "YouTube no permite reproducir aquí este vídeo (error " + state.error + "). Utiliza el enlace original."
                )
            }
            val enabled = state.ready && state.error == 0
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(enabled = enabled, onClick = {
                    issue("yt.seekTo(Math.max(0,yt.getCurrentTime()-30),true);")
                }) {
                    Text(if (english) "Back 30 seconds" else "Retroceder 30 segundos")
                }
                Button(enabled = enabled, onClick = {
                    issue(if (state.playing) "yt.pauseVideo();" else "yt.playVideo();")
                }) {
                    Text(if (state.playing) (if (english) "Pause" else "Pausar")
                        else (if (english) "Play" else "Reproducir"))
                }
            }
            Button(enabled = enabled, onClick = {
                issue("yt.seekTo(yt.getCurrentTime()+30,true);")
            }) {
                Text(if (english) "Forward 30 seconds" else "Avanzar 30 segundos")
            }
            if (state.length > 0) {
                Slider(
                    value = (if (seeking) seekValue else
                        (state.seconds / state.length).toFloat()).coerceIn(0f, 1f),
                    enabled = enabled,
                    onValueChange = { seeking = true; seekValue = it },
                    onValueChangeFinished = {
                        issue("yt.seekTo(" + (seekValue * state.length) + ",true);")
                        seeking = false
                    },
                    modifier = Modifier.fillMaxWidth().semantics {
                        contentDescription = if (english) "Video position" else "Posición del vídeo"
                        stateDescription = timeText(state.seconds) + " / " + timeText(state.length)
                    }
                )
            }
            Text(
                timeText(state.seconds) + " / " + timeText(state.length),
                modifier = Modifier.clearAndSetSemantics { }
            )
        } else {
            Text(
                if (english) "This item does not contain a YouTube video link."
                else "Este contenido no incluye un enlace directo a un vídeo de YouTube."
            )
        }
        if (item.openUrl.isNotBlank()) {
            TextButton(onClick = {
                context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(item.openUrl)))
            }) {
                Text(if (english) "Open on YouTube (alternative)" else "Abrir en YouTube (alternativa)")
            }
        }
        if (item.summary.isNotBlank()) Text(item.summary)
    }
}
