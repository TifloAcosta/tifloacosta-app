package com.tifloacosta.nativeprototype

/** OPDS navigation chrome; catalog names and book titles remain untouched. */
internal object NativeReaderCatalogStrings {
    private val keys = listOf("back", "libraries", "add", "name", "url", "save", "all", "empty", "next", "loading")
    private val catalog = mapOf(
        "es" to listOf("Volver a Importar", "Bibliotecas externas (OPDS)", "Añadir biblioteca", "Nombre del catálogo", "Dirección HTTPS OPDS", "Guardar biblioteca", "Todas las bibliotecas", "Sin obras", "Página siguiente", "Cargando catálogo"),
        "en" to listOf("Back to import", "External libraries (OPDS)", "Add library", "Catalog name", "OPDS HTTPS URL", "Save library", "All libraries", "No entries", "Next page", "Loading catalog"),
        "pt" to listOf("Voltar a Importar", "Bibliotecas externas (OPDS)", "Adicionar biblioteca", "Nome do catálogo", "Endereço HTTPS OPDS", "Guardar biblioteca", "Todas as bibliotecas", "Sem obras", "Página seguinte", "A carregar catálogo"),
        "fr" to listOf("Retour à Importer", "Bibliothèques externes (OPDS)", "Ajouter une bibliothèque", "Nom du catalogue", "Adresse HTTPS OPDS", "Enregistrer la bibliothèque", "Toutes les bibliothèques", "Aucun ouvrage", "Page suivante", "Chargement du catalogue"),
        "it" to listOf("Torna a Importa", "Biblioteche esterne (OPDS)", "Aggiungi biblioteca", "Nome del catalogo", "Indirizzo HTTPS OPDS", "Salva biblioteca", "Tutte le biblioteche", "Nessuna opera", "Pagina successiva", "Caricamento catalogo"),
        "de" to listOf("Zurück zum Import", "Externe Bibliotheken (OPDS)", "Bibliothek hinzufügen", "Katalogname", "OPDS-HTTPS-Adresse", "Bibliothek speichern", "Alle Bibliotheken", "Keine Einträge", "Nächste Seite", "Katalog wird geladen")
    )
    fun get(language: String, key: String): String {
        val i = keys.indexOf(key)
        if (i < 0) return key
        return (catalog[language] ?: catalog.getValue("es"))[i]
    }
}
