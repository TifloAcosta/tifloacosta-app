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
    let voiceProfiles: [String: NativeReaderVoiceProfile]

    static let integerKeys = [
        "native-ios-language", "native-ios-color-scheme", "native-ios-text-size",
        "native-ios-line-spacing", "native-reading-folder-entry-mode",
        "native-reading-filter", "native-reading-sort", "native-reading-speed-index",
        "native-reading-pitch-index", "native-voiceover-library-detail-index",
        "native-reading-line-spacing-index", "native-reader-navigation-unit",
        "native-reader-reading-mode", "native-reader-presentation-mode",
        "native-reader-reading-engine", "native-reading-pause-style", "native-reader-ocr-accuracy-index",
        "native-reader-ocr-language-index", "native-cinema-collection-language-index-v1",
        "native-cinema-collection-content-index-v1", "native-cinema-language-index-v1",
        "native-cinema-content-index-v1", "native-cinema-import-language-index-v1",
        "native-cinema-import-kind-index-v1"
    ]
    static let booleanKeys = [
        "native-ios-strong-text", "native-reading-strong-text",
        "native-reader-braille-initial-text-focus", "native-podcast-continuous-playback",
        "music.cellularPlayback", "music.cellularDownloads", "music.detailedVoiceOver", "mi-musica-shuffle"
    ]
    static let numberKeys = ["native-reading-text-size", "native-reading-pause-comma", "native-reading-pause-semicolon", "native-reading-pause-colon", "native-reading-pause-sentence", "native-reading-pause-paragraph"]
    static let stringKeys = [
        "native-reading-folder-filter", "native-reading-voice-id",
        "native-reader-gemini-voice", "native-reader-phonon-voice", "mi-musica-repeat"
    ]

    @MainActor
    static func capture(favorites: NativeFavoritesStore, activity: NativeReadingActivity,
                        defaults: UserDefaults = .standard) throws -> Self {
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
                    youtubeChannels: youtube.followedChannels,
                    voiceProfiles: try NativeReaderVoiceProfileStore.backupProfiles(defaults: defaults))
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

/// Decode metadata-only archives before any live store changes. This does
/// not confer permission to access remote URLs or apply preferences.
enum NativeBackupPersonalDataValidation {
    enum Failure: Error { case invalidSnapshot }

    /// Validate stored values using the actual choices in the current app.
    /// Unsupported or device-dependent identifiers remain explicit omissions.
    static func validSpeed(_ value: Int) -> Bool {
        (0...4).contains(value) || (100..<(100 + NativeReaderSpeedOptions.rates.count)).contains(value)
    }

    static func validVoiceProfile(_ value: NativeReaderVoiceProfile) -> Bool {
        validSpeed(value.speedIndex) && (0...4).contains(value.pitchIndex) &&
        (0...3).contains(value.pauseStyle) && value.pauseSeconds.count == 5 &&
        value.pauseSeconds.allSatisfy { $0.isFinite && (0...1.5).contains($0) } &&
        (value.volume.map { $0.isFinite && (0...1).contains($0) } ?? true)
    }

    static func validInteger(_ key: String, _ value: Int) -> Bool {
        switch key {
        case "native-ios-language": return NativeAppLanguage.codes.indices.contains(value)
        case "native-ios-color-scheme", "native-ios-line-spacing",
             "native-voiceover-library-detail-index", "native-reading-line-spacing-index",
             "native-reader-presentation-mode": return (0...2).contains(value)
        case "native-ios-text-size", "native-reading-pause-style": return (0...3).contains(value)
        case "native-reading-folder-entry-mode", "native-reader-reading-mode",
             "native-reader-ocr-accuracy-index": return (0...1).contains(value)
        case "native-reading-filter": return (0...10).contains(value)
        case "native-reading-sort": return (0...5).contains(value)
        case "native-reading-speed-index": return validSpeed(value)
        case "native-reading-pitch-index", "native-reader-navigation-unit": return (0...4).contains(value)
        case "native-reader-ocr-language-index": return (0...7).contains(value)
        case "native-cinema-collection-language-index-v1", "native-cinema-language-index-v1":
            return AccessibleCinemaLanguage.allCases.indices.contains(value)
        case "native-cinema-collection-content-index-v1", "native-cinema-content-index-v1":
            return AccessibleCinemaKind.allCases.indices.contains(value)
        case "native-cinema-import-language-index-v1":
            return value > 0 && AccessibleCinemaLanguage.allCases.indices.contains(value)
        case "native-cinema-import-kind-index-v1":
            return value > 0 && AccessibleCinemaKind.allCases.indices.contains(value)
        default: return false
        }
    }

