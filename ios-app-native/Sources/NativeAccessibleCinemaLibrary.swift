import Foundation
import SwiftUI
import AVFoundation
import UniformTypeIdentifiers

/// Files added by the user for private playback. No third-party audiovisual
/// catalogue is copied or redistributed by the app.
struct NativeCinemaLocalItem: Codable, Hashable, Identifiable {
    let id: UUID
    let title: String
    let storedName: String
    let language: AccessibleCinemaLanguage
    let kind: AccessibleCinemaKind
    var lastSeconds: Double
    let importedAt: Date
}

enum NativeCinemaLocalError: LocalizedError {
    case unsupported
    case oversized
    case missing
    case invalidFile

    var errorDescription: String? {
        switch self {
        case .unsupported: "Elige un archivo de audio o vídeo compatible."
        case .oversized: "El archivo supera el tamaño máximo permitido de 2 GB."
        case .missing: "El archivo ya no está disponible en la biblioteca."
        case .invalidFile: "No se puede importar este archivo."
        }
    }
}

/// Metadata is stored independently of TifloLector and Mi música.
/// Audio is copied only after a file is explicitly chosen through Files.
@MainActor
final class NativeCinemaLocalLibrary: ObservableObject {
    @Published private(set) var items: [NativeCinemaLocalItem] = []

    private static var directory: URL {
        FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("TifloCinemaPersonal", isDirectory: true)
    }
    private static var indexURL: URL {
        directory.appendingPathComponent("catalogo-personal.json")
    }
    private static let allowedExtensions: Set<String> = [
        "mp3", "m4a", "m4b", "aac", "wav", "aif", "aiff", "caf",
        "flac", "mp4", "m4v", "mov"
    ]
    private static let maximumFileSize: Int64 = 2_000_000_000

    init() {
        try? FileManager.default.createDirectory(
            at: Self.directory, withIntermediateDirectories: true)
        if let bytes = try? Data(contentsOf: Self.indexURL),
           let saved = try? JSONDecoder().decode([NativeCinemaLocalItem].self, from: bytes) {
            items = saved.filter {
                FileManager.default.fileExists(
                    atPath: Self.directory.appendingPathComponent($0.storedName).path)
            }
        }
    }

    func fileURL(for item: NativeCinemaLocalItem) -> URL? {
        let url = Self.directory.appendingPathComponent(item.storedName)
        return FileManager.default.fileExists(atPath: url.path) ? url : nil
    }

    @discardableResult
    func importAudio(from url: URL, language: AccessibleCinemaLanguage,
                     kind: AccessibleCinemaKind) throws -> NativeCinemaLocalItem {
        let scoped = url.startAccessingSecurityScopedResource()
        defer { if scoped { url.stopAccessingSecurityScopedResource() } }
        let ext = url.pathExtension.lowercased()
        guard Self.allowedExtensions.contains(ext) else {
            throw NativeCinemaLocalError.unsupported
        }
        let properties = try url.resourceValues(
            forKeys: [.isRegularFileKey, .isSymbolicLinkKey, .fileSizeKey])
        guard properties.isRegularFile == true, properties.isSymbolicLink != true else {
            throw NativeCinemaLocalError.invalidFile
        }
        if Int64(properties.fileSize ?? 0) > Self.maximumFileSize {
            throw NativeCinemaLocalError.oversized
        }

        let id = UUID()
        let filename = id.uuidString + "." + ext
        let destination = Self.directory.appendingPathComponent(filename)
        try FileManager.default.copyItem(at: url, to: destination)

        let item = NativeCinemaLocalItem(
            id: id,
            title: url.deletingPathExtension().lastPathComponent,
            storedName: filename,
            language: language,
            kind: kind,
            lastSeconds: 0,
            importedAt: .now
        )
        do {
            try persist(items + [item])
            items.append(item)
            return item
        } catch {
            try? FileManager.default.removeItem(at: destination)
            throw error
        }
    }

    func savePosition(_ seconds: Double, for id: UUID) {
        guard seconds.isFinite, seconds >= 0,
              let index = items.firstIndex(where: { $0.id == id }),
              abs(items[index].lastSeconds - seconds) >= 1 else { return }
        var updated = items
        updated[index].lastSeconds = seconds
        guard (try? persist(updated)) != nil else { return }
        items = updated
    }

    func remove(_ item: NativeCinemaLocalItem) throws {
        let updated = items.filter { $0.id != item.id }
        try persist(updated)
        items = updated
        let url = Self.directory.appendingPathComponent(item.storedName)
        if FileManager.default.fileExists(atPath: url.path) {
            try FileManager.default.removeItem(at: url)
        }
    }

    private func persist(_ values: [NativeCinemaLocalItem]) throws {
        let bytes = try JSONEncoder().encode(values)
        try bytes.write(to: Self.indexURL, options: .atomic)
    }
}

/// One private player for Multicines. It never changes VoiceOver speech rate,
/// hardware volume, Mi música or TifloLector reading position.
@MainActor
final class NativeCinemaAudioPlayer: ObservableObject {
    @Published private(set) var currentID: UUID?
    @Published private(set) var playing = false
    @Published private(set) var seconds: Double = 0
    @Published private(set) var duration: Double = 0

    private var player: AVPlayer?
    private var lastSavedSecond: Double = -10

    func open(_ item: NativeCinemaLocalItem, library: NativeCinemaLocalLibrary) throws {
        guard let url = library.fileURL(for: item) else {
            throw NativeCinemaLocalError.missing
        }
        pauseAndSave(library: library)
        player = AVPlayer(url: url)
        currentID = item.id
        let restored = max(0, item.lastSeconds)
        seconds = restored
        duration = 0
        lastSavedSecond = restored
        player?.seek(to: CMTime(seconds: restored, preferredTimescale: 600))
        player?.play()
        playing = true
    }

    func toggle(library: NativeCinemaLocalLibrary) {
        guard let player else { return }
        if playing {
            player.pause()
            playing = false
            save(library: library, force: true)
        } else {
            player.play()
            playing = true
        }
    }

    func seek(by delta: Double, library: NativeCinemaLocalLibrary) {
        guard let player else { return }
        let next = max(0, min(duration > 0 ? duration : Double.greatestFiniteMagnitude,
                              seconds + delta))
        guard next.isFinite else { return }
        player.seek(to: CMTime(seconds: next, preferredTimescale: 600))
        seconds = next
        save(library: library, force: true)
    }

    func refresh(library: NativeCinemaLocalLibrary) {
        guard let player else { return }
        let elapsed = player.currentTime().seconds
        if elapsed.isFinite && elapsed >= 0 { seconds = elapsed }
        let length = player.currentItem?.duration.seconds ?? 0
        if length.isFinite && length > 0 { duration = length }
        save(library: library, force: false)
        if duration > 0 && seconds >= duration - 0.2 && playing {
            playing = false
            player.pause()
            if let currentID { library.savePosition(0, for: currentID) }
        }
    }

    func pauseAndSave(library: NativeCinemaLocalLibrary) {
        save(library: library, force: true)
        player?.pause()
        player = nil
        playing = false
        currentID = nil
        seconds = 0
        duration = 0
    }

    private func save(library: NativeCinemaLocalLibrary, force: Bool) {
        guard let currentID else { return }
        if force || abs(seconds - lastSavedSecond) >= 5 {
            library.savePosition(seconds, for: currentID)
            lastSavedSecond = seconds
        }
    }
}
