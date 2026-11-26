import Foundation
import Combine

/// Coordinates selected sections into one local immutable generation. Until
/// the remaining section adapters and cloud transport are implemented this
/// must not be presented as a complete application or iCloud backup.
@MainActor
final class NativeBackupCoordinator: ObservableObject {
    static let shared = NativeBackupCoordinator()
    static let supportedSections: Set<NativeBackupManifest.Section> = [.reader, .music]

    @Published private(set) var isCreating = false
    private let store: NativeBackupGenerationStore

    enum Failure: Error {
        case busy, unsupportedSelection
    }

    init(root: URL = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        .appendingPathComponent("GlobalBackupGenerations", isDirectory: true)) {
        store = NativeBackupGenerationStore(root: root)
    }

    /// Do not silently omit unsupported or failed sections. The generation
    /// exists only when every requested archive has been produced and verified.
    func create(sections: Set<NativeBackupManifest.Section>, reader: NativeReaderLibrary) async throws -> NativeBackupManifest {
        guard !isCreating else { throw Failure.busy }
        guard !sections.isEmpty, sections.isSubset(of: Self.supportedSections) else {
            throw Failure.unsupportedSelection
        }
        isCreating = true
        var archives: [NativeBackupManifest.Section: URL] = [:]
        defer {
            for archive in archives.values {
                try? FileManager.default.removeItem(at: archive.deletingLastPathComponent())
            }
            isCreating = false
        }
        if sections.contains(.reader) {
            archives[.reader] = try await reader.createGlobalBackupArchive()
        }
        try Task.checkCancellation()
        if sections.contains(.music) {
            archives[.music] = try await NativeMusicBackupAdapter.createArchive()
        }
        try Task.checkCancellation()
        let prepared = archives
        let destination = store
        let worker = Task.detached(priority: .utility) {
            try destination.publish(archives: prepared)
        }
        // If publication committed before cancellation, retain that valid copy.
        return try await withTaskCancellationHandler {
            try await worker.value
        } onCancel: { worker.cancel() }
    }

    func history() async throws -> [NativeBackupManifest] {
        let destination = store
        return try await Task.detached(priority: .utility) {
            try destination.history()
        }.value
    }
}
