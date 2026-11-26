import Foundation

@main
struct BackupRestoreJournalSmoke {
    enum SampleError: Error { case interrupted }
    static func main() throws {
        let fm = FileManager.default
        let root = fm.temporaryDirectory.appendingPathComponent("journal-smoke-" + UUID().uuidString)
        try fm.createDirectory(at: root, withIntermediateDirectories: false)
        defer { try? fm.removeItem(at: root) }
        let journal = NativeBackupRestoreJournal(url: root.appendingPathComponent("pending.plist"))
        let generation = UUID()
        let record = NativeBackupRestoreJournal.Record(generation: generation, recoveryPayload: Data("before".utf8))
        let empty = try journal.pending()
        precondition(empty == nil)
        try journal.begin(record)
        let reopened = NativeBackupRestoreJournal(url: journal.url)
        let loaded = try reopened.pending()
        precondition(loaded == record)
        do {
            try journal.begin(record)
            fatalError("Pending journal replaced")
        } catch NativeBackupRestoreJournal.Failure.pendingRecovery {}
        do {
            try journal.finish(generation: UUID())
            fatalError("Wrong generation cleared journal")
        } catch NativeBackupRestoreJournal.Failure.mismatchedGeneration {}
        do {
            try reopened.recover { _ in throw SampleError.interrupted }
            fatalError("Replay failure ignored")
        } catch SampleError.interrupted {}
        let retained = try reopened.pending()
        precondition(retained == record)
        try reopened.recover { precondition($0 == record) }
        let recovered = try reopened.pending()
        precondition(recovered == nil)
        try Data("invalid".utf8).write(to: journal.url)
        do {
            try journal.begin(record)
            fatalError("Corrupt journal replaced")
        } catch {}
        let corrupt = try Data(contentsOf: journal.url)
        precondition(corrupt == Data("invalid".utf8))
        print("Restore journal lifecycle smoke passed")
    }
}
