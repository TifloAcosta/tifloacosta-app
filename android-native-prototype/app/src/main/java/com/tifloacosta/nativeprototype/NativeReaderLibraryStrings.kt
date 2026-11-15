package com.tifloacosta.nativeprototype

/** TifloLector library UI only; book names and document content stay unchanged. */
internal object NativeReaderLibraryStrings {
    private val keys = listOf(
        "home", "import", "myLibrary", "select", "done", "selectedCount",
        "delete", "loading", "empty", "finished", "audioSection", "read",
        "percent", "selected", "notSelected", "bookAction", "more", "settings",
        "folders", "filters", "expanded", "collapsed", "details",
        "titleProgress", "titleFormat", "titleFolder", "filter", "sort", "queue"
    )
    private val translations = mapOf(
        "es" to listOf(
            "Volver al inicio", "Importar", "Mi biblioteca", "Selección", "Terminar", "Seleccionados",
            "Eliminar", "Cargando biblioteca", "No hay obras con estos filtros.", "Terminado", "Sección de audio", "Leído",
            "por ciento", "Seleccionado", "No seleccionado", "Ejecutar acción del libro", "Mostrar diez más", "Ajustes",
            "Carpetas", "Filtros", "Abierto", "Cerrado", "Información de cada documento con TalkBack",
            "Título y porcentaje", "Título, porcentaje y formato", "Título, porcentaje, formato y carpeta", "Filtros", "Ordenar", "Cola de lectura"
        ),
        "en" to listOf(
            "Back to home", "Import", "My library", "Select", "Done", "Selected",
            "Delete", "Loading library", "No books match this selection.", "Finished", "Audio section", "Read",
            "percent", "Selected", "Not selected", "Perform selected book action", "Show ten more", "Settings",
            "Folders", "Filters", "Expanded", "Collapsed", "TalkBack document details",
            "Title and progress", "Title, progress and format", "Title, progress, format and folder", "Filter", "Sort documents", "Reading queue"
        ),
        "pt" to listOf(
            "Voltar ao início", "Importar", "A minha biblioteca", "Selecionar", "Concluir", "Selecionados",
            "Eliminar", "A carregar biblioteca", "Nenhuma obra corresponde aos filtros.", "Concluído", "Secção de áudio", "Lido",
            "por cento", "Selecionado", "Não selecionado", "Executar ação da obra", "Mostrar mais dez", "Definições",
            "Pastas", "Filtros", "Expandido", "Recolhido", "Detalhes dos documentos no TalkBack",
            "Título e progresso", "Título, progresso e formato", "Título, progresso, formato e pasta", "Filtrar", "Ordenar", "Fila de leitura"
        ),
        "fr" to listOf(
            "Retour à l’accueil", "Importer", "Ma bibliothèque", "Sélectionner", "Terminer", "Sélectionnés",
            "Supprimer", "Chargement de la bibliothèque", "Aucun livre ne correspond aux filtres.", "Terminé", "Partie audio", "Lu",
            "pour cent", "Sélectionné", "Non sélectionné", "Exécuter l’action du livre", "Afficher dix éléments de plus", "Paramètres",
            "Dossiers", "Filtres", "Développé", "Réduit", "Détails des documents dans TalkBack",
            "Titre et progression", "Titre, progression et format", "Titre, progression, format et dossier", "Filtrer", "Trier", "Liste de lecture"
        ),
        "it" to listOf(
            "Torna all’inizio", "Importa", "La mia biblioteca", "Seleziona", "Fine", "Selezionati",
            "Elimina", "Caricamento biblioteca", "Nessun libro corrisponde ai filtri.", "Completato", "Sezione audio", "Letto",
            "per cento", "Selezionato", "Non selezionato", "Esegui azione del libro", "Mostra altri dieci", "Impostazioni",
            "Cartelle", "Filtri", "Espanso", "Compresso", "Dettagli dei documenti in TalkBack",
            "Titolo e avanzamento", "Titolo, avanzamento e formato", "Titolo, avanzamento, formato e cartella", "Filtra", "Ordina", "Coda di lettura"
        ),
        "de" to listOf(
            "Zur Startseite", "Importieren", "Meine Bibliothek", "Auswählen", "Fertig", "Ausgewählt",
            "Löschen", "Bibliothek wird geladen", "Keine Bücher entsprechen den Filtern.", "Abgeschlossen", "Audioabschnitt", "Gelesen",
            "Prozent", "Ausgewählt", "Nicht ausgewählt", "Buchaktion ausführen", "Zehn weitere anzeigen", "Einstellungen",
            "Ordner", "Filter", "Erweitert", "Eingeklappt", "Dokumentdetails in TalkBack",
            "Titel und Fortschritt", "Titel, Fortschritt und Format", "Titel, Fortschritt, Format und Ordner", "Filtern", "Sortieren", "Lesewarteschlange"
        )
    )

    fun get(language: String, key: String): String {
        val index = keys.indexOf(key)
        if (index < 0) return key
        return (translations[language] ?: translations.getValue("es"))[index]
    }

    fun detailLevels(language: String): List<String> =
        listOf("titleProgress", "titleFormat", "titleFolder").map { get(language, it) }

    fun lengthsValid(): Boolean = translations.values.all { it.size == keys.size }
}
