import Foundation
import CryptoKit

/// Only exact planned destinations and named defaults are recorded. Recovery
/// is local, before live stores load; never interpret an archive as a journal.
struct NativeBackupRecoveryPayload: Codable {
    enum Root: String, Codable { case support, documents }
    struct Path: Codable, Hashable {
        let root: Root
        let relative: String
    }
    struct Index: Codable {
        let path: Path
        let before: Data?
    }
    struct Preference: Codable {
        let key: String
        let before: Data?
    }
    let indexes: [Index]
    let newMedia: [Path]
    let preferences: [Preference]

    struct Roots {
        let support: URL
        let documents: URL
        static var application: Self {
            Self(support: FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0],
                 documents: FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0])
        }
        func url(_ root: Root) -> URL { root == .support ? support : documents }
    }

    enum Failure: Error { case invalidPath, invalidPreference, collision }
    private static let supportIndexes: Set<String> = [
        "NativeReaderDocuments.json", "TifloCinemaPersonal/catalogo-personal.json", "cinema-recent-v1.json"
    ]
    private static let musicIndexes: Set<String> = [
        "MiMusica/library.json", "MiMusica/folders.json", "MiMusica/playlists.json", "MiMusica/smart-folders.json"
    ]
    private static let keys: Set<String> = [
        "native-reader-folders", "native-podcast-followed-v1", "native-podcast-favorites-v1",
        "native-podcast-favorite-episodes-v1", "native-podcast-playback-progress-v1",
        "mi-musica-radio-favorites-v2", "native-ios-favorites-v1", "native-ios-read-later-v1",
        "native-ios-reading-history-v1", "native-youtube-personal-library-v1", "native-youtube-followed-channels-v1",
        "native-ios-language", "native-ios-color-scheme", "native-ios-text-size", "native-ios-line-spacing",
        "native-reading-folder-entry-mode", "native-reading-filter", "native-reading-sort",
        "native-reading-speed-index", "native-reading-pitch-index", "native-voiceover-library-detail-index",
        "native-reading-line-spacing-index", "native-reader-navigation-unit", "native-reader-reading-mode",
        "native-reader-presentation-mode", "native-reader-reading-engine", "native-reading-pause-style",
        "native-reader-ocr-accuracy-index", "native-reader-ocr-language-index",
        "native-cinema-collection-language-index-v1", "native-cinema-collection-content-index-v1",
        "native-cinema-language-index-v1", "native-cinema-content-index-v1",
        "native-cinema-import-language-index-v1", "native-cinema-import-kind-index-v1",
        "native-ios-strong-text", "native-reading-strong-text", "native-reader-braille-initial-text-focus",
        "native-podcast-continuous-playback", "music.cellularPlayback", "music.cellularDownloads",
        "music.detailedVoiceOver", "native-reading-text-size", "native-reading-pause-comma",
        "native-reading-pause-semicolon", "native-reading-pause-colon", "native-reading-pause-sentence",
        "native-reading-pause-paragraph", "native-reading-voice-id", "native-reader-gemini-voice"
    ]

    static func allowedKey(_ key: String) -> Bool {
        if keys.contains(key) { return true }
        if ["mi-musica-eq-preset", "mi-musica-eq-bands"].contains(key) { return true }
        let musicPrefixes = ["mi-musica-eq-song-", "mi-musica-eq-playlist-", "mi-musica-eq-album-"]
        if let prefix = musicPrefixes.first(where: { key.hasPrefix($0) }) {
            let suffix = key.dropFirst(prefix.count)
            return !suffix.isEmpty && suffix.utf8.count <= 240 &&
                !suffix.unicodeScalars.contains(where: { CharacterSet.controlCharacters.contains($0) })
        }
        let prefix = "native-reader-voice-profile-"
        guard key.hasPrefix(prefix), key != "native-reader-voice-profiles-migrated-v1" else { return false }
        let suffix = key.dropFirst(prefix.count)
        return !suffix.isEmpty && suffix.utf8.count <= 512 &&
            !suffix.unicodeScalars.contains(where: { CharacterSet.controlCharacters.contains($0) })
    }

    static func allowedPath(_ path: Path, media: Bool) -> Bool {
        if !media {
            return path.root == .support ? supportIndexes.contains(path.relative) : musicIndexes.contains(path.relative)
        }
        let parts = path.relative.split(separator: "/", omittingEmptySubsequences: false)
        guard parts.count == 2, !path.relative.contains("\\"), !path.relative.contains(":") else { return false }
        let name = String(parts[1])
        if path.root == .support && ["ReaderMedia", "ReaderOriginals"].contains(String(parts[0])) {
            return UUID(uuidString: name)?.uuidString == name
        }
        let extensions: Set<String>
        if path.root == .documents && parts[0] == "MiMusica" {
            extensions = ["mp3","m4a","m4b","aac","wav","aif","aiff","caf","flac","ogg"]
        } else if path.root == .support && parts[0] == "TifloCinemaPersonal" {
            extensions = ["mp3","m4a","m4b","aac","wav","aif","aiff","caf","flac","mp4","m4v","mov"]
        } else { return false }
        let stem = (name as NSString).deletingPathExtension
        return UUID(uuidString: stem)?.uuidString == stem && extensions.contains((name as NSString).pathExtension)
    }

    static func relative(_ url: URL, roots: Roots, media: Bool) throws -> Path {
        for root in [Root.support, .documents] {
            let prefix = roots.url(root).standardizedFileURL.pathComponents
            let components = url.standardizedFileURL.pathComponents
            guard components.count > prefix.count, Array(components.prefix(prefix.count)) == prefix else { continue }
            let path = Path(root: root, relative: components.dropFirst(prefix.count).joined(separator: "/"))
            guard allowedPath(path, media: media) else { throw Failure.invalidPath }
            return path
        }
        throw Failure.invalidPath
    }

    private static func attributes(_ url: URL) throws -> URLResourceValues? {
        do { return try url.resourceValues(forKeys: [.isSymbolicLinkKey, .isDirectoryKey, .isRegularFileKey]) }
        catch {
            let error = error as NSError
            if error.domain == NSCocoaErrorDomain &&
                [NSFileNoSuchFileError, NSFileReadNoSuchFileError].contains(error.code) { return nil }
            throw error
        }
    }

    static func checkedURL(_ path: Path, roots: Roots, media: Bool) throws -> URL {
        guard allowedPath(path, media: media) else { throw Failure.invalidPath }
        var url = roots.url(path.root)
        if let values = try attributes(url) {
            guard values.isDirectory == true, values.isSymbolicLink == false else { throw Failure.invalidPath }
        }
        let parts = path.relative.split(separator: "/")
        for (i, part) in parts.enumerated() {
            url.appendPathComponent(String(part))
            guard let values = try attributes(url) else { continue }
            guard values.isSymbolicLink == false else { throw Failure.invalidPath }
            if i < parts.count - 1 {
                guard values.isDirectory == true else { throw Failure.invalidPath }
            } else {
                let directory = media && (parts[0] == "ReaderMedia" || parts[0] == "ReaderOriginals")
                guard directory ? values.isDirectory == true : values.isRegularFile == true else {
                    throw Failure.invalidPath
                }
            }
        }
        return url
    }

    static func encodePreference(_ value: Any) throws -> Data {
        guard PropertyListSerialization.propertyList([value], isValidFor: .binary) else {
            throw Failure.invalidPreference
        }
        return try PropertyListSerialization.data(fromPropertyList: [value], format: .binary, options: 0)
    }
    private static func decodePreference(_ data: Data) throws -> Any {
        guard let values = try PropertyListSerialization.propertyList(from: data, options: [], format: nil) as? [Any],
              values.count == 1 else { throw Failure.invalidPreference }
        return values[0]
    }

    /// Validate every path/key/value before writing. Restore indexes before
    /// removing new media; retain the journal if any operation fails.
    func replay(roots: Roots = .application, defaults: UserDefaults = .standard) throws {
        guard Set(indexes.map(\.path)).count == indexes.count,
              Set(newMedia).count == newMedia.count,
              Set(preferences.map(\.key)).count == preferences.count else { throw Failure.collision }
        let indexURLs = try indexes.map { try Self.checkedURL($0.path, roots: roots, media: false) }
        let mediaURLs = try newMedia.map { try Self.checkedURL($0, roots: roots, media: true) }
        let values = try preferences.map { item -> Any? in
            guard Self.allowedKey(item.key) else { throw Failure.invalidPreference }
            return try item.before.map(Self.decodePreference)
        }
        let fm = FileManager.default
        for (item, url) in zip(indexes, indexURLs) {
            if let bytes = item.before {
                try fm.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
                try bytes.write(to: url, options: .atomic)
            } else if fm.fileExists(atPath: url.path) { try fm.removeItem(at: url) }
        }
        for (item, value) in zip(preferences, values) {
            if let value { defaults.set(value, forKey: item.key) }
            else { defaults.removeObject(forKey: item.key) }
        }
        guard defaults.synchronize() else { throw Failure.invalidPreference }
        for url in mediaURLs.reversed() where fm.fileExists(atPath: url.path) {
            try fm.removeItem(at: url)
        }
    }
}

