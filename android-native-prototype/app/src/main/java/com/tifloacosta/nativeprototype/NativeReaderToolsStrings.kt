package com.tifloacosta.nativeprototype

/** Six-language controls for document conversion and library backup. */
internal object NativeReaderToolsStrings {
    private val keys = listOf(
        "backReading", "toolsTitle", "convert", "audioExport", "engine", "voice", "format",
        "systemVoice", "daisyNote", "generate", "save", "cancel", "ready", "generating",
        "otherTools", "shareExport", "shareOriginal", "expanded", "collapsed",
        "backupBack", "backupTitle", "backupIntro", "backupCompat", "backupExport",
        "backupRestore", "backupNote", "cancelOperation", "restoreConfirm", "restoreWarning",
        "restore", "preparing", "checking", "backing", "backupCreated", "operationCanceled", "failed",
        "restoredCount", "alreadyExisted", "foldersCount", "systemExportNote",
        "phononExportNote", "geminiExportNote", "originalFormat", "textLength",
        "characters", "audioTracks", "marks", "generatingProgress",
        "fileExported", "audioLater", "audioSaved", "shareTextChooser", "shareOriginalChooser", "cancelled", "systemEngine"
    )
    private val translations = mapOf(
        "es" to listOf(
            "Volver a la lectura", "Detalles y herramientas", "Convertir a audio o DAISY", "Exportar audio", "Motor", "Voz", "Formato",
            "Utiliza la voz instalada del sistema Android. No necesita clave Gemini.", "DAISY incluye texto, audio sincronizado e índice. La compatibilidad externa aún no está validada.", "Generar", "Guardar", "Cancelar", "Audio preparado. Pulsa Guardar.", "Generando audio.",
            "Otras herramientas del documento", "Compartir y exportar", "Compartir archivo original", "Abierto", "Cerrado",
            "Volver a Ajustes", "Copia de seguridad y restauración", "Haz una copia antes de desinstalar una versión de pruebas. Incluye libros, originales, audios, avances de OCR, marcas, carpetas, cola y ajustes de lectura. Guárdala fuera de esta aplicación.", "Las copias de Android y de iOS utilizan formatos distintos. Restaura este ZIP en TifloLector para Android.", "Exportar copia de la biblioteca…",
            "Restaurar desde ZIP de copia…", "La restauración añade libros sin sobrescribir los existentes. Utiliza únicamente tus propias copias.", "Cancelar operación", "¿Restaurar esta copia?", "Puede necesitar bastante almacenamiento. Los libros existentes se conservarán. ¿Continuar?",
            "Restaurar", "Preparando…", "Comprobando archivo", "Guardando", "Copia creada. Conserva el ZIP fuera de esta aplicación.", "Operación cancelada. No se ha eliminado ningún libro existente.", "No se pudo completar la operación.",
            "Libros incorporados", "Ya existían", "Carpetas",
            "La voz del sistema exporta localmente si lo permite. MP3, M4A, WAV y DAISY no tienen límite fijo de caracteres.",
            "Phonon genera audio en el dispositivo. MP3, M4A, WAV y DAISY no tienen límite fijo de caracteres.",
            "Gemini puede consumir tu cuota personal. Máximo 60.000 caracteres.",
            "Formato original", "Extensión de texto", "caracteres", "Pistas de audio", "Marcas", "Generando",
            "Archivo exportado correctamente.", "Audio preparado. Puedes guardarlo cuando quieras.", "Audio guardado.", "Compartir texto", "Compartir archivo original", "Cancelado.", "Sistema"
        ),
        "en" to listOf(
            "Back to reading", "Book details and tools", "Convert to audio or DAISY", "Audio export", "Engine", "Voice", "Format",
            "Uses the installed Android system voice. No Gemini key needed.", "DAISY includes full text, synchronized clips and navigation. External-player compatibility is not yet validated.", "Generate", "Save", "Cancel", "Audio ready. Press Save.", "Generating audio.",
            "Other document tools", "Share and export", "Share original file", "Expanded", "Collapsed",
            "Back to settings", "Backup and restore", "Create a portable copy before uninstalling a test build. Includes books, originals, audio, OCR checkpoints, bookmarks, folders, queue and reading settings. Save outside this app.", "Android and iOS backups use different formats. Restore this ZIP in TifloLector for Android.", "Export library backup…",
            "Restore from backup ZIP…", "Restore adds missing books without overwriting existing ones. Only use your own backups.", "Cancel operation", "Restore backup?", "This may require significant storage. Existing books stay untouched. Continue?",
            "Restore", "Preparing…", "Checking file", "Backing up", "Backup created. Keep the ZIP outside this app.", "Operation canceled. No existing books were deleted.", "The operation failed.",
            "Books restored", "Already existed", "Folders",
            "Android system voice exports locally if supported. MP3, M4A, WAV and DAISY have no fixed character limit.",
            "Phonon generates audio locally. MP3, M4A, WAV and DAISY have no fixed character limit.",
            "Gemini may use your personal quota. Maximum 60,000 characters.",
            "Original format", "Text length", "characters", "Audio tracks", "Bookmarks", "Generating",
            "File exported successfully.", "Audio ready. You can save it later.", "Audio saved.", "Share text", "Share original file", "Cancelled.", "System"
        ),
        "pt" to listOf(
            "Voltar à leitura", "Detalhes e ferramentas", "Converter em áudio ou DAISY", "Exportar áudio", "Motor", "Voz", "Formato",
            "Utiliza a voz instalada no Android. Não precisa de chave Gemini.", "O DAISY inclui texto completo, áudio sincronizado e navegação. A compatibilidade com leitores externos ainda não foi validada.", "Gerar", "Guardar", "Cancelar", "Áudio pronto. Seleciona Guardar.", "A gerar áudio.",
            "Outras ferramentas do documento", "Partilhar e exportar", "Partilhar ficheiro original", "Expandido", "Recolhido",
            "Voltar às definições", "Cópia de segurança e restauro", "Cria uma cópia antes de desinstalar a versão de testes. Inclui livros, originais, áudio, OCR, marcadores, pastas, fila e definições de leitura. Guarda-a fora desta aplicação.", "As cópias do Android e do iOS têm formatos diferentes. Restaura este ZIP no TifloLector para Android.", "Exportar cópia da biblioteca…",
            "Restaurar de um ZIP de cópia…", "O restauro acrescenta livros sem substituir os existentes. Utiliza apenas as tuas próprias cópias.", "Cancelar operação", "Restaurar esta cópia?", "Pode exigir bastante espaço. Os livros existentes serão mantidos. Continuar?",
            "Restaurar", "A preparar…", "A verificar ficheiro", "A guardar", "Cópia criada. Guarda o ZIP fora desta aplicação.", "Operação cancelada. Nenhum livro existente foi eliminado.", "Não foi possível concluir a operação.",
            "Livros restaurados", "Já existentes", "Pastas",
            "A voz do sistema exporta localmente quando disponível. MP3, M4A, WAV e DAISY não têm limite fixo de caracteres.",
            "O Phonon gera áudio no dispositivo. MP3, M4A, WAV e DAISY não têm limite fixo de caracteres.",
            "O Gemini pode consumir a tua quota pessoal. Máximo de 60 000 caracteres.",
            "Formato original", "Comprimento do texto", "caracteres", "Faixas de áudio", "Marcadores", "A gerar",
            "Ficheiro exportado com sucesso.", "Áudio pronto. Podes guardá-lo mais tarde.", "Áudio guardado.", "Partilhar texto", "Partilhar ficheiro original", "Cancelado.", "Sistema"
        ),
        "fr" to listOf(
            "Retour à la lecture", "Détails et outils", "Convertir en audio ou DAISY", "Exporter l’audio", "Moteur", "Voix", "Format",
            "Utilise la voix Android installée. Aucune clé Gemini nécessaire.", "Le DAISY comprend le texte intégral, l’audio synchronisé et la navigation. La compatibilité avec les lecteurs externes n’est pas encore validée.", "Générer", "Enregistrer", "Annuler", "Audio prêt. Appuie sur Enregistrer.", "Génération audio en cours.",
            "Autres outils du document", "Partager et exporter", "Partager le fichier original", "Développé", "Réduit",
            "Retour aux paramètres", "Sauvegarde et restauration", "Crée une sauvegarde avant de désinstaller une version de test. Elle contient les livres, les fichiers originaux, l’audio, l’OCR, les signets, les dossiers, la liste de lecture et les paramètres. Garde-la hors de l’application.", "Les sauvegardes Android et iOS ont des formats différents. Restaure ce ZIP dans TifloLector pour Android.", "Exporter la sauvegarde de la bibliothèque…",
            "Restaurer depuis un ZIP…", "La restauration ajoute les livres manquants sans remplacer les livres existants. Utilise uniquement tes propres sauvegardes.", "Annuler l’opération", "Restaurer cette sauvegarde ?", "Un espace important peut être nécessaire. Les livres existants seront conservés. Continuer ?",
            "Restaurer", "Préparation…", "Vérification du fichier", "Sauvegarde", "Sauvegarde créée. Conserve le ZIP hors de l’application.", "Opération annulée. Aucun livre existant n’a été supprimé.", "Impossible de terminer l’opération.",
            "Livres restaurés", "Déjà présents", "Dossiers",
            "La voix Android exporte localement si elle est disponible. MP3, M4A, WAV et DAISY n’ont pas de limite fixe de caractères.",
            "Phonon génère l’audio sur l’appareil. MP3, M4A, WAV et DAISY n’ont pas de limite fixe de caractères.",
            "Gemini peut utiliser ton quota personnel. Maximum de 60 000 caractères.",
            "Format d’origine", "Longueur du texte", "caractères", "Pistes audio", "Signets", "Génération",
            "Fichier exporté avec succès.", "Audio prêt. Tu peux l’enregistrer plus tard.", "Audio enregistré.", "Partager le texte", "Partager le fichier original", "Annulé.", "Système"
        ),
        "it" to listOf(
            "Torna alla lettura", "Dettagli e strumenti", "Converti in audio o DAISY", "Esporta audio", "Motore", "Voce", "Formato",
            "Utilizza la voce Android installata. Non serve una chiave Gemini.", "DAISY include testo completo, audio sincronizzato e navigazione. La compatibilità con lettori esterni non è ancora verificata.", "Genera", "Salva", "Annulla", "Audio pronto. Premi Salva.", "Generazione audio in corso.",
            "Altri strumenti del documento", "Condividi ed esporta", "Condividi file originale", "Espanso", "Compresso",
            "Torna alle impostazioni", "Backup e ripristino", "Crea una copia prima di disinstallare una versione di prova. Include libri, originali, audio, OCR, segnalibri, cartelle, coda e impostazioni di lettura. Conservala fuori dall’app.", "I backup Android e iOS hanno formati diversi. Ripristina questo ZIP in TifloLector per Android.", "Esporta backup della biblioteca…",
            "Ripristina da ZIP di backup…", "Il ripristino aggiunge i libri mancanti senza sovrascrivere quelli presenti. Usa soltanto i tuoi backup.", "Annulla operazione", "Ripristinare il backup?", "Potrebbe servire molto spazio. I libri esistenti saranno conservati. Continuare?",
            "Ripristina", "Preparazione…", "Verifica file", "Salvataggio", "Backup creato. Conserva lo ZIP fuori dall’app.", "Operazione annullata. Nessun libro esistente è stato eliminato.", "Impossibile completare l’operazione.",
            "Libri ripristinati", "Già presenti", "Cartelle",
            "La voce Android esporta localmente quando disponibile. MP3, M4A, WAV e DAISY non hanno un limite fisso di caratteri.",
            "Phonon genera audio sul dispositivo. MP3, M4A, WAV e DAISY non hanno un limite fisso di caratteri.",
            "Gemini può utilizzare la tua quota personale. Massimo 60.000 caratteri.",
            "Formato originale", "Lunghezza testo", "caratteri", "Tracce audio", "Segnalibri", "Generazione",
            "File esportato correttamente.", "Audio pronto. Puoi salvarlo in seguito.", "Audio salvato.", "Condividi testo", "Condividi file originale", "Annullato.", "Sistema"
        ),
        "de" to listOf(
            "Zurück zum Lesen", "Buchdetails und Werkzeuge", "In Audio oder DAISY umwandeln", "Audio exportieren", "Sprachmotor", "Stimme", "Format",
            "Verwendet die installierte Android-Stimme. Kein Gemini-Schlüssel erforderlich.", "DAISY enthält den vollständigen Text, synchronisiertes Audio und Navigation. Die Kompatibilität mit externen Playern ist noch nicht geprüft.", "Erzeugen", "Speichern", "Abbrechen", "Audio bereit. Wähle Speichern.", "Audio wird erzeugt.",
            "Weitere Dokumentwerkzeuge", "Teilen und exportieren", "Originaldatei teilen", "Erweitert", "Eingeklappt",
            "Zurück zu den Einstellungen", "Sicherung und Wiederherstellung", "Erstelle vor dem Entfernen einer Testversion eine Sicherung. Sie enthält Bücher, Originale, Audio, OCR, Lesezeichen, Ordner, Warteschlange und Leseeinstellungen. Bewahre sie außerhalb der App auf.", "Android- und iOS-Sicherungen haben unterschiedliche Formate. Stelle diese ZIP-Datei in TifloLector für Android wieder her.", "Bibliothek sichern…",
            "Aus Sicherungs-ZIP wiederherstellen…", "Die Wiederherstellung ergänzt fehlende Bücher, ohne vorhandene zu überschreiben. Verwende nur eigene Sicherungen.", "Vorgang abbrechen", "Sicherung wiederherstellen?", "Dies kann viel Speicher benötigen. Vorhandene Bücher bleiben erhalten. Fortfahren?",
            "Wiederherstellen", "Vorbereitung…", "Datei wird geprüft", "Sicherung läuft", "Sicherung erstellt. Bewahre die ZIP-Datei außerhalb der App auf.", "Vorgang abgebrochen. Keine vorhandenen Bücher wurden gelöscht.", "Der Vorgang konnte nicht abgeschlossen werden.",
            "Wiederhergestellte Bücher", "Bereits vorhanden", "Ordner",
            "Die Android-Systemstimme exportiert lokal, sofern unterstützt. MP3, M4A, WAV und DAISY haben keine feste Zeichengrenze.",
            "Phonon erzeugt Audio auf dem Gerät. MP3, M4A, WAV und DAISY haben keine feste Zeichengrenze.",
            "Gemini kann dein persönliches Kontingent verbrauchen. Höchstens 60.000 Zeichen.",
            "Originalformat", "Textlänge", "Zeichen", "Audiospuren", "Lesezeichen", "Erzeuge",
            "Datei erfolgreich exportiert.", "Audio bereit. Du kannst es später speichern.", "Audio gespeichert.", "Text teilen", "Originaldatei teilen", "Abgebrochen.", "System"
        )
    )

    fun get(language: String, key: String): String {
        val index = keys.indexOf(key)
        if (index < 0) return key
        return (translations[language] ?: translations.getValue("es"))[index]
    }
}
