package com.tifloacosta.nativeprototype

import android.content.Context
import android.net.Uri
import android.media.audiofx.Equalizer
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import kotlin.math.abs
import kotlin.math.roundToInt

class NativeMusicEqualizer(context: Context) {
    val frequencies = listOf(80, 250, 1000, 4000, 12000)
    val presets = mapOf(
        "Normal" to listOf(0f, 0f, 0f, 0f, 0f),
        "Rock" to listOf(4f, 2f, -1f, 3f, 2f),
        "Pop" to listOf(2f, 1f, 0f, 2f, 2f),
        "Clásica" to listOf(0f, 0f, 0f, 1f, 2f),
        "Jazz" to listOf(2f, 1f, 0f, 1f, 1f),
        "Claridad vocal" to listOf(-2f, -1f, 1f, 3f, 2f),
        "Graves" to listOf(5f, 3f, 0f, -1f, -1f),
    )

    private val prefs = context.getSharedPreferences("mi-musica-equalizer-v1", 0)
    var selectedPreset by mutableStateOf(prefs.getString("preset", "Normal") ?: "Normal")
        private set
    private val savedGains = prefs.getString("bands", null)?.split(",")?.mapNotNull { it.toFloatOrNull() }
    var gains by mutableStateOf(if (selectedPreset == "Personalizado" && savedGains?.size == 5) savedGains else presets[selectedPreset] ?: presets.getValue("Normal"))
        private set
    var available by mutableStateOf(true)
        private set
    var error by mutableStateOf<String?>(null)
        private set
    private var effect: Equalizer? = null
    var currentHasOverride by mutableStateOf(false)
        private set
    private var currentSong: String? = null

    private fun songKey(uri: String) = "song-${Uri.encode(uri)}"

    fun loadForSong(uri: String) {
        currentSong = uri
        val stored = prefs.getString(songKey(uri), null)
        currentHasOverride = stored != null
        if (stored != null) {
            val parts = stored.split("|")
            val custom = parts.getOrNull(1)?.split(",")?.mapNotNull { it.toFloatOrNull() }
            selectedPreset = parts.firstOrNull() ?: "Normal"
            gains = if (custom?.size == frequencies.size) custom else presets[selectedPreset] ?: presets.getValue("Normal")
        } else {
            selectedPreset = prefs.getString("preset", "Normal") ?: "Normal"
            val global = prefs.getString("bands", null)?.split(",")?.mapNotNull { it.toFloatOrNull() }
            gains = if (selectedPreset == "Personalizado" && global?.size == frequencies.size) global else presets[selectedPreset] ?: presets.getValue("Normal")
        }
        applyBands()
    }

    fun saveAsGeneral() {
        prefs.edit().putString("preset", selectedPreset).putString("bands", gains.joinToString(",")).apply()
    }

    fun saveForCurrentSong() {
        val uri = currentSong ?: return
        prefs.edit().putString(songKey(uri), "$selectedPreset|${gains.joinToString(",")}").apply()
        currentHasOverride = true
    }

    fun removeCurrentSongOverride() {
        val uri = currentSong ?: return
        prefs.edit().remove(songKey(uri)).apply()
        loadForSong(uri)
    }

    fun attach(sessionId: Int) {
        release()
        try {
            val active = Equalizer(0, sessionId)
            effect = active
            active.enabled = true
            available = true
            applyBands()
        } catch (failure: Exception) {
            available = false
            error = "Ecualización no disponible en este dispositivo: ${failure.localizedMessage ?: "efecto no admitido"}"
        }
    }

    fun selectPreset(name: String) {
        val next = presets[name] ?: return
        selectedPreset = name
        gains = next
        applyBands()
    }

    fun adjustBand(index: Int, step: Float) {
        if (index !in frequencies.indices) return
        gains = gains.toMutableList().also { it[index] = (it[index] + step).coerceIn(-12f, 12f) }
        selectedPreset = "Personalizado"
        applyBands()
    }

    private fun applyBands() {
        val active = effect ?: return
        try {
            val levelRange = active.bandLevelRange
            for (band in 0 until active.numberOfBands.toInt()) {
                val frequency = active.getCenterFreq(band.toShort()) / 1000
                val nearest = frequencies.indices.minByOrNull { abs(frequencies[it] - frequency) } ?: continue
                val millibels = (gains[nearest] * 100f).roundToInt()
                    .coerceIn(levelRange[0].toInt(), levelRange[1].toInt())
                active.setBandLevel(band.toShort(), millibels.toShort())
            }
        } catch (failure: Exception) {
            error = "No se pudo aplicar el ecualizador: ${failure.localizedMessage ?: "error de audio"}"
        }
    }

    fun release() {
        effect?.release()
        effect = null
    }
}
