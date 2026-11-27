import SwiftUI
import AVFoundation
import MediaPlayer
import UIKit

struct NativeRadioStation: Codable, Identifiable {
    let stationuuid: String
    let name: String
    let url_resolved: String
    let lastcheckok: Int
    let country: String?
    let tags: String?

    var id: String { stationuuid }
    var urlResolved: URL? { URL(string: url_resolved) }
}

private struct NativeRadioFilter {
    var name = ""
    var countryCode = ""
    var language = ""
    var genre = ""

    var queryItems: [URLQueryItem] {
        var fields: [URLQueryItem] = []
        if !name.isEmpty { fields.append(URLQueryItem(name: "name", value: name)) }
        if !countryCode.isEmpty { fields.append(URLQueryItem(name: "countrycode", value: countryCode)) }
        if !language.isEmpty { fields.append(URLQueryItem(name: "language", value: language)) }
        if !genre.isEmpty { fields.append(URLQueryItem(name: "tag", value: genre)) }
        if fields.isEmpty { fields.append(URLQueryItem(name: "tag", value: "music")) }
        return fields
    }
}

private struct RadioFilterOption: Identifiable {
    let id: String
    let title: String
    static let countries: [RadioFilterOption] = [
        .init(id: "ES", title: "España"), .init(id: "MX", title: "México"),
        .init(id: "AR", title: "Argentina"), .init(id: "CO", title: "Colombia"),
        .init(id: "CL", title: "Chile"), .init(id: "US", title: "Estados Unidos"),
        .init(id: "GB", title: "Reino Unido"), .init(id: "FR", title: "Francia"),
        .init(id: "DE", title: "Alemania"), .init(id: "BR", title: "Brasil"),
        .init(id: "IT", title: "Italia"), .init(id: "PT", title: "Portugal")
    ]
    static let languages: [RadioFilterOption] = [
        .init(id: "spanish", title: "Español"), .init(id: "english", title: "Inglés"),
        .init(id: "french", title: "Francés"), .init(id: "portuguese", title: "Portugués"),
        .init(id: "italian", title: "Italiano"), .init(id: "german", title: "Alemán")
    ]
    static let genres: [RadioFilterOption] = [
        .init(id: "rock", title: "Rock"), .init(id: "pop", title: "Pop"),
        .init(id: "jazz", title: "Jazz"), .init(id: "classical", title: "Clásica"),
        .init(id: "country", title: "Country"), .init(id: "electronic", title: "Electrónica"),
        .init(id: "latin", title: "Latina"), .init(id: "blues", title: "Blues"),
        .init(id: "talk", title: "Programas hablados")
    ]
}

@MainActor
private final class NativeRadioDirectory: ObservableObject {
    @Published private(set) var stations: [NativeRadioStation] = []
    @Published private(set) var isSearching = false
    @Published var error: String?

    func search(_ query: String) async {
        await search(filter: NativeRadioFilter(name: query))
    }

    func search(filter: NativeRadioFilter) async {
        isSearching = true
        defer { isSearching = false }
        var parts = URLComponents()
        parts.scheme = "https"
        parts.host = "de1.api.radio-browser.info"
        parts.path = "/json/stations/search"
        parts.queryItems = filter.queryItems + [
            URLQueryItem(name: "hidebroken", value: "true"),
            URLQueryItem(name: "limit", value: "50"),
            URLQueryItem(name: "order", value: "votes"),
            URLQueryItem(name: "reverse", value: "true")
        ]
        guard let url = parts.url else { error = MusicLocalized.message("No se pudo preparar la búsqueda."); return }
        do {
            var request = URLRequest(url: url)
            request.setValue("TifloAcosta/1.5", forHTTPHeaderField: "User-Agent")
            request.timeoutInterval = 15
            let (data, response) = try await URLSession.shared.data(for: request)
            guard (response as? HTTPURLResponse)?.statusCode == 200 else {
                throw URLError(.badServerResponse)
            }
            let received = try JSONDecoder().decode([NativeRadioStation].self, from: data)
            stations = received.filter { station in
                station.lastcheckok == 1 && station.urlResolved?.scheme == "https"
            }
            error = nil
        } catch {
            stations = []
            self.error = MusicLocalized.message("No se pudieron consultar las emisoras. Comprueba la conexión e inténtalo de nuevo.")
        }
    }
}