    static func validNumber(_ key: String, _ value: Double) -> Bool {
        guard value.isFinite else { return false }
        if key == "native-reading-text-size" { return (14...40).contains(value) }
        return NativeBackupPreferencesSnapshot.numberKeys.contains(key) && (0...1.5).contains(value)
    }
    static func validate(section: NativeBackupManifest.Section, data: Data) throws {
        let decoder = JSONDecoder()
        let eligible = NativeBackupReferencePolicy.eligible
        let eligibleID = NativeBackupReferencePolicy.eligibleID
        switch section {
        case .podcasts:
            let value = try decoder.decode(NativePodcastBackupSnapshot.self, from: data)
            guard value.schemaVersion == 1, value.excludedReferences >= 0,
                  Set(value.followed.map(\.url)).count == value.followed.count,
                  Set(value.savedEpisodes.map(\.id)).count == value.savedEpisodes.count,
                  Set(value.playbackProgress.map(\.id)).count == value.playbackProgress.count,
                  Set(value.previouslyDownloaded.map(\.id)).count == value.previouslyDownloaded.count,
                  value.followed.allSatisfy({ eligible($0.url) }),
                  value.favorites.allSatisfy(eligibleID),
                  value.savedEpisodes.allSatisfy({ eligibleID($0.id) && eligible($0.audioURL) }),
                  value.playbackProgress.allSatisfy({
                      eligibleID($0.id) && eligible($0.audioURL) &&
                      $0.seconds.isFinite && $0.duration.isFinite &&
                      $0.seconds >= 0 && $0.duration > 0
                  }),
                  value.previouslyDownloaded.allSatisfy({
                      eligibleID($0.id) && eligible($0.sourceURL)
                  }) else { throw Failure.invalidSnapshot }
            // Download references are not actual locally downloaded audio.
            // Their device-specific filename must never be used for restore.
        case .radio:
            let value = try decoder.decode(NativeRadioBackupSnapshot.self, from: data)
            let ids = value.favorites.compactMap { UUID(uuidString: $0.stationID) }
            guard value.schemaVersion == 1, ids.count == value.favorites.count,
                  Set(ids).count == ids.count,
                  value.requiresDirectoryLookup == value.favorites.filter({ $0.streamURL == nil }).count,
                  value.favorites.allSatisfy({ $0.streamURL.map(eligible) ?? true })
            else { throw Failure.invalidSnapshot }
        case .preferences:
            let value = try decoder.decode(NativeBackupPreferencesSnapshot.self, from: data)
            guard value.schemaVersion == 1,
                  Set(value.integers.keys).isSubset(of: Set(NativeBackupPreferencesSnapshot.integerKeys)),
                  Set(value.booleans.keys).isSubset(of: Set(NativeBackupPreferencesSnapshot.booleanKeys)),
                  Set(value.numbers.keys).isSubset(of: Set(NativeBackupPreferencesSnapshot.numberKeys)),
                  Set(value.strings.keys).isSubset(of: Set(NativeBackupPreferencesSnapshot.stringKeys)),
                  value.numbers.values.allSatisfy({ $0.isFinite }),
                  value.strings.values.allSatisfy({ $0.utf8.count <= 4096 }),
                  Set(value.youtubeVideos.map(\.id)).count == value.youtubeVideos.count,
                  Set(value.youtubeChannels.map(\.id)).count == value.youtubeChannels.count,
                  value.youtubeVideos.allSatisfy({
                      NativeYouTubeVideo.validID($0.id) && $0.durationSeconds >= 0 &&
                      $0.resumeSeconds.isFinite && $0.resumeSeconds >= 0
                  }),
                  value.youtubeChannels.allSatisfy({ $0.id.hasPrefix("UC") && $0.id.count == 24 })
            else { throw Failure.invalidSnapshot }
            // Range and per-key conflict policy, favorite and voice profile
            // validation are still required by the eventual apply adapters.
        default:
            throw Failure.invalidSnapshot
        }
    }
}

/// Prepared, non-destructive merges. The eventual transaction must capture
/// current state and persist these values together, never toggle records.
enum NativeBackupPersonalDataMerge {
    struct PodcastPlan {
        let followed: [NativeFollowedPodcast]
        let favorites: Set<String>
        let savedEpisodes: [NativePodcastSavedEpisode]
        let playbackProgress: [NativePodcastPlaybackProgress]
        let downloadReferences: [NativeDownloadedPodcastEpisode]
        let progressNotImported: Int
    }

