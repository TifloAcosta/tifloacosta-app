import SwiftUI
import UniformTypeIdentifiers
import Combine

/// Multicines Accesibles: native entry point and verified-source directory.
/// Only the original provider can deliver third-party works unless distribution
/// and streaming permissions have been explicitly documented.
enum AccessibleCinemaLanguage: String, CaseIterable, Codable {
    case all = "Todos los idiomas"
    case spain = "Español de España"
    case latino = "Español de Latinoamérica"
    case english = "Inglés"
    case french = "Francés"
    case portuguese = "Portugués"
    case italian = "Italiano"
    case german = "Alemán"
}

enum AccessibleCinemaKind: String, CaseIterable, Codable {
    case all = "Todos los contenidos"
    case film = "Películas"
    case series = "Series"
    case documentary = "Documentales"
    case short = "Cortometrajes"
}

private struct AccessibleCinemaSource: Identifiable {
    let id: String
    let name: String
    let languages: Set<AccessibleCinemaLanguage>
    let kinds: Set<AccessibleCinemaKind>
    let address: URL?
    let access: String
    let description: String
    let geographicNotice: String
    let isAudioOnly: Bool

    var detail: String {
        let format = isAudioOnly ? "Solo audio con audiodescripción." : "Vídeo con audiodescripción según el título."
        let parts = [description, format, access, geographicNotice].filter { !$0.isEmpty }
        return parts.joined(separator: " ")
    }
}

