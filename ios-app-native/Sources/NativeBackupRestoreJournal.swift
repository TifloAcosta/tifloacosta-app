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
        // FileManager attributes are read afresh; URL.resourceValues may
        // cache the old file identity after a successful removal/rename.
        // Unlike fileExists, attributes distinguish absent from unreadable.
        let attributes: [FileAttributeKey: Any]
        do {
            attributes = try fm.attributesOfItem(atPath: url.path)
        } catch {
            let error = error as NSError
            if error.domain == NSCocoaErrorDomain &&
                [NSFileNoSuchFileError, NSFileReadNoSuchFileError].contains(error.code) { return nil }
            if error.domain == NSPOSIXErrorDomain && error.code == 2 { return nil }
            throw error
        }
        guard attributes[.type] as? FileAttributeType == .typeRegular,
              let count = (attributes[.size] as? NSNumber)?.int64Value,
              count > 0, count <= Int64(Self.maximumBytes) else {
            throw Failure.invalidRecord
        }
        let fresh = URL(fileURLWithPath: url.path)
        let record = try PropertyListDecoder().decode(Record.self, from: Data(contentsOf: fresh))
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
        var directory = url.deletingLastPathComponent()
        try fm.createDirectory(at: directory, withIntermediateDirectories: true)
        let attributes = try fm.attributesOfItem(atPath: directory.path)
        guard attributes[.type] as? FileAttributeType == .typeDirectory else { throw Failure.invalidRecord }
        #if os(iOS)
        // The journal may contain the previous live state, including local-only
        // values that are not eligible for export. Never include it in iOS
        // device backups or in the app's explicit iCloud generations.
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        try directory.setResourceValues(values)
        try fm.setAttributes([.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication],
                             ofItemAtPath: directory.path)
        #endif
        let temporary = directory
            .appendingPathComponent(".restore-journal-" + UUID().uuidString)
        defer { try? fm.removeItem(at: temporary) }
        #if os(iOS)
        try data.write(to: temporary, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
        #else
        try data.write(to: temporary, options: .atomic)
        #endif
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
