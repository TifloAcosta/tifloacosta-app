package com.tifloacosta.nativeprototype

import android.os.LocaleList
import java.util.Locale

/** Shared, persistent language order for the Android app. */
internal object NativeAppLanguages {
    val codes = listOf("es", "en", "pt", "fr", "it", "de")
    val names = listOf("Español", "English", "Português", "Français", "Italiano", "Deutsch")

    /** First group of localized navigation and settings labels. */
    private val uiLabels = mapOf(
        "news" to listOf("Actualidad", "News", "Atualidade", "Actualités", "Attualità", "Aktuelles"),
        "resources" to listOf("Recursos", "Resources", "Recursos", "Ressources", "Risorse", "Ressourcen"),
        "videos" to listOf("Vídeos", "Videos", "Vídeos", "Vidéos", "Video", "Videos"),
        "search" to listOf("Buscar", "Search", "Pesquisar", "Rechercher", "Cerca", "Suchen"),
        "new" to listOf("Novedades", "New content", "Novidades", "Nouveautés", "Novità", "Neuigkeiten"),
        "downloads" to listOf("Descargas", "Downloads", "Transferências", "Téléchargements", "Download", "Downloads"),
        "favorites" to listOf("Favoritos", "Favorites", "Favoritos", "Favoris", "Preferiti", "Favoriten"),
        "podcasts" to listOf("Pódcast", "Podcasts", "Podcasts", "Podcasts", "Podcast", "Podcasts"),
        "contact" to listOf("Contacto", "Contact", "Contacto", "Contact", "Contatto", "Kontakt"),
        "privacy" to listOf("Privacidad", "Privacy", "Privacidade", "Confidentialité", "Privacy", "Datenschutz"),
        "settings" to listOf("Configuración", "Settings", "Definições", "Paramètres", "Impostazioni", "Einstellungen"),
        "back" to listOf("Volver", "Back", "Voltar", "Retour", "Indietro", "Zurück"),
        "appLanguage" to listOf("Idioma de la aplicación", "App language", "Idioma da aplicação", "Langue de l’application", "Lingua dell’app", "App-Sprache"),
        "appearance" to listOf("Aspecto", "Appearance", "Aspeto", "Apparence", "Aspetto", "Darstellung"),
        "allLanguages" to listOf("Todos los idiomas", "All languages", "Todos os idiomas", "Toutes les langues", "Tutte le lingue", "Alle Sprachen"),
        "spanish" to listOf("Español", "Spanish", "Espanhol", "Espagnol", "Spagnolo", "Spanisch"),
        "english" to listOf("Inglés", "English", "Inglês", "Anglais", "Inglese", "Englisch"),
        "chooseCategory" to listOf("Selecciona una categoría", "Choose a category", "Seleciona uma categoria", "Choisir une catégorie", "Seleziona una categoria", "Kategorie auswählen"),
        "allCategories" to listOf("Todas las categorías", "All categories", "Todas as categorias", "Toutes les catégories", "Tutte le categorie", "Alle Kategorien"),
        "system" to listOf("Sistema", "System", "Sistema", "Système", "Sistema", "System"),
        "light" to listOf("Claro", "Light", "Claro", "Clair", "Chiaro", "Hell"),
        "dark" to listOf("Oscuro", "Dark", "Escuro", "Sombre", "Scuro", "Dunkel"),
        "largerText" to listOf("Texto más grande", "Larger text", "Texto maior", "Texte plus grand", "Testo più grande", "Größerer Text"),
        "settingsDescription" to listOf("Los ajustes se guardan en este dispositivo. Las voces se configuran dentro de TifloLector.", "Settings are saved on this device. Reader voice settings are inside TifloLector.", "As definições são guardadas neste dispositivo. As vozes são configuradas no TifloLector.", "Les réglages sont enregistrés sur cet appareil. Les voix sont configurées dans TifloLector.", "Le impostazioni vengono salvate su questo dispositivo. Le voci si configurano in TifloLector.", "Einstellungen werden auf diesem Gerät gespeichert. Die Stimmen werden in TifloLector eingerichtet."),
        "languageDescription" to listOf("El idioma elegido se conserva aunque cambies el idioma del dispositivo.", "The app language is saved independently of your device language.", "O idioma escolhido é mantido mesmo que alteres o idioma do dispositivo.", "La langue choisie est conservée même si tu changes la langue de l’appareil.", "La lingua scelta rimane salvata anche se cambi la lingua del dispositivo.", "Die gewählte Sprache bleibt gespeichert, auch wenn du die Gerätesprache änderst."),
        "enableNotifications" to listOf("Activar notificaciones", "Enable notifications", "Ativar notificações", "Activer les notifications", "Attiva le notifiche", "Benachrichtigungen aktivieren"),
        "notificationPermissions" to listOf("Permisos y notificaciones de Android", "Android notification permissions", "Permissões e notificações do Android", "Autorisations et notifications Android", "Autorizzazioni e notifiche Android", "Android-Benachrichtigungen und Berechtigungen")
    )

    fun text(language: String, key: String): String {
        val index = codes.indexOf(normalizedCode(language)).coerceAtLeast(0)
        return uiLabels[key]?.getOrNull(index) ?: key
    }

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
