import SwiftUI
import Foundation
import Combine

struct NativeMoviesForTheBlindWork: Identifiable {
    let id: String
    let title: String
    let parts: [NativePodcastEpisode]
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
            guard let total = values.first?.1, values.allSatisfy({ $0.1 == total }),
                  values.count == total, Set(values.map { $0.0 }) == Set(1...total) else { return nil }
            return Self(id: key, title: titles[key] ?? key, parts: values.sorted { $0.0 < $1.0 }.map { $0.2 })
        }.sorted { $0.title.localizedStandardCompare($1.title) == .orderedAscending }
    }
}

struct NativeMoviesForTheBlindScreen: View {
    @EnvironmentObject private var player: NativePodcastPlayer
    @EnvironmentObject private var library: NativePodcastLibrary
    @State private var works: [NativeMoviesForTheBlindWork] = []
    @State private var search = ""
    @State private var loading = false
    @State private var failed = false
    private let feed = URL(string: "https://media.rss.com/movies-for-the-blind/feed.xml")!
    private var filtered: [NativeMoviesForTheBlindWork] {
        works.filter { search.isEmpty || $0.title.localizedStandardContains(search) }
    }
    var body: some View {
        List {
            if let episode = player.episode, works.contains(where: { $0.parts.contains(where: { $0.id == episode.id }) }) {
                Section("Reproductor") {
                    Text(episode.title)
                    Button(player.isPlaying ? "Pausar" : "Reproducir") { player.toggle() }
                    Button("Retroceder treinta segundos") { player.skip(-30) }
                    Button("Avanzar treinta segundos") { player.skip(30) }
                    Button("Detener reproducción") {
                        player.updatePosition()
                        library.remember(episode, seconds: player.seconds, duration: player.duration)
                        player.stop()
                    }
                }
            }
            if loading { ProgressView("Actualizando catálogo") }
            if failed { Text("No se ha podido actualizar el catálogo.") }
            Button("Actualizar catálogo") { Task { await refresh() } }.disabled(loading)
            ForEach(filtered) { work in
                Section {
                    ForEach(work.parts) { part in
                        Button(part.title) {
                            if let current = player.episode {
                                player.updatePosition()
                                library.remember(current, seconds: player.seconds, duration: player.duration)
                            }
                            let upcoming = work.parts.drop(while: { $0.id != part.id }).dropFirst()
                            player.select(part, at: library.progress(for: part), followedBy: Array(upcoming))
                        }
                    }
                } header: { Text(work.title) }
            }
        }
        .navigationTitle(Text(verbatim: "Movies for the Blind"))
        .searchable(text: $search, prompt: Text("Buscar obras"))
        .task { if works.isEmpty { await refresh() } }
        .onReceive(Timer.publish(every: 1, on: .main, in: .common).autoconnect()) { _ in
            if player.episode != nil { player.updatePosition() }
        }
        .onDisappear {
            if let episode = player.episode {
                library.remember(episode, seconds: player.seconds, duration: player.duration)
            }
        }
    }
    @MainActor private func refresh() async {
        guard !loading else { return }
        loading = true
        failed = false
        defer { loading = false }
        do {
            var request = URLRequest(url: feed)
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
            works = results
        } catch is CancellationError {
            return
        } catch { failed = true }
    }
}