/// Radio is streamed, never copied to the local music library.
@MainActor
final class NativeRadioPlayer: ObservableObject {
    static let shared = NativeRadioPlayer()
    @Published private(set) var stationName = ""
    @Published private(set) var isPlaying = false
    @Published var error: String?

    private var player: AVPlayer?
    private var itemStatusObservation: NSKeyValueObservation?
    private var remoteTokens: [Any] = []

    func play(name: String, url: URL) {
        guard url.scheme == "https" else {
            error = MusicLocalized.message("Esta emisora no dispone de una transmisión segura compatible.")
            return
        }
        NativeJamendoPlayer.shared.pauseForOtherAudio()
        NativeAppleMusicPlayer.shared.pauseForOtherAudio()
        NativeAudiusPlayer.shared.pauseForOtherAudio()
        NativeMusicPlayer.shared.pauseForReader()
        NativeReaderPlaybackBridge.pauseActiveReader?()
        do {
            try AVAudioSession.sharedInstance().setCategory(.playback, mode: .default)
            try AVAudioSession.sharedInstance().setActive(true)
            player?.pause()
            itemStatusObservation = nil
            let item = AVPlayerItem(url: url)
            player = AVPlayer(playerItem: item)
            // AVPlayer.play() no confirma que el códec del servidor sea legible.
            // Comprobamos el estado del elemento y explicamos el error al usuario.
            itemStatusObservation = item.observe(\.status, options: [.new]) { [weak self] observed, _ in
                Task { @MainActor [weak self] in
                    guard let self, self.player?.currentItem === observed else { return }
                    if observed.status == .failed {
                        self.isPlaying = false
                        self.error = MusicLocalized.message("Este archivo de audio no puede reproducirse con los formatos admitidos por iOS.")
                        self.updateNowPlaying()
                    }
                }
            }
            stationName = name
            NativeRemotePlaybackOwner.claim(.radio)
            registerRemoteCommands()
            player?.play()
            isPlaying = true
            updateNowPlaying()
            error = nil
        } catch {
            self.error = MusicLocalized.format("No se pudo iniciar la radio: %@", error.localizedDescription)
        }
    }

    func toggle() {
        guard let player else { return }
        if isPlaying {
            player.pause()
            isPlaying = false
        } else {
            NativeJamendoPlayer.shared.pauseForOtherAudio()
            NativeAppleMusicPlayer.shared.pauseForOtherAudio()
            NativeAudiusPlayer.shared.pauseForOtherAudio()
            NativeMusicPlayer.shared.pauseForReader()
            NativeReaderPlaybackBridge.pauseActiveReader?()
            NativeRemotePlaybackOwner.claim(.radio)
            player.play()
            isPlaying = true
        }
        updateNowPlaying()
    }

    func pauseForOtherAudio() {
        guard isPlaying else { return }
        player?.pause()
        isPlaying = false
        updateNowPlaying()
    }

    func stop() {
        player?.pause()
        itemStatusObservation = nil
        player = nil
        isPlaying = false
        stationName = ""
        unregisterRemoteCommands()
        NativeRemotePlaybackOwner.release(.radio)
    }

    private func updateNowPlaying() {
        guard NativeRemotePlaybackOwner.current == .radio else { return }
        MPNowPlayingInfoCenter.default().nowPlayingInfo = [
            MPMediaItemPropertyTitle: stationName,
            MPNowPlayingInfoPropertyIsLiveStream: true,
            MPNowPlayingInfoPropertyPlaybackRate: isPlaying ? 1.0 : 0.0
        ]
    }

    private func registerRemoteCommands() {
        guard remoteTokens.isEmpty else { return }
        UIApplication.shared.beginReceivingRemoteControlEvents()
        let center = MPRemoteCommandCenter.shared()
        center.playCommand.isEnabled = true
        center.pauseCommand.isEnabled = true
        center.togglePlayPauseCommand.isEnabled = true
        remoteTokens = [
            center.playCommand.addTarget { [weak self] _ in
                Task { @MainActor [weak self] in
                    guard NativeRemotePlaybackOwner.current == .radio, let self, !self.isPlaying else { return }
                    self.toggle()
                }
                return .success
            },
            center.pauseCommand.addTarget { [weak self] _ in
                Task { @MainActor [weak self] in
                    guard NativeRemotePlaybackOwner.current == .radio, let self, self.isPlaying else { return }
                    self.toggle()
                }
                return .success
            },
            center.togglePlayPauseCommand.addTarget { [weak self] _ in
                Task { @MainActor [weak self] in
                    guard NativeRemotePlaybackOwner.current == .radio else { return }
                    self?.toggle()
                }
                return .success
            }
        ]
    }

