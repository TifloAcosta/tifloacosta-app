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
enum AccessibleCinemaLanguage: String, CaseIterable, Codable, Sendable {
    case all = "Todos los idiomas"
    case spain = "Español de España"
    case latino = "Español de Latinoamérica"
    case english = "Inglés"
    case french = "Francés"
    case portuguese = "Portugués"
    case italian = "Italiano"
    case german = "Alemán"
}

enum AccessibleCinemaKind: String, CaseIterable, Codable, Sendable {
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
        .init(id: "audesc-latino", name: "Universo Audesc Latino",
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
    @StateObject private var personalLibrary = NativeCinemaLocalLibrary.shared
    @StateObject private var personalPlayer = NativeCinemaAudioPlayer.shared
    @StateObject private var cinemaRecents = NativeCinemaRecentStore.shared

    var body: some View {
        List {
            if personalPlayer.currentID != nil {
                Section("Reproductor") {
                    Text(personalPlayer.currentTitle).accessibilityAddTraits(.isHeader)
                    if personalPlayer.currentCloudIsVideo, let video = personalPlayer.videoPlayer {
                        NativeCinemaVideoSurface(player: video).frame(height: 210).accessibilityHidden(true)
                    }
                    if let failure = personalPlayer.playbackError { Text(failure) }
                    NativeCinemaTransportControls(player: personalPlayer, library: personalLibrary)
                }
            }
            if cinemaRecents.entries.contains(where: { !$0.finished }) {
                NavigationLink("Continuar viendo o escuchando") {
                    List {
                        ForEach(cinemaRecents.entries.filter { !$0.finished }) { recent in
                            NavigationLink {
                                NativeCinemaResumeScreen(recent: recent, autoResume: true)
                            } label: {
                                VStack(alignment: .leading) {
                                    Text(recent.title)
                                    Text(MusicLocalized.message(recent.providerName))
                                    Text(MusicLocalized.format("Posición: %@. Duración: %@.", NativeCinemaTransportControls.clock(recent.seconds), NativeCinemaTransportControls.clock(recent.duration)))
                                }.accessibilityElement(children: .combine)
                            }
                        }
                    }
                    .tifloScreenSurface()
                    .navigationTitle("Continuar viendo o escuchando")
                }
            }
            NavigationLink("Buscar obras") { NativeCinemaContentScreen(mode: .search) }
            if !cinemaRecents.favorites.isEmpty {
                NavigationLink("Favoritos") {
                    List {
                        ForEach(cinemaRecents.favorites) { favorite in
                            NavigationLink {
                                NativeCinemaResumeScreen(recent: favorite, autoResume: true)
                            } label: {
                                Text(favorite.title + ", " + MusicLocalized.message(favorite.providerName))
                            }
                            .accessibilityAction(named: Text("Quitar de favoritos")) {
                                cinemaRecents.removeFavorite(favorite.id)
                            }
                            .swipeActions { Button("Quitar de favoritos", role: .destructive) {
                                cinemaRecents.removeFavorite(favorite.id)
                            } }
                        }
                    }
                    .tifloScreenSurface()
                    .navigationTitle("Favoritos")
                }
            }
            NavigationLink("Plataformas") { NativeCinemaPlatformsScreen() }
            NavigationLink("Mi colección personal") { NativeCinemaContentScreen(mode: .collection) }
            if !cinemaRecents.entries.isEmpty {
                NavigationLink("Historial de Multicines") { NativeCinemaHistoryScreen() }
            }
            NavigationLink("Dónde ver una película") { NativeCinemaContentScreen(mode: .discovery) }
        }
        .tifloScreenSurface()
        .navigationTitle("Multicines Accesibles")
        .onAppear { personalPlayer.refresh(library: personalLibrary) }
    }
}

/// The French public-service portal documents this official ARTE AD feed.
/// Only title-level links to the original provider are exposed; no streams.
private struct NativeArteCatalogue {
    struct Work: Identifiable {
        let id: String
        let title: String
        let year: String
        let address: URL
        let kind: AccessibleCinemaKind?
    }
    struct Result {
        let works: [Work]
        let incomplete: Bool
    }
    private static let endpoint = URL(string: "https://www.arte.tv/static/opa_static/audiodescription/fr.json")!

