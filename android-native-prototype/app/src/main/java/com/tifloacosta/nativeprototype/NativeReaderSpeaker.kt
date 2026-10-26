package com.tifloacosta.nativeprototype

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.speech.tts.Voice
import androidx.compose.runtime.mutableStateOf
import java.util.Locale
import java.util.UUID

/** No TalkBack announcements are emitted automatically during TTS playback. */
class NativeReaderSpeaker(context: Context) : TextToSpeech.OnInitListener {
    val ready = mutableStateOf(false)
    private val main = Handler(Looper.getMainLooper())
    private val engine = TextToSpeech(context.applicationContext, this)
    private var active: String? = null
    private var done: (() -> Unit)? = null

    init {
        engine.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
            override fun onStart(utteranceId: String?) {}
            override fun onError(utteranceId: String?) {
                main.post {
                    if (utteranceId == active) { active = null; done = null }
                }
            }
            override fun onDone(utteranceId: String?) {
                main.post {
                    if (utteranceId == active) {
                        active = null
                        val completed = done
                        done = null
                        completed?.invoke()
                    }
                }
            }
        })
    }

    override fun onInit(status: Int) {
        main.post {
            ready.value = status == TextToSpeech.SUCCESS
            if (ready.value) engine.language = Locale.getDefault()
        }
    }

    fun voices(): List<Voice> =
        if (ready.value) engine.voices.orEmpty().sortedWith(
            compareBy<Voice> { it.locale.language }.thenBy { it.name }
        ) else emptyList()

    fun speak(fragment: String, speed: Float, voiceName: String = "", after: () -> Unit) {
        if (!ready.value || fragment.isBlank()) return
        val id = UUID.randomUUID().toString()
        active = id
        done = after
        engine.setSpeechRate(speed)
        voices().firstOrNull { it.name == voiceName }?.let { engine.voice = it }
        if (engine.speak(fragment, TextToSpeech.QUEUE_FLUSH, null, id) != TextToSpeech.SUCCESS) {
            active = null
            done = null
        }
    }

    fun stop() {
        active = null
        done = null
        engine.stop()
    }

    fun close() {
        stop()
        engine.shutdown()
    }
}
