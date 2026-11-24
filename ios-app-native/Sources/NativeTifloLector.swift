import Darwin
import SwiftUI
import MediaPlayer
import PDFKit
import UIKit
import AVFoundation
import AVKit
import Translation
import UniformTypeIdentifiers
import ZIPFoundation

struct NativeReaderPreferences: Codable, Hashable {
    var speedIndex: Int? = nil
    var pitchIndex: Int? = nil
    var voiceID: String? = nil
    var readingEngineIndex: Int? = nil
    var geminiVoiceID: String? = nil
    var phononVoiceID: String? = nil
    var textSize: Double? = nil
    var lineSpacingIndex: Int? = nil
    var strongText: Bool? = nil
}

struct NativeTextBookmark: Codable, Hashable, Identifiable {
    let offset: Int
    let percent: Int
    var id: Int { offset }
}

struct NativeAudioBookmark: Codable, Hashable {
    let track: Int
    let percent: Int
    var seconds: TimeInterval? = nil
}

/// Report the actual result of writing a bookmark, not just a button press.
enum NativeBookmarkSaveResult {
    case saved
    case alreadyExists
    case documentUnavailable
    case failed
}

struct NativeDaisyNavigationPoint: Codable, Hashable, Identifiable {
    let title: String
    let level: Int
    let track: Int
    var seconds: TimeInterval? = nil
    var kind: String? = nil
    var id: String { "\(track)-\(level)-\(title)-\(seconds ?? 0)" }
}

struct NativeReaderTextLink: Codable, Hashable {
    let offset: Int
    let title: String
    let url: String
    var targetOffset: Int? = nil
}

struct NativeReadingDocument: Codable, Identifiable, Hashable {
    let id: UUID
    var title: String
    let body: String
    let importedAt: Date
    // Optional properties allow older beta library JSON to remain decodable.
    var fileExtension: String? = nil
    // Ruta persistente relativa al archivo importado, si existía un archivo fuente.
    var originalRelativePath: String? = nil
    var trackPaths: [String]? = nil
    var markedPositions: [Int]? = nil
    var textBookmarks: [NativeTextBookmark]? = nil
    var isFavorite: Bool? = nil
    var lastPercent: Int? = nil
    var lastOpenedAt: Date? = nil
    // Exact character position for text; optional for older libraries.
    var lastTextOffset: Int? = nil
    var lastTrackIndex: Int? = nil
    // Exact elapsed audio seconds; optional for legacy library records.
    var lastAudioSeconds: TimeInterval? = nil
    var audioBookmarks: [NativeAudioBookmark]? = nil
    var daisyNavigation: [NativeDaisyNavigationPoint]? = nil
    // Optional so books imported by earlier TestFlight builds still decode.
    var daisyClips: [NativeDaisyAudioClip]? = nil
    var textLinks: [NativeReaderTextLink]? = nil
    var folderName: String? = nil
    var readerPreferences: NativeReaderPreferences? = nil

    var hasAudio: Bool { !(trackPaths ?? []).isEmpty }
    var bookmarks: [Int] { markedPositions ?? [] }
    var savedTextBookmarks: [NativeTextBookmark] { textBookmarks ?? [] }
    var savedAudioBookmarks: [NativeAudioBookmark] { audioBookmarks ?? [] }
    var hasBookmarks: Bool { !bookmarks.isEmpty || !savedTextBookmarks.isEmpty || !savedAudioBookmarks.isEmpty }
    var formatLabel: String { (fileExtension ?? "txt").uppercased() }
}

private enum NativeReaderImportError: LocalizedError {
    case noReadableText(String)

    var errorDescription: String? {
        switch self {
        case .noReadableText(let name):
            return "No se ha encontrado texto legible en «\(name)». El OCR y los demás formatos siguen pendientes."
        }
    }
}

/// Verified counts from a folder import; individual failures do not stop the batch.
struct NativeReaderFolderImportSummary {
    let imported: Int
    let skipped: Int
    let failed: [String]
}

/// New native-only documents are deliberately isolated from the current beta database.
/// No reading data is silently discarded or overwritten during the migration.
@MainActor
final class NativeReaderLibrary: ObservableObject {
    @Published private(set) var documents: [NativeReadingDocument] = [] {
        didSet { documentsRevision &+= 1 }
    }
    private var documentsRevision = 0
    private var pendingFileImports: Set<UUID> = []
    @Published private(set) var folders: [String] = []
    private let folderStorageKey = "native-reader-folders"
    // One small preference per opened book; opening must not re-encode the
    // entire text library or emit @Published changes during NavigationLink.
    private static let lastOpenedPrefix = "native-reader-last-opened-at-"

    func lastOpenedAt(for document: NativeReadingDocument) -> Date? {
        let key = Self.lastOpenedPrefix + document.id.uuidString
        return (UserDefaults.standard.object(forKey: key) as? Date)
            ?? document.lastOpenedAt
    }

    private func documentsForPersistence() -> [NativeReadingDocument] {
        documents.map { document in
            var copy = document
            copy.lastOpenedAt = lastOpenedAt(for: document)
            return copy
        }
    }

    private static var storageURL: URL {
        let directory = FileManager.default.urls(
            for: .applicationSupportDirectory, in: .userDomainMask
        )[0]
        return directory.appendingPathComponent("NativeReaderDocuments.json")
    }

    init() {
        folders = UserDefaults.standard.stringArray(forKey: folderStorageKey) ?? []
        if let data = try? Data(contentsOf: Self.storageURL),
           let stored = try? JSONDecoder().decode([NativeReadingDocument].self, from: data) {
            documents = stored
        }
    }

    /// Decode and stage originals and media off the UI actor. Commit only
    /// after the staged library file has been written successfully.
    @discardableResult
    func importFile(from url: URL, sharingID: UUID? = nil,
                    originalName: String? = nil, preferredTitle: String? = nil,
                    onProgress: @escaping (String) -> Void = { _ in }) async throws -> NativeReadingDocument {
        let identifier = sharingID ?? UUID()
        if let existing = documents.first(where: { $0.id == identifier }) { return existing }
        guard pendingFileImports.insert(identifier).inserted else {
            throw CocoaError(.fileWriteFileExists)
        }
        defer { pendingFileImports.remove(identifier) }

        let filename = originalName ?? url.lastPathComponent
        let progress = AsyncStream<(Int, Int)>.makeStream(bufferingPolicy: .bufferingNewest(1))
        let progressTask = Task { @MainActor in
            for await (page, total) in progress.stream {
                guard !Task.isCancelled else { break }
                onProgress(MusicLocalized.format("Procesando página %d de %d: %@", page, total, filename))
            }
        }
        defer { progress.continuation.finish(); progressTask.cancel() }
        do {
            let worker = Task.detached(priority: .userInitiated) {
                defer { progress.continuation.finish() }
                let accessed = url.startAccessingSecurityScopedResource()
                defer { if accessed { url.stopAccessingSecurityScopedResource() } }
                let attributes = try url.resourceValues(forKeys: [.isRegularFileKey, .isSymbolicLinkKey])
                guard attributes.isRegularFile == true, attributes.isSymbolicLink != true else {
                    throw CocoaError(.fileReadUnsupportedScheme)
                }
                let payload = try NativeReaderFormats.read(url, documentID: identifier,
                    filename: filename) { page, total in
                    progress.continuation.yield((page, total))
                }
                try Task.checkCancellation()
                let originalPath = try NativeReaderFormats.storeOriginal(
                    url, documentID: identifier, filename: filename)
                return (payload, originalPath)
            }
            let (payload, originalPath) = try await withTaskCancellationHandler {
                try await worker.value
            } onCancel: {
                worker.cancel()
            }
            await progressTask.value
            let title = preferredTitle?.trimmingCharacters(in: .whitespacesAndNewlines)
            let document = NativeReadingDocument(
                id: identifier,
                title: title.flatMap { $0.isEmpty ? nil : $0 }
                    ?? URL(fileURLWithPath: filename).deletingPathExtension().lastPathComponent,
                body: payload.body, importedAt: .now, fileExtension: payload.fileExtension,
                originalRelativePath: originalPath, trackPaths: payload.trackPaths,
                daisyNavigation: payload.daisyNavigation, daisyClips: payload.daisyClips,
                textLinks: payload.textLinks)
            try await persistImportedDocument(document)
            return document
        } catch {
            progressTask.cancel()
            await Task.detached {
                NativeReaderFormats.deleteStoredFiles(for: identifier)
                NativeReaderFormats.deleteOriginal(for: identifier)
            }.value
            throw error
        }
    }

    private func persistImportedDocument(_ document: NativeReadingDocument) async throws {
        let storage = Self.storageURL
        while true {
            try Task.checkCancellation()
            let revision = documentsRevision
            let updated = [document] + documentsForPersistence()
            let directory = storage.deletingLastPathComponent()
            let staged = directory.appendingPathComponent("reader-import-\(UUID().uuidString).tmp")
            defer { try? FileManager.default.removeItem(at: staged) }
            try await Task.detached(priority: .userInitiated) {
                try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
                try JSONEncoder().encode(updated).write(to: staged)
            }.value
            try Task.checkCancellation()
            // A bookmark, playback position, or concurrent import may have
            // changed during encoding. Retry with the current snapshot.
            guard revision == documentsRevision else { continue }
            // The staged file is in the same directory, so rename replaces
            // the previous index atomically with no large I/O on this actor.
            guard Darwin.rename(staged.path, storage.path) == 0 else {
                throw POSIXError(POSIXErrorCode(rawValue: errno) ?? .EIO)
            }
            documents.insert(document, at: 0)
            return
        }
    }

    /// Import a directory picked in Files without requiring a ZIP. The
    /// security-scoped folder stays available while each child is copied to
    /// private app storage. Do not follow symlinks outside the selected folder.
    func importFolder(from folder: URL,
                      onProgress: @escaping (String) -> Void) async throws
                      -> NativeReaderFolderImportSummary {
        let scope = folder.startAccessingSecurityScopedResource()
        defer { if scope { folder.stopAccessingSecurityScopedResource() } }
        let scan = Task.detached(priority: .userInitiated) {
            try Self.scanImportFolder(folder)
        }
        let (files, skipped, scanFailures) = try await withTaskCancellationHandler {
            try await scan.value
        } onCancel: {
            scan.cancel()
        }
        let summary = try await importSelectedFiles(from: files, onProgress: onProgress)
        return NativeReaderFolderImportSummary(imported: summary.imported,
                                               skipped: skipped, failed: scanFailures + summary.failed)
    }

    nonisolated private static func scanImportFolder(_ folder: URL) throws -> ([URL], Int, [String]) {
        let attributes = try folder.resourceValues(forKeys: [.isDirectoryKey, .isSymbolicLinkKey])
        guard attributes.isDirectory == true, attributes.isSymbolicLink != true else {
            throw CocoaError(.fileReadUnsupportedScheme)
        }
        let supported: Set<String> = [
            "pdf", "txt", "text", "html", "htm", "md", "markdown",
            "csv", "json", "xml", "log", "srt", "rtf", "fb2",
            "docx", "odt", "pptx", "ppsx", "pptm", "xlsx", "xlsm",
            "epub", "mp3", "m4a", "m4b", "aac", "wav", "aif", "aiff",
            "caf", "flac", "mp4", "m4v", "mov", "zip", "daisy",
            "png", "jpg", "jpeg", "heic", "heif", "tif", "tiff"
        ]
        var failures: [String] = []
        guard let enumerator = FileManager.default.enumerator(
            at: folder, includingPropertiesForKeys: [.isRegularFileKey, .isSymbolicLinkKey],
            options: [.skipsHiddenFiles, .skipsPackageDescendants],
            errorHandler: { url, error in
                failures.append(url.lastPathComponent + ": " + error.localizedDescription)
                return failures.count < 750
            }
        ) else { throw CocoaError(.fileReadUnknown) }
        var files: [URL] = []
        var skipped = 0
        for case let url as URL in enumerator {
            if Task.isCancelled { throw CancellationError() }
            if let properties = try? url.resourceValues(forKeys: [.isRegularFileKey, .isSymbolicLinkKey]) {
                if properties.isSymbolicLink == true {
                    guard files.count + skipped + failures.count < 750 else {
                        throw NativeReaderFormatError.tooManyFiles
                    }
                    enumerator.skipDescendants()
                    skipped += 1
                    continue
                }
                guard properties.isRegularFile == true else { continue }
            }
            guard files.count + skipped + failures.count < 750 else {
                throw NativeReaderFormatError.tooManyFiles
            }
            if supported.contains(url.pathExtension.lowercased()) { files.append(url) }
            else { skipped += 1 }
        }
        files.sort { $0.path.localizedStandardCompare($1.path) == .orderedAscending }
        return (files, skipped, failures)
    }

    /// Import a selection of files one by one. A damaged file must not
    /// discard the other documents in the selection. Report counts, not
    /// guessed percentages; keep security-scoped access inside each import.
    func importSelectedFiles(from urls: [URL],
                             onProgress: @escaping (String) -> Void) async throws
                             -> NativeReaderFolderImportSummary {
        guard urls.count <= 750 else {
            throw NativeReaderFormatError.tooManyFiles
        }
        var imported = 0
        var failures: [String] = []
        for (index, url) in urls.enumerated() {
            if Task.isCancelled { throw CancellationError() }
            onProgress(MusicLocalized.format("Importando %d de %d: %@",
                                            index + 1, urls.count, url.lastPathComponent))
            do {
                try await importFile(from: url, onProgress: onProgress)
                imported += 1
            } catch is CancellationError {
                throw CancellationError()
            } catch {
                failures.append(url.lastPathComponent + ": " + error.localizedDescription)
            }
        }
        return NativeReaderFolderImportSummary(imported: imported, skipped: 0,
                                               failed: failures)
    }

