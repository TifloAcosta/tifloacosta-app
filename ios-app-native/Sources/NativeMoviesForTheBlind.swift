import SwiftUI
import Foundation
import Combine

struct NativeMoviesForTheBlindWork: Identifiable {
    let id: String
    let title: String
    let parts: [NativePodcastEpisode]
    static func fetchWorks() async throws -> [Self] {
        var request = URLRequest(url: URL(string: "https://media.rss.com/movies-for-the-blind/feed.xml")!)
        request.timeoutInterval = 30
        let (bytes, response) = try await URLSession.shared.bytes(for: request)
        guard let http = response as? HTTPURLResponse, http.statusCode == 200 else { throw URLError(.badServerResponse) }
        var data = Data()
        for try await byte in bytes {
            guard data.count < 4_000_000 else { throw URLError(.dataLengthExceedsMaximum) }
            data.append(byte)
        }
        let delegate = NativeRSSParser()
        let parser = XMLParser(data: data)
        parser.shouldResolveExternalEntities = false
        parser.delegate = delegate
        guard parser.parse() else { throw URLError(.cannotParseResponse) }
        let results = NativeMoviesForTheBlindWork.group(delegate.episodes)
        guard !results.isEmpty else { throw URLError(.cannotParseResponse) }
        return results
    }
    static func group(_ episodes: [NativePodcastEpisode]) -> [Self] {
        var groups: [String: [(Int, Int, NativePodcastEpisode)]] = [:]
        var titles: [String: String] = [:]
        var seen = Set<String>()
        let pattern = try! NSRegularExpression(pattern: #"(?i),?\s+part\s+(\d+)\s+of\s+(\d+)\s*$"#)
        for episode in episodes where seen.insert(episode.id).inserted {
            var title = episode.title.replacingOccurrences(of: #"(?i)^episode\s+\d+\s*:\s*"#, with: "", options: .regularExpression)
            var number = 1
            var total = 1
            if let match = pattern.firstMatch(in: title, range: NSRange(title.startIndex..., in: title)),
               let range = Range(match.range, in: title),
               let part = Range(match.range(at: 1), in: title),
               let count = Range(match.range(at: 2), in: title) {
                guard let n = Int(title[part]), let t = Int(title[count]), n > 0, t >= n, t <= 100 else { continue }
                number = n
                total = t
                title = String(title[..<range.lowerBound])
            }
            title = title.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !title.isEmpty else { continue }
            let key = title.folding(options: [.caseInsensitive, .diacriticInsensitive], locale: Locale(identifier: "en_US"))
            titles[key] = title
            groups[key, default: []].append((number, total, episode))
        }
        return groups.compactMap { key, values -> Self? in
            guard let parts = NativeCinemaRules.orderedParts(values) else { return nil }
            return Self(id: key, title: titles[key] ?? key, parts: parts)
        }.sorted { $0.title.localizedStandardCompare($1.title) == .orderedAscending }
    }
}

struct NativeMoviesForTheBlindScreen: View {
    @ObservedObject private var player = NativeCinemaAudioPlayer.shared
    @ObservedObject private var cinemaLibrary = NativeCinemaLocalLibrary.shared
    @EnvironmentObject private var library: NativePodcastLibrary
    @State private var playbackFailed = false
    @State private var works: [NativeMoviesForTheBlindWork] = []
    @State private var search = ""
    @State private var loading = false
    @State private var failed = false
    init(query: String = "", initialWorks: [NativeMoviesForTheBlindWork] = []) {
        _search = State(initialValue: query)
        _works = State(initialValue: initialWorks)
    }
    private var filtered: [NativeMoviesForTheBlindWork] {
        works.filter { NativeCinemaRules.matches(search, fields: [$0.title]) }
    }
    var body: some View {
        List {
            if player.currentCloudReference?.hasPrefix("movies-for-the-blind:") == true {
                Section("Reproductor") {
                    Text(player.currentTitle)
                    if let error = player.playbackError { Text(error) }
                    NativeCinemaTransportControls(player: player, library: cinemaLibrary)
                }
            }
            if playbackFailed { Text("No se pudo reproducir este archivo. Comprueba que el formato es compatible.") }
            if loading { ProgressView("Actualizando catálogo") }
            if failed { Text("No se ha podido actualizar el catálogo.").accessibilityAddTraits(.updatesFrequently) }
            if !loading && !failed && filtered.isEmpty && !works.isEmpty { Text("No se encontraron obras en los catálogos consultados.") }
            Button("Actualizar catálogo") { Task { await refresh() } }.disabled(loading)
            ForEach(filtered) { work in
                Section {
                    ForEach(work.parts) { part in
                        Button(part.title) {
                            playbackFailed = false
                            let upcoming = work.parts.drop(while: { $0.id != part.id }).dropFirst()
                            do {
                                try player.openMoviePart(part, workTitle: work.title, followedBy: Array(upcoming),
                                    library: cinemaLibrary, previousPosition: library.progress(for: part))
                            } catch { playbackFailed = true }
                        }
                    }
                } header: { Text(work.title).accessibilityAddTraits(.isHeader) }
            }
        }
        .navigationTitle(Text(verbatim: "Movies for the Blind"))
        .searchable(text: $search, prompt: Text("Buscar obras"))
        .task { if works.isEmpty { await refresh() } }
    }
    @MainActor private func refresh() async {
        guard !loading else { return }
        loading = true
        failed = false
        defer { loading = false }
        do {
            works = try await NativeMoviesForTheBlindWork.fetchWorks()
        } catch is CancellationError {
            return
        } catch { failed = true }
    }
}
