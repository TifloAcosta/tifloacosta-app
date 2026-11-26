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
        for (path, data) in metadata.sorted(by: { $0.key < $1.key }) {
            try Task.checkCancellation()
            try data.write(to: reserve(path, bytes: Int64(data.count)), options: .atomic)
        }
        for file in files {
            try Task.checkCancellation()
            let source = file.source
            let root = file.trustedRoot.standardizedFileURL
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
}