    private func unregisterRemoteCommands() {
        guard remoteTokens.count == 3 else { return }
        let center = MPRemoteCommandCenter.shared()
        center.playCommand.removeTarget(remoteTokens[0])
        center.pauseCommand.removeTarget(remoteTokens[1])
        center.togglePlayPauseCommand.removeTarget(remoteTokens[2])
        remoteTokens = []
    }
}

struct MusicPlaylistDestination: Identifiable {
    let id: UUID
    let name: String
}

typealias NativeMusicAddToPlaylist = (_ provider: String, _ songID: String,
                                      _ title: String, _ artist: String, _ playlistID: UUID) -> Void

struct NativeMusicPlaylistMenu: View {
    let playlists: [MusicPlaylistDestination]
    let provider: String
    let songID: String
    let title: String
    let artist: String
    let addToPlaylist: NativeMusicAddToPlaylist?

    var body: some View {
        if let addToPlaylist, !playlists.isEmpty {
            Menu(MusicLocalized.format("Añadir %@ a una lista", title)) {
                ForEach(playlists) { playlist in
                    Button(MusicLocalized.format("Añadir a %@", playlist.name)) {
                        addToPlaylist(provider, songID, title, artist, playlist.id)
                    }
                }
            }
        }
    }
}

struct NativeMusicPlatformsScreen: View {
    var playlists: [MusicPlaylistDestination] = []
    var addToPlaylist: NativeMusicAddToPlaylist? = nil
    @AppStorage("music.cellularPlayback") private var allowCellularPlayback = true
    @ObservedObject private var network = NativeMusicConnectionPolicy.shared
    var body: some View {
        List {
            if !network.canStream(allowCellular: allowCellularPlayback) {
                Text("La reproducción por Internet está limitada por tu ajuste de Conexión.")
            } else {
            NavigationLink("Radio musical gratuita") { NativeRadioScreen() }
            NavigationLink("Audius: música gratuita") {
                NativeAudiusScreen(playlists: playlists, addToPlaylist: addToPlaylist)
            }
            NavigationLink("Jamendo: música gratuita") {
                NativeJamendoScreen(playlists: playlists, addToPlaylist: addToPlaylist)
            }
            NavigationLink("Conciertos y grabaciones") {
                NativeInternetArchiveScreen()
            }
            Link("Radio gratuita de Apple Music", destination: URL(string: "https://music.apple.com/es/radio")!)
            if Bundle.main.object(forInfoDictionaryKey: "TifloAppleMusicEnabled") as? Bool == true {
                NavigationLink("Apple Music") {
                    NativeAppleMusicScreen(playlists: playlists, addToPlaylist: addToPlaylist)
                }
            }
            }
        }
        .tifloScreenSurface()
        .navigationTitle("Plataformas musicales")
    }
}

private struct NativeRadioStationRow: View {
    let station: NativeRadioStation
    @ObservedObject private var radio = NativeRadioPlayer.shared
    @AppStorage("mi-musica-radio-favorites-v2") private var savedFavorites = ""

    private var favorites: [NativeRadioStation] {
        guard let data = savedFavorites.data(using: .utf8) else { return [] }
        return (try? JSONDecoder().decode([NativeRadioStation].self, from: data)) ?? []
    }

    private func toggleFavorite() {
        var updated = favorites
        if let index = updated.firstIndex(where: { $0.id == station.id }) {
            updated.remove(at: index)
        } else {
            updated.append(station)
        }
        if let data = try? JSONEncoder().encode(updated),
           let text = String(data: data, encoding: .utf8) {
            savedFavorites = text
        }
    }

    var body: some View {
        Button(station.name) {
            guard let url = station.urlResolved else { return }
            radio.play(name: station.name, url: url)
        }
        .accessibilityAction(named: Text("Reproducir")) {
            guard let url = station.urlResolved else { return }
            radio.play(name: station.name, url: url)
        }
        .accessibilityAction(named: Text(favorites.contains(where: { $0.id == station.id })
            ? "Quitar de favoritas" : "Guardar favorita")) { toggleFavorite() }
    }
}

