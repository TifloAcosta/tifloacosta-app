import Foundation
import MusicKit

/// Integración nativa: Apple administra los tokens; ninguna clave privada viaja en la app.
@MainActor
final class NativeAppleMusicService: ObservableObject {
    @Published private(set) var authorizationStatus = MusicAuthorization.currentStatus
    @Published private(set) var subscriptionAvailable = false
    @Published private(set) var songs: [Song] = []
    @Published private(set) var albums: [Album] = []
    @Published private(set) var artists: [Artist] = []
    @Published var message: String?
    @Published var isLoading = false

    var isAuthorized: Bool { authorizationStatus == .authorized }

    func requestAuthorization() async {
        authorizationStatus = await MusicAuthorization.request()
        guard authorizationStatus == .authorized else {
            message = MusicLocalized.format("No se ha autorizado Apple Music. Tu música personal sigue disponible.")
            return
        }
        await refreshSubscription()
    }

    func refreshSubscription() async {
        guard authorizationStatus == .authorized else {
            subscriptionAvailable = false
            return
        }
        do {
            let subscription = try await MusicSubscription.current
            subscriptionAvailable = subscription.canPlayCatalogContent
            if !subscriptionAvailable {
                message = MusicLocalized.format("Tu cuenta no tiene reproducción del catálogo de Apple Music disponible.")
            }
        } catch {
            subscriptionAvailable = false
            message = MusicLocalized.format("No se pudo comprobar la suscripción: %@", error.localizedDescription)
        }
    }

    func searchCatalog(query: String) async {
        let term = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard authorizationStatus == .authorized else {
            message = MusicLocalized.format("Conecta Apple Music antes de buscar en su catálogo.")
            return
        }
        guard !term.isEmpty else {
            songs = []; albums = []; artists = []
            return
        }
        isLoading = true
        defer { isLoading = false }
        do {
            var request = MusicCatalogSearchRequest(term: term, types: [Song.self, Album.self, Artist.self])
            request.limit = 20
            let response = try await request.response()
            songs = Array(response.songs)
            albums = Array(response.albums)
            artists = Array(response.artists)
            message = songs.isEmpty && albums.isEmpty && artists.isEmpty ? MusicLocalized.format("No se encontraron resultados en Apple Music.") : nil
        } catch {
            message = MusicLocalized.format("No se pudo buscar en Apple Music. Comprueba la conexión: %@", error.localizedDescription)
        }
    }

    func playCatalogSong(_ song: Song) async {
        guard authorizationStatus == .authorized else {
            message = MusicLocalized.format("Debes autorizar Apple Music para reproducir esta canción.")
            return
        }
        await refreshSubscription()
        guard subscriptionAvailable else {
            message = MusicLocalized.format("La reproducción requiere una suscripción de Apple Music compatible.")
            return
        }
        do {
            let musicPlayer = ApplicationMusicPlayer.shared
            musicPlayer.queue = [song]
            try await musicPlayer.play()
            message = nil
        } catch {
            message = MusicLocalized.format("No se pudo reproducir la canción: %@", error.localizedDescription)
        }
    }

    func playSavedCatalogSong(id: String, title: String) async {
        guard authorizationStatus == .authorized else {
            message = MusicLocalized.format("Conecta Apple Music para reproducir esta canción guardada.")
            return
        }
        guard !id.isEmpty else {
            message = MusicLocalized.format("La referencia de esta canción no es válida.")
            return
        }
        do {
            var request = MusicCatalogSearchRequest(term: title, types: [Song.self])
            request.limit = 25
            let response = try await request.response()
            guard let song = response.songs.first(where: { $0.id.rawValue == id }) else {
                message = MusicLocalized.format("Esta canción ya no está disponible en el catálogo consultado. Se conserva en tu lista.")
                return
            }
            await playCatalogSong(song)
        } catch {
            message = MusicLocalized.format("No se pudo recuperar esta canción de Apple Music: %@", error.localizedDescription)
        }
    }

    func pause() async {
        ApplicationMusicPlayer.shared.pause()
    }
}