    static func parse(_ data: Data, query: String, kind: AccessibleCinemaKind, now: Date = Date()) throws -> Result {
        guard data.count <= 12_000_000,
              let root = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              let programs = root["programs"] as? [[String: Any]] else {
            throw URLError(.cannotParseResponse)
        }
        let iso = ISO8601DateFormatter()
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        func date(_ value: Any?) -> Date? {
            guard let text = value as? String else { return nil }
            return iso.date(from: text) ?? fractional.date(from: text)
        }
        var works: [Work] = []
        var ids = Set<String>()
        var incomplete = false
        for program in programs {
            guard let title = program["title"] as? String, !title.isEmpty,
                  let id = program["programId"] as? String, !id.isEmpty,
                  let raw = program["url"] as? String, let url = URL(string: raw),
                  url.scheme == "https", url.host == "www.arte.tv",
                  url.path.hasPrefix("/fr/videos/"), url.user == nil, url.password == nil else {
                incomplete = true
                continue
            }
            let year = (program["productionYear"] as? String) ?? (program["productionYear"] as? Int).map(String.init) ?? ""
            guard NativeCinemaRules.matches(query, fields: [title, year]) else { continue }
            // Rights dates must be explicit, valid and current.
            guard let begins = date(program["videoRightsBegin"]),
                  let ends = date(program["videoRightsEnd"]), ends >= begins else {
                incomplete = true
                continue
            }
            guard begins <= now, now < ends else { continue }
            let genre = (program["genrePresse"] as? String ?? "").folding(options: [.caseInsensitive, .diacriticInsensitive], locale: Locale(identifier: "fr"))
            let actual: AccessibleCinemaKind?
            switch genre {
            case "film", "long metrage", "telefilm": actual = .film
            case "serie": actual = .series
            case "documentaire": actual = .documentary
            case "court metrage": actual = .short
            default: actual = nil
            }
            if kind != .all && actual == nil { incomplete = true }
            guard kind == .all || actual == nil || actual == kind,
                  ids.insert(id).inserted else { continue }
            works.append(Work(id: id, title: title, year: year, address: url, kind: actual))
        }
        return Result(works: works.sorted { $0.title.localizedStandardCompare($1.title) == .orderedAscending },
                      incomplete: incomplete)
    }

    static func search(query: String, kind: AccessibleCinemaKind) async throws -> Result {
        var request = URLRequest(url: endpoint)
        request.timeoutInterval = 20
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, http.statusCode == 200,
              http.url?.scheme == "https", http.url?.host == "www.arte.tv",
              http.url?.path == endpoint.path else { throw URLError(.badServerResponse) }
        try Task.checkCancellation()
        return try await Task.detached(priority: .utility) { try parse(data, query: query, kind: kind) }.value
    }
}

private enum NativeCinemaContentMode {
    case search, collection, discovery
    var title: String {
        switch self {
        case .search: return "Buscar obras"
        case .collection: return "Mi colección personal"
        case .discovery: return "Dónde ver una película"
        }
    }
}

@MainActor
private struct NativeCinemaContentScreen: View {
    let mode: NativeCinemaContentMode
    @State private var searchText = ""
    @State private var discoveryLanguageIndex = 0
    @AppStorage("native-cinema-collection-language-index-v1") private var collectionLanguageIndex = 0
    @AppStorage("native-cinema-collection-content-index-v1") private var collectionContentIndex = 0
    @State private var audiocinematecaResults: [NativeAudiocinematecaCatalogueIndex.Entry] = []
    @State private var audioAccountStamp: String?
    @State private var consultedCatalogues = 0
    @State private var cinemaSearchLimit = 50
    @State private var submittedSearch: UUID?
    @State private var remoteSearching = false
    @State private var remoteSearched = false
    @State private var selectedPlayback: NativeCinemaPlaybackRequest?
    @State private var refreshDriveIndex = false
    @State private var driveSearchProgress: String?
    @State private var tapeResults: [NativeTapeTerritoryCatalogue.Film] = []
    @State private var movieResults: [NativeMoviesForTheBlindWork] = []
    @State private var arteResults: [NativeArteCatalogue.Work] = []
    @State private var arteChecked = false
    @State private var driveResults: [NativeCinemaDriveSearchHit] = []
    @State private var unavailableSources: [String] = []
    @State private var partialSources: [String] = []
    @State private var staleSources: [String] = []
    @AppStorage("native-cinema-language-index-v1") private var languageIndex = 0
    @AppStorage("native-cinema-content-index-v1") private var contentIndex = 0
    @AppStorage("native-cinema-import-language-index-v1") private var importLanguageIndex = 1
    @AppStorage("native-cinema-import-kind-index-v1") private var importKindIndex = 1
    @State private var selectingPersonalFiles = false
    @State private var importStatus = ""
    // Shared instances allow personal playback to continue after leaving Multicines.
    @StateObject private var personalLibrary = NativeCinemaLocalLibrary.shared
    @StateObject private var personalPlayer = NativeCinemaAudioPlayer.shared
    @StateObject private var cinemaRecents = NativeCinemaRecentStore.shared

    private var selectedLanguage: AccessibleCinemaLanguage {
        let index = mode == .discovery ? discoveryLanguageIndex : (mode == .collection ? collectionLanguageIndex : languageIndex)
        return AccessibleCinemaLanguage.allCases[min(max(0, index), AccessibleCinemaLanguage.allCases.count - 1)]
    }

    private var selectedKind: AccessibleCinemaKind {
        let index = mode == .collection ? collectionContentIndex : contentIndex
        return AccessibleCinemaKind.allCases[min(max(0, index), AccessibleCinemaKind.allCases.count - 1)]
    }

    private var eligibleSources: [AccessibleCinemaSource] {
        AccessibleCinemaDirectory.sources.filter { source in
            (selectedLanguage == .all || source.languages.contains(selectedLanguage)) &&
                (selectedKind == .all || source.kinds.contains(selectedKind) ||
                    ["audesc-es", "audesc-latino"].contains(source.id))
        }
    }

