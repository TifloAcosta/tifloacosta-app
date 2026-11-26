import XCTest

/// Audit-only UI target. The OS is Spanish, while the app selects one of its
/// six supported languages. Stable root identifiers are invisible to users.
final class LocalizationNavigationTests: XCTestCase {
    private let roots = ["Actualidad","Recursos","TifloLector","Mi Música","Multicines Accesibles","Novedades","Descargar desde un enlace","Favoritos","Vídeos","Podcast","Configuración"]
    private let translations: [String: [String: String]] = [
        "es": [
            "Actualidad": "Actualidad",
            "Recursos": "Recursos",
            "TifloLector": "TifloLector",
            "Mi Música": "Mi Música",
            "Multicines Accesibles": "Multicines Accesibles",
            "Novedades": "Novedades",
            "Descargar desde un enlace": "Descargar desde un enlace",
            "Favoritos": "Favoritos",
            "Vídeos": "Vídeos",
            "Podcast": "Podcast",
            "Configuración": "Configuración",
            "Inicio": "Inicio",
            "Importar": "Importar",
            "Desde Archivos": "Desde Archivos",
            "Carpeta completa desde Archivos": "Carpeta completa desde Archivos",
            "Bibliotecas en línea": "Bibliotecas en línea",
            "Proyecto Gutenberg": "Proyecto Gutenberg",
            "Ajustes": "Ajustes",
            "Plataformas musicales": "Plataformas musicales",
            "Organizar mi música": "Organizar mi música",
            "Buscar obras": "Buscar obras",
            "Plataformas": "Plataformas",
            "Mi colección personal": "Mi colección personal",
            "Dónde ver una película": "Dónde ver una película",
            "Español": "Español",
            "Inglés": "Inglés",
            "Francés": "Francés",
            "Portugués": "Portugués",
            "Italiano": "Italiano",
            "Alemán": "Alemán",
            "Universo Audesc": "Universo Audesc",
            "España": "España",
            "Latinoamérica": "Latinoamérica",
            "Audiocinemateca": "Audiocinemateca",
            "Entrar en Audiocinemateca": "Entrar en Audiocinemateca",
            "Crear cuenta gratuita": "Crear cuenta gratuita",
            "Información y agradecimientos": "Información y agradecimientos",
            "Buscar en YouTube": "Buscar en YouTube",
            "Vídeos del canal TifloAcosta": "Vídeos del canal TifloAcosta",
            "Consultar y configurar atajos": "Consultar y configurar atajos",
            "Revisar elementos pendientes": "Revisar elementos pendientes",
            "Abrir contacto y redes": "Abrir contacto y redes",
            "Consultar privacidad y accesibilidad": "Consultar privacidad y accesibilidad",
            "Comunicar incidencia de accesibilidad": "Comunicar incidencia de accesibilidad"
        ],
        "en": [
            "Actualidad": "News",
            "Recursos": "Resources",
            "TifloLector": "TifloReader",
            "Mi Música": "My Music",
            "Multicines Accesibles": "Accessible Cinemas",
            "Novedades": "What's New",
            "Descargar desde un enlace": "Download from a link",
            "Favoritos": "Favorites",
            "Vídeos": "Videos",
            "Podcast": "Podcasts",
            "Configuración": "Settings",
            "Inicio": "Home",
            "Importar": "Import",
            "Desde Archivos": "From Files",
            "Carpeta completa desde Archivos": "Entire folder from Files",
            "Bibliotecas en línea": "Online libraries",
            "Proyecto Gutenberg": "Project Gutenberg",
            "Ajustes": "Settings",
            "Plataformas musicales": "Music platforms",
            "Organizar mi música": "Organize my music",
            "Buscar obras": "Search titles",
            "Plataformas": "Platforms",
            "Mi colección personal": "My personal collection",
            "Dónde ver una película": "Where to watch a film",
            "Español": "Spanish",
            "Inglés": "English",
            "Francés": "French",
            "Portugués": "Portuguese",
            "Italiano": "Italian",
            "Alemán": "German",
            "Universo Audesc": "Universo Audesc",
            "España": "Spain",
            "Latinoamérica": "Latin America",
            "Audiocinemateca": "Audiocinemateca",
            "Entrar en Audiocinemateca": "Enter Audiocinemateca",
            "Crear cuenta gratuita": "Create a free account",
            "Información y agradecimientos": "Information and acknowledgements",
            "Buscar en YouTube": "Search YouTube",
            "Vídeos del canal TifloAcosta": "TifloAcosta channel videos",
            "Consultar y configurar atajos": "View and configure shortcuts",
            "Revisar elementos pendientes": "Review pending items",
            "Abrir contacto y redes": "Open contact and social networks",
            "Consultar privacidad y accesibilidad": "View privacy and accessibility",
            "Comunicar incidencia de accesibilidad": "Report an accessibility issue"
        ],
        "pt": [
            "Actualidad": "Atualidade",
            "Recursos": "Recursos",
            "TifloLector": "TifloLector",
            "Mi Música": "A minha música",
            "Multicines Accesibles": "Cinemas Acessíveis",
            "Novedades": "Novidades",
            "Descargar desde un enlace": "Transferir a partir de uma ligação",
            "Favoritos": "Favoritos",
            "Vídeos": "Vídeos",
            "Podcast": "Podcast",
            "Configuración": "Definições",
            "Inicio": "Início",
            "Importar": "Importar",
            "Desde Archivos": "A partir de Ficheiros",
            "Carpeta completa desde Archivos": "Pasta completa de Ficheiros",
            "Bibliotecas en línea": "Bibliotecas online",
            "Proyecto Gutenberg": "Projeto Gutenberg",
            "Ajustes": "Definições",
            "Plataformas musicales": "Plataformas musicais",
            "Organizar mi música": "Organizar a minha música",
            "Buscar obras": "Pesquisar obras",
            "Plataformas": "Plataformas",
            "Mi colección personal": "A minha coleção pessoal",
            "Dónde ver una película": "Onde ver um filme",
            "Español": "Espanhol",
            "Inglés": "Inglês",
            "Francés": "Francês",
            "Portugués": "Português",
            "Italiano": "Italiano",
            "Alemán": "Alemão",
            "Universo Audesc": "Universo Audesc",
            "España": "Espanha",
            "Latinoamérica": "América Latina",
            "Audiocinemateca": "Audiocinemateca",
            "Entrar en Audiocinemateca": "Entrar na Audiocinemateca",
            "Crear cuenta gratuita": "Criar conta gratuita",
            "Información y agradecimientos": "Informações e agradecimentos",
            "Buscar en YouTube": "Pesquisar no YouTube",
            "Vídeos del canal TifloAcosta": "Vídeos do canal TifloAcosta",
            "Consultar y configurar atajos": "Consultar e configurar atalhos",
            "Revisar elementos pendientes": "Consultar elementos pendentes",
            "Abrir contacto y redes": "Abrir contactos e redes sociais",
            "Consultar privacidad y accesibilidad": "Consultar privacidade e acessibilidade",
            "Comunicar incidencia de accesibilidad": "Comunicar um problema de acessibilidade"
        ],
        "fr": [
            "Actualidad": "Actualités",
            "Recursos": "Ressources",
            "TifloLector": "TifloLector",
            "Mi Música": "Ma musique",
            "Multicines Accesibles": "Cinémas accessibles",
            "Novedades": "Nouveautés",
            "Descargar desde un enlace": "Télécharger depuis un lien",
            "Favoritos": "Favoris",
            "Vídeos": "Vidéos",
            "Podcast": "Podcast",
            "Configuración": "Paramètres",
            "Inicio": "Accueil",
            "Importar": "Importer",
            "Desde Archivos": "Depuis Fichiers",
            "Carpeta completa desde Archivos": "Dossier complet depuis Fichiers",
            "Bibliotecas en línea": "Bibliothèques en ligne",
            "Proyecto Gutenberg": "Projet Gutenberg",
            "Ajustes": "Réglages",
            "Plataformas musicales": "Plateformes musicales",
            "Organizar mi música": "Organiser ma musique",
            "Buscar obras": "Rechercher des œuvres",
            "Plataformas": "Plateformes",
            "Mi colección personal": "Ma collection personnelle",
            "Dónde ver una película": "Où regarder un film",
            "Español": "Espagnol",
            "Inglés": "Anglais",
            "Francés": "Français",
            "Portugués": "Portugais",
            "Italiano": "Italien",
            "Alemán": "Allemand",
            "Universo Audesc": "Universo Audesc",
            "España": "Espagne",
            "Latinoamérica": "Amérique latine",
            "Audiocinemateca": "Audiocinemateca",
            "Entrar en Audiocinemateca": "Accéder à Audiocinemateca",
            "Crear cuenta gratuita": "Créer un compte gratuit",
            "Información y agradecimientos": "Informations et remerciements",
            "Buscar en YouTube": "Rechercher sur YouTube",
            "Vídeos del canal TifloAcosta": "Vidéos de la chaîne TifloAcosta",
            "Consultar y configurar atajos": "Consulter et configurer les raccourcis",
            "Revisar elementos pendientes": "Consulter les éléments en attente",
            "Abrir contacto y redes": "Ouvrir les contacts et réseaux sociaux",
            "Consultar privacidad y accesibilidad": "Consulter la confidentialité et l’accessibilité",
            "Comunicar incidencia de accesibilidad": "Signaler un problème d’accessibilité"
        ],
        "it": [
            "Actualidad": "Attualità",
            "Recursos": "Risorse",
            "TifloLector": "TifloLector",
            "Mi Música": "La mia musica",
            "Multicines Accesibles": "Cinema accessibili",
            "Novedades": "Novità",
            "Descargar desde un enlace": "Scarica da un link",
            "Favoritos": "Preferiti",
            "Vídeos": "Video",
            "Podcast": "Podcast",
            "Configuración": "Impostazioni",
            "Inicio": "Home",
            "Importar": "Importa",
            "Desde Archivos": "Da File",
            "Carpeta completa desde Archivos": "Intera cartella da File",
            "Bibliotecas en línea": "Biblioteche online",
            "Proyecto Gutenberg": "Progetto Gutenberg",
            "Ajustes": "Impostazioni",
            "Plataformas musicales": "Piattaforme musicali",
            "Organizar mi música": "Organizza la mia musica",
            "Buscar obras": "Cerca opere",
            "Plataformas": "Piattaforme",
            "Mi colección personal": "La mia raccolta personale",
            "Dónde ver una película": "Dove vedere un film",
            "Español": "Spagnolo",
            "Inglés": "Inglese",
            "Francés": "Francese",
            "Portugués": "Portoghese",
            "Italiano": "Italiano",
            "Alemán": "Tedesco",
            "Universo Audesc": "Universo Audesc",
            "España": "Spagna",
            "Latinoamérica": "America Latina",
            "Audiocinemateca": "Audiocinemateca",
            "Entrar en Audiocinemateca": "Accedi ad Audiocinemateca",
            "Crear cuenta gratuita": "Crea un account gratuito",
            "Información y agradecimientos": "Informazioni e ringraziamenti",
            "Buscar en YouTube": "Cerca su YouTube",
            "Vídeos del canal TifloAcosta": "Video del canale TifloAcosta",
            "Consultar y configurar atajos": "Visualizza e configura i comandi rapidi",
            "Revisar elementos pendientes": "Controlla gli elementi in sospeso",
            "Abrir contacto y redes": "Apri contatti e social network",
            "Consultar privacidad y accesibilidad": "Consulta privacy e accessibilità",
            "Comunicar incidencia de accesibilidad": "Segnala un problema di accessibilità"
        ],
        "de": [
            "Actualidad": "Aktuelles",
            "Recursos": "Ressourcen",
            "TifloLector": "TifloLector",
            "Mi Música": "Meine Musik",
            "Multicines Accesibles": "Barrierefreie Kinos",
            "Novedades": "Neuigkeiten",
            "Descargar desde un enlace": "Über einen Link herunterladen",
            "Favoritos": "Favoriten",
            "Vídeos": "Videos",
            "Podcast": "Podcast",
            "Configuración": "Einstellungen",
            "Inicio": "Startseite",
            "Importar": "Importieren",
            "Desde Archivos": "Aus Dateien",
            "Carpeta completa desde Archivos": "Gesamten Ordner aus Dateien",
            "Bibliotecas en línea": "Online-Bibliotheken",
            "Proyecto Gutenberg": "Projekt Gutenberg",
            "Ajustes": "Einstellungen",
            "Plataformas musicales": "Musikplattformen",
            "Organizar mi música": "Meine Musik organisieren",
            "Buscar obras": "Titel suchen",
            "Plataformas": "Plattformen",
            "Mi colección personal": "Meine persönliche Sammlung",
            "Dónde ver una película": "Wo kann ich einen Film sehen?",
            "Español": "Spanisch",
            "Inglés": "Englisch",
            "Francés": "Französisch",
            "Portugués": "Portugiesisch",
            "Italiano": "Italienisch",
            "Alemán": "Deutsch",
            "Universo Audesc": "Universo Audesc",
            "España": "Spanien",
            "Latinoamérica": "Lateinamerika",
            "Audiocinemateca": "Audiocinemateca",
            "Entrar en Audiocinemateca": "Audiocinemateca öffnen",
            "Crear cuenta gratuita": "Kostenloses Konto erstellen",
            "Información y agradecimientos": "Informationen und Danksagung",
            "Buscar en YouTube": "Auf YouTube suchen",
            "Vídeos del canal TifloAcosta": "Videos des TifloAcosta-Kanals",
            "Consultar y configurar atajos": "Kurzbefehle anzeigen und einrichten",
            "Revisar elementos pendientes": "Ausstehende Elemente prüfen",
            "Abrir contacto y redes": "Kontakte und soziale Netzwerke öffnen",
            "Consultar privacidad y accesibilidad": "Datenschutz und Barrierefreiheit anzeigen",
            "Comunicar incidencia de accesibilidad": "Barrierefreiheitsproblem melden"
        ]
    ]

    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    private func expected(_ key: String, _ language: String) -> String {
        guard let value = translations[language]?[key] else {
            XCTFail("Missing independently recorded expectation: \(language) / \(key)")
            return key
        }
        return value
    }