    /// Keep existing records and progress on conflict. Never pretend that a
    /// restored download reference contains local audio. Respect the current
    /// 200-position limit without silently removing an existing position.
    static func podcasts(_ backup: NativePodcastBackupSnapshot,
                         followed: [NativeFollowedPodcast], favorites: Set<String>,
                         saved: [NativePodcastSavedEpisode],
                         progress: [NativePodcastPlaybackProgress],
                         downloadedIDs: Set<String>) -> PodcastPlan {
        let combinedFavorites = favorites.union(backup.favorites)
        let combinedFollowed = appendMissing(followed, backup.followed, id: { $0.url })
        let combinedSaved = appendMissing(saved, backup.savedEpisodes.filter {
            combinedFavorites.contains($0.id)
        }, id: { $0.id })
        let currentIDs = Set(progress.map(\.id))
        let missing = backup.playbackProgress.filter { !currentIDs.contains($0.id) }
            .sorted { $0.updatedAt == $1.updatedAt ? $0.id < $1.id : $0.updatedAt > $1.updatedAt }
        let accepted = Array(missing.prefix(max(0, 200 - progress.count)))
        let combinedProgress = appendMissing(progress, accepted, id: { $0.id })
        return PodcastPlan(followed: combinedFollowed, favorites: combinedFavorites,
            savedEpisodes: combinedSaved, playbackProgress: combinedProgress,
            downloadReferences: backup.previouslyDownloaded.filter { !downloadedIDs.contains($0.id) },
            progressNotImported: missing.count - accepted.count)
    }

    struct RadioPlan {
        let favorites: [NativeRadioStation]
        let unresolved: [NativeRadioBackupEntry]
    }

    /// UUID identity is case-insensitive. An unresolved reference remains
    /// pending lookup; never create a playable station with an empty URL.
    static func radio(_ backup: NativeRadioBackupSnapshot,
                      existing: [NativeRadioStation]) -> RadioPlan {
        var ids = Set(existing.compactMap { UUID(uuidString: $0.stationuuid) })
        var favorites = existing
        var unresolved: [NativeRadioBackupEntry] = []
        for entry in backup.favorites {
            guard let id = UUID(uuidString: entry.stationID), ids.insert(id).inserted else { continue }
            guard let stream = entry.streamURL, NativeBackupReferencePolicy.eligible(stream) else {
                unresolved.append(entry)
                continue
            }
            favorites.append(NativeRadioStation(stationuuid: entry.stationID,
                name: entry.name, url_resolved: stream, lastcheckok: 0,
                country: entry.country, tags: entry.tags))
        }
        return RadioPlan(favorites: favorites, unresolved: unresolved)
    }

    struct ReadingPlan {
        let favorites: Set<NativeFavoriteKey>
        let savedForLater: Set<NativeFavoriteKey>
        let recentlyRead: [NativeFavoriteKey]
        let historyNotImported: Int
    }

    static func reading(_ backup: NativeBackupPreferencesSnapshot,
                        favorites: Set<NativeFavoriteKey>, savedForLater: Set<NativeFavoriteKey>,
                        recentlyRead: [NativeFavoriteKey]) -> ReadingPlan {
        let allowed: (NativeFavoriteKey) -> Bool = { $0.kind == .resource || $0.kind == .news }
        let missing = appendMissing(recentlyRead, backup.recentlyRead.filter(allowed), id: { $0 })
        let additions = missing.dropFirst(recentlyRead.count)
        let accepted = Array(additions.prefix(max(0, 100 - recentlyRead.count)))
        return ReadingPlan(favorites: favorites.union(backup.favorites),
            savedForLater: savedForLater.union(backup.savedForLater.filter(allowed)),
            recentlyRead: recentlyRead + accepted,
            historyNotImported: additions.count - accepted.count)
    }

    private static func appendMissing<T, ID: Hashable>(_ current: [T], _ incoming: [T],
                                                      id: (T) -> ID) -> [T] {
        var ids = Set(current.map(id))
        return current + incoming.filter { ids.insert(id($0)).inserted }
    }
}