/// The list contains original platform URLs only. An external link is never
/// represented as if a particular film had been checked or could play inline.
/// Audesc source IDs are reserved for a permission-verified catalogue feed:
/// never publish a personally shared Drive link in a public source repository.
private enum AccessibleCinemaDirectory {
    static let sources: [AccessibleCinemaSource] = [
        .init(id: "audesc-es", name: "Audesc España",
              languages: [.spain], kinds: [.film, .series, .documentary, .short],
              address: nil, access: "Enlace oficial pendiente de incorporación segura.",
              description: "Biblioteca de películas, series, documentales y cortometrajes audiodescritos.",
              geographicNotice: "", isAudioOnly: true),
        .init(id: "audesc-latino", name: "Audesc Latino",
              languages: [.latino], kinds: [.film, .series, .documentary],
              address: nil, access: "Enlace oficial pendiente de incorporación segura.",
              description: "Biblioteca con audiodescripción y voces del ámbito latinoamericano.",
              geographicNotice: "", isAudioOnly: true),
        .init(id: "foal", name: "FOAL, ocio en audio",
              languages: [.latino, .spain], kinds: [.film, .series],
              address: URL(string: "https://www.foal.es/es/recursos/ocio-en-audio"),
              access: "Acceso gratuito desde la página oficial.",
              description: "La Fundación ONCE para América Latina enlaza películas y una serie completas en MP3.",
              geographicNotice: "", isAudioOnly: true),
        .init(id: "audiocinemateca", name: "Audiocinemateca",
              languages: [.spain, .latino], kinds: [.film, .series, .documentary, .short],
              address: URL(string: "https://audiocinemateca.com/"),
              access: "Registro gratuito en el servicio original.",
              description: "Películas, series, documentales y cortos audiodescritos.",
              geographicNotice: "", isAudioOnly: true),
        .init(id: "rtve", name: "RTVE Play",
              languages: [.spain], kinds: [.film, .series, .documentary],
              address: URL(string: "https://www.rtve.es/play/"),
              access: "Busca títulos con pista de audiodescripción en el reproductor oficial.",
              description: "Solo algunas obras ofrecen audiodescripción.",
              geographicNotice: "El catálogo puede variar por territorio.", isAudioOnly: false),
        .init(id: "nfb", name: "National Film Board of Canada",
              languages: [.english, .french], kinds: [.film, .documentary, .short],
              address: URL(string: "https://www.nfb.ca/"),
              access: "Selecciona las obras con vídeo descrito en el sitio oficial.",
              description: "Cine, animación y documentales, algunos con audiodescripción.",
              geographicNotice: "Algunas obras tienen restricciones regionales.", isAudioOnly: false),
        .init(id: "ami", name: "AMI-tv y AMI+",
              languages: [.english, .french], kinds: [.series, .documentary],
              address: URL(string: "https://www.ami.ca/tv"),
              access: "Consulta los títulos de acceso gratuito del servicio original.",
              description: "Programación accesible con audiodescripción integrada.",
              geographicNotice: "Disponibilidad variable fuera de Canadá.", isAudioOnly: false),
        .init(id: "ard", name: "ARD Mediathek",
              languages: [.german], kinds: [.film, .series, .documentary],
              address: URL(string: "https://www.ardmediathek.de/audiodeskription"),
              access: "Sección oficial de audiodescripción.",
              description: "Producciones en alemán con audiodescripción.",
              geographicNotice: "Acceso sujeto a derechos territoriales.", isAudioOnly: false),
        .init(id: "arte", name: "ARTE",
              languages: [.french, .german], kinds: [.film, .series, .documentary],
              address: URL(string: "https://www.arte.tv/"),
              access: "Verifica la pista de audiodescripción de cada obra.",
              description: "Oferta audiovisual en francés y alemán.",
              geographicNotice: "Derechos y disponibilidad dependientes del país.", isAudioOnly: false),
        .init(id: "pbs", name: "PBS",
              languages: [.english], kinds: [.series, .documentary],
              address: URL(string: "https://www.pbs.org/"),
              access: "Solo títulos gratuitos con pista English AD; otros exigen Passport.",
              description: "Programas y documentales seleccionados.",
              geographicNotice: "Disponibilidad por territorio y dispositivo.", isAudioOnly: false),
        .init(id: "itvx", name: "ITVX",
              languages: [.english], kinds: [.film, .series, .documentary],
              address: URL(string: "https://www.itv.com/"),
              access: "Servicio gratuito con anuncios; seleccionar obras con AD.",
              description: "Programas y series en inglés.",
              geographicNotice: "Principalmente Reino Unido.", isAudioOnly: false),
        .init(id: "channel4", name: "Channel 4",
              languages: [.english], kinds: [.film, .series, .documentary],
              address: URL(string: "https://www.channel4.com/"),
              access: "Servicio gratuito con anuncios; comprobar AD por título.",
              description: "Series y documentales en inglés.",
              geographicNotice: "Acceso sujeto a restricciones regionales.", isAudioOnly: false),
        .init(id: "five", name: "5",
              languages: [.english], kinds: [.film, .series, .documentary],
              address: URL(string: "https://www.5.tv/"),
              access: "Cuenta gratuita y audiodescripción solo en obras seleccionadas.",
              description: "Servicio británico de vídeo bajo demanda.",
              geographicNotice: "Principalmente Reino Unido.", isAudioOnly: false),
        .init(id: "abc", name: "ABC iview",
              languages: [.english], kinds: [.series, .documentary],
              address: URL(string: "https://iview.abc.net.au/"),
              access: "Buscar el filtro Audio Description en la plataforma original.",
              description: "Programas con descripción en inglés.",
              geographicNotice: "El acceso fuera de Australia puede estar limitado.", isAudioOnly: false),
        .init(id: "tubi", name: "Tubi",
              languages: [.english], kinds: [.film, .series],
              address: URL(string: "https://tubitv.com/category/audio_description"),
              access: "Colección específica de audiodescripción.",
              description: "Películas y programas gratuitos con anuncios.",
              geographicNotice: "No disponible en todos los países, incluida España.", isAudioOnly: false),
        .init(id: "pluto", name: "Pluto TV, Estados Unidos",
              languages: [.english], kinds: [.film, .series],
              address: URL(string: "https://pluto.tv/us/category/1a9072ea-901f-415c-aca0-c4ce3264389f/"),
              access: "Categoría oficial Audio Description Available.",
              description: "Contenidos audiovisuales con descripción en la oferta estadounidense.",
              geographicNotice: "La categoría no equivale a la oferta de otros países.", isAudioOnly: false)
    ]
}

