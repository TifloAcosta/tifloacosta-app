package com.tifloacosta.nativeprototype

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.util.Locale

data class PronunciationRule(val original: String, val spoken: String)

/** One-pass replacements. Never edit the source text, saved offsets, or bookmarks. */
object NativePronunciation {
    const val MAX_RULES = 150
    private val boundary = "[\\p{L}\\p{N}]"

    fun normalize(rules: List<PronunciationRule>): List<PronunciationRule> {
        val seen = mutableSetOf<String>()
        return rules.mapNotNull { rule ->
            val from = rule.original.trim().replace(Regex("\\s+"), " ")
            val to = rule.spoken.trim().replace(Regex("\\s+"), " ")
            val key = from.lowercase(Locale.ROOT)
            if (from.isBlank() || to.isBlank() || from.length > 80 || to.length > 120 ||
                !seen.add(key)) null else PronunciationRule(from, to)
        }.take(MAX_RULES)
    }

    fun apply(text: String, rules: List<PronunciationRule>): String {
        val normalized = normalize(rules).sortedByDescending { it.original.length }
        if (text.isEmpty() || normalized.isEmpty()) return text
        val choices = normalized.joinToString("|") { Regex.escape(it.original) }
        val expression = Regex("(?<!$boundary)($choices)(?!$boundary)", RegexOption.IGNORE_CASE)
        val replacements = normalized.associate { it.original.lowercase(Locale.ROOT) to it.spoken }
        return expression.replace(text) { match ->
            replacements[match.value.lowercase(Locale.ROOT)] ?: match.value
        }
    }
}

/** Shared pronunciation dictionary for TifloLector, stored on the user's device. */
class NativePronunciationStore(context: Context) {
    private val prefs = context.applicationContext.getSharedPreferences("tiflolector-pronunciation", 0)

    fun read(): List<PronunciationRule> {
        val parsed = try { JSONArray(prefs.getString("rules", "[]")) } catch (_: Exception) { JSONArray() }
        return NativePronunciation.normalize((0 until parsed.length()).mapNotNull { index ->
            val item = parsed.optJSONObject(index) ?: return@mapNotNull null
            PronunciationRule(item.optString("original"), item.optString("spoken"))
        })
    }

    fun save(rules: List<PronunciationRule>) {
        val array = JSONArray()
        NativePronunciation.normalize(rules).forEach { rule ->
            array.put(JSONObject().put("original", rule.original).put("spoken", rule.spoken))
        }
        prefs.edit().putString("rules", array.toString()).apply()
    }
}