    private var externalSearchSources: [AccessibleCinemaSource] {
        eligibleSources.filter {
            !["audesc-es", "audesc-latino", "audiocinemateca", "tape-territory", "movies-for-the-blind"].contains($0.id) &&
                !($0.id == "arte" && arteChecked)
        }
    }

    private func adpSearchURL(provider: String? = nil) -> URL {
        var components = URLComponents(string: "https://adp.acb.org/adp-search")!
        components.queryItems = [URLQueryItem(name: "title", value: searchText)]
        if let provider {
            components.queryItems?.append(URLQueryItem(name: "provider_filter[" + provider + "]", value: provider))
        }
        return components.url!
    }

    private var combinedExternalSearchURL: URL? {
        let term = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        let hosts = Set(externalSearchSources.compactMap { $0.address?.host }).sorted()
        guard !term.isEmpty, !hosts.isEmpty else { return nil }
        let sites = hosts.map { "site:" + $0 }.joined(separator: " OR ")
        let variants = "\"audio description\" OR audiodescripción OR audiodescription OR Audiodeskription OR audiodescrizione OR audiodescrição"
        var components = URLComponents(string: "https://www.google.com/search")
        components?.queryItems = [URLQueryItem(name: "q", value: term + " (" + sites + ") (" + variants + ")")]
        return components?.url
    }

    private func providerSearchURL(_ source: AccessibleCinemaSource) -> URL? {
        // This is explicitly an external web search, not an AD-confirmed result.
        guard let host = source.address?.host else { return nil }
        let term = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !term.isEmpty else { return nil }
        let language = source.languages.first ?? .all
        let qualifier: String
        switch language {
        case .spain, .latino: qualifier = "audiodescripción"
        case .french: qualifier = "audiodescription"
        case .german: qualifier = "Audiodeskription"
        case .italian: qualifier = "audiodescrizione"
        case .portuguese: qualifier = "audiodescrição"
        default: qualifier = "audio description"
        }
        var components = URLComponents(string: "https://www.google.com/search")
        components?.queryItems = [URLQueryItem(name: "q", value: "site:" + host + " " + term + " " + qualifier)]
        return components?.url
    }

    private func frenchDiscoveryURL(freeOnly: Bool) -> URL {
        var components = URLComponents(string: "https://audiodescription.beta.gouv.fr/recherche")!
        components.queryItems = [URLQueryItem(name: "search", value: searchText)]
        if freeOnly { components.queryItems?.append(URLQueryItem(name: "is_free", value: "1")) }
        return components.url!
    }

    private var filtered: [AccessibleCinemaSource] {
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        return AccessibleCinemaDirectory.sources.filter { source in
            let languageMatches = selectedLanguage == .all || source.languages.contains(selectedLanguage)
            let typeMatches = selectedKind == .all || source.kinds.contains(selectedKind)
            let queryMatches = query.isEmpty || [MusicLocalized.message(source.name), MusicLocalized.message(source.description), source.detail]
                .contains(where: { $0.localizedStandardContains(query) })
            return languageMatches && typeMatches && queryMatches
        }
    }

