import SwiftUI
import UIKit
import AVFoundation
import UniformTypeIdentifiers
import Combine

/// Renders local video with the same AVPlayer used by the accessible native
/// pause, seek and stop buttons. The visual layer exposes no duplicate VoiceOver
/// controls and it does not capture the user's accessibility focus.
final class NativeCinemaVideoUIView: UIView {
    override class var layerClass: AnyClass { AVPlayerLayer.self }
    var playerLayer: AVPlayerLayer { layer as! AVPlayerLayer }
}

struct NativeCinemaVideoSurface: UIViewRepresentable {
    let player: AVPlayer

    func makeUIView(context: Context) -> NativeCinemaVideoUIView {
        let view = NativeCinemaVideoUIView()
        view.playerLayer.videoGravity = .resizeAspect
        view.playerLayer.player = player
        view.isAccessibilityElement = false
        view.accessibilityElementsHidden = true
        return view
    }

    func updateUIView(_ uiView: NativeCinemaVideoUIView, context: Context) {
        if uiView.playerLayer.player !== player {
            uiView.playerLayer.player = player
        }
    }

    static func dismantleUIView(_ uiView: NativeCinemaVideoUIView, coordinator: ()) {
        uiView.playerLayer.player = nil
    }
}

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
        let effectiveAccess: String
        if id == "audesc-es" || id == "audesc-latino" {
            effectiveAccess = NativeCinemaPublicDrive.configuredKey != nil && NativeCinemaPublicDrive.publisherRoot(for: id) != nil
                ? "Catálogo público de Google Drive." : "Explorar carpeta de Google Drive"
        } else { effectiveAccess = access }
        let parts = [description, format, effectiveAccess, geographicNotice].filter { !$0.isEmpty }
        return parts.map { MusicLocalized.message($0) }.joined(separator: " ")
    }
}

