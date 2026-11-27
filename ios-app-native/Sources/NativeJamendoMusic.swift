import SwiftUI
import AVFoundation
import MediaPlayer
import UIKit

private struct NativeJamendoSearchResult: Decodable {
    struct Headers: Decodable {
        let status: String
        let errorMessage: String?
        enum CodingKeys: String, CodingKey { case status; case errorMessage = "error_message" }
    }
    let headers: Headers
    let results: [NativeJamendoTrack]
}

private struct NativeJamendoTrack: Decodable, Identifiable {
    let id: String
    let name: String
    let artistName: String
    let audio: String
    enum CodingKeys: String, CodingKey { case id, name, audio; case artistName = "artist_name" }

    var streamURL: URL? {
        guard let url = URL(string: audio), url.scheme == "https", url.host != nil else { return nil }
        return url
    }
}

@MainActor
private final class NativeJamendoDirectory: ObservableObject {
    @Published private(set) var tracks: [NativeJamendoTrack] = []
    @Published private(set) var loading = false
    @Published var error: String?
    private let publicClientID = "7e385841"

    func search(_ term: String) async {
        let query = term.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !query.isEmpty else { await browse(genre: nil); return }
        await load(search: query, genre: nil)
    }

    func browse(genre: String?) async {
        await load(search: nil, genre: genre)
    }

    private func load(search: String?, genre: String?) async {
        loading = true
        defer { loading = false }
        do {
            var url = URLComponents(string: "https://api.jamendo.com/v3.0/tracks/")!
            var parameters = [
                URLQueryItem(name: "client_id", value: publicClientID),
                URLQueryItem(name: "format", value: "json"),
                URLQueryItem(name: "limit", value: "30"),
                URLQueryItem(name: "audioformat", value: "mp32")
            ]
            if let search {
                parameters.append(URLQueryItem(name: "search", value: search))
            } else if let genre {
                parameters.append(URLQueryItem(name: "tags", value: genre))
                parameters.append(URLQueryItem(name: "boost", value: "popularity_total"))
            } else {
                parameters.append(URLQueryItem(name: "order", value: "popularity_week"))
            }
            url.queryItems = parameters
            guard let target = url.url else { throw URLError(.badURL) }
            var request = URLRequest(url: target)
            request.timeoutInterval = 15
            let (data, response) = try await URLSession.shared.data(for: request)
            guard (response as? HTTPURLResponse)?.statusCode == 200 else { throw URLError(.badServerResponse) }
            let result = try JSONDecoder().decode(NativeJamendoSearchResult.self, from: data)
            guard result.headers.status == "success" else {
                error = result.headers.errorMessage ?? MusicLocalized.format("Jamendo no pudo completar la búsqueda.")
                tracks = []
                return
            }
            tracks = result.results.filter { $0.streamURL != nil }
            error = tracks.isEmpty ? MusicLocalized.format("No se encontraron canciones disponibles en Jamendo.") : nil
        } catch {
            tracks = []
            self.error = MusicLocalized.format("No se pudo consultar Jamendo. Comprueba la conexión.")
        }
    }
}

@MainActor
final class NativeJamendoPlayer: ObservableObject {
    static let shared = NativeJamendoPlayer()
    var onPlaybackFinished: (() -> Void)?
    @Published private(set) var title = ""
    @Published private(set) var isPlaying = false
    @Published var error: String?
    private var player: AVPlayer?
    private var endObserver: NSObjectProtocol?
    private var remoteTokens: [Any] = []

    @discardableResult
    func playSaved(id: String, queueRequest: Int? = nil) async -> Bool {
        guard id.range(of: #"^[0-9]+$"#, options: .regularExpression) != nil else {
            error = MusicLocalized.format("El identificador guardado de Jamendo no es válido.")
            return false
        }
        guard !Task.isCancelled,
              let playbackRequest = NativeMixedMusicQueue.shared.preparePlaybackRequest(queueRequest) else { return false }
        do {
            var url = URLComponents(string: "https://api.jamendo.com/v3.0/tracks/")!
            url.queryItems = [
                URLQueryItem(name: "client_id", value: "7e385841"),
                URLQueryItem(name: "format", value: "json"),
                URLQueryItem(name: "id", value: id)
            ]
            let (data, response) = try await URLSession.shared.data(from: url.url!)
            guard (response as? HTTPURLResponse)?.statusCode == 200 else { throw URLError(.badServerResponse) }
            let result = try JSONDecoder().decode(NativeJamendoSearchResult.self, from: data)
            guard !Task.isCancelled, NativeMixedMusicQueue.shared.isCurrentPlaybackRequest(playbackRequest) else { return false }
            guard result.headers.status == "success", let track = result.results.first,
                  let streamURL = track.streamURL else {
                error = MusicLocalized.format("Esta canción ya no está disponible en Jamendo. Se conserva en tu lista.")
                return false
            }
            play(name: track.name, artist: track.artistName, url: streamURL, queueRequest: playbackRequest)
            return isPlaying
        } catch {
            guard !Task.isCancelled, NativeMixedMusicQueue.shared.isCurrentPlaybackRequest(playbackRequest) else { return false }
            self.error = MusicLocalized.format("No se pudo recuperar la canción guardada de Jamendo.")
            return false
        }
    }

