import Foundation
import Combine

struct NativeFollowedPodcast: Codable, Identifiable, Equatable {
    var id: String { url }
    let title: String
    let url: String
}

struct NativePodcastSavedEpisode: Codable, Identifiable {
    let id: String
    let title: String
    let audioURL: String
}

struct NativePodcastPlaybackProgress: Codable, Identifiable {
    let id: String
    var title: String
    var audioURL: String
    var seconds: Double
    var duration: Double
    var updatedAt: Date
}

private final class NativeOPMLReader: NSObject, XMLParserDelegate {
    var results: [NativeFollowedPodcast] = []
    func parser(_ parser: XMLParser, didStartElement elementName: String,
                namespaceURI: String?, qualifiedName qName: String?,
                attributes attributeDict: [String: String] = [:]) {
        guard elementName.lowercased() == "outline",
              let raw = attributeDict["xmlUrl"],
              let url = URL(string: raw),
              url.scheme == "https" || url.scheme == "http",
              url.host != nil, results.count < 500 else { return }
        let title = attributeDict["title"] ?? attributeDict["text"] ?? url.host ?? "Pódcast"
        results.append(.init(title: String(title.prefix(200)), url: url.absoluteString))
    }
}

/// Device-local OPML subscriptions and favorite episodes; never linked to a Google account.
@MainActor
final class NativePodcastLibrary: ObservableObject {
    @Published private(set) var followed: [NativeFollowedPodcast] = []
    @Published private(set) var favorites: Set<String> = []
    @Published private(set) var savedEpisodes: [NativePodcastSavedEpisode] = []
    @Published private(set) var playbackProgress: [NativePodcastPlaybackProgress] = []
    @Published var notice = ""
    private let followedKey = "native-podcast-followed-v1"
    private let favoriteKey = "native-podcast-favorites-v1"
    private let savedKey = "native-podcast-favorite-episodes-v1"
    private let lastSeenKey = "native-podcast-last-seen-v1"
    private let playbackKey = "native-podcast-playback-progress-v1"

    init() {
        if let saved = UserDefaults.standard.data(forKey: followedKey),
           let values = try? JSONDecoder().decode([NativeFollowedPodcast].self, from: saved) {
            followed = values
        }
        favorites = Set(UserDefaults.standard.stringArray(forKey: favoriteKey) ?? [])
        if let data = UserDefaults.standard.data(forKey: savedKey),
           let episodes = try? JSONDecoder().decode([NativePodcastSavedEpisode].self, from: data) {
            savedEpisodes = episodes.filter { favorites.contains($0.id) }
        }
        if let data = UserDefaults.standard.data(forKey: playbackKey),
           let values = try? JSONDecoder().decode([NativePodcastPlaybackProgress].self, from: data) {
            playbackProgress = values.filter {
                $0.seconds.isFinite && $0.duration.isFinite &&
                $0.seconds >= 0 && $0.duration > 0 &&
                URL(string: $0.audioURL)?.scheme?.lowercased() == "https"
            }.sorted { $0.updatedAt > $1.updatedAt }
        }
    }

    func progress(for episode: NativePodcastEpisode) -> Double {
        playbackProgress.first(where: { $0.id == episode.id })?.seconds ?? 0
    }

    func remember(_ episode: NativePodcastEpisode, seconds: Double, duration: Double) {
        guard seconds.isFinite, duration.isFinite, duration > 0 else { return }
        let location = max(0, min(seconds, duration))
        // No reanudar los episodios terminados ni las pulsaciones accidentales.
        playbackProgress.removeAll { $0.id == episode.id }
        if location >= 5 && location < duration - 10 {
            playbackProgress.insert(NativePodcastPlaybackProgress(
                id: episode.id, title: episode.title,
                audioURL: episode.audioURL.absoluteString,
                seconds: location, duration: duration, updatedAt: Date()
            ), at: 0)
        }
        playbackProgress = Array(playbackProgress.prefix(200))
        savePlayback()
    }

