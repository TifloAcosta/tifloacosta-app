import Foundation

/// iCloud Documents transport for immutable backup generations. All methods
/// perform disk/provider work off the UI actor. No automatic uploads or
/// destructive cloud operations are performed by this layer.
struct NativeBackupCloudStore {
    static let containerIdentifier = "iCloud.com.tifloacosta.app"
    static let directoryName = "GlobalBackupGenerations-v1"
    enum Failure: Error {
        case noAccount, containerUnavailable, accountChanged, conflict, unavailableItem, downloadTimedOut, invalidDirectory
    }
    enum UploadState: Equatable { case pending, uploaded, conflicted, failed }
    struct Entry {
        let generation: UUID
        let manifest: NativeBackupManifest?
        let uploadState: UploadState
    }
    private let fm = FileManager.default

    /// A token is only compared in memory. Never log or persist the Apple
    /// account identity. An account switch aborts the current operation.
    private struct Session {
        let token: NSObject
        let root: URL
    }

    private func session() throws -> Session {
        guard let token = fm.ubiquityIdentityToken as? NSObject else { throw Failure.noAccount }
        guard let container = fm.url(forUbiquityContainerIdentifier: Self.containerIdentifier)
        else { throw Failure.containerUnavailable }
        // Outside Documents: app-private iCloud data, not a public share.
        let root = container.appendingPathComponent(Self.directoryName, isDirectory: true)
        let result = Session(token: token, root: root)
        try check(result)
        return result
    }

    private func check(_ session: Session) throws {
        try Task.checkCancellation()
        guard let current = fm.ubiquityIdentityToken as? NSObject, current.isEqual(session.token)
        else { throw Failure.accountChanged }
    }

    private func read<T>(_ url: URL, _ body: @escaping (URL) throws -> T) throws -> T {
        let coordinator = NSFileCoordinator(filePresenter: nil)
        var coordinationError: NSError?
        var outcome: Result<T, Error>?
        coordinator.coordinate(readingItemAt: url, options: [], error: &coordinationError) { coordinated in
            outcome = Result { try body(coordinated) }
        }
        if let coordinationError { throw coordinationError }
        guard let outcome else { throw Failure.unavailableItem }
        return try outcome.get()
    }

    private func prepareRoot(_ session: Session) throws {
        try check(session)
        let coordinator = NSFileCoordinator(filePresenter: nil)
        var coordinationError: NSError?
        var outcome: Result<Void, Error>?
        coordinator.coordinate(writingItemAt: session.root, options: [], error: &coordinationError) { url in
            outcome = Result {
                try self.check(session)
                try self.fm.createDirectory(at: url, withIntermediateDirectories: true)
                let attrs = try self.fm.attributesOfItem(atPath: url.path)
                guard attrs[.type] as? FileAttributeType == .typeDirectory else { throw Failure.invalidDirectory }
            }
        }
        if let coordinationError { throw coordinationError }
        guard let outcome else { throw Failure.unavailableItem }
        try outcome.get()
    }

    private func itemValues(_ url: URL) throws -> URLResourceValues {
        // Fresh URL avoids cached upload/download values.
        let fresh = URL(fileURLWithPath: url.path)
        let values = try fresh.resourceValues(forKeys: [.isUbiquitousItemKey,
            .ubiquitousItemHasUnresolvedConflictsKey, .ubiquitousItemDownloadingStatusKey,
            .ubiquitousItemDownloadingErrorKey, .ubiquitousItemIsUploadedKey,
            .ubiquitousItemUploadingErrorKey])
        if values.ubiquitousItemHasUnresolvedConflicts == true { throw Failure.conflict }
        if let error = values.ubiquitousItemDownloadingError { throw error }
        if let error = values.ubiquitousItemUploadingError { throw error }
        return values
    }

    private func isMissing(_ error: Error) -> Bool {
        let value = error as NSError
        return (value.domain == NSCocoaErrorDomain &&
            [NSFileNoSuchFileError, NSFileReadNoSuchFileError].contains(value.code)) ||
            (value.domain == NSPOSIXErrorDomain && value.code == 2)
    }

    private func state(manifest: NativeBackupManifest, directory: URL, session: Session) throws -> UploadState {
        var allUploaded = true
        for name in ["manifest.json"] + manifest.artifacts.map(\.filename) {
            try check(session)
            do {
                let values = try itemValues(directory.appendingPathComponent(name))
                if values.isUbiquitousItem != true || values.ubiquitousItemIsUploaded != true { allUploaded = false }
            } catch {
                if isMissing(error) { allUploaded = false; continue }
                throw error
            }
        }
        return allUploaded ? .uploaded : .pending
    }

