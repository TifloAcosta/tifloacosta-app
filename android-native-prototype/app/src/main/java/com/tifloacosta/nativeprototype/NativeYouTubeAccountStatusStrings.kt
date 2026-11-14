package com.tifloacosta.nativeprototype

/** Account-related messages are localized; YouTube's error codes remain stable. */
internal object NativeYouTubeAccountStatusStrings {
    private val keys = listOf("authorizationOpening", "signedOut", "commentsDisabled", "sessionExpired", "quota", "permissions", "ineligible", "network", "error", "authRejected", "authInvalid", "signedIn", "noSubscriptions", "commentEmpty", "liked", "subscribed", "commentPublished")
    private val catalog = mapOf(
        "es" to listOf(
            "Abriendo identificación segura de Google.", "Sesión de YouTube cerrada en TifloAcosta.", "Los comentarios están desactivados en este vídeo.", "La sesión ha caducado o la autorización no es válida. Conecta Google de nuevo.", "Se ha alcanzado temporalmente el límite de YouTube.", "Google no concedió los permisos necesarios.", "La cuenta de YouTube no permite esta acción.", "No se pudo conectar con el servicio de YouTube.", "No se pudo completar la operación con YouTube.", "Google no completó la autorización. Comprueba los permisos e inténtalo de nuevo.", "La autorización no devolvió un código válido.", "Sesión de YouTube iniciada.", "No hay canales suscritos.", "Escribe un comentario antes de publicarlo.", "Me gusta añadido.", "Suscripción realizada.", "Comentario publicado en YouTube."
        ),
        "en" to listOf(
            "Opening secure Google sign-in.", "Signed out of YouTube in TifloAcosta.", "Comments are disabled on this video.", "Your session expired or authorization is invalid. Connect Google again.", "YouTube's temporary limit has been reached.", "Google did not grant the required permissions.", "This YouTube account cannot perform this action.", "Could not connect to YouTube.", "Could not complete the YouTube operation.", "Google did not complete authorization. Check permissions and try again.", "Authorization did not return a valid code.", "Signed in to YouTube.", "No subscribed channels.", "Enter a comment before posting.", "Like added.", "Subscribed successfully.", "Comment posted on YouTube."
        ),
        "pt" to listOf(
            "A abrir a autenticação segura da Google.", "Sessão do YouTube terminada no TifloAcosta.", "Os comentários estão desativados neste vídeo.", "A sessão expirou ou a autorização é inválida. Liga novamente a conta Google.", "O limite temporário do YouTube foi atingido.", "A Google não concedeu as permissões necessárias.", "Esta conta do YouTube não permite esta ação.", "Não foi possível ligar ao YouTube.", "Não foi possível concluir a operação no YouTube.", "A Google não concluiu a autorização. Verifica as permissões e tenta novamente.", "A autorização não devolveu um código válido.", "Sessão do YouTube iniciada.", "Não há canais subscritos.", "Escreve um comentário antes de publicar.", "Gosto adicionado.", "Subscrição efetuada.", "Comentário publicado no YouTube."
        ),
        "fr" to listOf(
            "Ouverture de la connexion sécurisée Google.", "Déconnexion de YouTube dans TifloAcosta.", "Les commentaires sont désactivés pour cette vidéo.", "La session a expiré ou l’autorisation est invalide. Reconnecte Google.", "La limite temporaire de YouTube a été atteinte.", "Google n’a pas accordé les autorisations nécessaires.", "Ce compte YouTube ne permet pas cette action.", "Impossible de se connecter à YouTube.", "Impossible de terminer l’opération sur YouTube.", "Google n’a pas terminé l’autorisation. Vérifie les autorisations et réessaie.", "Aucun code valide n’a été reçu.", "Connexion à YouTube réussie.", "Aucune chaîne suivie.", "Écris un commentaire avant de le publier.", "J’aime ajouté.", "Abonnement effectué.", "Commentaire publié sur YouTube."
        ),
        "it" to listOf(
            "Apertura dell’accesso sicuro a Google.", "Disconnessione da YouTube in TifloAcosta.", "I commenti sono disattivati per questo video.", "La sessione è scaduta o l’autorizzazione non è valida. Ricollega Google.", "È stato raggiunto il limite temporaneo di YouTube.", "Google non ha concesso le autorizzazioni necessarie.", "Questo account YouTube non consente l’azione.", "Impossibile connettersi a YouTube.", "Impossibile completare l’operazione su YouTube.", "Google non ha completato l’autorizzazione. Controlla le autorizzazioni e riprova.", "L’autorizzazione non ha restituito un codice valido.", "Accesso a YouTube effettuato.", "Nessun canale seguito.", "Scrivi un commento prima di pubblicarlo.", "Mi piace aggiunto.", "Iscrizione effettuata.", "Commento pubblicato su YouTube."
        ),
        "de" to listOf(
            "Sichere Google-Anmeldung wird geöffnet.", "In TifloAcosta von YouTube abgemeldet.", "Kommentare sind für dieses Video deaktiviert.", "Die Sitzung ist abgelaufen oder die Autorisierung ist ungültig. Verbinde Google erneut.", "Das vorübergehende YouTube-Limit wurde erreicht.", "Google hat die erforderlichen Berechtigungen nicht erteilt.", "Dieses YouTube-Konto erlaubt diese Aktion nicht.", "Verbindung zu YouTube fehlgeschlagen.", "YouTube-Aktion konnte nicht abgeschlossen werden.", "Google hat die Autorisierung nicht abgeschlossen. Prüfe die Berechtigungen und versuche es erneut.", "Die Autorisierung hat keinen gültigen Code geliefert.", "Bei YouTube angemeldet.", "Keine abonnierten Kanäle.", "Schreibe vor dem Veröffentlichen einen Kommentar.", "Gefällt mir hinzugefügt.", "Kanal abonniert.", "Kommentar auf YouTube veröffentlicht."
        )
    )
    init { require(catalog.values.all { it.size == keys.size }) }
    fun get(language: String, key: String): String {
        val index = keys.indexOf(key)
        require(index >= 0) { "Unknown account status: $key" }
        return (catalog[language] ?: catalog.getValue("es"))[index]
    }
}