/// The list contains original platform URLs only. An external link is never
/// represented as if a particular film had been checked or could play inline.
/// Audesc source IDs are reserved for a permission-verified catalogue feed:
/// never publish a personally shared Drive link in a public source repository.
private enum AccessibleCinemaDirectory {
    static let sources: [AccessibleCinemaSource] = [
        .init(id: "audesc-es", name: "Universo Audesc España",
              languages: [.spain], kinds: [.film, .series, .documentary, .short],
              address: nil, access: "Enlace oficial pendiente de incorporación segura.",
              description: "Biblioteca de películas, series, documentales y cortometrajes audiodescritos.",
              geographicNotice: "", isAudioOnly: true),
        .init(id: "audesc-latino", name: "Universo Audesc Latina",
              languages: [.latino], kinds: [.film, .series, .documentary],
              address: nil, access: "Enlace oficial pendiente de incorporación segura.",
              description: "Biblioteca con audiodescripción y voces del ámbito latinoamericano.",
              geographicNotice: "", isAudioOnly: true),
        .init(id: "audiocinemateca", name: "Audiocinemateca",
              languages: [.spain, .latino], kinds: [.film, .series, .documentary, .short],
              // The catalogue page is accessible after authentication on
              // Audiocinemateca. No protected API or private download URL is
              // accessed by TifloAcosta without the partner's agreed contract.
              address: URL(string: "https://audiocinemateca.com/catalogo"),
              access: "Registro gratuito e inicio de sesión en el servicio original.",
              description: "Películas, series, documentales y cortos audiodescritos.",
              geographicNotice: "", isAudioOnly: true),
        .init(id: "mercosur-pt", name: "Mercosur Audiovisual",
              languages: [.portuguese], kinds: [.short],
              address: URL(string: "https://play.mercosuraudiovisual.org/pt-br/recurso/ad-pt-pt-br/"),
              access: "Colección oficial de audiodescripción.",
              description: "", geographicNotice: "Acceso sujeto a derechos territoriales.", isAudioOnly: false),
        .init(id: "tape-territory", name: "Tape Territory",
              languages: [.english], kinds: [.film],
              address: URL(string: "https://tapeterritory.com/audio-described"),
              access: "Colección oficial de audiodescripción.",
              description: "", geographicNotice: "", isAudioOnly: false),
        .init(id: "movies-for-the-blind", name: "Movies for the Blind",
              languages: [.english], kinds: [.film],
              address: URL(string: "https://moviesfortheblind.com/"),
              access: "Colección oficial de audiodescripción.",
              description: "", geographicNotice: "", isAudioOnly: true),
        .init(id: "cinema-accessibile", name: "Cinema Accessibile",
              languages: [.italian], kinds: [.short],
              address: URL(string: "https://www.cinemaaccessibile.it/it/"),
              access: "Colección oficial de audiodescripción.",
              description: "", geographicNotice: "", isAudioOnly: false),
        .init(id: "rai-play-sound", name: "RaiPlay Sound",
              languages: [.italian], kinds: [.film, .series, .short],
              address: URL(string: "https://www.raiplaysound.it/generi/audiodescrizioni-film-fiction-programmi-c31adf5d-25c7-459a-9081-66a669298a39.html"),
              access: "Colección oficial de audiodescripción.",
              description: "", geographicNotice: "Acceso sujeto a derechos territoriales.", isAudioOnly: true),
        .init(id: "cineaudioteca", name: "Cineaudioteca Senza Barriere",
              languages: [.italian], kinds: [.film, .series, .documentary],
              address: URL(string: "https://www.cineaudioteca.it/catalogo_lista.php"),
              access: "Registro e inicio de sesión en el servicio original.",
              description: "", geographicNotice: "", isAudioOnly: true),
        .init(id: "tela-brasil", name: "Tela Brasil",
              languages: [.portuguese], kinds: [.film, .documentary, .short],
              address: URL(string: "https://telabrasil.cultura.gov.br/"),
              access: "Registro e inicio de sesión en el servicio original.",
              description: "", geographicNotice: "Acceso sujeto a derechos territoriales.", isAudioOnly: false),
        .init(id: "rtp-play", name: "RTP Play",
              languages: [.portuguese], kinds: [.film, .series, .documentary],
              address: URL(string: "https://acessibilidades.rtp.pt/audiodescricao/"),
              access: "Colección oficial de audiodescripción.",
              description: "", geographicNotice: "Acceso sujeto a derechos territoriales.", isAudioOnly: false),
        .init(id: "nfb", name: "National Film Board of Canada",
              languages: [.english], kinds: [.film, .documentary, .short],
              address: URL(string: "https://www.nfb.ca/explore-all-films/?accessibility=DV&language=en"),
              access: "Colección oficial de audiodescripción.",
              description: "", geographicNotice: "Acceso sujeto a derechos territoriales.", isAudioOnly: false),
        .init(id: "pbs", name: "PBS",
              languages: [.english], kinds: [.series, .documentary, .film],
              address: URL(string: "https://www.pbs.org/show/american-masters/collections/accessible-episodes/"),
              access: "Colección oficial de audiodescripción.",
              description: "", geographicNotice: "Acceso sujeto a derechos territoriales.", isAudioOnly: false),
        .init(id: "abc", name: "ABC iview",
              languages: [.english], kinds: [.film, .series, .documentary],
              address: URL(string: "https://iview.abc.net.au/shows/ad"),
              access: "Colección oficial de audiodescripción.",
              description: "", geographicNotice: "Acceso sujeto a derechos territoriales.", isAudioOnly: false),
        .init(id: "nhb", name: "Norddeutsche Hörbücherei",
              languages: [.german], kinds: [.film, .documentary],
              address: URL(string: "https://norddeutsche-hoerbuecherei.de/hoerfilme.html"),
              access: "Registro e inicio de sesión en el servicio original.",
              description: "", geographicNotice: "Acceso sujeto a derechos territoriales.", isAudioOnly: true),
        .init(id: "spcine", name: "Spcine Play",
              languages: [.portuguese], kinds: [.film, .series],
              address: URL(string: "https://www.spcineplay.com.br/"),
              access: "Registro e inicio de sesión en el servicio original.",
              description: "", geographicNotice: "Acceso sujeto a derechos territoriales.", isAudioOnly: false),
        .init(id: "tubi", name: "Tubi (EE. UU.)",
              languages: [.english], kinds: [.film, .series],
              address: URL(string: "https://tubitv.com/category/audio_description"),
              access: "Colección oficial de audiodescripción.",
              description: "", geographicNotice: "Acceso sujeto a derechos territoriales.", isAudioOnly: false),
        .init(id: "bbc-iplayer", name: "BBC iPlayer",
              languages: [.english], kinds: [.film, .series, .documentary],
              address: URL(string: "https://www.bbc.co.uk/iplayer/categories/audio-described/featured"),
              access: "Colección oficial de audiodescripción.",
              description: "", geographicNotice: "Acceso sujeto a derechos territoriales.", isAudioOnly: false),
        .init(id: "rtve-campeones", name: "RTVE Play: Campeones",
              languages: [.spain], kinds: [.film],
              address: URL(string: "https://www.rtve.es/play/videos/somos-cine/campeones/5751723/"),
              access: "Vídeo con audiodescripción según el título.",
              description: "", geographicNotice: "Acceso sujeto a derechos territoriales.", isAudioOnly: false),
        .init(id: "pluto", name: "Pluto TV (EE. UU.)",
              languages: [.english], kinds: [.film, .series],
              address: URL(string: "https://pluto.tv/us/category/1a9072ea-901f-415c-aca0-c4ce3264389f/"),
              access: "Colección oficial de audiodescripción.",
              description: "", geographicNotice: "Acceso sujeto a derechos territoriales.", isAudioOnly: false),
        .init(id: "plex-ad", name: "Plex",
              languages: [.english], kinds: [.film, .series],
              address: URL(string: "https://watch.plex.tv/on-demand/category/descriptive-audio"),
              access: "Colección oficial de audiodescripción.",
              description: "", geographicNotice: "Acceso sujeto a derechos territoriales.", isAudioOnly: false),
        .init(id: "play-suisse-de", name: "Play Suisse (DE)",
              languages: [.german], kinds: [.film, .series],
              address: URL(string: "https://www.playsuisse.ch/de/browse/genre/audio_description?audioDescriptionLanguageFilter=de"),
              access: "Colección oficial de audiodescripción.",
              description: "", geographicNotice: "Acceso sujeto a derechos territoriales.", isAudioOnly: false),
        // AMI is dedicated to described media rather than a general-purpose
        // television catalogue. Separate the English and French services so
        // language filters never send users to a mismatched homepage.
        .init(id: "ami", name: "AMI-tv y AMI+",
              languages: [.english], kinds: [.series, .documentary],
              address: URL(string: "https://www.ami.ca/tv"),
              access: "Servicio especializado en programas con descripción integrada.",
              description: "Programación accesible con audiodescripción integrada.",
              geographicNotice: "Disponibilidad variable fuera de Canadá.", isAudioOnly: false),
        .init(id: "ami-fr", name: "AMI-télé",
              languages: [.french], kinds: [.series, .documentary],
              address: URL(string: "https://www.amitele.ca/"),
              access: "Servicio especializado en programas con descripción integrada.",
              description: "Programación accesible en francés con descripción integrada.",
              geographicNotice: "Disponibilidad variable fuera de Canadá.", isAudioOnly: false),
        // ARD is generalist, but this official destination shows its
        // audio-described collection, never the undifferentiated homepage.
        .init(id: "ard", name: "ARD Mediathek, audiodescripción",
              languages: [.german], kinds: [.film, .series, .documentary],
              address: URL(string: "https://www.ardmediathek.de/audiodeskription"),
              access: "Colección oficial de audiodescripción.",
              description: "Producciones en alemán con audiodescripción.",
              geographicNotice: "Acceso sujeto a derechos territoriales.", isAudioOnly: false),
        // ARTE has different official audio-description collections per
        // language; each filter must open the appropriate language variant.
        .init(id: "arte", name: "ARTE (francés)",
              languages: [.french], kinds: [.film, .series, .documentary],
              address: URL(string: "https://www.arte.tv/fr/videos/programmes-en-audiodescription/"),
              access: "Colección oficial de audiodescripción.",
              description: "Programas en francés seleccionados por audiodescripción.",
              geographicNotice: "Derechos y disponibilidad dependientes del país.", isAudioOnly: false),
        .init(id: "arte-de", name: "ARTE (alemán)",
              languages: [.german], kinds: [.film, .series, .documentary],
              address: URL(string: "https://www.arte.tv/de/videos/programme-mit-audiodeskription/"),
              access: "Colección oficial de audiodescripción.",
              description: "Programas en alemán seleccionados por audiodescripción.",
              geographicNotice: "Derechos y disponibilidad dependientes del país.", isAudioOnly: false)
    ]
}

