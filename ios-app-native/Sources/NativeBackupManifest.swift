import Foundation
import CryptoKit

/// Format of an immutable backup generation. No credentials or arbitrary defaults
/// are admitted here: each section must supply an explicitly filtered archive.
struct NativeBackupManifest: Codable, Equatable {
    enum Section: String, Codable, CaseIterable {
        case reader, music, cinema, podcasts, radio, preferences
    }
    struct Artifact: Codable, Equatable {
        let section: Section
        let byteCount: Int64
        let sha256: String
        var filename: String { section.rawValue + ".zip" }
    }
    enum Failure: Error, Equatable {
        case unsupportedVersion, invalidManifest, invalidArtifact
        case notRegularFile, integrityMismatch
    }

    let schemaVersion: Int
    let generation: UUID
    let createdAt: Date
    let artifacts: [Artifact]

    init(generation: UUID = UUID(), createdAt: Date = Date(), artifacts: [Artifact]) {
        self.schemaVersion = 1
        self.generation = generation
        self.createdAt = createdAt
        self.artifacts = artifacts
    }

    func validate() throws {
        guard schemaVersion == 1 else { throw Failure.unsupportedVersion }
        guard !artifacts.isEmpty, artifacts.count <= Section.allCases.count,
              createdAt.timeIntervalSinceReferenceDate.isFinite,
              Set(artifacts.map(\.section)).count == artifacts.count else {
            throw Failure.invalidManifest
        }
        let hex = CharacterSet(charactersIn: "0123456789abcdef")
        for artifact in artifacts {
            guard artifact.byteCount > 0, artifact.sha256.utf8.count == 64,
                  artifact.sha256.unicodeScalars.allSatisfy({ hex.contains($0) }) else {
                throw Failure.invalidArtifact
            }
        }
    }

    /// Streaming digest: bounded memory even for large audiobooks.
    /// Call against an immutable, privately staged regular file, off the UI actor.
    static func fingerprint(section: Section, file: URL) throws -> Artifact {
        let attributes = try file.resourceValues(forKeys: [.isRegularFileKey, .isSymbolicLinkKey])
        guard attributes.isRegularFile == true, attributes.isSymbolicLink == false else {
            throw Failure.notRegularFile
        }
        let handle = try FileHandle(forReadingFrom: file)
        defer { try? handle.close() }
        var hash = SHA256()
        var bytes: Int64 = 0
        while let chunk = try handle.read(upToCount: 1024 * 1024), !chunk.isEmpty {
            try Task.checkCancellation()
            let (next, overflow) = bytes.addingReportingOverflow(Int64(chunk.count))
            guard !overflow else { throw Failure.invalidArtifact }
            bytes = next
            hash.update(data: chunk)
        }
        guard bytes > 0 else { throw Failure.invalidArtifact }
        let digest = hash.finalize().map { String(format: "%02x", $0) }.joined()
        return Artifact(section: section, byteCount: bytes, sha256: digest)
    }

    /// Verify the entire staged generation before any section mutates live data.
    /// Archive contents must subsequently pass each section's own import validation.
    func verifyArtifacts(in directory: URL) throws {
        try validate()
        for artifact in artifacts {
            let actual = try Self.fingerprint(
                section: artifact.section,
                file: directory.appendingPathComponent(artifact.filename, isDirectory: false)
            )
            guard actual == artifact else { throw Failure.integrityMismatch }
        }
    }
}