/// Scoped to synchronous preparation. No arbitrary defaults or existing media
/// are captured; each adapter contributes the precise keys and file targets.
/// An overlapping identity is not proof of byte-for-byte equality. Keep
/// the live item and report that the incoming copy was not applied.
/// Digests avoid putting URLs, titles or private names in approval tokens.
struct NativeBackupPreservedIdentity: Hashable {
    let section: String
    let kind: String
    let digest: String
}

final class NativeBackupRecoveryBuilder {
    private let roots: NativeBackupRecoveryPayload.Roots
    private var indexes: [NativeBackupRecoveryPayload.Index] = []
    private var targets: [NativeBackupRecoveryPayload.Path] = []
    private var keys = Set<String>()
    private var preserved = Set<NativeBackupPreservedIdentity>()
    init(roots: NativeBackupRecoveryPayload.Roots = .application) { self.roots = roots }

    func recordFiles(indexes values: [(URL, Data?)], targets urls: [URL]) throws {
        for (url, before) in values {
            let path = try NativeBackupRecoveryPayload.relative(url, roots: roots, media: false)
            _ = try NativeBackupRecoveryPayload.checkedURL(path, roots: roots, media: false)
            indexes.append(.init(path: path, before: before))
        }
        for url in urls {
            let path = try NativeBackupRecoveryPayload.relative(url, roots: roots, media: true)
            let checked = try NativeBackupRecoveryPayload.checkedURL(path, roots: roots, media: true)
            guard !FileManager.default.fileExists(atPath: checked.path) else {
                throw NativeBackupRecoveryPayload.Failure.collision
            }
            targets.append(path)
        }
    }