    func importSharedText(_ text: String, title: String, sharingID: UUID? = nil) throws {
        guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw NativeReaderImportError.noReadableText(title)
        }
        let identifier = sharingID ?? UUID()
        if documents.contains(where: { $0.id == identifier }) { return }
        documents.insert(
            NativeReadingDocument(id: identifier, title: title, body: text, importedAt: .now),
            at: 0
        )
        try save()
    }

    func rename(_ document: NativeReadingDocument, to proposedTitle: String) {
        let title = proposedTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !title.isEmpty, let index = documents.firstIndex(where: { $0.id == document.id }) else { return }
        documents[index].title = title
        try? save()
    }

    func delete(_ document: NativeReadingDocument) {
        documents.removeAll { $0.id == document.id }
        NativeReaderFormats.deleteStoredFiles(for: document.id)
        NativeReaderFormats.deleteOriginal(for: document.id)
        try? save()
    }

    func originalURL(for document: NativeReadingDocument) -> URL? {
        guard let path = latest(document).originalRelativePath,
              let url = NativeReaderFormats.storedURL(for: path),
              FileManager.default.fileExists(atPath: url.path) else { return nil }
        return url
    }

    /// DAISY archives are preserved byte-for-byte when imported. A package
    /// originally named .daisy gets a ZIP extension for external players.
    func shareableOriginalURL(for document: NativeReadingDocument) throws -> URL {
        guard let original = originalURL(for: document) else { throw CocoaError(.fileNoSuchFile) }
        guard latest(document).fileExtension?.lowercased() == "daisy" else { return original }
        guard Archive(url: original, accessMode: .read) != nil else {
            throw NativeReaderFormatError.invalidArchive
        }
        if original.pathExtension.lowercased() == "zip" { return original }
        let destination = FileManager.default.temporaryDirectory
            .appendingPathComponent("DAISY-\(UUID().uuidString).zip")
        try FileManager.default.copyItem(at: original, to: destination)
        return destination
    }

    /// Reúne los originales conservados sin alterar la biblioteca.
    /// Los registros antiguos sin original se exportan expresamente como TXT.
    func sharingURLs(for documents: [NativeReadingDocument]) throws
        -> (urls: [URL], textFallbackCount: Int) {
        guard !documents.isEmpty else { return ([], 0) }
        let manager = FileManager.default
        let staging = manager.temporaryDirectory
            .appendingPathComponent("TifloShare-\(UUID().uuidString)", isDirectory: true)
        try manager.createDirectory(at: staging, withIntermediateDirectories: true)
        var urls: [URL] = []
        var usedNames: Set<String> = []
        var textFallbackCount = 0

        for document in documents {
            let source: URL
            if let original = originalURL(for: document) {
                source = original
            } else if !document.body.isEmpty {
                let safeTitle = document.title.replacingOccurrences(
                    of: #"[\\/:*?"<>|\x00-\x1F]"#, with: "_", options: .regularExpression)
                let name = safeTitle.isEmpty ? "Documento" : safeTitle
                let destination = staging.appendingPathComponent("\(name)-\(document.id.uuidString)")
                    .appendingPathExtension("txt")
                try document.body.write(to: destination, atomically: true, encoding: .utf8)
                urls.append(destination)
                textFallbackCount += 1
                continue
            } else if document.hasAudio {
                source = try exportAudioTracks(document)
            } else {
                throw CocoaError(.fileNoSuchFile)
            }

            let filename = source.lastPathComponent
            let uniqueName: String
            if usedNames.insert(filename.lowercased()).inserted {
                uniqueName = filename
            } else {
                uniqueName = source.deletingPathExtension().lastPathComponent
                    + "-" + document.id.uuidString + "." + source.pathExtension
                usedNames.insert(uniqueName.lowercased())
            }
            let destination = staging.appendingPathComponent(uniqueName)
            try manager.copyItem(at: source, to: destination)
            urls.append(destination)
        }
        return (urls, textFallbackCount)
    }

    /// Exporta todas las pistas sin confundir un ZIP de audio con DAISY.
    func exportAudioTracks(_ document: NativeReadingDocument) throws -> URL {
        try exportAudioTracks(document, mp3OnlyForVoiceDream: false)
    }

    /// Reutiliza MP3 ya importados o sintetizados: ninguna llamada a TTS.
    /// Solo admite pistas MP3 para no presentar otros códecs como compatibles.
    func exportVoiceDreamMP3(_ document: NativeReadingDocument) throws -> URL {
        try exportAudioTracks(document, mp3OnlyForVoiceDream: true)
    }

    private func exportAudioTracks(_ document: NativeReadingDocument,
                                   mp3OnlyForVoiceDream: Bool) throws -> URL {
        let current = latest(document)
        guard let paths = current.trackPaths, !paths.isEmpty else {
            throw NativeReaderFormatError.invalidArchive
        }
        let manager = FileManager.default
        let temp = manager.temporaryDirectory
        let staging = temp.appendingPathComponent("pistas-\(UUID().uuidString)", isDirectory: true)
        try manager.createDirectory(at: staging, withIntermediateDirectories: true)
        defer { try? manager.removeItem(at: staging) }

        for (index, path) in paths.enumerated() {
            guard let source = NativeReaderFormats.storedURL(for: path),
                  manager.fileExists(atPath: source.path) else {
                throw NativeReaderFormatError.invalidArchive
            }
            let ext = source.pathExtension.lowercased()
            let accepted = mp3OnlyForVoiceDream
                ? ext == "mp3"
                : ["mp3", "m4a", "m4b", "aac", "wav", "aif", "aiff", "caf", "flac"].contains(ext)
            guard accepted else { throw NativeReaderFormatError.invalidArchive }
            let filename = mp3OnlyForVoiceDream
                ? String(format: "%04d.mp3", index + 1)
                : String(format: "Pista-%04d", index + 1) + "." + ext
            try manager.copyItem(at: source, to: staging.appendingPathComponent(filename))
        }

        let title = current.title.replacingOccurrences(
            of: #"[\\/:*?"<>|\x00-\x1F]"#, with: "_", options: .regularExpression
        ).trimmingCharacters(in: .whitespacesAndNewlines)
        let safeTitle = title.isEmpty ? "Audio" : title
        let outputDirectory = temp.appendingPathComponent(UUID().uuidString, isDirectory: true)
        try manager.createDirectory(at: outputDirectory, withIntermediateDirectories: true)
        let suffix = mp3OnlyForVoiceDream ? " Voice Dream MP3.zip" : "-pistas.zip"
        let output = outputDirectory.appendingPathComponent(safeTitle + suffix)
        try manager.zipItem(at: staging, to: output, shouldKeepParent: false)
        if mp3OnlyForVoiceDream {
            do {
                try NativeDaisyPackageVerifier.validateVoiceDreamMP3Zip(output)
            } catch {
                try? manager.removeItem(at: outputDirectory)
                throw error
            }
        }
        return output
    }

    /// Exportación íntegra: registros, carpetas, archivos originales y medios de DAISY.
    /// No modifica el almacenamiento actual y no restaura datos automáticamente.
    func exportBackup() throws -> URL {
        let manager = FileManager.default
        let temp = manager.temporaryDirectory
        let staging = temp.appendingPathComponent("TifloLector-backup-\(UUID().uuidString)", isDirectory: true)
        try manager.createDirectory(at: staging, withIntermediateDirectories: true)
        defer { try? manager.removeItem(at: staging) }

        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        try encoder.encode(documentsForPersistence())
            .write(to: staging.appendingPathComponent("documentos.json"), options: .atomic)
        try encoder.encode(folders).write(to: staging.appendingPathComponent("carpetas.json"), options: .atomic)

        let support = Self.storageURL.deletingLastPathComponent()
        for folder in ["ReaderMedia", "ReaderOriginals"] {
            let source = support.appendingPathComponent(folder, isDirectory: true)
            if manager.fileExists(atPath: source.path) {
                try manager.copyItem(at: source, to: staging.appendingPathComponent(folder, isDirectory: true))
            }
        }

        let destination = temp.appendingPathComponent("Copia-TifloLector-\(UUID().uuidString).zip")
        try manager.zipItem(at: staging, to: destination, shouldKeepParent: false)
        return destination
    }

    /// Restaura únicamente libros que aún no existen, sin modificar los actuales.
    /// Valida primero toda la copia. Ante un error, revierte los archivos nuevos.
    func restoreBackup(from source: URL) throws -> Int {
        let accessed = source.startAccessingSecurityScopedResource()
        defer { if accessed { source.stopAccessingSecurityScopedResource() } }
        guard let archive = Archive(url: source, accessMode: .read) else {
            throw NativeReaderFormatError.invalidArchive
        }
        let manager = FileManager.default
        let staging = manager.temporaryDirectory
            .appendingPathComponent("restore-\(UUID().uuidString)", isDirectory: true)
        try manager.createDirectory(at: staging, withIntermediateDirectories: true)
        defer { try? manager.removeItem(at: staging) }

        var total: Int64 = 0
        var count = 0
        for entry in archive {
            let path = entry.path
            guard entry.type == .file || entry.type == .directory else {
                throw NativeReaderFormatError.invalidArchive
            }
            let cleanPath = entry.type == .directory && path.hasSuffix("/")
                ? String(path.dropLast()) : path
            let components = cleanPath.split(separator: "/", omittingEmptySubsequences: false)
            guard !path.hasPrefix("/"), !path.contains("\\"),
                  !path.contains(":"), !components.contains(where: { $0 == ".." || $0 == "." }),
                  !components.contains(where: { $0.isEmpty }) else {
                throw NativeReaderFormatError.invalidArchive
            }
            if entry.type == .directory { continue }
            let root = String(components[0])
            guard (components.count == 1 && ["documentos.json", "carpetas.json"].contains(root))
                || (components.count >= 3 && ["ReaderMedia", "ReaderOriginals"].contains(root)
                    && UUID(uuidString: String(components[1])) != nil) else {
                throw NativeReaderFormatError.invalidArchive
            }
            count += 1
            guard entry.uncompressedSize <= 1_500_000_000 else {
                throw NativeReaderFormatError.oversizedArchive
            }
            total += Int64(entry.uncompressedSize)
            guard count <= 10000, total <= 1_500_000_000 else {
                throw NativeReaderFormatError.oversizedArchive
            }
            let destination = staging.appendingPathComponent(path)
            guard !manager.fileExists(atPath: destination.path) else {
                throw NativeReaderFormatError.invalidArchive
            }
            try manager.createDirectory(at: destination.deletingLastPathComponent(),
                                        withIntermediateDirectories: true)
            _ = try archive.extract(entry, to: destination)
        }
        let backedUpDocuments = try JSONDecoder().decode([NativeReadingDocument].self,
            from: Data(contentsOf: staging.appendingPathComponent("documentos.json")))
        let backedUpFolders = try JSONDecoder().decode([String].self,
            from: Data(contentsOf: staging.appendingPathComponent("carpetas.json")))
        guard Set(backedUpDocuments.map(\.id)).count == backedUpDocuments.count,
              backedUpFolders.allSatisfy({ !$0.isEmpty && $0.count <= 80 && $0 != "__unfiled__" }),
              Set(backedUpFolders.map { $0.lowercased() }).count == backedUpFolders.count else {
            throw NativeReaderFormatError.invalidArchive
        }
        let currentIDs = Set(documents.map(\.id))
        let additions = backedUpDocuments.filter { !currentIDs.contains($0.id) }
        let support = Self.storageURL.deletingLastPathComponent()
        // Comprobar que no faltan pistas ni originales para ninguno de los nuevos libros.
        for document in additions {
            for path in (document.trackPaths ?? []) + [document.originalRelativePath].compactMap({ $0 }) {
                let pieces = path.split(separator: "/")
                guard pieces.count >= 3,
                      ["ReaderMedia", "ReaderOriginals"].contains(String(pieces[0])),
                      String(pieces[1]) == document.id.uuidString,
                      !pieces.contains(where: { $0 == ".." || $0 == "." }),
                      manager.fileExists(atPath: staging.appendingPathComponent(path).path) else {
                    throw NativeReaderFormatError.invalidArchive
                }
            }
        }
        var copied: [URL] = []
        do {
            for document in additions {
                for root in ["ReaderMedia", "ReaderOriginals"] {
                    let relative = root + "/" + document.id.uuidString
                    let sourceDirectory = staging.appendingPathComponent(relative, isDirectory: true)
                    guard manager.fileExists(atPath: sourceDirectory.path) else { continue }
                    let target = support.appendingPathComponent(relative, isDirectory: true)
                    guard !manager.fileExists(atPath: target.path) else {
                        throw NativeReaderFormatError.invalidArchive
                    }
                    try manager.createDirectory(at: target.deletingLastPathComponent(),
                                                withIntermediateDirectories: true)
                    try manager.copyItem(at: sourceDirectory, to: target)
                    copied.append(target)
                }
            }
            let oldDocuments = documents
            let oldFolders = folders
            documents.append(contentsOf: additions)
            for name in backedUpFolders where !folders.contains(where: {
                $0.localizedCaseInsensitiveCompare(name) == .orderedSame
            }) { folders.append(name) }
            folders.sort { $0.localizedStandardCompare($1) == .orderedAscending }
            do {
                try save()
                UserDefaults.standard.set(folders, forKey: folderStorageKey)
            } catch {
                documents = oldDocuments
                folders = oldFolders
                throw error
            }
        } catch {
            copied.forEach { try? manager.removeItem(at: $0) }
            throw error
        }
        return additions.count
    }

    func markOpened(_ document: NativeReadingDocument) {
        guard documents.contains(where: { $0.id == document.id }) else { return }
        // UserDefaults writes just this timestamp, not every imported book.
        // Keep the ObservableObject and its NavigationLink hierarchy stable.
        UserDefaults.standard.set(Date(),
            forKey: Self.lastOpenedPrefix + document.id.uuidString)
    }

    func toggleFavorite(_ document: NativeReadingDocument) {
        guard let i = documents.firstIndex(where: { $0.id == document.id }) else { return }
        documents[i].isFavorite = !(documents[i].isFavorite ?? false)
        try? save()
    }

    func updatePreferences(_ document: NativeReadingDocument,
                           _ edit: (inout NativeReaderPreferences) -> Void) {
        guard let index = documents.firstIndex(where: { $0.id == document.id }) else { return }
        var preferences = documents[index].readerPreferences ?? NativeReaderPreferences()
        edit(&preferences)
        documents[index].readerPreferences = preferences
        try? save()
    }

    @discardableResult
    func createFolder(named rawName: String) -> Bool {
        let name = rawName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty, name.count <= 80, name != "__unfiled__",
              !folders.contains(where: { $0.localizedCaseInsensitiveCompare(name) == .orderedSame })
        else { return false }
        folders.append(name)
        folders.sort { $0.localizedStandardCompare($1) == .orderedAscending }
        UserDefaults.standard.set(folders, forKey: folderStorageKey)
        return true
    }

    func move(_ document: NativeReadingDocument, to folder: String?) {
        if let folder, !folders.contains(folder) { return }
        guard let index = documents.firstIndex(where: { $0.id == document.id }) else { return }
        documents[index].folderName = folder
        try? save()
    }

    /// Acciones en lote: una única escritura de la biblioteca por operación.
    @discardableResult
    func moveDocuments(withIDs ids: Set<UUID>, to folder: String?) -> Int {
        if let folder, !folders.contains(folder) { return 0 }
        var changed = 0
        for index in documents.indices where ids.contains(documents[index].id) {
            if documents[index].folderName != folder {
                documents[index].folderName = folder
                changed += 1
            }
        }
        if changed > 0 { try? save() }
        return changed
    }

    @discardableResult
    func markFavorites(withIDs ids: Set<UUID>, favorite: Bool) -> Int {
        var changed = 0
        for index in documents.indices where ids.contains(documents[index].id) {
            if (documents[index].isFavorite ?? false) != favorite {
                documents[index].isFavorite = favorite
                changed += 1
            }
        }
        if changed > 0 { try? save() }
        return changed
    }

    func deleteFolder(_ folder: String) {
        guard folders.contains(folder) else { return }
        // Removing a folder never deletes the books inside it.
        for index in documents.indices where documents[index].folderName == folder {
            documents[index].folderName = nil
        }
        try? save()
        folders.removeAll { $0 == folder }
        UserDefaults.standard.set(folders, forKey: folderStorageKey)
    }

    func resetPreferences(_ document: NativeReadingDocument) {
        guard let index = documents.firstIndex(where: { $0.id == document.id }) else { return }
        documents[index].readerPreferences = nil
        try? save()
    }

    func addBookmark(_ document: NativeReadingDocument, at percent: Int) {
        guard let i = documents.firstIndex(where: { $0.id == document.id }) else { return }
        var bookmarks = documents[i].markedPositions ?? []
        let location = max(0, min(100, percent))
        if !bookmarks.contains(location) { bookmarks.append(location) }
        documents[i].markedPositions = bookmarks.sorted()
        try? save()
    }

    @discardableResult
    func addTextBookmark(_ document: NativeReadingDocument, offset: Int) -> NativeBookmarkSaveResult {
        guard let i = documents.firstIndex(where: { $0.id == document.id }) else {
            return .documentUnavailable
        }
        let count = documents[i].body.count
        let value = max(0, min(count, offset))
        let percent = count > 0 ? Int((Double(value) * 100 / Double(count)).rounded()) : 0
        let previous = documents[i].textBookmarks
        var bookmarks = previous ?? []
        guard !bookmarks.contains(where: { $0.offset == value }) else { return .alreadyExists }
        bookmarks.append(NativeTextBookmark(offset: value, percent: percent))
        documents[i].textBookmarks = bookmarks.sorted { $0.offset < $1.offset }
        do {
            try save()
            return .saved
        } catch {
            documents[i].textBookmarks = previous
            return .failed
        }
    }

    func removeTextBookmark(_ document: NativeReadingDocument, offset: Int) {
        guard let i = documents.firstIndex(where: { $0.id == document.id }) else { return }
        documents[i].textBookmarks?.removeAll { $0.offset == offset }
        try? save()
    }

    @discardableResult
    func addAudioBookmark(_ document: NativeReadingDocument, track: Int, percent: Int,
                          seconds: TimeInterval? = nil) -> NativeBookmarkSaveResult {
        guard let i = documents.firstIndex(where: { $0.id == document.id }), track >= 0 else {
            return .documentUnavailable
        }
        let validSeconds = seconds.flatMap { $0.isFinite ? max(0, $0) : nil }
        let mark = NativeAudioBookmark(track: track, percent: max(0, min(100, percent)),
                                       seconds: validSeconds)
        let previous = documents[i].audioBookmarks
        var saved = previous ?? []
        guard !saved.contains(where: {
            $0.track == track &&
            (validSeconds != nil && $0.seconds != nil
                ? abs($0.seconds! - validSeconds!) < 0.5
                : $0.percent == mark.percent)
        }) else { return .alreadyExists }
        saved.append(mark)
        documents[i].audioBookmarks = saved.sorted {
            $0.track == $1.track ? $0.percent < $1.percent : $0.track < $1.track
        }
        do {
            try save()
            return .saved
        } catch {
            documents[i].audioBookmarks = previous
            return .failed
        }
    }

    func removeAudioBookmark(_ document: NativeReadingDocument, mark: NativeAudioBookmark) {
        guard let i = documents.firstIndex(where: { $0.id == document.id }) else { return }
        documents[i].audioBookmarks?.removeAll { $0 == mark }
        try? save()
    }

    func removeBookmark(_ document: NativeReadingDocument, at percent: Int) {
        guard let i = documents.firstIndex(where: { $0.id == document.id }) else { return }
        documents[i].markedPositions?.removeAll { $0 == percent }
        try? save()
    }

    func savePosition(_ document: NativeReadingDocument, percent: Int) {
        guard let i = documents.firstIndex(where: { $0.id == document.id }) else { return }
        let value = max(0, min(100, percent))
        if documents[i].lastPercent != value {
            documents[i].lastPercent = value
            try? save()
        }
    }

    func saveTextPosition(_ document: NativeReadingDocument, offset: Int) {
        guard let i = documents.firstIndex(where: { $0.id == document.id }) else { return }
        let textLength = documents[i].body.count
        let value = max(0, min(textLength, offset))
        // A position close to the end is not a fully completed book.
        let percent = NativeReaderProgress.textPercent(length: textLength, offset: value)
        if documents[i].lastTextOffset != value || documents[i].lastPercent != percent {
            documents[i].lastTextOffset = value
            documents[i].lastPercent = percent
            try? save()
        }
    }

    func saveAudioPosition(_ document: NativeReadingDocument, track: Int, percent: Int,
                           seconds: TimeInterval? = nil) {
        guard let i = documents.firstIndex(where: { $0.id == document.id }), track >= 0 else { return }
        let value = max(0, min(100, percent))
        let position = seconds.flatMap { $0.isFinite ? max(0, $0) : nil }
        if documents[i].lastTrackIndex != track || documents[i].lastPercent != value ||
           documents[i].lastAudioSeconds != position {
            documents[i].lastTrackIndex = track
            documents[i].lastPercent = value
            documents[i].lastAudioSeconds = position
            try? save()
        }
    }

    func latest(_ document: NativeReadingDocument) -> NativeReadingDocument {
        var resolved = documents.first(where: { $0.id == document.id }) ?? document
        resolved.lastOpenedAt = lastOpenedAt(for: resolved)
        return resolved
    }

    private func save() throws {
        let directory = Self.storageURL.deletingLastPathComponent()
        try FileManager.default.createDirectory(
            at: directory,
            withIntermediateDirectories: true
        )
        try JSONEncoder().encode(documentsForPersistence())
            .write(to: Self.storageURL, options: .atomic)
    }
}

/// Informacion de avance de voz sin depender del ritmo de refresco de SwiftUI.
private final class NativeSpeechProgressDelegate: NSObject, AVSpeechSynthesizerDelegate {
    var onWord: ((NSRange, AVSpeechUtterance) -> Void)?
    var onFinish: ((AVSpeechUtterance) -> Void)?

    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer,
                           willSpeakRangeOfSpeechString characterRange: NSRange,
                           utterance: AVSpeechUtterance) {
        onWord?(characterRange, utterance)
    }

    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer,
                           didFinish utterance: AVSpeechUtterance) {
        onFinish?(utterance)
    }
}

private final class NativeAudioFinishDelegate: NSObject, AVAudioPlayerDelegate {
    var onFinish: ((AVAudioPlayer, Bool) -> Void)?
    func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        onFinish?(player, flag)
    }
}

@MainActor
final class NativeReadingSpeech: ObservableObject {
    private let synthesizer = AVSpeechSynthesizer()
    private let progressDelegate = NativeSpeechProgressDelegate()
    private let audioDelegate = NativeAudioFinishDelegate()
    private var playlistURLs: [URL] = []
    private var daisyClips: [NativeDaisyAudioClip] = []
    private var daisyClipIndex = 0
    private var daisyBoundaryTask: Task<Void, Never>?
    private var playlistIndex = 0
    private var playlistSpeed = 1.0
    private var onTrackChanged: ((Int) -> Void)?
    private var onAudioError: ((String) -> Void)?
    private var baseUTF16 = 0
    private var totalUTF16 = 0
    @Published private(set) var textPercent = 0
    @Published private(set) var textCharacterOffset = 0
    private var spokenText = ""
    private var baseCharacters = 0
    private var previousUTF16 = 0
    private var previousCharacterCount = 0
    private var utteranceOffsets: [ObjectIdentifier: Int] = [:]
    private var lastSpeechUtterance: ObjectIdentifier?
    // Solo una frase en la cola del sintetizador en cada momento.
    private var speechQueue: [(utterance: AVSpeechUtterance, delay: TimeInterval)] = []
    private var speechQueueIndex = 0
    private var speechEnqueuedThroughIndex = 0
    // Al pausar texto se corta el sintetizador y se conserva el cursor para reanudar.
    private var systemSpeechNeedsRestart = false

    // Los encabezados importados de EPUB/HTML conservan # para la navegación.
    // En la voz sustituimos solo esos marcadores por espacios del mismo tamaño:
    // así ningún cursor, marca o posición de lectura cambia.
    private static func textForSpeech(_ source: String) -> String {
        var result = NativeReaderHeadingDisplay.mask(in: source)
        // Keep original punctuation in EPUB/DAISY/braille. Some voices read
        // the opening mark aloud; for synthesized speech the closing ! still
        // signals the exclamation. Replace one character with one space so
        // saved offsets and bookmarks remain stable.
        if let opening = try? NSRegularExpression(pattern: #"¡(?=\p{L})"#) {
            result = opening.stringByReplacingMatches(
                in: result, options: [],
                range: NSRange(result.startIndex..., in: result), withTemplate: " "
            )
        }
        return result
    }

    /// Always put the next few utterances into Apple's native queue
    /// before the current one ends. The synthesizer itself controls the
    /// punctuation gap via postUtteranceDelay, even with a locked screen.
    private func enqueueSystemLookahead() {
        guard isPlaying, !isPaused, !systemSpeechNeedsRestart,
              !speechQueue.isEmpty else { return }
        let pending = NativeReaderSpeechQueueWindow.pending(
            current: speechQueueIndex,
            alreadyQueued: speechEnqueuedThroughIndex,
            total: speechQueue.count)
        for index in pending {
            synthesizer.speak(speechQueue[index].utterance)
            // Resubmitting an utterance throws an Objective-C exception.
            speechEnqueuedThroughIndex = index + 1
        }
    }

    /// Existing utterances can retain their rate/pitch/voice once queued.
    /// Update future items; at most a few pre-enqueued sentences may still
    /// use their previously selected settings. This keeps background audio
    /// continuous without restarting the currently spoken sentence.
    func updateLiveSystemSettings(speed: Double, pitch: Float,
                                  voiceIdentifier: String, language: String = "es-ES") {
        guard player == nil, !isGeneratedSpeech, !speechQueue.isEmpty else { return }
        let first = systemSpeechNeedsRestart ? speechQueueIndex : speechQueueIndex + 1
        guard first < speechQueue.count else { return }
        for index in first..<speechQueue.count {
            let utterance = speechQueue[index].utterance
            utterance.rate = min(AVSpeechUtteranceMaximumSpeechRate,
                max(AVSpeechUtteranceMinimumSpeechRate,
                    AVSpeechUtteranceDefaultSpeechRate * Float(speed)))
            utterance.pitchMultiplier = max(0.5, min(2, pitch))
            // This volume is specific to the selected TifloLector voice.
            // Never change the VoiceOver or hardware audio output volume.
            utterance.volume = max(0, min(1, NativeReaderVoiceProfileStore.load(for: voiceIdentifier)?.volume ?? 1))
            utterance.voice = (voiceIdentifier.isEmpty ? nil :
                AVSpeechSynthesisVoice(identifier: voiceIdentifier))
                ?? AVSpeechSynthesisVoice(language: language)
        }
    }

    init() {
        progressDelegate.onWord = { [weak self] range, utterance in
            Task { @MainActor [weak self] in
                // A cancelled or paused utterance can still post a callback on
                // the next run loop. It must never advance the saved cursor.
                guard let self, self.isPlaying, !self.isPaused, self.player == nil,
                      self.totalUTF16 > 0,
                      self.speechQueue.indices.contains(self.speechQueueIndex),
                      ObjectIdentifier(self.speechQueue[self.speechQueueIndex].utterance)
                        == ObjectIdentifier(utterance),
                      let segmentBase = self.utteranceOffsets[ObjectIdentifier(utterance)] else {
                    return
                }
                // willSpeakRange announces the word BEFORE it has been spoken.
                // Its end would skip the current word on Pause or Magic Tap.
                // Resume at that word's beginning rather than at a paragraph.
                let utf16Start = max(0, min(self.spokenText.utf16.count,
                                           segmentBase + range.location))
                guard utf16Start >= self.previousUTF16 else { return }
                let cursor = String.Index(utf16Offset: utf16Start, in: self.spokenText)
                self.previousUTF16 = utf16Start
                self.previousCharacterCount = self.spokenText.distance(
                    from: self.spokenText.startIndex, to: cursor)
                self.textCharacterOffset = self.baseCharacters + self.previousCharacterCount
                let count = self.baseUTF16 + utf16Start
                self.textPercent = max(0, min(100,
                    Int(Double(count) * 100 / Double(self.totalUTF16))))
            }
        }
        progressDelegate.onFinish = { [weak self] utterance in
            Task { @MainActor [weak self] in
                guard let self, self.isPlaying, !self.isPaused, self.player == nil,
                      self.utteranceOffsets[ObjectIdentifier(utterance)] != nil,
                      self.speechQueue.indices.contains(self.speechQueueIndex),
                      ObjectIdentifier(self.speechQueue[self.speechQueueIndex].utterance) == ObjectIdentifier(utterance) else { return }
                let completedText = self.speechQueue[self.speechQueueIndex].utterance.speechString
                let segmentBase = self.utteranceOffsets[ObjectIdentifier(utterance)] ?? 0
                let completedUTF16 = min(self.spokenText.utf16.count,
                                         segmentBase + completedText.utf16.count)
                // El último callback de palabra puede no llegar al cerrar una frase.
                // Consolidar su final evita reanudar desde el párrafo anterior.
                if completedUTF16 >= self.previousUTF16 {
                    self.previousUTF16 = completedUTF16
                    let completedIndex = String.Index(utf16Offset: completedUTF16,
                                                      in: self.spokenText)
                    self.previousCharacterCount = self.spokenText.distance(
                        from: self.spokenText.startIndex, to: completedIndex)
                    self.textCharacterOffset = self.baseCharacters + self.previousCharacterCount
                    self.textPercent = max(0, min(100, Int(Double(self.baseUTF16 + completedUTF16)
                        * 100 / Double(max(1, self.totalUTF16)))))
                }
                self.speechQueueIndex += 1
                if self.lastSpeechUtterance == ObjectIdentifier(utterance) {
                    self.textCharacterOffset = self.baseCharacters + self.spokenText.count
                    self.textPercent = 100
                    self.isPlaying = false
                    self.isPaused = false
                    self.speechQueue.removeAll()
                } else if !self.isPaused {
                    self.enqueueSystemLookahead()
                }
            }
        }
        synthesizer.delegate = progressDelegate
        audioDelegate.onFinish = { [weak self] completed, success in
            Task { @MainActor [weak self] in
                guard let self, self.player === completed else { return }
                if self.isGeneratedSpeech {
                    guard success, self.geminiSegments.indices.contains(self.geminiSegmentIndex) else {
                        self.geminiOnError?("No se pudo completar el fragmento de voz.")
                        self.stop()
                        return
                    }
                    let segment = self.geminiSegments[self.geminiSegmentIndex]
                    self.geminiCursorUTF16 += segment.utf16.count
                    self.generatedCharacters += segment.count
                    self.textCharacterOffset = self.generatedBaseCharacters + self.generatedCharacters
                    self.textPercent = min(100, Int(Double(self.geminiCursorUTF16) * 100 /
                        Double(max(1, self.totalUTF16))))
                    self.geminiSegmentIndex += 1
                    self.player = nil
                    if self.geminiSegmentIndex < self.geminiSegments.count {
                        if !self.isPaused { self.playNextGeminiSegment() }
                    } else {
                        self.isPlaying = false
                        self.isPaused = false
                        self.isGemini = false
                        self.isPhonon = false
                    }
                    return
                }
                if !self.daisyClips.isEmpty {
                    if success { self.advanceDaisyClip() }
                    else { self.onAudioError?("No se pudo completar el fragmento DAISY."); self.stop() }
                    return
                }
                self.isPlaying = false
                self.isPaused = false
                guard success, self.playlistURLs.indices.contains(self.playlistIndex + 1) else {
                    return
                }
                let next = self.playlistIndex + 1
                do {
                    try self.startAudio(self.playlistURLs[next], speed: self.playlistSpeed, at: 0)
                    self.playlistIndex = next
                    self.onTrackChanged?(next)
                } catch {
                    self.onAudioError?(error.localizedDescription)
                    self.stop()
                }
            }
        }
    }
    private var player: AVAudioPlayer?
    private var geminiTask: Task<Void, Never>?
    private var geminiSegments: [String] = []
    private var geminiSegmentIndex = 0
    private var geminiVoice = "Kore"
    private var geminiCursorUTF16 = 0
    private var geminiGeneration = 0
    private var geminiOnError: ((String) -> Void)?
    private var generatedBaseCharacters = 0
    private var generatedCharacters = 0
    private(set) var isGemini = false
    private(set) var isPhonon = false
    var isGeneratedSpeech: Bool { isGemini || isPhonon }
    private var sleepTask: Task<Void, Never>?
    var onSleepExpired: (() -> Void)?
    @Published private(set) var isPlaying = false
    @Published private(set) var isPaused = false

    var hasAudio: Bool { player != nil }
    var audioDuration: TimeInterval { player?.duration ?? 0 }
    var audioElapsed: TimeInterval { player?.currentTime ?? 0 }
    var audioPercent: Int {
        guard audioDuration > 0 else { return 0 }
        return max(0, min(100, Int(audioElapsed / audioDuration * 100)))
    }

