import Foundation

@main
struct BackupFileRestoreSmoke {
    enum SampleError: Error { case laterSection }
    static func main() throws {
        let fm = FileManager.default
        let root = fm.temporaryDirectory.appendingPathComponent("restore-smoke-" + UUID().uuidString)
        try fm.createDirectory(at: root, withIntermediateDirectories: false)
        defer { try? fm.removeItem(at: root) }
        let source = root.appendingPathComponent("staged")
        let target = root.appendingPathComponent("media")
        let index = root.appendingPathComponent("index.json")
        let absent = root.appendingPathComponent("new-index.json")
        let old = Data("old".utf8), new = Data("new".utf8)
        try old.write(to: index)
        try new.write(to: source)
        let plan = try NativeBackupFileRestore(moves: [.init(source: source, target: target)],
            indexes: [(index, new), (absent, new)])
        try plan.apply()
        let live = try Data(contentsOf: index)
        precondition(live == new && fm.fileExists(atPath: target.path) && fm.fileExists(atPath: absent.path))
        try plan.rollback()
        let restored = try Data(contentsOf: index)
        precondition(restored == old && !fm.fileExists(atPath: target.path) && !fm.fileExists(atPath: absent.path))
        try plan.rollback()

        try new.write(to: source)
        try old.write(to: target)
        do {
            _ = try NativeBackupFileRestore(moves: [.init(source: source, target: target)], indexes: [])
            fatalError("Existing media accepted")
        } catch {}
        let preserved = try Data(contentsOf: target)
        precondition(preserved == old)
        try fm.removeItem(at: target)
        let second = try NativeBackupFileRestore(moves: [.init(source: source, target: target)],
            indexes: [(index, new)])
        let steps: [NativeBackupRestoreTransaction.Step<String>] = [
            .init(section: "media", apply: { try second.apply() }, rollback: { try second.rollback() }),
            .init(section: "later", apply: { throw SampleError.laterSection }, rollback: {})
        ]
        do {
            try NativeBackupRestoreTransaction.execute(expected: ["media", "later"], steps: steps)
            fatalError("Failed section reported success")
        } catch SampleError.laterSection {}
        let reverted = try Data(contentsOf: index)
        precondition(reverted == old && !fm.fileExists(atPath: target.path))

        try new.write(to: source)
        let collision = try NativeBackupFileRestore(moves: [.init(source: source, target: target)],
            indexes: [(index, new)])
        try old.write(to: target)
        do {
            try collision.apply()
            fatalError("Late collision accepted")
        } catch {}
        try collision.rollback()
        let final = try Data(contentsOf: target)
        precondition(final == old)
        print("Four media restore smoke scenarios passed")
    }
}