    func clearProgress(for episode: NativePodcastEpisode) {
        playbackProgress.removeAll { $0.id == episode.id }
        savePlayback()
    }

    private func savePlayback() {
        if let data = try? JSONEncoder().encode(playbackProgress) {
            UserDefaults.standard.set(data, forKey: playbackKey)
        }
    }

    /// Only reports episodes after the previously encountered newest item.
    /// The first check establishes a baseline rather than announcing old episodes.
    func recordFeedCheck(_ feed: NativeFollowedPodcast, episodes: [NativePodcastEpisode]) -> Int {
        guard let newest = episodes.first?.id else { return 0 }
        var snapshots = UserDefaults.standard.dictionary(forKey: lastSeenKey) as? [String: String] ?? [:]
        let previous = snapshots[feed.url]
        let count: Int
        if let previous, let index = episodes.firstIndex(where: { $0.id == previous }) {
            count = index
        } else {
            count = 0
        }
        snapshots[feed.url] = newest
        UserDefaults.standard.set(snapshots, forKey: lastSeenKey)
        return count
    }

    func isFavorite(_ episode: NativePodcastEpisode) -> Bool {
        favorites.contains(episode.id)
    }

    func toggleFavorite(_ episode: NativePodcastEpisode) {
        if !favorites.insert(episode.id).inserted {
            favorites.remove(episode.id)
            savedEpisodes.removeAll { $0.id == episode.id }
        } else {
            savedEpisodes.removeAll { $0.id == episode.id }
            savedEpisodes.insert(.init(id: episode.id, title: episode.title,
                                      audioURL: episode.audioURL.absoluteString), at: 0)
        }
        UserDefaults.standard.set(favorites.sorted(), forKey: favoriteKey)
        if let data = try? JSONEncoder().encode(savedEpisodes) {
            UserDefaults.standard.set(data, forKey: savedKey)
        }
        notice = favorites.contains(episode.id) ? "Episodio añadido a favoritos." : "Episodio retirado de favoritos."
    }

    func follow(title: String, url: String) {
        guard let parsed = URL(string: url), ["http", "https"].contains(parsed.scheme?.lowercased() ?? ""),
              parsed.host != nil else { return }
        if !followed.contains(where: { $0.url == parsed.absoluteString }) {
            followed.append(NativeFollowedPodcast(title: title, url: parsed.absoluteString))
            save()
        }
    }

    func unfollow(_ item: NativeFollowedPodcast) {
        followed.removeAll { $0.url == item.url }
        save()
        notice = "Suscripción eliminada."
    }

    private func save() {
        if let encoded = try? JSONEncoder().encode(followed) {
            UserDefaults.standard.set(encoded, forKey: followedKey)
        }
    }

    func importOPML(_ url: URL) async throws -> Int {
        // Import on a worker rather than blocking VoiceOver navigation while parsing.
        let items = try await Task.detached(priority: .userInitiated) { () throws -> [NativeFollowedPodcast] in
            let access = url.startAccessingSecurityScopedResource()
            defer { if access { url.stopAccessingSecurityScopedResource() } }
            let handle = try FileHandle(forReadingFrom: url)
            defer { try? handle.close() }
            let data = try handle.read(upToCount: 2_000_001) ?? Data()
            guard data.count <= 2_000_000 else { throw URLError(.dataLengthExceedsMaximum) }
            let delegate = NativeOPMLReader()
            let parser = XMLParser(data: data)
            parser.shouldResolveExternalEntities = false
            parser.delegate = delegate
            guard parser.parse() else { throw URLError(.cannotParseResponse) }
            return delegate.results
        }.value
        let before = followed.count
        for item in items { follow(title: item.title, url: item.url) }
        let added = followed.count - before
        notice = "OPML importado. Nuevas suscripciones: \(added)."
        return added
    }
}