    private var currentAudioStamp: String? {
        NativeAudiocinematecaCredentials.load().map { NativeCinemaRecent.digest($0.username + "\u{0}" + $0.password) }
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
        refreshDriveIndex = false
        driveSearchProgress = nil
        remoteSearching = false
        remoteSearched = false
        consultedCatalogues = 0
        tapeResults = []
        movieResults = []
        arteResults = []
        arteChecked = false
        driveResults = []
        unavailableSources = []
        partialSources = []
        staleSources = []
        cinemaSearchLimit = 50
    }
    @MainActor private func performRemoteSearch(_ request: UUID) async {
        let term = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !term.isEmpty, !remoteSearched, submittedSearch == request else { return }
        // A view can reappear after its task was cancelled. Restart the incomplete pass.
        consultedCatalogues = 0
        tapeResults = []
        movieResults = []
        arteResults = []
        arteChecked = false
        driveResults = []
        unavailableSources = []
        partialSources = []
        staleSources = []
        remoteSearching = true
        let refresh = refreshDriveIndex
        defer { if submittedSearch == request {
            remoteSearching = false
            remoteSearched = !Task.isCancelled
            driveSearchProgress = nil
            refreshDriveIndex = false
        } }
        if spanishFilter, let account = NativeAudiocinematecaCredentials.load() {
            do {
                let entries = try await NativeAudiocinematecaCache.shared.refresh(account: account)
                guard !Task.isCancelled, submittedSearch == request else { return }
                if let current = NativeAudiocinematecaCredentials.load(),
                   current.username == account.username, current.password == account.password {
                    audioAccountStamp = currentAudioStamp
                    audiocinematecaResults = entries
                    consultedCatalogues += 1
                }
            } catch { if !Task.isCancelled, submittedSearch == request { unavailableSources.append("Audiocinemateca") } }
        } else if spanishFilter {
            unavailableSources.append("Audiocinemateca")
        }
        guard !Task.isCancelled, submittedSearch == request else { return }
        if englishFilmsFilter {
            do {
                let films = try await NativeTapeTerritoryCatalogue.fetchFilms()
                guard !Task.isCancelled, submittedSearch == request else { return }
                tapeResults = films.filter { NativeCinemaRules.matches(term, fields: [$0.title, String($0.year)]) }
                consultedCatalogues += 1
            } catch { if !Task.isCancelled, submittedSearch == request { unavailableSources.append("Tape Territory") } }
            guard !Task.isCancelled, submittedSearch == request else { return }
            do {
                let works = try await NativeMoviesForTheBlindWork.fetchWorks()
                guard !Task.isCancelled, submittedSearch == request else { return }
                movieResults = works.filter { NativeCinemaRules.matches(term, fields: [$0.title]) }
                consultedCatalogues += 1
            } catch { if !Task.isCancelled, submittedSearch == request { unavailableSources.append("Movies for the Blind") } }
        }
        if eligibleSources.contains(where: { $0.id == "arte" }) {
            do {
                let catalogue = try await NativeArteCatalogue.search(query: term, kind: selectedKind)
                guard !Task.isCancelled, submittedSearch == request else { return }
                arteResults = catalogue.works
                arteChecked = !catalogue.incomplete
                consultedCatalogues += 1
                if catalogue.incomplete { partialSources.append("ARTE (francés)") }
            } catch {
                if !Task.isCancelled, submittedSearch == request { unavailableSources.append("ARTE (francés)") }
            }
        }
        for (sourceID, language, name) in [
            ("audesc-es", AccessibleCinemaLanguage.spain, "Universo Audesc España"),
            ("audesc-latino", AccessibleCinemaLanguage.latino, "Universo Audesc Latino")
        ] where (selectedLanguage == .all || selectedLanguage == language) &&
            eligibleSources.contains(where: { $0.id == sourceID }) {
            guard !Task.isCancelled, submittedSearch == request else { return }
            do {
                let result = try await NativeCinemaPublicDrive().searchPublished(
                    sourceID: sourceID, query: term, kind: selectedKind, refresh: refresh
                ) { partial, pages in
                    guard submittedSearch == request else { return }
                    driveSearchProgress = partial.stale
                        ? MusicLocalized.format("%@: índice anterior, pendiente de actualizar", name)
                        : MusicLocalized.format("%@: %d páginas consultadas", name, pages)
                    if partial.stale && !staleSources.contains(name) { staleSources.append(name) }
                    if staleSources.contains(name), !partial.stale {
                        // Keep the older hits visibly marked until the fresh
                        // pass completes; a partial pass must not imply deletion.
                        let newIDs = Set(partial.hits.map(\.id))
                        driveResults.removeAll { $0.sourceID == sourceID && newIDs.contains($0.id) }
                    } else {
                        driveResults.removeAll { $0.sourceID == sourceID }
                    }
                    driveResults.append(contentsOf: partial.hits)
                }
                guard !Task.isCancelled, submittedSearch == request else { return }
                driveResults.removeAll { $0.sourceID == sourceID }
                driveResults.append(contentsOf: result.hits)
                consultedCatalogues += 1
                if result.incomplete { partialSources.append(name) }
                if result.stale && !staleSources.contains(name) { staleSources.append(name) }
                if !result.stale { staleSources.removeAll { $0 == name } }
            } catch {
                if !Task.isCancelled, submittedSearch == request {
                    unavailableSources.append(name)
                    if let failure = error as? NativeCinemaPublicDriveError,
                       failure == .denied || failure == .noLongerAvailable {
                        driveResults.removeAll { $0.sourceID == sourceID }
                        staleSources.removeAll { $0 == name }
                    }
                }
            }
        }
    }

    @MainActor private func playbackRow(_ selection: NativeCinemaPlaybackSelection, title: String? = nil) -> some View {
        Button {
            selectedPlayback = NativeCinemaPlaybackRequest(selection: selection)
        } label: {
            Text(title ?? selection.label)
        }
        .accessibilityHint(selection.hasSavedPosition ? MusicLocalized.message("Reanudar reproducción") : MusicLocalized.message("Reproducir"))
        .accessibilityAction(named: Text("Reproducir desde el principio")) {
            selectedPlayback = NativeCinemaPlaybackRequest(selection: selection, fromBeginning: true)
        }
        .accessibilityAction(named: Text("Información de la obra")) {
            selectedPlayback = NativeCinemaPlaybackRequest(selection: selection, informationOnly: true)
        }
        .accessibilityAction(named: Text(MusicLocalized.message(cinemaRecents.isFavorite(selection) ? "Quitar de favoritos" : "Añadir a favoritos"))) {
            cinemaRecents.toggleFavorite(selection)
        }
    }