    func play(_ text: String, speed: Double = 1.0, pitch: Float = 1.0,
              language: String = "es-ES", voiceIdentifier: String = "", baseUTF16: Int = 0,
              totalUTF16: Int? = nil, baseCharacters: Int = 0) {
        stop()
        guard !text.isEmpty else { return }
        self.spokenText = text
        self.baseCharacters = baseCharacters
        self.previousUTF16 = 0
        self.previousCharacterCount = 0
        self.textCharacterOffset = baseCharacters
        self.baseUTF16 = baseUTF16
        self.totalUTF16 = max(1, totalUTF16 ?? text.utf16.count)
        textPercent = max(0, min(100,
            Int(Double(baseUTF16) * 100 / Double(self.totalUTF16))))
        // La voz sigue sonando con la pantalla bloqueada y otras apps abiertas.
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .spokenAudio)
        try? AVAudioSession.sharedInstance().setActive(true)
        utteranceOffsets.removeAll()
        lastSpeechUtterance = nil
        systemSpeechNeedsRestart = false
        speechQueueIndex = 0
        speechEnqueuedThroughIndex = 0
        speechQueue.removeAll()
        let segments = NativeReaderPauseProfile.segments(Self.textForSpeech(text), voiceIdentifier: voiceIdentifier)
        var utf16Offset = 0
        for (index, segment) in segments.enumerated() {
            let utterance = AVSpeechUtterance(string: segment.text)
            utterance.voice = (voiceIdentifier.isEmpty ? nil :
                AVSpeechSynthesisVoice(identifier: voiceIdentifier))
                ?? AVSpeechSynthesisVoice(language: language)
            utterance.rate = min(AVSpeechUtteranceMaximumSpeechRate,
                max(AVSpeechUtteranceMinimumSpeechRate,
                    AVSpeechUtteranceDefaultSpeechRate * Float(speed)))
            utterance.pitchMultiplier = max(0.5, min(2, pitch))
            utterance.volume = max(0, min(1, NativeReaderVoiceProfileStore.load(for: voiceIdentifier)?.volume ?? 1))
            // El retardo se programa entre frases, sin saturar la cola de AVSpeechSynthesizer.
            utterance.postUtteranceDelay = segment.delay
            let identifier = ObjectIdentifier(utterance)
            utteranceOffsets[identifier] = utf16Offset
            lastSpeechUtterance = identifier
            utf16Offset += segment.text.utf16.count
            speechQueue.append((utterance: utterance, delay: segment.delay))
        }
        isPlaying = true
        isPaused = false
        enqueueSystemLookahead()
    }

    private func geminiChunks(_ text: String) -> [String] {
        var result: [String] = []
        var remaining = text[...]
        while !remaining.isEmpty {
            let end = remaining.index(remaining.startIndex,
                offsetBy: min(1200, remaining.count))
            var split = end
            if end < remaining.endIndex {
                let minOffset = remaining.index(remaining.startIndex,
                    offsetBy: min(600, remaining.count))
                var at = end
                while at > minOffset {
                    let preceding = remaining[remaining.index(before: at)]
                    if preceding.isWhitespace || preceding == "." || preceding == "," {
                        split = at
                        break
                    }
                    at = remaining.index(before: at)
                }
            }
            result.append(String(remaining[..<split]))
            remaining = remaining[split...]
        }
        return result
    }

    func playGemini(_ text: String, voice: String,
                    baseUTF16: Int, totalUTF16: Int, baseCharacters: Int,
                    onError: @escaping (String) -> Void) throws {
        try playGenerated(text, engine: 1, voice: voice,
                          baseUTF16: baseUTF16, totalUTF16: totalUTF16, baseCharacters: baseCharacters, onError: onError)
    }

    func playPhonon(_ text: String, voice: String,
                    baseUTF16: Int, totalUTF16: Int, baseCharacters: Int,
                    onError: @escaping (String) -> Void) throws {
        guard NativePhononRuntime.isUsable else {
            throw NativePhononRuntime.RuntimeError.engineUnavailable
        }
        try playGenerated(text, engine: 2, voice: voice,
                          baseUTF16: baseUTF16, totalUTF16: totalUTF16, baseCharacters: baseCharacters, onError: onError)
    }

    private func playGenerated(_ text: String, engine: Int, voice: String,
                    baseUTF16: Int, totalUTF16: Int, baseCharacters: Int,
                    onError: @escaping (String) -> Void) throws {
        stop()
        // The selected external engine only starts when the user presses Play.
        guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        geminiSegments = geminiChunks(text)
        geminiVoice = voice
        geminiSegmentIndex = 0
        geminiCursorUTF16 = baseUTF16
        generatedBaseCharacters = baseCharacters
        generatedCharacters = 0
        self.totalUTF16 = max(1, totalUTF16)
        self.textCharacterOffset = baseCharacters
        self.textPercent = Int(Double(baseUTF16) * 100 / Double(self.totalUTF16))
        self.geminiOnError = onError
        isGemini = engine == 1
        isPhonon = engine == 2
        isPlaying = true
        isPaused = false
        playNextGeminiSegment()
    }

    private func playNextGeminiSegment() {
        guard isGeneratedSpeech, !isPaused, geminiSegments.indices.contains(geminiSegmentIndex) else { return }
        while geminiSegments.indices.contains(geminiSegmentIndex),
              geminiSegments[geminiSegmentIndex]
                .trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            geminiCursorUTF16 += geminiSegments[geminiSegmentIndex].utf16.count
            generatedCharacters += geminiSegments[geminiSegmentIndex].count
            geminiSegmentIndex += 1
        }
        if !geminiSegments.indices.contains(geminiSegmentIndex) {
            textCharacterOffset = generatedBaseCharacters + generatedCharacters
            textPercent = 100
            isGemini = false
            isPhonon = false
            isPlaying = false
            return
        }
        let generation = geminiGeneration
        let segment = geminiSegments[geminiSegmentIndex]
        geminiTask = Task { [weak self] in
            guard let self else { return }
            do {
                let data: Data
                if self.isPhonon {
                    data = try await NativePhononRuntime.generate(text: segment, voice: self.geminiVoice)
                } else {
                    data = try await NativeGeminiSpeech.generate(segment, voice: self.geminiVoice)
                }
                try Task.checkCancellation()
                guard generation == self.geminiGeneration, self.isGeneratedSpeech, !self.isPaused else { return }
                try AVAudioSession.sharedInstance().setCategory(.playback, mode: .spokenAudio)
                try AVAudioSession.sharedInstance().setActive(true)
                let audio = try AVAudioPlayer(data: data)
                audio.delegate = self.audioDelegate
                // Set the selected generated voice's gain only. Do not
                // change system output or VoiceOver, including via Bluetooth.
                audio.volume = NativeReaderGeneratedVoiceVolume.gain(
                    engine: self.isPhonon ? 2 : 1, voice: self.geminiVoice)
                audio.prepareToPlay()
                guard audio.play() else { throw NativeGeminiSpeech.Error.unavailable }
                self.player = audio
                self.isPlaying = true
            } catch is CancellationError {
                // Stop and seek cancel in-flight HTTP work without reporting an error.
            } catch {
                guard generation == self.geminiGeneration else { return }
                self.geminiOnError?(error.localizedDescription)
                self.stop()
            }
        }
    }

    func updateLiveGeneratedVolume() {
        guard isGeneratedSpeech, let player else { return }
        player.volume = NativeReaderGeneratedVoiceVolume.gain(
            engine: isPhonon ? 2 : 1, voice: geminiVoice)
    }

    private func startAudio(_ url: URL, speed: Double, at percent: Int,
                            atSeconds seconds: TimeInterval? = nil) throws {
        player?.stop()
        player = nil
        try AVAudioSession.sharedInstance().setCategory(.playback, mode: .spokenAudio)
        try AVAudioSession.sharedInstance().setActive(true)
        let audio = try AVAudioPlayer(contentsOf: url)
        audio.delegate = audioDelegate
        audio.enableRate = true
        audio.rate = Float(max(0.5, min(2.0, speed)))
        audio.prepareToPlay()
        audio.currentTime = seconds.map { max(0, min(audio.duration, $0)) }
            ?? audio.duration * Double(max(0, min(100, percent))) / 100
        guard audio.play() else { throw NativeReaderFormatError.unsupported(url.pathExtension) }
        player = audio
        isPlaying = true
        isPaused = false
        scheduleDaisyBoundary()
    }

    func playAudio(_ url: URL, speed: Double = 1.0, at percent: Int = 0) throws {
        stop()
        try startAudio(url, speed: speed, at: percent)
    }

    func playPlaylist(_ urls: [URL], speed: Double, track: Int, at percent: Int,
                      onTrackChanged: @escaping (Int) -> Void,
                      onError: @escaping (String) -> Void) throws {
        guard urls.indices.contains(track) else {
            throw NativeReaderFormatError.unsupported("pista de audio no disponible")
        }
        stop()
        playlistURLs = urls
        playlistIndex = track
        playlistSpeed = speed
        self.onTrackChanged = onTrackChanged
        self.onAudioError = onError
        do {
            try startAudio(urls[track], speed: speed, at: percent)
        } catch {
            stop()
            throw error
        }
    }

    /// Play the exact NCC/NCX/SMIL clip sequence, including repeated clips
    /// from one physical file and out-of-order time ranges. Legacy books
    /// without this metadata continue using playPlaylist.
    func playDaisySequence(_ urls: [URL], clips: [NativeDaisyAudioClip],
                           speed: Double, track: Int, at percent: Int,
                           seconds: TimeInterval?,
                           onTrackChanged: @escaping (Int) -> Void,
                           onError: @escaping (String) -> Void) throws {
        guard urls.indices.contains(track), !clips.isEmpty,
              clips.allSatisfy({ urls.indices.contains($0.track) &&
                $0.begin.isFinite && $0.begin >= 0 &&
                ($0.end == nil || ($0.end!.isFinite && $0.end! > $0.begin)) })
        else { throw NativeReaderFormatError.invalidArchive }

        let resumeSeconds: TimeInterval? = seconds.flatMap {
            $0.isFinite ? max(0, $0) : nil
        } ?? (percent > 0 ? (try? AVAudioPlayer(contentsOf: urls[track]))
            .map { $0.duration * Double(percent) / 100 } : nil)
        let candidate = clips.firstIndex { clip in
            clip.track == track && (resumeSeconds == nil ||
                (resumeSeconds! >= clip.begin &&
                 (clip.end == nil || resumeSeconds! < clip.end!)))
        } ?? clips.firstIndex(where: { $0.track == track })
        guard let index = candidate else { throw NativeReaderFormatError.invalidArchive }
        stop()
        playlistURLs = urls
        playlistSpeed = speed
        self.onTrackChanged = onTrackChanged
        self.onAudioError = onError
        daisyClips = clips
        daisyClipIndex = index
        let clip = clips[index]
        let position = max(clip.begin, resumeSeconds ?? clip.begin)
        do {
            try startAudio(urls[clip.track], speed: speed, at: 0,
                           atSeconds: min(position, clip.end ?? position))
            playlistIndex = clip.track
        } catch {
            stop()
            throw error
        }
    }

    /// One cancellable boundary alarm per clip (not a high-frequency polling
    /// timer). It follows playback rate and is rescheduled after Pause/Seek.
    private func scheduleDaisyBoundary() {
        daisyBoundaryTask?.cancel()
        daisyBoundaryTask = nil
        guard daisyClips.indices.contains(daisyClipIndex),
              let end = daisyClips[daisyClipIndex].end,
              let player, player.isPlaying, end < player.duration else { return }
        let expected = ObjectIdentifier(player)
        let remaining = max(0, end - player.currentTime)
        let delay = max(0.02, remaining / Double(max(0.5, player.rate)))
        daisyBoundaryTask = Task { @MainActor [weak self] in
            do { try await Task.sleep(for: .seconds(delay)) }
            catch { return }
            guard let self, !Task.isCancelled, self.isPlaying, !self.isPaused,
                  let current = self.player,
                  ObjectIdentifier(current) == expected else { return }
            if current.currentTime >= end - 0.04 { self.advanceDaisyClip() }
            else { self.scheduleDaisyBoundary() }
        }
    }

    private func advanceDaisyClip() {
        daisyBoundaryTask?.cancel()
        daisyBoundaryTask = nil
        guard daisyClips.indices.contains(daisyClipIndex + 1) else {
            player?.stop()
            player = nil
            isPlaying = false
            isPaused = false
            daisyClips = []
            return
        }
        let next = daisyClipIndex + 1
        let clip = daisyClips[next]
        daisyClipIndex = next
        do {
            try startAudio(playlistURLs[clip.track], speed: playlistSpeed,
                           at: 0, atSeconds: clip.begin)
            playlistIndex = clip.track
            onTrackChanged?(clip.track)
        } catch {
            onAudioError?(error.localizedDescription)
            stop()
        }
    }

    func seek(to percent: Int) {
        guard let player else { return }
        player.currentTime = player.duration * Double(max(0, min(100, percent))) / 100
        scheduleDaisyBoundary()
    }

    func seek(toSeconds seconds: TimeInterval) {
        guard let player, seconds.isFinite else { return }
        player.currentTime = max(0, min(player.duration, seconds))
        scheduleDaisyBoundary()
    }

    func skip(seconds: TimeInterval) {
        guard let player else { return }
        player.currentTime = max(0, min(player.duration, player.currentTime + seconds))
        scheduleDaisyBoundary()
    }

    func pause() {
        daisyBoundaryTask?.cancel()
        daisyBoundaryTask = nil
        if let player { player.pause() }
        else if isGeneratedSpeech {
            geminiGeneration += 1
            geminiTask?.cancel()
        } else {
            // Detener la salida real evita depender de que pauseSpeaking sea respetado
            // por todas las voces instaladas. El cursor queda disponible para reanudar.
            systemSpeechNeedsRestart = !speechQueue.isEmpty
            // Mark paused before requesting stop. Any queued delegate event
            // must observe this state and must not overwrite the checkpoint.
            isPlaying = false
            isPaused = true
            _ = synthesizer.stopSpeaking(at: .immediate)
        }
        sleep(after: 0) // Al pausar no sigue corriendo la cuenta del apagado.
        isPlaying = false
        isPaused = true
    }

    func resume() {
        // After Siri/calls or another audio-session interruption, playback
        // must reactivate its session before resuming a queued utterance.
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .spokenAudio)
        try? AVAudioSession.sharedInstance().setActive(true)
        if systemSpeechNeedsRestart && !isGeneratedSpeech && player == nil {
            let resumeUTF16 = max(0, min(previousUTF16, spokenText.utf16.count))
            let resumeCharacters = max(0, min(previousCharacterCount, spokenText.count))
            let remainder = String(spokenText.dropFirst(resumeCharacters))
            let resumedVoice = speechQueue.indices.contains(speechQueueIndex)
                ? speechQueue[speechQueueIndex].utterance.voice?.identifier ?? "" : ""
            let resumedLanguage = speechQueue.indices.contains(speechQueueIndex)
                ? speechQueue[speechQueueIndex].utterance.voice?.language ?? "es-ES" : "es-ES"
            let currentUtterance = speechQueue.indices.contains(speechQueueIndex)
                ? speechQueue[speechQueueIndex].utterance : nil
            let resumedSpeed = currentUtterance.map {
                Double($0.rate / AVSpeechUtteranceDefaultSpeechRate)
            } ?? 1.0
            let resumedPitch = currentUtterance?.pitchMultiplier ?? 1.0
            let total = totalUTF16
            let base = baseUTF16 + resumeUTF16
            let characterBase = baseCharacters + resumeCharacters
            systemSpeechNeedsRestart = false
            if !remainder.isEmpty {
                play(remainder, speed: resumedSpeed, pitch: resumedPitch,
                     language: resumedLanguage, voiceIdentifier: resumedVoice,
                     baseUTF16: base, totalUTF16: total, baseCharacters: characterBase)
            } else { stop() }
            return
        }
        // Remove the paused state before requesting the next generated segment:
        // the segment generator deliberately refuses to run while paused.
        isPaused = false
        if isGeneratedSpeech {
            if let player { player.play() } else { playNextGeminiSegment() }
        } else if let player { player.play() }
        else if synthesizer.isPaused { _ = synthesizer.continueSpeaking() }
        else {
            // A stopped system synthesizer uses the native lookahead queue;
            // the old one-at-a-time helper no longer exists. Restore the
            // playing flag first so enqueueSystemLookahead can advance.
            isPlaying = true
            enqueueSystemLookahead()
        }
        isPlaying = true
        scheduleDaisyBoundary()
    }

    func refresh() {
        // AVAudioPlayer finishes at the FILE end, not at the clipEnd in SMIL.
        // Advance to the next referenced clip before unrelated audio can play.
        if isPlaying, !isPaused, !daisyClips.isEmpty,
           daisyClips.indices.contains(daisyClipIndex), let player,
           let end = daisyClips[daisyClipIndex].end,
           player.currentTime >= min(end, player.duration) - 0.04 {
            advanceDaisyClip()
            return
        }
        if let player, !player.isPlaying && !isPaused { isPlaying = false }
        if player == nil && !synthesizer.isSpeaking && !isPaused && !isGeneratedSpeech
            && speechQueue.isEmpty {
            isPlaying = false
        }
    }

    func sleep(after minutes: Int) {
        sleep(afterSeconds: TimeInterval(minutes * 60))
    }

    func sleep(afterSeconds seconds: TimeInterval) {
        sleepTask?.cancel()
        sleepTask = nil
        guard seconds > 0 else { return }
        sleepTask = Task { [weak self] in
            do {
                try await Task.sleep(for: .seconds(seconds))
            } catch {
                return
            }
            guard !Task.isCancelled else { return }
            self?.onSleepExpired?()
            self?.stop()
        }
    }

    func stop() {
        daisyBoundaryTask?.cancel()
        daisyBoundaryTask = nil
        sleepTask?.cancel()
        sleepTask = nil
        geminiGeneration += 1
        geminiTask?.cancel()
        geminiTask = nil
        geminiSegments = []
        geminiSegmentIndex = 0
        geminiOnError = nil
        isGemini = false
        isPhonon = false
        player?.stop()
        player = nil
        playlistURLs = []
        daisyClips = []
        daisyClipIndex = 0
        playlistIndex = 0
        onTrackChanged = nil
        onAudioError = nil
        synthesizer.stopSpeaking(at: .immediate)
        systemSpeechNeedsRestart = false
        speechEnqueuedThroughIndex = 0
        speechQueue.removeAll()
        speechQueueIndex = 0
        utteranceOffsets.removeAll()
        lastSpeechUtterance = nil
        isPlaying = false
        isPaused = false
    }
}

struct NativeReaderLibraryScreen: View {
    @EnvironmentObject private var library: NativeReaderLibrary
    @AppStorage("native-ios-language") private var languageIndex = 0
    @StateObject private var speech = NativeReadingSpeech()
    @State private var importPresented = false
    @State private var importFolderPresented = false
    @State private var importingFolder = false
    @State private var importFolderStatus = ""
    @State private var importingFiles = false
    @State private var importFilesStatus = ""
    @State private var restorePresented = false
    @State private var restoreResult: String?
    @State private var importSourcesPresented = false
    @State private var externalCatalogPresented = false
    @State private var information: NativeReadingDocument?
    @State private var documentToDelete: NativeReadingDocument?
    @State private var confirmDeletion = false
    @State private var importError: String?
    @State private var documentToRename: NativeReadingDocument?
    @State private var proposedTitle = ""
    @State private var newFolderName = ""
    @State private var showCreateFolder = false
    @State private var showFolderPicker = false
    @State private var folderToDelete: String?
    @State private var folderForDocument: NativeReadingDocument?
    @State private var documentToConfigure: NativeReadingDocument?
    @State private var documentToConvert: NativeReadingDocument?
    @State private var documentToTranslate: NativeReadingDocument?
    @State private var selectionMode = false
    @State private var selectedDocumentIDs: Set<UUID> = []
    @State private var showShareFallbackWarning = false
    @State private var pendingShareURLs: [URL] = []
    @State private var shareFallbackCount = 0
    @State private var showBulkMove = false
    @State private var showCreateFolderForSelection = false
    @State private var showBulkDelete = false
    @State private var selectionFeedback: String?
    @State private var shortcutMessage: String?

    @AppStorage("native-reading-folder-filter") private var selectedFolder = ""
    // Stored on-device, rather than resetting folder navigation on reentry.
    @AppStorage("native-reading-folder-entry-mode") private var folderEntryMode = 0
    @AppStorage("native-reading-filter") private var filterIndex = 0
    @AppStorage("native-reading-sort") private var sortIndex = 0
    @AppStorage("native-reading-speed-index") private var speedIndex = 2
    @AppStorage("native-reading-pitch-index") private var pitchIndex = 2
    @AppStorage("native-reading-voice-id") private var voiceID = ""
    @AppStorage("native-voiceover-library-detail-index") private var voiceOverDetailIndex = 0
    private let pitches: [Float] = [0.8, 0.9, 1.0, 1.1, 1.2]
 
    private var folderFilterIndex: Binding<Int> {
        let names = library.folders
        return Binding(
            get: {
                if selectedFolder == "" { return 0 }
                if selectedFolder == "__unfiled__" { return 1 }
                return names.firstIndex(of: selectedFolder).map { $0 + 2 } ?? 0
            },
            set: { value in
                if value == 0 { selectedFolder = "" }
                else if value == 1 { selectedFolder = "__unfiled__" }
                else if names.indices.contains(value - 2) { selectedFolder = names[value - 2] }
            }
        )
    }

    private var selectedFolderLabel: String {
        if selectedFolder == "__unfiled__" { return "Sin carpeta" }
        if selectedFolder.isEmpty { return "Todas" }
        return library.folders.contains(selectedFolder) ? selectedFolder : "Todas"
    }

    /// Un único elemento accesible; el progreso y sus detalles usan el idioma
    /// de TifloAcosta sin depender del idioma general del dispositivo.
    private func documentRowLabel(_ doc: NativeReadingDocument) -> String {
        let code = NativeAppLanguage.code(for: languageIndex)
        let locale = Locale(identifier: code)
        let saved = library.latest(doc)
        let progress = max(0, min(100, saved.lastPercent ?? 0))
        let progressText: String
        if let paths = saved.trackPaths, !paths.isEmpty {
            // lastPercent means percent of THIS track, not the entire audiobook.
            let track = max(0, min(paths.count - 1, saved.lastTrackIndex ?? 0))
            let template = NativeAppLanguage.message(
                "Pista %d de %d, %d por ciento de esta pista.", languageCode: code)
            progressText = String(format: template, locale: locale, track + 1, paths.count, progress)
        } else if !saved.body.isEmpty, let offset = saved.lastTextOffset {
            let exact = NativeReaderProgress.textPercent(length: saved.body.count, offset: offset)
            progressText = String(format:
                NativeAppLanguage.message("%d por ciento leído", languageCode: code),
                locale: locale, exact)
        } else if saved.lastPercent != nil {
            // Legacy progress without a cursor does not prove book completion.
            progressText = String(format:
                NativeAppLanguage.message("Progreso guardado: %d por ciento.", languageCode: code),
                locale: locale, progress)
        } else {
            progressText = String(format:
                NativeAppLanguage.message("%d por ciento leído", languageCode: code),
                locale: locale, 0)
        }
        let shortLabel = "\(doc.title), \(progressText)"
        if voiceOverDetailIndex == 0 { return shortLabel }
        let formatText = String(format: NativeAppLanguage.message("formato %@", languageCode: code),
                                locale: locale, doc.formatLabel)
        let formatLabel = "\(shortLabel), \(formatText)"
        if voiceOverDetailIndex == 1 { return formatLabel }
        let folder = doc.folderName ?? NativeAppLanguage.message("Sin carpeta", languageCode: code)
        let folderText = String(format: NativeAppLanguage.message("carpeta %@", languageCode: code),
                                locale: locale, folder)
        return "\(formatLabel), \(folderText)"
    }

    private var shownDocuments: [NativeReadingDocument] {
        let calendar = Calendar.current
        var items = library.documents.filter { doc in
            let ext = (doc.fileExtension ?? "txt").lowercased()
            switch filterIndex {
            case 1: return ["txt", "text", "md", "markdown", "html", "htm", "rtf",
                             "csv", "json", "xml", "log", "srt", "fb2", "odt"].contains(ext)
            case 2: return ext == "pdf"
            case 3: return ext == "epub"
            case 4: return ["docx", "pptx", "ppsx", "pptm", "xlsx", "xlsm"].contains(ext)
            case 5: return doc.hasAudio || ext == "daisy"
            case 6: return doc.hasBookmarks
            case 7: return doc.isFavorite == true
            case 8: return calendar.isDateInToday(doc.importedAt)
            case 9: return doc.importedAt >= (calendar.date(byAdding: .day, value: -7, to: .now) ?? .now)
            case 10: return doc.importedAt >= (calendar.date(byAdding: .month, value: -1, to: .now) ?? .now)
            default: return true
            }
        }
        switch sortIndex {
        case 1: items.sort { $0.importedAt < $1.importedAt }
        case 2: items.sort { $0.title.localizedStandardCompare($1.title) == .orderedAscending }
        case 3: items.sort { $0.title.localizedStandardCompare($1.title) == .orderedDescending }
        case 4: items.sort { $0.formatLabel < $1.formatLabel }
        case 5: items.sort {
            (library.lastOpenedAt(for: $0) ?? .distantPast)
                > (library.lastOpenedAt(for: $1) ?? .distantPast)
        }
        default: items.sort { $0.importedAt > $1.importedAt }
        }
        return items
    }