/// Read-only verification of the full library indexes and their exact media
/// references. No new UUIDs or live store writes are permitted here.
enum NativeBackupLibraryValidation {
    static func validate(section: NativeBackupManifest.Section,
                         metadata: [String: Data], mediaPaths: Set<String>) throws {
        let decoder = JSONDecoder()
        func required(_ name: String) throws -> Data {
            guard let data = metadata[name] else { throw CocoaError(.fileReadCorruptFile) }
            return data
        }
        switch section {
        case .reader:
            let documents = try decoder.decode([NativeReadingDocument].self, from: required("documentos.json"))
            let folders = try decoder.decode([String].self, from: required("carpetas.json"))
            guard Set(documents.map(\.id)).count == documents.count,
                  folders.allSatisfy({ !$0.isEmpty && $0.count <= 80 && $0 != "__unfiled__" }),
                  Set(folders.map { $0.lowercased() }).count == folders.count else {
                throw CocoaError(.fileReadCorruptFile)
            }
            var expected = Set<String>()
            for document in documents {
                try Task.checkCancellation()
                guard (0...100).contains(document.lastPercent ?? 0),
                      (document.lastTextOffset ?? 0) >= 0,
                      (document.lastTrackIndex ?? 0) >= 0,
                      (document.lastAudioSeconds ?? 0).isFinite,
                      (document.lastAudioSeconds ?? 0) >= 0 else {
                    throw CocoaError(.fileReadCorruptFile)
                }
                for path in (document.trackPaths ?? []) + [document.originalRelativePath].compactMap({ $0 }) {
                    try NativeBackupSectionArchive.validatePath(path)
                    let pieces = path.split(separator: "/")
                    guard pieces.count >= 3,
                          ["ReaderMedia", "ReaderOriginals"].contains(String(pieces[0])),
                          String(pieces[1]) == document.id.uuidString else {
                        throw CocoaError(.fileReadCorruptFile)
                    }
                    expected.insert(path)
                }
            }
            guard expected == mediaPaths else { throw CocoaError(.fileReadCorruptFile) }
        case .music:
            try NativeMusicBackupValidation.validate(data: required("manifest.json"), mediaPaths: mediaPaths)
        case .cinema:
            let items = try decoder.decode([NativeCinemaLocalItem].self, from: required("catalogo-personal.json"))
            let history = try decoder.decode([NativeCinemaRecent].self, from: required("historial.json"))
            let allowed = Set(["mp3", "m4a", "m4b", "aac", "wav", "aif", "aiff", "caf", "flac", "mp4", "m4v", "mov"])
            let sources = Set(["personal", "public-es", "public-latino", "drive-es", "drive-latino",
                               "audiocinemateca", "tape-territory", "movies-for-the-blind"])
            guard Set(items.map(\.id)).count == items.count,
                  Set(history.map(\.id)).count == history.count, history.count <= 100,
                  history.allSatisfy({
                      sources.contains($0.source) && NativeBackupReferencePolicy.eligibleID($0.id) &&
                      $0.seconds.isFinite && $0.duration.isFinite && $0.seconds >= 0 && $0.duration >= 0 &&
                      ($0.source != "personal" || UUID(uuidString: $0.id) != nil)
                  }) else { throw CocoaError(.fileReadCorruptFile) }
            var expected = Set<String>()
            for item in items {
                try Task.checkCancellation()
                let ext = (item.storedName as NSString).pathExtension
                guard allowed.contains(ext), item.storedName == item.id.uuidString + "." + ext,
                      item.lastSeconds.isFinite, item.lastSeconds >= 0,
                      expected.insert("media/" + item.storedName).inserted else {
                    throw CocoaError(.fileReadCorruptFile)
                }
            }
            guard expected == mediaPaths else { throw CocoaError(.fileReadCorruptFile) }
        default:
            throw CocoaError(.fileReadCorruptFile)
        }
    }
}


/// In-process rollback snapshot of explicitly named property-list values only.
/// Restores absence as absence. Not a durable journal or a disk-sync guarantee.
struct NativeBackupDefaultsBeforeState {
    private let defaults: UserDefaults
    private let values: [(String, Any?)]

    init(defaults: UserDefaults, keys: [String], recovery: NativeBackupRecoveryBuilder? = nil) {
        recovery?.recordDefaults(keys)
        self.defaults = defaults
        self.values = keys.map { ($0, defaults.object(forKey: $0)) }
    }

    func restore() {
        for (key, value) in values {
            if let value { defaults.set(value, forKey: key) }
            else { defaults.removeObject(forKey: key) }
        }
    }
}


/// Collect the independently reversible reading and YouTube components. This
/// is intentionally not a complete preferences restore: scalar settings and
/// voice profiles must be validated and staged before a section step exists.
@MainActor
enum NativeBackupPreferencesComponents {
    struct Prepared {
        let readingPlan: NativeBackupPersonalDataMerge.ReadingPlan
        let favorites: (apply: () throws -> Void, rollback: () throws -> Void)
        let activity: (apply: () throws -> Void, rollback: () throws -> Void)
        let youtube: (apply: () throws -> Void, rollback: () throws -> Void)
    }

