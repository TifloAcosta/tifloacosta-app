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
    @Published private(set) var isRestoring = false
    private let store: NativeBackupGenerationStore

    enum Failure: Error {
        case busy, unsupportedSelection, missingLiveStore, incompleteRestore, liveStoresNotQuiescent
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
        guard !isCreating, !isRestoring else { throw Failure.busy }
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
            let snapshot = try NativeBackupPreferencesSnapshot.capture(favorites: favorites, activity: activity)
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

    /// Verify the complete generation and every selected section before any
    /// future restore operation. A successful preflight is not a restore.
    func preflightRestore(generation: UUID) async throws -> NativeBackupManifest {
        guard !isCreating, !isRestoring else { throw Failure.busy }
        let destination = store
        let worker = Task.detached(priority: .utility) {
            let (manifest, directory) = try destination.verifiedGeneration(generation)
            for artifact in manifest.artifacts {
                try Task.checkCancellation()
                try NativeBackupSectionArchive.verifyContentsForRestore(section: artifact.section,
                    source: directory.appendingPathComponent(artifact.filename))
            }
            return manifest
        }
        return try await withTaskCancellationHandler {
            try await worker.value
        } onCancel: { worker.cancel() }
    }

    struct RestoreReport {
        let manifest: NativeBackupManifest
        let pendingPodcastDownloads: [NativeDownloadedPodcastEpisode]
        let unresolvedRadioStations: [NativeRadioBackupEntry]
        let omittedSettings: [String]
        let omittedMusicProfilesAndRules: [String]
        let omittedPodcastPositions: Int
        let omittedReadingHistory: Int
        let omittedCinemaHistory: Int

        var hasOmissions: Bool {
            !pendingPodcastDownloads.isEmpty || !unresolvedRadioStations.isEmpty ||
            !omittedSettings.isEmpty || !omittedMusicProfilesAndRules.isEmpty ||
            omittedPodcastPositions > 0 || omittedReadingHistory > 0 || omittedCinemaHistory > 0
        }
    }

    /// Internal integration only. Do not expose this entry point in the UI
    /// until a durable recovery journal and the live-store write barrier exist.
    /// The caller must guarantee exclusive ownership of all live stores
    /// during the synchronous preparation and commit, including audio callbacks.
    func restoreLocalGeneration(generation: UUID, reader: NativeReaderLibrary,
                                podcastLibrary: NativePodcastLibrary? = nil,
                                podcastDownloads: NativePodcastDownloads? = nil,
                                favorites: NativeFavoritesStore? = nil,
                                activity: NativeReadingActivity? = nil,
                                allowReportedOmissions: Bool = false,
                                liveStoresAreQuiescent: () -> Bool) async throws -> RestoreReport {
        guard !isCreating, !isRestoring else { throw Failure.busy }
        isRestoring = true
        defer { isRestoring = false }
        let destination = store
        let worker = Task.detached(priority: .utility) {
            let (manifest, directory) = try destination.verifiedGeneration(generation)
            var staged: [NativeBackupManifest.Section: URL] = [:]
            do {
                for artifact in manifest.artifacts {
                    try Task.checkCancellation()
                    staged[artifact.section] = try NativeBackupSectionArchive.stageForRestore(
                        section: artifact.section, source: directory.appendingPathComponent(artifact.filename))
                }
                try Task.checkCancellation()
                return (manifest, staged)
            } catch {
                for url in staged.values { try? FileManager.default.removeItem(at: url) }
                throw error
            }
        }
        let (manifest, staged) = try await withTaskCancellationHandler {
            try await worker.value
        } onCancel: { worker.cancel() }
        defer {
            for url in staged.values { try? FileManager.default.removeItem(at: url) }
        }
        try Task.checkCancellation()
        guard liveStoresAreQuiescent() else { throw Failure.liveStoresNotQuiescent }
        let selected = Set(manifest.artifacts.map(\.section))
        guard Set(staged.keys) == selected else { throw Failure.unsupportedSelection }
        var steps: [NativeBackupRestoreTransaction.Step<NativeBackupManifest.Section>] = []
        var downloads: [NativeDownloadedPodcastEpisode] = []
        var stations: [NativeRadioBackupEntry] = []
        var settings: [String] = [], music: [String] = []
        var podcastPositions = 0, readingHistory = 0, cinemaHistory = 0
        let decoder = JSONDecoder()
        // No await or live mutation between snapshot preparation and commit.
        for section in NativeBackupManifest.Section.allCases {
            guard let url = staged[section] else { continue }
            try Task.checkCancellation()
            switch section {
            case .reader:
                steps.append(try reader.prepareGlobalBackupRestore(staging: url))
            case .music:
                let (step, omitted) = try NativeMusicBackupAdapter.prepareRestore(staging: url)
                steps.append(step); music = omitted
            case .cinema:
                let (step, omitted) = try NativeCinemaLocalLibrary.shared.prepareGlobalBackupRestore(staging: url)
                steps.append(step); cinemaHistory = omitted
            case .podcasts:
                guard let podcastLibrary, let podcastDownloads else { throw Failure.missingLiveStore }
                guard podcastDownloads.downloadingID == nil else { throw Failure.liveStoresNotQuiescent }
                let snapshot = try decoder.decode(NativePodcastBackupSnapshot.self,
                    from: Data(contentsOf: url.appendingPathComponent("snapshot.json")))
                let ids = Set(podcastDownloads.entries.filter {
                    podcastDownloads.localURL(for: $0.id) != nil
                }.map(\.id))
                let (step, plan) = try podcastLibrary.prepareBackupRestore(snapshot, downloadedIDs: ids)
                steps.append(step); downloads = plan.downloadReferences; podcastPositions = plan.progressNotImported
            case .radio:
                let snapshot = try decoder.decode(NativeRadioBackupSnapshot.self,
                    from: Data(contentsOf: url.appendingPathComponent("snapshot.json")))
                let (step, plan) = try NativeRadioBackupAdapter.prepareBackupRestore(snapshot)
                steps.append(step); stations = plan.unresolved
            case .preferences:
                guard let favorites, let activity else { throw Failure.missingLiveStore }
                let snapshot = try decoder.decode(NativeBackupPreferencesSnapshot.self,
                    from: Data(contentsOf: url.appendingPathComponent("snapshot.json")))
                let plan = try NativeBackupPreferencesRestore.prepare(snapshot, favorites: favorites, activity: activity)
                steps.append(plan.step); settings = plan.omittedKeys; readingHistory = plan.historyNotImported
            }
        }
        let report = RestoreReport(manifest: manifest, pendingPodcastDownloads: downloads,
            unresolvedRadioStations: stations, omittedSettings: settings, omittedMusicProfilesAndRules: music,
            omittedPodcastPositions: podcastPositions, omittedReadingHistory: readingHistory,
            omittedCinemaHistory: cinemaHistory)
        guard !report.hasOmissions || allowReportedOmissions else { throw Failure.incompleteRestore }
        guard liveStoresAreQuiescent() else { throw Failure.liveStoresNotQuiescent }
        try NativeBackupRestoreTransaction.execute(expected: selected, steps: steps)
        return report
    }
}
