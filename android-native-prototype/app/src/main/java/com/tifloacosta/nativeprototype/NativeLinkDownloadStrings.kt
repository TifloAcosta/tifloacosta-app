package com.tifloacosta.nativeprototype

/** Native HTTPS link download labels in the six app interface languages. */
internal object NativeLinkDownloadStrings {
    private val keys = listOf("queued", "failure", "title", "url", "invalid", "analyzing", "notFound", "files", "analyzerError", "analyze", "download", "open")
    private val catalog = mapOf(
        "es" to listOf(
            "Descarga añadida al gestor de descargas de Android", "No se pudo iniciar la descarga", "Descargar un archivo desde un enlace", "Enlace HTTPS de archivo o nube", "Introduce una dirección HTTPS válida", "Analizando enlace", "No se encontraron archivos directos; puedes abrir la fuente", "%s archivos", "Analizador no disponible; se conserva el enlace original", "Analizar enlace", "Descargar: ", "Abrir enlace original"
        ),
        "en" to listOf(
            "Queued in Android Downloads", "Could not start download", "Download a file from a link", "HTTPS file or cloud link", "Enter a valid HTTPS address", "Analyzing link", "No direct files found; open the source if needed", "%s files", "Analyzer unavailable; the original link is preserved", "Analyze link", "Download: ", "Open original link"
        ),
        "pt" to listOf(
            "Transferência adicionada ao gestor do Android", "Não foi possível iniciar a transferência", "Transferir um ficheiro de uma ligação", "Ligação HTTPS para ficheiro ou nuvem", "Introduz um endereço HTTPS válido", "A analisar ligação", "Não foram encontrados ficheiros diretos; podes abrir a origem", "%s ficheiros", "Analisador indisponível; a ligação original foi conservada", "Analisar ligação", "Transferir: ", "Abrir ligação original"
        ),
        "fr" to listOf(
            "Téléchargement ajouté au gestionnaire Android", "Impossible de lancer le téléchargement", "Télécharger un fichier depuis un lien", "Lien HTTPS vers un fichier ou le cloud", "Saisis une adresse HTTPS valide", "Analyse du lien", "Aucun fichier direct trouvé ; tu peux ouvrir la source", "%s fichiers", "Analyseur indisponible ; le lien d’origine est conservé", "Analyser le lien", "Télécharger : ", "Ouvrir le lien d’origine"
        ),
        "it" to listOf(
            "Download aggiunto al gestore Android", "Impossibile avviare il download", "Scarica un file da un collegamento", "Collegamento HTTPS a file o cloud", "Inserisci un indirizzo HTTPS valido", "Analisi del collegamento", "Nessun file diretto trovato; puoi aprire la fonte", "%s file", "Analizzatore non disponibile; il collegamento originale è conservato", "Analizza collegamento", "Scarica: ", "Apri collegamento originale"
        ),
        "de" to listOf(
            "Download zum Android-Downloadmanager hinzugefügt", "Download konnte nicht gestartet werden", "Datei über einen Link herunterladen", "HTTPS-Datei- oder Cloud-Link", "Gib eine gültige HTTPS-Adresse ein", "Link wird analysiert", "Keine direkten Dateien gefunden; öffne bei Bedarf die Quelle", "%s Dateien", "Analyse nicht verfügbar; ursprünglicher Link bleibt erhalten", "Link analysieren", "Herunterladen: ", "Ursprünglichen Link öffnen"
        )
    )
    init { require(catalog.values.all { it.size == keys.size }) }
    fun get(language: String, key: String, count: Int? = null): String {
        val index = keys.indexOf(key)
        require(index >= 0) { "Unknown link download label: $key" }
        val value = (catalog[language] ?: catalog.getValue("es"))[index]
        return if (count == null) value else value.replace("%s", count.toString())
    }
}
