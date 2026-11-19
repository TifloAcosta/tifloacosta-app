import Foundation
import SwiftUI
import AVFoundation

private struct JamendoTrackResponse: Decodable {
    struct Headers: Decodable {
        let status: String
        let errorMessage: String?
        enum CodingKeys: String, CodingKey {
            case status
            case errorMessage = "error_message"
        }
    }
    let headers: Headers
    let results: [JamendoTrack]
}

struct JamendoTrack: Decodable, Identifiable {
    let id: String
    let name: String
    let artistName: String
    let duration: Double?
    let audio: String

    enum CodingKeys: String, CodingKey {
        case id, name, duration, audio
        case artistName = "artist_name"
    }

    var verifiedStreamURL: URL? {
        guard let url = URL(string: audio), url.scheme == "https", url.host != nil else { return nil }
        return url
    }
}

@MainActor
final class NativeJamendoService: ObservableObject {
    // Jamendo v3 identifica las peticiones de lectura mediante un ID público de aplicación.
    private let clientID = "7e385841"
    @Published private(set) var tracks: [JamendoTrack] = []
    @Published private(set) var loading = false
    @Published private(set) var playingName: String?
    @Published var message: String?
    private var player: AVPlayer?

    func search(_ term: String) async {
        let query = term.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !query.isEmpty else { tracks = []; message = nil; return }
        loading = true
        defer { loading = false }
        do {
            var components = URLComponents(string: "https://api.jamendo.com/v3.0/tracks/")!
            components.queryItems = [
                URLQueryItem(name: "client_id", value: clientID),
                URLQueryItem(name: "format", value: "json"),
                URLQueryItem(name: "search", value: query),
                URLQueryItem(name: "limit", value: "20")
            ]
            let (data, response) = try await URLSession.shared.data(from: components.url!)
            guard (response as? HTTPURLResponse)?.statusCode == 200 else {
                tracks = []
                message = MusicLocalized.format("Jamendo no está disponible en este momento.")
                return
            }
            let parsed = try JSONDecoder().decode(JamendoTrackResponse.self, from: data)
            guard parsed.headers.status == "success" else {
                tracks = []
                message = MusicLocalized.format("Jamendo rechazó la consulta: %@", parsed.headers.errorMessage ?? MusicLocalized.format("Error desconocido"))
                return
            }
            tracks = parsed.results.filter { $0.verifiedStreamURL != nil }
            message = tracks.isEmpty ? MusicLocalized.format("No se encontraron canciones reproducibles en Jamendo.") : nil
        } catch {
            tracks = []
            message = MusicLocalized.format("No se pudo consultar Jamendo: %@", error.localizedDescription)
        }
    }

    func play(_ track: JamendoTrack) {
        guard let url = track.verifiedStreamURL else {
            message = MusicLocalized.format("Esta canción no tiene una dirección de reproducción válida.")
            return
        }
        player?.pause()
        player = AVPlayer(url: url)
        player?.play()
        playingName = track.name
        message = MusicLocalized.format("Iniciando %@, de %@, desde Jamendo.", track.name, track.artistName)
    }

    func playSavedTrack(id: String) async {
        guard id.range(of: #"^[0-9]+$"#, options: .regularExpression) != nil else {
            message = MusicLocalized.format("El identificador guardado en Jamendo no es válido.")
            return
        }
        do {
            var components = URLComponents(string: "https://api.jamendo.com/v3.0/tracks/")!
            components.queryItems = [URLQueryItem(name: "client_id", value: clientID),
                                     URLQueryItem(name: "format", value: "json"),
                                     URLQueryItem(name: "id", value: id)]
            let (data, response) = try await URLSession.shared.data(from: components.url!)
            guard (response as? HTTPURLResponse)?.statusCode == 200 else {
                message = MusicLocalized.format("No se pudo recuperar la canción guardada de Jamendo.")
                return
            }
            let result = try JSONDecoder().decode(JamendoTrackResponse.self, from: data)
            guard result.headers.status == "success", let track = result.results.first,
                  track.verifiedStreamURL != nil else {
                message = MusicLocalized.format("Esta canción ya no está disponible en Jamendo.")
                return
            }
            play(track)
        } catch {
            message = MusicLocalized.format("No se pudo abrir la canción guardada: %@", error.localizedDescription)
        }
    }

    func pause() {
        player?.pause()
        playingName = nil
    }
}
