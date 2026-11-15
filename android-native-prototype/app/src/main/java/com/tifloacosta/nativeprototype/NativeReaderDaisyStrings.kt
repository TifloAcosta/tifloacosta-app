package com.tifloacosta.nativeprototype

internal object NativeReaderDaisyStrings {
    private val keys = listOf(
        "headings", "pages", "notes", "references", "fragments", "back", "title",
        "navigateBy", "headingLevel", "allLevels", "level", "pageNumber", "pageMissing",
        "goPage", "entries", "empty", "fragment", "current", "more"
    )
    private val translations = mapOf(
        "es" to listOf(
            "Encabezados", "Páginas", "Notas", "Otros puntos", "Fragmentos de audio", "Volver al audiolibro", "Navegación DAISY",
            "Navegar por", "Nivel de encabezado", "Todos los niveles", "Nivel", "Número de página", "Esa página no está identificada en este DAISY.",
            "Ir a página", "Entradas", "Este DAISY no contiene puntos de navegación de esta clase.", "Fragmento", "actual", "Mostrar diez más"
        ),
        "en" to listOf(
            "Headings", "Pages", "Notes", "Other references", "Audio fragments", "Back to audiobook", "DAISY navigation",
            "Navigate by", "Heading level", "All levels", "Level", "Printed page number", "That page number is not indexed in this DAISY.",
            "Go to page", "Entries", "This DAISY book does not include navigation points of this type.", "Fragment", "current", "Show ten more"
        ),
        "pt" to listOf(
            "Cabeçalhos", "Páginas", "Notas", "Outras referências", "Fragmentos de áudio", "Voltar ao audiolivro", "Navegação DAISY",
            "Navegar por", "Nível de cabeçalho", "Todos os níveis", "Nível", "Número de página impressa", "Essa página não está indexada neste DAISY.",
            "Ir à página", "Entradas", "Este DAISY não contém pontos de navegação deste tipo.", "Fragmento", "atual", "Mostrar mais dez"
        ),
        "fr" to listOf(
            "Titres", "Pages", "Notes", "Autres références", "Fragments audio", "Retour au livre audio", "Navigation DAISY",
            "Naviguer par", "Niveau de titre", "Tous les niveaux", "Niveau", "Numéro de page imprimée", "Cette page n’est pas indexée dans ce DAISY.",
            "Aller à la page", "Entrées", "Ce DAISY ne contient aucun repère de navigation de ce type.", "Fragment", "actuel", "Afficher dix éléments de plus"
        ),
        "it" to listOf(
            "Intestazioni", "Pagine", "Note", "Altri riferimenti", "Frammenti audio", "Torna all’audiolibro", "Navigazione DAISY",
            "Naviga per", "Livello intestazione", "Tutti i livelli", "Livello", "Numero di pagina stampata", "Questa pagina non è indicizzata nel DAISY.",
            "Vai alla pagina", "Voci", "Questo DAISY non contiene punti di navigazione di questo tipo.", "Frammento", "corrente", "Mostra altri dieci"
        ),
        "de" to listOf(
            "Überschriften", "Seiten", "Notizen", "Weitere Verweise", "Audioabschnitte", "Zurück zum Hörbuch", "DAISY-Navigation",
            "Navigieren nach", "Überschriftenebene", "Alle Ebenen", "Ebene", "Gedruckte Seitenzahl", "Diese Seite ist im DAISY-Buch nicht indiziert.",
            "Zur Seite", "Einträge", "Dieses DAISY-Buch enthält keine Navigationspunkte dieses Typs.", "Fragment", "aktuell", "Zehn weitere anzeigen"
        )
    )
    fun get(language: String, key: String): String {
        val index = keys.indexOf(key)
        if (index < 0) return key
        return (translations[language] ?: translations.getValue("es"))[index]
    }
    fun types(language: String): List<String> = listOf("headings", "pages", "notes", "references", "fragments")
        .map { get(language, it) }
    fun levels(language: String): List<String> = listOf(get(language, "allLevels")) +
        (1..6).map { get(language, "level") + " " + it }
}
