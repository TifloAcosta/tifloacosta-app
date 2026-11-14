package com.tifloacosta.nativeprototype

/** Pronunciation editor interface; user-defined substitutions are never translated. */
internal object NativeReaderPronunciationStrings {
    private val keys = listOf("back", "title", "help", "written", "spoken", "fields", "saved", "save", "empty", "deleteAction", "confirm", "delete", "cancel")
    private val catalog = mapOf(
        "es" to listOf("Volver a Audio y voces", "Diccionario de pronunciación", "Sustituye una palabra o frase solo durante la lectura en voz alta. El libro original, la posición y las marcas no cambian.", "Palabra escrita", "Pronunciar como", "Completa los dos campos.", "Pronunciación guardada", "Guardar pronunciación", "Todavía no hay pronunciaciones guardadas.", ", eliminar", "¿Eliminar pronunciación?", "Eliminar", "Cancelar"),
        "en" to listOf("Back to audio and voices", "Pronunciation dictionary", "Replace a word or phrase only while TifloLector speaks. The original book, reading position and bookmarks remain unchanged.", "Written word", "Speak as", "Enter both fields.", "Pronunciation saved", "Save pronunciation", "No pronunciation entries yet.", ", delete", "Delete pronunciation?", "Delete", "Cancel"),
        "pt" to listOf("Voltar a Áudio e vozes", "Dicionário de pronúncia", "Substitui uma palavra ou expressão apenas durante a leitura em voz alta. O livro original, a posição e os marcadores não mudam.", "Palavra escrita", "Pronunciar como", "Preenche os dois campos.", "Pronúncia guardada", "Guardar pronúncia", "Ainda não há entradas de pronúncia.", ", eliminar", "Eliminar pronúncia?", "Eliminar", "Cancelar"),
        "fr" to listOf("Retour à Audio et voix", "Dictionnaire de prononciation", "Remplace un mot ou une expression uniquement pendant la lecture à voix haute. Le livre d’origine, la position et les signets restent inchangés.", "Mot écrit", "Prononcer comme", "Remplis les deux champs.", "Prononciation enregistrée", "Enregistrer la prononciation", "Aucune prononciation enregistrée.", ", supprimer", "Supprimer la prononciation ?", "Supprimer", "Annuler"),
        "it" to listOf("Torna a Audio e voci", "Dizionario di pronuncia", "Sostituisci parole o frasi soltanto durante la lettura ad alta voce. Il libro originale, la posizione e i segnalibri restano invariati.", "Parola scritta", "Pronuncia come", "Compila entrambi i campi.", "Pronuncia salvata", "Salva pronuncia", "Non ci sono ancora pronunce salvate.", ", elimina", "Eliminare la pronuncia?", "Elimina", "Annulla"),
        "de" to listOf("Zurück zu Audio und Stimmen", "Aussprachewörterbuch", "Ersetze ein Wort oder eine Wendung nur während der Sprachausgabe. Originalbuch, Leseposition und Lesezeichen bleiben unverändert.", "Geschriebenes Wort", "Sprechen als", "Beide Felder ausfüllen.", "Aussprache gespeichert", "Aussprache speichern", "Noch keine Aussprachen gespeichert.", ", löschen", "Aussprache löschen?", "Löschen", "Abbrechen")
    )
    fun get(language: String, key: String): String {
        val i = keys.indexOf(key)
        if (i < 0) return key
        return (catalog[language] ?: catalog.getValue("es"))[i]
    }
}
