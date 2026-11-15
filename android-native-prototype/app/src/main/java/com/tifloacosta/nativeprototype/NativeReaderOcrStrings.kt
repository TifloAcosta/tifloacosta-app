package com.tifloacosta.nativeprototype

internal object NativeReaderOcrStrings {
    private val keys = listOf(
        "title", "preparing", "completed", "interrupted", "paused", "pdfInfo",
        "imagesInfo", "savedProgress", "complete", "review", "resume", "recognizePdf",
        "recognizeImages", "cancel", "help", "error"
    )
    private val translations = mapOf(
        "es" to listOf(
            "OCR avanzado", "Preparando OCR…", "OCR terminado. El texto accesible está disponible en el lector.",
            "OCR interrumpido. El avance está guardado; pulsa Reanudar para continuar.", "OCR pausado. Puedes reanudarlo.",
            "Reconoce PDF grandes por páginas y conserva el texto seleccionable que ya exista.",
            "Reconoce las imágenes incrustadas compatibles de este EPUB o documento Office.",
            "Avance guardado", "Completo", "Comprobar OCR nuevamente", "Reanudar OCR",
            "Reconocer PDF por lotes", "Reconocer imágenes incrustadas", "Cancelar OCR y guardar el avance",
            "Cada página o imagen queda guardada por separado. Tras cancelar o cerrar la aplicación, puedes reanudar desde aquí. El original no se modifica.", "No se pudo completar el OCR."
        ),
        "en" to listOf(
            "Advanced OCR", "Preparing OCR…", "OCR completed. The accessible text is available in the reader.",
            "OCR paused. Progress was saved; tap Resume to continue.", "OCR paused. You can resume it.",
            "Processes large PDFs page by page; retains selectable text where available.",
            "Recognizes compatible embedded images in this EPUB/Office document.",
            "Saved progress", "Complete", "Review OCR again", "Resume OCR",
            "Recognize PDF in batches", "Recognize embedded images", "Cancel OCR and save progress",
            "Pages or images are saved individually. After a cancellation or app closure, start OCR again to resume. The original stays intact.", "OCR could not be completed."
        ),
        "pt" to listOf(
            "OCR avançado", "A preparar OCR…", "OCR concluído. O texto acessível está disponível no leitor.",
            "OCR interrompido. O progresso foi guardado; escolhe Retomar para continuar.", "OCR em pausa. Podes retomar.",
            "Processa PDFs grandes página a página e conserva o texto selecionável existente.",
            "Reconhece imagens incorporadas compatíveis neste documento EPUB ou Office.",
            "Progresso guardado", "Concluído", "Verificar OCR novamente", "Retomar OCR",
            "Reconhecer PDF por lotes", "Reconhecer imagens incorporadas", "Cancelar OCR e guardar progresso",
            "Cada página ou imagem é guardada separadamente. Depois de cancelar ou fechar a aplicação, inicia novamente o OCR para retomar. O original permanece intacto.", "Não foi possível concluir o OCR."
        ),
        "fr" to listOf(
            "OCR avancé", "Préparation de l’OCR…", "OCR terminé. Le texte accessible est disponible dans le lecteur.",
            "OCR interrompu. La progression est enregistrée ; choisis Reprendre pour continuer.", "OCR en pause. Tu peux reprendre.",
            "Traite les grands PDF page par page et conserve le texte sélectionnable déjà présent.",
            "Reconnaît les images intégrées compatibles de ce document EPUB ou Office.",
            "Progression enregistrée", "Terminé", "Vérifier à nouveau l’OCR", "Reprendre l’OCR",
            "Reconnaître le PDF par lots", "Reconnaître les images intégrées", "Annuler l’OCR et enregistrer la progression",
            "Chaque page ou image est enregistrée séparément. Après une annulation ou la fermeture de l’application, relance l’OCR pour reprendre. Le document d’origine reste intact.", "Impossible de terminer l’OCR."
        ),
        "it" to listOf(
            "OCR avanzato", "Preparazione OCR…", "OCR completato. Il testo accessibile è disponibile nel lettore.",
            "OCR interrotto. Avanzamento salvato; scegli Riprendi per continuare.", "OCR in pausa. Puoi riprendere.",
            "Elabora PDF lunghi pagina per pagina e conserva il testo selezionabile già presente.",
            "Riconosce le immagini incorporate compatibili in questo documento EPUB o Office.",
            "Avanzamento salvato", "Completato", "Controlla nuovamente OCR", "Riprendi OCR",
            "Riconosci PDF a gruppi", "Riconosci immagini incorporate", "Annulla OCR e salva avanzamento",
            "Ogni pagina o immagine viene salvata separatamente. Dopo un annullamento o la chiusura dell’app, riavvia OCR per riprendere. L’originale resta intatto.", "Impossibile completare OCR."
        ),
        "de" to listOf(
            "Erweiterte Texterkennung", "Texterkennung wird vorbereitet…", "Texterkennung abgeschlossen. Der zugängliche Text ist im Lesemodus verfügbar.",
            "Texterkennung unterbrochen. Fortschritt gespeichert; wähle Fortsetzen.", "Texterkennung pausiert. Fortsetzen ist möglich.",
            "Verarbeitet große PDFs seitenweise und erhält bereits auswählbaren Text.",
            "Erkennt geeignete eingebettete Bilder in diesem EPUB- oder Office-Dokument.",
            "Gespeicherter Fortschritt", "Abgeschlossen", "Texterkennung erneut prüfen", "Texterkennung fortsetzen",
            "PDF in Abschnitten erkennen", "Eingebettete Bilder erkennen", "Texterkennung abbrechen und Fortschritt speichern",
            "Jede Seite oder jedes Bild wird einzeln gespeichert. Nach einem Abbruch oder dem Schließen der App kannst du die Texterkennung fortsetzen. Das Original bleibt unverändert.", "Texterkennung konnte nicht abgeschlossen werden."
        )
    )

    fun get(language: String, key: String): String {
        val index = keys.indexOf(key)
        if (index < 0) return key
        return (translations[language] ?: translations.getValue("es"))[index]
    }
}