    static func prepare(_ backup: NativeBackupPreferencesSnapshot,
                        favorites: NativeFavoritesStore, activity: NativeReadingActivity, recovery: NativeBackupRecoveryBuilder? = nil) throws -> Prepared {
        try NativeBackupPersonalDataValidation.validate(section: .preferences,
            data: JSONEncoder().encode(backup))
        let plan = NativeBackupPersonalDataMerge.reading(backup, favorites: favorites.keys,
            savedForLater: activity.savedForLater, recentlyRead: activity.recentlyRead)
        return Prepared(readingPlan: plan,
            favorites: try favorites.prepareBackupFavorites(plan.favorites, recovery: recovery),
            activity: try activity.prepareBackupActivity(plan, recovery: recovery),
            youtube: try NativeYouTubePersonalLibrary.shared.prepareBackupLibrary(backup, recovery: recovery))
    }
}


/// Restore only missing, validated settings. Device-dependent choices and
/// live player settings are deferred and must be reported to the caller.
@MainActor
enum NativeBackupSettingsRestore {
    struct Prepared {
        let omittedKeys: [String]
        let apply: () throws -> Void
        let rollback: () throws -> Void
    }

    static func prepare(_ backup: NativeBackupPreferencesSnapshot,
                        defaults: UserDefaults = .standard, recovery: NativeBackupRecoveryBuilder? = nil) throws -> Prepared {
        var updates: [String: Any] = [:]
        var omitted = [String]()
        func offer(_ key: String, _ value: Any, allowed: Bool) {
            guard allowed else { omitted.append(key); return }
            if defaults.object(forKey: key) == nil { updates[key] = value }
        }
        for (key, value) in backup.integers {
            offer(key, value, allowed: NativeBackupPersonalDataValidation.validInteger(key, value))
        }
        for (key, value) in backup.booleans {
            offer(key, value, allowed: NativeBackupPreferencesSnapshot.booleanKeys.contains(key) &&
                  key != "mi-musica-shuffle")
        }
        for (key, value) in backup.numbers {
            offer(key, value, allowed: NativeBackupPersonalDataValidation.validNumber(key, value))
        }
        for (key, value) in backup.strings {
            // Voice IDs, folder selections and repeat mode require device or
            // live-store resolution. Never activate an unavailable engine.
            offer(key, value, allowed: false)
        }
        let voices = try NativeReaderVoiceProfileStore.prepareBackupProfiles(
            backup.voiceProfiles, defaults: defaults, recovery: recovery)
        omitted.append(contentsOf: voices.omittedKeys)
        let before = NativeBackupDefaultsBeforeState(defaults: defaults, keys: Array(updates.keys), recovery: recovery)
        let staged = updates
        return Prepared(omittedKeys: omitted.sorted(), apply: {
            for (key, value) in staged { defaults.set(value, forKey: key) }
            try voices.apply()
        }, rollback: {
            before.restore()
            try voices.rollback()
        })
    }
}


/// One reversible preferences step. Deferred or incompatible settings are
/// explicit in the result and must be displayed before any user confirmation.
/// The coordinator must not report a complete restore when omissions remain.
@MainActor
enum NativeBackupPreferencesRestore {
    struct Prepared {
        let step: NativeBackupRestoreTransaction.Step<NativeBackupManifest.Section>
        let omittedKeys: [String]
        let historyNotImported: Int
    }

    static func prepare(_ backup: NativeBackupPreferencesSnapshot,
                        favorites: NativeFavoritesStore, activity: NativeReadingActivity, recovery: NativeBackupRecoveryBuilder? = nil) throws -> Prepared {
        let components = try NativeBackupPreferencesComponents.prepare(backup,
            favorites: favorites, activity: activity, recovery: recovery)
        let settings = try NativeBackupSettingsRestore.prepare(backup, recovery: recovery)
        let parts = [components.favorites, components.activity, components.youtube,
                     (apply: settings.apply, rollback: settings.rollback)]
        let step = NativeBackupRestoreTransaction.Step<NativeBackupManifest.Section>(
            section: .preferences, apply: {
                for part in parts {
                    try Task.checkCancellation()
                    try part.apply()
                }
            }, rollback: {
                var firstError: Error?
                for part in parts.reversed() {
                    do { try part.rollback() }
                    catch { if firstError == nil { firstError = error } }
                }
                if let firstError { throw firstError }
            })
        return Prepared(step: step, omittedKeys: settings.omittedKeys,
            historyNotImported: components.readingPlan.historyNotImported)
    }
}
