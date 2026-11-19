import Foundation
import SwiftUI
import AVFoundation

private struct AudiusSearchResponse: Decodable {
    let data: [AudiusTrack]
}

struct AudiusTrack: Decodable, Identifiable {
    struct Creator: Decodable { let name: String }
    let id: String
    let title: String
    let user: Creator
    let duration: Double?
    let isStreamable: Bool?

    enum CodingKeys: String, CodingKey {
        case id, title, user, duration
        case isStreamable = "is_streamable"
    }
}

@MainActor
final class NativeAudiusService: ObservableObject {
    @Published private(set) var tracks: [AudiusTrack] = []
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
            var components = URLComponents(string: "https://api.audius.co/v1/tracks/search")!
            components.queryItems = [URLQueryItem(name: "query", value: query),
                                     URLQueryItem(name: "limit", value: "20")]
            let (data, response) = try await URLSession.shared.data(from: components.url!)
            guard (response as? HTTPURLResponse)?.statusCode == 200 else {
                message = "Audius no está disponible en este momento."
                tracks = []
                return
            }
            tracks = try JSONDecoder().decode(AudiusSearchResponse.self, from: data).data
            message = tracks.isEmpty ? "No se encontraron canciones en Audius." : nil
        } catch {
            tracks = []
            message = "No se pudo consultar Audius: \(error.localizedDescription)"
        }
    }

    func play(_ track: AudiusTrack) {
        guard track.isStreamable != false else {
            message = "Esta canción no permite reproducción desde Audius."
            return
        }
        guard track.id.range(of: #"^[A-Za-z0-9_-]+$"#, options: .regularExpression) != nil,
              let url = URL(string: "https://api.audius.co/v1/tracks/\(track.id)/stream") else {
            message = "El identificador de la canción no es válido."
            return
        }
        player?.pause()
        player = AVPlayer(url: url)
        player?.play()
        playingName = track.title
        message = "Iniciando \(track.title) desde Audius."
    }

    func pause() {
        player?.pause()
        playingName = nil
    }
}
