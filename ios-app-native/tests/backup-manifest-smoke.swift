import Foundation

@main
struct BackupManifestSmoke {
    static func main() throws {
        let fm = FileManager.default
        let root = fm.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
        try fm.createDirectory(at: root, withIntermediateDirectories: false)
        defer { try? fm.removeItem(at: root) }
        let file = root.appendingPathComponent("reader.zip")
        try Data("abc".utf8).write(to: file)
        let entry = try NativeBackupManifest.fingerprint(section: .reader, file: file)
        precondition(entry.byteCount == 3)
        precondition(entry.sha256 == "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad")
        let manifest = NativeBackupManifest(artifacts: [entry])
        let decoded = try JSONDecoder().decode(NativeBackupManifest.self, from: JSONEncoder().encode(manifest))
        precondition(decoded == manifest)
        try decoded.verifyArtifacts(in: root)
        try Data("abd".utf8).write(to: file)
        do {
            try decoded.verifyArtifacts(in: root)
            fatalError("Changed file passed integrity verification")
        } catch NativeBackupManifest.Failure.integrityMismatch {}
        do {
            try NativeBackupManifest(artifacts: [entry, entry]).validate()
            fatalError("Duplicate section accepted")
        } catch NativeBackupManifest.Failure.invalidManifest {}
        let link = root.appendingPathComponent("music.zip")
        try fm.createSymbolicLink(at: link, withDestinationURL: file)
        do {
            _ = try NativeBackupManifest.fingerprint(section: .music, file: link)
            fatalError("Symbolic link accepted")
        } catch NativeBackupManifest.Failure.notRegularFile {}
        try fm.removeItem(at: file)
        do {
            try decoded.verifyArtifacts(in: root)
            fatalError("Missing file accepted")
        } catch {}
        let store = NativeBackupGenerationStore(root: root.appendingPathComponent("generations"))
        let archive = root.appendingPathComponent("staged-reader.zip")
        try Data("first version".utf8).write(to: archive)
        let first = try store.publish(archives: [.reader: archive],
                                      createdAt: Date(timeIntervalSince1970: 100))
        try Data("second version".utf8).write(to: archive)
        let second = try store.publish(archives: [.reader: archive],
                                       createdAt: Date(timeIntervalSince1970: 200))
        let history = try store.history()
        precondition(history.map(\.generation) == [second.generation, first.generation])
        let (verified, directory) = try store.verifiedGeneration(first.generation)
        precondition(verified == first)
        let original = try Data(contentsOf: directory.appendingPathComponent("reader.zip"))
        precondition(original == Data("first version".utf8))
        do {
            _ = try store.publish(archives: [.reader: archive], generation: first.generation)
            fatalError("Existing generation replaced")
        } catch NativeBackupGenerationStore.Failure.duplicateGeneration {}
        do {
            _ = try store.publish(archives: [.reader: archive, .music: root.appendingPathComponent("missing.zip")])
            fatalError("Missing staged archive accepted")
        } catch {}
        let afterFailure = try store.history()
        precondition(afterFailure == history)
        let stagedDirectories = try fm.contentsOfDirectory(atPath: store.root.path)
        precondition(!stagedDirectories.contains(where: { $0.hasPrefix(".staging-") }))
        try Data("tampered".utf8).write(to: directory.appendingPathComponent("reader.zip"))
        do {
            _ = try store.verifiedGeneration(first.generation)
            fatalError("Damaged backup accepted")
        } catch NativeBackupManifest.Failure.integrityMismatch {}
        _ = try store.verifiedGeneration(second.generation)
        print("Backup manifest integrity smoke checks passed")
    }
}
