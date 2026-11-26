import Foundation
import Combine

/// Coordinates selected sections into one local immutable generation. Until
/// restore, privacy review, and cloud transport are implemented this
/// must not be presented as a complete application or iCloud backup.
@MainActor
final class NativeBackupCoordinator: ObservableObject {
    static let shared = NativeBackupCoordinator()
    static let supportedSections: Set<NativeBackupManifest.Section> = [.reader, .music, .cinema, .podcasts, .radio, .preferences]

    @Published private(set) var isCreating = false
    private let store: NativeBackupGenerationStore

    enum Failure: Error {
        case busy, unsupportedSelection, missingLiveStore
    }

    init(root: URL = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        .appendingPathComponent("GlobalBackupGenerations", isDirectory: true)) {
        store = NativeBackupGenerationStore(root: root)
    }

    /// Do not silently omit unsupported or failed sections. The generation
    /// exists only when every requested archive has been produced and verified.
    func create(sections: Set<NativeBackupManifest.Section>, reader: NativeReaderLibrary,
                podcastLibrary: NativePodcastLibrary? = nil,
                podcastDownloads: NativePodcastDownloads? = nil,
                favorites: NativeFavoritesStore? = nil,
                activity: NativeReadingActivity? = nil) async throws -> NativeBackupManifest {
        guard !isCreating else { throw Failure.busy }
        guard !sections.isEmpty, sections.isSubset(of: Self.supportedSections) else {
            throw Failure.unsupportedSelection
        }
        if sections.contains(.podcasts), podcastLibrary == nil || podcastDownloads == nil {
            throw Failure.missingLiveStore
        }
        if sections.contains(.preferences), favorites == nil || activity == nil {
            throw Failure.missingLiveStore
        }
        isCreating = true
        var archives: [NativeBackupManifest.Section: URL] = [:]
        defer {
            for archive in archives.values {
                try? FileManager.default.removeItem(at: archive.deletingLastPathComponent())
            }
            isCreating = false
        }
        if sections.contains(.reader) {
            archives[.reader] = try await reader.createGlobalBackupArchive()
        }
        try Task.checkCancellation()
        if sections.contains(.music) {
            archives[.music] = try await NativeMusicBackupAdapter.createArchive()
        }
        try Task.checkCancellation()
        if sections.contains(.cinema) {
            archives[.cinema] = try await NativeCinemaLocalLibrary.shared.createGlobalBackupArchive()
        }
        try Task.checkCancellation()
        if sections.contains(.podcasts) {
            guard let podcastLibrary, let podcastDownloads else { throw Failure.missingLiveStore }
            let snapshot = NativePodcastBackupSnapshot.capture(library: podcastLibrary, downloads: podcastDownloads)
            archives[.podcasts] = try await NativeBackupMetadataArchive.create(snapshot)
        }
        try Task.checkCancellation()
        if sections.contains(.radio) {
            let snapshot = try NativeRadioBackupAdapter.capture()
            archives[.radio] = try await NativeBackupMetadataArchive.create(snapshot)
        }
        try Task.checkCancellation()
        if sections.contains(.preferences) {
            guard let favorites, let activity else { throw Failure.missingLiveStore }
            let snapshot = NativeBackupPreferencesSnapshot.capture(favorites: favorites, activity: activity)
            archives[.preferences] = try await NativeBackupMetadataArchive.create(snapshot)
        }
        try Task.checkCancellation()
        guard Set(archives.keys) == sections else { throw Failure.unsupportedSelection }
        let prepared = archives
        let destination = store
        let worker = Task.detached(priority: .utility) {
            try destination.publish(archives: prepared)
        }
        // If publication committed before cancellation, retain that valid copy.
        return try await withTaskCancellationHandler {
            try await worker.value
        } onCancel: { worker.cancel() }
    }

    func history() async throws -> [NativeBackupManifest] {
        let destination = store
        return try await Task.detached(priority: .utility) {
            try destination.history()
        }.value
    }
}
