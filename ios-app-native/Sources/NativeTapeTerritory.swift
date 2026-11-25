import SwiftUI
import Foundation

struct NativeTapeTerritoryCatalogue: Decodable {
    struct Film: Decodable, Identifiable {
        struct Version: Decodable {
            let id: String
            let url: URL
        }

        let slug: String
        let title: String
        let year: Int
        let synopsis: String?
        let versions: [Version]
        var id: String { slug }

        var describedStream: URL? {
            guard slug.range(of: #"^[a-z0-9-]+$"#, options: .regularExpression) != nil else { return nil }
            return versions.first {
                $0.id == "described" && $0.url.scheme == "https" &&
                $0.url.host == "tapeterritory.com" && $0.url.port == nil && $0.url.user == nil &&
                $0.url.path == "/apple/\(slug)/described.m3u8"
            }?.url
        }
    }

    let films: [Film]
}

@MainActor
struct NativeTapeTerritoryScreen: View {
    @ObservedObject private var player = NativeCinemaAudioPlayer.shared
    private let library = NativeCinemaLocalLibrary.shared
    @State private var films: [NativeTapeTerritoryCatalogue.Film] = []
    @State private var query = ""
    @State private var failed = false
    @State private var loading = false

    private var matches: [NativeTapeTerritoryCatalogue.Film] {
        let term = query.trimmingCharacters(in: .whitespacesAndNewlines)
        return films.filter {
            term.isEmpty || $0.title.localizedStandardContains(term) || String($0.year).contains(term)
        }
    }

    var body: some View {
        List {
            Link("Audiodescripción de Tape Territory", destination: URL(string: "https://tapeterritory.com/audio-described")!)
            if loading { ProgressView("Cargando catálogo de Tape Territory") }
            if failed {
                Text("No se pudo abrir Tape Territory.").accessibilityAddTraits(.updatesFrequently)
                Button("Reintentar") { Task { await load() } }
            }
            ForEach(matches) { film in
                Section {
                    if let synopsis = film.synopsis, !synopsis.isEmpty { Text(synopsis) }
                    Button("Reproducir: \(film.title)") {
                        guard let url = film.describedStream else { return }
                        do { try player.openTapeTerritory(url, title: film.title, slug: film.slug, library: library) }
                        catch { failed = true }
                    }
                    if player.currentCloudReference == "tape-territory:" + film.slug {
                        if let error = player.playbackError { Text(error).accessibilityAddTraits(.updatesFrequently) }
                        if let video = player.videoPlayer {
                            NativeCinemaVideoSurface(player: video).frame(height: 210).accessibilityHidden(true)
                        }
                        Button(player.playing ? "Pausar reproducción" : "Reanudar reproducción") {
                            player.toggle(library: library)
                        }
                        Button("Retroceder treinta segundos") { player.seek(by: -30, library: library) }
                        Button("Avanzar treinta segundos") { player.seek(by: 30, library: library) }
                        Button("Detener reproducción") { player.pauseAndSave(library: library) }
                    }
                } header: {
                    Text("\(film.title) (\(String(film.year)))")
                }
            }
        }
        .navigationTitle(Text(verbatim: "Tape Territory"))
        .searchable(text: $query, prompt: "Buscar plataformas y contenidos audiodescritos")
        .task { await load() }
        .refreshable { await load() }
    }

    private func load() async {
        guard !loading else { return }
        loading = true
        defer { loading = false }
        do {
            let endpoint = URL(string: "https://tapeterritory.com/api/apple/catalog")!
            let (data, response) = try await URLSession.shared.data(from: endpoint)
            guard (response as? HTTPURLResponse)?.statusCode == 200,
                  response.url?.host == endpoint.host, data.count < 1_000_000 else {
                throw URLError(.badServerResponse)
            }
            let catalogue = try JSONDecoder().decode(NativeTapeTerritoryCatalogue.self, from: data)
            try Task.checkCancellation()
            var seen: Set<String> = []
            let described = catalogue.films.filter {
                $0.describedStream != nil && !$0.title.isEmpty && seen.insert($0.id).inserted
            }
            guard !described.isEmpty else { throw URLError(.cannotParseResponse) }
            films = described
            failed = false
        } catch {
            if !Task.isCancelled { failed = true }
        }
    }
}