private struct NativeRadioResultsScreen: View {
    let title: String
    let filter: NativeRadioFilter
    @StateObject private var directory = NativeRadioDirectory()
    @State private var query = ""

    var body: some View {
        List {
            if directory.isSearching { ProgressView("Buscando emisoras") }
            ForEach(directory.stations) { station in NativeRadioStationRow(station: station) }
            if !directory.isSearching && directory.stations.isEmpty && directory.error == nil {
                Text("No hay emisoras disponibles con estos criterios.")
            }
            if let error = directory.error { Text(error) }
        }
        .tifloScreenSurface()
        .navigationTitle(MusicLocalized.message(title))
        .searchable(text: $query, prompt: "Buscar emisoras por nombre")
        .onSubmit(of: .search) {
            var selected = filter
            selected.name = query.trimmingCharacters(in: .whitespacesAndNewlines)
            Task { await directory.search(filter: selected) }
        }
        .task { await directory.search(filter: filter) }
    }
}

private enum RadioCategory {
    case countries, languages, genres

    var title: String {
        switch self {
        case .countries: return "Países"
        case .languages: return "Idiomas"
        case .genres: return "Estilos"
        }
    }
    var options: [RadioFilterOption] {
        switch self {
        case .countries: return RadioFilterOption.countries
        case .languages: return RadioFilterOption.languages
        case .genres: return RadioFilterOption.genres
        }
    }
    func filter(_ option: RadioFilterOption) -> NativeRadioFilter {
        switch self {
        case .countries: return NativeRadioFilter(countryCode: option.id)
        case .languages: return NativeRadioFilter(language: option.id)
        case .genres: return NativeRadioFilter(genre: option.id)
        }
    }
}

private struct NativeRadioCategoryScreen: View {
    let category: RadioCategory

    var body: some View {
        List {
            ForEach(category.options) { option in
                NavigationLink(MusicLocalized.message(option.title)) {
                    NativeRadioResultsScreen(title: option.title, filter: category.filter(option))
                }
            }
        }
        .tifloScreenSurface()
        .navigationTitle(MusicLocalized.message(category.title))
    }
}

private struct NativeRadioAdvancedSearch: View {
    @State private var name = ""
    @State private var countryCode = ""
    @State private var language = ""
    @State private var genre = ""

    private var filter: NativeRadioFilter {
        NativeRadioFilter(
            name: name.trimmingCharacters(in: .whitespacesAndNewlines),
            countryCode: countryCode, language: language, genre: genre)
    }

    var body: some View {
        Form {
            TextField("Nombre de emisora", text: $name)
            Picker("País", selection: $countryCode) {
                Text("Todos").tag("")
                ForEach(RadioFilterOption.countries) { Text(MusicLocalized.message($0.title)).tag($0.id) }
            }
            Picker("Idioma", selection: $language) {
                Text("Todos").tag("")
                ForEach(RadioFilterOption.languages) { Text(MusicLocalized.message($0.title)).tag($0.id) }
            }
            Picker("Estilo", selection: $genre) {
                Text("Todos").tag("")
                ForEach(RadioFilterOption.genres) { Text(MusicLocalized.message($0.title)).tag($0.id) }
            }
            NavigationLink("Buscar emisoras") {
                NativeRadioResultsScreen(title: "Resultados", filter: filter)
            }
        }
        .tifloScreenSurface()
        .navigationTitle("Búsqueda avanzada")
    }
}

private struct NativeRadioScreen: View {
    @ObservedObject private var radio = NativeRadioPlayer.shared
    @AppStorage("mi-musica-radio-favorites-v2") private var savedFavorites = ""

    private var savedStations: [NativeRadioStation] {
        guard let data = savedFavorites.data(using: .utf8) else { return [] }
        return (try? JSONDecoder().decode([NativeRadioStation].self, from: data)) ?? []
    }

