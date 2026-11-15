package com.tifloacosta.nativeprototype

/** Stable navigation and TalkBack command indexes across interface locales. */
internal object NativeReaderPlaybackStrings {
    private val keys = listOf(
        "mode0", "mode1", "mode2", "mode3", "mode4", "mode5", "mode6", "mode7",
        "action0", "action1", "action2", "action3", "action4", "action5",
        "back", "play", "pause", "moveBy", "stop", "convert", "initializing",
        "speed", "sleep", "off", "progress", "percentRead", "actionLabel",
        "addBookmark", "bookmarks", "noBookmarks", "moreActions", "voice", "visual",
        "expanded", "collapsed"
    )
    private val translations = mapOf(
        "es" to listOf(
            "Bloque", "Párrafo", "Frase", "Palabra", "Capítulo o sección", "Porcentaje (pasos del 10 %)", "Marcas", "Tiempo estimado (1 minuto)",
            "Reproducir o pausar", "Detener", "Anterior", "Siguiente", "Añadir marca", "Más acciones",
            "Volver a Mi biblioteca", "Reproducir", "Pausar", "Avanzar y retroceder por", "Detener lectura", "Convertir a audio o DAISY", "Preparando la voz de Android…",
            "Velocidad de lectura", "Apagado automático", "Desactivado", "Progreso de lectura", "% leído", "Acción",
            "Añadir marca", "Marcas", "No hay marcas", "Más acciones", "Voz y pronunciación", "Presentación visual", "Abierto", "Cerrado"
        ),
        "en" to listOf(
            "Block", "Paragraph", "Sentence", "Word", "Chapter or section", "Percentage (10% steps)", "Bookmarks", "Estimated time (1 minute)",
            "Play or pause", "Stop", "Previous", "Next", "Bookmark", "More actions",
            "Back to my library", "Play", "Pause", "Move by", "Stop reading", "Convert to audio or DAISY", "Initializing Android speech…",
            "Speech speed", "Sleep timer", "Off", "Reading progress", "% read", "Action",
            "Add bookmark", "Bookmarks", "No bookmarks", "More actions", "Voice and pronunciation", "Visual presentation", "Expanded", "Collapsed"
        ),
        "pt" to listOf(
            "Bloco", "Parágrafo", "Frase", "Palavra", "Capítulo ou secção", "Percentagem (passos de 10 %)", "Marcadores", "Tempo estimado (1 minuto)",
            "Reproduzir ou pausar", "Parar", "Anterior", "Seguinte", "Adicionar marcador", "Mais ações",
            "Voltar à minha biblioteca", "Reproduzir", "Pausar", "Avançar e recuar por", "Parar leitura", "Converter em áudio ou DAISY", "A preparar a voz do Android…",
            "Velocidade de leitura", "Temporizador", "Desativado", "Progresso de leitura", "% lido", "Ação",
            "Adicionar marcador", "Marcadores", "Sem marcadores", "Mais ações", "Voz e pronúncia", "Apresentação visual", "Expandido", "Recolhido"
        ),
        "fr" to listOf(
            "Bloc", "Paragraphe", "Phrase", "Mot", "Chapitre ou section", "Pourcentage (pas de 10 %)", "Signets", "Temps estimé (1 minute)",
            "Lire ou mettre en pause", "Arrêter", "Précédent", "Suivant", "Ajouter un signet", "Autres actions",
            "Retour à ma bibliothèque", "Lire", "Pause", "Avancer et reculer par", "Arrêter la lecture", "Convertir en audio ou DAISY", "Préparation de la voix Android…",
            "Vitesse de lecture", "Minuteur", "Désactivé", "Progression de lecture", "% lu", "Action",
            "Ajouter un signet", "Signets", "Aucun signet", "Autres actions", "Voix et prononciation", "Présentation visuelle", "Développé", "Réduit"
        ),
        "it" to listOf(
            "Blocco", "Paragrafo", "Frase", "Parola", "Capitolo o sezione", "Percentuale (passi del 10%)", "Segnalibri", "Tempo stimato (1 minuto)",
            "Riproduci o pausa", "Interrompi", "Precedente", "Successivo", "Aggiungi segnalibro", "Altre azioni",
            "Torna alla mia biblioteca", "Riproduci", "Pausa", "Avanza o torna indietro per", "Interrompi lettura", "Converti in audio o DAISY", "Preparazione della voce Android…",
            "Velocità di lettura", "Timer di spegnimento", "Disattivato", "Avanzamento lettura", "% letto", "Azione",
            "Aggiungi segnalibro", "Segnalibri", "Nessun segnalibro", "Altre azioni", "Voce e pronuncia", "Presentazione visiva", "Espanso", "Compresso"
        ),
        "de" to listOf(
            "Block", "Absatz", "Satz", "Wort", "Kapitel oder Abschnitt", "Prozent (10-%-Schritte)", "Lesezeichen", "Geschätzte Zeit (1 Minute)",
            "Wiedergabe oder Pause", "Stopp", "Zurück", "Weiter", "Lesezeichen hinzufügen", "Weitere Aktionen",
            "Zurück zur Bibliothek", "Wiedergeben", "Pause", "Vorwärts und rückwärts nach", "Lesen stoppen", "In Audio oder DAISY umwandeln", "Android-Stimme wird vorbereitet…",
            "Lesegeschwindigkeit", "Ausschalttimer", "Aus", "Lesefortschritt", "% gelesen", "Aktion",
            "Lesezeichen hinzufügen", "Lesezeichen", "Keine Lesezeichen", "Weitere Aktionen", "Stimme und Aussprache", "Visuelle Darstellung", "Erweitert", "Eingeklappt"
        )
    )

    fun get(language: String, key: String): String {
        val index = keys.indexOf(key)
        if (index < 0) return key
        return (translations[language] ?: translations.getValue("es"))[index]
    }

    fun modes(language: String, hasChapters: Boolean): List<Pair<Int, String>> =
        (listOf(0, 1, 2, 3) + (if (hasChapters) listOf(4) else emptyList()) +
            listOf(5, 6, 7)).map { it to get(language, "mode$it") }

    fun actions(language: String): List<String> =
        (0..5).map { get(language, "action$it") }

    fun sleepChoices(language: String): List<String> =
        listOf(get(language, "off")) + listOf(5, 10, 15, 30, 45, 60).map {
            when (language) {
                "en" -> "$it minutes"
                "fr" -> "$it minutes"
                "de" -> "$it Minuten"
                "it" -> "$it minuti"
                "pt" -> "$it minutos"
                else -> "$it minutos"
            }
        }
}