    @ViewBuilder private var remoteResults: some View {
        Section("Resultados de catálogos") {
            ForEach(tapeResults.prefix(cinemaSearchLimit)) { film in
                playbackRow(.tape(film))
            }
            ForEach(movieResults.prefix(cinemaSearchLimit)) { work in
                playbackRow(.movie(work))
            }
            ForEach(arteResults.prefix(cinemaSearchLimit)) { work in
                Link([work.title, work.year, "ARTE (francés)"].filter { !$0.isEmpty }.joined(separator: " — "), destination: work.address)
                    .accessibilityHint(MusicLocalized.format("Abrir plataforma original: %@", "ARTE"))
                    .accessibilityValue(Text("Reproductor externo"))
            }
            ForEach(driveResults.prefix(cinemaSearchLimit)) { hit in
                let selection = NativeCinemaPlaybackSelection.drive(hit)
                let term = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
                let folderTitle = hit.path.dropFirst().reversed().first(where: { NativeCinemaRules.matches(term, fields: [$0.name]) })?.name
                let title = NativeCinemaRules.matches(term, fields: [hit.entry.name])
                    ? selection.label : [folderTitle, selection.label].compactMap { $0 }.joined(separator: " — ")
                playbackRow(selection, title: title)
            }
            ForEach(matchingAudiocinemateca.prefix(cinemaSearchLimit)) { item in
                playbackRow(.audio(item))
            }
            ForEach(personalItems.prefix(cinemaSearchLimit)) { item in
                playbackRow(.personal(item))
            }
            if ([tapeResults.count, movieResults.count, arteResults.count, driveResults.count, matchingAudiocinemateca.count, personalItems.count].max() ?? 0) > cinemaSearchLimit {
                Button("Cargar más resultados") { cinemaSearchLimit += 50 }
            }
            if !unavailableSources.isEmpty {
                Text(MusicLocalized.message("Catálogos no disponibles: ") + unavailableSources.joined(separator: ", "))
            }
            if !partialSources.isEmpty {
                Text(MusicLocalized.message("Búsqueda parcial: ") + partialSources.joined(separator: ", "))
            }
            if !staleSources.isEmpty {
                Text(MusicLocalized.message("Índice anterior, pendiente de actualizar: ") + staleSources.joined(separator: ", "))
            }
            let resultCount = tapeResults.count + movieResults.count + arteResults.count + driveResults.count + matchingAudiocinemateca.count + personalItems.count
            if remoteSearched {
                Text(MusicLocalized.format("Resultados: %d", resultCount)).accessibilityAddTraits(.updatesFrequently)
                if NativeCinemaRules.canDeclareEmpty(completed: remoteSearched, count: resultCount,
                    unavailable: unavailableSources.count, partial: partialSources.count, attempted: consultedCatalogues) {
                    Text("No se encontraron obras en los catálogos consultados.")
                } else if resultCount == 0 {
                    Text("No hay resultados confirmados. Consulta también las plataformas originales.")
                }
            }
            Text("Los resultados corresponden únicamente a los catálogos consultados. Las demás plataformas requieren una búsqueda externa.")
                .font(.footnote)
        }
    }

    private var matchingAudiocinemateca: [NativeAudiocinematecaCatalogueIndex.Entry] {
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !query.isEmpty, let stamp = currentAudioStamp, stamp == audioAccountStamp else { return [] }
        let categories: [AccessibleCinemaKind: String] = [
            .film: "peliculas", .series: "series", .documentary: "documentales", .short: "cortometrajes"
        ]
        return audiocinematecaResults.filter { item in
            (selectedKind == .all || item.category == categories[selectedKind]) &&
            (selectedLanguage == .all || (selectedLanguage == .spain && item.languageCode == "1") ||
             (selectedLanguage == .latino && item.languageCode == "2")) &&
            NativeCinemaRules.matches(query, fields: [item.title, item.year, item.genre, item.synopsis])
        }.sorted { $0.title.localizedStandardCompare($1.title) == .orderedAscending }
    }

    private var personalItems: [NativeCinemaLocalItem] {
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        return personalLibrary.items.filter { item in
            NativeCinemaRules.permits(selectedLanguage, all: .all, actual: item.language)
                && NativeCinemaRules.permits(selectedKind, all: .all, actual: item.kind)
                && NativeCinemaRules.matches(query, fields: [item.title])
        }
        .sorted { $0.title.localizedStandardCompare($1.title) == .orderedAscending }
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

    @ViewBuilder private var personalRows: some View {
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
            NavigationLink {
                NativeCinemaPersonalDetailScreen(itemID: item.id)
            } label: {
                Text(item.title)
                    .accessibilityValue(MusicLocalized.message(item.language.rawValue) + ", " + MusicLocalized.message(item.kind.rawValue))
            }
        }
    }

    var body: some View {
        List {
            if mode == .search {
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
                        if let driveSearchProgress {
                            Text(driveSearchProgress).accessibilityAddTraits(.updatesFrequently)
                        }
                        Button("Cancelar") {
                            submittedSearch = nil
                            remoteSearching = false
                            remoteSearched = false
                            driveSearchProgress = nil
                        }
                    }
                }
            }
            .listRowBackground(TifloVisual.surfaceRaised)

            if remoteSearched || remoteSearching || !driveResults.isEmpty || !tapeResults.isEmpty || !movieResults.isEmpty || !arteResults.isEmpty ||
                (!searchText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && (!personalItems.isEmpty || !matchingAudiocinemateca.isEmpty)) { remoteResults }