    private var visibleSelection: Set<UUID> {
        selectedDocumentIDs.intersection(Set(shownDocuments.map(\.id)))
    }

    private func toggleSelection(_ id: UUID) {
        if selectedDocumentIDs.contains(id) {
            selectedDocumentIDs.remove(id)
        } else {
            selectedDocumentIDs.insert(id)
        }
    }

    private func finishSelection(_ message: String? = nil) {
        selectedDocumentIDs.removeAll()
        selectionMode = false
        selectionFeedback = message
    }

    /// Las carpetas son pantallas independientes; no modifican el filtro de biblioteca.
    private func folderDocumentsView(_ folder: String?) -> some View {
        List {
            let items = library.documents.filter { $0.folderName == folder }
            if items.isEmpty {
                Text("No hay documentos en esta carpeta.")
            }
            ForEach(items) { doc in
                NavigationLink {
                    if NativeReaderFormats.isVideo(doc) {
                        NativeReaderVideoScreen(document: doc)
                            .onAppear { library.markOpened(doc) }
                    } else {
                        NativeReadingScreen(document: doc, speech: speech)
                            .onAppear { library.markOpened(doc) }
                    }
                } label: {
                    Text(documentRowLabel(doc))
                }
                .accessibilityHint("Abre el documento dentro de la carpeta.")
                .accessibilityAction(named: Text("Mover a carpeta")) {
                    showFolderPicker = false
                    folderForDocument = doc
                }
            }
        }
        .navigationTitle(folder ?? "Sin carpeta")
        .tifloScreenSurface()
    }

    private func resumeRequestedBook() {
        let defaults = UserDefaults.standard
        let key = "native-ios-resume-last-book-shortcut-v1"
        guard defaults.bool(forKey: key) else { return }
        defaults.removeObject(forKey: key)
        // A newly imported document is not necessarily the last one read.
        guard let document = library.documents.filter({
            library.lastOpenedAt(for: $0) != nil
        }).max(by: {
            (library.lastOpenedAt(for: $0) ?? .distantPast)
                < (library.lastOpenedAt(for: $1) ?? .distantPast)
        }) else {
            shortcutMessage = MusicLocalized.message("Todavía no hay un libro abierto anteriormente para continuar.")
            UIAccessibility.post(notification: .announcement, argument: shortcutMessage)
            return
        }
        importError = nil
        library.markOpened(document)
        play(document)
        if importError == nil {
            shortcutMessage = MusicLocalized.format("Continuando %@ desde la posición guardada.", document.title)
            UIAccessibility.post(notification: .announcement, argument: shortcutMessage)
        }
    }

    private func play(_ document: NativeReadingDocument) {
        let latest = library.latest(document)
        let chosenVoiceID = latest.readerPreferences?.voiceID ?? voiceID
        let savedVoiceProfile = NativeReaderVoiceProfileStore.load(for: chosenVoiceID)
        let chosenSpeed = latest.readerPreferences?.speedIndex ?? savedVoiceProfile?.speedIndex
            ?? NativeReaderVoiceProfile.natural.speedIndex
        let speed = NativeReaderSpeedOptions.rate(for: chosenSpeed)
        let chosenPitch = latest.readerPreferences?.pitchIndex ?? savedVoiceProfile?.pitchIndex
            ?? NativeReaderVoiceProfile.natural.pitchIndex
        let pitch = pitches[max(0, min(pitches.count - 1, chosenPitch))]
        if let paths = latest.trackPaths, !paths.isEmpty {
            let urls = paths.compactMap { NativeReaderFormats.storedURL(for: $0) }
            guard !urls.isEmpty, urls.count == paths.count else {
                importError = "Faltan archivos de audio de esta obra."
                return
            }
            let startingTrack = min(max(0, latest.lastTrackIndex ?? 0), urls.count - 1)
            let targetLibrary = library
            do {
                try speech.playPlaylist(urls, speed: speed, track: startingTrack,
                    at: latest.lastPercent ?? 0,
                    onTrackChanged: { [weak targetLibrary] index in
                        targetLibrary?.saveAudioPosition(document, track: index, percent: 0)
                    },
                    onError: { error in importError = "No se pudo reproducir: " + error })
                if let seconds = latest.lastAudioSeconds {
                    speech.seek(toSeconds: seconds)
                }
            } catch { importError = error.localizedDescription }
        } else {
            let offset = max(0, min(latest.body.count,
                latest.lastTextOffset ?? Int(Double(latest.body.count) * Double(latest.lastPercent ?? 0) / 100)))
            speech.play(String(latest.body.dropFirst(offset)), speed: speed, pitch: pitch,
                language: AVSpeechSynthesisVoice(identifier: chosenVoiceID)?.language ?? "es-ES",
                voiceIdentifier: chosenVoiceID,
                baseUTF16: String(latest.body.prefix(offset)).utf16.count,
                totalUTF16: latest.body.utf16.count, baseCharacters: offset)
        }
    }

    private func shareDocumentFromLibrary(_ document: NativeReadingDocument) {
        do {
            if document.fileExtension?.lowercased() == "daisy" {
                // Nunca presentar un TXT extraído como si fuese un paquete DAISY completo.
                NativeShare.present(url: try library.shareableOriginalURL(for: document))
            } else if library.originalURL(for: document) != nil {
                NativeShare.present(url: try library.shareableOriginalURL(for: document))
            } else {
                let result = try library.sharingURLs(for: [document])
                guard let url = result.urls.first else { throw CocoaError(.fileNoSuchFile) }
                NativeShare.present(url: url)
            }
        } catch {
            importError = "No se pudo compartir el documento completo: \(error.localizedDescription)"
        }
    }

    var body: some View {
        List {
            if !importFolderStatus.isEmpty {
                Section {
                    Text(importFolderStatus)
                        .font(.footnote)
                        .accessibilityLabel(importFolderStatus)
                }
            }
            if !importFilesStatus.isEmpty {
                Section {
                    Text(importFilesStatus)
                        .font(.footnote)
                        .accessibilityLabel(importFilesStatus)
                }
            }
            if let shortcutMessage {
                Section {
                    Text(shortcutMessage).font(.footnote)
                }
            }
            if !selectionMode {
                Section {
                    Button("Importar", systemImage: "square.and.arrow.down") {
                        importSourcesPresented = true
                    }
                }
            }
            Section("Mi biblioteca") {
                if shownDocuments.isEmpty { Text("No hay documentos con el filtro actual.") }
                ForEach(shownDocuments) { document in
                    if selectionMode {
                        Button {
                            toggleSelection(document.id)
                        } label: {
                            Label(documentRowLabel(document), systemImage: selectedDocumentIDs.contains(document.id)
                                  ? "checkmark.circle.fill" : "circle")
                        }
                        .accessibilityLabel(MusicLocalized.format("%@, %@",
                            NativeAppLanguage.message(selectedDocumentIDs.contains(document.id) ? "Seleccionado" : "No seleccionado", languageCode: NativeAppLanguage.code(for: languageIndex)),
                            documentRowLabel(document)))
                    } else {
                    NavigationLink {
                        if NativeReaderFormats.isVideo(document) {
                            NativeReaderVideoScreen(document: document)
                                .onAppear { library.markOpened(document) }
                        } else {
                            NativeReadingScreen(document: document, speech: speech)
                                .onAppear { library.markOpened(document) }
                        }
                    } label: { Text(documentRowLabel(document)) }
                    .accessibilityLabel(documentRowLabel(document))
                    .accessibilityActions {
                        Button("Reproducir") { play(document) }
                        Button("Compartir documento") { shareDocumentFromLibrary(document) }
                        if !document.body.isEmpty {
                            Button("Convertir a audio o DAISY") {
                            documentToConvert = document
                            }
                        }
                    }
                    .accessibilityAction(named: Text("Información")) { information = document }
                    .accessibilityAction(named: Text("Ajustes del documento")) {
                        documentToConfigure = document
                    }
                    .accessibilityAction(named: Text("Mover a carpeta")) {
                        folderForDocument = document
                    }
                    .accessibilityAction(named: Text("Añadir a favoritos")) {
                        library.toggleFavorite(document)
                    }
                    .accessibilityAction(named: Text("Cambiar título")) {
                        documentToRename = document
                        proposedTitle = document.title
                    }
                    .accessibilityAction(named: Text("Traducir")) {
                        documentToTranslate = document
                    }
                    .accessibilityAction(named: Text("Eliminar")) {
                        documentToDelete = document
                        confirmDeletion = true
                    }
                    }
                }
                Button(selectionMode ? "Terminar selección" : "Selección") {
                    if selectionMode {
                        finishSelection()
                    } else {
                        selectedDocumentIDs.removeAll()
                        selectionMode = true
                    }
                }
                if selectionMode {
                    Text("\(visibleSelection.count) documentos seleccionados")
                        .accessibilityAddTraits(.updatesFrequently)
                    Button("Seleccionar todos los visibles") {
                        selectedDocumentIDs.formUnion(shownDocuments.map(\.id))
                    }
                    Button("Deseleccionar todos") { selectedDocumentIDs.removeAll() }
                    Button("Compartir seleccionados", systemImage: "square.and.arrow.up") {
                        let documents = shownDocuments.filter { visibleSelection.contains($0.id) }
                        do {
                            let prepared = try library.sharingURLs(for: documents)
                            if prepared.textFallbackCount > 0 {
                                pendingShareURLs = prepared.urls
                                shareFallbackCount = prepared.textFallbackCount
                                showShareFallbackWarning = true
                            } else {
                                NativeShare.present(urls: prepared.urls)
                            }
                        } catch {
                            importError = "No se pudieron preparar todos los documentos: \(error.localizedDescription)"
                        }
                    }
                    .disabled(visibleSelection.isEmpty)
                    Button("Mover seleccionados a carpeta") { showBulkMove = true }
                        .disabled(visibleSelection.isEmpty)
                    Button("Eliminar seleccionados") { showBulkDelete = true }
                        .disabled(visibleSelection.isEmpty)
                    Button("Añadir seleccionados a favoritos") {
                        let count = library.markFavorites(withIDs: visibleSelection, favorite: true)
                        finishSelection("\(count) documentos añadidos a favoritos.")
                    }
                    .disabled(visibleSelection.isEmpty)
                    Button("Quitar seleccionados de favoritos") {
                        let count = library.markFavorites(withIDs: visibleSelection, favorite: false)
                        finishSelection("\(count) documentos retirados de favoritos.")
                    }
                    .disabled(visibleSelection.isEmpty)
                }
            }
            // Durante la selección, solo se ofrecen libros y acciones en lote.
            if !selectionMode {
            Section("Filtrar y ordenar") {
                NativeAdjustableChoice(
                    title: "Información de cada documento con VoiceOver",
                    choices: ["Título y porcentaje", "Título, porcentaje y formato",
                              "Título, porcentaje, formato y carpeta"],
                    selectedIndex: $voiceOverDetailIndex
                )
                NativeAdjustableChoice(
                    title: "Filtrar documentos",
                    choices: ["Todos", "Textos", "PDF", "EPUB", "Office", "Audio y DAISY",
                              "Con marcas", "Favoritos", "Importados hoy",
                              "Últimos siete días", "Último mes"],
                    selectedIndex: $filterIndex
                )
                NativeAdjustableChoice(
                    title: "Ordenar",
                    choices: ["Más recientes", "Más antiguos", "Título A a Z",
                              "Título Z a A", "Formato", "Último abierto"],
                    selectedIndex: $sortIndex
                )
            }
            Section("Carpetas") {
                NativeAdjustableChoice(
                    title: "Vista al entrar en TifloLector",
                    choices: ["Vista general", "Carpetas"],
                    selectedIndex: $folderEntryMode
                )
                Button("Ver por carpetas") { showFolderPicker = true }
                    .accessibilityHint("Abre una pantalla de carpetas; la biblioteca general conserva todos sus documentos.")
            }
            Section("Más opciones") {
                NavigationLink("Ajustes") { NativeReaderSettingsScreen() }
                Button("Exportar copia de seguridad") {
                    do {
                        let url = try library.exportBackup()
                        NativeShare.present(url: url)
                    } catch {
                        importError = "No se pudo crear la copia de seguridad: \(error.localizedDescription)"
                    }
                }
                .accessibilityHint("Incluye documentos, posiciones, marcas, carpetas y archivos guardados.")
                Button("Restaurar copia de seguridad") { restorePresented = true }
                    .accessibilityHint("Importa los libros que faltan sin sustituir los que ya están en la biblioteca.")
            }
            }
        }
        .tifloScreenSurface()
        .navigationTitle("TifloLector")
        .onAppear {
            // A one-shot Resume Last Book shortcut takes precedence over the
            // saved folder landing page, avoiding two simultaneous sheets.
            let resumeShortcut = UserDefaults.standard.bool(
                forKey: "native-ios-resume-last-book-shortcut-v1")
            if folderEntryMode == 1 && !resumeShortcut { showFolderPicker = true }
            resumeRequestedBook()
        }
        .onDisappear { speech.stop() }
        .confirmationDialog("Importar", isPresented: $importSourcesPresented,
                            titleVisibility: .visible) {
            Button("Desde Archivos") { importPresented = true }
            Button("Carpeta completa desde Archivos") { importFolderPresented = true }
            Button("Bibliotecas en línea") { externalCatalogPresented = true }
            Button("Cancelar", role: .cancel) {}
        }
        .sheet(isPresented: $showFolderPicker) {
            NavigationStack {
                List {
                    Section {
                        Button("Crear carpeta") {
                            showFolderPicker = false
                            newFolderName = ""
                            showCreateFolder = true
                        }
                    }
                    Section("Mis carpetas") {
                        NavigationLink("Sin carpeta") {
                            folderDocumentsView(nil)
                        }
                        ForEach(library.folders, id: \.self) { folder in
                            NavigationLink {
                                folderDocumentsView(folder)
                            } label: {
                                Text("\(folder), \(library.documents.filter { $0.folderName == folder }.count) documentos")
                            }
                            .accessibilityAction(named: Text("Eliminar carpeta")) {
                                showFolderPicker = false
                                folderToDelete = folder
                            }
                        }
                    }
                }
                .navigationTitle("Carpetas")
                .toolbar {
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Cerrar") { showFolderPicker = false }
                    }
                }
            }
        }
        .sheet(item: $documentToConvert) { doc in
            NavigationStack {
                NativeReadingScreen(document: doc, speech: speech, startWithConversion: true)
                    .environmentObject(library)
            }
        }
        .sheet(isPresented: $externalCatalogPresented) {
            NavigationStack {
                NativeReaderCatalogsScreen()
                    .environmentObject(library)
                    .toolbar { Button("Cerrar") { externalCatalogPresented = false } }
            }
        }
        .fileImporter(
            isPresented: $importPresented,
            allowedContentTypes: [.item],
            allowsMultipleSelection: true
        ) { result in
            switch result {
            case .success(let urls):
                guard !urls.isEmpty, !importingFiles else { return }
                importingFiles = true
                importFilesStatus = MusicLocalized.message("Preparando importación de archivos.")
                UIAccessibility.post(notification: .announcement, argument: importFilesStatus)
                Task { @MainActor in
                    defer { importingFiles = false }
                    do {
                        // Announce progress sparingly in large batches. Status text
                        // always reflects the current item for VoiceOver review.
                        var lastAnnouncement = Date()
                        let summary = try await library.importSelectedFiles(from: urls) { message in
                            importFilesStatus = message
                            if Date().timeIntervalSince(lastAnnouncement) >= 5 {
                                UIAccessibility.post(notification: .announcement, argument: message)
                                lastAnnouncement = Date()
                            }
                        }
                        importFilesStatus = MusicLocalized.format(
                            "Importación terminada. Documentos importados: %d. Omitidos: %d. Fallidos: %d.",
                            summary.imported, summary.skipped, summary.failed.count)
                        if !summary.failed.isEmpty {
                            importError = summary.failed.prefix(6).joined(separator: "\n")
                        }
                        if !summary.failed.isEmpty {
                            NativeReaderFeedback.confirm(.error)
                        } else if summary.imported > 0 {
                            NativeReaderFeedback.confirm(.imported)
                        }
                    } catch {
                        importError = MusicLocalized.format(
                            "No se pudieron importar los archivos: %@", error.localizedDescription)
                        importFilesStatus = MusicLocalized.message("Importación de archivos interrumpida.")
                        NativeReaderFeedback.confirm(.error)
                    }
                    UIAccessibility.post(notification: .announcement, argument: importFilesStatus)
                }
            case .failure(let error):
                importError = error.localizedDescription
            }
        }
        .fileImporter(
            isPresented: $importFolderPresented,
            allowedContentTypes: [.folder],
            allowsMultipleSelection: false
        ) { result in
            switch result {
            case .success(let urls):
                guard let folder = urls.first, !importingFolder else { return }
                importingFolder = true
                importFolderStatus = MusicLocalized.message("Preparando importación de carpeta.")
                Task { @MainActor in
                    defer { importingFolder = false }
                    do {
                        // Announce large-folder progress at most every five
                        // seconds; VoiceOver can inspect the live status
                        // without an announcement on each imported file.
                        var lastAnnouncement = Date()
                        let summary = try await library.importFolder(from: folder) { message in
                            importFolderStatus = message
                            if Date().timeIntervalSince(lastAnnouncement) >= 5 {
                                UIAccessibility.post(notification: .announcement, argument: message)
                                lastAnnouncement = Date()
                            }
                        }
                        importFolderStatus = MusicLocalized.format("Importación terminada. Documentos importados: %d. Omitidos: %d. Fallidos: %d.", summary.imported, summary.skipped, summary.failed.count)
                        if !summary.failed.isEmpty {
                            importError = summary.failed.prefix(6).joined(separator: "\n")
                        }
                        if !summary.failed.isEmpty {
                            NativeReaderFeedback.confirm(.error)
                        } else if summary.imported > 0 {
                            NativeReaderFeedback.confirm(.imported)
                        }
                    } catch {
                        importError = MusicLocalized.format("No se pudo importar la carpeta: %@", error.localizedDescription)
                        importFolderStatus = MusicLocalized.message("Importación de carpeta interrumpida.")
                        NativeReaderFeedback.confirm(.error)
                    }
                    UIAccessibility.post(notification: .announcement, argument: importFolderStatus)
                }
            case .failure(let error):
                importError = error.localizedDescription
            }
        }
        .fileImporter(isPresented: $restorePresented, allowedContentTypes: [.zip],
                      allowsMultipleSelection: false) { result in
            switch result {
            case .success(let urls):
                guard let url = urls.first else { return }
                do {
                    let restored = try library.restoreBackup(from: url)
                    restoreResult = "Se han recuperado \(restored) documentos nuevos. Los libros existentes no se han modificado."
                } catch {
                    importError = "No se pudo restaurar la copia: \(error.localizedDescription)"
                }
            case .failure(let error): importError = error.localizedDescription
            }
        }
        .alert("Restauración de biblioteca", isPresented: Binding(
            get: { restoreResult != nil },
            set: { if !$0 { restoreResult = nil } }
        )) { Button("Aceptar") { restoreResult = nil } } message: {
            Text(restoreResult ?? "")
        }
        .alert("Crear carpeta", isPresented: $showCreateFolder) {
            TextField("Nombre de la carpeta", text: $newFolderName)
            Button("Crear") {
                if !library.createFolder(named: newFolderName) {
                    importError = "El nombre de la carpeta está vacío, repetido o es demasiado largo."
                }
            }
            Button("Cancelar", role: .cancel) {}
        } message: {
            Text("Crea una carpeta para organizar las obras sin mover ni borrar archivos del sistema.")
        }
        .confirmationDialog("Mover documentos seleccionados",
                            isPresented: $showBulkMove, titleVisibility: .visible) {
            Button("Crear carpeta nueva") {
                newFolderName = ""
                showCreateFolderForSelection = true
            }
            Button("Sin carpeta") {
                let count = library.moveDocuments(withIDs: visibleSelection, to: nil)
                finishSelection("\(count) documentos movidos fuera de las carpetas.")
            }
            ForEach(library.folders, id: \.self) { folder in
                Button(folder) {
                    let count = library.moveDocuments(withIDs: visibleSelection, to: folder)
                    finishSelection("\(count) documentos movidos a \(folder).")
                }
            }
            Button("Cancelar", role: .cancel) {}
        }
        .alert("Crear carpeta para los documentos seleccionados",
               isPresented: $showCreateFolderForSelection) {
            TextField("Nombre de la carpeta nueva", text: $newFolderName)
            Button("Crear carpeta y mover") {
                let name = newFolderName.trimmingCharacters(in: .whitespacesAndNewlines)
                let documentIDs = visibleSelection
                guard !documentIDs.isEmpty else {
                    selectionFeedback = "No hay documentos seleccionados para mover."
                    return
                }
                guard library.createFolder(named: name) else {
                    selectionFeedback = "No se pudo crear la carpeta. Comprueba que el nombre no esté vacío, repetido o sea demasiado largo."
                    return
                }
                let count = library.moveDocuments(withIDs: documentIDs, to: name)
                finishSelection("\(count) documentos movidos a la nueva carpeta \(name).")
            }
            Button("Cancelar", role: .cancel) {}
        } message: {
            Text("Indica el nombre de una carpeta nueva. Los documentos seleccionados se moverán a ella cuando confirmes.")
        }
        .alert("Selección de documentos", isPresented: Binding(
            get: { selectionFeedback != nil },
            set: { if !$0 { selectionFeedback = nil } }
        )) { Button("Aceptar") { selectionFeedback = nil } } message: {
            Text(selectionFeedback ?? "")
        }
        .alert("Compartir documentos", isPresented: $showShareFallbackWarning) {
            Button("Compartir") {
                let urls = pendingShareURLs
                pendingShareURLs = []
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) {
                    NativeShare.present(urls: urls)
                }
            }
            Button("Cancelar", role: .cancel) { pendingShareURLs = [] }
        } message: {
            Text("\(shareFallbackCount) documentos antiguos no conservan su archivo original y se compartirán como texto TXT. Los demás se compartirán en su formato original.")
        }
        .confirmationDialog("Mover a carpeta",
                            isPresented: Binding(
                                get: { folderForDocument != nil },
                                set: { if !$0 { folderForDocument = nil } }),
                            titleVisibility: .visible) {
            Button("Sin carpeta") {
                if let doc = folderForDocument { library.move(doc, to: nil) }
                folderForDocument = nil
            }
            ForEach(library.folders, id: \.self) { folder in
                Button(folder) {
                    if let doc = folderForDocument { library.move(doc, to: folder) }
                    folderForDocument = nil
                }
            }
            Button("Cancelar", role: .cancel) { folderForDocument = nil }
        }
        .confirmationDialog(
            MusicLocalized.format("¿Eliminar la carpeta «%@»?", folderToDelete ?? ""),
            isPresented: Binding(
                get: { folderToDelete != nil },
                set: { if !$0 { folderToDelete = nil } }),
            titleVisibility: .visible) {
            Button("Eliminar carpeta", role: .destructive) {
                if let folder = folderToDelete {
                    library.deleteFolder(folder)
                    if selectedFolder == folder { selectedFolder = "" }
                }
                folderToDelete = nil
            }
            Button("Cancelar", role: .cancel) { folderToDelete = nil }
        } message: {
            Text("Las obras de esta carpeta se conservarán en la biblioteca.")
        }
        .sheet(item: $documentToConfigure) { doc in
            NativeReaderDocumentSettingsScreen(document: doc)
        }
        .sheet(item: $documentToTranslate) { doc in
            if #available(iOS 18.0, *) {
                NavigationStack {
                    NativeReaderDocumentTranslationScreen(document: doc) { text, title in
                        try library.importSharedText(text, title: title)
                    }
                }
            } else {
                Text("La traducción de documentos requiere iOS 18 o posterior.")
            }
        }
        .alert("Cambiar título", isPresented: Binding(
            get: { documentToRename != nil },
            set: { if !$0 { documentToRename = nil } }
        )) {
            TextField("Título", text: $proposedTitle)
            Button("Guardar") {
                if let doc = documentToRename { library.rename(doc, to: proposedTitle) }
                documentToRename = nil
            }
            Button("Cancelar", role: .cancel) { documentToRename = nil }
        } message: {
            Text("Escribe el nuevo título del documento.")
        }
        .confirmationDialog("Eliminar documentos seleccionados", isPresented: $showBulkDelete,
                            titleVisibility: .visible) {
            Button("Eliminar definitivamente \(visibleSelection.count) documentos", role: .destructive) {
                let ids = visibleSelection
                for doc in library.documents where ids.contains(doc.id) {
                    library.delete(doc)
                }
                finishSelection("\(ids.count) documentos eliminados.")
            }
            Button("Cancelar", role: .cancel) { showBulkDelete = false }
        } message: {
            let titles = library.documents.filter { visibleSelection.contains($0.id) }.map(\.title)
            Text("Vas a eliminar definitivamente estos \(titles.count) documentos: \(titles.joined(separator: ", ")). Esta operación no se puede deshacer.")
        }
        .confirmationDialog("Eliminar documento", isPresented: $confirmDeletion,
                            titleVisibility: .visible) {
            Button("Eliminar definitivamente \(documentToDelete?.title ?? "el documento")", role: .destructive) {
                if let doc = documentToDelete { library.delete(doc) }
                documentToDelete = nil
            }
            Button("Cancelar", role: .cancel) { documentToDelete = nil }
        } message: {
            if let doc = documentToDelete {
                Text("Vas a eliminar «\(doc.title)». Esta operación no se puede deshacer.")
            }
        }
        .alert("No se pudo realizar la operación", isPresented: Binding(
            get: { importError != nil },
            set: { if !$0 { importError = nil } }
        )) {
            Button("Aceptar", role: .cancel) { importError = nil }
        } message: {
            Text(importError ?? "")
        }
        .sheet(item: $information) { document in
            NavigationStack {
                Form {
                    LabeledContent("Título", value: document.title)
                    LabeledContent("Formato", value: document.formatLabel)
                    LabeledContent("Importado", value:
                        document.importedAt.formatted(date: .abbreviated, time: .shortened))
                    LabeledContent("Marcas", value: "\(library.latest(document).bookmarks.count)")
                    LabeledContent("Carpeta", value: library.latest(document).folderName ?? "Sin carpeta")
                    LabeledContent("Leído", value: "\(library.latest(document).lastPercent ?? 0) por ciento")
                    LabeledContent("Pendiente", value: "\(100 - (library.latest(document).lastPercent ?? 0)) por ciento")
                }
                .tifloScreenSurface()
                .navigationTitle("Información")
                .toolbar { Button("Cerrar") { information = nil } }
            }
        }
    }
}

