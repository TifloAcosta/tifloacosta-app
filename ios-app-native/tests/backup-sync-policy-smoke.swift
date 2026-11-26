import Foundation

@main
struct BackupSyncPolicySmoke {
    static func main() throws {
        let date = Date(timeIntervalSince1970: 1_700_000_000)
        func manifest(_ section: NativeBackupManifest.Section, at offset: TimeInterval, id: UUID = UUID(), digest: String = "a") -> NativeBackupManifest {
            .init(generation: id, createdAt: date.addingTimeInterval(offset),
                  artifacts: [.init(section: section, byteCount: 1, sha256: String(repeating: digest, count: 64))])
        }
        let older = manifest(.reader, at: 0), newer = manifest(.reader, at: 10), newest = manifest(.reader, at: 20)
        let music = manifest(.music, at: 0), cloudOnly = manifest(.cinema, at: 5)
        let pending = manifest(.radio, at: 2), collision = manifest(.preferences, at: 8)
        let conflict = manifest(.preferences, at: 8, id: collision.generation, digest: "b")
        let history = NativeBackupSyncPolicy.history(local: [older, newer, newest, music, pending, collision], remote: [
            .init(generation: older.generation, manifest: older, state: .cloudOnly),
            .init(generation: newer.generation, manifest: newer, state: .cloudOnly),
            .init(generation: newest.generation, manifest: newest, state: .cloudOnly),
            .init(generation: music.generation, manifest: music, state: .cloudOnly),
            .init(generation: cloudOnly.generation, manifest: cloudOnly, state: .cloudOnly),
            .init(generation: pending.generation, manifest: nil, state: .awaitingCloud),
            .init(generation: collision.generation, manifest: conflict, state: .cloudOnly)
        ])
        precondition(history.count == 7)
        precondition(history.first(where: { $0.generation == collision.generation })?.availability == .conflict)
        precondition(history.first(where: { $0.generation == cloudOnly.generation })?.canRequestCloudRestore == true)
        precondition(history.first(where: { $0.generation == pending.generation })?.canRequestCloudRestore == false)
        precondition(NativeBackupSyncPolicy.localSpaceCandidates(history: history, pending: nil,
            remoteHistoryComplete: true) == [older.generation])
        precondition(NativeBackupSyncPolicy.localSpaceCandidates(history: history, pending: older.generation,
            remoteHistoryComplete: true).isEmpty)
        precondition(NativeBackupSyncPolicy.localSpaceCandidates(history: history, pending: nil,
            remoteHistoryComplete: false).isEmpty)

        let root = FileManager.default.temporaryDirectory.appendingPathComponent("auto-policy-" + UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let store = NativeBackupAutomaticStateStore(url: root.appendingPathComponent("state.json"))
        let disabled = try store.load()
        precondition(disabled == nil)
        let id = UUID(), marker = UUID()
        var policy = NativeBackupAutomaticState(authorization: marker, sections: [.reader, .music], frequency: .daily)
        precondition(policy.decision(at: date, nextID: id) == .create(id))
        try policy.recordAttempt(generation: id, at: date)
        try store.save(policy)
        let resumed = try store.load()!
        precondition(resumed == policy)
        precondition(resumed.decision(at: date.addingTimeInterval(60)) == .wait)
        precondition(resumed.decision(at: date.addingTimeInterval(1801)) == .resume(id))
        precondition(resumed.decision(at: date.addingTimeInterval(-1)) == .resume(id))
        do {
            try policy.markUploaded(generation: UUID(), at: date)
            fatalError("Different generation marked complete")
        } catch NativeBackupAutomaticStateStore.Failure.invalidState {}
        try policy.markUploaded(generation: id, at: date)
        precondition(policy.decision(at: date.addingTimeInterval(3600)) == .wait)
        precondition(policy.decision(at: date.addingTimeInterval(86401), nextID: id) == .create(id))
        try store.save(policy)
        try store.disable()
        let afterDisable = try store.load()
        precondition(afterDisable == nil)
        try Data("invalid state".utf8).write(to: store.url)
        do {
            _ = try store.load()
            fatalError("Invalid policy enabled")
        } catch {}
        try store.disable()
        print("Backup history conflicts, conservative retention, opt-in and resumable schedule smoke passed")
    }
}
