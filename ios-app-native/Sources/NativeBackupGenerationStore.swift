import Foundation

/// Local immutable generations, independent from the current library and from
/// any future iCloud synchronization. Only pre-filtered section archives enter.
struct NativeBackupGenerationStore {
    let root: URL
    private let fm = FileManager.default

    enum Failure: Error {
        case invalidDirectory, duplicateGeneration, invalidGeneration
    }

    private func requireDirectory(_ url: URL) throws {
        let values = try url.resourceValues(forKeys: [.isDirectoryKey, .isSymbolicLinkKey])
        guard values.isDirectory == true, values.isSymbolicLink == false else {
            throw Failure.invalidDirectory
        }
    }

    private func prepareRoot() throws {
        try fm.createDirectory(at: root, withIntermediateDirectories: true)
        try requireDirectory(root)
    }

    private func directory(for generation: UUID) -> URL {
        root.appendingPathComponent(generation.uuidString, isDirectory: true)
    }

    /// The caller must exclusively own the staged source archives until this
    /// method returns. Perform this synchronous disk work off the UI actor.
    /// No incomplete generation is ever listed as a recoverable copy.
    func publish(archives: [NativeBackupManifest.Section: URL],
                 generation: UUID = UUID(), createdAt: Date = Date()) throws -> NativeBackupManifest {
        try Task.checkCancellation()
        guard !archives.isEmpty else { throw NativeBackupManifest.Failure.invalidManifest }
        try prepareRoot()
        let final = directory(for: generation)
        guard !fm.fileExists(atPath: final.path) else { throw Failure.duplicateGeneration }
        let staging = root.appendingPathComponent(".staging-" + UUID().uuidString, isDirectory: true)
        try fm.createDirectory(at: staging, withIntermediateDirectories: false)
        defer { try? fm.removeItem(at: staging) }
        var entries: [NativeBackupManifest.Artifact] = []
        for section in NativeBackupManifest.Section.allCases {
            guard let source = archives[section] else { continue }
            try Task.checkCancellation()
            let fingerprint = try NativeBackupManifest.fingerprint(section: section, file: source)
            let target = staging.appendingPathComponent(fingerprint.filename)
            try fm.copyItem(at: source, to: target)
            let copied = try NativeBackupManifest.fingerprint(section: section, file: target)
            guard fingerprint == copied else { throw NativeBackupManifest.Failure.integrityMismatch }
            entries.append(copied)
        }
        let manifest = NativeBackupManifest(generation: generation, createdAt: createdAt, artifacts: entries)
        try manifest.validate()
        try JSONEncoder().encode(manifest).write(to: staging.appendingPathComponent("manifest.json"), options: .atomic)
        try Task.checkCancellation()
        // Same-volume rename publishes the directory together with its manifest.
        // Never replace an existing generation or delete an earlier valid copy.
        try fm.moveItem(at: staging, to: final)
        return manifest
    }

    private func loadManifest(at directory: URL) throws -> NativeBackupManifest {
        try requireDirectory(directory)
        let manifestURL = directory.appendingPathComponent("manifest.json")
        let attributes = try manifestURL.resourceValues(forKeys: [.isRegularFileKey, .isSymbolicLinkKey, .fileSizeKey])
        guard attributes.isRegularFile == true, attributes.isSymbolicLink == false,
              let size = attributes.fileSize, size > 0, size <= 64 * 1024 else {
            throw Failure.invalidGeneration
        }
        let manifest = try JSONDecoder().decode(NativeBackupManifest.self, from: Data(contentsOf: manifestURL))
        try manifest.validate()
        guard directory.lastPathComponent == manifest.generation.uuidString else {
            throw Failure.invalidGeneration
        }
        return manifest
    }

    /// Only manifests are read when displaying history. A listed generation is
    /// NOT proof of intact archives; call verifiedGeneration before restore.
    func history() throws -> [NativeBackupManifest] {
        try prepareRoot()
        let urls = try fm.contentsOfDirectory(at: root, includingPropertiesForKeys: nil,
                                             options: [.skipsHiddenFiles])
        return urls.compactMap { url -> NativeBackupManifest? in
            guard UUID(uuidString: url.lastPathComponent) != nil else { return nil }
            return try? loadManifest(at: url)
        }.sorted {
            if $0.createdAt != $1.createdAt { return $0.createdAt > $1.createdAt }
            return $0.generation.uuidString < $1.generation.uuidString
        }
    }

    /// Verify every archive before handing any archive to a section restorer.
    /// The caller must hold exclusive access to this local immutable generation.
    func verifiedGeneration(_ generation: UUID) throws -> (NativeBackupManifest, URL) {
        try Task.checkCancellation()
        try requireDirectory(root)
        let url = directory(for: generation)
        let manifest = try loadManifest(at: url)
        try manifest.verifyArtifacts(in: url)
        return (manifest, url)
    }
}