/// Split long documents once at import-display time. Avoid putting a complete
/// EPUB/Office/PDF body into a single enormous SwiftUI Text accessibility node.
/// Heading markers are structural metadata. Replace them with equally long
/// spaces in reading surfaces so VoiceOver never speaks "#" and all original
/// character offsets (bookmarks, links, text selection) remain unchanged.
enum NativeReaderHeadingDisplay {
    static func mask(in source: String) -> String {
        guard let regex = try? NSRegularExpression(
            pattern: #"(?m)^[ \t]{0,3}#{1,6}(?=[ \t])"#) else { return source }
        var result = source
        let range = NSRange(source.startIndex..<source.endIndex, in: source)
        for match in regex.matches(in: source, range: range).reversed() {
            guard let part = Range(match.range, in: result) else { continue }
            result.replaceSubrange(part, with: String(repeating: " ", count: match.range.length))
        }
        return result
    }

    static func title(_ source: String, limit: Int = 160) -> String {
        let normalized = mask(in: source)
            .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        return String(normalized.prefix(limit))
    }
}

private struct NativeReaderNavigationPoint: Identifiable {
    let offset: Int
    let title: String
    var id: Int { offset }
}

private struct NativeReaderTextLayout {
    private let fullText: String
    let fragments: [String]
    let fragmentStarts: [Int]
    let paragraphStarts: [Int]
    let sentenceStarts: [Int]
    let pageStarts: [Int]
    let headingStarts: [Int]
    let chapterStarts: [Int]
    let linkStarts: [Int]
    let namedHeadings: [NativeReaderNavigationPoint]
    let namedPages: [NativeReaderNavigationPoint]
    let hasRealPages: Bool
    let totalCharacters: Int

    init(_ body: String) {
        fullText = body
        totalCharacters = body.count
        var sections: [String] = []
        var offsets: [Int] = []
        var paragraphs: [Int] = [0]
        var characterOffset = 0

        for paragraph in body.components(separatedBy: "\n\n") {
            if !paragraph.isEmpty {
                var cursor = paragraph.startIndex
                var localOffset = 0
                while cursor < paragraph.endIndex {
                    let end = paragraph.index(cursor, offsetBy: 1800,
                                              limitedBy: paragraph.endIndex) ?? paragraph.endIndex
                    sections.append(String(paragraph[cursor..<end]))
                    offsets.append(characterOffset + localOffset)
                    localOffset += paragraph.distance(from: cursor, to: end)
                    cursor = end
                }
            }
            characterOffset += paragraph.count + 2
            paragraphs.append(min(totalCharacters, characterOffset))
        }
        fragments = sections
        fragmentStarts = offsets
        paragraphStarts = Array(Set(paragraphs + [totalCharacters])).sorted()

        var sentences: [Int] = [0]
        for (index, character) in body.enumerated() where
            character == "." || character == "!" || character == "?" || character == "\n" {
            sentences.append(index + 1)
        }
        sentences.append(totalCharacters)
        sentenceStarts = Array(Set(sentences)).sorted()

        var pages: [Int] = [0]
        var headings: [Int] = []
        var chapters: [Int] = []
        var pageEntries: [NativeReaderNavigationPoint] = []
        var headingEntries: [NativeReaderNavigationPoint] = []
        var lineOffset = 0
        for line in body.components(separatedBy: "\n") {
            let normalized = line.trimmingCharacters(in: .whitespaces).lowercased()
            if normalized.range(of: #"^(página|pagina|diapositiva|hoja)\s+[0-9]+"#,
                                options: .regularExpression) != nil {
                pages.append(lineOffset)
                pageEntries.append(.init(offset: lineOffset, title: line.trimmingCharacters(in: .whitespaces)))
            } else if normalized.range(
                of: #"^(#{1,6}\s+|capítulo\s+|capitulo\s+|sección\s+|seccion\s+)"#,
                options: .regularExpression) != nil {
                headings.append(lineOffset)
                headingEntries.append(.init(offset: lineOffset,
                    title: NativeReaderHeadingDisplay.title(line)))
                if normalized.range(of: #"^(capítulo\s+|capitulo\s+|#{1,2}\s+)"#,
                                    options: .regularExpression) != nil {
                    chapters.append(lineOffset)
                }
            }
            lineOffset += line.count + 1
        }
        // Sin marcas de página explícitas, los fragmentos hacen de páginas virtuales.
        pageStarts = Array(Set((pages.count > 1 ? pages : offsets) + [0, totalCharacters])).sorted()
        headingStarts = Array(Set(headings)).sorted()
        chapterStarts = Array(Set(chapters)).sorted()
        // Detect only URLs that remain visible in the extracted text. These
        // offsets share the same Character coordinate system as readingOffset.
        let urlPattern = #"https?://[^\s<>\\"']+"#
        let urlRegex = try? NSRegularExpression(pattern: urlPattern, options: [.caseInsensitive])
        let fullRange = NSRange(body.startIndex..<body.endIndex, in: body)
        linkStarts = (urlRegex?.matches(in: body, range: fullRange) ?? []).compactMap { match in
            guard let range = Range(match.range, in: body) else { return nil }
            return body.distance(from: body.startIndex, to: range.lowerBound)
        }
        namedHeadings = headingEntries
        hasRealPages = !pageEntries.isEmpty
        namedPages = pageEntries.isEmpty
            ? offsets.enumerated().map { .init(offset: $0.element, title: "Bloque \($0.offset + 1)") }
            : pageEntries
    }

    func visibleURL(at offset: Int) -> URL? {
        guard linkStarts.contains(offset), offset >= 0, offset < fullText.count else { return nil }
        let beginning = fullText.index(fullText.startIndex, offsetBy: offset)
        let remainder = String(fullText[beginning...])
        guard let regex = try? NSRegularExpression(pattern: #"^https?://[^\s<>\"']+"#, options: [.caseInsensitive]),
              let match = regex.firstMatch(in: remainder, range: NSRange(remainder.startIndex..<remainder.endIndex, in: remainder)),
              let range = Range(match.range, in: remainder) else { return nil }
        let candidate = String(remainder[range]).trimmingCharacters(in: CharacterSet(charactersIn: ".,;:!?)]"))
        guard let url = URL(string: candidate),
              ["https", "http"].contains(url.scheme?.lowercased() ?? ""),
              url.host != nil else { return nil }
        return url
    }

    func nearbyOffset(_ offset: Int, direction: Int, unit: Int) -> Int? {
        let boundaries: [Int]
        switch unit {
        case 8: boundaries = linkStarts
        case 7: boundaries = chapterStarts
        case 4: boundaries = headingStarts
        case 3: boundaries = pageStarts
        case 2: boundaries = sentenceStarts
        case 1: boundaries = paragraphStarts
        default: boundaries = fragmentStarts + [totalCharacters]
        }
        return direction > 0
            ? boundaries.first(where: { $0 > offset && $0 < totalCharacters })
            : boundaries.last(where: { $0 < offset && $0 < totalCharacters })
    }

    func fragmentIndex(for offset: Int) -> Int {
        guard !fragmentStarts.isEmpty else { return 0 }
        var low = 0
        var high = fragmentStarts.count
        while low < high {
            let middle = (low + high) / 2
            if fragmentStarts[middle] <= offset { low = middle + 1 }
            else { high = middle }
        }
        return max(0, low - 1)
    }
}

// Reproductor local de vídeo con controles y decodificación exclusivos de Apple.
// Se mantiene separado del TTS y del motor de audiolibros para no alterar DAISY.
struct NativeReaderVideoScreen: View {
    let document: NativeReadingDocument
    @EnvironmentObject private var library: NativeReaderLibrary
    @State private var player: AVPlayer?
    @State private var isPlaying = false
    @State private var error: String?
    @State private var lastSavedSecond = -1

    var body: some View {
        VStack(spacing: 18) {
            if let player {
                VideoPlayer(player: player)
                    .frame(minHeight: 240)
                    .accessibilityLabel(document.title)
                HStack {
                    Button(isPlaying ? "Pausar" : "Reproducir") { togglePlayback() }
                    Button("Retroceder diez segundos") { skip(seconds: -10) }
                    Button("Avanzar diez segundos") { skip(seconds: 10) }
                }
                .buttonStyle(.bordered)
                if let error { Text(error).foregroundStyle(.secondary) }
            } else {
                Text(error ?? "Vídeo no disponible.")
            }
        }
        .padding()
        .navigationTitle(document.title)
        .onAppear { prepareVideo() }
        .onDisappear {
            savePosition()
            player?.pause()
            player = nil
        }
        .onReceive(Timer.publish(every: 1, on: .main, in: .common).autoconnect()) { _ in
            guard let player else { return }
            isPlaying = player.rate > 0
            if player.currentItem?.status == .failed {
                error = "No se pudo reproducir el vídeo con el reproductor de Apple."
                isPlaying = false
            }
            let current = player.currentTime().seconds
            if current.isFinite && Int(current) >= lastSavedSecond + 5 {
                savePosition()
            }
        }
        // AVKit mantiene sus propios controles accesibles de reproducción.
    }

    private func prepareVideo() {
        guard player == nil else { return }
        guard let path = document.trackPaths?.first,
              let url = NativeReaderFormats.storedURL(for: path) else {
            error = "Vídeo no disponible."
            return
        }
        let instance = AVPlayer(url: url)
        player = instance
        if let seconds = document.lastAudioSeconds, seconds.isFinite, seconds > 0 {
            instance.seek(to: CMTime(seconds: seconds, preferredTimescale: 600))
        }
    }

    private func togglePlayback() {
        guard let player else { return }
        if player.rate > 0 {
            player.pause()
            savePosition()
            isPlaying = false
        } else {
            player.play()
            isPlaying = true
        }
    }

    private func skip(seconds: Double) {
        guard let player else { return }
        let current = player.currentTime().seconds
        guard current.isFinite else { return }
        let duration = player.currentItem?.duration.seconds ?? 0
        let target = max(0, duration.isFinite && duration > 0
            ? min(duration, current + seconds) : current + seconds)
        player.seek(to: CMTime(seconds: target, preferredTimescale: 600))
    }

    private func savePosition() {
        guard let player else { return }
        let seconds = player.currentTime().seconds
        guard seconds.isFinite, seconds >= 0 else { return }
        let duration = player.currentItem?.duration.seconds ?? 0
        let percent = duration.isFinite && duration > 0
            ? Int(max(0, min(100, seconds / duration * 100))) : 0
        library.saveAudioPosition(document, track: 0, percent: percent, seconds: seconds)
        lastSavedSecond = Int(seconds)
    }
}

struct NativeReadingScreen: View {
    let document: NativeReadingDocument
    @ObservedObject var speech: NativeReadingSpeech
    @AppStorage("native-ios-language") private var languageIndex = 0
    var startPercent: Int? = nil
    var startTrack: Int? = nil
    var startWithConversion = false

    @EnvironmentObject private var library: NativeReaderLibrary
    @Environment(\.dismiss) private var dismiss
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @Environment(\.scenePhase) private var scenePhase
    @AppStorage("native-reading-text-size") private var textSize = 20.0
    @AppStorage("native-reading-speed-index") private var speedIndex = 2
    @AppStorage("native-reading-pitch-index") private var pitchIndex = 2
    @AppStorage("native-reading-voice-id") private var voiceID = ""
    @AppStorage("native-reading-line-spacing-index") private var lineSpacingIndex = 0
    @AppStorage("native-reading-strong-text") private var strongText = false
    @AppStorage("native-reader-navigation-unit") private var navigationUnit = 0
    @AppStorage("native-reader-reading-mode") private var readingMode = 0
    @AppStorage("native-reader-presentation-mode") private var presentationMode = 0
    @AppStorage("native-reader-braille-initial-text-focus") private var brailleFocusText = true
    @AppStorage("native-reader-reading-engine") private var readingEngine = 0
    @AppStorage("native-reader-gemini-voice") private var geminiVoice = "Kore"
    @AppStorage("native-reader-gemini-validated") private var geminiValidated = false
    @AppStorage("native-reader-phonon-voice") private var phononVoice = ""
    @State private var didApplyOpeningMode = false
    @State private var sleepIndex = 0 // Each open document starts with timer disabled.
    @State private var sleepDeadline: Date?
    @State private var currentPercent = 0
    @State private var readingOffset = 0
    @State private var lastSavedPercent = -1
    @State private var delayedManualPositionSave: Task<Void, Never>?
    @State private var interruptedWhilePlaying = false
    @State private var trackIndex = 0
    @State private var didRestoreAudioPosition = false
    @State private var elapsedSpeakingSeconds = 0
    @State private var playbackTick = 0
    @State private var showTranslation = false
    @State private var showStructure = false
    @State private var showWordTools = false
    @State private var showTextSelection = false
    @State private var selectedTextToCopy = ""
    @State private var selectionCopyMessage = ""
    @State private var showAudioSettings = false
    @State private var showVisualSettings = false
    @State private var showAudioExport = false
    @State private var audioExportBusy = false
    @State private var audioExportProgress = ""
    @State private var audioExportTask: Task<Void, Never>?
    @State private var showExportCompleted = false
    @State private var savedExportURL: URL?
    @State private var audioExportFormat: NativeGeminiAudioExport.Format = .mp3
    @State private var audioExportLanguage = "es"
    @State private var audioExportEngine: NativeGeminiAudioExport.Engine = .system
    private var availableExportEngines: [(engine: NativeGeminiAudioExport.Engine, title: String)] {
        var engines: [(engine: NativeGeminiAudioExport.Engine, title: String)] = [(.system, "Voces del sistema")]
        if geminiValidated && NativeVoiceCredentialStore.hasKey("gemini") {
            engines.append((.gemini, "Gemini"))
        }
        if NativePhononRuntime.isUsable { engines.append((.phonon, "Phonon")) }
        return engines
    }
    @State private var audioExportSystemVoice = ""
    @State private var audioExportGeminiVoice = "Kore"
    @State private var audioExportPhononVoice = ""
    @State private var showDocumentActions = false
    @State private var showDocumentInformation = false
    @State private var showSavedMarks = false
    @State private var showDocumentSearch = false
    @State private var documentSearchText = ""
    @State private var positionBeforeSearch: Int?
    @State private var programmaticFocusRequest = false
    @State private var readerIsVisible = false
    @State private var actionMessage: String?
    @State private var navigationFeedback = ""
    @State private var navigationScrollTarget: Int?
    // DAISY navigation sets a target without starting the reader's audio.
    @State private var pendingDaisyAudioSeconds: TimeInterval?
    @AccessibilityFocusState private var focusedFragment: Int?
    @AccessibilityFocusState private var playbackButtonFocused: Bool
    @AccessibilityFocusState private var continuousBrailleFocused: Bool
    @State private var lastReaderFragment: Int?
    @State private var remoteCommandTokens: [Any] = []

    private let textLayout: NativeReaderTextLayout
    private let wordCount: Int
    private static let percentages = (0...100).map { "\($0) por ciento" }
    private let timeStep = 60
    private static let sleepChoices = [
        "Desactivado", "5 minutos", "10 minutos", "15 minutos",
        "30 minutos", "45 minutos", "60 minutos"
    ]
     private let sleepMinutes: [Int] = [0, 5, 10, 15, 30, 45, 60]

    init(document: NativeReadingDocument, speech: NativeReadingSpeech,
         startPercent: Int? = nil, startTrack: Int? = nil,
         startWithConversion: Bool = false) {
        self.document = document
        self.speech = speech
        self.startPercent = startPercent
        self.startTrack = startTrack
        self.startWithConversion = startWithConversion
        self.textLayout = NativeReaderTextLayout(document.body)
        self.wordCount = document.body.split(whereSeparator: \.isWhitespace).count
    }

    private var latest: NativeReadingDocument { library.latest(document) }
    private var tracks: [String] { latest.trackPaths ?? [] }
    private var effectiveSpeedIndex: Int {
        latest.readerPreferences?.speedIndex
            ?? NativeReaderVoiceProfileStore.load(for: effectiveVoiceID)?.speedIndex
            ?? NativeReaderVoiceProfile.natural.speedIndex
    }
    private var effectivePitchIndex: Int {
        latest.readerPreferences?.pitchIndex
            ?? NativeReaderVoiceProfileStore.load(for: effectiveVoiceID)?.pitchIndex
            ?? NativeReaderVoiceProfile.natural.pitchIndex
    }
    private var pitch: Float { [0.8, 0.9, 1.0, 1.1, 1.2][max(0, min(4, effectivePitchIndex))] }
    private var effectiveVoiceID: String { latest.readerPreferences?.voiceID ?? voiceID }
    private var effectiveTextSize: Double { latest.readerPreferences?.textSize ?? textSize }
    private var effectiveLineSpacing: Int { latest.readerPreferences?.lineSpacingIndex ?? lineSpacingIndex }
    private var effectiveStrongText: Bool { latest.readerPreferences?.strongText ?? strongText }
    private var speed: Double { NativeReaderSpeedOptions.rate(for: effectiveSpeedIndex) }
    private var effectiveReadingEngine: Int {
        let selected = latest.readerPreferences?.readingEngineIndex ?? readingEngine
        if selected == 1 && !(geminiValidated && NativeVoiceCredentialStore.hasKey("gemini")) { return 0 }
        if selected == 2 && !NativePhononRuntime.isUsable { return 0 }
        return selected
    }
    private var effectiveGeminiVoice: String { latest.readerPreferences?.geminiVoiceID ?? geminiVoice }
    private var effectivePhononVoice: String { latest.readerPreferences?.phononVoiceID ?? phononVoice }
    private var isAudioOnly: Bool { latest.body.isEmpty && !tracks.isEmpty }
    private var daisyChapterPoints: [NativeDaisyNavigationPoint] {
        let headings = (latest.daisyNavigation ?? []).filter {
            $0.kind != "Página" && $0.kind != "Referencia"
        }
        guard let shallowest = headings.map(\.level).min() else { return [] }
        let top = headings.filter { $0.level == shallowest }
        if top.count > 1 { return top }
        // A unique top-level entry is normally the book title.
        // Only its immediate children can count as navigable chapters.
        if shallowest == 1 {
            let chapters = headings.filter { $0.level == 2 }
            if chapters.count > 1 { return chapters }
        }
        return []
    }

    private var navigationOptions: [(unit: Int, label: String)] {
        var options: [(unit: Int, label: String)] = []
        let daisySections = (latest.daisyNavigation ?? []).filter {
            $0.kind != "Página" && $0.kind != "Referencia"
        }
        if !latest.body.isEmpty {
            options.append((0, "Bloque"))
            // Do not offer empty navigation modes. A virtual page made from a
            // fragment is a block, not a numbered page in the source document.
            if textLayout.paragraphStarts.count > 2 { options.append((1, "Párrafo")) }
            if textLayout.sentenceStarts.count > 2 { options.append((2, "Frase")) }
            if textLayout.hasRealPages && textLayout.namedPages.count > 1 {
                options.append((3, "Página"))
            }
            if textLayout.headingStarts.count > 1 { options.append((4, "Encabezado")) }
        }
        if !tracks.isEmpty {
            if daisySections.count > 1 && !options.contains(where: { $0.unit == 4 }) {
                options.append((4, "Encabezado"))
            }
            if (latest.daisyNavigation ?? []).contains(where: { $0.kind == "Página" }) {
                options.append((9, "Página DAISY"))
            }
            if (latest.daisyNavigation ?? []).contains(where: { $0.kind == "Referencia" }) {
                options.append((10, "Referencia DAISY"))
            }
        }
        if !tracks.isEmpty || !latest.body.isEmpty { options.append((5, "Un minuto")) }
        if latest.hasBookmarks { options.append((6, "Marcas")) }
        if !textLayout.linkStarts.isEmpty || !(latest.textLinks ?? []).isEmpty {
            options.append((8, "Enlaces"))
        }
        if textLayout.chapterStarts.count > 1 || daisyChapterPoints.count > 1 {
            options.append((7, "Capítulo"))
        }
        return options
    }

    private var effectiveNavigationUnit: Int {
        navigationOptions.contains(where: { $0.unit == navigationUnit })
            ? navigationUnit : (navigationOptions.first?.unit ?? 0)
    }

    private var navigationSelection: Binding<Int> {
        Binding(
            get: { navigationOptions.firstIndex(where: { $0.unit == effectiveNavigationUnit }) ?? 0 },
            set: { index in
                guard navigationOptions.indices.contains(index) else { return }
                navigationUnit = navigationOptions[index].unit
                navigationFeedback = MusicLocalized.format("Modo de navegación: %@",
                    MusicLocalized.message(navigationOptions[index].label))
                actionMessage = nil
            }
        )
    }

    private var navigationAccessibilityValue: String {
        if !navigationFeedback.isEmpty { return navigationFeedback }
        let title = navigationOptions.first(where: { $0.unit == effectiveNavigationUnit })?.label
            ?? "No disponible"
        return MusicLocalized.format("Modo de navegación: %@", MusicLocalized.message(title))
    }

