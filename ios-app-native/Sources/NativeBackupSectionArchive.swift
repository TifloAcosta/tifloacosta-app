import Foundation
import ZIPFoundation

/// Explicit allowlist of metadata and media paths. No directory enumeration,
/// credentials, caches, or unrelated files are included in a section archive.
enum NativeBackupSectionArchive {
    struct File {
        let path: String
        let source: URL
        let trustedRoot: URL
    }

    enum Failure: Error {
        case invalidPath, duplicatePath, invalidFile, exceedsRestoreLimit
    }

    // Bounded JSON decoding; media is still streamed. Match creation and restore.
    private static let maximumLibraryMetadataBytes = 128 * 1024 * 1024
    private static let libraryMetadataNames: Set<String> = [
        "documentos.json", "carpetas.json", "manifest.json", "catalogo-personal.json", "historial.json"
    ]

    static func validatePath(_ path: String) throws {
        let parts = path.split(separator: "/", omittingEmptySubsequences: false)
        guard !parts.isEmpty, !path.contains("\\"), !path.contains(":"),
              !path.contains("\0"), parts.allSatisfy({ !$0.isEmpty && $0 != "." && $0 != ".." }) else {
            throw Failure.invalidPath
        }
    }

    /// Synchronous disk work: invoke from a detached worker. Sources are
    /// individual regular files; do not follow symbolic links in their parents.
    static func create(metadata: [String: Data], files: [File],
                       maxBytes: Int64, maxEntries: Int) throws -> URL {
        let fm = FileManager.default
        let work = fm.temporaryDirectory.appendingPathComponent("section-backup-" + UUID().uuidString, isDirectory: true)
        let staging = work.appendingPathComponent("staging", isDirectory: true)
        let output = work.appendingPathComponent("section.zip")
        var succeeded = false
        defer {
            if succeeded { try? fm.removeItem(at: staging) }
            else { try? fm.removeItem(at: work) }
        }
        try fm.createDirectory(at: staging, withIntermediateDirectories: true)
        guard files.count + metadata.count <= maxEntries else { throw Failure.exceedsRestoreLimit }
        var paths = Set<String>()
        var total: Int64 = 0
        func reserve(_ path: String, bytes: Int64) throws -> URL {
            try validatePath(path)
            guard paths.insert(path).inserted else { throw Failure.duplicatePath }
            let (next, overflow) = total.addingReportingOverflow(bytes)
            guard bytes >= 0, !overflow, next <= maxBytes else { throw Failure.exceedsRestoreLimit }
            total = next
            let destination = staging.appendingPathComponent(path)
            try fm.createDirectory(at: destination.deletingLastPathComponent(), withIntermediateDirectories: true)
            return destination
        }
        var libraryMetadataBytes = 0
        for (path, data) in metadata.sorted(by: { $0.key < $1.key }) {
            if libraryMetadataNames.contains(path) {
                guard data.count <= maximumLibraryMetadataBytes - libraryMetadataBytes else {
                    throw Failure.exceedsRestoreLimit
                }
                libraryMetadataBytes += data.count
            }
            try Task.checkCancellation()
            try data.write(to: reserve(path, bytes: Int64(data.count)), options: .atomic)
        }
        for file in files {
            try Task.checkCancellation()
            let source = file.source
            let root = file.trustedRoot.standardizedFileURL
            let rootValues = try root.resourceValues(forKeys: [.isDirectoryKey, .isSymbolicLinkKey])
            guard rootValues.isDirectory == true, rootValues.isSymbolicLink == false else {
                throw Failure.invalidFile
            }
            let components = source.standardizedFileURL.pathComponents
            let prefix = root.pathComponents
            guard components.count > prefix.count,
                  Array(components.prefix(prefix.count)) == prefix else { throw Failure.invalidPath }
            var parent = root
            for component in components.dropFirst(prefix.count).dropLast() {
                parent.appendPathComponent(component, isDirectory: true)
                let attributes = try parent.resourceValues(forKeys: [.isDirectoryKey, .isSymbolicLinkKey])
                guard attributes.isDirectory == true, attributes.isSymbolicLink == false else {
                    throw Failure.invalidFile
                }
            }
            let values = try source.resourceValues(forKeys: [.isRegularFileKey, .isSymbolicLinkKey, .fileSizeKey])
            guard values.isRegularFile == true, values.isSymbolicLink == false,
                  let bytes = values.fileSize, bytes > 0 else { throw Failure.invalidFile }
            let target = try reserve(file.path, bytes: Int64(bytes))
            try fm.copyItem(at: source, to: target)
            guard try target.resourceValues(forKeys: [.fileSizeKey]).fileSize == bytes else {
                throw Failure.invalidFile
            }
        }
        guard let archive = Archive(url: output, accessMode: .create) else {
            throw CocoaError(.fileWriteUnknown)
        }
        for path in paths.sorted() {
            try Task.checkCancellation()
            try archive.addEntry(with: path, relativeTo: staging)
        }
        try Task.checkCancellation()
        succeeded = true
        return output
    }



