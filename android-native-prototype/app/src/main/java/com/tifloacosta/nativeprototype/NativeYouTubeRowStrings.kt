package com.tifloacosta.nativeprototype

/** YouTube row action labels and TalkBack state; never translates video titles. */
internal object NativeYouTubeRowStrings {
    private val keys = listOf("play", "like", "subscribe", "comment", "signIn", "share", "open", "shareVideo", "selected", "commentTitle", "yourComment", "publish", "cancel")
    private val catalog = mapOf(
        "es" to listOf("Reproducir vídeo", "Me gusta", "Suscribirme", "Comentar", "Iniciar sesión con Google", "Compartir", "Abrir en YouTube", "Compartir vídeo", "Acción: ", "Comentar en YouTube", "Tu comentario", "Publicar comentario", "Cancelar"),
        "en" to listOf("Play video", "Like", "Subscribe", "Comment", "Sign in with Google", "Share", "Open on YouTube", "Share video", "Selected action: ", "Comment on YouTube", "Your comment", "Publish comment", "Cancel"),
        "pt" to listOf("Reproduzir vídeo", "Gosto", "Subscrever", "Comentar", "Iniciar sessão com o Google", "Partilhar", "Abrir no YouTube", "Partilhar vídeo", "Ação selecionada: ", "Comentar no YouTube", "O teu comentário", "Publicar comentário", "Cancelar"),
        "fr" to listOf("Lire la vidéo", "J’aime", "S’abonner", "Commenter", "Se connecter avec Google", "Partager", "Ouvrir sur YouTube", "Partager la vidéo", "Action sélectionnée : ", "Commenter sur YouTube", "Ton commentaire", "Publier le commentaire", "Annuler"),
        "it" to listOf("Riproduci video", "Mi piace", "Iscriviti", "Commenta", "Accedi con Google", "Condividi", "Apri su YouTube", "Condividi video", "Azione selezionata: ", "Commenta su YouTube", "Il tuo commento", "Pubblica commento", "Annulla"),
        "de" to listOf("Video abspielen", "Gefällt mir", "Abonnieren", "Kommentieren", "Mit Google anmelden", "Teilen", "Auf YouTube öffnen", "Video teilen", "Ausgewählte Aktion: ", "Auf YouTube kommentieren", "Dein Kommentar", "Kommentar veröffentlichen", "Abbrechen")
    )
    fun get(language: String, key: String): String {
        val index = keys.indexOf(key)
        if (index < 0) return key
        return (catalog[language] ?: catalog.getValue("es"))[index]
    }
}