    private func textNavigationFeedback(at offset: Int, unit: Int) -> String {
        let unitName = navigationOptions.first(where: { $0.unit == unit })?.label
            ?? "Bloque"
        let localizedUnit = MusicLocalized.message(unitName)
        // Real page titles already identify their unit; don't double announce it.
        if unit == 3, let page = textLayout.namedPages.first(where: { $0.offset == offset }) {
            let title = NativeReaderHeadingDisplay.title(page.title, limit: 90)
            if !title.isEmpty { return title }
        }
        // Prefer actual structure over the first 120 arbitrary characters.
        if (unit == 4 || unit == 7),
           let heading = textLayout.namedHeadings.first(where: { $0.offset == offset }) {
            let title = NativeReaderHeadingDisplay.title(heading.title, limit: 90)
            if !title.isEmpty {
                return title.lowercased().hasPrefix(localizedUnit.lowercased())
                    ? title : MusicLocalized.format("%@: %@", localizedUnit, title)
            }
        }
        // Sentence and paragraph gestures may not read into the NEXT unit.
        let end = textLayout.nearbyOffset(offset, direction: 1, unit: unit)
            ?? textLayout.totalCharacters
        let length = max(0, min(120, end - offset))
        let sample = String(latest.body.dropFirst(offset).prefix(length))
        let excerpt = NativeReaderHeadingDisplay.title(sample, limit: 90)
        return excerpt.isEmpty ? localizedUnit
            : MusicLocalized.format("%@: %@", localizedUnit, excerpt)
    }

    private func navigateText(to offset: Int, unit: Int) {
        // Gestures update the announced unit, never the reading percentage.
        // Moving through structure does not initiate playback or steal focus.
        if speech.isPlaying || speech.isPaused { stopPlayback() }
        jump(to: offset, focusReader: false)
        navigationScrollTarget = textLayout.fragmentIndex(for: readingOffset)
        navigationFeedback = textNavigationFeedback(at: readingOffset, unit: unit)
        actionMessage = nil
    }

    private var excerpt: String {
        guard !textLayout.fragments.isEmpty else { return "" }
        return textLayout.fragments[textLayout.fragmentIndex(for: readingOffset)]
    }

    private func persistPosition() {
        if tracks.isEmpty {
            library.saveTextPosition(document, offset: readingOffset)
        } else {
            library.saveAudioPosition(document, track: trackIndex, percent: currentPercent,
                                      seconds: speech.hasAudio ? speech.audioElapsed
                                          : (pendingDaisyAudioSeconds ?? latest.lastAudioSeconds))
        }
        lastSavedPercent = currentPercent
    }

    /// VoiceOver can traverse dozens of text fragments in a few seconds.
    /// Persist the final cursor, not the entire JSON library on every swipe.
    /// App backgrounding and reader exit flush this pending position.
    private func scheduleManualPositionSave() {
        delayedManualPositionSave?.cancel()
        delayedManualPositionSave = Task { @MainActor in
            do { try await Task.sleep(for: .milliseconds(650)) }
            catch { return }
            guard !Task.isCancelled, readerIsVisible, !speech.isPlaying else { return }
            persistPosition()
        }
    }

    private func move(to percent: Int) {
        let value = max(0, min(100, percent))
        currentPercent = value
        readingOffset = Int(Double(textLayout.totalCharacters) * Double(value) / 100)
        if speech.hasAudio && !speech.isGeneratedSpeech {
            speech.seek(to: value)
        } else if speech.isPlaying || speech.isPaused {
            let wasPaused = speech.isPaused
            if value == 100 { speech.stop() }
            else {
                startTextSpeech()
                if wasPaused { speech.pause() }
                else { applySleepTimer() }
            }
        }
        persistPosition()
    }

    private var positionBinding: Binding<Int> {
        Binding(get: { currentPercent }, set: { move(to: $0) })
    }

    private func startTextSpeech() {
        if readingOffset >= document.body.count {
            readingOffset = 0
            currentPercent = 0
        }
        let remainder = String(document.body.dropFirst(readingOffset))
        guard !remainder.isEmpty else { return }
        let utf16Offset = String(document.body.prefix(readingOffset)).utf16.count
        if effectiveReadingEngine == 1 {
            guard NativeVoiceCredentialStore.hasKey("gemini") else {
                actionMessage = MusicLocalized.message("Configura la clave Gemini en Motores externos.")
                return
            }
            do {
                try speech.playGemini(remainder, voice: effectiveGeminiVoice,
                    baseUTF16: utf16Offset, totalUTF16: document.body.utf16.count,
                    baseCharacters: readingOffset,
                    onError: { message in
                        actionMessage = message
                        UIAccessibility.post(notification: .announcement, argument: message)
                    })
                actionMessage = MusicLocalized.message("Generando el primer fragmento con Gemini. La reproducción comenzará cuando Google devuelva el audio.")
            } catch { actionMessage = error.localizedDescription }
        } else if effectiveReadingEngine == 2 {
            guard NativePhononRuntime.isUsable else {
                actionMessage = MusicLocalized.message("Instala el motor y modelo Phonon en Motores externos.")
                return
            }
            do {
                try speech.playPhonon(remainder, voice: effectivePhononVoice,
                    baseUTF16: utf16Offset, totalUTF16: document.body.utf16.count,
                    baseCharacters: readingOffset,
                    onError: { message in actionMessage = message })
                actionMessage = nil
            } catch { actionMessage = error.localizedDescription }
        } else {
            speech.play(remainder, speed: speed, pitch: pitch,
                language: AVSpeechSynthesisVoice(identifier: effectiveVoiceID)?.language ?? "es-ES",
                voiceIdentifier: effectiveVoiceID,
                baseUTF16: utf16Offset, totalUTF16: document.body.utf16.count,
                baseCharacters: readingOffset)
            actionMessage = nil
        }
    }

    private func play() {
        NativeRadioPlayer.shared.pauseForOtherAudio()
        NativeAppleMusicPlayer.shared.pauseForOtherAudio()
        NativeAudiusPlayer.shared.pauseForOtherAudio()
        NativeJamendoPlayer.shared.pauseForOtherAudio()
        NativeMusicPlayer.shared.pauseForReader()
        NativeRemotePlaybackOwner.claim(.reader)
        if speech.isPaused {
            speech.resume()
        } else if !tracks.isEmpty {
            playTrack()
            if let targetSeconds = pendingDaisyAudioSeconds, speech.hasAudio {
                speech.seek(toSeconds: targetSeconds)
                currentPercent = speech.audioPercent
                pendingDaisyAudioSeconds = nil
                persistPosition()
            } else if !didRestoreAudioPosition {
                restoreAudioPosition()
                didRestoreAudioPosition = true
            }
        } else {
            startTextSpeech()
        }
        MPNowPlayingInfoCenter.default().nowPlayingInfo = [
            MPMediaItemPropertyTitle: latest.title,
            MPNowPlayingInfoPropertyPlaybackRate: speech.isPlaying ? 1.0 : 0.0
        ]
        applySleepTimer()
    }

    private func refreshLiveReadingSettings() {
        speech.updateLiveSystemSettings(
            speed: speed, pitch: pitch, voiceIdentifier: effectiveVoiceID,
            language: AVSpeechSynthesisVoice(identifier: effectiveVoiceID)?.language ?? "es-ES")
        speech.updateLiveGeneratedVolume()
    }

    private func applySleepTimer(reset: Bool = false) {
        let index = max(0, min(sleepMinutes.count - 1, sleepIndex))
        let minutes = sleepMinutes[index]
        guard speech.isPlaying, minutes > 0 else {
            sleepDeadline = nil
            speech.sleep(after: 0)
            return
        }
        speech.onSleepExpired = {
            checkpointLiveTextPosition()
            persistPosition()
            sleepDeadline = nil
        }
        if reset || sleepDeadline == nil {
            sleepDeadline = Date().addingTimeInterval(TimeInterval(minutes * 60))
        }
        let seconds = max(0, sleepDeadline!.timeIntervalSinceNow)
        if seconds == 0 {
            stopPlayback()
            actionMessage = MusicLocalized.message("Apagado automático completado.")
        } else {
            speech.sleep(afterSeconds: seconds)
        }
    }

    private func playTrack() {
        guard tracks.indices.contains(trackIndex),
              NativeReaderFormats.storedURL(for: tracks[trackIndex]) != nil else {
            actionMessage = MusicLocalized.message("No se encuentra la pista de audio.")
            return
        }
        let urls = tracks.compactMap { NativeReaderFormats.storedURL(for: $0) }
        guard urls.count == tracks.count else {
            actionMessage = MusicLocalized.message("Faltan archivos de audio de esta obra.")
            return
        }
        let onChanged: (Int) -> Void = { next in
            trackIndex = next
            currentPercent = speech.audioPercent
            persistPosition()
            applySleepTimer()
        }
        let onError: (String) -> Void = { error in
            actionMessage = MusicLocalized.format("No se pudo reproducir: %@", error)
        }
        do {
            if latest.fileExtension?.lowercased() == "daisy",
               let clips = latest.daisyClips, !clips.isEmpty {
                // An explicit heading jump takes precedence over a saved
                // location. No user gesture for navigation starts playback.
                let seconds = pendingDaisyAudioSeconds
                    ?? (trackIndex == (latest.lastTrackIndex ?? 0)
                        ? latest.lastAudioSeconds : nil)
                try speech.playDaisySequence(urls, clips: clips, speed: speed,
                    track: trackIndex, at: currentPercent, seconds: seconds,
                    onTrackChanged: onChanged, onError: onError)
            } else {
                try speech.playPlaylist(urls, speed: speed,
                    track: trackIndex, at: currentPercent,
                    onTrackChanged: onChanged, onError: onError)
            }
            actionMessage = nil
        } catch {
            actionMessage = MusicLocalized.format(
                "No se pudo reproducir: %@", error.localizedDescription)
        }
    }

    private func restoreAudioPosition() {
        guard speech.hasAudio, trackIndex == (latest.lastTrackIndex ?? 0),
              let seconds = latest.lastAudioSeconds else { return }
        speech.seek(toSeconds: seconds)
        currentPercent = speech.audioPercent
        persistPosition()
    }

    /// Moving through DAISY headings never begins playback. Playing audio as a
    /// side effect competes with VoiceOver and can make navigation impossible.
    private func jumpToDaisy(_ point: NativeDaisyNavigationPoint, announce: Bool = true) {
        guard tracks.indices.contains(point.track) else {
            actionMessage = MusicLocalized.message("La pista indicada no está disponible.")
            return
        }
        // Cancel any ongoing audio/TTS before changing the track or announcing.
        if speech.isPlaying || speech.isPaused { stopPlayback() }
        trackIndex = point.track
        didRestoreAudioPosition = true
        let requestedSeconds = point.seconds.flatMap { $0.isFinite ? max(0, $0) : nil } ?? 0
        // Inspect the duration without starting the player. A target at 12
        // minutes must not be stored or displayed as 0% of the track.
        if let url = NativeReaderFormats.storedURL(for: tracks[point.track]),
           let probe = try? AVAudioPlayer(contentsOf: url),
           probe.duration.isFinite, probe.duration > 0 {
            let targetSeconds = min(requestedSeconds, probe.duration)
            pendingDaisyAudioSeconds = targetSeconds
            currentPercent = max(0, min(100, Int((
                targetSeconds / probe.duration * 100).rounded())))
        } else {
            pendingDaisyAudioSeconds = requestedSeconds
            currentPercent = 0
        }
        library.saveAudioPosition(document, track: trackIndex, percent: currentPercent,
                                  seconds: pendingDaisyAudioSeconds)
        lastSavedPercent = currentPercent
        sleepDeadline = nil
        showStructure = false
        // Only the user pressing Play can start audio. This short VoiceOver
        // message identifies the actual navigation type, not every point as a
        // heading (DAISY pages and references have their own semantics).
        actionMessage = nil
        let heading = NativeReaderHeadingDisplay.title(point.title, limit: 90)
        if announce {
            let type = point.kind == "Página" ? "Página DAISY"
                : point.kind == "Referencia" ? "Referencia DAISY"
                : point.kind == "Capítulo" ? "Capítulo" : "Encabezado"
            let message = MusicLocalized.format(
                "%@: %@. Pulsa Reproducir para escuchar.",
                MusicLocalized.message(type), heading)
            Task { @MainActor in
                await Task.yield()
                UIAccessibility.post(notification: .announcement, argument: message)
            }
        }
    }

    /// Capture the latest synthesizer checkpoint before any stop or view exit.
    /// The UI's last displayed fragment or rounded percentage may be stale.
    /// This method never moves the VoiceOver focus or restarts the voice.
    private func checkpointLiveTextPosition() {
        guard tracks.isEmpty && (speech.isPlaying || speech.isPaused) else { return }
        readingOffset = max(0, min(textLayout.totalCharacters, speech.textCharacterOffset))
        currentPercent = max(0, min(100, Int(Double(readingOffset) * 100 /
            Double(max(1, textLayout.totalCharacters)))))
    }

    private func handleAudioInterruption(_ notification: Notification) {
        guard let raw = notification.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
              let kind = AVAudioSession.InterruptionType(rawValue: raw) else { return }
        switch kind {
        case .began:
            // A real system interruption is not a user-requested pause.
            // Preserve the exact word/track position once.
            interruptedWhilePlaying = speech.isPlaying
            if interruptedWhilePlaying { pausePlayback() }
        case .ended:
            let rawOptions = notification.userInfo?[AVAudioSessionInterruptionOptionKey] as? UInt ?? 0
            let options = AVAudioSession.InterruptionOptions(rawValue: rawOptions)
            if interruptedWhilePlaying && options.contains(.shouldResume) && speech.isPaused {
                play()
            }
            interruptedWhilePlaying = false
        @unknown default:
            break
        }
    }

    private func pausePlayback() {
        checkpointLiveTextPosition()
        speech.pause()
        if NativeRemotePlaybackOwner.current == .reader {
            var info = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]
            info[MPNowPlayingInfoPropertyPlaybackRate] = 0.0
            MPNowPlayingInfoCenter.default().nowPlayingInfo = info
        }
        sleepDeadline = nil
        persistPosition()
    }

    private func registerRemotePlaybackCommands() {
        guard remoteCommandTokens.isEmpty else { return }
        let remoteCommandCenter = MPRemoteCommandCenter.shared()
        if NativeRemotePlaybackOwner.current == nil { NativeRemotePlaybackOwner.claim(.reader) }
        UIApplication.shared.beginReceivingRemoteControlEvents()
        remoteCommandCenter.playCommand.isEnabled = true
        remoteCommandCenter.pauseCommand.isEnabled = true
        remoteCommandCenter.togglePlayPauseCommand.isEnabled = true
        let playToken = remoteCommandCenter.playCommand.addTarget { _ in
            DispatchQueue.main.async {
                guard NativeRemotePlaybackOwner.current == .reader else { return }
                if !speech.isPlaying { play() }
            }
            return .success
        }
        let pauseToken = remoteCommandCenter.pauseCommand.addTarget { _ in
            DispatchQueue.main.async {
                guard NativeRemotePlaybackOwner.current == .reader else { return }
                if speech.isPlaying { pausePlayback() }
            }
            return .success
        }
        let toggleToken = remoteCommandCenter.togglePlayPauseCommand.addTarget { _ in
            DispatchQueue.main.async {
                guard NativeRemotePlaybackOwner.current == .reader else { return }
                toggleReaderPlayback()
            }
            return .success
        }
        remoteCommandTokens = [playToken, pauseToken, toggleToken]
    }

    private func unregisterRemotePlaybackCommands() {
        guard remoteCommandTokens.count == 3 else { return }
        let remoteCommandCenter = MPRemoteCommandCenter.shared()
        remoteCommandCenter.playCommand.removeTarget(remoteCommandTokens[0])
        remoteCommandCenter.pauseCommand.removeTarget(remoteCommandTokens[1])
        remoteCommandCenter.togglePlayPauseCommand.removeTarget(remoteCommandTokens[2])
        remoteCommandTokens = []
    }

    private func stopPlayback() {
        // Capture a live text cursor, or the exact audio time, before the
        // active synthesizer/player is discarded by stop().
        checkpointLiveTextPosition()
        persistPosition()
        speech.stop()
        sleepDeadline = nil
    }

    private func changeTrack(_ delta: Int) {
        guard tracks.indices.contains(trackIndex + delta) else { return }
        persistPosition()
        pendingDaisyAudioSeconds = nil
        trackIndex += delta
        didRestoreAudioPosition = true
        move(to: 0)
        playTrack()
        applySleepTimer()
    }

    private func jump(to offset: Int, focusReader: Bool = true) {
        readingOffset = max(0, min(textLayout.totalCharacters, offset))
        currentPercent = NativeReaderProgress.textPercent(
            length: textLayout.totalCharacters, offset: readingOffset)
        persistPosition()
        if focusReader {
            let index = textLayout.fragmentIndex(for: readingOffset)
            programmaticFocusRequest = true
            focusedFragment = index
        }
        if speech.isPlaying || speech.isPaused {
            let wasPaused = speech.isPaused
            if readingOffset >= textLayout.totalCharacters { speech.stop() }
            else {
                startTextSpeech()
                if wasPaused { speech.pause() }
                else { applySleepTimer() }
            }
        }
    }

    private func activateCurrentLink() {
        guard navigationUnit == 8 else {
            actionMessage = MusicLocalized.message("Selecciona Enlaces en Modo de navegación.")
            return
        }
        if let link = latest.textLinks?.first(where: { $0.offset == readingOffset }),
           let target = link.targetOffset {
            jump(to: target)
            actionMessage = MusicLocalized.format("Destino: %@", link.title)
        } else if let link = latest.textLinks?.first(where: { $0.offset == readingOffset }),
                  let url = URL(string: link.url),
                  ["https", "http"].contains(url.scheme?.lowercased() ?? ""),
                  url.host != nil {
            UIApplication.shared.open(url)
        } else if let url = textLayout.visibleURL(at: readingOffset) {
            UIApplication.shared.open(url)
        } else {
            actionMessage = MusicLocalized.message("No hay un enlace disponible en esta posición.")
        }
    }

    private func moveUnit(_ direction: Int) {
        guard navigationOptions.contains(where: { $0.unit == navigationUnit }) else {
            navigationFeedback = MusicLocalized.message(
                "El modo elegido no está disponible en este libro.")
            return
        }
        let unit = effectiveNavigationUnit
        if unit == 9 || unit == 10 {
            moveDaisyPoint(direction, kind: unit == 9 ? "Página" : "Referencia")
            return
        }
        if unit == 8 {
            let offsets = Array(Set(textLayout.linkStarts +
                                    (latest.textLinks ?? []).map { $0.offset })).sorted()
            guard let next = direction > 0
                ? offsets.first(where: { $0 > readingOffset })
                : offsets.last(where: { $0 < readingOffset }) else {
                navigationFeedback = MusicLocalized.message("No hay más enlaces en esa dirección.")
                return
            }
            navigateText(to: next, unit: 8)
            if let link = latest.textLinks?.first(where: { $0.offset == next }) {
                navigationFeedback = MusicLocalized.format("Enlace: %@",
                    NativeReaderHeadingDisplay.title(link.title, limit: 90))
            } else if let url = textLayout.visibleURL(at: next) {
                navigationFeedback = MusicLocalized.format("Enlace: %@",
                    String(url.absoluteString.prefix(90)))
            }
            return
        }
        if unit == 7 && !tracks.isEmpty && daisyChapterPoints.count > 1 {
            moveDaisyPoint(direction, kind: "Capítulo")
            return
        }
        if unit == 4 && !tracks.isEmpty &&
            (latest.daisyNavigation ?? []).contains(where: {
                $0.kind != "Página" && $0.kind != "Referencia"
            }) {
            moveDaisyPoint(direction, kind: nil)
            return
        }
        if unit == 5 {
            skipReading(direction)
            return
        }
        if unit == 6 {
            moveBetweenMarks(direction)
            return
        }
        guard !latest.body.isEmpty,
              let next = textLayout.nearbyOffset(readingOffset,
                                                  direction: direction, unit: unit)
        else {
            navigationFeedback = MusicLocalized.message(
                "No hay más elementos del modo elegido en esa dirección.")
            return
        }
        navigateText(to: next, unit: unit)
    }

    private func moveDaisyPoint(_ direction: Int, kind: String?) {
        let points = (kind == "Capítulo"
            ? daisyChapterPoints
            : (latest.daisyNavigation ?? []).filter { point in
                if let kind { return point.kind == kind }
                return point.kind != "Página" && point.kind != "Referencia"
            }).sorted {
            $0.track == $1.track ? ($0.seconds ?? 0) < ($1.seconds ?? 0) : $0.track < $1.track
        }
        let currentTime = speech.hasAudio ? speech.audioElapsed
            : (pendingDaisyAudioSeconds ?? latest.lastAudioSeconds ?? 0)
        let candidates = points.filter { point in
            if point.track != trackIndex {
                return direction > 0 ? point.track > trackIndex : point.track < trackIndex
            }
            let seconds = point.seconds ?? 0
            return direction > 0 ? seconds > currentTime + 0.5 : seconds < currentTime - 0.5
        }
        guard let point = direction > 0 ? candidates.first : candidates.last else {
            navigationFeedback = MusicLocalized.message(
                "No hay más elementos de ese tipo en esa dirección.")
            return
        }
        jumpToDaisy(point, announce: false)
        let modeName = kind == "Página" ? "Página DAISY"
            : kind == "Referencia" ? "Referencia DAISY"
            : kind == "Capítulo" ? "Capítulo" : "Encabezado"
        navigationFeedback = MusicLocalized.format("%@: %@", MusicLocalized.message(modeName),
            NativeReaderHeadingDisplay.title(point.title, limit: 90))
    }

    private func moveBetweenMarks(_ direction: Int) {
        if !tracks.isEmpty {
            let marks = latest.savedAudioBookmarks.sorted {
                $0.track == $1.track
                    ? ($0.seconds ?? Double($0.percent)) < ($1.seconds ?? Double($1.percent))
                    : $0.track < $1.track
            }
            let currentTime = speech.hasAudio ? speech.audioElapsed
                : (pendingDaisyAudioSeconds ?? latest.lastAudioSeconds)
            let candidates = marks.filter { mark in
                if mark.track != trackIndex {
                    return direction > 0 ? mark.track > trackIndex : mark.track < trackIndex
                }
                if let seconds = mark.seconds, let currentTime {
                    return direction > 0 ? seconds > currentTime + 0.5
                        : seconds < currentTime - 0.5
                }
                return direction > 0 ? mark.percent > currentPercent
                    : mark.percent < currentPercent
            }
            guard let mark = direction > 0 ? candidates.first : candidates.last else {
                navigationFeedback = MusicLocalized.message("No hay más marcas en esa dirección.")
                return
            }
            if speech.isPlaying || speech.isPaused { stopPlayback() }
            trackIndex = mark.track
            currentPercent = mark.percent
            didRestoreAudioPosition = true
            pendingDaisyAudioSeconds = mark.seconds.flatMap { $0.isFinite ? max(0, $0) : nil }
            // For older percent-only bookmarks, Play starts at currentPercent.
            library.saveAudioPosition(document, track: trackIndex, percent: currentPercent,
                                      seconds: pendingDaisyAudioSeconds)
            lastSavedPercent = currentPercent
            navigationFeedback = MusicLocalized.format("Marca: pista %d", mark.track + 1)
            actionMessage = nil
        } else {
            let offsets = Set(latest.savedTextBookmarks.map(\.offset)
                + latest.bookmarks.map {
                    Int(Double(textLayout.totalCharacters) * Double($0) / 100.0)
                }).sorted()
            guard let next = direction > 0
                ? offsets.first(where: { $0 > readingOffset })
                : offsets.last(where: { $0 < readingOffset }) else {
                navigationFeedback = MusicLocalized.message("No hay más marcas en esa dirección.")
                return
            }
            navigateText(to: next, unit: 6)
            navigationFeedback = MusicLocalized.format("Marca: %@",
                NativeReaderHeadingDisplay.title(bookmarkDescription(atOffset: next), limit: 90))
        }
    }

