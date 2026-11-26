import Foundation

/// A durable recovery record independent of the UI or live objects.
/// The application must replay a pending record before initializing stores.
/// Only an explicitly validated recovery callback may interpret the payload.
/// An unreadable record is a blocker, never permission to start a new restore.
struct NativeBackupRestoreJournal {
    struct Record: Codable, Equatable {
        let version: Int
        let generation: UUID
        let recoveryPayload: Data
        init(generation: UUID, recoveryPayload: Data) {
            self.version = 1
            self.generation = generation
            self.recoveryPayload = recoveryPayload
        }
    }

    enum Failure: Error { case pendingRecovery, invalidRecord, mismatchedGeneration }
    let url: URL
    static var application: Self {
        Self(url: FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("GlobalBackupRestore", isDirectory: true)
            .appendingPathComponent("pending.plist"))
    }
    private let fm = FileManager.default
    private static let maximumBytes = 512 * 1024 * 1024

    func pending() throws -> Record? {
        // resourceValues detects symlinks, including dangling links.
        let attributes: URLResourceValues
        do {
            attributes = try url.resourceValues(forKeys: [.isRegularFileKey, .isSymbolicLinkKey, .fileSizeKey])
        } catch {
            if (error as NSError).domain == NSCocoaErrorDomain &&
                (error as NSError).code == NSFileNoSuchFileError { return nil }
            if (error as NSError).domain == NSCocoaErrorDomain &&
                (error as NSError).code == NSFileReadNoSuchFileError { return nil }
            throw error
        }
        guard attributes.isRegularFile == true, attributes.isSymbolicLink == false,
              let count = attributes.fileSize, count > 0, count <= Self.maximumBytes else {
            throw Failure.invalidRecord
        }
        let record = try PropertyListDecoder().decode(Record.self, from: Data(contentsOf: url))
        guard record.version == 1, !record.recoveryPayload.isEmpty else { throw Failure.invalidRecord }
        return record
    }

    /// The caller must exclusively own this journal and provide a complete
    /// before-state. Publish before the first live mutation.
    func begin(_ record: Record) throws {
        guard try pending() == nil else { throw Failure.pendingRecovery }
        guard record.version == 1, !record.recoveryPayload.isEmpty,
              record.recoveryPayload.count <= Self.maximumBytes else { throw Failure.invalidRecord }
        let encoder = PropertyListEncoder()
        encoder.outputFormat = .binary
        let data = try encoder.encode(record)
        guard data.count <= Self.maximumBytes else { throw Failure.invalidRecord }
        try fm.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        let temporary = url.deletingLastPathComponent()
            .appendingPathComponent(".restore-journal-" + UUID().uuidString)
        defer { try? fm.removeItem(at: temporary) }
        try data.write(to: temporary, options: .atomic)
        let handle = try FileHandle(forWritingTo: temporary)
        defer { try? handle.close() }
        try handle.synchronize()
        try fm.moveItem(at: temporary, to: url)
    }

    /// Clear only the expected record, after successful commit or complete
    /// rollback. A failed replay deliberately leaves the record intact.
    func finish(generation: UUID) throws {
        guard let record = try pending(), record.generation == generation else {
            throw Failure.mismatchedGeneration
        }
        try fm.removeItem(at: url)
    }

    func recover(_ replay: (Record) throws -> Void) throws {
        guard let record = try pending() else { return }
        try replay(record)
        try finish(generation: record.generation)
    }
}
