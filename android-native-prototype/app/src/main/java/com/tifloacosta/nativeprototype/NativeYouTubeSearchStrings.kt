package com.tifloacosta.nativeprototype

/** YouTube search and subscription controls, not the original video titles. */
internal object NativeYouTubeSearchStrings {
    private val keys = listOf("searching", "results", "unavailable", "subscriptions", "channels",
        "tenChannels", "loading", "signIn", "publicVideos", "searchLabel", "search", "tenMore")
    private val catalog = mapOf(
        "es" to listOf("Buscando en YouTube", "resultados", "No se pudo completar la búsqueda de YouTube", "Mis suscripciones de YouTube", "Consultar canales suscritos", "Mostrar diez canales más", "Cargando suscripciones", "Iniciar sesión con Google para ver suscripciones", "Buscar vídeos públicos de YouTube", "Búsqueda en YouTube", "Buscar", "Mostrar diez más"),
        "en" to listOf("Searching YouTube", "results", "YouTube search unavailable", "My YouTube subscriptions", "Load subscribed channels", "Show ten more channels", "Loading subscriptions", "Sign in to Google to see subscriptions", "Search public YouTube videos", "YouTube search", "Search", "Show ten more"),
        "pt" to listOf("A pesquisar no YouTube", "resultados", "Não foi possível pesquisar no YouTube", "As minhas subscrições do YouTube", "Consultar canais subscritos", "Mostrar mais dez canais", "A carregar subscrições", "Iniciar sessão com o Google para ver subscrições", "Pesquisar vídeos públicos no YouTube", "Pesquisa no YouTube", "Pesquisar", "Mostrar mais dez"),
        "fr" to listOf("Recherche sur YouTube", "résultats", "Recherche YouTube indisponible", "Mes abonnements YouTube", "Charger les chaînes suivies", "Afficher dix chaînes de plus", "Chargement des abonnements", "Se connecter à Google pour voir les abonnements", "Rechercher des vidéos publiques sur YouTube", "Recherche YouTube", "Rechercher", "Afficher dix de plus"),
        "it" to listOf("Ricerca su YouTube", "risultati", "Ricerca YouTube non disponibile", "Le mie iscrizioni YouTube", "Carica canali seguiti", "Mostra altri dieci canali", "Caricamento iscrizioni", "Accedi con Google per vedere le iscrizioni", "Cerca video pubblici su YouTube", "Ricerca YouTube", "Cerca", "Mostra altri dieci"),
        "de" to listOf("YouTube wird durchsucht", "Ergebnisse", "YouTube-Suche nicht verfügbar", "Meine YouTube-Abonnements", "Abonnierte Kanäle laden", "Zehn weitere Kanäle anzeigen", "Abonnements werden geladen", "Mit Google anmelden, um Abonnements anzuzeigen", "Öffentliche YouTube-Videos suchen", "YouTube-Suche", "Suchen", "Zehn weitere anzeigen")
    )
    fun get(language: String, key: String): String {
        val i = keys.indexOf(key)
        if (i < 0) return key
        return (catalog[language] ?: catalog.getValue("es"))[i]
    }
}
