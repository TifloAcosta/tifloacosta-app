package com.tifloacosta.nativeprototype

import android.content.Context
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.net.Uri
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue

class NativeMusicPlayer(private val context: Context) {
    var currentTitle by mutableStateOf("")
        private set
    var playing by mutableStateOf(false)
        private set
    var error by mutableStateOf<String?>(null)
    var progressMs by mutableStateOf(0)
        private set
    var durationMs by mutableStateOf(0)
        private set

    private var audio: MediaPlayer? = null
    private var queue: List<Pair<String, String>> = emptyList()
    private var index = -1

    fun play(uri: String, title: String, songs: List<Pair<String, String>>) {
        queue = songs
        index = queue.indexOfFirst { it.first == uri }
        if (index >= 0) startCurrent()
    }

    private fun startCurrent() {
        if (index !in queue.indices) { stop(); return }
        val item = queue[index]
        try {
            audio?.release()
            audio = null
            val player = MediaPlayer()
            player.setAudioAttributes(AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_MEDIA)
                .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build())
            player.setDataSource(context, Uri.parse(item.first))
            player.prepare()
            player.setOnCompletionListener { next() }
            player.start()
            audio = player
            currentTitle = item.second
            durationMs = player.duration
            progressMs = 0
            playing = true
        } catch (failure: Exception) {
            error = "No se pudo reproducir la canción: ${failure.localizedMessage ?: "archivo no disponible"}"
            stop()
        }
    }

    fun toggle() {
        audio?.let { player ->
            if (player.isPlaying) player.pause() else player.start()
            playing = player.isPlaying
        }
    }

    fun next() { index += 1; startCurrent() }
    fun previous() { index = (index - 1).coerceAtLeast(0); startCurrent() }
    fun skip(seconds: Int) {
        audio?.let { player ->
            val destination = (player.currentPosition.toLong() + seconds.toLong() * 1000)
                .coerceIn(0L, player.duration.toLong()).toInt()
            player.seekTo(destination)
            progressMs = destination
        }
    }

    fun updateProgress() {
        audio?.let { if (it.isPlaying) progressMs = it.currentPosition }
    }

    fun stop() {
        audio?.release()
        audio = null
        currentTitle = ""
        playing = false
        progressMs = 0
        durationMs = 0
    }
}
