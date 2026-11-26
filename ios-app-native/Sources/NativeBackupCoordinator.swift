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
    @Published private(set) var isTransferringCloudBackup = false
    @Published private(set) var isRunningAutomaticBackup = false
    private let store: NativeBackupGenerationStore
    private let automaticStore: NativeBackupAutomaticStateStore

    struct SynchronizedHistory {
        let entries: [NativeBackupSyncPolicy.Entry]
        let initialMetadataGatheringComplete: Bool
        let localSpaceCandidates: [UUID]
    }

    enum AutomaticResult: Equatable {
        case disabled, notDue, deferred, pending(UUID), completed(UUID)
    }

    enum Failure: Error {
        case busy, unsupportedSelection, missingLiveStore, liveStoresNotQuiescent
        case incompleteRestore(RestoreReport)
    }

    init(root: URL = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        .appendingPathComponent("GlobalBackupGenerations", isDirectory: true)) {
        store = NativeBackupGenerationStore(root: root)
        automaticStore = NativeBackupAutomaticStateStore(url: root.deletingLastPathComponent()
            .appendingPathComponent("GlobalBackupAutomation", isDirectory: true)
            .appendingPathComponent("state.json"))
    }

    private var backupOperationBusy: Bool {
        isCreating || isRestoring || isTransferringCloudBackup || isRunningAutomaticBackup
    }

    /// Do not silently omit unsupported or failed sections. The generation
    /// exists only when every requested archive has been produced and verified.
    func create(sections: Set<NativeBackupManifest.Section>, reader: NativeReaderLibrary,
                podcastLibrary: NativePodcastLibrary? = nil,
                podcastDownloads: NativePodcastDownloads? = nil,
                favorites: NativeFavoritesStore? = nil,
                activity: NativeReadingActivity? = nil) async throws -> NativeBackupManifest {
        guard !backupOperationBusy else { throw Failure.busy }
        return try await createGeneration(sections: sections, generation: UUID(), reader: reader,
            podcastLibrary: podcastLibrary, podcastDownloads: podcastDownloads, favorites: favorites, activity: activity)
    }

    private func createGeneration(sections: Set<NativeBackupManifest.Section>, generation: UUID,
                                  reader: NativeReaderLibrary, podcastLibrary: NativePodcastLibrary?,
                                  podcastDownloads: NativePodcastDownloads?, favorites: NativeFavoritesStore?,
                                  activity: NativeReadingActivity?) async throws -> NativeBackupManifest {
        guard !isCreating, !isRestoring, !isTransferringCloudBackup else { throw Failure.busy }
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
            try destination.publish(archives: prepared, generation: generation)
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

    /// Cloud upload is explicit, never automatically triggered by creation.
    /// Pending means Apple has accepted the local copy, not uploaded all data.
    func uploadToICloud(generation: UUID) async throws -> NativeBackupCloudStore.UploadState {
        guard !backupOperationBusy else { throw Failure.busy }
        return try await uploadGeneration(generation: generation, automaticAuthorization: nil)
    }

    private func uploadGeneration(generation: UUID, automaticAuthorization: UUID?) async throws -> NativeBackupCloudStore.UploadState {
        guard !isCreating, !isRestoring, !isTransferringCloudBackup else { throw Failure.busy }
        isTransferringCloudBackup = true
        defer { isTransferringCloudBackup = false }
        let local = store
        let worker = Task.detached(priority: .utility) {
            let (manifest, directory) = try local.verifiedGeneration(generation)
            for artifact in manifest.artifacts {
                try Task.checkCancellation()
                try NativeBackupSectionArchive.verifyContentsForRestore(section: artifact.section,
                    source: directory.appendingPathComponent(artifact.filename))
            }
            return try NativeBackupCloudStore().upload(generation: generation, local: local,
                automaticAuthorization: automaticAuthorization)
        }
        return try await withTaskCancellationHandler {
            try await worker.value
        } onCancel: { worker.cancel() }
    }

    func automaticConfiguration() throws -> NativeBackupAutomaticState? {
        try automaticStore.load()
    }

    /// Enabling automatic backups requires a foreground, explicit opt-in.
    /// Reconfiguration leaves every prior local and cloud generation intact.
    func configureAutomaticBackups(sections: Set<NativeBackupManifest.Section>,
                                   frequency: NativeBackupAutomaticState.Frequency) async throws {
        guard !backupOperationBusy else { throw Failure.busy }
        guard !sections.isEmpty, sections.isSubset(of: Self.supportedSections) else { throw Failure.unsupportedSelection }
        isRunningAutomaticBackup = true
        defer { isRunningAutomaticBackup = false }
        let authorization = UUID()
        let worker = Task.detached(priority: .utility) {
            try NativeBackupCloudStore().authorizeAutomaticUploads(authorization)
        }
        try await withTaskCancellationHandler {
            try await worker.value
        } onCancel: { worker.cancel() }
        try Task.checkCancellation()
        try automaticStore.save(.init(authorization: authorization, sections: sections, frequency: frequency))
    }

    func disableAutomaticBackups() throws {
        guard !backupOperationBusy else { throw Failure.busy }
        try automaticStore.disable()
    }

    /// Intended for an active foreground app. iOS does not guarantee a
    /// scheduled execution while the app is closed. No restoration runs here.
    /// The caller must pass the active stores and a foreground/quiescence gate.
    func runAutomaticBackupIfDue(reader: NativeReaderLibrary,
                                 podcastLibrary: NativePodcastLibrary? = nil,
                                 podcastDownloads: NativePodcastDownloads? = nil,
                                 favorites: NativeFavoritesStore? = nil,
                                 activity: NativeReadingActivity? = nil,
                                 now: Date = Date(),
                                 canCollectSnapshot: () -> Bool) async throws -> AutomaticResult {
        guard !backupOperationBusy else { return .deferred }
        guard var policy = try automaticStore.load() else { return .disabled }
        let decision = policy.decision(at: now)
        let generation: UUID
        switch decision {
        case .wait: return .notDue
        case .create(let id), .resume(let id): generation = id
        }
        guard canCollectSnapshot(), NativeRemotePlaybackOwner.current == nil,
              reader.readyForGlobalRestore, NativeMusicBackupAdapter.readyForRestore,
              podcastLibrary?.readyForGlobalRestore ?? true,
              podcastDownloads?.downloadingID == nil else { return .deferred }
        isRunningAutomaticBackup = true
        defer { isRunningAutomaticBackup = false }
        guard try NativeBackupRestoreJournal.application.pending() == nil else {
            throw NativeBackupRestoreJournal.Failure.pendingRecovery
        }
        // Persist the reservation before any potentially interruptible work.
        try policy.recordAttempt(generation: generation, at: now)
        try automaticStore.save(policy)
        let authorization = policy.authorization
        let local = store
        let worker = Task.detached(priority: .utility) {
            try NativeBackupCloudStore().verifyAutomaticAuthorization(authorization)
            return try local.hasGeneration(generation)
        }
        let exists = try await withTaskCancellationHandler {
            try await worker.value
        } onCancel: { worker.cancel() }
        try Task.checkCancellation()
        guard canCollectSnapshot() else { return .deferred }
        if !exists {
            _ = try await createGeneration(sections: policy.sections, generation: generation, reader: reader,
                podcastLibrary: podcastLibrary, podcastDownloads: podcastDownloads, favorites: favorites, activity: activity)
        }
        try Task.checkCancellation()
        guard canCollectSnapshot() else { return .deferred }
        let uploaded = try await uploadGeneration(generation: generation, automaticAuthorization: authorization)
        if uploaded == .uploaded {
            try policy.markUploaded(generation: generation, at: Date())
            try automaticStore.save(policy)
            return .completed(generation)
        }
        // The next due check will retry exactly this generation. Never
        // discard it because iCloud has not acknowledged all artifacts yet.
        return .pending(generation)
    }

    func synchronizedHistory() async throws -> SynchronizedHistory {
        let here = try await history()
        let there = try await iCloudHistory()
        let remote = there.entries.map { entry -> NativeBackupSyncPolicy.Remote in
            let status: NativeBackupSyncPolicy.Availability
            switch entry.uploadState {
            case .uploaded: status = .cloudOnly
            case .pending: status = .awaitingCloud
            case .conflicted: status = .conflict
            case .failed: status = .failed
            }
            return .init(generation: entry.generation, manifest: entry.manifest, state: status)
        }
        let entries = NativeBackupSyncPolicy.history(local: here, remote: remote)
        let pending = try automaticStore.load()?.pending
        return SynchronizedHistory(entries: entries,
            initialMetadataGatheringComplete: there.initialMetadataGatheringComplete,
            localSpaceCandidates: NativeBackupSyncPolicy.localSpaceCandidates(history: entries,
                pending: pending, remoteHistoryComplete: there.initialMetadataGatheringComplete))
    }

    func iCloudHistory() async throws -> NativeBackupCloudStore.History {
        let worker = Task.detached(priority: .utility) { try await NativeBackupCloudStore().history() }
        return try await withTaskCancellationHandler {
            try await worker.value
        } onCancel: { worker.cancel() }
    }

    /// Download and verify without changing the current live libraries.
    /// The ordinary local restore entry point handles confirmation/rollback.
    func downloadFromICloud(generation: UUID) async throws -> NativeBackupManifest {
        guard !backupOperationBusy else { throw Failure.busy }
        isTransferringCloudBackup = true
        defer { isTransferringCloudBackup = false }
        let local = store
        let worker = Task.detached(priority: .utility) {
            try await NativeBackupCloudStore().importGeneration(generation, local: local) { section, url in
                try NativeBackupSectionArchive.verifyContentsForRestore(section: section, source: url)
            }
        }
        return try await withTaskCancellationHandler {
            try await worker.value
        } onCancel: { worker.cancel() }
    }

    /// Verify the complete generation and every selected section before any
    /// future restore operation. A successful preflight is not a restore.
    func preflightRestore(generation: UUID) async throws -> NativeBackupManifest {
        guard !backupOperationBusy else { throw Failure.busy }
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
        let excludedPodcastReferences: Int
        let omittedPodcastPositions: Int
        let omittedReadingHistory: Int
        let omittedCinemaHistory: Int

        var omissionSummary: RestoreOmissionSummary {
            RestoreOmissionSummary(podcastIDs: pendingPodcastDownloads.map(\.id).sorted(),
                radioIDs: unresolvedRadioStations.map(\.stationID).sorted(),
                settings: omittedSettings.sorted(), music: omittedMusicProfilesAndRules.sorted(),
                excludedPodcastReferences: excludedPodcastReferences, podcastPositions: omittedPodcastPositions,
                readingHistory: omittedReadingHistory, cinemaHistory: omittedCinemaHistory)
        }

        var hasOmissions: Bool {
            !pendingPodcastDownloads.isEmpty || !unresolvedRadioStations.isEmpty ||
            !omittedSettings.isEmpty || !omittedMusicProfilesAndRules.isEmpty ||
            excludedPodcastReferences > 0 || omittedPodcastPositions > 0 || omittedReadingHistory > 0 || omittedCinemaHistory > 0
        }
    }

    /// Approval is scoped to the precise omissions presented to the user.
    /// A retry must not silently accept new omissions after staging again.
    struct RestoreOmissionSummary: Equatable {
        let podcastIDs: [String]
        let radioIDs: [String]
        let settings: [String]
        let music: [String]
        let excludedPodcastReferences: Int
        let podcastPositions: Int
        let readingHistory: Int
        let cinemaHistory: Int
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
                                approvedOmissions: RestoreOmissionSummary? = nil,
                                liveStoresAreQuiescent: () -> Bool) async throws -> RestoreReport {
        guard !backupOperationBusy else { throw Failure.busy }
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
        guard liveStoresAreQuiescent(), NativeRemotePlaybackOwner.current == nil,
              reader.readyForGlobalRestore, NativeMusicBackupAdapter.readyForRestore,
              podcastLibrary?.readyForGlobalRestore ?? true,
              podcastDownloads?.downloadingID == nil else { throw Failure.liveStoresNotQuiescent }
        let selected = Set(manifest.artifacts.map(\.section))
        guard Set(staged.keys) == selected else { throw Failure.unsupportedSelection }
        let recovery = NativeBackupRecoveryBuilder()
        let journal = NativeBackupRestoreJournal.application
        guard try journal.pending() == nil else { throw NativeBackupRestoreJournal.Failure.pendingRecovery }
        var steps: [NativeBackupRestoreTransaction.Step<NativeBackupManifest.Section>] = []
        var downloads: [NativeDownloadedPodcastEpisode] = []
        var stations: [NativeRadioBackupEntry] = []
        var settings: [String] = [], music: [String] = []
        var podcastPositions = 0, readingHistory = 0, cinemaHistory = 0, excludedPodcastReferences = 0
        let decoder = JSONDecoder()
        // No await or live mutation between snapshot preparation and commit.
        for section in NativeBackupManifest.Section.allCases {
            guard let url = staged[section] else { continue }
            try Task.checkCancellation()
            switch section {
            case .reader:
                steps.append(try reader.prepareGlobalBackupRestore(staging: url, recovery: recovery))
            case .music:
                let (step, omitted) = try NativeMusicBackupAdapter.prepareRestore(staging: url, recovery: recovery)
                steps.append(step); music = omitted
            case .cinema:
                let (step, omitted) = try NativeCinemaLocalLibrary.shared.prepareGlobalBackupRestore(staging: url, recovery: recovery)
                steps.append(step); cinemaHistory = omitted
            case .podcasts:
                guard let podcastLibrary, let podcastDownloads else { throw Failure.missingLiveStore }
                guard podcastDownloads.downloadingID == nil else { throw Failure.liveStoresNotQuiescent }
                let snapshot = try decoder.decode(NativePodcastBackupSnapshot.self,
                    from: Data(contentsOf: url.appendingPathComponent("snapshot.json")))
                let ids = Set(podcastDownloads.entries.filter {
                    podcastDownloads.localURL(for: $0.id) != nil
                }.map(\.id))
                let (step, plan) = try podcastLibrary.prepareBackupRestore(snapshot, downloadedIDs: ids, recovery: recovery)
                steps.append(step); downloads = plan.downloadReferences; podcastPositions = plan.progressNotImported
                excludedPodcastReferences = snapshot.excludedReferences
            case .radio:
                let snapshot = try decoder.decode(NativeRadioBackupSnapshot.self,
                    from: Data(contentsOf: url.appendingPathComponent("snapshot.json")))
                let (step, plan) = try NativeRadioBackupAdapter.prepareBackupRestore(snapshot, recovery: recovery)
                steps.append(step); stations = plan.unresolved
            case .preferences:
                guard let favorites, let activity else { throw Failure.missingLiveStore }
                let snapshot = try decoder.decode(NativeBackupPreferencesSnapshot.self,
                    from: Data(contentsOf: url.appendingPathComponent("snapshot.json")))
                let plan = try NativeBackupPreferencesRestore.prepare(snapshot, favorites: favorites, activity: activity, recovery: recovery)
                steps.append(plan.step); settings = plan.omittedKeys; readingHistory = plan.historyNotImported
            }
        }
        let report = RestoreReport(manifest: manifest, pendingPodcastDownloads: downloads,
            unresolvedRadioStations: stations, omittedSettings: settings, omittedMusicProfilesAndRules: music,
            excludedPodcastReferences: excludedPodcastReferences,
            omittedPodcastPositions: podcastPositions, omittedReadingHistory: readingHistory,
            omittedCinemaHistory: cinemaHistory)
        let omissions = report.omissionSummary
        guard !report.hasOmissions || approvedOmissions == omissions else { throw Failure.incompleteRestore(report) }
        guard liveStoresAreQuiescent(), NativeRemotePlaybackOwner.current == nil,
              reader.readyForGlobalRestore, NativeMusicBackupAdapter.readyForRestore,
              podcastLibrary?.readyForGlobalRestore ?? true,
              podcastDownloads?.downloadingID == nil else { throw Failure.liveStoresNotQuiescent }
        let payload = try recovery.payload()
        let encoder = PropertyListEncoder()
        encoder.outputFormat = .binary
        try journal.begin(.init(generation: generation, recoveryPayload: encoder.encode(payload)))
        do {
            try NativeBackupRestoreTransaction.execute(expected: selected, steps: steps)
        } catch {
            if !(error is NativeBackupRestoreTransaction.Failure<NativeBackupManifest.Section>) {
                // All attempted steps rolled back. Retain the record if defaults
                // could not be flushed; a restart will replay the before-state.
                if UserDefaults.standard.synchronize() { try journal.finish(generation: generation) }
            }
            throw error
        }
        guard UserDefaults.standard.synchronize() else { throw NativeBackupRecoveryPayload.Failure.invalidPreference }
        try journal.finish(generation: generation)
        return report
    }
}
