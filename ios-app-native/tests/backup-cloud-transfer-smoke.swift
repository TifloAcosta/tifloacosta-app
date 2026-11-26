import Foundation
@main
struct BackupCloudTransferSmoke {
    static func main() throws {
        let fm = FileManager.default
        let root = fm.temporaryDirectory.appendingPathComponent("cloud-smoke-" + UUID().uuidString)
        try fm.createDirectory(at: root, withIntermediateDirectories: false)
        defer { try? fm.removeItem(at: root) }
        let source = root.appendingPathComponent("source.zip")
        try Data("backup bytes".utf8).write(to: source)
        let local = NativeBackupGenerationStore(root: root.appendingPathComponent("Local", isDirectory: true))
        let manifest = try local.publish(archives: [.reader: source])
        let (_, directory) = try local.verifiedGeneration(manifest.generation)
        let remote = root.appendingPathComponent("remote", isDirectory: true)
        try fm.createDirectory(at: remote, withIntermediateDirectories: false)
        try NativeBackupGenerationTransfer.stage(manifest, into: remote) { item, url in
            try NativeBackupGenerationTransfer.copyArtifact(item, source: directory.appendingPathComponent(item.filename), target: url)
        }
        // Simulate another device with a completely independent local store.
        let restored = NativeBackupGenerationStore(root: root.appendingPathComponent("DeviceTwo", isDirectory: true))
        try fm.createDirectory(at: restored.root, withIntermediateDirectories: false)
        func stageImport() throws -> URL {
            let staged = restored.root.appendingPathComponent(".cloud-import-" + UUID().uuidString, isDirectory: true)
            try fm.createDirectory(at: staged, withIntermediateDirectories: false)
            let incoming = try NativeBackupGenerationTransfer.readManifest(remote.appendingPathComponent("manifest.json"), generation: manifest.generation)
            do {
                try NativeBackupGenerationTransfer.stage(incoming, into: staged) { item, target in
                    try NativeBackupGenerationTransfer.copyArtifact(item, source: remote.appendingPathComponent(item.filename), target: target)
                }
                return staged
            } catch {
                try? fm.removeItem(at: staged)
                throw error
            }
        }
        let staged = try stageImport()
        let imported = try restored.adoptVerifiedStaging(staged, manifest: manifest)
        precondition(imported == manifest)
        let duplicate = try stageImport()
        let again = try restored.adoptVerifiedStaging(duplicate, manifest: manifest)
        precondition(again == manifest)
        try fm.removeItem(at: duplicate)
        let list = try restored.history()
        precondition(list == [manifest])
        // Same byte count, different data: SHA verification must reject it.
        try Data(repeating: 65, count: Int(manifest.artifacts[0].byteCount)).write(to: remote.appendingPathComponent("reader.zip"))
        do {
            _ = try stageImport()
            fatalError("Corruption accepted")
        } catch NativeBackupManifest.Failure.integrityMismatch {}
        let (original, _) = try local.verifiedGeneration(manifest.generation)
        let (kept, _) = try restored.verifiedGeneration(manifest.generation)
        precondition(original == manifest && kept == manifest)
        do {
            _ = try NativeBackupGenerationTransfer.readManifest(remote.appendingPathComponent("manifest.json"), generation: UUID())
            fatalError("Mismatched generation accepted")
        } catch NativeBackupGenerationTransfer.Failure.generationMismatch {}
        let oversize = NativeBackupManifest(generation: manifest.generation, artifacts: [
            .init(section: .reader, byteCount: NativeBackupGenerationTransfer.maximumArtifactBytes + 1,
                  sha256: manifest.artifacts[0].sha256)
        ])
        do {
            try NativeBackupGenerationTransfer.validate(oversize, generation: manifest.generation)
            fatalError("Oversized generation accepted")
        } catch NativeBackupGenerationTransfer.Failure.sizeLimit {}
        precondition(NativeBackupCloudStore.containerIdentifier == "iCloud.com.tifloacosta.app")
        print("Cloud transport staging, second-device import, idempotency, corruption and limits passed")
    }
}
