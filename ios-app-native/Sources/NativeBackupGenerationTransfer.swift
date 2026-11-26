import Foundation

/// Transport copies only immutable, explicitly selected artifacts. No live
/// library directories, credentials, or arbitrary contents enter the cloud.
enum NativeBackupGenerationTransfer {
    enum Failure: Error { case sizeLimit, unexpectedFile, generationMismatch, insufficientSpace }
    static let maximumManifestBytes: Int64 = 64 * 1024
    static let maximumArtifactBytes: Int64 = 5 * 1024 * 1024 * 1024
    static let maximumGenerationBytes: Int64 = 9 * 1024 * 1024 * 1024

    static func validate(_ manifest: NativeBackupManifest, generation: UUID) throws {
        try manifest.validate()
        guard manifest.generation == generation else { throw Failure.generationMismatch }
        var total: Int64 = 0
        for item in manifest.artifacts {
            guard item.byteCount <= maximumArtifactBytes else { throw Failure.sizeLimit }
            let (next, overflow) = total.addingReportingOverflow(item.byteCount)
            guard !overflow, next <= maximumGenerationBytes else { throw Failure.sizeLimit }
            total = next
        }
    }

    static func readManifest(_ source: URL, generation: UUID) throws -> NativeBackupManifest {
        let attributes = try FileManager.default.attributesOfItem(atPath: source.path)
        guard attributes[.type] as? FileAttributeType == .typeRegular,
              let count = (attributes[.size] as? NSNumber)?.int64Value,
              count > 0, count <= maximumManifestBytes else { throw Failure.unexpectedFile }
        let handle = try FileHandle(forReadingFrom: source)
        defer { try? handle.close() }
        let bytes = try handle.read(upToCount: Int(maximumManifestBytes) + 1) ?? Data()
        guard bytes.count == Int(count) else { throw Failure.sizeLimit }
        let manifest = try JSONDecoder().decode(NativeBackupManifest.self, from: bytes)
        try validate(manifest, generation: generation)
        return manifest
    }

    static func requireSpace(for manifest: NativeBackupManifest, at directory: URL) throws {
        try validate(manifest, generation: manifest.generation)
        let bytes = manifest.artifacts.reduce(Int64(0)) { $0 + $1.byteCount }
        let values = try FileManager.default.attributesOfFileSystem(forPath: directory.path)
        if let available = (values[.systemFreeSize] as? NSNumber)?.int64Value, bytes > available {
            throw Failure.insufficientSpace
        }
    }

    /// Bounded streaming copy, never trust advertised file length alone. The
    /// caller coordinates the remote file and owns the private destination.
    static func copyArtifact(_ item: NativeBackupManifest.Artifact, source: URL, target: URL) throws {
        let fm = FileManager.default
        let attrs = try fm.attributesOfItem(atPath: source.path)
        guard attrs[.type] as? FileAttributeType == .typeRegular,
              (attrs[.size] as? NSNumber)?.int64Value == item.byteCount,
              item.byteCount > 0, item.byteCount <= maximumArtifactBytes,
              !fm.fileExists(atPath: target.path) else { throw Failure.unexpectedFile }
        guard fm.createFile(atPath: target.path, contents: nil) else { throw CocoaError(.fileWriteUnknown) }
        var complete = false
        defer { if !complete { try? fm.removeItem(at: target) } }
        let input = try FileHandle(forReadingFrom: source)
        defer { try? input.close() }
        let output = try FileHandle(forWritingTo: target)
        defer { try? output.close() }
        var written: Int64 = 0
        while let chunk = try input.read(upToCount: 1024 * 1024), !chunk.isEmpty {
            try Task.checkCancellation()
            guard Int64(chunk.count) <= item.byteCount - written else { throw Failure.sizeLimit }
            try output.write(contentsOf: chunk)
            written += Int64(chunk.count)
        }
        try output.synchronize()
        guard written == item.byteCount,
              try NativeBackupManifest.fingerprint(section: item.section, file: target) == item
        else { throw NativeBackupManifest.Failure.integrityMismatch }
        complete = true
    }

    /// Caller supplies a fresh, private empty directory. Write the manifest
    /// only after all expected artifacts passed SHA-256 verification.
    static func stage(_ manifest: NativeBackupManifest, into directory: URL,
                      copy: (NativeBackupManifest.Artifact, URL) throws -> Void) throws {
        try validate(manifest, generation: manifest.generation)
        try requireSpace(for: manifest, at: directory)
        for item in manifest.artifacts {
            try Task.checkCancellation()
            try copy(item, directory.appendingPathComponent(item.filename))
        }
        try manifest.verifyArtifacts(in: directory)
        try Task.checkCancellation()
        try JSONEncoder().encode(manifest).write(to: directory.appendingPathComponent("manifest.json"), options: .atomic)
    }
}