    var body: some View {
        List {
            Section("Emisora actual") {
                Text(radio.stationName.isEmpty ? MusicLocalized.message("Ninguna emisora") : radio.stationName)
                Button(MusicLocalized.message(radio.isPlaying ? "Pausar radio" : "Reanudar radio")) { radio.toggle() }
                    .disabled(radio.stationName.isEmpty)
                Button("Detener radio") { radio.stop() }
                    .disabled(radio.stationName.isEmpty)
            }
            Section("Explorar emisoras") {
                NavigationLink("Emisoras populares") {
                    NativeRadioResultsScreen(title: "Emisoras populares", filter: NativeRadioFilter())
                }
                NavigationLink("Buscar por países") { NativeRadioCategoryScreen(category: .countries) }
                NavigationLink("Buscar por idiomas") { NativeRadioCategoryScreen(category: .languages) }
                NavigationLink("Buscar por estilos") { NativeRadioCategoryScreen(category: .genres) }
                NavigationLink("Buscar por nombre") {
                    NativeRadioResultsScreen(title: "Buscar emisoras", filter: NativeRadioFilter())
                }
                NavigationLink("Búsqueda avanzada") { NativeRadioAdvancedSearch() }
            }
            if !savedStations.isEmpty {
                Section("Emisoras favoritas") {
                    ForEach(savedStations) { station in NativeRadioStationRow(station: station) }
                }
            }
        }
        .tifloScreenSurface()
        .navigationTitle("Radio musical gratuita")
    }
}

/// Favorites are portable by station ID. URLs with possible credentials are
/// omitted; restoration must resolve those IDs again through the directory.
struct NativeRadioBackupEntry: Codable {
    let stationID: String
    let name: String
    let streamURL: String?
    let country: String?
    let tags: String?
}

struct NativeRadioBackupSnapshot: Codable {
    let schemaVersion: Int
    let favorites: [NativeRadioBackupEntry]
    let requiresDirectoryLookup: Int
}

@MainActor
enum NativeRadioBackupAdapter {

    /// Prepare the same persisted value read by the radio screens' AppStorage.
    /// Unresolved stations remain explicit references in the returned plan.
    static func prepareBackupRestore(_ backup: NativeRadioBackupSnapshot,
                                     defaults: UserDefaults = .standard, recovery: NativeBackupRecoveryBuilder? = nil) throws
        -> (NativeBackupRestoreTransaction.Step<NativeBackupManifest.Section>,
            NativeBackupPersonalDataMerge.RadioPlan) {
        try NativeBackupPersonalDataValidation.validate(section: .radio,
            data: JSONEncoder().encode(backup))
        let key = "mi-musica-radio-favorites-v2"
        let saved = defaults.string(forKey: key) ?? ""
        let existing = saved.isEmpty ? [] :
            try JSONDecoder().decode([NativeRadioStation].self, from: Data(saved.utf8))
        let existingIDs = Set(existing.compactMap { UUID(uuidString: $0.stationuuid) })
        recovery?.recordPreserved(section: "radio", kind: "station", identifiers: backup.favorites.compactMap {
            guard let id = UUID(uuidString: $0.stationID), existingIDs.contains(id) else { return nil }
            return id.uuidString
        })
        let plan = NativeBackupPersonalDataMerge.radio(backup, existing: existing)
        let next = String(decoding: try JSONEncoder().encode(plan.favorites), as: UTF8.self)
        let before = NativeBackupDefaultsBeforeState(defaults: defaults, keys: [key], recovery: recovery)
        let step = NativeBackupRestoreTransaction.Step<NativeBackupManifest.Section>(
            section: .radio, apply: { defaults.set(next, forKey: key) },
            rollback: { before.restore() })
        return (step, plan)
    }

    static func capture(defaults: UserDefaults = .standard) throws -> NativeRadioBackupSnapshot {
        let saved = defaults.string(forKey: "mi-musica-radio-favorites-v2") ?? ""
        let stations = saved.isEmpty ? [] : try JSONDecoder().decode([NativeRadioStation].self, from: Data(saved.utf8))
        guard stations.allSatisfy({ UUID(uuidString: $0.stationuuid) != nil }),
              Set(stations.map(\.stationuuid)).count == stations.count else {
            throw CocoaError(.fileReadCorruptFile)
        }
        let entries = stations.map { station in
            NativeRadioBackupEntry(stationID: station.stationuuid, name: station.name,
                streamURL: NativeBackupReferencePolicy.eligible(station.url_resolved) ? station.url_resolved : nil,
                country: station.country, tags: station.tags)
        }
        return NativeRadioBackupSnapshot(schemaVersion: 1, favorites: entries,
            requiresDirectoryLookup: entries.filter { $0.streamURL == nil }.count)
    }
}
