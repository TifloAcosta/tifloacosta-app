package com.tifloacosta.nativeprototype

/** Inline reading controls and warnings localized for TalkBack in six languages. */
internal object NativeReaderInlineStrings {
    private val keys = listOf(
        "phononMissing", "geminiMissing", "bookmarkExists", "bookmarkCreated", "readingAction",
        "word", "chapter", "percentage", "position", "positionBy", "engine", "system",
        "phononVoice", "phononHelp", "voice", "geminiPrivacy", "pronunciation", "visual",
        "textSize", "lineSpacing", "bold", "delete", "goPosition", "positionPercent", "go",
        "goTo", "readingText", "audio", "speedNormal", "lineNormal", "lineComfort", "lineWide", "no", "yes"
    )
    private val catalog = mapOf(
        "es" to listOf(
            "Falta el motor nativo Phonon o su modelo.", "Configura tu clave Gemini en Motores externos.", "Ya existe una marca en esta posición.", "Marca solicitada en la posición actual.", "Ejecutar acción de lectura",
            "Palabra", "Capítulo", "Porcentaje", "Posición", "Posición de lectura por ", "Motor", "Sistema",
            "Voz Phonon", "Phonon lee sin Internet utilizando el modelo instalado.", "Voz", "Gemini envía fragmentos del documento a Google y puede consumir cuota. Selecciona Sistema para lectura local.", "Diccionario de pronunciación", "Presentación visual",
            "Tamaño de letra", "Interlineado", "Texto reforzado", "Eliminar esta obra", "Ir a posición", "Porcentaje de posición", "Ir",
            "Ir al ", "Texto de lectura", "Voz y pronunciación", "Normal", "Normal", "Cómodo", "Amplio", "No", "Sí"
        ),
        "en" to listOf(
            "Phonon native engine or model is missing.", "Set your Gemini key under External engines.", "Bookmark already exists at this position.", "Bookmark requested at the current position.", "Perform selected reading action",
            "Word", "Chapter", "Percentage", "Position", "Reading position by ", "Engine", "System",
            "Phonon voice", "Phonon reads offline using your installed checkpoint.", "Voice", "Gemini sends text segments to Google and may use your quota. Choose System for local reading.", "Pronunciation dictionary", "Visual presentation",
            "Text size", "Line spacing", "Bold text", "Delete this book", "Go to position", "Position percentage", "Go",
            "Go to ", "Reading text", "Voice and pronunciation", "Normal", "Normal", "Comfortable", "Wide", "No", "Yes"
        ),
        "pt" to listOf(
            "Falta o motor nativo Phonon ou o modelo.", "Configura a tua chave Gemini em Motores externos.", "Já existe um marcador nesta posição.", "Marcador pedido na posição atual.", "Executar a ação de leitura selecionada",
            "Palavra", "Capítulo", "Percentagem", "Posição", "Posição de leitura por ", "Motor", "Sistema",
            "Voz Phonon", "O Phonon lê sem Internet com o modelo instalado.", "Voz", "O Gemini envia partes do texto à Google e pode consumir a tua quota. Escolhe Sistema para leitura local.", "Dicionário de pronúncia", "Apresentação visual",
            "Tamanho do texto", "Espaçamento entre linhas", "Texto a negrito", "Eliminar este livro", "Ir para a posição", "Percentagem da posição", "Ir",
            "Ir para ", "Texto de leitura", "Voz e pronúncia", "Normal", "Normal", "Confortável", "Amplo", "Não", "Sim"
        ),
        "fr" to listOf(
            "Le moteur natif Phonon ou son modèle est absent.", "Configure ta clé Gemini dans Moteurs externes.", "Un signet existe déjà à cette position.", "Signet demandé à la position actuelle.", "Exécuter l’action de lecture sélectionnée",
            "Mot", "Chapitre", "Pourcentage", "Position", "Position de lecture par ", "Moteur", "Système",
            "Voix Phonon", "Phonon lit hors ligne avec le modèle installé.", "Voix", "Gemini envoie des segments de texte à Google et peut utiliser ton quota. Choisis Système pour une lecture locale.", "Dictionnaire de prononciation", "Présentation visuelle",
            "Taille du texte", "Interligne", "Texte en gras", "Supprimer ce livre", "Aller à la position", "Pourcentage de position", "Aller",
            "Aller à ", "Texte de lecture", "Voix et prononciation", "Normal", "Normal", "Confortable", "Large", "Non", "Oui"
        ),
        "it" to listOf(
            "Manca il motore nativo Phonon o il suo modello.", "Configura la chiave Gemini in Motori esterni.", "Esiste già un segnalibro in questa posizione.", "Segnalibro richiesto nella posizione attuale.", "Esegui l’azione di lettura selezionata",
            "Parola", "Capitolo", "Percentuale", "Posizione", "Posizione di lettura per ", "Motore", "Sistema",
            "Voce Phonon", "Phonon legge offline con il modello installato.", "Voce", "Gemini invia parti del testo a Google e può consumare la quota disponibile. Scegli Sistema per la lettura locale.", "Dizionario di pronuncia", "Presentazione visiva",
            "Dimensione testo", "Interlinea", "Testo in grassetto", "Elimina questo libro", "Vai alla posizione", "Percentuale della posizione", "Vai",
            "Vai a ", "Testo di lettura", "Voce e pronuncia", "Normale", "Normale", "Confortevole", "Ampio", "No", "Sì"
        ),
        "de" to listOf(
            "Die native Phonon-Engine oder ihr Modell fehlt.", "Richte deinen Gemini-Schlüssel unter Externe Engines ein.", "An dieser Position gibt es bereits ein Lesezeichen.", "Lesezeichen an der aktuellen Position angefordert.", "Ausgewählte Leseaktion ausführen",
            "Wort", "Kapitel", "Prozent", "Position", "Leseposition nach ", "Engine", "System",
            "Phonon-Stimme", "Phonon liest offline mit dem installierten Modell.", "Stimme", "Gemini überträgt Textabschnitte an Google und kann dein Kontingent verbrauchen. Wähle System für lokales Lesen.", "Aussprachewörterbuch", "Visuelle Darstellung",
            "Textgröße", "Zeilenabstand", "Fetter Text", "Dieses Buch löschen", "Zur Position springen", "Positionsprozent", "Los",
            "Gehe zu ", "Lesetext", "Stimme und Aussprache", "Normal", "Normal", "Bequem", "Weit", "Nein", "Ja"
        )
    )
    init { require(catalog.values.all { it.size == keys.size }) }
    fun get(language: String, key: String): String {
        val index = keys.indexOf(key)
        require(index >= 0) { "Unknown reader control: $key" }
        return (catalog[language] ?: catalog.getValue("es"))[index]
    }
}
