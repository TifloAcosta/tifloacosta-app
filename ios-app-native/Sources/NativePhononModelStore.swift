import Foundation
import ZIPFoundation
import CryptoKit

/// The checked, publicly licensed Phonon 31m English Core ML model only.
/// A user action downloads a fixed upstream release; no cloud/API key is needed
/// to use the installed model after download.
enum NativePhononModelStore {
    static let releaseURL = URL(string:
        "https://github.com/gradium-ai/xn-ptts/releases/download/v0.4.0/phonon-31m-en-coreml.zip")!
    static let archiveSHA256 =
        "10f3a99fd39256db44f826267ef21d78cca959b16c0554926344c09fde27b436"
    static var directory: URL {
        FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("PhononTTS/models", isDirectory: true)
    }

    enum InstallationError: LocalizedError {
        case checksum, invalidZIP, incomplete, tooLarge, unsupportedModel
        var errorDescription: String? {
            switch self {
            case .checksum: return "La descarga de Phonon no coincide con la versión oficial."
            case .invalidZIP: return "El ZIP del modelo Phonon no es válido."
            case .incomplete: return "Faltan archivos del modelo Phonon."
            case .tooLarge: return "El modelo supera el tamaño permitido."
            case .unsupportedModel: return "Solo se admite el modelo oficial Phonon 31m en inglés."
            }
        }
    }

    private struct Manifest: Decodable {
        struct Entry: Decodable {
            var path: String
            var size: Int
            var sha256: String
        }
        var built: Int
        var files: [Entry]
    }

    static var isInstalled: Bool { verifyBundle(directory) }

    private static func digest(_ url: URL) throws -> String {
        let handle = try FileHandle(forReadingFrom: url)
        defer { try? handle.close() }
        var sha = SHA256()
        while let data = try handle.read(upToCount: 8 * 1024 * 1024), !data.isEmpty {
            sha.update(data: data)
        }
        return sha.finalize().map { String(format: "%02x", $0) }.joined()
    }

    private static func verifyBundle(_ root: URL) -> Bool {
        guard let data = try? Data(contentsOf: root.appendingPathComponent("bundle.json")),
              let manifest = try? JSONDecoder().decode(Manifest.self, from: data),
              !manifest.files.isEmpty, manifest.files.count <= 5000 else { return false }
        let rootPath = root.standardizedFileURL.path + "/"
        return manifest.files.allSatisfy { entry in
            guard entry.size >= 0, entry.path.first != "/", !entry.path.contains("..") else {
                return false
            }
            let url = root.appendingPathComponent(entry.path).standardizedFileURL
            guard url.path.hasPrefix(rootPath),
                  let actualSize = try? url.resourceValues(forKeys: [.fileSizeKey]).fileSize,
                  actualSize == entry.size,
                  let actualHash = try? digest(url) else { return false }
            return actualHash.caseInsensitiveCompare(entry.sha256) == .orderedSame
        }
    }

    /// Downloads with URLSession into a temporary file; no untrusted remote
    /// source is accepted, and every installed file is SHA-256 verified.
    static func downloadAndInstall() async throws {
        let (archive, response) = try await URLSession.shared.download(from: releaseURL)
        guard (response as? HTTPURLResponse)?.statusCode == 200 else {
            throw InstallationError.invalidZIP
        }
        try await Task.detached(priority: .userInitiated) {
            try install(zipURL: archive)
        }.value
    }

    static func install(zipURL: URL) throws {
        let fm = FileManager.default
        guard try digest(zipURL) == archiveSHA256 else { throw InstallationError.checksum }
        guard let archive = Archive(url: zipURL, accessMode: .read) else {
            throw InstallationError.invalidZIP
        }
        let parent = directory.deletingLastPathComponent()
        try fm.createDirectory(at: parent, withIntermediateDirectories: true)
        let staging = parent.appendingPathComponent("partial-\(UUID().uuidString)", isDirectory: true)
        let old = parent.appendingPathComponent("previous-\(UUID().uuidString)", isDirectory: true)
        try fm.createDirectory(at: staging, withIntermediateDirectories: true)
        defer { try? fm.removeItem(at: staging) }
        var size: Int64 = 0
        var count = 0
        for entry in archive {
            try Task.checkCancellation()
            let parts = entry.path.split(separator: "/").map(String.init)
            guard !parts.isEmpty, !parts.contains("."),
                  !parts.contains(".."), entry.path.first != "/" else {
                throw InstallationError.invalidZIP
            }
            count += 1
            size += Int64(entry.uncompressedSize)
            if count > 5000 || size > 1024 * 1024 * 1024 {
                throw InstallationError.tooLarge
            }
            let dest = staging.appendingPathComponent(entry.path).standardizedFileURL
            guard dest.path.hasPrefix(staging.standardizedFileURL.path + "/") else {
                throw InstallationError.invalidZIP
            }
            try fm.createDirectory(at: dest.deletingLastPathComponent(), withIntermediateDirectories: true)
            if entry.type == .directory {
                try fm.createDirectory(at: dest, withIntermediateDirectories: true)
            } else {
                _ = try archive.extract(entry, to: dest)
            }
        }
        let root: URL
        if fm.fileExists(atPath: staging.appendingPathComponent("bundle.json").path) {
            root = staging
        } else {
            let dirs = try fm.contentsOfDirectory(at: staging, includingPropertiesForKeys: nil)
            guard dirs.count == 1 else { throw InstallationError.incomplete }
            root = dirs[0]
        }
        guard verifyBundle(root) else { throw InstallationError.incomplete }
        var previousExists = false
        if fm.fileExists(atPath: directory.path) {
            try fm.moveItem(at: directory, to: old)
            previousExists = true
        }
        do {
            try fm.moveItem(at: root, to: directory)
            var installed = directory
            var values = URLResourceValues()
            values.isExcludedFromBackup = true
            try installed.setResourceValues(values)
            if previousExists { try? fm.removeItem(at: old) }
        } catch {
            if previousExists { try? fm.moveItem(at: old, to: directory) }
            throw error
        }
    }

    static func remove() throws {
        if FileManager.default.fileExists(atPath: directory.path) {
            try FileManager.default.removeItem(at: directory)
        }
    }
}
