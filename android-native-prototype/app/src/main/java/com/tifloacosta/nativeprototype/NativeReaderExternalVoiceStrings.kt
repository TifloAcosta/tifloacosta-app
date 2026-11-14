package com.tifloacosta.nativeprototype

/** Interface-only labels for third-party Android TTS provider discovery. */
internal object NativeReaderExternalVoiceStrings {
    private val keys = listOf("back", "title", "help", "visit", "confirm", "warning", "error", "continue", "cancel", "warningTail")
    private val catalog = mapOf(
        "es" to listOf("Volver a Audio y voces", "Voces de otros proveedores", "Puedes explorar otras voces TTS para Android. La disponibilidad, los idiomas, las pruebas y los pagos dependen de cada proveedor.", "Visitar ", "¿Abrir un proveedor externo?", "Saldrás de TifloLector para visitar a ", "No se pudo abrir el proveedor de voces.", "Continuar", "Cancelar", ". La instalación y los pagos se gestionan con el proveedor."),
        "en" to listOf("Back to audio and voices", "External voice providers", "You can explore Android TTS voices from other developers. Availability, languages, trials and purchases depend on each provider.", "Visit ", "Open external provider?", "You will leave TifloLector to visit ", "Could not open the voice provider.", "Continue", "Cancel", ". Any installation or payment is managed by the provider."),
        "pt" to listOf("Voltar a Áudio e vozes", "Vozes de outros fornecedores", "Podes explorar outras vozes TTS para Android. A disponibilidade, os idiomas, os testes e os pagamentos dependem do fornecedor.", "Visitar ", "Abrir fornecedor externo?", "Vais sair do TifloLector para visitar ", "Não foi possível abrir o fornecedor de vozes.", "Continuar", "Cancelar", ". A instalação e os pagamentos são geridos pelo fornecedor."),
        "fr" to listOf("Retour à Audio et voix", "Fournisseurs de voix externes", "Tu peux découvrir des voix TTS Android d’autres développeurs. La disponibilité, les langues, les essais et les achats dépendent de chaque fournisseur.", "Visiter ", "Ouvrir un fournisseur externe ?", "Tu vas quitter TifloLector pour visiter ", "Impossible d’ouvrir le fournisseur de voix.", "Continuer", "Annuler", ". L’installation et les paiements relèvent du fournisseur."),
        "it" to listOf("Torna a Audio e voci", "Fornitori di voci esterni", "Puoi esplorare voci TTS Android di altri sviluppatori. Disponibilità, lingue, prove e acquisti dipendono dal fornitore.", "Visita ", "Aprire un fornitore esterno?", "Uscirai da TifloLector per visitare ", "Impossibile aprire il fornitore di voci.", "Continua", "Annulla", ". Installazione e pagamenti sono gestiti dal fornitore."),
        "de" to listOf("Zurück zu Audio und Stimmen", "Externe Stimmanbieter", "Du kannst Android-TTS-Stimmen anderer Entwickler erkunden. Verfügbarkeit, Sprachen, Testversionen und Käufe hängen vom Anbieter ab.", "Besuchen: ", "Externen Anbieter öffnen?", "Du verlässt TifloLector und besuchst ", "Stimmanbieter konnte nicht geöffnet werden.", "Weiter", "Abbrechen", ". Installation und Zahlungen werden vom Anbieter abgewickelt.")
    )
    fun get(language: String, key: String): String {
        val i = keys.indexOf(key)
        if (i < 0) return key
        return (catalog[language] ?: catalog.getValue("es"))[i]
    }
}