            if spanishFilter && !searchText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                Section("Audiocinemateca") {
                    NavigationLink("Explorar catálogo audiodescrito") {
                        NativeAudiocinematecaBrowser(query: searchText, kind: selectedKind, language: selectedLanguage)
                    }
                }
            }


                if !searchText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    if !remoteSearching && spanishFilter {
                        Button("Actualizar índice de Universo Audesc") {
                            resetRemoteSearch()
                            refreshDriveIndex = true
                            submittedSearch = UUID()
                        }
                    }
                    if !externalSearchSources.isEmpty {
                        NavigationLink("Buscar en plataformas externas") {
                            List {
                            Text("Estos catálogos no se consultan automáticamente. Abre la plataforma o busca el título en su web. Comprueba que la obra tenga audiodescripción.")
                                .font(.footnote)
                            if let url = combinedExternalSearchURL {
                                Link("Buscar en todas las webs de estas plataformas", destination: url)
                            }
                            ForEach(externalSearchSources) { source in
                                NavigationLink {
                                    List {
                                        if source.id == "ard" {
                                            Link("Buscar en la plataforma original", destination: URL(string: "https://www.ardmediathek.de/suche")!)
                                        } else if source.id == "rtve-campeones" {
                                            Link("Buscar en la plataforma original", destination: URL(string: "https://www.rtve.es/play/buscador/")!)
                                        }
                                        if let provider = ["tubi": "Tubi", "pluto": "Pluto", "plex-ad": "Plex"][source.id] {
                                            Link("Audio Description Project", destination: adpSearchURL(provider: provider))
                                        }
                                        if let url = providerSearchURL(source) {
                                            Link("Buscar título en la web", destination: url)
                                        }
                                        NavigationLink("Explorar catálogo audiodescrito") {
                                            NativeCinemaProviderScreen(source: source, selectedKind: selectedKind, selectedLanguage: selectedLanguage, query: searchText)
                                        }
                                    }
                                    .tifloScreenSurface()
                                    .navigationTitle(MusicLocalized.message(source.name))
                                } label: { Text(MusicLocalized.message(source.name)) }
                            }
                            }
                            .tifloScreenSurface()
                            .navigationTitle("Buscar en plataformas externas")
                        }
                    }
                    if selectedLanguage == .all || selectedLanguage == .english || selectedLanguage == .french ||
                        selectedLanguage == .german || selectedLanguage == .italian {
                        Section("Buscadores especializados") {
                            if selectedLanguage == .all || selectedLanguage == .english {
                                Link("Audio Description Project", destination: adpSearchURL())
                            }
                            if selectedLanguage == .all || selectedLanguage == .french {
                                Link("Portail de l’audiodescription", destination: frenchDiscoveryURL(freeOnly: false))
                                Link("Películas gratuitas", destination: frenchDiscoveryURL(freeOnly: true))
                            }
                            if selectedLanguage == .all || selectedLanguage == .german {
                                Link("hörfilm.info", destination: URL(string: "https://hoerfilm.info/mediatheken.html")!)
                            }
                            if selectedLanguage == .all || selectedLanguage == .italian {
                                Link("CiecandoScherzando", destination: URL(string: "https://ciecandoscherzando.it/audiodescrizioni/")!)
                            }
                        }
                    }
                    if !filtered.isEmpty {
                        Section("Plataformas") {
                            ForEach(filtered) { source in
                                NavigationLink {
                                    NativeCinemaProviderScreen(source: source, selectedKind: selectedKind, selectedLanguage: selectedLanguage, query: searchText)
                                } label: {
                                    Text(MusicLocalized.message(source.name))
                                }
                            }
                        }
                        .listRowBackground(TifloVisual.surfaceRaised)
                    }
                }
            }
            if mode == .discovery {
                NativeAdjustableChoice(
                    title: "Idioma de audiodescripción",
                    choices: AccessibleCinemaLanguage.allCases.map(\.rawValue),
                    selectedIndex: $discoveryLanguageIndex
                )
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


                if selectedLanguage == .spain || selectedLanguage == .latino || selectedLanguage == .portuguese {
                    Text("No hay fuentes para estos filtros")
                        .foregroundStyle(TifloVisual.secondaryText)
                }
            }
            if mode == .collection {
                Section("Mi colección personal") {
                    NavigationLink("Importar") {
                        List {
                            Section("Importar") {
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
                                    Text(importStatus).accessibilityAddTraits(.updatesFrequently)
                                }
                            }
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


                        }
                        .tifloScreenSurface()
                        .navigationTitle("Importar")
                        .fileImporter(
                            isPresented: $selectingPersonalFiles,
                            allowedContentTypes: [.audio, .movie],
                            allowsMultipleSelection: true
                        ) { result in
                            Task { @MainActor in importPersonalFiles(result) }
                        }
                    }
                    NativeAdjustableChoice(
                        title: "Idioma de audiodescripción",
                        choices: AccessibleCinemaLanguage.allCases.map(\.rawValue),
                        selectedIndex: $collectionLanguageIndex
                    )
                    NativeAdjustableChoice(
                        title: "Tipo de contenido",
                        choices: AccessibleCinemaKind.allCases.map(\.rawValue),
                        selectedIndex: $collectionContentIndex
                    )
                    personalRows
                }
                .listRowBackground(TifloVisual.surfaceRaised)
            }
        }
        .tifloScreenSurface()
        .navigationTitle(MusicLocalized.message(mode.title))
        .onChange(of: searchText) { _, _ in resetRemoteSearch() }
        .onChange(of: languageIndex) { _, _ in resetRemoteSearch() }
        .onChange(of: contentIndex) { _, _ in resetRemoteSearch() }
        .sheet(item: $selectedPlayback) { request in
            NavigationStack { NativeCinemaDirectPlaybackScreen(request: request) }
        }
        .task(id: submittedSearch) {
            if let request = submittedSearch { await performRemoteSearch(request) }
        }
        .onAppear {
            guard mode == .search else { return }
            let stamp = currentAudioStamp
            if stamp != audioAccountStamp {
                audiocinematecaResults = []
                audioAccountStamp = stamp
                if submittedSearch != nil {
                    resetRemoteSearch()
                    if !searchText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { submittedSearch = UUID() }
                }
            }
            if submittedSearch == nil {
                Task { @MainActor in
                    if let account = NativeAudiocinematecaCredentials.load(),
                       let entries = try? await NativeAudiocinematecaCache.shared.cachedEntries(account: account),
                       submittedSearch == nil,
                       let current = NativeAudiocinematecaCredentials.load(),
                       current.username == account.username, current.password == account.password {
                        audioAccountStamp = currentAudioStamp
                        audiocinematecaResults = entries
                    }
                }
            }
        }
        .onReceive(Timer.publish(every: 1, on: .main, in: .common).autoconnect()) { _ in
            personalPlayer.refresh(library: personalLibrary)
        }
        .onDisappear { personalPlayer.refresh(library: personalLibrary) }
    }
}

