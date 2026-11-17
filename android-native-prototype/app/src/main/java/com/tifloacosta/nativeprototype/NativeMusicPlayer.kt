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
    private val preferences = context.getSharedPreferences("mi-musica-player-v1", 0)
    var repeatMode by mutableStateOf(preferences.getString("repeat", "off") ?: "off")
        private set
    var shuffleEnabled by mutableStateOf(preferences.getBoolean("shuffle", false))
        private set
    var sleepRemainingSeconds by mutableStateOf(0)
        private set

    private var audio: MediaPlayer? = null
    private var queue: List<Pair<String, String>> = emptyList()
    private var originalQueue: List<Pair<String, String>> = emptyList()
    private var index = -1
    private var sleepDeadlineMs: Long? = null

    fun play(uri: String, title: String, songs: List<Pair<String, String>>) {
        originalQueue = songs
        queue = if (shuffleEnabled) songs.filter { it.first == uri } + songs.filterNot { it.first == uri }.shuffled() else songs
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
            player.setOnCompletionListener { if (repeatMode == "one") startCurrent() else next() }
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

    fun next() {
        index += 1
        if (index >= queue.size && repeatMode == "all") index = 0
        startCurrent()
    }
    fun previous() { index = (index - 1).coerceAtLeast(0); startCurrent() }
    fun changeRepeat() {
        repeatMode = when (repeatMode) { "off" -> "all"; "all" -> "one"; else -> "off" }
        preferences.edit().putString("repeat", repeatMode).apply()
    }

    fun toggleShuffle() {
        shuffleEnabled = !shuffleEnabled
        preferences.edit().putBoolean("shuffle", shuffleEnabled).apply()
        if (index !in queue.indices) return
        val currentUri = queue[index].first
        queue = if (shuffleEnabled) listOf(queue[index]) + queue.filterNot { it.first == currentUri }.shuffled() else originalQueue
        index = queue.indexOfFirst { it.first == currentUri }
    }

    fun setSleep(minutes: Int) {
        sleepDeadlineMs = System.currentTimeMillis() + minutes * 60_000L
        sleepRemainingSeconds = minutes * 60
    }

    fun cancelSleep() { sleepDeadlineMs = null; sleepRemainingSeconds = 0 }
    fun skip(seconds: Int) {
        audio?.let { player ->
            val destination = (player.currentPosition.toLong() + seconds.toLong() * 1000)
                .coerceIn(0L, player.duration.toLong()).toInt()
            player.seekTo(destination)
            progressMs = destination
        }
    }

    fun updateProgress() {
        sleepDeadlineMs?.let { deadline ->
            sleepRemainingSeconds = ((deadline - System.currentTimeMillis() + 999) / 1000).coerceAtLeast(0).toInt()
            if (sleepRemainingSeconds == 0) { cancelSleep(); stop(); return }
        }
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
