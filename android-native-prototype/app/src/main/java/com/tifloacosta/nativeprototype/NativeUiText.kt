package com.tifloacosta.nativeprototype

import androidx.compose.runtime.compositionLocalOf
import java.util.Locale

/** Localized UI controls. Original articles, documents and book titles never pass here. */
internal object NativeUiText {
    val choices = listOf(
        "es" to "Español", "en" to "English", "pt" to "Português",
        "fr" to "Français", "it" to "Italiano", "de" to "Deutsch"
    )

    private val translations = mapOf(
        "es" to mapOf(
            "news" to "Actualidad", "resources" to "Recursos", "videos" to "Vídeos",
            "search" to "Buscar", "newContent" to "Novedades", "downloads" to "Descargas",
            "favorites" to "Favoritos", "contact" to "Contacto", "privacy" to "Privacidad", "accessibility" to "Accesibilidad",
            "settings" to "Configuración", "sounds" to "Bancos de sonidos", "youtubeSearch" to "Buscar en YouTube",
            "back" to "Volver", "language" to "Idioma", "appearance" to "Aspecto",
            "system" to "Sistema", "light" to "Claro", "dark" to "Oscuro",
            "largerText" to "Texto más grande", "notifications" to "Activar notificaciones",
            "androidPermissions" to "Permisos y notificaciones de Android",
            "settingsNote" to "Los ajustes se guardan en este dispositivo. Las voces se configuran dentro de TifloLector.",
            "allCategories" to "Todas las categorías", "chooseCategory" to "Selecciona una categoría",
            "loading" to "Cargando…", "noResults" to "Sin resultados.", "more" to "Mostrar diez más"
        ),
        "en" to mapOf(
            "news" to "News", "resources" to "Resources", "videos" to "Videos",
            "search" to "Search", "newContent" to "What's new", "downloads" to "Downloads",
            "favorites" to "Favorites", "contact" to "Contact", "privacy" to "Privacy", "accessibility" to "Accessibility",
            "settings" to "Settings", "sounds" to "Sound effects", "youtubeSearch" to "YouTube search",
            "back" to "Back", "language" to "Language", "appearance" to "Appearance",
            "system" to "System", "light" to "Light", "dark" to "Dark",
            "largerText" to "Larger text", "notifications" to "Enable notifications",
            "androidPermissions" to "Android notification permissions",
            "settingsNote" to "Settings are saved on this device. Reader voice settings are inside TifloLector.",
            "allCategories" to "All categories", "chooseCategory" to "Choose a category",
            "loading" to "Loading…", "noResults" to "No results.", "more" to "Show ten more"
        ),
        "pt" to mapOf(
            "news" to "Atualidade", "resources" to "Recursos", "videos" to "Vídeos",
            "search" to "Pesquisar", "newContent" to "Novidades", "downloads" to "Transferências",
            "favorites" to "Favoritos", "contact" to "Contacto", "privacy" to "Privacidade", "accessibility" to "Acessibilidade",
            "settings" to "Definições", "sounds" to "Bancos de sons", "youtubeSearch" to "Pesquisar no YouTube",
            "back" to "Voltar", "language" to "Idioma", "appearance" to "Aspeto",
            "system" to "Sistema", "light" to "Claro", "dark" to "Escuro",
            "largerText" to "Texto maior", "notifications" to "Ativar notificações",
            "androidPermissions" to "Permissões e notificações do Android",
            "settingsNote" to "As definições são guardadas neste dispositivo. As vozes configuram-se no TifloLector.",
            "allCategories" to "Todas as categorias", "chooseCategory" to "Escolhe uma categoria",
            "loading" to "A carregar…", "noResults" to "Sem resultados.", "more" to "Mostrar mais dez"
        ),
        "fr" to mapOf(
            "news" to "Actualités", "resources" to "Ressources", "videos" to "Vidéos",
            "search" to "Rechercher", "newContent" to "Nouveautés", "downloads" to "Téléchargements",
            "favorites" to "Favoris", "contact" to "Contact", "privacy" to "Confidentialité", "accessibility" to "Accessibilité",
            "settings" to "Paramètres", "sounds" to "Banques de sons", "youtubeSearch" to "Rechercher sur YouTube",
            "back" to "Retour", "language" to "Langue", "appearance" to "Apparence",
            "system" to "Système", "light" to "Clair", "dark" to "Sombre",
            "largerText" to "Texte plus grand", "notifications" to "Activer les notifications",
            "androidPermissions" to "Autorisations et notifications Android",
            "settingsNote" to "Les paramètres sont enregistrés sur cet appareil. Les voix se règlent dans TifloLector.",
            "allCategories" to "Toutes les catégories", "chooseCategory" to "Choisir une catégorie",
            "loading" to "Chargement…", "noResults" to "Aucun résultat.", "more" to "Afficher dix éléments de plus"
        ),
        "it" to mapOf(
            "news" to "Attualità", "resources" to "Risorse", "videos" to "Video",
            "search" to "Cerca", "newContent" to "Novità", "downloads" to "Download",
            "favorites" to "Preferiti", "contact" to "Contatti", "privacy" to "Privacy", "accessibility" to "Accessibilità",
            "settings" to "Impostazioni", "sounds" to "Banche di suoni", "youtubeSearch" to "Cerca su YouTube",
            "back" to "Indietro", "language" to "Lingua", "appearance" to "Aspetto",
            "system" to "Sistema", "light" to "Chiaro", "dark" to "Scuro",
            "largerText" to "Testo più grande", "notifications" to "Attiva notifiche",
            "androidPermissions" to "Autorizzazioni e notifiche Android",
            "settingsNote" to "Le impostazioni sono salvate sul dispositivo. Le voci si configurano in TifloLector.",
            "allCategories" to "Tutte le categorie", "chooseCategory" to "Scegli una categoria",
            "loading" to "Caricamento…", "noResults" to "Nessun risultato.", "more" to "Mostra altri dieci"
        ),
        "de" to mapOf(
            "news" to "Aktuelles", "resources" to "Ressourcen", "videos" to "Videos",
            "search" to "Suchen", "newContent" to "Neuigkeiten", "downloads" to "Downloads",
            "favorites" to "Favoriten", "contact" to "Kontakt", "privacy" to "Datenschutz", "accessibility" to "Barrierefreiheit",
            "settings" to "Einstellungen", "sounds" to "Soundarchive", "youtubeSearch" to "Auf YouTube suchen",
            "back" to "Zurück", "language" to "Sprache", "appearance" to "Darstellung",
            "system" to "System", "light" to "Hell", "dark" to "Dunkel",
            "largerText" to "Größerer Text", "notifications" to "Benachrichtigungen aktivieren",
            "androidPermissions" to "Android-Berechtigungen und Benachrichtigungen",
            "settingsNote" to "Die Einstellungen werden auf diesem Gerät gespeichert. Stimmen werden in TifloLector eingestellt.",
            "allCategories" to "Alle Kategorien", "chooseCategory" to "Kategorie auswählen",
            "loading" to "Wird geladen…", "noResults" to "Keine Ergebnisse.", "more" to "Zehn weitere anzeigen"
        )
    )

    fun normalize(selected: String?, systemLanguage: String = Locale.getDefault().language): String {
        val code = selected.orEmpty().substringBefore('-').substringBefore('_').lowercase(Locale.ROOT)
        if (choices.any { it.first == code }) return code
        val system = systemLanguage.substringBefore('-').substringBefore('_').lowercase(Locale.ROOT)
        return if (choices.any { it.first == system }) system else "es"
    }

    fun get(language: String, key: String): String =
        translations[language]?.get(key) ?: translations.getValue("es")[key] ?: key

    fun missingKeys(): Map<String, Set<String>> {
        val baseline = translations.getValue("es").keys
        return translations.mapValues { (_, dictionary) -> baseline - dictionary.keys }
    }
}

internal val LocalNativeUiLanguage = compositionLocalOf { "es" }