@MainActor
private struct NativeCinemaPersonalDetailScreen: View {
    let itemID: UUID
    @Environment(\.dismiss) private var dismiss
    @StateObject private var personalLibrary = NativeCinemaLocalLibrary.shared
    @StateObject private var personalPlayer = NativeCinemaAudioPlayer.shared
    @StateObject private var cinemaRecents = NativeCinemaRecentStore.shared
    @State private var confirmDeletion = false
    @State private var playbackStatus = ""

    private var item: NativeCinemaLocalItem? {
        personalLibrary.items.first { $0.id == itemID }
    }

    var body: some View {
        List {
            if let item {
                if personalPlayer.currentID == item.id, personalPlayer.playbackError == nil {
                    Section("Reproductor") {
                        if item.isVideoFile, let videoPlayer = personalPlayer.videoPlayer {
                            NativeCinemaVideoSurface(player: videoPlayer)
                                .frame(maxWidth: .infinity)
                                .frame(height: 210)
                                .accessibilityHidden(true)
                        }
                        NativeCinemaTransportControls(player: personalPlayer, library: personalLibrary)
                    }
                } else {
                    if personalPlayer.currentID == item.id, let playbackError = personalPlayer.playbackError {
                        Text(playbackError).accessibilityAddTraits(.updatesFrequently)
                    }
                    Button("Reproducir") {
                        playbackStatus = ""
                        do { try personalPlayer.open(item, library: personalLibrary) }
                        catch { playbackStatus = error.localizedDescription }
                    }
                }
                if !playbackStatus.isEmpty {
                    Text(playbackStatus).accessibilityAddTraits(.updatesFrequently)
                }
                NavigationLink("Información") {
                    List {
                        Text(MusicLocalized.message(item.language.rawValue))
                        Text(MusicLocalized.message(item.kind.rawValue))
                    }
                    .tifloScreenSurface()
                    .navigationTitle("Información")
                }
                Button(MusicLocalized.format("Eliminar de mi colección: %@", item.title), role: .destructive) {
                    confirmDeletion = true
                }
            } else {
                Text(NativeCinemaLocalError.missing.localizedDescription)
            }
        }
        .tifloScreenSurface()
        .navigationTitle(item?.title ?? MusicLocalized.message("Mi colección personal"))
        .confirmationDialog(
            MusicLocalized.format("¿Eliminar «%@»?", item?.title ?? ""),
            isPresented: $confirmDeletion, titleVisibility: .visible
        ) {
            Button("Eliminar archivo personal", role: .destructive) {
                guard let item else { return }
                if personalPlayer.currentID == item.id {
                    personalPlayer.pauseAndSave(library: personalLibrary)
                }
                do {
                    try personalLibrary.remove(item)
                    cinemaRecents.remove(item.id.uuidString)
                    dismiss()
                } catch { playbackStatus = error.localizedDescription }
            }
            Button("Cancelar", role: .cancel) {}
        } message: {
            Text("Se eliminará el archivo guardado en esta colección personal.")
        }
    }
}

