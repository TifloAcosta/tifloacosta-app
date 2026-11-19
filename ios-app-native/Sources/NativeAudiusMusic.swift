import SwiftUI
import AVFoundation
import MediaPlayer
import UIKit

private struct NativeAudiusTrack: Decodable, Identifiable {
    struct Artist: Decodable { let name: String }
    struct Access: Decodable { let stream: Bool? }
    let id: String
    let title: String
    let user: Artist?
    let access: Access?

    var canStream: Bool { access?.stream ?? true }
}

private struct NativeAudiusResult: Decodable { let data: [NativeAudiusTrack] }

@MainActor
private final class NativeAudiusDirectory: ObservableObject {
    @Published private(set) var tracks: [NativeAudiusTrack] = []
    @Published private(set) var loading = false
    @Published var error: String?

    func search(_ query: String) async {
        loading = true
        defer { loading = false }
        var url = URLComponents()
        url.scheme = "https"
        url.host = "api.audius.co"
        let term = query.trimmingCharacters(in: .whitespacesAndNewlines)
        url.path = term.isEmpty ? "/v1/tracks/trending" : "/v1/tracks/search"
        url.queryItems = [
            URLQueryItem(name: "app_name", value: "TifloAcosta"),
            URLQueryItem(name: "limit", value: "30")
        ]
        if !term.isEmpty { url.queryItems?.append(URLQueryItem(name: "query", value: term)) }
        guard let target = url.url else { error = "No se pudo preparar la búsqueda."; return }
        do {
            var request = URLRequest(url: target)
            request.timeoutInterval = 15
            let (data, response) = try await URLSession.shared.data(for: request)
            guard (response as? HTTPURLResponse)?.statusCode == 200 else {
                throw URLError(.badServerResponse)
            }
            tracks = try JSONDecoder().decode(NativeAudiusResult.self, from: data).data.filter(\.canStream)
            error = nil
        } catch {
            tracks = []
            self.error = "No se pudo consultar Audius. Comprueba la conexión e inténtalo de nuevo."
        }
    }
}

/// Audius content stays on the provider's servers and never enters local backups.
@MainActor
final class NativeAudiusPlayer: ObservableObject {
    static let shared = NativeAudiusPlayer()
    var onPlaybackFinished: (() -> Void)?
    @Published private(set) var title = ""
    @Published private(set) var isPlaying = false
    @Published var error: String?
    private var player: AVPlayer?
    private var endObserver: NSObjectProtocol?
    private var remoteTokens: [Any] = []

    func play(id: String, title: String) {
        guard id.range(of: #"^[A-Za-z0-9_-]+$"#, options: .regularExpression) != nil else {
            error = "Esta pista no tiene un identificador compatible."
            return
        }
        var url = URLComponents()
        url.scheme = "https"
        url.host = "api.audius.co"
        url.path = "/v1/tracks/\(id)/stream"
        url.queryItems = [URLQueryItem(name: "app_name", value: "TifloAcosta")]
        guard let target = url.url else { return }
        NativeJamendoPlayer.shared.pauseForOtherAudio()
        NativeAppleMusicPlayer.shared.pauseForOtherAudio()
        NativeRadioPlayer.shared.pauseForOtherAudio()
        NativeMusicPlayer.shared.pauseForReader()
        NativeReaderPlaybackBridge.pauseActiveReader?()
        do {
            try AVAudioSession.sharedInstance().setCategory(.playback, mode: .default)
            try AVAudioSession.sharedInstance().setActive(true)
            clearEndObserver()
            player?.pause()
            player = AVPlayer(url: target)
            if let currentItem = player?.currentItem {
                endObserver = NotificationCenter.default.addObserver(
                    forName: .AVPlayerItemDidPlayToEndTime, object: currentItem, queue: .main
                ) { [weak self] _ in
                    Task { @MainActor [weak self] in
                        self?.isPlaying = false
                        self?.onPlaybackFinished?()
                    }
                }
            }
            self.title = title
            NativeRemotePlaybackOwner.claim(.audius)
            registerRemoteCommands()
            player?.play()
            isPlaying = true
            updateNowPlaying()
            error = nil
        } catch { self.error = "No se pudo iniciar la canción: \(error.localizedDescription)" }
    }

