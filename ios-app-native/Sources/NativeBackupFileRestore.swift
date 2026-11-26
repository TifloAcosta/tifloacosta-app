import Foundation

/// Local reversible file/index changes. The caller must exclusively own the
/// staged paths and prevent writes by live stores during apply/rollback.
/// No existing media is overwritten. This is not a crash-durable journal.
final class NativeBackupFileRestore {
    struct Move {
        let source: URL
        let target: URL
    }

    private struct Index {
        let url: URL
        let before: Data?
        let after: Data
    }

    private let moves: [Move]
    private let indexes: [Index]
    private var moved: [URL] = []
    private var attemptedIndexes: [Index] = []
    private let fm = FileManager.default

    init(moves: [Move], indexes: [(URL, Data)]) throws {
        self.moves = moves
        self.indexes = try indexes.map { url, bytes in
            let before: Data?
            if FileManager.default.fileExists(atPath: url.path) {
                let values = try url.resourceValues(forKeys: [.isRegularFileKey, .isSymbolicLinkKey])
                guard values.isRegularFile == true, values.isSymbolicLink == false else {
                    throw CocoaError(.fileReadCorruptFile)
                }
                before = try Data(contentsOf: url)
            } else { before = nil }
            return Index(url: url, before: before, after: bytes)
        }
        let destinations = moves.map { $0.target.standardizedFileURL.path.lowercased() }
        guard Set(destinations).count == destinations.count else { throw CocoaError(.fileWriteFileExists) }
        for item in moves {
            guard fm.fileExists(atPath: item.source.path),
                  !fm.fileExists(atPath: item.target.path) else { throw CocoaError(.fileWriteFileExists) }
        }
    }

    func apply() throws {
        for item in moves {
            try Task.checkCancellation()
            guard !fm.fileExists(atPath: item.target.path) else { throw CocoaError(.fileWriteFileExists) }
            try fm.createDirectory(at: item.target.deletingLastPathComponent(), withIntermediateDirectories: true)
            try fm.moveItem(at: item.source, to: item.target)
            moved.append(item.target)
        }
        for index in indexes {
            try Task.checkCancellation()
            try fm.createDirectory(at: index.url.deletingLastPathComponent(), withIntermediateDirectories: true)
            attemptedIndexes.append(index)
            try index.after.write(to: index.url, options: .atomic)
        }
    }

    func rollback() throws {
        var firstError: Error?
        for index in attemptedIndexes.reversed() {
            do {
                if let before = index.before { try before.write(to: index.url, options: .atomic) }
                else if fm.fileExists(atPath: index.url.path) { try fm.removeItem(at: index.url) }
            } catch { if firstError == nil { firstError = error } }
        }
        // If an index could not be restored, retain media for recovery rather
        // than leave that index pointing to files we deliberately deleted.
        if let firstError { throw firstError }
        attemptedIndexes.removeAll()
        for target in moved.reversed() {
            do { if fm.fileExists(atPath: target.path) { try fm.removeItem(at: target) } }
            catch { if firstError == nil { firstError = error } }
        }
        if let firstError { throw firstError }
        moved.removeAll()
    }
}