    /// Publish a disposable, independently verified copy. setUbiquitous moves
    /// only this staging directory, never the existing local generation.
    /// iCloud may still be uploading individual files when this returns.
    func upload(generation: UUID, local: NativeBackupGenerationStore) throws -> UploadState {
        let session = try session()
        let (manifest, source) = try local.verifiedGeneration(generation)
        try NativeBackupGenerationTransfer.validate(manifest, generation: generation)
        try prepareRoot(session)
        let target = session.root.appendingPathComponent(generation.uuidString, isDirectory: true)
        // If a remote generation exists, do not overwrite or delete it.
        if fm.fileExists(atPath: target.path) {
            let existing = try read(target.appendingPathComponent("manifest.json")) {
                try NativeBackupGenerationTransfer.readManifest($0, generation: generation)
            }
            guard existing == manifest else { throw Failure.conflict }
            return try state(manifest: existing, directory: target, session: session)
        }
        let staging = fm.temporaryDirectory.appendingPathComponent("cloud-upload-" + UUID().uuidString, isDirectory: true)
        try fm.createDirectory(at: staging, withIntermediateDirectories: false)
        defer { try? fm.removeItem(at: staging) }
        try NativeBackupGenerationTransfer.stage(manifest, into: staging) { item, url in
            try check(session)
            try NativeBackupGenerationTransfer.copyArtifact(item, source: source.appendingPathComponent(item.filename), target: url)
        }
        try check(session)
        guard !fm.fileExists(atPath: target.path) else { throw Failure.conflict }
        try fm.setUbiquitous(true, itemAt: staging, destinationURL: target)
        try check(session)
        return .pending
    }

    /// History is advisory. A manifest can arrive before an archive. An
    /// uploaded status is not a substitute for verification before restore.
    func history() throws -> [Entry] {
        let session = try session()
        try prepareRoot(session)
        let directories = try read(session.root) {
            try self.fm.contentsOfDirectory(at: $0, includingPropertiesForKeys: nil, options: [.skipsHiddenFiles])
        }
        var result: [Entry] = []
        for directory in directories {
            try check(session)
            guard let generation = UUID(uuidString: directory.lastPathComponent),
                  generation.uuidString == directory.lastPathComponent else { continue }
            let manifestURL = directory.appendingPathComponent("manifest.json")
            // Listing never downloads the whole copy or blocks on large archives.
            var manifest: NativeBackupManifest?
            let uploadState: UploadState
            do {
                let values = try itemValues(manifestURL)
                if values.ubiquitousItemDownloadingStatus == .current {
                    let found = try read(manifestURL) {
                        try NativeBackupGenerationTransfer.readManifest($0, generation: generation)
                    }
                    manifest = found
                    uploadState = try state(manifest: found, directory: directory, session: session)
                } else {
                    try fm.startDownloadingUbiquitousItem(at: manifestURL)
                    uploadState = .pending
                }
            } catch Failure.conflict {
                uploadState = .conflicted
            } catch {
                try check(session)
                if isMissing(error) {
                    try? fm.startDownloadingUbiquitousItem(at: manifestURL)
                    uploadState = .pending
                } else {
                    uploadState = .failed
                }
            }
            result.append(.init(generation: generation, manifest: manifest, uploadState: uploadState))
        }
        try check(session)
        return result.sorted {
            let a = $0.manifest?.createdAt ?? .distantPast, b = $1.manifest?.createdAt ?? .distantPast
            if a != b { return a > b }
            return $0.generation.uuidString < $1.generation.uuidString
        }
    }

    private func download(_ url: URL, session: Session) async throws {
        try check(session)
        try fm.startDownloadingUbiquitousItem(at: url)
        let clock = ContinuousClock()
        let deadline = clock.now.advanced(by: .seconds(1800))
        while true {
            try check(session)
            let values = try itemValues(url)
            if values.ubiquitousItemDownloadingStatus == .current { return }
            guard clock.now < deadline else { throw Failure.downloadTimedOut }
            try await Task.sleep(nanoseconds: 1_000_000_000)
        }
    }

    /// Download each expected artifact into private local staging. The
    /// original cloud copy stays untouched. Only a verified local generation
    /// is published; applying it to live stores is a separate operation.
    func importGeneration(_ generation: UUID, local: NativeBackupGenerationStore,
                          validateSection: (NativeBackupManifest.Section, URL) throws -> Void) async throws -> NativeBackupManifest {
        let session = try session()
        let directory = session.root.appendingPathComponent(generation.uuidString, isDirectory: true)
        let manifestURL = directory.appendingPathComponent("manifest.json")
        try await download(manifestURL, session: session)
        let manifest = try read(manifestURL) {
            try NativeBackupGenerationTransfer.readManifest($0, generation: generation)
        }
        try fm.createDirectory(at: local.root, withIntermediateDirectories: true)
        let staging = local.root.appendingPathComponent(".cloud-import-" + UUID().uuidString, isDirectory: true)
        try fm.createDirectory(at: staging, withIntermediateDirectories: false)
        defer { try? fm.removeItem(at: staging) }
        try NativeBackupGenerationTransfer.requireSpace(for: manifest, at: staging)
        for item in manifest.artifacts {
            try check(session)
            let source = directory.appendingPathComponent(item.filename)
            try await download(source, session: session)
            try read(source) { coordinated in
                try self.check(session)
                _ = try self.itemValues(coordinated)
                try NativeBackupGenerationTransfer.copyArtifact(item, source: coordinated,
                    target: staging.appendingPathComponent(item.filename))
            }
        }
        try manifest.verifyArtifacts(in: staging)
        for item in manifest.artifacts {
            try check(session)
            try validateSection(item.section, staging.appendingPathComponent(item.filename))
        }
        try JSONEncoder().encode(manifest).write(to: staging.appendingPathComponent("manifest.json"), options: .atomic)
        try check(session)
        // Check the manifest again to reject conflicts or a changed generation.
        let latest = try read(manifestURL) {
            _ = try self.itemValues($0)
            return try NativeBackupGenerationTransfer.readManifest($0, generation: generation)
        }
        guard latest == manifest else { throw Failure.conflict }
        try check(session)
        return try local.adoptVerifiedStaging(staging, manifest: manifest)
    }
}
