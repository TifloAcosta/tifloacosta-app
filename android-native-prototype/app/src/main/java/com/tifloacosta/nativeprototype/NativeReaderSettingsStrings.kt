package com.tifloacosta.nativeprototype

/** Settings labels keep option indices stable across six interface languages. */
internal object NativeReaderSettingsStrings {
    private val keys = listOf(
        "groups", "backSettings", "licenses", "backReader", "title", "expanded", "collapsed",
        "speechSpeed", "systemPitch", "pauseComma", "pausePeriod", "pauseHelp", "voices",
        "voiceFilters", "externalEngines", "otherVoices", "pronunciation", "refreshVoices",
        "androidVoices", "readingHelp", "textSize", "spacing", "spacingOptions", "bold",
        "onOff", "movement", "navigationOptions", "backupOpen", "formats"
    )
    private val catalog = mapOf(
        "es" to listOf(
            "Audio y voces|Modo de lectura|Presentación visual|Navegación y avances|Formatos compatibles|Copias de seguridad",
            "Volver a ajustes", "Licencias y código fuente", "Volver a TifloLector", "Ajustes de TifloLector", "Abierto", "Cerrado",
            "Velocidad de voz", "Tono de la voz del sistema", "Pausa tras comas y punto y coma", "Pausa al final de frase",
            "El tono y las pausas por puntuación se aplican a la voz del sistema Android. Los motores externos controlan su propia prosodia.",
            "Mostrar voces", "Todas|Español|Inglés", "Motores externos", "Buscar voces de otros proveedores", "Diccionario de pronunciación", "Actualizar voces instaladas", "Buscar más voces en Android",
            "La lectura comienza cuando pulsas Reproducir. Abrir un libro no activa la voz.", "Tamaño de letra", "Interlineado", "Normal|Cómodo|Amplio", "Texto reforzado", "No|Sí", "Unidad de avance", "Bloque|Párrafo|Frase", "Abrir copia y restauración", "Formatos compatibles: TXT, Markdown, HTML, XHTML, RTF, PDF con OCR latino local, JPEG, PNG, WebP, BMP, HEIC, EPUB, DOCX, PPTX, PPSX, XLSX, ODT, ODS, ODP, DOC, PPT, PPS, XLS, FB2, PalmDOC/MOBI/PRC/PDB sin cifrar, AZW/AZW3 compatibles, ZIP, RAR, 7Z y DAISY, MP3, M4A, M4B, AAC, WAV, OGG, FLAC y OPUS si Android los admite. No se admiten DRM, compresión Kindle HUFF/CDIC, algunos diseños KF8 y ciertas imágenes de Office sin OCR."
        ),
        "en" to listOf(
            "Audio and voices|Reading mode|Visual presentation|Navigation and steps|Supported formats|Backup and restore",
            "Back to settings", "Licenses and source code", "Back to reader", "TifloLector settings", "Expanded", "Collapsed",
            "Speech speed", "System TTS pitch", "Pause after commas and semicolons", "Pause at sentence endings",
            "Pitch and punctuation pauses apply to the Android system speech engine. External engines manage their own prosody.",
            "Show voices", "All|Spanish|English", "External engines", "Find voices from other providers", "Pronunciation dictionary", "Refresh installed voices", "Find more voices in Android",
            "Reading starts only when you press Play. Opening a book never starts speech.", "Text size", "Line spacing", "Normal|Comfortable|Wide", "Bold text", "Off|On", "Movement unit", "Block|Paragraph|Sentence", "Open backup and restore tools", "Supported formats: TXT, Markdown, HTML, XHTML, RTF, PDF with offline Latin OCR, JPEG, PNG, WebP, BMP, HEIC, EPUB, DOCX, PPTX, PPSX, XLSX, ODT, ODS, ODP, legacy DOC, PPT, PPS and XLS, FB2, unencrypted PalmDOC/MOBI/PRC/PDB, compatible AZW/AZW3, ZIP, RAR, 7Z and DAISY, MP3, M4A, M4B, AAC, WAV, OGG, FLAC and OPUS if supported by Android. DRM, Kindle HUFF/CDIC, some KF8 layouts and Office images without OCR remain unsupported."
        ),
        "pt" to listOf(
            "Áudio e vozes|Modo de leitura|Apresentação visual|Navegação e avanços|Formatos compatíveis|Cópia de segurança e restauro",
            "Voltar às definições", "Licenças e código-fonte", "Voltar ao TifloLector", "Definições do TifloLector", "Expandido", "Recolhido",
            "Velocidade da fala", "Tom da voz do sistema", "Pausa após vírgulas e ponto e vírgula", "Pausa no fim da frase",
            "O tom e as pausas de pontuação aplicam-se à voz do sistema Android. Os motores externos controlam a sua própria prosódia.",
            "Mostrar vozes", "Todas|Espanhol|Inglês", "Motores externos", "Procurar vozes de outros fornecedores", "Dicionário de pronúncia", "Atualizar vozes instaladas", "Procurar mais vozes no Android",
            "A leitura só começa quando selecionas Reproduzir. Abrir um livro não inicia a fala.", "Tamanho do texto", "Espaçamento entre linhas", "Normal|Confortável|Amplo", "Texto a negrito", "Desligado|Ligado", "Unidade de avanço", "Bloco|Parágrafo|Frase", "Abrir cópia de segurança e restauro", "Formatos compatíveis: TXT, Markdown, HTML, XHTML, RTF, PDF com OCR latino local, JPEG, PNG, WebP, BMP, HEIC, EPUB, DOCX, PPTX, PPSX, XLSX, ODT, ODS, ODP, DOC, PPT, PPS, XLS, FB2, PalmDOC/MOBI/PRC/PDB sem cifragem, AZW/AZW3 compatíveis, ZIP, RAR, 7Z e DAISY, MP3, M4A, M4B, AAC, WAV, OGG, FLAC e OPUS se suportados pelo Android. DRM, compressão Kindle HUFF/CDIC, alguns layouts KF8 e imagens Office sem OCR não são suportados."
        ),
        "fr" to listOf(
            "Audio et voix|Mode de lecture|Présentation visuelle|Navigation et déplacements|Formats compatibles|Sauvegarde et restauration",
            "Retour aux paramètres", "Licences et code source", "Retour à TifloLector", "Paramètres de TifloLector", "Développé", "Réduit",
            "Vitesse de lecture", "Hauteur de la voix système", "Pause après virgule et point-virgule", "Pause en fin de phrase",
            "La hauteur et les pauses de ponctuation concernent la voix Android. Les moteurs externes gèrent leur propre prosodie.",
            "Afficher les voix", "Toutes|Espagnol|Anglais", "Moteurs externes", "Chercher des voix d’autres fournisseurs", "Dictionnaire de prononciation", "Actualiser les voix installées", "Trouver d’autres voix Android",
            "La lecture ne démarre qu’en appuyant sur Lire. L’ouverture du livre ne lance pas la synthèse.", "Taille du texte", "Interligne", "Normal|Confortable|Large", "Texte en gras", "Désactivé|Activé", "Unité de déplacement", "Bloc|Paragraphe|Phrase", "Ouvrir la sauvegarde et la restauration", "Formats compatibles : TXT, Markdown, HTML, XHTML, RTF, PDF avec OCR latin local, JPEG, PNG, WebP, BMP, HEIC, EPUB, DOCX, PPTX, PPSX, XLSX, ODT, ODS, ODP, anciens DOC, PPT, PPS, XLS, FB2, PalmDOC/MOBI/PRC/PDB non chiffrés, AZW/AZW3 compatibles, ZIP, RAR, 7Z et DAISY, MP3, M4A, M4B, AAC, WAV, OGG, FLAC et OPUS selon Android. DRM, compression Kindle HUFF/CDIC, certaines mises en page KF8 et images Office sans OCR ne sont pas pris en charge."
        ),
        "it" to listOf(
            "Audio e voci|Modalità di lettura|Presentazione visiva|Navigazione e spostamenti|Formati supportati|Backup e ripristino",
            "Torna alle impostazioni", "Licenze e codice sorgente", "Torna a TifloLector", "Impostazioni TifloLector", "Espanso", "Compresso",
            "Velocità della voce", "Tono della voce di sistema", "Pausa dopo virgole e punti e virgola", "Pausa alla fine della frase",
            "Tono e pause della punteggiatura si applicano alla voce di sistema Android. I motori esterni gestiscono la propria prosodia.",
            "Mostra voci", "Tutte|Spagnolo|Inglese", "Motori esterni", "Cerca voci di altri fornitori", "Dizionario di pronuncia", "Aggiorna voci installate", "Trova altre voci in Android",
            "La lettura inizia soltanto quando premi Riproduci. Aprire un libro non avvia la voce.", "Dimensione testo", "Interlinea", "Normale|Confortevole|Ampia", "Testo in grassetto", "Disattivato|Attivato", "Unità di spostamento", "Blocco|Paragrafo|Frase", "Apri backup e ripristino", "Formati supportati: TXT, Markdown, HTML, XHTML, RTF, PDF con OCR latino locale, JPEG, PNG, WebP, BMP, HEIC, EPUB, DOCX, PPTX, PPSX, XLSX, ODT, ODS, ODP, vecchi DOC, PPT, PPS, XLS, FB2, PalmDOC/MOBI/PRC/PDB non cifrati, AZW/AZW3 compatibili, ZIP, RAR, 7Z e DAISY, MP3, M4A, M4B, AAC, WAV, OGG, FLAC e OPUS se supportati da Android. DRM, compressione Kindle HUFF/CDIC, alcuni layout KF8 e immagini Office senza OCR non sono supportati."
        ),
        "de" to listOf(
            "Audio und Stimmen|Lesemodus|Visuelle Darstellung|Navigation und Schritte|Unterstützte Formate|Sicherung und Wiederherstellung",
            "Zurück zu den Einstellungen", "Lizenzen und Quellcode", "Zurück zu TifloLector", "TifloLector-Einstellungen", "Erweitert", "Eingeklappt",
            "Sprechgeschwindigkeit", "Tonhöhe der Systemstimme", "Pause nach Komma und Semikolon", "Pause am Satzende",
            "Tonhöhe und Satzzeichenpausen gelten für die Android-Systemstimme. Externe Sprachmotoren steuern ihre eigene Prosodie.",
            "Stimmen anzeigen", "Alle|Spanisch|Englisch", "Externe Sprachmotoren", "Stimmen anderer Anbieter suchen", "Aussprachewörterbuch", "Installierte Stimmen aktualisieren", "Weitere Android-Stimmen suchen",
            "Die Wiedergabe beginnt erst mit Wiedergabe. Beim Öffnen eines Buches wird nicht vorgelesen.", "Textgröße", "Zeilenabstand", "Normal|Bequem|Weit", "Fettdruck", "Aus|Ein", "Navigationseinheit", "Block|Absatz|Satz", "Sicherung und Wiederherstellung öffnen", "Unterstützte Formate: TXT, Markdown, HTML, XHTML, RTF, PDF mit lokalem lateinischem OCR, JPEG, PNG, WebP, BMP, HEIC, EPUB, DOCX, PPTX, PPSX, XLSX, ODT, ODS, ODP, ältere DOC, PPT, PPS, XLS, FB2, unverschlüsselte PalmDOC/MOBI/PRC/PDB, kompatible AZW/AZW3, ZIP, RAR, 7Z und DAISY, MP3, M4A, M4B, AAC, WAV, OGG, FLAC und OPUS, sofern Android sie unterstützt. DRM, Kindle-HUFF/CDIC, einige KF8-Layouts und Office-Bilder ohne OCR werden nicht unterstützt."
        )
    )
    fun get(language: String, key: String): String {
        val index = keys.indexOf(key)
        if (index < 0) return key
        return (catalog[language] ?: catalog.getValue("es"))[index]
    }
    fun options(language: String, key: String): List<String> = get(language, key).split("|")
}
