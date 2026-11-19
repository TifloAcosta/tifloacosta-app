import SwiftUI
import MusicKit

/// MusicKit creates developer tokens automatically once the App ID service is enabled.
/// This screen must not be advertised before that external Apple Developer step.
@MainActor
final class NativeAppleMusicPlayer: ObservableObject {
    static let shared = NativeAppleMusicPlayer()
    @Published private(set) var tracks: [Song] = []
    @Published private(set) var currentTitle = ""
    @Published private(set) var isPlaying = false
    @Published private(set) var authorized = MusicAuthorization.currentStatus == .authorized
    @Published private(set) var canPlayCatalog = false
    @Published var error: String?

    private let player = ApplicationMusicPlayer.shared

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
            error = nil
        } catch {
            isPlaying = false
            self.error = "No se pudo reproducir esta canción con Apple Music."
        }
    }

    func toggle() async {
        if isPlaying {
            player.pause()
            isPlaying = false
        } else {
            NativeMusicPlayer.shared.pauseForReader()
            NativeRadioPlayer.shared.pauseForOtherAudio()
            NativeAudiusPlayer.shared.pauseForOtherAudio()
            NativeReaderPlaybackBridge.pauseActiveReader?()
            do {
                NativeRemotePlaybackOwner.claim(.appleMusic)
                try await player.play()
                isPlaying = true
            } catch { error = "No se pudo reanudar Apple Music." }
        }
    }

    func pauseForOtherAudio() {
        guard isPlaying else { return }
        player.pause()
        isPlaying = false
    }

    func stop() {
        player.pause()
        isPlaying = false
        currentTitle = ""
        NativeRemotePlaybackOwner.release(.appleMusic)
    }
}

struct NativeAppleMusicScreen: View {
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