    /// The caller owns the returned private staging directory and must clean
    /// it up. Run on a worker; no live storage is touched.
    static func stageForRestore(section: NativeBackupManifest.Section, source: URL) throws -> URL {
        try verifyContentsForRestore(section: section, source: source)
        guard let archive = Archive(url: source, accessMode: .read) else { throw Failure.invalidFile }
        let fm = FileManager.default
        let staging = fm.temporaryDirectory.appendingPathComponent("global-restore-" + UUID().uuidString, isDirectory: true)
        try fm.createDirectory(at: staging, withIntermediateDirectories: false)
        var finished = false
        defer { if !finished { try? fm.removeItem(at: staging) } }
        for entry in archive {
            try Task.checkCancellation()
            try validatePath(entry.path)
            guard entry.type == .file else { throw Failure.invalidFile }
            let target = staging.appendingPathComponent(entry.path)
            try fm.createDirectory(at: target.deletingLastPathComponent(), withIntermediateDirectories: true)
            guard !fm.fileExists(atPath: target.path),
                  fm.createFile(atPath: target.path, contents: nil) else { throw Failure.invalidFile }
            let output = try FileHandle(forWritingTo: target)
            defer { try? output.close() }
            var written: UInt64 = 0
            let crc = try archive.extract(entry) { chunk in
                try Task.checkCancellation()
                guard written <= entry.uncompressedSize,
                      UInt64(chunk.count) <= entry.uncompressedSize - written else {
                    throw Failure.exceedsRestoreLimit
                }
                try output.write(contentsOf: chunk)
                written += UInt64(chunk.count)
            }
            guard written == entry.uncompressedSize, crc == entry.checksum else { throw Failure.invalidFile }
        }
        try Task.checkCancellation()
        finished = true
        return staging
    }

    /// Verify actual decompressed size and CRC of each member, not only the
    /// outer ZIP digest. Capture bounded metadata; stream media without retaining it.
    /// No files are extracted to the live library or to temporary storage.
    static func verifyContentsForRestore(section: NativeBackupManifest.Section, source: URL) throws {
        try validateForRestore(section: section, source: source)
        guard let archive = Archive(url: source, accessMode: .read) else {
            throw Failure.invalidFile
        }
        let metadataOnly = section == .podcasts || section == .radio || section == .preferences
        var snapshot = Data()
        var metadata: [String: Data] = [:]
        var mediaPaths = Set<String>()
        var metadataBytes = 0
        for entry in archive {
            let captureLibraryMetadata = !metadataOnly && libraryMetadataNames.contains(entry.path)
            var member = Data()
            try Task.checkCancellation()
            var written: UInt64 = 0
            let checksum = try archive.extract(entry) { chunk in
                try Task.checkCancellation()
                guard written <= entry.uncompressedSize,
                      UInt64(chunk.count) <= entry.uncompressedSize - written else {
                    throw Failure.exceedsRestoreLimit
                }
                written += UInt64(chunk.count)
                if metadataOnly {
                    guard chunk.count <= 32_000_000 - snapshot.count else {
                        throw Failure.exceedsRestoreLimit
                    }
                    snapshot.append(chunk)
                } else if captureLibraryMetadata {
                    guard chunk.count <= maximumLibraryMetadataBytes - metadataBytes else {
                        throw Failure.exceedsRestoreLimit
                    }
                    metadataBytes += chunk.count
                    member.append(chunk)
                }
            }
            guard written == entry.uncompressedSize, checksum == entry.checksum else {
                throw Failure.invalidFile
            }
            if captureLibraryMetadata { metadata[entry.path] = member }
            else if !metadataOnly { mediaPaths.insert(entry.path) }
        }
        if metadataOnly {
            try NativeBackupPersonalDataValidation.validate(section: section, data: snapshot)
        } else {
            try NativeBackupLibraryValidation.validate(section: section, metadata: metadata, mediaPaths: mediaPaths)
        }
    }