private struct NativeCinemaPlatformsScreen: View {
    var body: some View {
        List {
            NavigationLink("Español") { NativeCinemaLanguageScreen(language: .spain) }
            NavigationLink("Inglés") { NativeCinemaLanguageScreen(language: .english) }
            NavigationLink("Francés") { NativeCinemaLanguageScreen(language: .french) }
            NavigationLink("Portugués") { NativeCinemaLanguageScreen(language: .portuguese) }
            NavigationLink("Italiano") { NativeCinemaLanguageScreen(language: .italian) }
            NavigationLink("Alemán") { NativeCinemaLanguageScreen(language: .german) }
        }
        .tifloScreenSurface()
        .navigationTitle("Plataformas")
    }
}

private struct NativeCinemaLanguageScreen: View {
    let language: AccessibleCinemaLanguage

    private var sources: [AccessibleCinemaSource] {
        AccessibleCinemaDirectory.sources.filter { source in
            let matches = language == .spain
                ? source.languages.contains(.spain) || source.languages.contains(.latino)
                : source.languages.contains(language)
            return matches && !["audesc-es", "audesc-latino"].contains(source.id)
        }
    }

    var body: some View {
        List {
            if language == .spain {
                NavigationLink("Universo Audesc") { NativeCinemaAudescScreen() }
            }
            ForEach(sources) { source in
                NavigationLink {
                    NativeCinemaProviderScreen(source: source)
                } label: {
                    Text(MusicLocalized.message(source.name))
                }
            }
        }
        .tifloScreenSurface()
        .navigationTitle(MusicLocalized.message(language == .spain ? "Español" : language.rawValue))
    }
}

private struct NativeCinemaAudescScreen: View {
    var body: some View {
        List {
            ForEach(AccessibleCinemaDirectory.sources.filter { ["audesc-es", "audesc-latino"].contains($0.id) }) { source in
                NavigationLink {
                    NativeCinemaProviderScreen(source: source)
                } label: {
                    Text(MusicLocalized.message(source.id == "audesc-es" ? "Español de España" : "Español latino"))
                }
            }
            NavigationLink("Información y agradecimientos") {
                List {
                    Section("Sobre el acceso") {
                        Text("Los catálogos públicos se actualizan desde Google Drive cuando la conexión pública está configurada. También puedes elegir carpetas autorizadas con tu propia cuenta.")
                        Text(MusicLocalized.format("Agradecemos a %@ su predisposición y colaboración con Multicines Accesibles.", "Alfredo Amate"))
                    }
                }
                .tifloScreenSurface()
                .navigationTitle("Información y agradecimientos")
            }
        }
        .tifloScreenSurface()
        .navigationTitle("Universo Audesc")
    }
}

private struct NativeCinemaProviderScreen: View {
    let source: AccessibleCinemaSource
    var selectedKind: AccessibleCinemaKind = .all
    var selectedLanguage: AccessibleCinemaLanguage = .all
    var query: String = ""

    private var collaborator: String? {
        switch source.id {
        case "audiocinemateca": return "José Manuel Delicado"
        case "cinema-accessibile": return "Paolo Bernardini (Medialica)"
        case "tape-territory": return "Mike Bamonte"
        default: return nil
        }
    }

    var body: some View {
        List {
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
                            NavigationLink("Entrar en Audiocinemateca") {
                                NativeAudiocinematecaBrowser(query: query, kind: selectedKind, language: selectedLanguage)
                            }
                            Link("Crear cuenta gratuita", destination: URL(string: "https://audiocinemateca.com/usuario/register")!)
                            .frame(minHeight: 44, alignment: .leading)
                        }
                        if let address = source.address, source.id != "audiocinemateca" {
                            Link(MusicLocalized.format("Abrir plataforma original: %@", MusicLocalized.message(source.name)), destination: address)
                                .font(.body.weight(.semibold))
                                .frame(minHeight: 44, alignment: .leading)
                        } else if source.address == nil && !["audesc-es", "audesc-latino"].contains(source.id) {
                            Text("Fuente pendiente de conexión segura")
                                .font(.subheadline)
                                .foregroundStyle(TifloVisual.secondaryText)
                        }

            NavigationLink {
                List {
                    Section("Sobre el acceso") {
                        Text(source.detail)
                        Text("Las plataformas muestran obras audiodescritas según su catálogo, país y permisos. Abrir la web oficial no significa que todas sus películas tengan audiodescripción.")
                        if source.id == "audiocinemateca", let address = source.address {
                            Link(MusicLocalized.format("Abrir plataforma original: %@", MusicLocalized.message(source.name)), destination: address)
                        }
                        if let collaborator {
                            Text(MusicLocalized.format("Agradecemos a %@ su predisposición y colaboración con Multicines Accesibles.", collaborator))
                        }
                    }
                }
                .tifloScreenSurface()
                .navigationTitle(MusicLocalized.message(collaborator == nil ? "Información" : "Información y agradecimientos"))
            } label: {
                Text(MusicLocalized.message(collaborator == nil ? "Información" : "Información y agradecimientos"))
            }
        }
        .tifloScreenSurface()
        .navigationTitle(MusicLocalized.message(source.name))
    }
}