    private func launch(_ app: XCUIApplication, index: Int) {
        if app.state != .notRunning { app.terminate() }
        app.launchArguments = ["-AppleLanguages", "(es)", "-AppleLocale", "es_ES", "-native-ios-language", String(index)]
        app.launch()
    }

    private func reveal(_ app: XCUIApplication, _ element: XCUIElement) -> Bool {
        if element.exists && element.isHittable { return true }
        for _ in 0..<12 {
            app.swipeUp()
            if element.exists && element.isHittable { return true }
        }
        for _ in 0..<12 {
            app.swipeDown()
            if element.exists && element.isHittable { return true }
        }
        return false
    }

    @discardableResult
    private func find(_ app: XCUIApplication, key: String, language: String) -> XCUIElement {
        let label = expected(key, language)
        let predicate = NSPredicate(format: "label == %@", label)
        let button = app.buttons.matching(predicate).firstMatch
        if button.exists && button.isHittable { return button }
        let element = app.descendants(matching: .any).matching(predicate).firstMatch
        XCTAssertTrue(reveal(app, element), "Missing or inaccessible: \(language) / \(key) / \(label)")
        return element
    }

    private func openRoot(_ app: XCUIApplication, key: String, language: String) {
        let element = app.descendants(matching: .any).matching(identifier: "tiflo.home." + key).firstMatch
        XCTAssertTrue(reveal(app, element), "Root missing: \(language) / \(key)")
        XCTAssertEqual(element.label, expected(key, language), "Wrong accessible root label")
        element.tap()
    }

