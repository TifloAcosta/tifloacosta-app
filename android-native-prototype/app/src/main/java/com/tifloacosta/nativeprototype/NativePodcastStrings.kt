package com.tifloacosta.nativeprototype

/** Podcast and OPML controls follow the selected app language, not the RSS feed language. */
internal object NativePodcastStrings {
    private val keys = listOf(
        "library", "follow", "import", "favoritesCount", "episodes", "play", "pause",
        "skipBack", "skipForward", "source", "loading", "feedError", "importSuccess",
        "newEpisodes", "importing", "importError", "savedList", "none", "preparing",
        "playError", "audioError", "subscriptionSaved", "favoritePlay", "favoriteRemove",
        "followedLoading", "noPlayable", "browse", "unfollow", "addFavorite",
        "removeFavorite", "added", "removed", "playEpisode", "title", "more"
    )
    private val catalog = mapOf(
        "es" to listOf(
            "Biblioteca de pódcast", "Seguir el pódcast TifloAcosta", "Importar suscripciones OPML", "Episodios favoritos: %s", "Episodios", "Reproducir", "Pausar",
            "Retroceder 30 segundos", "Avanzar 30 segundos", "Abrir origen del episodio", "Cargando episodios", "No se pudo consultar el canal.", "Suscripciones importadas: %s.",
            "%s episodios nuevos desde la consulta anterior.", "Importando suscripciones…", "No se pudo importar el archivo OPML.", "Utilizando la lista de podcasts guardada", "Sin episodios", "Preparando audio",
            "No se puede reproducir", "Error de audio", "Suscripción guardada.", "Reproducir favorito: ", "Quitar favorito: ",
            "Consultando episodios seguidos", "Sin episodios compatibles", "Consultar episodios: ", "Dejar de seguir: ", "Añadir a favoritos: ",
            "Quitar de favoritos: ", "Añadido a favoritos.", "Retirado de favoritos.", "Reproducir: ", "Pódcast", "Mostrar diez más"
        ),
        "en" to listOf(
            "Podcast library", "Follow TifloAcosta podcast", "Import OPML subscriptions", "Favorite episodes: %s", "Episodes", "Play", "Pause",
            "Skip back 30 seconds", "Skip forward 30 seconds", "Open episode source", "Loading episodes", "Could not load podcast feed", "Imported %s podcast subscriptions.",
            "%s new episodes since the previous check.", "Importing subscriptions…", "Could not import OPML.", "Using the saved podcast list", "No episodes", "Preparing audio",
            "Cannot play episode", "Audio error", "Subscription saved.", "Play favorite: ", "Remove favorite: ",
            "Loading followed episodes", "No playable episodes", "Browse episodes: ", "Unfollow: ", "Add favorite: ",
            "Remove favorite: ", "Added to favorites.", "Removed from favorites.", "Play: ", "Podcasts", "Show ten more"
        ),
        "pt" to listOf(
            "Biblioteca de podcasts", "Seguir o podcast TifloAcosta", "Importar subscrições OPML", "Episódios favoritos: %s", "Episódios", "Reproduzir", "Pausar",
            "Recuar 30 segundos", "Avançar 30 segundos", "Abrir a origem do episódio", "A carregar episódios", "Não foi possível carregar o canal.", "Subscrições importadas: %s.",
            "%s episódios novos desde a última consulta.", "A importar subscrições…", "Não foi possível importar o OPML.", "A usar a lista de podcasts guardada", "Sem episódios", "A preparar áudio",
            "Não é possível reproduzir o episódio", "Erro de áudio", "Subscrição guardada.", "Reproduzir favorito: ", "Remover favorito: ",
            "A consultar episódios seguidos", "Sem episódios compatíveis", "Consultar episódios: ", "Deixar de seguir: ", "Adicionar aos favoritos: ",
            "Remover dos favoritos: ", "Adicionado aos favoritos.", "Removido dos favoritos.", "Reproduzir: ", "Podcasts", "Mostrar mais dez"
        ),
        "fr" to listOf(
            "Bibliothèque de podcasts", "Suivre le podcast TifloAcosta", "Importer les abonnements OPML", "Épisodes favoris : %s", "Épisodes", "Lire", "Pause",
            "Reculer de 30 secondes", "Avancer de 30 secondes", "Ouvrir la source de l’épisode", "Chargement des épisodes", "Impossible de charger le flux du podcast.", "%s abonnements importés.",
            "%s nouveaux épisodes depuis la dernière consultation.", "Importation des abonnements…", "Impossible d’importer le fichier OPML.", "Utilisation de la liste enregistrée", "Aucun épisode", "Préparation de l’audio",
            "Impossible de lire cet épisode", "Erreur audio", "Abonnement enregistré.", "Lire le favori : ", "Retirer le favori : ",
            "Chargement des épisodes suivis", "Aucun épisode compatible", "Parcourir les épisodes : ", "Ne plus suivre : ", "Ajouter aux favoris : ",
            "Retirer des favoris : ", "Ajouté aux favoris.", "Retiré des favoris.", "Lire : ", "Podcasts", "Afficher dix épisodes de plus"
        ),
        "it" to listOf(
            "Biblioteca podcast", "Segui il podcast TifloAcosta", "Importa abbonamenti OPML", "Episodi preferiti: %s", "Episodi", "Riproduci", "Pausa",
            "Indietro di 30 secondi", "Avanti di 30 secondi", "Apri la fonte dell’episodio", "Caricamento episodi", "Impossibile caricare il feed podcast.", "Abbonamenti importati: %s.",
            "%s nuovi episodi dall’ultimo controllo.", "Importazione abbonamenti…", "Impossibile importare il file OPML.", "Uso dell’elenco podcast salvato", "Nessun episodio", "Preparazione audio",
            "Impossibile riprodurre l’episodio", "Errore audio", "Abbonamento salvato.", "Riproduci preferito: ", "Rimuovi preferito: ",
            "Caricamento episodi seguiti", "Nessun episodio compatibile", "Sfoglia episodi: ", "Non seguire più: ", "Aggiungi ai preferiti: ",
            "Rimuovi dai preferiti: ", "Aggiunto ai preferiti.", "Rimosso dai preferiti.", "Riproduci: ", "Podcast", "Mostra altri dieci"
        ),
        "de" to listOf(
            "Podcast-Bibliothek", "TifloAcosta-Podcast folgen", "OPML-Abonnements importieren", "Lieblingsepisoden: %s", "Episoden", "Wiedergabe", "Pause",
            "30 Sekunden zurück", "30 Sekunden vor", "Episodenquelle öffnen", "Episoden werden geladen", "Podcast-Feed konnte nicht geladen werden.", "%s Podcast-Abonnements importiert.",
            "%s neue Episoden seit der letzten Prüfung.", "Abonnements werden importiert…", "OPML-Datei konnte nicht importiert werden.", "Gespeicherte Podcast-Liste wird verwendet", "Keine Episoden", "Audio wird vorbereitet",
            "Episode kann nicht abgespielt werden", "Audiofehler", "Abonnement gespeichert.", "Favorit abspielen: ", "Favorit entfernen: ",
            "Abonnierte Episoden werden geladen", "Keine abspielbaren Episoden", "Episoden durchsuchen: ", "Nicht mehr folgen: ", "Zu Favoriten hinzufügen: ",
            "Aus Favoriten entfernen: ", "Zu Favoriten hinzugefügt.", "Aus Favoriten entfernt.", "Abspielen: ", "Podcasts", "Zehn weitere anzeigen"
        )
    )
    init { require(catalog.values.all { it.size == keys.size }) }
    fun get(language: String, key: String, value: Any? = null): String {
        val index = keys.indexOf(key)
        require(index >= 0) { "Unknown podcast label: $key" }
        val template = (catalog[language] ?: catalog.getValue("es"))[index]
        return if (value == null) template else template.replace("%s", value.toString())
    }
}