    func toggle() {
        guard let player else { return }
        if isPlaying {
            player.pause()
            isPlaying = false
        } else {
            NativeJamendoPlayer.shared.pauseForOtherAudio()
            NativeAppleMusicPlayer.shared.pauseForOtherAudio()
            NativeRadioPlayer.shared.pauseForOtherAudio()
            NativeMusicPlayer.shared.pauseForReader()
            NativeReaderPlaybackBridge.pauseActiveReader?()
            NativeRemotePlaybackOwner.claim(.audius)
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
        NativeRemotePlaybackOwner.release(.audius)
    }

    private func clearEndObserver() {
        if let endObserver { NotificationCenter.default.removeObserver(endObserver) }
        endObserver = nil
    }

    private func updateNowPlaying() {
        guard NativeRemotePlaybackOwner.current == .audius else { return }
        MPNowPlayingInfoCenter.default().nowPlayingInfo = [
            MPMediaItemPropertyTitle: title,
            MPNowPlayingInfoPropertyPlaybackRate: isPlaying ? 1.0 : 0.0
        ]
    }

    private func registerRemoteCommands() {
        guard remoteTokens.isEmpty else { return }
        UIApplication.shared.beginReceivingRemoteControlEvents()
        let remote = MPRemoteCommandCenter.shared()
        remote.playCommand.isEnabled = true
        remote.pauseCommand.isEnabled = true
        remote.togglePlayPauseCommand.isEnabled = true
        remoteTokens = [
            remote.playCommand.addTarget { [weak self] _ in
                Task { @MainActor [weak self] in
                    guard NativeRemotePlaybackOwner.current == .audius, let self, !self.isPlaying else { return }
                    self.toggle()
                }
                return .success
            },
            remote.pauseCommand.addTarget { [weak self] _ in
                Task { @MainActor [weak self] in
                    guard NativeRemotePlaybackOwner.current == .audius, let self, self.isPlaying else { return }
                    self.toggle()
                }
                return .success
            },
            remote.togglePlayPauseCommand.addTarget { [weak self] _ in
                Task { @MainActor [weak self] in
                    guard NativeRemotePlaybackOwner.current == .audius else { return }
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

struct NativeAudiusScreen: View {
    var playlists: [MusicPlaylistDestination] = []
    var addToPlaylist: NativeMusicAddToPlaylist? = nil
    @StateObject private var directory = NativeAudiusDirectory()
    @ObservedObject private var player = NativeAudiusPlayer.shared
    @State private var query = ""

    var body: some View {
        List {
            Section("Reproductor Audius") {
                Text(player.title.isEmpty ? "Ninguna canción" : player.title)
                Button(player.isPlaying ? "Pausar" : "Reanudar") { player.toggle() }
                    .disabled(player.title.isEmpty)
                Button("Detener") { player.stop() }
                    .disabled(player.title.isEmpty)
            }
            Section("Canciones") {
                if directory.loading { ProgressView("Buscando canciones") }
                ForEach(directory.tracks) { track in
                    Button("Escuchar \(track.title), \(track.user?.name ?? "Audius")") {
                        player.play(id: track.id, title: track.title)
                    }
                    NativeMusicPlaylistMenu(playlists: playlists, provider: "audius", songID: track.id,
                        title: track.title, artist: track.user?.name ?? "Audius", addToPlaylist: addToPlaylist)
                }
            }
            if let message = directory.error ?? player.error { Text(message) }
        }
        .navigationTitle("Audius: música gratuita")
        .searchable(text: $query, prompt: "Buscar canciones o artistas")
        .onSubmit(of: .search) { Task { await directory.search(query) } }
        .task { await directory.search("") }
    }
}
