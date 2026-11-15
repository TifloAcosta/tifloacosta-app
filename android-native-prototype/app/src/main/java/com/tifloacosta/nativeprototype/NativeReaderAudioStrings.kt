package com.tifloacosta.nativeprototype

/** Audio/DAISY controls; original track names and synchronized text are not translated. */
internal object NativeReaderAudioStrings {
    private val keys = listOf(
        "back", "delete", "play", "pause", "stop", "section", "details", "daisyNavigation",
        "returnPosition", "synchronized", "navigationMode", "marks", "minute", "previous", "next",
        "skip30", "speed", "sleep", "more", "saveMark", "mark", "lockScreen",
        "action0", "action1", "action2", "action3", "action4", "action5", "action6"
    )
    private val translations = mapOf(
        "es" to listOf(
            "Volver a Mi biblioteca", "Eliminar este audiolibro", "Reproducir", "Pausar", "Detener", "Sección", "Detalles y herramientas", "Navegación DAISY",
            "Volver a la posición anterior al salto", "Texto sincronizado", "Modo de navegación", "Marcas", "Tiempo (1 minuto)", "Anterior", "Siguiente",
            "Saltar 30 segundos", "Velocidad de reproducción", "Apagado automático", "Más acciones", "Guardar marca", "Marca", "La reproducción continúa al bloquear la pantalla.",
            "Reproducir o pausar", "Retroceder 30 segundos", "Avanzar 30 segundos", "Sección anterior", "Sección siguiente", "Añadir marca", "Más acciones"
        ),
        "en" to listOf(
            "Back to My library", "Delete this audiobook", "Play", "Pause", "Stop", "Section", "Book details and tools", "DAISY navigation",
            "Return to position before navigation", "Synchronized text", "Navigation mode", "Bookmarks", "Time (1 minute)", "Previous", "Next",
            "Skip 30 seconds", "Playback speed", "Sleep timer", "More actions", "Save bookmark", "Bookmark", "Playback continues when the screen is locked.",
            "Play or pause", "Back 30 seconds", "Forward 30 seconds", "Previous section", "Next section", "Bookmark", "More actions"
        ),
        "pt" to listOf(
            "Voltar à minha biblioteca", "Eliminar este audiolivro", "Reproduzir", "Pausar", "Parar", "Secção", "Detalhes e ferramentas", "Navegação DAISY",
            "Voltar à posição anterior à navegação", "Texto sincronizado", "Modo de navegação", "Marcadores", "Tempo (1 minuto)", "Anterior", "Seguinte",
            "Saltar 30 segundos", "Velocidade de reprodução", "Temporizador", "Mais ações", "Guardar marcador", "Marcador", "A reprodução continua com o ecrã bloqueado.",
            "Reproduzir ou pausar", "Recuar 30 segundos", "Avançar 30 segundos", "Secção anterior", "Secção seguinte", "Adicionar marcador", "Mais ações"
        ),
        "fr" to listOf(
            "Retour à ma bibliothèque", "Supprimer ce livre audio", "Lire", "Pause", "Arrêter", "Section", "Détails et outils", "Navigation DAISY",
            "Revenir à la position avant la navigation", "Texte synchronisé", "Mode de navigation", "Signets", "Temps (1 minute)", "Précédent", "Suivant",
            "Saut de 30 secondes", "Vitesse de lecture", "Minuteur", "Autres actions", "Enregistrer un signet", "Signet", "La lecture continue lorsque l’écran est verrouillé.",
            "Lire ou mettre en pause", "Reculer de 30 secondes", "Avancer de 30 secondes", "Section précédente", "Section suivante", "Ajouter un signet", "Autres actions"
        ),
        "it" to listOf(
            "Torna alla mia biblioteca", "Elimina questo audiolibro", "Riproduci", "Pausa", "Interrompi", "Sezione", "Dettagli e strumenti", "Navigazione DAISY",
            "Torna alla posizione precedente alla navigazione", "Testo sincronizzato", "Modalità di navigazione", "Segnalibri", "Tempo (1 minuto)", "Precedente", "Successivo",
            "Salta 30 secondi", "Velocità di riproduzione", "Timer di spegnimento", "Altre azioni", "Salva segnalibro", "Segnalibro", "La riproduzione continua anche con lo schermo bloccato.",
            "Riproduci o pausa", "Indietro di 30 secondi", "Avanti di 30 secondi", "Sezione precedente", "Sezione successiva", "Aggiungi segnalibro", "Altre azioni"
        ),
        "de" to listOf(
            "Zurück zur Bibliothek", "Dieses Hörbuch löschen", "Wiedergeben", "Pause", "Stopp", "Abschnitt", "Details und Werkzeuge", "DAISY-Navigation",
            "Zur Position vor der Navigation zurückkehren", "Synchronisierter Text", "Navigationsmodus", "Lesezeichen", "Zeit (1 Minute)", "Zurück", "Weiter",
            "30 Sekunden springen", "Wiedergabegeschwindigkeit", "Ausschalttimer", "Weitere Aktionen", "Lesezeichen speichern", "Lesezeichen", "Die Wiedergabe läuft bei gesperrtem Bildschirm weiter.",
            "Wiedergabe oder Pause", "30 Sekunden zurück", "30 Sekunden vor", "Vorheriger Abschnitt", "Nächster Abschnitt", "Lesezeichen hinzufügen", "Weitere Aktionen"
        )
    )

    fun get(language: String, key: String): String {
        val index = keys.indexOf(key)
        if (index < 0) return key
        return (translations[language] ?: translations.getValue("es"))[index]
    }

    fun actions(language: String): List<String> = (0..6).map { get(language, "action$it") }
}
