package com.tifloacosta.nativeprototype

/** Accessible player UI; preserves original video metadata and YouTube data. */
internal object NativeYouTubePlayerStrings {
    private val keys = listOf("actions", "back", "selected", "performSelected", "previous", "next", "perform", "loading", "blocked", "pause", "play", "position", "performPrefix", "notVideo", "signInHelp", "signIn", "connected", "liked", "like", "alreadySubscribed", "subscribe", "comment", "signOut", "alternative")
    private val catalog = mapOf(
        "es" to listOf(
            "Reproducir o pausar|Retroceder 30 segundos|Avanzar 30 segundos|Me gusta|Suscribirme|Comentar|Compartir|Abrir en YouTube", "Volver a multimedia", "Acción del vídeo: ", "Ejecutar acción del vídeo", "Acción anterior", "Acción siguiente", "Ejecutar acción", "Cargando reproductor de YouTube…", "YouTube no permite reproducir aquí este vídeo (error ", "Pausar", "Reproducir", "Posición del vídeo", "Ejecutar: ", "Este contenido no incluye un enlace directo a un vídeo de YouTube.", "Para indicar Me gusta, suscribirte o comentar, conecta Google. Reproducir no requiere una cuenta.", "Iniciar sesión con Google", "Cuenta de Google conectada", "Ya has indicado Me gusta.", "Me gusta", "Ya estás suscrito al canal.", "Suscribirme al canal", "Comentar este vídeo", "Cerrar sesión de YouTube", "Abrir en YouTube (alternativa)"),
        "en" to listOf(
            "Play or pause|Back 30 seconds|Forward 30 seconds|Like|Subscribe|Comment|Share|Open YouTube", "Back to media", "Selected video action: ", "Perform selected video action", "Previous action", "Next action", "Perform action", "Loading YouTube player…", "YouTube has blocked embedded playback (error ", "Pause", "Play", "Video position", "Perform: ", "This item does not contain a YouTube video link.", "To like, subscribe or comment, connect a Google account. Playback does not require it.", "Sign in with Google", "Google account connected", "You already liked this video.", "Like this video", "Already subscribed to the channel.", "Subscribe to channel", "Comment on this video", "Sign out", "Open on YouTube (alternative)"),
        "pt" to listOf(
            "Reproduzir ou pausar|Retroceder 30 segundos|Avançar 30 segundos|Gosto|Subscrever|Comentar|Partilhar|Abrir no YouTube", "Voltar a multimédia", "Ação do vídeo: ", "Executar ação selecionada do vídeo", "Ação anterior", "Ação seguinte", "Executar ação", "A carregar o leitor de YouTube…", "O YouTube bloqueou a reprodução incorporada (erro ", "Pausar", "Reproduzir", "Posição do vídeo", "Executar: ", "Este item não inclui uma ligação direta para um vídeo do YouTube.", "Para gostar, subscrever ou comentar, liga uma conta Google. A reprodução não requer conta.", "Iniciar sessão com o Google", "Conta Google ligada", "Já gostaste deste vídeo.", "Gosto", "Já subscreveste o canal.", "Subscrever canal", "Comentar este vídeo", "Terminar sessão", "Abrir no YouTube (alternativa)"),
        "fr" to listOf(
            "Lire ou mettre en pause|Reculer de 30 secondes|Avancer de 30 secondes|J’aime|S’abonner|Commenter|Partager|Ouvrir YouTube", "Retour au multimédia", "Action vidéo sélectionnée : ", "Exécuter l’action vidéo sélectionnée", "Action précédente", "Action suivante", "Exécuter l’action", "Chargement du lecteur YouTube…", "YouTube a bloqué la lecture intégrée (erreur ", "Pause", "Lire", "Position vidéo", "Exécuter : ", "Cet élément ne contient aucun lien direct vers une vidéo YouTube.", "Pour aimer, s’abonner ou commenter, connecte un compte Google. Aucun compte n’est requis pour lire.", "Se connecter avec Google", "Compte Google connecté", "Tu aimes déjà cette vidéo.", "J’aime", "Déjà abonné à la chaîne.", "S’abonner à la chaîne", "Commenter cette vidéo", "Se déconnecter", "Ouvrir sur YouTube (alternative)"),
        "it" to listOf(
            "Riproduci o pausa|Indietro di 30 secondi|Avanti di 30 secondi|Mi piace|Iscriviti|Commenta|Condividi|Apri YouTube", "Torna ai contenuti multimediali", "Azione video selezionata: ", "Esegui azione video selezionata", "Azione precedente", "Azione successiva", "Esegui azione", "Caricamento lettore YouTube…", "YouTube ha bloccato la riproduzione incorporata (errore ", "Pausa", "Riproduci", "Posizione video", "Esegui: ", "Questo elemento non contiene un collegamento diretto a un video YouTube.", "Per mettere Mi piace, iscriverti o commentare, collega un account Google. Non serve per la riproduzione.", "Accedi con Google", "Account Google collegato", "Hai già messo Mi piace.", "Mi piace", "Sei già iscritto al canale.", "Iscriviti al canale", "Commenta questo video", "Esci", "Apri su YouTube (alternativa)"),
        "de" to listOf(
            "Wiedergabe oder Pause|30 Sekunden zurück|30 Sekunden vor|Gefällt mir|Abonnieren|Kommentieren|Teilen|YouTube öffnen", "Zurück zu Medien", "Ausgewählte Videoaktion: ", "Ausgewählte Videoaktion ausführen", "Vorherige Aktion", "Nächste Aktion", "Aktion ausführen", "YouTube-Player wird geladen…", "YouTube hat die eingebettete Wiedergabe blockiert (Fehler ", "Pause", "Wiedergabe", "Videoposition", "Ausführen: ", "Dieser Eintrag enthält keinen direkten YouTube-Videolink.", "Zum Liken, Abonnieren oder Kommentieren ein Google-Konto verbinden. Die Wiedergabe benötigt kein Konto.", "Mit Google anmelden", "Google-Konto verbunden", "Dieses Video gefällt dir bereits.", "Gefällt mir", "Kanal bereits abonniert.", "Kanal abonnieren", "Video kommentieren", "Abmelden", "Auf YouTube öffnen (Alternative)")
    )
    fun get(language: String, key: String): String {
        val index = keys.indexOf(key)
        if (index < 0) return key
        return (catalog[language] ?: catalog.getValue("es"))[index]
    }
    fun actions(language: String): List<String> = get(language, "actions").split("|")
    fun blockedMessage(language: String, errorCode: Int): String = get(language, "blocked") + errorCode +
        when (language) {
            "en" -> "). Use the original link."
            "pt" -> "). Utiliza a ligação original."
            "fr" -> "). Utilise le lien d’origine."
            "it" -> "). Usa il collegamento originale."
            "de" -> "). Verwende den ursprünglichen Link."
            else -> "). Utiliza el enlace original."
        }
}
