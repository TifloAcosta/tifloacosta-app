package com.tifloacosta.nativeprototype

import android.os.LocaleList
import java.util.Locale

/** Shared, persistent language order for the Android app. */
internal object NativeAppLanguages {
    val codes = listOf("es", "en", "pt", "fr", "it", "de")
    val names = listOf("Español", "English", "Português", "Français", "Italiano", "Deutsch")

    fun normalizedCode(raw: String?): String? {
        val code = raw.orEmpty().lowercase(Locale.ROOT).replace('_', '-').substringBefore('-')
        return code.takeIf { it in codes }
    }

    fun preferredCode(preferences: List<String>): String =
        preferences.firstNotNullOfOrNull(::normalizedCode) ?: "es"

    fun devicePreferredCode(): String {
        val locales = LocaleList.getDefault()
        return preferredCode((0 until locales.size()).map { locales[it].toLanguageTag() })
    }
}