    private func audit(_ language: String, index: Int) {
        let app = XCUIApplication()
        launch(app, index: index)
        for key in roots {
            let item = app.descendants(matching: .any).matching(identifier: "tiflo.home." + key).firstMatch
            XCTAssertTrue(reveal(app, item), "Root missing: \(language) / \(key)")
            XCTAssertEqual(item.label, expected(key, language), "Wrong accessible label for \(key)")
        }
        launch(app, index: index)
        openRoot(app, key: "TifloLector", language: language)
        find(app, key: "Importar", language: language).tap()
        find(app, key: "Desde Archivos", language: language)
        find(app, key: "Carpeta completa desde Archivos", language: language)
        find(app, key: "Bibliotecas en línea", language: language).tap()
        find(app, key: "Proyecto Gutenberg", language: language)
        // Do not open the provider; this test does not send Gutenberg requests.

        launch(app, index: index)
        openRoot(app, key: "Mi Música", language: language)
        find(app, key: "Organizar mi música", language: language)
        find(app, key: "Plataformas musicales", language: language)
        find(app, key: "Ajustes", language: language)

        launch(app, index: index)
        openRoot(app, key: "Multicines Accesibles", language: language)
        for key in ["Buscar obras", "Mi colección personal", "Dónde ver una película"] {
            find(app, key: key, language: language)
        }
        find(app, key: "Plataformas", language: language).tap()
        for key in ["Español", "Inglés", "Francés", "Portugués", "Italiano", "Alemán"] {
            find(app, key: key, language: language)
        }
        find(app, key: "Español", language: language).tap()
        find(app, key: "Universo Audesc", language: language).tap()
        find(app, key: "España", language: language)
        find(app, key: "Latinoamérica", language: language)
        find(app, key: "Información y agradecimientos", language: language)

        launch(app, index: index)
        openRoot(app, key: "Vídeos", language: language)
        find(app, key: "Buscar en YouTube", language: language)
        find(app, key: "Vídeos del canal TifloAcosta", language: language)

        launch(app, index: index)
        openRoot(app, key: "Configuración", language: language)
        for key in ["Consultar y configurar atajos", "Revisar elementos pendientes", "Abrir contacto y redes", "Consultar privacidad y accesibilidad", "Comunicar incidencia de accesibilidad"] {
            find(app, key: key, language: language)
        }
        print("LOCALIZATION_UI_NAVIGATION_PASS \(language)")
    }

    func testSpanish() { audit("es", index: 0) }
    func testEnglish() { audit("en", index: 1) }
    func testPortuguese() { audit("pt", index: 2) }
    func testFrench() { audit("fr", index: 3) }
    func testItalian() { audit("it", index: 4) }
    func testGerman() { audit("de", index: 5) }
}
