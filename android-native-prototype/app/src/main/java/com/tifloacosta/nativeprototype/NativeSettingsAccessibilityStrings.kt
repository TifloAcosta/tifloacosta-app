package com.tifloacosta.nativeprototype

/** Full accessibility guidance inside Android settings, separate from privacy. */
internal object NativeSettingsAccessibilityStrings {
    private val keys = listOf("talkBack","navigation","largerText","reading","originalContent","feedback")
    private val catalog = mapOf(
        "es" to listOf(
            "TifloAcosta está diseñada para utilizarse con TalkBack. Los botones y los controles ajustables deben anunciar su función y el valor seleccionado.",
            "En TifloLector, cada título de la biblioteca se presenta como un único elemento. Los filtros, las carpetas, las marcas y las acciones de lectura tienen controles independientes.",
            "Puedes activar Texto más grande y elegir un aspecto claro, oscuro o adaptado al sistema desde Configuración. Los ajustes visuales de lectura se encuentran en TifloLector.",
            "En un documento puedes reproducir o pausar, cambiar la unidad de navegación, avanzar o retroceder y consultar las marcas. La disponibilidad de algunas acciones depende del formato.",
            "Cambiar el idioma de la interfaz no traduce automáticamente tus libros ni las noticias. La traducción del contenido se realiza cuando tú la solicitas.",
            "Si encuentras un control que TalkBack no anuncia correctamente, puedes comunicarlo desde Configuración, Contacto. Indica la pantalla, el gesto y el modelo de Android."),
        "en" to listOf(
            "TifloAcosta is designed for use with TalkBack. Buttons and adjustable controls should announce their purpose and selected value.",
            "In TifloLector, each library title is presented as a single item. Filters, folders, bookmarks and reading actions have separate controls.",
            "You can enable Larger text and choose light, dark or system appearance in Settings. Reading display options are available inside TifloLector.",
            "Within a document you can play or pause, change navigation units, move forward or backward and access bookmarks. Some actions depend on the document format.",
            "Changing the interface language does not automatically translate your books or news. Content is translated only when you request it.",
            "If TalkBack does not announce a control correctly, report it through Settings, Contact. Include the screen, gesture and Android device model."),
        "pt" to listOf(
            "O TifloAcosta foi concebido para usar com TalkBack. Os botões e controlos ajustáveis devem anunciar a sua função e o valor selecionado.",
            "No TifloLector, cada título da biblioteca é apresentado como um único elemento. Os filtros, pastas, marcadores e ações de leitura têm controlos próprios.",
            "Podes ativar Texto maior e escolher o aspeto claro, escuro ou do sistema nas Definições. As opções visuais de leitura estão no TifloLector.",
            "Num documento, podes reproduzir ou pausar, alterar a unidade de navegação, avançar ou recuar e consultar marcadores. Algumas ações dependem do formato.",
            "Alterar o idioma da interface não traduz automaticamente os teus livros ou notícias. O conteúdo só é traduzido quando pedes.",
            "Se o TalkBack não anunciar corretamente um controlo, comunica-o em Definições, Contacto. Indica o ecrã, o gesto e o modelo Android."),
        "fr" to listOf(
            "TifloAcosta est conçu pour être utilisé avec TalkBack. Les boutons et réglages doivent annoncer leur rôle et la valeur sélectionnée.",
            "Dans TifloLector, chaque titre de la bibliothèque constitue un seul élément. Filtres, dossiers, signets et actions de lecture ont leurs propres commandes.",
            "Tu peux activer Texte plus grand et choisir une apparence claire, sombre ou système dans Paramètres. Les options d’affichage de lecture sont dans TifloLector.",
            "Dans un document, tu peux lire ou mettre en pause, changer d’unité de navigation, avancer, reculer et consulter les signets. Certaines actions dépendent du format.",
            "Changer la langue de l’interface ne traduit pas automatiquement tes livres ni les actualités. Le contenu n’est traduit qu’à ta demande.",
            "Si TalkBack annonce mal une commande, signale-le dans Paramètres, Contact. Indique l’écran, le geste et le modèle Android."),
        "it" to listOf(
            "TifloAcosta è progettata per l’uso con TalkBack. Pulsanti e controlli regolabili devono annunciare funzione e valore selezionato.",
            "In TifloLector ogni titolo della biblioteca è un unico elemento. Filtri, cartelle, segnalibri e azioni di lettura hanno controlli separati.",
            "Puoi attivare Testo più grande e scegliere l’aspetto chiaro, scuro o di sistema nelle Impostazioni. Le opzioni visive di lettura sono in TifloLector.",
            "In un documento puoi riprodurre o mettere in pausa, modificare l’unità di navigazione, avanzare, tornare indietro e consultare i segnalibri. Alcune azioni dipendono dal formato.",
            "Cambiare la lingua dell’interfaccia non traduce automaticamente libri o notizie. I contenuti sono tradotti soltanto su richiesta.",
            "Se TalkBack non annuncia correttamente un controllo, segnalalo da Impostazioni, Contatti. Indica la schermata, il gesto e il modello Android."),
        "de" to listOf(
            "TifloAcosta ist für die Nutzung mit TalkBack ausgelegt. Schaltflächen und einstellbare Elemente sollen Funktion und ausgewählten Wert ansagen.",
            "In TifloLector wird jeder Bibliothekstitel als ein Element dargestellt. Filter, Ordner, Lesezeichen und Leseaktionen haben eigene Bedienelemente.",
            "In den Einstellungen kannst du Größeren Text aktivieren und zwischen hellem, dunklem und Systemdesign wählen. Anzeigeoptionen zum Lesen findest du in TifloLector.",
            "In einem Dokument kannst du die Wiedergabe starten oder pausieren, die Navigationseinheit ändern, vor- und zurückspringen und Lesezeichen aufrufen. Manche Aktionen hängen vom Format ab.",
            "Ein Wechsel der Oberflächensprache übersetzt Bücher oder Nachrichten nicht automatisch. Inhalte werden nur auf deinen Wunsch übersetzt.",
            "Falls TalkBack ein Bedienelement falsch ansagt, melde es unter Einstellungen, Kontakt. Nenne die Seite, Geste und das Android-Gerätemodell.")
    )
    fun get(language: String, key: String): String {
        val i = keys.indexOf(key)
        if (i < 0) return key
        return (catalog[language] ?: catalog.getValue("es"))[i]
    }
}
