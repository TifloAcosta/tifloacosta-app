package com.tifloacosta.nativeprototype

/** Import, legacy-book recovery and library action labels, independent of book language. */
internal object NativeReaderLegacyStrings {
    private val keys = listOf(
        "earlierError", "sharedProgress", "sharedDone", "importProgress", "imported", "failures",
        "storageHint", "legacyRecover", "legacySummary", "legacyMore", "legacyComplete",
        "extracting", "recognizing", "backReader", "files", "opds", "legacyUnreadable",
        "legacyCount", "legacyOpen", "legacyLoadError", "previousOpenError", "previousUnavailable",
        "open", "play", "marks", "favorite", "info", "rename", "move", "delete", "queue",
        "markRead", "convert", "sharedFailure", "missingBook", "missingImport", "openFailure"
    )
    private val catalog = mapOf(
        "es" to listOf(
            "No se pudo enumerar la biblioteca anterior. Usa Abrir biblioteca anterior; no se ha modificado ningún archivo.", "Importando documento compartido %s de %s", "%s de %s documentos compartidos añadidos a la biblioteca.", "Importando archivo %s de %s", "%s documentos importados.", " Fallos: %s. ",
            "El selector de documentos de Android ofrece archivos locales y proveedores de nube instalados.", "Recuperar biblioteca anterior (opcional)", "Libros que ya tenías (%s). Abre un título en el lector original; se conservan marcas y progreso.", "Mostrar otros 20 libros anteriores", "Abrir biblioteca anterior completa",
            "Extrayendo audiolibro: %s archivos", "Reconociendo PDF: página %s de %s", "Volver a TifloLector", "Archivos", "Bibliotecas externas (OPDS)", "No se pudo comprobar la biblioteca anterior. Sus archivos siguen intactos.",
            "Libros que ya tenías (%s). Abre cualquier título en el lector original, conservando tus marcas y el progreso.", "Abrir: ", "No se pudieron cargar más libros anteriores.", "No se pudo solicitar la apertura de la biblioteca anterior.", "La biblioteca original no está disponible en esta compilación.",
            "Abrir", "Reproducir", "Marcas", "Favorito", "Información", "Cambiar título", "Mover a carpeta", "Eliminar", "Añadir o quitar de cola", "Marcar como terminado o pendiente", "Convertir a audio o DAISY", "No se pudo importar el documento compartido.", "El documento ya no está disponible en la biblioteca.", "No se pudo recuperar el documento.", "No se pudo abrir el documento."
        ),
        "en" to listOf(
            "Could not list earlier books. Use Open existing library; no files were modified.", "Importing shared document %s of %s", "%s of %s shared documents added to the library.", "Importing file %s of %s", "%s documents imported.", " Failed: %s. ",
            "The Android document picker provides local files and installed cloud providers.", "Recover previous library (optional)", "Existing books (%s). Open a title in the original reader; bookmarks and progress remain intact.", "Show 20 more existing books", "Open complete existing library",
            "Extracting audiobook: %s files", "Recognizing PDF: page %s of %s", "Back to TifloLector", "Files", "External libraries (OPDS)", "The existing library could not be read. Its files are untouched.",
            "Existing books (%s). Open any title in the original reader with bookmarks and progress preserved.", "Open: ", "Could not load more existing books.", "Could not open the previous library.", "Original reader is unavailable in this test build.",
            "Open", "Play", "Bookmarks", "Favorite", "Information", "Rename", "Move to folder", "Delete", "Add or remove from queue", "Mark read or unread", "Convert to audio or DAISY", "Could not import the shared document.", "The document is no longer in the library.", "Could not retrieve the document.", "Could not open the document."
        ),
        "pt" to listOf(
            "Não foi possível listar os livros anteriores. Abre a biblioteca anterior; nenhum ficheiro foi alterado.", "A importar documento partilhado %s de %s", "%s de %s documentos partilhados adicionados à biblioteca.", "A importar ficheiro %s de %s", "%s documentos importados.", " Falhas: %s. ",
            "O seletor Android permite escolher ficheiros locais e serviços de nuvem instalados.", "Recuperar biblioteca anterior (opcional)", "Livros anteriores (%s). Abre um título no leitor original; marcadores e progresso são mantidos.", "Mostrar mais 20 livros anteriores", "Abrir biblioteca anterior completa",
            "A extrair audiolivro: %s ficheiros", "A reconhecer PDF: página %s de %s", "Voltar ao TifloLector", "Ficheiros", "Bibliotecas externas (OPDS)", "Não foi possível ler a biblioteca anterior. Os ficheiros não foram alterados.",
            "Livros anteriores (%s). Abre um título no leitor original com os marcadores e o progresso preservados.", "Abrir: ", "Não foi possível carregar mais livros anteriores.", "Não foi possível abrir a biblioteca anterior.", "O leitor original não está disponível nesta versão de teste.",
            "Abrir", "Reproduzir", "Marcadores", "Favorito", "Informações", "Alterar título", "Mover para pasta", "Eliminar", "Adicionar ou remover da fila", "Marcar como lido ou por ler", "Converter em áudio ou DAISY", "Não foi possível importar o documento partilhado.", "O documento já não está na biblioteca.", "Não foi possível recuperar o documento.", "Não foi possível abrir o documento."
        ),
        "fr" to listOf(
            "Impossible de lister les anciens livres. Ouvre l’ancienne bibliothèque ; aucun fichier n’a été modifié.", "Importation du document partagé %s sur %s", "%s documents partagés sur %s ajoutés à la bibliothèque.", "Importation du fichier %s sur %s", "%s documents importés.", " Échecs : %s. ",
            "Le sélecteur Android donne accès aux fichiers locaux et aux services cloud installés.", "Récupérer l’ancienne bibliothèque (facultatif)", "Anciens livres (%s). Ouvre un titre dans le lecteur d’origine ; signets et progression sont conservés.", "Afficher 20 anciens livres de plus", "Ouvrir toute l’ancienne bibliothèque",
            "Extraction du livre audio : %s fichiers", "Reconnaissance du PDF : page %s sur %s", "Retour à TifloLector", "Fichiers", "Bibliothèques externes (OPDS)", "Impossible de consulter l’ancienne bibliothèque. Ses fichiers sont intacts.",
            "Anciens livres (%s). Ouvre un titre dans le lecteur d’origine avec signets et progression conservés.", "Ouvrir : ", "Impossible de charger d’autres anciens livres.", "Impossible d’ouvrir l’ancienne bibliothèque.", "Le lecteur d’origine est indisponible dans cette version de test.",
            "Ouvrir", "Lire", "Signets", "Favori", "Informations", "Renommer", "Déplacer dans un dossier", "Supprimer", "Ajouter ou retirer de la liste", "Marquer comme lu ou non lu", "Convertir en audio ou DAISY", "Impossible d’importer le document partagé.", "Ce document ne figure plus dans la bibliothèque.", "Impossible de récupérer le document.", "Impossible d’ouvrir le document."
        ),
        "it" to listOf(
            "Impossibile elencare i libri precedenti. Apri la vecchia biblioteca; nessun file è stato modificato.", "Importazione documento condiviso %s di %s", "%s di %s documenti condivisi aggiunti alla biblioteca.", "Importazione file %s di %s", "%s documenti importati.", " Errori: %s. ",
            "Il selettore Android mostra file locali e servizi cloud installati.", "Recupera biblioteca precedente (facoltativo)", "Libri precedenti (%s). Apri un titolo nel lettore originale; segnalibri e avanzamento sono conservati.", "Mostra altri 20 libri precedenti", "Apri biblioteca precedente completa",
            "Estrazione audiolibro: %s file", "Riconoscimento PDF: pagina %s di %s", "Torna a TifloLector", "File", "Biblioteche esterne (OPDS)", "Impossibile leggere la biblioteca precedente. I file sono intatti.",
            "Libri precedenti (%s). Apri un titolo nel lettore originale con segnalibri e avanzamento conservati.", "Apri: ", "Impossibile caricare altri libri precedenti.", "Impossibile aprire la biblioteca precedente.", "Il lettore originale non è disponibile in questa versione di prova.",
            "Apri", "Riproduci", "Segnalibri", "Preferito", "Informazioni", "Rinomina", "Sposta nella cartella", "Elimina", "Aggiungi o rimuovi dalla coda", "Segna come letto o da leggere", "Converti in audio o DAISY", "Impossibile importare il documento condiviso.", "Il documento non è più nella biblioteca.", "Impossibile recuperare il documento.", "Impossibile aprire il documento."
        ),
        "de" to listOf(
            "Frühere Bücher konnten nicht aufgelistet werden. Öffne die alte Bibliothek; keine Dateien wurden geändert.", "Geteiltes Dokument %s von %s wird importiert", "%s von %s geteilten Dokumenten zur Bibliothek hinzugefügt.", "Datei %s von %s wird importiert", "%s Dokumente importiert.", " Fehler: %s. ",
            "Die Android-Dateiauswahl zeigt lokale Dateien und installierte Cloud-Dienste.", "Frühere Bibliothek wiederherstellen (optional)", "Frühere Bücher (%s). Öffne einen Titel im ursprünglichen Leser; Lesezeichen und Fortschritt bleiben erhalten.", "20 weitere alte Bücher anzeigen", "Gesamte frühere Bibliothek öffnen",
            "Hörbuch wird entpackt: %s Dateien", "PDF-Erkennung: Seite %s von %s", "Zurück zu TifloLector", "Dateien", "Externe Bibliotheken (OPDS)", "Frühere Bibliothek konnte nicht gelesen werden. Die Dateien bleiben unverändert.",
            "Frühere Bücher (%s). Öffne einen Titel im ursprünglichen Leser mit erhaltenen Lesezeichen und Lesefortschritt.", "Öffnen: ", "Weitere alte Bücher konnten nicht geladen werden.", "Frühere Bibliothek konnte nicht geöffnet werden.", "Der ursprüngliche Leser ist in dieser Testversion nicht verfügbar.",
            "Öffnen", "Abspielen", "Lesezeichen", "Favorit", "Informationen", "Umbenennen", "In Ordner verschieben", "Löschen", "Zur Warteschlange hinzufügen oder entfernen", "Als gelesen oder ungelesen markieren", "In Audio oder DAISY umwandeln", "Geteiltes Dokument konnte nicht importiert werden.", "Das Dokument ist nicht mehr in der Bibliothek.", "Dokument konnte nicht wiederhergestellt werden.", "Dokument konnte nicht geöffnet werden."
        )
    )
    init { require(catalog.values.all { it.size == keys.size }) }
    fun get(language: String, key: String, vararg args: Any): String {
        val index = keys.indexOf(key)
        require(index >= 0) { "Unknown reader library key: $key" }
        var message = (catalog[language] ?: catalog.getValue("es"))[index]
        args.forEach { message = message.replaceFirst("%s", it.toString()) }
        return message
    }
    fun actions(language: String): List<String> = listOf(
        "open", "play", "marks", "favorite", "info", "rename", "move", "delete", "queue", "markRead", "convert"
    ).map { get(language, it) }
}
