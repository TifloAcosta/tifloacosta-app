package com.tifloacosta.nativeprototype

/** Controls in the sound-bank browser; source titles remain in their original language. */
internal object NativeSoundStrings {
    private val keys = listOf("all", "ringtones", "notifications", "alarms", "phones", "technology", "nature", "animals", "ambience", "funny", "games", "category", "query", "found", "unavailable", "search", "listen")
    private val catalog = mapOf(
        "es" to listOf(
            "Todos los sonidos", "Tonos de llamada", "Notificaciones", "Alarmas", "Teléfonos", "Tecnología", "Naturaleza", "Animales", "Ambiente", "Divertidos", "Juegos", "Categoría de sonidos", "Sonido que buscas", "%s sonidos encontrados", "No se pudo consultar el banco de sonidos", "Buscar sonidos", "Escuchar: "
        ),
        "en" to listOf(
            "All sounds", "Ringtones", "Notifications", "Alarms", "Phone sounds", "Technology", "Nature", "Animals", "Ambience", "Fun", "Games", "Sound category", "Sound to find", "%s sounds found", "Sound search unavailable", "Search sounds", "Listen: "
        ),
        "pt" to listOf(
            "Todos os sons", "Toques de chamada", "Notificações", "Alarmes", "Telefones", "Tecnologia", "Natureza", "Animais", "Ambiente", "Divertidos", "Jogos", "Categoria de sons", "Som a procurar", "%s sons encontrados", "Não foi possível consultar o banco de sons", "Pesquisar sons", "Ouvir: "
        ),
        "fr" to listOf(
            "Tous les sons", "Sonneries", "Notifications", "Alarmes", "Téléphones", "Technologie", "Nature", "Animaux", "Ambiance", "Amusants", "Jeux", "Catégorie de sons", "Son recherché", "%s sons trouvés", "Recherche de sons indisponible", "Rechercher des sons", "Écouter : "
        ),
        "it" to listOf(
            "Tutti i suoni", "Suonerie", "Notifiche", "Sveglie", "Telefoni", "Tecnologia", "Natura", "Animali", "Ambiente", "Divertenti", "Giochi", "Categoria suoni", "Suono da cercare", "%s suoni trovati", "Ricerca suoni non disponibile", "Cerca suoni", "Ascolta: "
        ),
        "de" to listOf(
            "Alle Klänge", "Klingeltöne", "Benachrichtigungen", "Wecktöne", "Telefonklänge", "Technologie", "Natur", "Tiere", "Umgebung", "Lustiges", "Spiele", "Klangkategorie", "Gesuchter Klang", "%s Klänge gefunden", "Klangsuche nicht verfügbar", "Klänge suchen", "Anhören: "
        )
    )
    init { require(catalog.values.all { it.size == keys.size }) }
    fun get(language: String, key: String, count: Int? = null): String {
        val index = keys.indexOf(key)
        require(index >= 0) { "Unknown sound label: $key" }
        val result = (catalog[language] ?: catalog.getValue("es"))[index]
        return if (count == null) result else result.replace("%s", count.toString())
    }
}