    // Quitar de las etiquetas de marcas los prefijos Markdown de EPUB.
    // Las posiciones y el documento original permanecen intactos.
    private func spokenBookmarkExcerpt(_ source: String) -> String {
        NativeReaderHeadingDisplay.title(source, limit: 140)
    }

    // Resultados contextualizados a partir del texto original de la obra.
    // Los índices se calculan en caracteres, igual que readingOffset y las marcas.
    private struct DocumentSearchHit: Identifiable {
        let offset: Int
        let excerpt: String
        var id: Int { offset }
    }

    private var documentSearchHits: [DocumentSearchHit] {
        let query = documentSearchText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !query.isEmpty, !latest.body.isEmpty else { return [] }
        let body = latest.body
        let chars = Array(body)
        var cursor = body.startIndex
        var hits: [DocumentSearchHit] = []
        while cursor < body.endIndex, hits.count < 150,
              let match = body.range(
                of: query,
                options: [.caseInsensitive, .diacriticInsensitive],
                range: cursor..<body.endIndex
              ) {
            let offset = body.distance(from: body.startIndex, to: match.lowerBound)
            let left = max(0, offset - 55)
            let right = min(chars.count, offset + max(1, query.count) + 85)
            let context = String(chars[left..<right])
                .replacingOccurrences(of: "\\n", with: " ")
                .replacingOccurrences(of: "\\r", with: " ")
                .trimmingCharacters(in: .whitespacesAndNewlines)
            hits.append(DocumentSearchHit(offset: offset, excerpt: context))
            cursor = match.upperBound
        }
        return hits
    }

    private func openDocumentSearch() {
        positionBeforeSearch = readingOffset
        showDocumentSearch = true
    }

