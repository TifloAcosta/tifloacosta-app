package com.tifloacosta.nativeprototype

import android.speech.tts.Voice

/** Labels and TalkBack descriptions for Android voices. Voice names remain native. */
internal object NativeReaderVoicePickerStrings {
    private val keys = listOf(
        "systemDefault", "voice", "engine", "loading", "close", "voices", "previewError",
        "stop", "defaultVoice", "selectedSystem", "select", "listen", "technical", "quality",
        "online", "offline", "selected", "empty", "veryHigh", "high", "normal", "low",
        "veryLow", "unknown", "voiceSelected"
    )
    private val catalog = mapOf(
        "es" to listOf("Predeterminada del sistema", "Voz: ", "Motor: ", "Cargando voces instaladas…", "Cerrar", "Voces (", "No se pudo escuchar esta voz. Comprueba su descarga y la conexión.", "Detener muestra", "Voz predeterminada del sistema", "Voz del sistema seleccionada", "Elegir", "Escuchar", "Nombre técnico: ", "Calidad: ", "Necesita Internet", "Puede funcionar sin conexión", ". Seleccionada", "No hay voces instaladas para este filtro de idioma.", "Muy alta", "Alta", "Normal", "Baja", "Muy baja", "No indicada", "Voz seleccionada para leer"),
        "en" to listOf("System default", "Voice: ", "Engine: ", "Loading installed voices…", "Close", "Voices (", "Could not play this voice. Check its download and connection.", "Stop sample", "System default voice", "System voice selected", "Select", "Listen", "Technical name: ", "Quality: ", "Internet required", "Offline capable", ". Selected", "No installed voices match this language filter.", "Very high", "High", "Normal", "Low", "Very low", "Not specified", "Voice selected for reading"),
        "pt" to listOf("Predefinição do sistema", "Voz: ", "Motor: ", "A carregar vozes instaladas…", "Fechar", "Vozes (", "Não foi possível ouvir esta voz. Verifica a transferência e a ligação.", "Parar amostra", "Voz predefinida do sistema", "Voz do sistema selecionada", "Selecionar", "Ouvir", "Nome técnico: ", "Qualidade: ", "Requer Internet", "Pode funcionar sem ligação", ". Selecionada", "Não há vozes instaladas para este filtro de idioma.", "Muito alta", "Alta", "Normal", "Baixa", "Muito baixa", "Não indicada", "Voz selecionada para leitura"),
        "fr" to listOf("Voix par défaut du système", "Voix : ", "Moteur : ", "Chargement des voix installées…", "Fermer", "Voix (", "Impossible d’écouter cette voix. Vérifie son téléchargement et la connexion.", "Arrêter l’extrait", "Voix système par défaut", "Voix système sélectionnée", "Choisir", "Écouter", "Nom technique : ", "Qualité : ", "Internet requis", "Disponible hors connexion", ". Sélectionnée", "Aucune voix installée ne correspond au filtre de langue.", "Très haute", "Haute", "Normale", "Basse", "Très basse", "Non précisée", "Voix sélectionnée pour la lecture"),
        "it" to listOf("Predefinita di sistema", "Voce: ", "Motore: ", "Caricamento voci installate…", "Chiudi", "Voci (", "Impossibile ascoltare questa voce. Controlla il download e la connessione.", "Interrompi esempio", "Voce predefinita di sistema", "Voce di sistema selezionata", "Seleziona", "Ascolta", "Nome tecnico: ", "Qualità: ", "Richiede Internet", "Disponibile offline", ". Selezionata", "Nessuna voce installata corrisponde al filtro lingua.", "Molto alta", "Alta", "Normale", "Bassa", "Molto bassa", "Non specificata", "Voce selezionata per la lettura"),
        "de" to listOf("Systemstandard", "Stimme: ", "Sprachmotor: ", "Installierte Stimmen werden geladen…", "Schließen", "Stimmen (", "Diese Stimme konnte nicht abgespielt werden. Download und Verbindung prüfen.", "Stimmprobe stoppen", "Standard-Systemstimme", "Systemstimme ausgewählt", "Auswählen", "Anhören", "Technischer Name: ", "Qualität: ", "Internet erforderlich", "Offline verfügbar", ". Ausgewählt", "Keine installierten Stimmen für diesen Sprachfilter.", "Sehr hoch", "Hoch", "Normal", "Niedrig", "Sehr niedrig", "Nicht angegeben", "Stimme zum Lesen ausgewählt")
    )
    fun get(language: String, key: String): String {
        val index = keys.indexOf(key)
        if (index < 0) return key
        return (catalog[language] ?: catalog.getValue("es"))[index]
    }
    fun quality(language: String, quality: Int): String = get(language, when (quality) {
        Voice.QUALITY_VERY_HIGH -> "veryHigh"
        Voice.QUALITY_HIGH -> "high"
        Voice.QUALITY_NORMAL -> "normal"
        Voice.QUALITY_LOW -> "low"
        Voice.QUALITY_VERY_LOW -> "veryLow"
        else -> "unknown"
    })
    fun sample(language: String): String = when (language) {
        "en" -> "Hello, this is a voice sample from TifloLector. This is how your documents will sound."
        "pt" -> "Olá, esta é uma amostra de voz do TifloLector. É assim que os teus documentos serão lidos."
        "fr" -> "Bonjour, voici un exemple de voix de TifloLector. C’est ainsi que tes documents seront lus."
        "it" -> "Ciao, questa è una prova vocale di TifloLector. Ecco come verranno letti i tuoi documenti."
        "de" -> "Hallo, dies ist eine Stimmprobe von TifloLector. So werden deine Dokumente vorgelesen."
        else -> "Hola, estás escuchando una muestra de voz de TifloLector. Así sonará la lectura de tus documentos."
    }
}