/// Public collections explicitly described by their official publishers.
/// A collection is not an individual film and is never presented as one.
private struct AccessibleCinemaCollection: Identifiable {
    let id: String
    let title: String
    let publisher: String
    let language: AccessibleCinemaLanguage
    let kind: AccessibleCinemaKind
    let summary: String
    let originalAddress: URL
}

private enum AccessibleCinemaCollections {
    static let items: [AccessibleCinemaCollection] = [
        .init(id: "foal-films",
              title: "50 películas con audiodescripción",
              publisher: "Fundación ONCE para América Latina (FOAL)",
              language: .latino,
              kind: .film,
              summary: "Películas completas en formato MP3. La página oficial ofrece acceso a la carpeta de audio sin necesidad de descargar cada película.",
              originalAddress: URL(string: "https://www.foal.es/es/recursos/ocio-en-audio")!),
        .init(id: "foal-game-of-thrones",
              title: "Juego de Tronos, ocho temporadas",
              publisher: "Fundación ONCE para América Latina (FOAL)",
              language: .latino,
              kind: .series,
              summary: "Serie completa, solo audio con audiodescripción. Enlace al catálogo publicado oficialmente por FOAL.",
              originalAddress: URL(string: "https://www.foal.es/es/recursos/ocio-en-audio")!)
    ]
}

struct NativeAccessibleCinemaScreen: View {
    @State private var searchText = ""
    @State private var languageIndex = 0
    @State private var contentIndex = 0
    @State private var importLanguageIndex = 1
    @State private var importKindIndex = 1
    @State private var selectingPersonalFiles = false
    @State private var importStatus = ""
    @State private var pendingDeletion: NativeCinemaLocalItem?
    @State private var confirmDeletion = false
    @StateObject private var personalLibrary = NativeCinemaLocalLibrary()
    @StateObject private var personalPlayer = NativeCinemaAudioPlayer()

    private var selectedLanguage: AccessibleCinemaLanguage {
        AccessibleCinemaLanguage.allCases[min(max(0, languageIndex), AccessibleCinemaLanguage.allCases.count - 1)]
    }

    private var selectedKind: AccessibleCinemaKind {
        AccessibleCinemaKind.allCases[min(max(0, contentIndex), AccessibleCinemaKind.allCases.count - 1)]
    }

    private var filtered: [AccessibleCinemaSource] {
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        return AccessibleCinemaDirectory.sources.filter { source in
            let languageMatches = selectedLanguage == .all || source.languages.contains(selectedLanguage)
            let typeMatches = selectedKind == .all || source.kinds.contains(selectedKind)
            let queryMatches = query.isEmpty || [source.name, source.description, source.detail]
                .contains(where: { $0.localizedStandardContains(query) })
            return languageMatches && typeMatches && queryMatches
        }
    }

    private var featuredCollections: [AccessibleCinemaCollection] {
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        return AccessibleCinemaCollections.items.filter { item in
            (selectedLanguage == .all || item.language == selectedLanguage)
                && (selectedKind == .all || item.kind == selectedKind)
                && (query.isEmpty || [item.title, item.publisher, item.summary]
                    .contains(where: { $0.localizedStandardContains(query) }))
        }
    }

    private var personalItems: [NativeCinemaLocalItem] {
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        return personalLibrary.items.filter { item in
            (selectedLanguage == .all || selectedLanguage == item.language)
                && (selectedKind == .all || selectedKind == item.kind)
                && (query.isEmpty || item.title.localizedStandardContains(query))
        }
        .sorted { $0.title.localizedStandardCompare($1.title) == .orderedAscending }
    }

    private func clock(_ seconds: Double) -> String {
        let value = Int(max(0, min(seconds.isFinite ? seconds : 0, 86_400_000)))
        return String(format: "%02d:%02d:%02d", value / 3600,
                      (value % 3600) / 60, value % 60)
    }