    /// Structural preflight for archives generated by the global backup service.
    /// No extraction or mutation of live data. Section-specific decoding and
    /// transactional application are still required before restore.
    static func validateForRestore(section: NativeBackupManifest.Section, source: URL) throws {
        guard let archive = Archive(url: source, accessMode: .read) else {
            throw Failure.invalidFile
        }
        let required: Set<String>
        let limit: Int64
        let entryLimit: Int
        switch section {
        case .reader:
            required = ["documentos.json", "carpetas.json"]
            limit = 1_500_000_000; entryLimit = 10_000
        case .music:
            required = ["manifest.json"]
            limit = 2_147_483_648; entryLimit = 10_000
        case .cinema:
            required = ["catalogo-personal.json", "historial.json"]
            limit = 4_000_000_000; entryLimit = 10_000
        case .podcasts, .radio, .preferences:
            required = ["snapshot.json"]
            limit = 32_000_000; entryLimit = 1
        }
        var paths = Set<String>()
        var normalizedPaths = Set<String>()
        var parents = Set<String>()
        var total: Int64 = 0
        for entry in archive {
            try Task.checkCancellation()
            let path = entry.path
            try validatePath(path)
            // Our writer emits only explicit regular-file entries, not directories
            // or symbolic links. Reject ambiguous paths on case-insensitive volumes.
            guard entry.type == .file else { throw Failure.invalidFile }
            let normalized = path.precomposedStringWithCanonicalMapping.lowercased()
            guard paths.insert(path).inserted, normalizedPaths.insert(normalized).inserted,
                  !parents.contains(normalized) else { throw Failure.duplicatePath }
            let parts = path.split(separator: "/")
            for end in 1..<parts.count {
                let parent = parts.prefix(end).joined(separator: "/")
                    .precomposedStringWithCanonicalMapping.lowercased()
                guard !normalizedPaths.contains(parent) else { throw Failure.duplicatePath }
                parents.insert(parent)
            }
            if !required.contains(path) {
                switch section {
                case .reader:
                    guard parts.count >= 3, ["ReaderMedia", "ReaderOriginals"].contains(String(parts[0])),
                          UUID(uuidString: String(parts[1])) != nil else { throw Failure.invalidPath }
                case .music, .cinema:
                    guard parts.count == 2, parts[0] == (section == .music ? "audio" : "media"),
                          UUID(uuidString: (String(parts[1]) as NSString).deletingPathExtension) != nil,
                          !(String(parts[1]) as NSString).pathExtension.isEmpty else { throw Failure.invalidPath }
                case .podcasts, .radio, .preferences:
                    throw Failure.invalidPath
                }
            }
            guard let size = Int64(exactly: entry.uncompressedSize), size > 0 else {
                throw Failure.invalidFile
            }
            if section == .music && path == "manifest.json" && size > 8 * 1024 * 1024 {
                throw Failure.exceedsRestoreLimit
            }
            if section == .cinema && !required.contains(path) && size > 2_000_000_000 {
                throw Failure.exceedsRestoreLimit
            }
            let (next, overflow) = total.addingReportingOverflow(size)
            guard !overflow, next <= limit, paths.count <= entryLimit else {
                throw Failure.exceedsRestoreLimit
            }
            total = next
        }
        guard required.isSubset(of: paths) else { throw Failure.invalidFile }
    }
}