    func play(name: String, artist: String, url: URL, queueRequest: Int? = nil) {
        guard url.scheme == "https", url.host != nil else {
            error = MusicLocalized.format("La dirección de reproducción de Jamendo no es válida.")
            return
        }
        guard NativeMixedMusicQueue.shared.preparePlaybackRequest(queueRequest) != nil else { return }
        NativeAudiusPlayer.shared.pauseForOtherAudio()
        NativeAppleMusicPlayer.shared.pauseForOtherAudio()
        NativeRadioPlayer.shared.pauseForOtherAudio()
        NativeMusicPlayer.shared.pauseForReader()
        NativeReaderPlaybackBridge.pauseActiveReader?()
        do {
            try AVAudioSession.sharedInstance().setCategory(.playback, mode: .default)
            try AVAudioSession.sharedInstance().setActive(true)
            clearEndObserver()
            player?.pause()
            player = AVPlayer(url: url)
            if let currentItem = player?.currentItem {
                endObserver = NotificationCenter.default.addObserver(
                    forName: .AVPlayerItemDidPlayToEndTime, object: currentItem, queue: .main
                ) { [weak self] notification in
                    Task { @MainActor [weak self] in
                        // A queued notification from an earlier item must not
                        // advance a replacement playlist or reclaim other audio.
                        guard let self, let ended = notification.object as? AVPlayerItem,
                              self.player?.currentItem === ended, self.isPlaying,
                              NativeRemotePlaybackOwner.current == .jamendo else { return }
                        self.isPlaying = false
                        self.onPlaybackFinished?()
                    }
                }
            }
            title = name
            NativeRemotePlaybackOwner.claim(.jamendo)
            registerRemoteCommands()
            player?.play()
            isPlaying = true
            updateNowPlaying()
            error = nil
        } catch { self.error = MusicLocalized.format("No se pudo reproducir Jamendo: %@", error.localizedDescription) }
    }

    func toggle() {
        guard let player else { return }
        if isPlaying {
            player.pause()
            isPlaying = false
        } else {
            NativeAudiusPlayer.shared.pauseForOtherAudio()
            NativeAppleMusicPlayer.shared.pauseForOtherAudio()
            NativeRadioPlayer.shared.pauseForOtherAudio()
            NativeMusicPlayer.shared.pauseForReader()
            NativeReaderPlaybackBridge.pauseActiveReader?()
            NativeRemotePlaybackOwner.claim(.jamendo)
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
        clearEndObserver()
        player?.pause()
        player = nil
        isPlaying = false
        title = ""
        unregisterRemoteCommands()
        NativeRemotePlaybackOwner.release(.jamendo)
    }

    private func clearEndObserver() {
        if let endObserver { NotificationCenter.default.removeObserver(endObserver) }
        endObserver = nil
    }

    private func updateNowPlaying() {
        guard NativeRemotePlaybackOwner.current == .jamendo else { return }
        MPNowPlayingInfoCenter.default().nowPlayingInfo = [
            MPMediaItemPropertyTitle: title,
            MPNowPlayingInfoPropertyPlaybackRate: isPlaying ? 1.0 : 0.0
        ]
    }

    private func registerRemoteCommands() {
        guard remoteTokens.isEmpty else { return }
        UIApplication.shared.beginReceivingRemoteControlEvents()
        let remote = MPRemoteCommandCenter.shared()
        remoteTokens = [
            remote.playCommand.addTarget { [weak self] _ in
                Task { @MainActor [weak self] in
                    guard NativeRemotePlaybackOwner.current == .jamendo, let self, !self.isPlaying else { return }
                    self.toggle()
                }
                return .success
            },
            remote.pauseCommand.addTarget { [weak self] _ in
                Task { @MainActor [weak self] in
                    guard NativeRemotePlaybackOwner.current == .jamendo, let self, self.isPlaying else { return }
                    self.toggle()
                }
                return .success
            },
            remote.togglePlayPauseCommand.addTarget { [weak self] _ in
                Task { @MainActor [weak self] in
                    guard NativeRemotePlaybackOwner.current == .jamendo else { return }
                    self?.toggle()
                }
                return .success
            }
        ]
    }

    private func unregisterRemoteCommands() {
        guard remoteTokens.count == 3 else { return }
        let remote = MPRemoteCommandCenter.shared()
        remote.playCommand.removeTarget(remoteTokens[0])
        remote.pauseCommand.removeTarget(remoteTokens[1])
        remote.togglePlayPauseCommand.removeTarget(remoteTokens[2])
        remoteTokens = []
    }
}

private struct JamendoGenre: Identifiable {
    let id: String
    let title: String
    static let choices = [
        JamendoGenre(id: "rock", title: "Rock"),
        JamendoGenre(id: "pop", title: "Pop"),
        JamendoGenre(id: "jazz", title: "Jazz"),
        JamendoGenre(id: "classical", title: "Clásica"),
        JamendoGenre(id: "electronic", title: "Electrónica"),
        JamendoGenre(id: "folk", title: "Folk"),
        JamendoGenre(id: "ambient", title: "Ambient"),
        JamendoGenre(id: "blues", title: "Blues")
    ]
}

private struct NativeJamendoTrackRows: View {
    let tracks: [NativeJamendoTrack]
    let playlists: [MusicPlaylistDestination]
    let addToPlaylist: NativeMusicAddToPlaylist?
    @ObservedObject private var player = NativeJamendoPlayer.shared

