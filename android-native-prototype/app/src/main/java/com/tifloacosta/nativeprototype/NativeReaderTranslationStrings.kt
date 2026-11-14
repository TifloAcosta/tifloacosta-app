package com.tifloacosta.nativeprototype

/** Interface labels only: the original and translated document text remain separate. */
internal object NativeReaderTranslationStrings {
    private val keys = listOf(
        "saveOriginal", "shareText", "exportTxt", "translation", "help", "source", "target",
        "scope", "fragment", "whole", "preparing", "translating", "done", "translateNow",
        "cancel", "translated", "share", "exportTranslated", "bookSettings", "opening",
        "unit", "block", "paragraph", "sentence", "voiceSettings", "error"
    )
    private val translations = mapOf(
        "es" to listOf(
            "Guardar original en…", "Compartir texto extraído", "Exportar TXT accesible…", "Traducción",
            "La primera traducción requiere descargar el modelo. Después, la traducción se realiza en el dispositivo y no modifica el original. Revisa el resultado automático antes de utilizarlo.",
            "Idioma de origen", "Idioma de destino", "Traducir", "Fragmento actual", "Documento completo (máx. 60.000 caracteres)",
            "Preparando traducción…", "Traduciendo", "Traducción terminada.", "Traducir ahora", "Cancelar traducción", "Texto traducido", "Compartir traducción", "Exportar traducción como TXT…",
            "Ajustes de esta obra", "Abrir un documento no inicia la voz. Utiliza Reproducir cuando quieras escuchar.",
            "Unidad de navegación", "Bloque", "Párrafo", "Frase", "La voz, la velocidad y la presentación están en los apartados Audio y Visual del lector y se conservan por separado para esta obra.", "No se pudo traducir."
        ),
        "en" to listOf(
            "Save original file to…", "Share extracted text", "Export accessible TXT…", "Translation",
            "Models are downloaded on the first use. Translation happens on the device; the original is never changed. Review automated translations before using them.",
            "Source language", "Target language", "Translate", "Current fragment", "Entire document (max. 60,000 chars)",
            "Preparing translation…", "Translating", "Translation finished.", "Translate now", "Cancel translation", "Translated text", "Share translation", "Export translated TXT…",
            "Settings for this book", "Opening a document never starts speech. Use Play when you want to listen.",
            "Navigation unit", "Block", "Paragraph", "Sentence", "Voice, speed and presentation settings are available in the Audio and Visual sections of the reader and are kept separately for this book.", "Translation failed."
        ),
        "pt" to listOf(
            "Guardar original em…", "Partilhar texto extraído", "Exportar TXT acessível…", "Tradução",
            "Na primeira utilização, descarrega o modelo. A tradução é feita no dispositivo e não altera o original. Revê o resultado automático antes de o utilizar.",
            "Idioma de origem", "Idioma de destino", "Traduzir", "Fragmento atual", "Documento completo (máx. 60 000 caracteres)",
            "A preparar tradução…", "A traduzir", "Tradução concluída.", "Traduzir agora", "Cancelar tradução", "Texto traduzido", "Partilhar tradução", "Exportar TXT traduzido…",
            "Definições desta obra", "Abrir um documento não inicia a voz. Utiliza Reproduzir quando quiseres ouvir.",
            "Unidade de navegação", "Bloco", "Parágrafo", "Frase", "As definições de voz, velocidade e apresentação estão nas secções Áudio e Visual do leitor e são guardadas para esta obra.", "Não foi possível traduzir."
        ),
        "fr" to listOf(
            "Enregistrer l’original dans…", "Partager le texte extrait", "Exporter un TXT accessible…", "Traduction",
            "Le modèle est téléchargé à la première utilisation. La traduction se fait sur l’appareil sans modifier l’original. Vérifie le résultat automatique avant de l’utiliser.",
            "Langue source", "Langue cible", "Traduire", "Fragment actuel", "Document entier (60 000 caractères max.)",
            "Préparation de la traduction…", "Traduction en cours", "Traduction terminée.", "Traduire maintenant", "Annuler la traduction", "Texte traduit", "Partager la traduction", "Exporter le TXT traduit…",
            "Paramètres de ce livre", "Ouvrir un document ne démarre pas la synthèse vocale. Utilise Lire pour écouter.",
            "Unité de navigation", "Bloc", "Paragraphe", "Phrase", "Les réglages de voix, vitesse et présentation figurent dans les sections Audio et Visuel du lecteur et sont conservés pour ce livre.", "Impossible de traduire."
        ),
        "it" to listOf(
            "Salva originale in…", "Condividi testo estratto", "Esporta TXT accessibile…", "Traduzione",
            "Al primo utilizzo viene scaricato il modello. La traduzione avviene sul dispositivo senza modificare l’originale. Controlla il risultato automatico prima di usarlo.",
            "Lingua di origine", "Lingua di destinazione", "Traduci", "Frammento attuale", "Documento intero (max 60.000 caratteri)",
            "Preparazione traduzione…", "Traduzione in corso", "Traduzione completata.", "Traduci ora", "Annulla traduzione", "Testo tradotto", "Condividi traduzione", "Esporta TXT tradotto…",
            "Impostazioni del libro", "L’apertura di un documento non avvia la voce. Usa Riproduci quando vuoi ascoltare.",
            "Unità di navigazione", "Blocco", "Paragrafo", "Frase", "Voce, velocità e presentazione sono nelle sezioni Audio e Visuale del lettore e vengono salvate per questo libro.", "Impossibile tradurre."
        ),
        "de" to listOf(
            "Original speichern unter…", "Erkannten Text teilen", "Zugängliche TXT-Datei exportieren…", "Übersetzung",
            "Das Modell wird bei der ersten Nutzung heruntergeladen. Die Übersetzung erfolgt auf dem Gerät und verändert das Original nicht. Prüfe automatische Übersetzungen vor der Verwendung.",
            "Ausgangssprache", "Zielsprache", "Übersetzen", "Aktueller Abschnitt", "Gesamtes Dokument (max. 60.000 Zeichen)",
            "Übersetzung wird vorbereitet…", "Übersetzung läuft", "Übersetzung abgeschlossen.", "Jetzt übersetzen", "Übersetzung abbrechen", "Übersetzter Text", "Übersetzung teilen", "Übersetzte TXT-Datei exportieren…",
            "Bucheinstellungen", "Beim Öffnen eines Dokuments startet keine Sprachausgabe. Wähle Wiedergabe, wenn du zuhören möchtest.",
            "Navigationseinheit", "Block", "Absatz", "Satz", "Stimme, Geschwindigkeit und Darstellung werden in den Audio- und Anzeigeeinstellungen des Lesers für dieses Buch gespeichert.", "Übersetzung fehlgeschlagen."
        )
    )
    fun get(language: String, key: String): String {
        val index = keys.indexOf(key)
        if (index < 0) return key
        return (translations[language] ?: translations.getValue("es"))[index]
    }
    fun scopeChoices(language: String): List<String> = listOf(get(language, "fragment"), get(language, "whole"))
    fun navigationChoices(language: String): List<String> = listOf(get(language, "block"), get(language, "paragraph"), get(language, "sentence"))
}