struct NativeAccessibleCinemaScreen: View {
    @State private var searchText = ""
    @State private var audiocinematecaResults: [NativeAudiocinematecaCatalogueIndex.Entry] = []
    @State private var cinemaSearchLimit = 50
    @State private var submittedSearch: UUID?
    @State private var remoteSearching = false
    @State private var remoteSearched = false
    @State private var tapeResults: [NativeTapeTerritoryCatalogue.Film] = []
    @State private var movieResults: [NativeMoviesForTheBlindWork] = []
    @State private var driveResults: [NativeCinemaDriveSearchHit] = []
    @State private var unavailableSources: [String] = []
    @State private var partialSources: [String] = []
    @AppStorage("native-cinema-language-index-v1") private var languageIndex = 0
    @AppStorage("native-cinema-content-index-v1") private var contentIndex = 0
    @AppStorage("native-cinema-import-language-index-v1") private var importLanguageIndex = 1
    @AppStorage("native-cinema-import-kind-index-v1") private var importKindIndex = 1
    @State private var selectingPersonalFiles = false
    @State private var importStatus = ""
    @State private var pendingDeletion: NativeCinemaLocalItem?
    @State private var confirmDeletion = false
    // Shared instances allow personal playback to continue after leaving Multicines.
    @StateObject private var personalLibrary = NativeCinemaLocalLibrary.shared
    @StateObject private var personalPlayer = NativeCinemaAudioPlayer.shared
    @StateObject private var cinemaRecents = NativeCinemaRecentStore.shared

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
            let queryMatches = query.isEmpty || [MusicLocalized.message(source.name), source.description, source.detail]
                .contains(where: { $0.localizedStandardContains(query) })
            return languageMatches && typeMatches && queryMatches
        }
    }

    private var spanishFilter: Bool {
        selectedLanguage == .all || selectedLanguage == .spain || selectedLanguage == .latino
    }
    private var englishFilmsFilter: Bool {
        (selectedLanguage == .all || selectedLanguage == .english) &&
        (selectedKind == .all || selectedKind == .film)
    }
    private func resetRemoteSearch() {
        submittedSearch = nil
        remoteSearching = false
        remoteSearched = false
        tapeResults = []
        movieResults = []
        driveResults = []
        unavailableSources = []
        partialSources = []
        cinemaSearchLimit = 50
    }
    @MainActor private func performRemoteSearch(_ request: UUID) async {
        let term = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !term.isEmpty else { return }
        remoteSearching = true
        defer { if submittedSearch == request { remoteSearching = false; remoteSearched = !Task.isCancelled } }
        if spanishFilter, let account = NativeAudiocinematecaCredentials.load() {
            audiocinematecaResults = []
            do {
                let entries = try await NativeAudiocinematecaCache.shared.refresh(account: account)
                guard !Task.isCancelled, submittedSearch == request else { return }
                if let current = NativeAudiocinematecaCredentials.load(),
                   current.username == account.username, current.password == account.password {
                    audiocinematecaResults = entries
                }
            } catch { if !Task.isCancelled, submittedSearch == request { unavailableSources.append("Audiocinemateca") } }
        }
        guard !Task.isCancelled, submittedSearch == request else { return }
        if englishFilmsFilter {
            do {
                let films = try await NativeTapeTerritoryCatalogue.fetchFilms()
                guard !Task.isCancelled, submittedSearch == request else { return }
                tapeResults = films.filter { $0.title.localizedStandardContains(term) || String($0.year).contains(term) }
            } catch { if !Task.isCancelled, submittedSearch == request { unavailableSources.append("Tape Territory") } }
            guard !Task.isCancelled, submittedSearch == request else { return }
            do {
                let works = try await NativeMoviesForTheBlindWork.fetchWorks()
                guard !Task.isCancelled, submittedSearch == request else { return }
                movieResults = works.filter { $0.title.localizedStandardContains(term) }
            } catch { if !Task.isCancelled, submittedSearch == request { unavailableSources.append("Movies for the Blind") } }
        }
        for (sourceID, language, name) in [
            ("audesc-es", AccessibleCinemaLanguage.spain, "Universo Audesc España"),
            ("audesc-latino", AccessibleCinemaLanguage.latino, "Universo Audesc Latina")
        ] where selectedLanguage == .all || selectedLanguage == language {
            guard !Task.isCancelled, submittedSearch == request else { return }
            do {
                let result = try await NativeCinemaPublicDrive().searchPublished(sourceID: sourceID, query: term, kind: selectedKind)
                guard !Task.isCancelled, submittedSearch == request else { return }
                driveResults.append(contentsOf: result.hits)
                if result.incomplete { partialSources.append(name) }
            } catch { if !Task.isCancelled, submittedSearch == request { unavailableSources.append(name) } }
        }
    }

    @ViewBuilder private var remoteResults: some View {
        Section("Resultados de catálogos") {
            ForEach(tapeResults.prefix(cinemaSearchLimit)) { film in
                NavigationLink {
                    NativeTapeTerritoryScreen(query: film.title, initialFilms: [film])
                } label: { Text(film.title + " — Tape Territory (" + String(film.year) + ")") }
            }
            ForEach(movieResults.prefix(cinemaSearchLimit)) { work in
                NavigationLink {
                    NativeMoviesForTheBlindScreen(query: work.title, initialWorks: [work])
                } label: { Text(work.title + " — Movies for the Blind") }
            }
            ForEach(driveResults.prefix(cinemaSearchLimit)) { hit in
                let name = hit.sourceID == "audesc-es" ? "Universo Audesc España" : "Universo Audesc Latina"
                NavigationLink {
                    NativeCinemaPublishedDriveBrowser(sourceID: hit.sourceID, sourceName: name, initialHit: hit)
                } label: { Text(hit.entry.name + " — " + name) }
            }
            if ([tapeResults.count, movieResults.count, driveResults.count].max() ?? 0) > cinemaSearchLimit {
                Button("Cargar más resultados") { cinemaSearchLimit += 50 }
            }
            if !unavailableSources.isEmpty {
                Text(MusicLocalized.message("Catálogos no disponibles: ") + unavailableSources.joined(separator: ", "))
            }
            if !partialSources.isEmpty {
                Text(MusicLocalized.message("Búsqueda parcial: ") + partialSources.joined(separator: ", "))
            }
            if remoteSearched && tapeResults.isEmpty && movieResults.isEmpty && driveResults.isEmpty && matchingAudiocinemateca.isEmpty {
                Text("No se encontraron obras en los catálogos consultados.")
            }
            Text("Los servicios externos se consultan en su plataforma original. La búsqueda de Google Drive es limitada y puede no abarcar todas las carpetas.")
                .font(.footnote)
        }
    }

    private var matchingAudiocinemateca: [NativeAudiocinematecaCatalogueIndex.Entry] {
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !query.isEmpty, NativeAudiocinematecaCredentials.load() != nil else { return [] }
        let categories: [AccessibleCinemaKind: String] = [
            .film: "peliculas", .series: "series", .documentary: "documentales", .short: "cortometrajes"
        ]
        return audiocinematecaResults.filter { item in
            (selectedKind == .all || item.category == categories[selectedKind]) &&
            (selectedLanguage == .all || (selectedLanguage == .spain && item.languageCode == "1") ||
             (selectedLanguage == .latino && item.languageCode == "2")) &&
            [item.title, item.year, item.genre, item.synopsis].contains { $0.localizedStandardContains(query) }
        }.sorted { $0.title.localizedStandardCompare($1.title) == .orderedAscending }
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

    @MainActor private func importCloudAudio(_ url: URL) throws {
        let language = AccessibleCinemaLanguage.allCases[
            min(max(1, importLanguageIndex), AccessibleCinemaLanguage.allCases.count - 1)]
        let kind = AccessibleCinemaKind.allCases[
            min(max(1, importKindIndex), AccessibleCinemaKind.allCases.count - 1)]
        let item = try personalLibrary.importAudio(from: url, language: language, kind: kind)
        importStatus = MusicLocalized.format("Archivo incorporado: %@", item.title)
    }

    var body: some View {
        List {
            if personalPlayer.currentCloudReference != nil || (personalPlayer.currentID != nil && !personalItems.contains { $0.id == personalPlayer.currentID }) {
                Section("Reproductor") {
                    Text(personalPlayer.currentTitle).accessibilityAddTraits(.isHeader)
                    if personalPlayer.currentCloudIsVideo, let video = personalPlayer.videoPlayer {
                        NativeCinemaVideoSurface(player: video).frame(height: 210).accessibilityHidden(true)
                    }
                    if let failure = personalPlayer.playbackError { Text(failure) }
                    NativeCinemaTransportControls(player: personalPlayer, library: personalLibrary)
                }
            }
            if !cinemaRecents.entries.isEmpty {
                Section("Continuar viendo o escuchando") {
                    ForEach(cinemaRecents.entries.filter { !$0.finished }.prefix(12)) { recent in
                        NavigationLink {
                            NativeCinemaResumeScreen(recent: recent)
                        } label: {
                            VStack(alignment: .leading) {
                                Text(recent.title)
                                Text(MusicLocalized.message(recent.providerName))
                                Text(MusicLocalized.format("Posición: %@. Duración: %@.", NativeCinemaTransportControls.clock(recent.seconds), NativeCinemaTransportControls.clock(recent.duration)))
                            }.accessibilityElement(children: .combine)
                        }
                    }
                    NavigationLink("Historial de Multicines") { NativeCinemaHistoryScreen() }
                }
            }
            Section("Explorar Multicines Accesibles") {
                TextField("Buscar plataformas y contenidos audiodescritos", text: $searchText)
                    .textInputAutocapitalization(.sentences)
                    .submitLabel(.search)
                    .onSubmit { resetRemoteSearch(); submittedSearch = UUID() }
                    .accessibilityHint("Busca títulos y fuentes.")
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
                if !searchText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    Button("Buscar obras") { resetRemoteSearch(); submittedSearch = UUID() }
                    if remoteSearching {
                        ProgressView("Consultando catálogos…")
                        Button("Cancelar") { resetRemoteSearch() }
                    }
                }
            }
            .listRowBackground(TifloVisual.surfaceRaised)

            if remoteSearched || remoteSearching { remoteResults }

            if spanishFilter && !searchText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                Section("Audiocinemateca") {
                    if NativeAudiocinematecaCredentials.load() != nil {
                        ForEach(matchingAudiocinemateca.prefix(cinemaSearchLimit)) { item in
                            NavigationLink {
                                NativeAudiocinematecaDetail(entry: item)
                            } label: {
                                Text(item.title)
                            }
                        }
                        if matchingAudiocinemateca.count > cinemaSearchLimit {
                            Button("Cargar más resultados") { cinemaSearchLimit += 50 }
                        }
                    }
                    NavigationLink("Explorar catálogo audiodescrito") {
                        NativeAudiocinematecaBrowser(query: searchText, kind: selectedKind, language: selectedLanguage)
                    }
                }
            }

            if selectedLanguage == .all || selectedLanguage == .english || selectedLanguage == .french || selectedLanguage == .german || selectedLanguage == .italian {
                Section("Dónde ver una película") {
                    if selectedLanguage == .all || selectedLanguage == .english {
                        Link("Audio Description Project", destination: URL(string: "https://adp.acb.org/adp-search")!)
                    }
                    if selectedLanguage == .all || selectedLanguage == .french {
                        Link("Portail de l’audiodescription", destination: URL(string: "https://audiodescription.culture.gouv.fr/")!)
                        Link("Películas gratuitas", destination: URL(string: "https://audiodescription.beta.gouv.fr/recherche?is_free=1")!)
                    }
                    if selectedLanguage == .all || selectedLanguage == .german {
                        Link("hörfilm.info", destination: URL(string: "https://hoerfilm.info/mediatheken.html")!)
                    }
                    if selectedLanguage == .all || selectedLanguage == .italian {
                        Link("CiecandoScherzando", destination: URL(string: "https://ciecandoscherzando.it/audiodescrizioni/")!)
                    }
                }
            }

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
                            if let playbackError = personalPlayer.playbackError {
                                Text(playbackError)
                                    .foregroundStyle(TifloVisual.secondaryText)
                                    .accessibilityAddTraits(.updatesFrequently)
                            }
                            if item.isVideoFile, let videoPlayer = personalPlayer.videoPlayer {
                                NativeCinemaVideoSurface(player: videoPlayer)
                                    .frame(maxWidth: .infinity)
                                    .frame(height: 210)
                                    .accessibilityHidden(true)
                            }
                            if personalPlayer.buffering { ProgressView("Cargando reproducción") }
                            Text("Posición: \(clock(personalPlayer.seconds)). Duración: \(clock(personalPlayer.duration)).")
                                .font(.subheadline)
                            Button(personalPlayer.playing ? "Pausar reproducción" : "Reanudar reproducción") {
                                personalPlayer.toggle(library: personalLibrary)
                            }
                            .disabled(personalPlayer.playbackError != nil)
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

            Section("Nubes") {
                Text("Selecciona tus propios archivos de audio desde una nube conectada. Se importarán a tu colección personal con el idioma y el tipo elegidos arriba.")
                    .font(.footnote)
                NavigationLink("Google Drive") {
                    NativeCloudGooglePickerScreen(
                        onImport: { _ in },
                        allowCellularDownloads: true,
                        onImportValidated: { url in try importCloudAudio(url) }
                    )
                }
                NavigationLink("Dropbox") {
                    NativeCloudFolderBrowserScreen(
                        provider: .dropbox,
                        onImport: { _ in },
                        allowCellularDownloads: true,
                        onImportValidated: { url in try importCloudAudio(url) }
                    )
                }
            }
            .listRowBackground(TifloVisual.surfaceRaised)

            Section("Fuentes de audiodescripción") {
                if filtered.isEmpty {
                    ContentUnavailableView("No hay fuentes para estos filtros",
                                           systemImage: "film",
                                           description: Text("Prueba otro idioma o tipo de contenido."))
                }
                ForEach(filtered) { source in
                    VStack(alignment: .leading, spacing: 8) {
                        Text(MusicLocalized.message(source.name))
                            .font(.headline)
                            .accessibilityAddTraits(.isHeader)
                        Text(source.detail)
                            .font(.subheadline)
                            .foregroundStyle(TifloVisual.secondaryText)
                            .fixedSize(horizontal: false, vertical: true)
                        if ["audesc-es", "audesc-latino"].contains(source.id) {
                            if NativeCinemaPublicDrive.configuredKey != nil && NativeCinemaPublicDrive.publisherRoot(for: source.id) != nil {
                                    NavigationLink("Explorar catálogo audiodescrito") {
                                        NativeCinemaPublishedDriveBrowser(
                                            sourceID: source.id,
                                            sourceName: MusicLocalized.message(source.name))
                                    }
                            }
                            NavigationLink("Explorar carpeta de Google Drive") {
                                NativeCinemaDriveBrowser(
                                    sourceID: source.id,
                                    sourceName: MusicLocalized.message(source.name))
                            }
                            .frame(minHeight: 44, alignment: .leading)
                            if let originalFolder = NativeCinemaPublicDrive.originalFolderURL(
                                for: source.id) {
                                Link("Abrir carpeta original en Google Drive",
                                     destination: originalFolder)
                                    .frame(minHeight: 44, alignment: .leading)
                            }
                        }
                        if source.id == "cineaudioteca" {
                            Link("Escuchar en línea", destination: URL(string: "https://www.cineaudioteca.it/login_catalogo.php")!)
                                .frame(minHeight: 44, alignment: .leading)
                            Link("Cómo inscribirse", destination: URL(string: "https://www.cineaudioteca.it/come_iscriversi.php")!)
                                .frame(minHeight: 44, alignment: .leading)
                        }
                        if source.id == "rtp-play" {
                            Link("RTP Play", destination: URL(string: "https://www.rtp.pt/play/")!)
                                .frame(minHeight: 44, alignment: .leading)
                        }
                        if source.id == "rai-play-sound" {
                            NavigationLink("Explorar catálogo audiodescrito") {
                                NativeRaiPlaySoundScreen(kind: selectedKind)
                            }
                        }
                        if source.id == "tape-territory" {
                            NavigationLink("Explorar catálogo audiodescrito") {
                                NativeTapeTerritoryScreen()
                            }
                        }
                        if source.id == "movies-for-the-blind" {
                            NavigationLink("Explorar catálogo audiodescrito") {
                                NativeMoviesForTheBlindScreen()
                            }
                        }
                        if source.id == "audiocinemateca" {
                            NavigationLink("Explorar catálogo audiodescrito") {
                                NativeAudiocinematecaBrowser(query: searchText, kind: selectedKind, language: selectedLanguage)
                            }
                            .frame(minHeight: 44, alignment: .leading)
                        }
                        if let address = source.address {
                            Link("Abrir plataforma original: \(MusicLocalized.message(source.name))", destination: address)
                                .font(.body.weight(.semibold))
                                .frame(minHeight: 44, alignment: .leading)
                        } else if !["audesc-es", "audesc-latino"].contains(source.id) {
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
                Text("Los catálogos públicos se actualizan desde Google Drive cuando la conexión pública está configurada. También puedes elegir carpetas autorizadas con tu propia cuenta.")
                    .font(.footnote)
            }
        }
        .tifloScreenSurface()
        .navigationTitle("Multicines Accesibles")
        .onChange(of: searchText) { _, _ in resetRemoteSearch() }
        .onChange(of: languageIndex) { _, _ in resetRemoteSearch() }
        .onChange(of: contentIndex) { _, _ in resetRemoteSearch() }
        .task(id: submittedSearch) {
            if let request = submittedSearch { await performRemoteSearch(request) }
        }
        .onAppear {
            // A return from the account screen must not expose another account's cache.
            audiocinematecaResults = []
            if submittedSearch == nil {
                Task { @MainActor in
                    if let account = NativeAudiocinematecaCredentials.load(),
                       let entries = try? await NativeAudiocinematecaCache.shared.cachedEntries(account: account),
                       submittedSearch == nil,
                       let current = NativeAudiocinematecaCredentials.load(),
                       current.username == account.username, current.password == account.password {
                        audiocinematecaResults = entries
                    }
                }
            }
        }
        .fileImporter(
            isPresented: $selectingPersonalFiles,
            allowedContentTypes: [.audio, .movie],
            allowsMultipleSelection: true
        ) { result in
            Task { @MainActor in importPersonalFiles(result) }
        }
        .confirmationDialog(
            MusicLocalized.format("¿Eliminar «%@»?", pendingDeletion?.title ?? ""),
            isPresented: $confirmDeletion, titleVisibility: .visible
        ) {
            Button("Eliminar archivo personal", role: .destructive) {
                guard let item = pendingDeletion else { return }
                if personalPlayer.currentID == item.id {
                    personalPlayer.pauseAndSave(library: personalLibrary)
                }
                do { try personalLibrary.remove(item); cinemaRecents.remove(item.id.uuidString) }
                catch { importStatus = error.localizedDescription }
                pendingDeletion = nil
            }
            Button("Cancelar", role: .cancel) { pendingDeletion = nil }
        } message: {
            Text("Se eliminará el archivo guardado en esta colección personal.")
        }
        .onReceive(Timer.publish(every: 1, on: .main, in: .common).autoconnect()) { _ in
            personalPlayer.refresh(library: personalLibrary)
        }
        .onDisappear { personalPlayer.refresh(library: personalLibrary) }
    }
}