    private var documentSearchSheetContent: some View {
        NavigationStack {
            List {
                Section("Texto que quieres buscar") {
                    TextField("Palabra o frase", text: $documentSearchText)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .accessibilityHint("Busca dentro del documento actual.")
                }
                if documentSearchText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    Text("Escribe una palabra o frase para buscar en el documento.")
                } else {
                    Section("Resultados") {
                        if documentSearchHits.isEmpty {
                            Text("No se han encontrado coincidencias.")
                        }
                        ForEach(documentSearchHits) { hit in
                            Button(hit.excerpt.isEmpty ? "Posición \\(hit.offset)" : hit.excerpt) {
                                showDocumentSearch = false
                                jump(to: hit.offset)
                            }
                            .accessibilityHint("Ir a esta coincidencia y continuar desde ella.")
                        }
                        if documentSearchHits.count == 150 {
                            Text("Se muestran las primeras 150 coincidencias. Escribe más palabras para afinar la búsqueda.")
                        }
                    }
                }
                if let positionBeforeSearch {
                    Section("Posición anterior") {
                        Button("Volver a donde estaba leyendo") {
                            showDocumentSearch = false
                            jump(to: positionBeforeSearch)
                            self.positionBeforeSearch = nil
                        }
                    }
                }
            }
            .tifloScreenSurface()
            .navigationTitle("Buscar en el documento")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                Button("Cerrar") { showDocumentSearch = false }
            }
        }
    }

    private func bookmarkDescription(atOffset offset: Int) -> String {
        let text = latest.body
        guard !text.isEmpty else { return "Comienzo del documento" }
        let characters = Array(text)
        let index = min(characters.count - 1, max(0, offset))
        let sentenceStart = (0..<index).reversed().first {
            ".!?\n".contains(characters[$0])
        }.map { $0 + 1 } ?? 0
        var start = sentenceStart
        while start < characters.count && characters[start].isWhitespace { start += 1 }
        let excerpt = String(characters[start..<min(characters.count, start + 140)])
            .trimmingCharacters(in: .whitespacesAndNewlines)
        return excerpt.isEmpty ? "Posición \(index)" : spokenBookmarkExcerpt(excerpt)
    }

    private func bookmarkDescription(at percent: Int) -> String {
        let text = latest.body
        guard !text.isEmpty else { return "\(percent) por ciento" }
        let characters = Array(text)
        let offset = min(characters.count - 1, max(0, Int(Double(characters.count) * Double(percent) / 100.0)))
        let fragmentStart = (0..<offset).reversed().first {
            ".!?\n".contains(characters[$0])
        }.map { $0 + 1 } ?? 0
        var start = fragmentStart
        while start < characters.count && characters[start].isWhitespace { start += 1 }
        let excerpt = String(characters[start..<min(characters.count, start + 140)])
            .trimmingCharacters(in: .whitespacesAndNewlines)
        return excerpt.isEmpty ? "\(percent) por ciento" : "\(spokenBookmarkExcerpt(excerpt)), \(percent) por ciento"
    }

    private func skipReading(_ direction: Int) {
        let feedback = direction > 0 ? "Avanzado un minuto." : "Retrocedido un minuto."
        if !tracks.isEmpty && !speech.isGeneratedSpeech {
            if speech.hasAudio {
                let previous = speech.audioElapsed
                speech.skip(seconds: TimeInterval(direction * timeStep))
                currentPercent = speech.audioPercent
                persistPosition()
                navigationFeedback = abs(speech.audioElapsed - previous) > 0.01
                    ? MusicLocalized.message(feedback)
                    : MusicLocalized.message("No hay más recorrido en esa dirección.")
            } else if tracks.indices.contains(trackIndex),
                      let url = NativeReaderFormats.storedURL(for: tracks[trackIndex]),
                      let audio = try? AVAudioPlayer(contentsOf: url),
                      audio.duration.isFinite && audio.duration > 0 {
                // A DAISY should also advance while paused or before Play.
                // Read the local duration without starting playback.
                let previous = pendingDaisyAudioSeconds ?? latest.lastAudioSeconds
                    ?? (Double(currentPercent) * audio.duration / 100)
                let target = max(0, min(audio.duration,
                    previous + TimeInterval(direction * timeStep)))
                pendingDaisyAudioSeconds = target
                currentPercent = Int((target / audio.duration * 100).rounded())
                didRestoreAudioPosition = true
                library.saveAudioPosition(document, track: trackIndex, percent: currentPercent,
                                          seconds: target)
                lastSavedPercent = currentPercent
                navigationFeedback = abs(target - previous) > 0.01
                    ? MusicLocalized.message(feedback)
                    : MusicLocalized.message("No hay más recorrido en esa dirección.")
            } else {
                navigationFeedback = MusicLocalized.message(
                    "No se pudo consultar la duración de esta pista.")
            }
        } else if !latest.body.isEmpty {
            let charactersPerMinute = Double(textLayout.totalCharacters) /
                Double(max(1, wordCount)) * 165.0 * speed
            let offset = max(0, min(textLayout.totalCharacters,
                readingOffset + direction * max(1,
                    Int(charactersPerMinute * Double(timeStep) / 60.0))))
            if offset == readingOffset {
                navigationFeedback = MusicLocalized.message(
                    "No hay más recorrido en esa dirección.")
            } else {
                navigateText(to: offset, unit: 5)
                navigationFeedback = MusicLocalized.message(feedback)
            }
        } else {
            navigationFeedback = MusicLocalized.message(
                "No hay contenido disponible para este modo de navegación.")
        }
        actionMessage = nil
    }

    private func addBookmark() {
        let code = NativeAppLanguage.code(for: languageIndex)
        let locale = Locale(identifier: code)
        let result: NativeBookmarkSaveResult
        let savedMessage: String
        if tracks.isEmpty {
            result = library.addTextBookmark(document, offset: readingOffset)
            let offset = max(0, min(latest.body.count, readingOffset))
            let percent = latest.body.isEmpty ? 0
                : Int((Double(offset) * 100 / Double(latest.body.count)).rounded())
            let format = NativeAppLanguage.message("Marca guardada en %d por ciento.", languageCode: code)
            savedMessage = String(format: format, locale: locale, percent)
        } else {
            result = library.addAudioBookmark(document, track: trackIndex, percent: currentPercent,
                                              seconds: speech.hasAudio ? speech.audioElapsed : nil)
            let format = NativeAppLanguage.message("Marca guardada en la pista %d, %d por ciento.", languageCode: code)
            savedMessage = String(format: format, locale: locale, trackIndex + 1, currentPercent)
        }

        switch result {
        case .saved:
            actionMessage = savedMessage
            NativeReaderFeedback.confirm(.saved)
        case .alreadyExists:
            actionMessage = NativeAppLanguage.message("Ya existe una marca en esta posición.", languageCode: code)
            NativeReaderFeedback.confirm(.duplicate)
        case .documentUnavailable:
            actionMessage = NativeAppLanguage.message("No se pudo crear la marca: documento no disponible.", languageCode: code)
            NativeReaderFeedback.confirm(.error)
        case .failed:
            actionMessage = NativeAppLanguage.message("No se pudo guardar la marca. Inténtalo de nuevo.", languageCode: code)
            NativeReaderFeedback.confirm(.error)
        }

        if NativeReaderFeedback.spokenAnnouncementsEnabled, let actionMessage {
            UIAccessibility.post(notification: .announcement, argument: actionMessage)
        }
    }

    private func exportGeneratedAudio() {
        guard !audioExportBusy, !latest.body.isEmpty else { return }
        guard availableExportEngines.contains(where: { $0.engine == audioExportEngine }) else {
            audioExportProgress = "El motor seleccionado debe prepararse en Motores externos."
            return
        }
        let engine = audioExportEngine
        let format = audioExportFormat
        let voice: String
        switch engine {
        case .system:
            voice = audioExportSystemVoice.isEmpty ? effectiveVoiceID : audioExportSystemVoice
        case .gemini:
            voice = audioExportGeminiVoice
        case .phonon:
            voice = audioExportPhononVoice
        }
        audioExportBusy = true
        audioExportProgress = "Preparando exportación…"
        let body = latest.body
        let title = latest.title
        audioExportTask = Task {
            defer {
                audioExportBusy = false
                audioExportTask = nil
            }
            do {
                let url = try await NativeGeminiAudioExport.export(
                    text: body, title: title, voice: voice,
                    format: format, engine: engine,
                    speed: NativeReaderSpeedOptions.rate(for: effectiveSpeedIndex),
                    pitch: pitch, language: audioExportLanguage,
                    progress: { finished, total in
                        audioExportProgress = "Generados \(finished) de \(total) fragmentos"
                    })
                try Task.checkCancellation()
                // The share sheet can fail or be dismissed. Persist the result
                // first, preserving its original MP3/DAISY package for later.
                let savedID = UUID()
                let formatLabel: String
                switch format {
                case .mp3: formatLabel = "MP3"
                case .m4a: formatLabel = "M4A"
                case .wav: formatLabel = "WAV"
                case .daisy: formatLabel = "DAISY 3"
                case .daisyVoiceDream: formatLabel = "DAISY 2.02 audio"
                case .voiceDreamMP3Zip: formatLabel = "Voice Dream MP3 ZIP"
                }
                let savedTitle = "\(title) - \(formatLabel)"
                try await library.importFile(from: url, sharingID: savedID,
                                            preferredTitle: savedTitle)
                guard let stored = library.documents.first(where: { $0.id == savedID }),
                      let relativePath = stored.originalRelativePath,
                      let persistentURL = NativeReaderFormats.storedURL(for: relativePath),
                      FileManager.default.fileExists(atPath: persistentURL.path) else {
                    throw CocoaError(.fileNoSuchFile)
                }
                savedExportURL = persistentURL
                showAudioExport = false
                audioExportProgress = "Conversión completada. Archivo guardado en la biblioteca."
                showExportCompleted = true
            } catch is CancellationError {
                audioExportProgress = "Exportación cancelada."
            } catch {
                audioExportProgress = "Error al exportar: \(error.localizedDescription)"
            }
        }
    }

    private var audioExportSheet: some View {
        NavigationStack {
            Form {
                Section("Formato de salida") {
                    NativeAdjustableChoice(
                        title: "Formato",
                        choices: NativeGeminiAudioExport.Format.allCases.map(\.rawValue),
                        selectedIndex: Binding(
                            get: { NativeGeminiAudioExport.Format.allCases.firstIndex(of: audioExportFormat) ?? 0 },
                            set: { audioExportFormat = NativeGeminiAudioExport.Format.allCases[$0] }
                        ))
                }
                if audioExportFormat == .daisyVoiceDream {
                    Text("DAISY 2.02 de audio: conserva la voz grabada y permite la navegación por capítulos. No incluye el texto sincronizado.")
                        .font(.footnote)
                }
                if audioExportFormat == .voiceDreamMP3Zip {
                    Text("ZIP de MP3 numerados: conserva la voz sintetizada en esta conversión, sin incluir texto ni estructura DAISY. La compatibilidad con Voice Dream requiere prueba en el dispositivo.")
                        .font(.footnote)
                }
                if audioExportFormat == .daisy || audioExportFormat == .daisyVoiceDream {
                    Section("Idioma del libro DAISY") {
                        NativeAdjustableChoice(
                            title: "Idioma del contenido",
                            choices: ["Español", "Inglés", "Portugués", "Francés", "Alemán", "Italiano"],
                            selectedIndex: Binding(
                                get: { ["es", "en", "pt", "fr", "de", "it"].firstIndex(of: audioExportLanguage) ?? 0 },
                                set: { audioExportLanguage = ["es", "en", "pt", "fr", "de", "it"][$0] }
                            ))
                        Text("Selecciona el idioma del texto original, aunque utilices otro motor de voz.")
                    }
                }
                Section("Motor de voz") {
                    NativeAdjustableChoice(
                        title: "Motor",
                        choices: availableExportEngines.map { $0.title },
                        selectedIndex: Binding(
                            get: { availableExportEngines.firstIndex(where: { $0.engine == audioExportEngine }) ?? 0 },
                            set: { index in
                                guard availableExportEngines.indices.contains(index) else { return }
                                audioExportEngine = availableExportEngines[index].engine
                            }
                        ))
                    if audioExportEngine == .system {
                        NativeAdjustableChoice(
                            title: "Voz",
                            choices: ["Voz del documento"] + AVSpeechSynthesisVoice.speechVoices().map {
                                "\($0.name), \($0.language)"
                            },
                            selectedIndex: Binding(
                                get: {
                                    (AVSpeechSynthesisVoice.speechVoices().firstIndex {
                                        $0.identifier == audioExportSystemVoice
                                    }.map { $0 + 1 }) ?? 0
                                },
                                set: { index in
                                    let voices = AVSpeechSynthesisVoice.speechVoices()
                                    audioExportSystemVoice = index > 0 && voices.indices.contains(index - 1)
                                        ? voices[index - 1].identifier : ""
                                }
                            ))
                    } else if audioExportEngine == .gemini {
                        NativeAdjustableChoice(
                            title: "Voz",
                            choices: NativeGeminiSpeech.voices,
                            selectedIndex: Binding(
                                get: { NativeGeminiSpeech.voices.firstIndex(of: audioExportGeminiVoice) ?? 0 },
                                set: { audioExportGeminiVoice = NativeGeminiSpeech.voices[$0] }
                            ))
                        Text("Gemini requiere una clave personal configurada en Motores externos.")
                    } else {
                        Text("Phonon requiere el motor y sus modelos instalados.")
                        TextField("Nombre de la voz Phonon", text: $audioExportPhononVoice)
                    }
                }
                Section("Estado") {
                    Text(audioExportProgress.isEmpty ? "Selecciona el formato y el motor." : audioExportProgress)
                        .accessibilityAddTraits(.updatesFrequently)
                    Button(audioExportBusy ? "Generando…" : "Convertir y guardar") {
                        exportGeneratedAudio()
                    }
                    .disabled(audioExportBusy)
                    if audioExportBusy {
                        Button("Cancelar generación", role: .cancel) {
                            audioExportTask?.cancel()
                        }
                    }
                }
            }
            .navigationTitle("Convertir a audio o DAISY")
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Cerrar") { showAudioExport = false }
                        .disabled(audioExportBusy)
                }
            }
        }
    }

    private func exportText() {
        guard !latest.body.isEmpty else { return }
        let cleanName = latest.title.replacingOccurrences(
            of: #"[\\/:*?"<>|\x00-\x1F]"#, with: "_", options: .regularExpression
        ).trimmingCharacters(in: .whitespacesAndNewlines)
        let name = cleanName.isEmpty ? "Documento" : cleanName
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        let url = directory.appendingPathComponent(name + ".txt")
        do {
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            try latest.body.write(to: url, atomically: true, encoding: .utf8)
            NativeShare.present(url: url)
        } catch {
            actionMessage = MusicLocalized.format("No se pudo exportar: %@", error.localizedDescription)
        }
    }

    private func formatDuration(_ seconds: Int) -> String {
        let value = max(0, seconds)
        return value >= 3600
            ? String(format: "%d:%02d:%02d", value / 3600, value / 60 % 60, value % 60)
            : String(format: "%d:%02d", value / 60, value % 60)
    }

    private var progressDescription: String {
        // La lectura de voz sintetizada no tiene duración real antes de comenzar.
        // Distinguir siempre el tiempo medido de la estimación.
        let position = tracks.isEmpty
            ? "Leído \(currentPercent) por ciento. Falta \(100 - currentPercent) por ciento."
            : "Pista \(trackIndex + 1) de \(tracks.count). Escuchado \(currentPercent) por ciento de esta pista; falta \(100 - currentPercent) por ciento."
        if !tracks.isEmpty && !speech.hasAudio {
            return "\(position) La duración de audio se mostrará al iniciar la pista."
        }
        if speech.hasAudio {
            let elapsed = Int(speech.audioElapsed)
            let remaining = max(0, Int(speech.audioDuration) - elapsed)
            return "\(position) Tiempo realizado \(formatDuration(elapsed)). Tiempo restante \(formatDuration(remaining))."
        }
        let estimate = Int(Double(max(1, wordCount)) * 60.0 / (165.0 * speed))
        let remaining = Int(Double(estimate) * Double(100 - currentPercent) / 100.0)
        return "\(position) Voz reproducida \(formatDuration(elapsedSpeakingSeconds)). Tiempo restante estimado \(formatDuration(remaining))."
    }

    /// The regular button and VoiceOver Magic Tap share the exact same
    /// pause/resume decision; neither starts a new paragraph implicitly.
    private func toggleReaderPlayback() {
        if speech.isPlaying { pausePlayback() }
        else { play() }
    }

    private func activatePlaybackButton() {
        toggleReaderPlayback()
        // The label changes from Reproducir to Pausar. Reapply focus after
        // SwiftUI has replaced the accessible label, not to the toolbar.
        if presentationMode == 0 && readingMode == 1 {
            Task { @MainActor in
                await Task.yield()
                playbackButtonFocused = true
            }
        }
    }

    /// One activation returns to the start without auto-playing any voice.
    private func returnToBeginning() {
        speech.stop()
        sleepDeadline = nil
        readingOffset = 0
        currentPercent = 0
        trackIndex = 0
        lastSavedPercent = 0
        if tracks.isEmpty {
            pendingDaisyAudioSeconds = nil
        } else {
            pendingDaisyAudioSeconds = 0
            didRestoreAudioPosition = true
        }
        persistPosition()
        if !textLayout.fragmentStarts.isEmpty { navigationScrollTarget = 0 }
        navigationFeedback = MusicLocalized.message(
            "Posición inicial. Pulsa Reproducir para comenzar.")
        actionMessage = nil
        if NativeRemotePlaybackOwner.current == .reader {
            var info = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]
            info[MPNowPlayingInfoPropertyPlaybackRate] = 0.0
            MPNowPlayingInfoCenter.default().nowPlayingInfo = info
        }
    }

    private var playbackRow: some View {
        AnyLayout(
            dynamicTypeSize.isAccessibilitySize
                ? AnyLayout(VStackLayout(alignment: .leading, spacing: 6))
                : AnyLayout(HStackLayout(spacing: 8))
        ) {
            Button(speech.isPlaying ? "Pausar" : "Reproducir") {
                activatePlaybackButton()
            }
            // Announce the reached unit, not the unrelated reading percentage.
            .accessibilityValue(navigationAccessibilityValue)
            .accessibilityHint(speech.isPlaying
                ? Text("Desliza arriba o abajo para navegar por el modo elegido.")
                : Text("La navegación con gestos solo está disponible mientras se reproduce."))
            .accessibilityAdjustableAction { direction in
                // Flicks over Reproducir may be accidental. Only navigate
                // while the button reads Pausar and audio is playing.
                guard speech.isPlaying else { return }
                switch direction {
                case .increment: moveUnit(1)
                case .decrement: moveUnit(-1)
                @unknown default: break
                }
            }
            .accessibilityAction(named: Text("Abrir enlace actual")) {
                activateCurrentLink()
            }
            .accessibilityFocused($playbackButtonFocused)
            Button("Volver al principio") { returnToBeginning() }
                .accessibilityHint("Sitúa la lectura al principio sin reproducir.")
        }
        .buttonStyle(.bordered)
        .controlSize(.small)
    }

    @ViewBuilder
    private var trackButtons: some View {
        if tracks.count > 1 {
            VStack(alignment: .leading, spacing: 4) {
                NativeAdjustableChoice(
                    title: "Seleccionar pista",
                    choices: tracks.indices.map { "Pista \($0 + 1) de \(tracks.count)" },
                    selectedIndex: Binding(
                        get: { trackIndex },
                        set: { index in
                            guard tracks.indices.contains(index), index != trackIndex else { return }
                            pendingDaisyAudioSeconds = nil
                            trackIndex = index
                            currentPercent = 0
                            playTrack()
                            persistPosition()
                            applySleepTimer()
                        }
                    )
                )
            }
        }
    }

    private var quickControls: some View {
        VStack(alignment: .leading, spacing: 6) {
            playbackRow
            NativeAdjustableChoice(
                title: "Modo de navegación",
                choices: navigationOptions.map { $0.label },
                selectedIndex: navigationSelection
            )
            trackButtons
            Button("Añadir marca") { addBookmarkFromReaderSelection() }
            if !latest.body.isEmpty {
                Button("Buscar en el documento") { openDocumentSearch() }
            }
            NativeAdjustableChoice(
                title: "Apagado automático",
                choices: Self.sleepChoices,
                selectedIndex: $sleepIndex
            )
            NativeAdjustableChoice(
                title: "Ir a posición",
                choices: Self.percentages,
                selectedIndex: positionBinding
            )
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 8)
        .background(TifloVisual.surfaceRaised)
    }

    private var readerFooterControls: some View {
        VStack(alignment: .leading, spacing: 6) {
            Button("Marcas guardadas") { showSavedMarks = true }
            Button("Audio") { showAudioSettings = true }
                .accessibilityHint("Abre velocidad, voz y pausas por puntuación.")
            Button("Visual") { showVisualSettings = true }
                .accessibilityHint("Abre tamaño de letra y presentación visual.")
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 8)
        .background(TifloVisual.surfaceRaised)
    }

    // The button, VoiceOver reader action and shortcut save the same live cursor.
    // Choosing a previously focused fragment here could silently create an old mark
    // (or an exact duplicate) when the user moved elsewhere in the book.
    private func addBookmarkFromReaderSelection() {
        addBookmark()
    }

    private func bookmarkFromContextMenu(at fragment: Int) {
        // Create the mark on the VoiceOver-selected fragment. Never pause a
        // playing voice or move the active reading cursor just to save a mark.
        guard textLayout.fragmentStarts.indices.contains(fragment) else { return }
        let previousOffset = readingOffset
        let previousPercent = currentPercent
        readingOffset = textLayout.fragmentStarts[fragment]
        currentPercent = min(100, Int(Double(readingOffset) * 100 /
            Double(max(1, textLayout.totalCharacters))))
        addBookmark()
        // The bookmark has its own stored offset. Restore the spoken/visual
        // cursor regardless of a successful save, duplicate or storage error.
        readingOffset = previousOffset
        currentPercent = previousPercent
    }

    /// Restore manual VoiceOver/braille reading without starting audio or
    /// stealing focus from an active speech session.
    private func restoreManualReadingFocus(using proxy: ScrollViewProxy) {
        guard (presentationMode != 0 || readingMode != 1), !speech.isPlaying,
              (presentationMode != 2 || brailleFocusText),
              !textLayout.fragmentStarts.isEmpty else { return }
        let savedOffset = max(0, min(textLayout.totalCharacters,
            latest.lastTextOffset ?? readingOffset))
        let savedFragment = textLayout.fragmentIndex(for: savedOffset)
        lastReaderFragment = savedFragment
        programmaticFocusRequest = true
        proxy.scrollTo(savedFragment, anchor: .center)
        focusedFragment = savedFragment
    }

    private func visibleReaderFragment(at index: Int) -> String {
        // Mask, rather than remove, heading markers. The offset of each
        // accessible link must still match the original document.
        NativeReaderHeadingDisplay.mask(in: textLayout.fragments[index])
    }

    /// Real hyperlinks inside text must be activatable with a VoiceOver double
    /// tap, not only through the separate "Abrir enlace actual" action.
    private func linkedReaderFragment(at index: Int) -> AttributedString {
        let fragment = visibleReaderFragment(at: index)
        var matches: [(range: Range<String.Index>, target: URL)] = []
        if let regex = try? NSRegularExpression(pattern: #"https?://[^\s<>\"']+"#, options: [.caseInsensitive]) {
            let full = NSRange(fragment.startIndex..<fragment.endIndex, in: fragment)
            for match in regex.matches(in: fragment, range: full) {
                guard let range = Range(match.range, in: fragment),
                      let target = URL(string: String(fragment[range])),
                      ["https", "http"].contains(target.scheme?.lowercased() ?? ""),
                      target.host != nil else { continue }
                matches.append((range, target))
            }
        }

        // A hyperlink with a descriptive label (e.g. "Descargar guía") is
        // invisible to URL detection. Resolve its exact imported text offset.
        let start = textLayout.fragmentStarts[index]
        for link in latest.textLinks ?? [] {
            let relative = link.offset - start
            guard relative >= 0, relative + link.title.count <= fragment.count,
                  let target = URL(string: link.url),
                  ["https", "http"].contains(target.scheme?.lowercased() ?? ""),
                  target.host != nil else { continue }
            let first = fragment.index(fragment.startIndex, offsetBy: relative)
            let end = fragment.index(first, offsetBy: link.title.count)
            guard String(fragment[first..<end]) == link.title else { continue }
            matches.append((first..<end, target))
        }

        matches.sort { $0.range.lowerBound < $1.range.lowerBound }
        var result = AttributedString()
        var cursor = fragment.startIndex
        for match in matches where match.range.lowerBound >= cursor {
            result += AttributedString(String(fragment[cursor..<match.range.lowerBound]))
            var linkedText = AttributedString(String(fragment[match.range]))
            linkedText.link = match.target
            result += linkedText
            cursor = match.range.upperBound
        }
        result += AttributedString(String(fragment[cursor...]))
        return result
    }

    private func readerFragment(at index: Int) -> some View {
        Text(linkedReaderFragment(at: index))
            .font(.system(size: effectiveTextSize))
            .fontWeight(effectiveStrongText ? .bold : .regular)
            .lineSpacing(CGFloat(effectiveLineSpacing) * 4)
            .frame(maxWidth: .infinity, alignment: .leading)
            // La selección de texto abre el menú de edición de iOS e impide
            // que VoiceOver presente el menú contextual de la aplicación.
            // Dejar este elemento como lectura estática con una sola acción.
            .contentShape(Rectangle())
            .accessibilityFocused($focusedFragment, equals: index)
            .accessibilityAction(named: Text("Crear marca")) {
                bookmarkFromContextMenu(at: index)
            }
            // VoiceOver convierte doble toque sostenido en una pulsación larga.
            // Ejecutar la marca directamente, sin depender de que el menú
            // contextual de SwiftUI se abra sobre un Text no interactivo.
            .onLongPressGesture(minimumDuration: 0.7) {
                bookmarkFromContextMenu(at: index)
            }
    }

    @ViewBuilder
    private var readingContent: some View {
        if presentationMode == 2 && !latest.body.isEmpty {
            NativeReaderContinuousBrailleText(
                text: latest.body,
                initialOffset: max(0, min(latest.body.count, readingOffset)),
                textSize: effectiveTextSize,
                strongText: effectiveStrongText,
                onPositionChange: { offset in
                    guard !speech.isPlaying else { return }
                    readingOffset = offset
                    currentPercent = min(100, Int(Double(offset) * 100 /
                        Double(max(1, textLayout.totalCharacters))))
                    // Braille panning can generate many selection updates. Coalesce
                    // persistence like manual VoiceOver navigation instead of
                    // rewriting the complete library after every movement.
                    scheduleManualPositionSave()
                }
            )
            .accessibilityFocused($continuousBrailleFocused)
            .task {
                guard brailleFocusText, !speech.isPlaying else { return }
                await Task.yield()
                continuousBrailleFocused = true
            }
        } else {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 12) {
                    if isAudioOnly {
                        Text("Audiolibro, \(tracks.count) pistas. Pista \(trackIndex + 1).")
                    }
                    ForEach(textLayout.fragments.indices, id: \.self) { index in
                        readerFragment(at: index).id(index)
                    }
                    if let actionMessage {
                        Text(actionMessage)
                            .font(.footnote)
                            .accessibilityAddTraits(.updatesFrequently)
                    }
                }
                .padding()
            }
            .onChange(of: navigationScrollTarget) { _, index in
                guard let index, textLayout.fragmentStarts.indices.contains(index) else { return }
                proxy.scrollTo(index, anchor: .center)
            }
            .onChange(of: focusedFragment) { _, index in
                guard let index, textLayout.fragmentStarts.indices.contains(index) else { return }
                lastReaderFragment = index
                if programmaticFocusRequest {
                    // Recentrar exclusivamente al ordenar avanzar o retroceder.
                    proxy.scrollTo(index, anchor: .center)
                    programmaticFocusRequest = false
                } else if !speech.isPlaying {
                    // Lectura visual o con VoiceOver: guardar dónde está el lector,
                    // sin iniciar voz ni mover el foco por nuestra cuenta.
                    readingOffset = textLayout.fragmentStarts[index]
                    currentPercent = min(100, Int(Double(readingOffset) * 100 /
                        Double(max(1, textLayout.totalCharacters))))
                    // Braille/manual reading is a real reading position too.
                    // Debounce full-library writes while navigating rapidly.
                    scheduleManualPositionSave()
                }
            }
            .task {
                await Task.yield()
                restoreManualReadingFocus(using: proxy)
            }
        }
        }
    }

    @ViewBuilder
    private var translatedReadingContent: some View {
        if #available(iOS 18.0, *) {
            readingContent.translationPresentation(
                isPresented: $showTranslation, text: excerpt
            )
        } else {
            readingContent
        }
    }

    private func shareCurrentDocument() {
        if library.originalURL(for: document) != nil {
            do {
                NativeShare.present(url: try library.shareableOriginalURL(for: document))
            } catch {
                actionMessage = MusicLocalized.format("No se pudo compartir: %@", error.localizedDescription)
            }
        } else if tracks.count > 1 {
            do {
                NativeShare.present(url: try library.exportAudioTracks(document))
            } catch {
                actionMessage = MusicLocalized.format("No se pudo compartir: %@", error.localizedDescription)
            }
        } else if tracks.count == 1, let track = tracks.first,
                  let url = NativeReaderFormats.storedURL(for: track) {
            NativeShare.present(url: url)
        } else if !latest.body.isEmpty {
            exportText()
        } else {
            actionMessage = MusicLocalized.message("No hay un archivo disponible para compartir.")
        }
    }

    @ViewBuilder
    private var documentActions: some View {
        Button("Información de la obra") { showDocumentInformation = true }
        if !latest.body.isEmpty {
            if let positionBeforeSearch {
                Button("Volver a la posición anterior a la búsqueda") {
                    jump(to: positionBeforeSearch)
                    self.positionBeforeSearch = nil
                }
            }
        }
        if !latest.body.isEmpty || !(latest.daisyNavigation ?? []).isEmpty {
            Button("Índice y navegación estructurada") { showStructure = true }
        }
        Button(latest.isFavorite == true ? "Quitar de favoritos" : "Añadir a favoritos") {
            library.toggleFavorite(document)
        }
        if library.originalURL(for: document) != nil {
            if latest.fileExtension?.lowercased() == "daisy" {
                Button("Compartir DAISY original") {
                    shareCurrentDocument()
                }
            } else {
                Button("Compartir documento original") { shareCurrentDocument() }
            }
        }
        if !latest.body.isEmpty {
            Button("Exportar texto") { exportText() }
            Button("Seleccionar y copiar texto") { showTextSelection = true }
            Button("Convertir texto a MP3 o DAISY con voz") { showAudioExport = true }
            Button("Diccionario y pronunciación") {
                if speech.isPlaying { pausePlayback() }
                showWordTools = true
            }
            if #available(iOS 18.0, *) {
                Button("Traducir fragmento actual") { showTranslation = true }
            }
        }
        // Repackage existing MP3 without generating or re-encoding audio.
        // The original DAISY (if any) stays accessible via its own action.
        if !tracks.isEmpty && tracks.allSatisfy({
            NativeReaderFormats.storedURL(for: $0)?.pathExtension.lowercased() == "mp3"
        }) {
            Button("Audiolibro para Voice Dream (ZIP de MP3)") {
                do {
                    NativeShare.present(url: try library.exportVoiceDreamMP3(document))
                } catch {
                    actionMessage = MusicLocalized.format(
                        "No se pudo exportar el ZIP de MP3: %@", error.localizedDescription)
                }
            }
        }
        // Extract audio without recoding it. A single-track DAISY also gets
        // this distinct action; its original navigable archive remains separate.
        if tracks.count == 1, latest.fileExtension?.lowercased() != "daisy",
           let track = tracks.first, let url = NativeReaderFormats.storedURL(for: track) {
            Button("Compartir archivo de audio") { NativeShare.present(url: url) }
        } else if !tracks.isEmpty {
            Button("Exportar audio existente (pistas en ZIP)") {
                do {
                    NativeShare.present(url: try library.exportAudioTracks(document))
                } catch {
                    actionMessage = MusicLocalized.format(
                        "No se pudieron compartir todas las pistas: %@", error.localizedDescription)
                }
            }
        }
        Button("Cancelar", role: .cancel) {}
    }

    private var bookmarksSheetContent: some View {
            NavigationStack {
                List {
                    if !latest.hasBookmarks {
                        Text("Esta obra todavía no tiene marcas.")
                    }
                    ForEach(latest.savedTextBookmarks) { mark in
                        Button(bookmarkDescription(atOffset: mark.offset)) {
                            jump(to: mark.offset)
                            showSavedMarks = false
                        }
                        .accessibilityAction(named: Text("Eliminar esta marca")) {
                            library.removeTextBookmark(document, offset: mark.offset)
                        }
                    }
                    ForEach(latest.bookmarks, id: \.self) { percent in
                        Button(bookmarkDescription(at: percent)) {
                            move(to: percent)
                            showSavedMarks = false
                        }
                        .accessibilityAction(named: Text("Eliminar esta marca")) {
                            library.removeBookmark(document, at: percent)
                        }
                    }
                    ForEach(latest.savedAudioBookmarks, id: \.self) { mark in
                        Button("Ir a pista \(mark.track + 1), \(mark.percent) por ciento") {
                            trackIndex = mark.track
                            currentPercent = mark.percent
                            didRestoreAudioPosition = true
                            readingOffset = 0
                            playTrack()
                            if speech.hasAudio, let seconds = mark.seconds {
                                speech.seek(toSeconds: seconds)
                                currentPercent = speech.audioPercent
                            }
                            persistPosition()
                            applySleepTimer()
                            showSavedMarks = false
                        }
                        .accessibilityAction(named: Text("Eliminar esta marca")) {
                            library.removeAudioBookmark(document, mark: mark)
                        }
                    }
                }
                .tifloScreenSurface()
                .navigationTitle("Marcas guardadas")
                .toolbar { Button("Cerrar") { showSavedMarks = false } }
            }
    }

    private var structureSheetContent: some View {
            NavigationStack {
                List {
                    if !tracks.isEmpty, let points = latest.daisyNavigation, !points.isEmpty {
                        Section("Navegación DAISY") {
                            ForEach(points) { point in
                                Button(point.kind == "Página" ? "Página. \(NativeReaderHeadingDisplay.title(point.title))" :
                                       point.kind == "Referencia" ? "Referencia. \(NativeReaderHeadingDisplay.title(point.title))" :
                                       "Nivel \(point.level). \(NativeReaderHeadingDisplay.title(point.title))") {
                                    jumpToDaisy(point)
                                }
                            }
                        }
                    }
                    Section("Encabezados") {
                        if textLayout.namedHeadings.isEmpty {
                            Text("No se han identificado encabezados en este documento.")
                        }
                        ForEach(textLayout.namedHeadings) { point in
                            Button(point.title) { jump(to: point.offset); showStructure = false }
                        }
                    }
                    Section(textLayout.hasRealPages ? "Páginas, diapositivas y hojas" : "Bloques de lectura") {
                        if textLayout.namedPages.isEmpty {
                            Text("No hay divisiones reconocibles en este documento.")
                        }
                        ForEach(textLayout.namedPages) { point in
                            Button(point.title) { jump(to: point.offset); showStructure = false }
                        }
                    }
                }
                .tifloScreenSurface()
                .navigationTitle("Índice de la obra")
                .toolbar { Button("Cerrar") { showStructure = false } }
            }
    }

    private var readerChrome: some View {
        VStack(spacing: 0) {
            quickControls
            Divider().accessibilityHidden(true)
            readerFooterControls
            translatedReadingContent
        }
        .tifloScreenSurface()
        .navigationTitle(document.title)
        .navigationBarTitleDisplayMode(.inline)

        .toolbar {
            ToolbarItem(placement: .principal) {
                Text(document.title)
                    .font(.headline)
                    .lineLimit(1)
                    .accessibilityAddTraits(.isHeader)
                    .accessibilityAction(named: Text("Convertir a audio o DAISY")) {
                        showAudioExport = true
                    }
                    .accessibilityAction(named: Text("Compartir")) {
                        shareCurrentDocument()
                    }
            }
            ToolbarItem(placement: .topBarTrailing) {
                Button("Acciones") { showDocumentActions = true }
                    .accessibilityHint("Marcas, favoritos, traducción, exportación y navegación.")
            }
        }
        .sheet(isPresented: $showAudioExport) { audioExportSheet }
        .alert("Conversión completada. Archivo guardado en la biblioteca",
               isPresented: $showExportCompleted) {
            Button("Compartir") {
                if let savedExportURL { NativeShare.present(url: savedExportURL) }
            }
            Button("No compartir y volver a la biblioteca", role: .cancel) {
                savedExportURL = nil
                persistPosition()
                dismiss()
            }
        } message: {
            Text("El archivo MP3 o DAISY permanece en la biblioteca. Puedes compartirlo también más adelante.")
        }
        .confirmationDialog("Acciones del documento",
                            isPresented: $showDocumentActions,
                            titleVisibility: .visible) {
            documentActions
        }
    }

    private var readerWithSheets: some View {
        readerChrome
        .sheet(isPresented: $showDocumentInformation) {
            NavigationStack {
                List {
                    LabeledContent("Título", value: latest.title)
                    LabeledContent("Formato", value: latest.formatLabel)
                    LabeledContent("Importado", value:
                        latest.importedAt.formatted(date: .abbreviated, time: .shortened))
                    LabeledContent("Carpeta", value: latest.folderName ?? "Sin carpeta")
                    LabeledContent("Marcas", value: "\(latest.bookmarks.count + latest.savedTextBookmarks.count + latest.savedAudioBookmarks.count)")
                    if !latest.body.isEmpty {
                        LabeledContent("Palabras", value: "\(wordCount)")
                        if textLayout.hasRealPages {
                            LabeledContent("Páginas identificadas", value: "\(textLayout.namedPages.count)")
                        }
                    }
                    Text(progressDescription)
                    if !tracks.isEmpty {
                        LabeledContent("Pistas de audio", value: "\(tracks.count)")
                    }
                }
                .tifloScreenSurface()
                .navigationTitle("Información de la obra")
                .toolbar { Button("Cerrar") { showDocumentInformation = false } }
            }
        }
        .sheet(isPresented: $showSavedMarks) { bookmarksSheetContent }
        .sheet(isPresented: $showDocumentSearch) { documentSearchSheetContent }
        .sheet(isPresented: $showTextSelection) {
            NavigationStack {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Selecciona el texto que necesites con VoiceOver. Después utiliza el botón Copiar texto seleccionado.")
                        .font(.footnote)
                    NativeReaderSelectableText(
                        text: latest.body,
                        requestedOffset: readingOffset,
                        selectedText: $selectedTextToCopy
                    )
                    Button("Copiar texto seleccionado") {
                        guard !selectedTextToCopy.isEmpty else { return }
                        UIPasteboard.general.string = selectedTextToCopy
                        selectionCopyMessage = MusicLocalized.message("Texto seleccionado copiado.")
                        UIAccessibility.post(notification: .announcement, argument: selectionCopyMessage)
                    }
                    .disabled(selectedTextToCopy.isEmpty)
                    .buttonStyle(.borderedProminent)
                    if !selectionCopyMessage.isEmpty {
                        Text(selectionCopyMessage)
                            .font(.footnote)
                    }
                }
                .padding(.horizontal, 14)
                .tifloScreenSurface()
                .navigationTitle("Seleccionar y copiar texto")
                .toolbar { Button("Cerrar") { showTextSelection = false } }
                .onAppear {
                    selectedTextToCopy = ""
                    selectionCopyMessage = ""
                }
            }
        }
        .sheet(isPresented: $showStructure) { structureSheetContent }
        .sheet(isPresented: $showWordTools) {
            NativeReaderWordToolsScreen(voiceIdentifier: effectiveVoiceID, pitch: pitch)
        }
        .sheet(isPresented: $showAudioSettings) {
            NativeReaderDocumentAudioSettingsScreen(document: document)
        }
        .sheet(isPresented: $showVisualSettings) {
            NativeReaderDocumentVisualSettingsScreen(document: document)
        }
    }

    var body: some View {
        readerWithSheets
        .onAppear {
            readerIsVisible = true
            registerRemotePlaybackCommands()
            if startWithConversion { showAudioExport = true }
            let initial: Int
            if tracks.isEmpty && startPercent == nil, let offset = latest.lastTextOffset {
                initial = NativeReaderProgress.textPercent(
                    length: textLayout.totalCharacters, offset: offset)
            } else {
                initial = max(0, min(100, startPercent ?? latest.lastPercent ?? 0))
            }
            trackIndex = min(max(0, startTrack ?? latest.lastTrackIndex ?? 0),
                             max(0, tracks.count - 1))
            currentPercent = initial
            readingOffset = tracks.isEmpty
                ? max(0, min(textLayout.totalCharacters,
                    startPercent == nil ? (latest.lastTextOffset
                        ?? Int(Double(textLayout.totalCharacters) * Double(initial) / 100)) :
                    Int(Double(textLayout.totalCharacters) * Double(initial) / 100)))
                : Int(Double(textLayout.totalCharacters) * Double(initial) / 100)
            lastSavedPercent = initial
            if !navigationOptions.contains(where: { $0.unit == navigationUnit }),
               let available = navigationOptions.first {
                navigationUnit = available.unit
                navigationFeedback = MusicLocalized.format(
                    "Modo anterior no disponible. Modo de navegación: %@",
                    MusicLocalized.message(available.label))
            }
            // The live reader owns the current cursor, not a stale saved position.
            // Shortcuts invokes this directly; no stop, seek or navigation occurs.
            NativeQuickBookmarkBridge.saveActiveReader = { addBookmark() }
            NativeReaderPlaybackBridge.pauseActiveReader = { if speech.isPlaying { pausePlayback() } }
            if !didApplyOpeningMode {
                didApplyOpeningMode = true
                if presentationMode == 0 && readingMode == 1 {
                    // Navigation and the last-opened catalog update may still be
                    // settling. Request focus only after the reader is visible.
                    Task { @MainActor in
                        do { try await Task.sleep(for: .milliseconds(300)) }
                        catch { return }
                        guard !Task.isCancelled, readerIsVisible,
                              presentationMode == 0 && readingMode == 1 else { return }
                        playbackButtonFocused = true
                    }
                }
            }
        }
        .onChange(of: sleepIndex) { _, _ in
            applySleepTimer(reset: true)
        }
        .onReceive(library.$documents) { _ in
            // @Published emits before the stored document is replaced.
            Task { @MainActor in refreshLiveReadingSettings() }
        }
        .onReceive(NotificationCenter.default.publisher(for: UserDefaults.didChangeNotification)) { _ in
            refreshLiveReadingSettings()
        }
        .onReceive(speech.$textPercent) { percentage in
            // AVSpeechSynthesizer reports each spoken word; no artificial timer
            // advances the text cursor while paused or reading visually.
            guard (!speech.hasAudio || speech.isGeneratedSpeech), speech.isPlaying else { return }
            if percentage != currentPercent {
                currentPercent = percentage
                if abs(percentage - lastSavedPercent) >= 5 { persistPosition() }
            }
        }
        .onReceive(speech.$textCharacterOffset) { offset in
            guard (!speech.hasAudio || speech.isGeneratedSpeech) else { return }
            let clamped = max(0, min(textLayout.totalCharacters, offset))
            // The last AVSpeechSynthesizer callback may arrive after isPlaying
            // became false. Save real completion rather than a stale 99%.
            guard speech.isPlaying || speech.isPaused ||
                  (clamped == textLayout.totalCharacters &&
                   textLayout.totalCharacters > 0) else { return }
            readingOffset = clamped
            if clamped == textLayout.totalCharacters {
                currentPercent = NativeReaderProgress.textPercent(
                    length: textLayout.totalCharacters, offset: clamped)
                persistPosition()
            } else if speech.isPaused { persistPosition() }
        }
        .onReceive(NotificationCenter.default.publisher(for: AVAudioSession.interruptionNotification)) { notification in
            handleAudioInterruption(notification)
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .background {
                // Locking the screen saves a checkpoint; it must NOT stop
                // TTS, deactivate the audio session or release remote control.
                delayedManualPositionSave?.cancel()
                checkpointLiveTextPosition()
                persistPosition()
            }
        }
        .onReceive(Timer.publish(every: 1, on: .main, in: .common).autoconnect()) { _ in
            speech.refresh()
            if speech.isPlaying {
                playbackTick += 1
                if !speech.hasAudio || speech.isGeneratedSpeech { elapsedSpeakingSeconds += 1 }
            }
            if speech.hasAudio && !speech.isGeneratedSpeech {
                let updated = speech.audioPercent
                if updated != currentPercent { currentPercent = updated }
                if abs(updated - lastSavedPercent) >= 5 { persistPosition() }
            }
        }
        .onDisappear {
            readerIsVisible = false
            delayedManualPositionSave?.cancel()
            unregisterRemotePlaybackCommands()
            NativeRemotePlaybackOwner.release(.reader)
            NativeQuickBookmarkBridge.saveActiveReader = nil
            NativeReaderPlaybackBridge.pauseActiveReader = nil
            // Save the live synthesizer checkpoint even if @Published has not
            // delivered its last update; then release playback resources.
            checkpointLiveTextPosition()
            persistPosition()
            speech.onSleepExpired = nil
            speech.stop()
        }
        .accessibilityAction(.magicTap) { toggleReaderPlayback() }
        .accessibilityAction(named: Text("Añadir marca")) { addBookmarkFromReaderSelection() }
        .accessibilityAction(named: Text("Seleccionar y copiar texto")) {
            if !latest.body.isEmpty { showTextSelection = true }
        }
        .accessibilityAction(named: Text("Avanzar cinco por ciento")) {
            move(to: min(100, currentPercent + 5))
        }
        .accessibilityAction(named: Text("Retroceder cinco por ciento")) {
            move(to: max(0, currentPercent - 5))
        }
    }
}