    @MainActor private func importPersonalFiles(_ result: Result<[URL], Error>) {
        switch result {
        case .failure(let error):
            importStatus = error.localizedDescription
        case .success(let files):
            var imported = 0
            var problems: [String] = []
            let language = AccessibleCinemaLanguage.allCases[
                min(max(1, importLanguageIndex), AccessibleCinemaLanguage.allCases.count - 1)]
            let kind = AccessibleCinemaKind.allCases[
                min(max(1, importKindIndex), AccessibleCinemaKind.allCases.count - 1)]
            for file in files {
                do {
                    try personalLibrary.importAudio(from: file, language: language, kind: kind)
                    imported += 1
                } catch {
                    problems.append(file.lastPathComponent + ": " + error.localizedDescription)
                }
            }
            importStatus = MusicLocalized.format("Archivos importados: %d. Fallos: %d.", imported, problems.count)
            if let first = problems.first { importStatus += " " + first }
            UIAccessibility.post(notification: .announcement, argument: importStatus)
        }
    }

    var body: some View {
        List {
            Section("Explorar Multicines Accesibles") {
                TextField("Buscar plataformas y contenidos audiodescritos", text: $searchText)
                    .textInputAutocapitalization(.sentences)
                    .submitLabel(.search)
                    .accessibilityHint("Filtra por nombre o descripción de la fuente.")
                NativeAdjustableChoice(
                    title: "Idioma de audiodescripción",
                    choices: AccessibleCinemaLanguage.allCases.map(\.rawValue),
                    selectedIndex: $languageIndex
                )
                NativeAdjustableChoice(
                    title: "Tipo de contenido",
                    choices: AccessibleCinemaKind.allCases.map(\.rawValue),
                    selectedIndex: $contentIndex
                )
            }
            .listRowBackground(TifloVisual.surfaceRaised)

            Section("Mi colección personal") {
                Text("Añade tus propios archivos de audio o vídeo. Se conservarán en el iPhone para reproducirlos en TifloAcosta, con la última posición de escucha.")
                    .font(.footnote)
                NativeAdjustableChoice(
                    title: "Idioma de los archivos que vas a importar",
                    choices: Array(AccessibleCinemaLanguage.allCases.dropFirst()).map(\.rawValue),
                    selectedIndex: Binding(
                        get: { max(0, importLanguageIndex - 1) },
                        set: { importLanguageIndex = $0 + 1 }))
                NativeAdjustableChoice(
                    title: "Tipo de archivo que vas a importar",
                    choices: Array(AccessibleCinemaKind.allCases.dropFirst()).map(\.rawValue),
                    selectedIndex: Binding(
                        get: { max(0, importKindIndex - 1) },
                        set: { importKindIndex = $0 + 1 }))
                Button("Importar audio o vídeo desde Archivos") {
                    selectingPersonalFiles = true
                }
                .frame(minHeight: 44, alignment: .leading)
                if !importStatus.isEmpty {
                    Text(importStatus)
                        .font(.footnote)
                        .accessibilityAddTraits(.updatesFrequently)
                }
                if personalItems.isEmpty {
                    Text("No hay obras personales para estos filtros.")
                        .font(.footnote)
                        .foregroundStyle(TifloVisual.secondaryText)
                }
                ForEach(personalItems) { item in
                    VStack(alignment: .leading, spacing: 8) {
                        Text(item.title)
                            .font(.headline)
                            .accessibilityAddTraits(.isHeader)
                        Text(item.language.rawValue + ", " + item.kind.rawValue)
                            .font(.subheadline)
                        Button("Reproducir: \(item.title)") {
                            do { try personalPlayer.open(item, library: personalLibrary) }
                            catch { importStatus = error.localizedDescription }
                        }
                        .frame(minHeight: 44, alignment: .leading)
                        if personalPlayer.currentID == item.id {
                            Text("Posición: \(clock(personalPlayer.seconds)). Duración: \(clock(personalPlayer.duration)).")
                                .font(.subheadline)
                            Button(personalPlayer.playing ? "Pausar reproducción" : "Reanudar reproducción") {
                                personalPlayer.toggle(library: personalLibrary)
                            }
                            Button("Retroceder treinta segundos") {
                                personalPlayer.seek(by: -30, library: personalLibrary)
                            }
                            Button("Avanzar treinta segundos") {
                                personalPlayer.seek(by: 30, library: personalLibrary)
                            }
                            Button("Detener reproducción") {
                                personalPlayer.pauseAndSave(library: personalLibrary)
                            }
                        }
                        Button("Eliminar de mi colección: \(item.title)", role: .destructive) {
                            pendingDeletion = item
                            confirmDeletion = true
                        }
                    }
                    .accessibilityElement(children: .contain)
                }
            }
            .listRowBackground(TifloVisual.surfaceRaised)

            if !featuredCollections.isEmpty {
                Section("Colecciones de obras audiodescritas") {
                    ForEach(featuredCollections) { item in
                        VStack(alignment: .leading, spacing: 8) {
                            Text(item.title)
                                .font(.headline)
                                .accessibilityAddTraits(.isHeader)
                            Text(item.publisher)
                                .font(.subheadline.weight(.semibold))
                            Text(item.summary)
                                .font(.subheadline)
                                .foregroundStyle(TifloVisual.secondaryText)
                            Link("Explorar colección en la fuente original",
                                 destination: item.originalAddress)
                                .frame(minHeight: 44, alignment: .leading)
                        }
                        .accessibilityElement(children: .contain)
                    }
                }
                .listRowBackground(TifloVisual.surfaceRaised)
            }

            Section("Fuentes de audiodescripción") {
                if filtered.isEmpty {
                    ContentUnavailableView("No hay fuentes para estos filtros",
                                           systemImage: "film",
                                           description: Text("Prueba otro idioma o tipo de contenido."))
                }
                ForEach(filtered) { source in
                    VStack(alignment: .leading, spacing: 8) {
                        Text(source.name)
                            .font(.headline)
                            .accessibilityAddTraits(.isHeader)
                        Text(source.detail)
                            .font(.subheadline)
                            .foregroundStyle(TifloVisual.secondaryText)
                            .fixedSize(horizontal: false, vertical: true)
                        if let address = source.address {
                            Link("Abrir plataforma original: \(source.name)", destination: address)
                                .font(.body.weight(.semibold))
                                .frame(minHeight: 44, alignment: .leading)
                        } else {
                            Text("Fuente pendiente de conexión segura")
                                .font(.subheadline)
                                .foregroundStyle(TifloVisual.secondaryText)
                        }
                    }
                    .accessibilityElement(children: .contain)
                }
            }
            .listRowBackground(TifloVisual.surfaceRaised)

            Section("Sobre el acceso") {
                Text("Las plataformas muestran obras audiodescritas según su catálogo, país y permisos. Abrir la web oficial no significa que todas sus películas tengan audiodescripción.")
                    .font(.footnote)
                Text("Los títulos y el reproductor integrado de Audesc se incorporarán cuando se verifique el acceso público a los archivos y la autorización correspondiente.")
                    .font(.footnote)
            }
        }
        .tifloScreenSurface()
        .navigationTitle("Multicines Accesibles")
        .fileImporter(
            isPresented: $selectingPersonalFiles,
            allowedContentTypes: [.audio, .movie],
            allowsMultipleSelection: true
        ) { result in
            Task { @MainActor in importPersonalFiles(result) }
        }
        .confirmationDialog(
            "¿Eliminar esta obra de tu colección personal?",
            isPresented: $confirmDeletion, titleVisibility: .visible
        ) {
            Button("Eliminar archivo personal", role: .destructive) {
                guard let item = pendingDeletion else { return }
                if personalPlayer.currentID == item.id {
                    personalPlayer.pauseAndSave(library: personalLibrary)
                }
                do { try personalLibrary.remove(item) }
                catch { importStatus = error.localizedDescription }
                pendingDeletion = nil
            }
            Button("Cancelar", role: .cancel) { pendingDeletion = nil }
        }
        .onReceive(Timer.publish(every: 1, on: .main, in: .common).autoconnect()) { _ in
            personalPlayer.refresh(library: personalLibrary)
        }
        .onDisappear { personalPlayer.pauseAndSave(library: personalLibrary) }
    }
}