    func recordDefaults(_ values: [String]) { keys.formUnion(values) }

    func recordPreserved(section: String, kind: String, identifiers: [String]) {
        for identifier in identifiers {
            let hash = SHA256.hash(data: Data(identifier.utf8)).map { String(format: "%02x", $0) }.joined()
            preserved.insert(.init(section: section, kind: kind, digest: hash))
        }
    }

    var preservedIdentities: [NativeBackupPreservedIdentity] {
        preserved.sorted {
            if $0.section != $1.section { return $0.section < $1.section }
            if $0.kind != $1.kind { return $0.kind < $1.kind }
            return $0.digest < $1.digest
        }
    }

    func payload(defaults: UserDefaults = .standard) throws -> NativeBackupRecoveryPayload {
        guard Set(indexes.map(\.path)).count == indexes.count, Set(targets).count == targets.count else {
            throw NativeBackupRecoveryPayload.Failure.collision
        }
        let preferences = try keys.sorted().map { key -> NativeBackupRecoveryPayload.Preference in
            guard NativeBackupRecoveryPayload.allowedKey(key) else {
                throw NativeBackupRecoveryPayload.Failure.invalidPreference
            }
            let before = try defaults.object(forKey: key).map(NativeBackupRecoveryPayload.encodePreference)
            return .init(key: key, before: before)
        }
        return .init(indexes: indexes, newMedia: targets, preferences: preferences)
    }
}