    var body: some View {
        ForEach(tracks) { track in
            if let url = track.streamURL {
                Button("\(track.name), \(track.artistName)") {
                    player.play(name: track.name, artist: track.artistName, url: url)
                }
                .accessibilityActions {
                    Button("Reproducir") {
                        player.play(name: track.name, artist: track.artistName, url: url)
                    }
                    if let addToPlaylist {
                        ForEach(playlists) { playlist in
                            Button(MusicLocalized.format("Añadir a %@", playlist.name)) {
                                addToPlaylist("jamendo", track.id, track.name,
                                    track.artistName, playlist.id)
                            }
                        }
                    }
                }
                NativeMusicPlaylistMenu(playlists: playlists, provider: "jamendo",
                    songID: track.id, title: track.name, artist: track.artistName,
                    addToPlaylist: addToPlaylist)
            }
        }
    }
}

private struct NativeJamendoGenreScreen: View {
    let genre: JamendoGenre
    let playlists: [MusicPlaylistDestination]
    let addToPlaylist: NativeMusicAddToPlaylist?
    @StateObject private var directory = NativeJamendoDirectory()

    var body: some View {
        List {
            if directory.loading { ProgressView("Buscando en Jamendo") }
            NativeJamendoTrackRows(tracks: directory.tracks, playlists: playlists, addToPlaylist: addToPlaylist)
            if let error = directory.error { Text(error) }
        }
        .tifloScreenSurface()
        .navigationTitle(MusicLocalized.message(genre.title))
        .task { await directory.browse(genre: genre.id) }
    }
}

struct NativeJamendoScreen: View {
    var playlists: [MusicPlaylistDestination] = []
    var addToPlaylist: NativeMusicAddToPlaylist? = nil
    @StateObject private var directory = NativeJamendoDirectory()
    @ObservedObject private var player = NativeJamendoPlayer.shared
    @State private var query = ""

    var body: some View {
        List {
            Section("Reproductor Jamendo") {
                Text(player.title.isEmpty ? MusicLocalized.message("Ninguna canción en reproducción") : player.title)
                    .accessibilityAddTraits(.isHeader)
                Button(MusicLocalized.message(player.isPlaying ? "Pausar Jamendo" : "Reanudar Jamendo")) { player.toggle() }
                    .disabled(player.title.isEmpty)
                Button("Detener Jamendo") { player.stop() }
                    .disabled(player.title.isEmpty)
            }
            Section("Selección de canciones") {
                if directory.loading { ProgressView("Buscando en Jamendo") }
                NativeJamendoTrackRows(tracks: directory.tracks, playlists: playlists, addToPlaylist: addToPlaylist)
                if let error = directory.error ?? player.error { Text(error) }
            }
            Section("Explorar por estilos") {
                ForEach(JamendoGenre.choices) { genre in
                    NavigationLink(MusicLocalized.message(genre.title)) {
                        NativeJamendoGenreScreen(genre: genre, playlists: playlists, addToPlaylist: addToPlaylist)
                    }
                }
            }
        }
        .tifloScreenSurface()
        .navigationTitle("Jamendo")
        .searchable(text: $query, prompt: "Buscar en Jamendo")
        .onSubmit(of: .search) { Task { await directory.search(query) } }
        .task { await directory.browse(genre: nil) }
    }
}
