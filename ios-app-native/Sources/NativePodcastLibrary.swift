import Foundation
import Combine

struct NativeFollowedPodcast: Codable, Identifiable, Equatable {
    var id: String { url }
    let title: String
    let url: String
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
    @Published var notice = ""
    private let followedKey = "native-podcast-followed-v1"
    private let favoriteKey = "native-podcast-favorites-v1"
    private let lastSeenKey = "native-podcast-last-seen-v1"

    init() {
        if let saved = UserDefaults.standard.data(forKey: followedKey),
           let values = try? JSONDecoder().decode([NativeFollowedPodcast].self, from: saved) {
            followed = values
        }
        favorites = Set(UserDefaults.standard.stringArray(forKey: favoriteKey) ?? [])
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
        if !favorites.insert(episode.id).inserted { favorites.remove(episode.id) }
        UserDefaults.standard.set(favorites.sorted(), forKey: favoriteKey)
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

    func importOPML(_ url: URL) throws -> Int {
        let access = url.startAccessingSecurityScopedResource()
        defer { if access { url.stopAccessingSecurityScopedResource() } }
        let data = try Data(contentsOf: url, options: .mappedIfSafe)
        guard data.count <= 2_000_000 else { throw URLError(.dataLengthExceedsMaximum) }
        let delegate = NativeOPMLReader()
        let parser = XMLParser(data: data)
        parser.shouldResolveExternalEntities = false
        parser.delegate = delegate
        guard parser.parse() else { throw URLError(.cannotParseResponse) }
        let before = followed.count
        for item in delegate.results { follow(title: item.title, url: item.url) }
        let added = followed.count - before
        notice = "OPML importado. Nuevas suscripciones: \\(added)."
        return added
    }
}
