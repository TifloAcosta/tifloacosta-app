package com.tifloacosta.nativeprototype

/** Accessible book information and destructive confirmations. */
internal object NativeReaderBookDialogStrings {
    private val keys = listOf(
        "info", "marks", "lastRead", "never", "rename", "folder", "createFolder", "deleteMultiple",
        "deleteMultipleBody", "failedDelete", "deleteSingle", "save", "move", "delete", "cancel",
        "read", "finished", "audioSection", "ok"
    )
    private val catalog = mapOf(
        "es" to listOf(
            "Información de la obra", "Marcas: ", "Última lectura: ", "Nunca", "Cambiar título", "Carpeta", "Crear carpeta nueva y mover este libro", "¿Eliminar los libros seleccionados?", "Eliminar definitivamente %s libros y sus archivos.", "No se pudieron eliminar %s libros.", "¿Eliminar esta obra definitivamente?", "Guardar", "Mover", "Eliminar", "Cancelar", "Leído: ", "Terminado", "Sección de audio ", "Aceptar"
        ),
        "en" to listOf(
            "Book information", "Bookmarks: ", "Last read: ", "Never", "Rename book", "Folder", "Create new folder and move this book", "Delete selected books?", "Permanently delete %s books and their files.", "%s books could not be deleted.", "Delete book permanently?", "Save", "Move", "Delete", "Cancel", "Read: ", "Finished", "Audio section ", "OK"
        ),
        "pt" to listOf(
            "Informações da obra", "Marcadores: ", "Última leitura: ", "Nunca", "Alterar título", "Pasta", "Criar pasta nova e mover este livro", "Eliminar os livros selecionados?", "Eliminar definitivamente %s livros e os respetivos ficheiros.", "Não foi possível eliminar %s livros.", "Eliminar esta obra definitivamente?", "Guardar", "Mover", "Eliminar", "Cancelar", "Lido: ", "Concluído", "Secção de áudio ", "Aceitar"
        ),
        "fr" to listOf(
            "Informations sur le livre", "Signets : ", "Dernière lecture : ", "Jamais", "Renommer le livre", "Dossier", "Créer un dossier et y déplacer ce livre", "Supprimer les livres sélectionnés ?", "Supprimer définitivement %s livres et leurs fichiers.", "Impossible de supprimer %s livres.", "Supprimer définitivement ce livre ?", "Enregistrer", "Déplacer", "Supprimer", "Annuler", "Lu : ", "Terminé", "Partie audio ", "OK"
        ),
        "it" to listOf(
            "Informazioni sul libro", "Segnalibri: ", "Ultima lettura: ", "Mai", "Rinomina libro", "Cartella", "Crea una cartella e sposta questo libro", "Eliminare i libri selezionati?", "Eliminare definitivamente %s libri e i relativi file.", "Impossibile eliminare %s libri.", "Eliminare definitivamente questo libro?", "Salva", "Sposta", "Elimina", "Annulla", "Letto: ", "Completato", "Sezione audio ", "OK"
        ),
        "de" to listOf(
            "Buchinformationen", "Lesezeichen: ", "Zuletzt gelesen: ", "Nie", "Buch umbenennen", "Ordner", "Neuen Ordner anlegen und Buch verschieben", "Ausgewählte Bücher löschen?", "%s Bücher und ihre Dateien endgültig löschen.", "%s Bücher konnten nicht gelöscht werden.", "Dieses Buch endgültig löschen?", "Speichern", "Verschieben", "Löschen", "Abbrechen", "Gelesen: ", "Abgeschlossen", "Audioabschnitt ", "OK"
        )
    )
    init { require(catalog.values.all { it.size == keys.size }) }
    fun get(language: String, key: String, count: Int? = null): String {
        val index = keys.indexOf(key)
        require(index >= 0) { "Unknown book dialog label: $key" }
        val result = (catalog[language] ?: catalog.getValue("es"))[index]
        return if (count == null) result else result.replace("%s", count.toString())
    }
}
