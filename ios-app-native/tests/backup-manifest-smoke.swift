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
        print("Backup manifest integrity smoke checks passed")
    }
}
