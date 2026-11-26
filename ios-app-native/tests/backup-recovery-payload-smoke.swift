import Foundation
@main
struct BackupRecoveryPayloadSmoke {
    static func main() throws {
        let fm = FileManager.default
        let root = fm.temporaryDirectory.appendingPathComponent("payload-smoke-" + UUID().uuidString)
        let support = root.appendingPathComponent("Support")
        let documents = root.appendingPathComponent("Documents")
        try fm.createDirectory(at: support, withIntermediateDirectories: true)
        try fm.createDirectory(at: documents, withIntermediateDirectories: true)
        defer { try? fm.removeItem(at: root) }
        let roots = NativeBackupRecoveryPayload.Roots(support: support, documents: documents)
        let suite = "backup-recovery-smoke-" + UUID().uuidString
        let defaults = UserDefaults(suiteName: suite)!
        defer { defaults.removePersistentDomain(forName: suite) }
        let key = "native-reader-folders"
        defaults.set(["old"], forKey: key)
        let absentKey = "native-ios-strong-text"
        let index = support.appendingPathComponent("NativeReaderDocuments.json")
        let old = Data("before".utf8)
        try old.write(to: index)
        let media = support.appendingPathComponent("ReaderMedia").appendingPathComponent(UUID().uuidString)
        let builder = NativeBackupRecoveryBuilder(roots: roots)
        try builder.recordFiles(indexes: [(index, old)], targets: [media])
        builder.recordDefaults([key, absentKey])
        builder.recordPreserved(section: "reader", kind: "document", identifiers: ["same", "same", "different"])
        builder.recordPreserved(section: "music", kind: "track", identifiers: ["same"])
        let preserved = builder.preservedIdentities
        precondition(preserved.count == 3)
        precondition(preserved.allSatisfy { $0.digest.count == 64 && $0.digest != "same" })
        precondition(preserved.first?.section == "music")
        let payload = try builder.payload(defaults: defaults)
        let journal = NativeBackupRestoreJournal(url: root.appendingPathComponent("pending.plist"))
        let encoder = PropertyListEncoder()
        try journal.begin(.init(generation: UUID(), recoveryPayload: encoder.encode(payload)))
        try Data("after".utf8).write(to: index)
        try fm.createDirectory(at: media, withIntermediateDirectories: true)
        defaults.set(["new"], forKey: key)
        defaults.set(true, forKey: absentKey)
        try journal.recover { record in
            let recovered = try PropertyListDecoder().decode(NativeBackupRecoveryPayload.self, from: record.recoveryPayload)
            try recovered.replay(roots: roots, defaults: defaults)
        }
        let bytes = try Data(contentsOf: index)
        precondition(bytes == old)
        precondition(!fm.fileExists(atPath: media.path))
        precondition(defaults.stringArray(forKey: key) == ["old"])
        precondition(defaults.object(forKey: absentKey) == nil)
        let pending = try journal.pending()
        precondition(pending == nil)
        let invalid = NativeBackupRecoveryPayload(indexes: [.init(path: .init(root: .support, relative: "../secret"), before: nil)],
            newMedia: [], preferences: [])
        do {
            try invalid.replay(roots: roots, defaults: defaults)
            fatalError("Unsafe path accepted")
        } catch NativeBackupRecoveryPayload.Failure.invalidPath {}
        let forbidden = NativeBackupRecoveryBuilder(roots: roots)
        forbidden.recordDefaults(["credential-secret"])
        do {
            _ = try forbidden.payload(defaults: defaults)
            fatalError("Unlisted default accepted")
        } catch NativeBackupRecoveryPayload.Failure.invalidPreference {}
        print("Interrupted restore payload replay and allowlist smoke passed")
    }
}
