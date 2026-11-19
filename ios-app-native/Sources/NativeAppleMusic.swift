import SwiftUI
import MusicKit

/// MusicKit creates developer tokens automatically once the App ID service is enabled.
/// This screen must not be advertised before that external Apple Developer step.
@MainActor
final class NativeAppleMusicPlayer: ObservableObject {
    static let shared = NativeAppleMusicPlayer()
    var onPlaybackFinished: (() -> Void)?
    @Published private(set) var tracks: [Song] = []
    @Published private(set) var currentTitle = ""
    @Published private(set) var isPlaying = false
    @Published private(set) var authorized = MusicAuthorization.currentStatus == .authorized
    @Published private(set) var canPlayCatalog = false
    @Published var error: String?

    private let player = ApplicationMusicPlayer.shared
    private var completionTimer: Timer?
    private var observedPlaying = false

    private func watchNaturalCompletion() {
        completionTimer?.invalidate()
        observedPlaying = false
        guard onPlaybackFinished != nil else { return }
        completionTimer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self] timer in
            Task { @MainActor [weak self] in
                guard let self else { timer.invalidate(); return }
                if self.player.state.playbackStatus == .playing { self.observedPlaying = true }
                if self.observedPlaying && self.player.state.playbackStatus == .stopped {
                    timer.invalidate()
                    self.completionTimer = nil
                    self.isPlaying = false
                    self.onPlaybackFinished?()
                }
            }
        }
    }

    func connect() async {
        let status = await MusicAuthorization.request()
        authorized = status == .authorized
        guard authorized else {
            error = "Apple Music no tiene permiso para acceder a tu biblioteca. Puedes autorizarlo en Ajustes del iPhone."
            return
        }
        do {
            let subscription = try await MusicSubscription.current
            canPlayCatalog = subscription.canPlayCatalogContent
            error = canPlayCatalog ? nil :
                "El catálogo de Apple Music requiere una suscripción compatible. Tus canciones importadas siguen disponibles en Mi Música."
        } catch {
            canPlayCatalog = false
            self.error = "No se pudo comprobar el acceso a Apple Music."
        }
    }

    func search(_ term: String) async {
        guard authorized, canPlayCatalog else {
            error = "Para buscar en el catálogo necesitas autorizar Apple Music y disponer de acceso al catálogo."
            return
        }
        let text = term.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { tracks = []; return }
        do {
            var request = MusicCatalogSearchRequest(term: text, types: [Song.self])
            request.limit = 25
            let result = try await request.response()
            tracks = Array(result.songs)
            error = nil
        } catch {
            tracks = []
            self.error = "No se pudo buscar música en el catálogo de Apple."
        }
    }

    func play(_ song: Song) async {
        guard authorized, canPlayCatalog else { return }
        NativeJamendoPlayer.shared.pauseForOtherAudio()
        NativeMusicPlayer.shared.pauseForReader()
        NativeRadioPlayer.shared.pauseForOtherAudio()
        NativeAudiusPlayer.shared.pauseForOtherAudio()
        NativeReaderPlaybackBridge.pauseActiveReader?()
        do {
            player.queue = [song]
            NativeRemotePlaybackOwner.claim(.appleMusic)
            try await player.play()
            currentTitle = song.title
            isPlaying = true
            watchNaturalCompletion()
            error = nil
        } catch {
            isPlaying = false
            self.error = "No se pudo reproducir esta canción con Apple Music."
        }
    }

    func playSaved(id: String, title: String) async {
        guard !id.isEmpty else {
            error = MusicLocalized.format("La referencia guardada de Apple Music no es válida.")
            return
        }
        if !authorized || !canPlayCatalog {
            await connect()
            guard authorized, canPlayCatalog else { return }
        }
        do {
            var request = MusicCatalogSearchRequest(term: title, types: [Song.self])
            request.limit = 25
            let result = try await request.response()
            guard let song = result.songs.first(where: { $0.id.rawValue == id }) else {
                error = MusicLocalized.format("Esta canción ya no está disponible en Apple Music. Se conserva en tu lista.")
                return
            }
            await play(song)
        } catch {
            self.error = MusicLocalized.format("No se pudo recuperar la canción guardada de Apple Music.")
        }
    }

    func toggle() async {
        if isPlaying {
            player.pause()
            isPlaying = false
        } else {
            NativeJamendoPlayer.shared.pauseForOtherAudio()
            NativeMusicPlayer.shared.pauseForReader()
            NativeRadioPlayer.shared.pauseForOtherAudio()
            NativeAudiusPlayer.shared.pauseForOtherAudio()
            NativeReaderPlaybackBridge.pauseActiveReader?()
            do {
                NativeRemotePlaybackOwner.claim(.appleMusic)
                try await player.play()
                isPlaying = true
                watchNaturalCompletion()
            } catch { self.error = "No se pudo reanudar Apple Music." }
        }
    }

    func pauseForOtherAudio() {
        guard isPlaying else { return }
        completionTimer?.invalidate()
        completionTimer = nil
        player.pause()
        isPlaying = false
    }

    func stop() {
        completionTimer?.invalidate()
        completionTimer = nil
        player.pause()
        isPlaying = false
        currentTitle = ""
        NativeRemotePlaybackOwner.release(.appleMusic)
    }
}

struct NativeAppleMusicScreen: View {
    var playlists: [MusicPlaylistDestination] = []
    var addToPlaylist: NativeMusicAddToPlaylist? = nil
    @ObservedObject private var music = NativeAppleMusicPlayer.shared
    @State private var query = ""

    var body: some View {
        List {
            Section("Conexión") {
                Button(music.authorized ? "Comprobar acceso a Apple Music" : "Autorizar Apple Music") {
                    Task { await music.connect() }
                }
            }
            if music.authorized {
                Section("Reproductor") {
                    Text(music.currentTitle.isEmpty ? "Ninguna canción" : music.currentTitle)
                    Button(music.isPlaying ? "Pausar" : "Reanudar") {
                        Task { await music.toggle() }
                    }
                    .disabled(music.currentTitle.isEmpty)
                    Button("Detener") { music.stop() }
                    .disabled(music.currentTitle.isEmpty)
                }
                if music.canPlayCatalog {
                    Section("Resultados") {
                        ForEach(music.tracks) { song in
                            Button("Escuchar \(song.title), \(song.artistName)") {
                                Task { await music.play(song) }
                            }
                            NativeMusicPlaylistMenu(playlists: playlists, provider: "appleMusic",
                                songID: song.id.rawValue, title: song.title,
                                artist: song.artistName, addToPlaylist: addToPlaylist)
                        }
                    }
                }
            }
            if let error = music.error { Text(error) }
        }
        .navigationTitle("Apple Music")
        .searchable(text: $query, prompt: "Buscar canciones o artistas")
        .onSubmit(of: .search) { Task { await music.search(query) } }
    }
}
