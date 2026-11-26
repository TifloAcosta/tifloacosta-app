import Foundation

/// A conservative export policy for URL-bearing records. A syntactically
/// eligible URL is not proof of public access: a later review must let users
/// exclude private feeds. Never export userinfo or query/fragment credentials.
enum NativeBackupReferencePolicy {
    static func eligible(_ value: String) -> Bool {
        guard let url = URLComponents(string: value),
              ["http", "https"].contains(url.scheme?.lowercased() ?? ""),
              let host = url.host, !host.isEmpty,
              url.user == nil, url.password == nil,
              url.percentEncodedQuery == nil, url.percentEncodedFragment == nil else { return false }
        let components = url.path.lowercased().split(separator: "/")
        let sensitive = ["token", "auth", "secret", "apikey", "api-key", "password", "private", "signed"]
        return !components.contains { component in sensitive.contains { component.contains($0) } }
    }

    static func eligibleID(_ value: String) -> Bool {
        guard !value.isEmpty, value.utf8.count <= 4096 else { return false }
        if value.contains("://") { return eligible(value) }
        return !value.contains("?") && !value.contains("#")
    }
}

struct NativePodcastBackupSnapshot: Codable {
    let schemaVersion: Int
    let followed: [NativeFollowedPodcast]
    let favorites: Set<String>
    let savedEpisodes: [NativePodcastSavedEpisode]
    let playbackProgress: [NativePodcastPlaybackProgress]
    /// Downloads are reproducible references only, not copies of provider media.
    let previouslyDownloaded: [NativeDownloadedPodcastEpisode]
    let excludedReferences: Int

    @MainActor
    static func capture(library: NativePodcastLibrary, downloads: NativePodcastDownloads) -> Self {
        let eligible = NativeBackupReferencePolicy.eligible
        let eligibleID = NativeBackupReferencePolicy.eligibleID
        let followed = library.followed.filter { eligible($0.url) }
        let saved = library.savedEpisodes.filter { eligible($0.audioURL) && eligibleID($0.id) }
        let savedIDs = Set(saved.map(\.id))
        let rejectedIDs = Set(library.savedEpisodes.map(\.id)).subtracting(savedIDs)
        let favorites = library.favorites.filter { eligibleID($0) && !rejectedIDs.contains($0) }
        let progress = library.playbackProgress.filter {
            eligible($0.audioURL) && eligibleID($0.id) && $0.seconds.isFinite &&
            $0.duration.isFinite && $0.seconds >= 0 && $0.duration > 0
        }
        let previous = downloads.entries.filter { eligible($0.sourceURL) && eligibleID($0.id) }
        let excluded = library.followed.count - followed.count
            + library.savedEpisodes.count - saved.count
            + library.favorites.count - favorites.count
            + library.playbackProgress.count - progress.count
            + downloads.entries.count - previous.count
        return Self(schemaVersion: 1, followed: followed, favorites: favorites,
                    savedEpisodes: saved, playbackProgress: progress,
                    previouslyDownloaded: previous, excludedReferences: excluded)
    }
}

/// Typed allowlist: no dictionaryRepresentation, account records, access
/// tokens, bookmarks for external folders, validation flags or arbitrary keys.
struct NativeBackupPreferencesSnapshot: Codable {
    let schemaVersion: Int
    let integers: [String: Int]
    let booleans: [String: Bool]
    let numbers: [String: Double]
    let strings: [String: String]
    let favorites: Set<NativeFavoriteKey>
    let savedForLater: Set<NativeFavoriteKey>
    let recentlyRead: [NativeFavoriteKey]
    let youtubeVideos: [NativeSavedYouTubeVideo]
    let youtubeChannels: [NativeSavedYouTubeChannel]

    static let integerKeys = [
        "native-ios-language", "native-ios-color-scheme", "native-ios-text-size",
        "native-ios-line-spacing", "native-reading-folder-entry-mode",
        "native-reading-filter", "native-reading-sort", "native-reading-speed-index",
        "native-reading-pitch-index", "native-voiceover-library-detail-index",
        "native-reading-line-spacing-index", "native-reader-navigation-unit",
        "native-reader-reading-mode", "native-reader-presentation-mode",
        "native-reader-reading-engine", "native-reader-ocr-accuracy-index",
        "native-reader-ocr-language-index", "native-cinema-collection-language-index-v1",
        "native-cinema-collection-content-index-v1", "native-cinema-language-index-v1",
        "native-cinema-content-index-v1", "native-cinema-import-language-index-v1",
        "native-cinema-import-kind-index-v1"
    ]
    static let booleanKeys = [
        "native-ios-strong-text", "native-reading-strong-text",
        "native-reader-braille-initial-text-focus", "native-podcast-continuous-playback",
        "music.cellularPlayback", "music.cellularDownloads", "music.detailedVoiceOver"
    ]
    static let numberKeys = ["native-reading-text-size"]
    static let stringKeys = [
        "native-reading-folder-filter", "native-reading-voice-id",
        "native-reader-gemini-voice", "native-reader-phonon-voice"
    ]

    @MainActor
    static func capture(favorites: NativeFavoritesStore, activity: NativeReadingActivity,
                        defaults: UserDefaults = .standard) -> Self {
        let integers = Dictionary(uniqueKeysWithValues: integerKeys.compactMap { key -> (String, Int)? in
            defaults.object(forKey: key) == nil ? nil : (key, defaults.integer(forKey: key))
        })
        let booleans = Dictionary(uniqueKeysWithValues: booleanKeys.compactMap { key -> (String, Bool)? in
            defaults.object(forKey: key) == nil ? nil : (key, defaults.bool(forKey: key))
        })
        let numbers = Dictionary(uniqueKeysWithValues: numberKeys.compactMap { key -> (String, Double)? in
            guard defaults.object(forKey: key) != nil else { return nil }
            let value = defaults.double(forKey: key)
            return value.isFinite ? (key, value) : nil
        })
        let strings = Dictionary(uniqueKeysWithValues: stringKeys.compactMap { key -> (String, String)? in
            guard let value = defaults.string(forKey: key), value.utf8.count <= 4096 else { return nil }
            return (key, value)
        })
        let youtube = NativeYouTubePersonalLibrary.shared
        return Self(schemaVersion: 1, integers: integers, booleans: booleans, numbers: numbers,
                    strings: strings, favorites: favorites.keys, savedForLater: activity.savedForLater,
                    recentlyRead: activity.recentlyRead, youtubeVideos: youtube.videos,
                    youtubeChannels: youtube.followedChannels)
    }
}

enum NativeBackupMetadataArchive {
    /// Metadata-only sections are bounded and use the same verified ZIP path.
    static func create<T: Encodable>(_ snapshot: T) async throws -> URL {
        let bytes = try JSONEncoder().encode(snapshot)
        let worker = Task.detached(priority: .utility) {
            return try NativeBackupSectionArchive.create(metadata: ["snapshot.json": bytes],
                files: [], maxBytes: 32_000_000, maxEntries: 1)
        }
        let archive = try await withTaskCancellationHandler {
            try await worker.value
        } onCancel: { worker.cancel() }
        if Task.isCancelled {
            try? FileManager.default.removeItem(at: archive.deletingLastPathComponent())
            throw CancellationError()
        }
        return archive
    }
}
