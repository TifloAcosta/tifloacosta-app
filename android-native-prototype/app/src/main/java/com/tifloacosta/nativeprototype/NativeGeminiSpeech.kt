package com.tifloacosta.nativeprototype

import android.content.Context
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.util.Base64
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

/** Single user-requested Gemini TTS segment. The API key never appears in URLs or logs. */
internal object NativeGeminiSpeech {
    const val MODEL = "gemini-2.5-flash-preview-tts"
    val voices = listOf("Kore", "Puck", "Aoede", "Charon", "Fenrir", "Leda", "Orus", "Zephyr")

    fun generate(context: Context, text: String, voice: String): ByteArray {
        val key = NativeVoiceCredentials(context.applicationContext).read("gemini")
            ?.takeIf { it.isNotBlank() } ?: error("Configura primero la clave Gemini.")
        val fragment = text.take(1600).trim()
        require(fragment.isNotBlank()) { "No hay texto para leer." }
        val payload = JSONObject().apply {
            put("contents", org.json.JSONArray().put(JSONObject().put("parts",
                org.json.JSONArray().put(JSONObject().put("text",
                    "Read exactly this text aloud, without additions: $fragment")))))
            put("generationConfig", JSONObject()
                .put("responseModalities", org.json.JSONArray().put("AUDIO"))
                .put("speechConfig", JSONObject().put("voiceConfig", JSONObject()
                    .put("prebuiltVoiceConfig", JSONObject().put("voiceName",
                        voice.takeIf { it in voices } ?: "Kore")))))
        }
        val connection = URL(
            "https://generativelanguage.googleapis.com/v1beta/models/$MODEL:generateContent"
        ).openConnection() as HttpURLConnection
        try {
            connection.requestMethod = "POST"
            connection.connectTimeout = 15000
            connection.readTimeout = 60000
            connection.doOutput = true
            connection.setRequestProperty("Content-Type", "application/json")
            connection.setRequestProperty("x-goog-api-key", key)
            connection.outputStream.use { it.write(payload.toString().toByteArray(Charsets.UTF_8)) }
            val status = connection.responseCode
            when (status) {
                401, 403 -> error("Clave Gemini rechazada o sin permisos.")
                429 -> error("Se alcanzó la cuota Gemini.")
                in 200..299 -> Unit
                else -> error("Gemini no pudo generar audio (código $status).")
            }
            val response = JSONObject(connection.inputStream.bufferedReader().use { it.readText() })
            val parts = response.getJSONArray("candidates").getJSONObject(0)
                .getJSONObject("content").getJSONArray("parts")
            var inline: JSONObject? = null
            for (i in 0 until parts.length()) {
                if (parts.getJSONObject(i).has("inlineData")) {
                    inline = parts.getJSONObject(i).getJSONObject("inlineData")
                    break
                }
            }
            val data = inline ?: error("Gemini no devolvió audio.")
            val pcm = Base64.decode(data.getString("data"), Base64.DEFAULT)
            val mime = data.optString("mimeType").lowercase()
            if (pcm.size >= 4 && String(pcm.copyOfRange(0, 4)) == "RIFF") return pcm
            require((mime.contains("pcm") || mime.contains("l16")) && pcm.size % 2 == 0) {
                "El formato de audio no es compatible."
            }
            return wav(pcm)
        } finally {
            connection.disconnect()
        }
    }

    private fun wav(pcm: ByteArray, rate: Int = 24000): ByteArray {
        val out = ByteArrayOutputStream()
        fun word(value: Int) {
            for (i in 0..3) out.write((value ushr (8 * i)) and 255)
        }
        fun half(value: Int) {
            out.write(value and 255)
            out.write((value ushr 8) and 255)
        }
        out.write("RIFF".toByteArray())
        word(pcm.size + 36)
        out.write("WAVEfmt ".toByteArray())
        word(16); half(1); half(1)
        word(rate); word(rate * 2)
        half(2); half(16)
        out.write("data".toByteArray())
        word(pcm.size)
        out.write(pcm)
        return out.toByteArray()
    }
}

/** Preview only: no replacement of the existing reader's persistence or TTS engine. */
internal class NativeGeminiAudioPreview(private val context: Context) {
    private var player: MediaPlayer? = null
    private var file: File? = null

    fun play(wav: ByteArray) {
        stop()
        val temp = File.createTempFile("reader-gemini-", ".wav", context.cacheDir)
        try {
            temp.writeBytes(wav)
            file = temp
            player = MediaPlayer().apply {
                setAudioAttributes(AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build())
                setDataSource(temp.absolutePath)
                setOnCompletionListener { stop() }
                prepare()
                start()
            }
        } catch (failure: Exception) {
            stop()
            throw failure
        }
    }

    fun stop() {
        player?.setOnCompletionListener(null)
        player?.release()
        player = null
        file?.delete()
        file = null
    }
}
