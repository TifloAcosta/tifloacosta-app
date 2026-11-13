import SwiftUI
import PDFKit
import UIKit
import AVFoundation
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

/// New native-only documents are deliberately isolated from the current beta database.
/// No reading data is silently discarded or overwritten during the migration.
@MainActor
final class NativeReaderLibrary: ObservableObject {
    @Published private(set) var documents: [NativeReadingDocument] = []
    @Published private(set) var folders: [String] = []
    private let folderStorageKey = "native-reader-folders"

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

    func importDocuments(from urls: [URL], sharingID: UUID? = nil,
                         preferredTitle: String? = nil) throws {
        for url in urls {
            let accessed = url.startAccessingSecurityScopedResource()
            defer { if accessed { url.stopAccessingSecurityScopedResource() } }
            let identifier = sharingID ?? UUID()
            if documents.contains(where: { $0.id == identifier }) { continue }
            do {
                let payload = try NativeReaderFormats.read(url, documentID: identifier)
                let originalPath = try NativeReaderFormats.storeOriginal(url, documentID: identifier)
                documents.insert(
                    NativeReadingDocument(
                        id: identifier,
                        title: (preferredTitle?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false
                                ? preferredTitle! : url.deletingPathExtension().lastPathComponent),
                        body: payload.body,
                        importedAt: .now,
                        fileExtension: payload.fileExtension,
                        originalRelativePath: originalPath,
                        trackPaths: payload.trackPaths,
                        daisyNavigation: payload.daisyNavigation,
                        textLinks: payload.textLinks
                    ), at: 0
                )
                try save()
            } catch {
                NativeReaderFormats.deleteStoredFiles(for: identifier)
                NativeReaderFormats.deleteOriginal(for: identifier)
                throw error
            }
        }
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

    /// Exporta todas las pistas de una obra sin confundir un ZIP de audio con DAISY.
    func exportAudioTracks(_ document: NativeReadingDocument) throws -> URL {
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
            guard ["mp3", "m4a", "m4b", "aac", "wav", "aif", "aiff", "caf"].contains(ext) else {
                throw NativeReaderFormatError.invalidArchive
            }
            let filename = String(format: "Pista-%04d", index + 1) + "." + ext
            try manager.copyItem(at: source, to: staging.appendingPathComponent(filename))
        }

        let title = current.title.replacingOccurrences(
            of: #"[\\/:*?"<>|\x00-\x1F]"#, with: "_", options: .regularExpression
        ).trimmingCharacters(in: .whitespacesAndNewlines)
        let safeTitle = title.isEmpty ? "Audio" : title
        let outputDirectory = temp.appendingPathComponent(UUID().uuidString, isDirectory: true)
        try manager.createDirectory(at: outputDirectory, withIntermediateDirectories: true)
        let output = outputDirectory.appendingPathComponent(safeTitle + "-pistas.zip")
        try manager.zipItem(at: staging, to: output, shouldKeepParent: false)
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
        try encoder.encode(documents).write(to: staging.appendingPathComponent("documentos.json"), options: .atomic)
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
        guard let index = documents.firstIndex(where: { $0.id == document.id }) else { return }
        documents[index].lastOpenedAt = .now
        try? save()
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

    func addTextBookmark(_ document: NativeReadingDocument, offset: Int) {
        guard let i = documents.firstIndex(where: { $0.id == document.id }) else { return }
        let count = documents[i].body.count
        let value = max(0, min(count, offset))
        let percent = count > 0 ? Int((Double(value) * 100 / Double(count)).rounded()) : 0
        var bookmarks = documents[i].textBookmarks ?? []
        guard !bookmarks.contains(where: { $0.offset == value }) else { return }
        bookmarks.append(NativeTextBookmark(offset: value, percent: percent))
        documents[i].textBookmarks = bookmarks.sorted { $0.offset < $1.offset }
        try? save()
    }

    func removeTextBookmark(_ document: NativeReadingDocument, offset: Int) {
        guard let i = documents.firstIndex(where: { $0.id == document.id }) else { return }
        documents[i].textBookmarks?.removeAll { $0.offset == offset }
        try? save()
    }

    func addAudioBookmark(_ document: NativeReadingDocument, track: Int, percent: Int,
                          seconds: TimeInterval? = nil) {
        guard let i = documents.firstIndex(where: { $0.id == document.id }), track >= 0 else { return }
        let validSeconds = seconds.flatMap { $0.isFinite ? max(0, $0) : nil }
        let mark = NativeAudioBookmark(track: track, percent: max(0, min(100, percent)),
                                       seconds: validSeconds)
        var saved = documents[i].audioBookmarks ?? []
        guard !saved.contains(where: {
            $0.track == track &&
            (validSeconds != nil && $0.seconds != nil
                ? abs($0.seconds! - validSeconds!) < 0.5
                : $0.percent == mark.percent)
        }) else { return }
        saved.append(mark)
        documents[i].audioBookmarks = saved.sorted {
            $0.track == $1.track ? $0.percent < $1.percent : $0.track < $1.track
        }
        try? save()
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
        let percent = textLength > 0 ? Int((Double(value) * 100 / Double(textLength)).rounded()) : 0
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
        documents.first(where: { $0.id == document.id }) ?? document
    }

    private func save() throws {
        let directory = Self.storageURL.deletingLastPathComponent()
        try FileManager.default.createDirectory(
            at: directory,
            withIntermediateDirectories: true
        )
        try JSONEncoder().encode(documents).write(to: Self.storageURL, options: .atomic)
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
    private var speechDelayTask: Task<Void, Never>?
    // Al pausar texto se corta el sintetizador y se conserva el cursor para reanudar.
    private var systemSpeechNeedsRestart = false

    // Los encabezados importados de EPUB/HTML conservan # para la navegación.
    // En la voz sustituimos solo esos marcadores por espacios del mismo tamaño:
    // así ningún cursor, marca o posición de lectura cambia.
    private static func textForSpeech(_ source: String) -> String {
        guard let pattern = try? NSRegularExpression(pattern: #"(?m)^#{1,6}(?=[ \t])"#)
        else { return source }
        var result = source
        for match in pattern.matches(in: source,
                                     range: NSRange(source.startIndex..., in: source)).reversed() {
            guard let range = Range(match.range, in: result) else { continue }
            result.replaceSubrange(range, with: String(repeating: " ", count: match.range.length))
        }
        return result
    }

    private func speakNextSystemSegment(after delay: TimeInterval = 0) {
        speechDelayTask?.cancel()
        speechDelayTask = nil
        guard !isPaused, speechQueue.indices.contains(speechQueueIndex) else { return }
        if delay <= 0 {
            synthesizer.speak(speechQueue[speechQueueIndex].utterance)
            return
        }
        speechDelayTask = Task { @MainActor [weak self] in
            do { try await Task.sleep(for: .seconds(delay)) }
            catch { return }
            guard let self, !Task.isCancelled, !self.isPaused,
                  self.speechQueue.indices.contains(self.speechQueueIndex) else { return }
            self.synthesizer.speak(self.speechQueue[self.speechQueueIndex].utterance)
            self.speechDelayTask = nil
        }
    }

    init() {
        progressDelegate.onWord = { [weak self] range, utterance in
            Task { @MainActor [weak self] in
                guard let self, self.isPlaying, self.player == nil,
                      self.totalUTF16 > 0 else { return }
                // Los callbacks de una reproducción cancelada nunca deben
                // modificar la posición de la siguiente reproducción.
                guard let segmentBase = self.utteranceOffsets[ObjectIdentifier(utterance)] else {
                    return
                }
                let utf16End = max(0, min(self.spokenText.utf16.count,
                                         segmentBase + range.location + range.length))
                if utf16End >= self.previousUTF16 {
                    let lower = String.Index(utf16Offset: self.previousUTF16, in: self.spokenText)
                    let upper = String.Index(utf16Offset: utf16End, in: self.spokenText)
                    self.previousCharacterCount += self.spokenText.distance(from: lower, to: upper)
                    self.previousUTF16 = utf16End
                    self.textCharacterOffset = self.baseCharacters + self.previousCharacterCount
                }
                let count = self.baseUTF16 + utf16End
                self.textPercent = max(0, min(100,
                    Int(Double(count) * 100 / Double(self.totalUTF16))))
            }
        }
        progressDelegate.onFinish = { [weak self] utterance in
            Task { @MainActor [weak self] in
                guard let self, self.player == nil,
                      self.utteranceOffsets[ObjectIdentifier(utterance)] != nil,
                      self.speechQueue.indices.contains(self.speechQueueIndex),
                      ObjectIdentifier(self.speechQueue[self.speechQueueIndex].utterance) == ObjectIdentifier(utterance) else { return }
                let completedDelay = self.speechQueue[self.speechQueueIndex].delay
                self.speechQueueIndex += 1
                if self.lastSpeechUtterance == ObjectIdentifier(utterance) {
                    self.textCharacterOffset = self.baseCharacters + self.spokenText.count
                    self.textPercent = 100
                    self.isPlaying = false
                    self.isPaused = false
                    self.speechQueue.removeAll()
                } else if !self.isPaused {
                    self.speakNextSystemSegment(after: completedDelay)
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
        speechQueue.removeAll()
        let segments = NativeReaderPauseProfile.segments(Self.textForSpeech(text))
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
            // El retardo se programa entre frases, sin saturar la cola de AVSpeechSynthesizer.
            utterance.postUtteranceDelay = 0
            let identifier = ObjectIdentifier(utterance)
            utteranceOffsets[identifier] = utf16Offset
            lastSpeechUtterance = identifier
            utf16Offset += segment.text.utf16.count
            speechQueue.append((utterance: utterance, delay: segment.delay))
        }
        isPlaying = true
        isPaused = false
        speakNextSystemSegment()
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

    private func startAudio(_ url: URL, speed: Double, at percent: Int) throws {
        player?.stop()
        player = nil
        try AVAudioSession.sharedInstance().setCategory(.playback, mode: .spokenAudio)
        try AVAudioSession.sharedInstance().setActive(true)
        let audio = try AVAudioPlayer(contentsOf: url)
        audio.delegate = audioDelegate
        audio.enableRate = true
        audio.rate = Float(max(0.5, min(2.0, speed)))
        audio.prepareToPlay()
        audio.currentTime = audio.duration * Double(max(0, min(100, percent))) / 100
        guard audio.play() else { throw NativeReaderFormatError.unsupported(url.pathExtension) }
        player = audio
        isPlaying = true
        isPaused = false
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

    func seek(to percent: Int) {
        guard let player else { return }
        player.currentTime = player.duration * Double(max(0, min(100, percent))) / 100
    }

    func seek(toSeconds seconds: TimeInterval) {
        guard let player, seconds.isFinite else { return }
        player.currentTime = max(0, min(player.duration, seconds))
    }

    func skip(seconds: TimeInterval) {
        guard let player else { return }
        player.currentTime = max(0, min(player.duration, player.currentTime + seconds))
    }

    func pause() {
        if let player { player.pause() }
        else if isGeneratedSpeech {
            geminiGeneration += 1
            geminiTask?.cancel()
        } else {
            // Detener la salida real evita depender de que pauseSpeaking sea respetado
            // por todas las voces instaladas. El cursor queda disponible para reanudar.
            speechDelayTask?.cancel()
            speechDelayTask = nil
            systemSpeechNeedsRestart = !speechQueue.isEmpty
            _ = synthesizer.stopSpeaking(at: .immediate)
        }
        sleep(after: 0) // Al pausar no sigue corriendo la cuenta del apagado.
        isPlaying = false
        isPaused = true
    }

    func resume() {
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
        else { speakNextSystemSegment() }
        isPlaying = true
    }

    func refresh() {
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
        playlistIndex = 0
        onTrackChanged = nil
        onAudioError = nil
        synthesizer.stopSpeaking(at: .immediate)
        systemSpeechNeedsRestart = false
        speechDelayTask?.cancel()
        speechDelayTask = nil
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
    @State private var documentToTranslate: NativeReadingDocument?
    @State private var selectionMode = false
    @State private var selectedDocumentIDs: Set<UUID> = []
    @State private var showBulkMove = false
    @State private var showCreateFolderForSelection = false
    @State private var showBulkDelete = false
    @State private var selectionFeedback: String?
    @State private var shortcutMessage: String?

    @AppStorage("native-reading-folder-filter") private var selectedFolder = ""
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
        let progress = max(0, min(100, library.latest(doc).lastPercent ?? 0))
        let progressText = String(format: NativeAppLanguage.message("%d por ciento leído", languageCode: code),
                                  locale: locale, progress)
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
        case 5: items.sort { ($0.lastOpenedAt ?? .distantPast) > ($1.lastOpenedAt ?? .distantPast) }
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
                    NativeReadingScreen(document: doc, speech: speech)
                        .onAppear { library.markOpened(doc) }
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
        guard let document = library.documents.filter({ $0.lastOpenedAt != nil }).max(by: {
            ($0.lastOpenedAt ?? .distantPast) < ($1.lastOpenedAt ?? .distantPast)
        }) else {
            shortcutMessage = "Todavía no hay un libro abierto anteriormente para continuar."
            UIAccessibility.post(notification: .announcement, argument: shortcutMessage)
            return
        }
        importError = nil
        library.markOpened(document)
        play(document)
        if importError == nil {
            shortcutMessage = "Continuando \(document.title) desde la posición guardada."
            UIAccessibility.post(notification: .announcement, argument: shortcutMessage)
        }
    }

    private func play(_ document: NativeReadingDocument) {
        let latest = library.latest(document)
        let chosenSpeed = latest.readerPreferences?.speedIndex ?? speedIndex
        let speed = NativeReaderSpeedOptions.rate(for: chosenSpeed)
        let chosenPitch = latest.readerPreferences?.pitchIndex ?? pitchIndex
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
                language: AVSpeechSynthesisVoice(identifier: latest.readerPreferences?.voiceID ?? voiceID)?.language ?? "es-ES",
                voiceIdentifier: latest.readerPreferences?.voiceID ?? voiceID,
                baseUTF16: String(latest.body.prefix(offset)).utf16.count,
                totalUTF16: latest.body.utf16.count, baseCharacters: offset)
        }
    }

    var body: some View {
        List {
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
                        .accessibilityLabel("\(NativeAppLanguage.message(selectedDocumentIDs.contains(document.id) ? "Seleccionado" : "No seleccionado", languageCode: NativeAppLanguage.code(for: languageIndex))), \(documentRowLabel(document))")
                        .accessibilityHint("Doble toque para cambiar la selección de este documento.")
                    } else {
                    NavigationLink {
                        NativeReadingScreen(document: document, speech: speech)
                            .onAppear { library.markOpened(document) }
                    } label: { Text(documentRowLabel(document)) }
                    .accessibilityLabel(documentRowLabel(document))
                    .accessibilityHint("Doble toque para abrir. Hay acciones de accesibilidad.")
                    .accessibilityAction(named: Text("Reproducir")) { play(document) }
                    .accessibilityAction(named: Text("Compartir documento original")) {
                        if let url = library.originalURL(for: document) {
                            NativeShare.present(url: url)
                        } else {
                            importError = "El documento original no está disponible. Puedes exportar el texto desde el lector si existe."
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
        .onAppear { resumeRequestedBook() }
        .onDisappear { speech.stop() }
        .confirmationDialog("Importar", isPresented: $importSourcesPresented,
                            titleVisibility: .visible) {
            Button("Desde Archivos") { importPresented = true }
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
                do { try library.importDocuments(from: urls) }
                catch { importError = error.localizedDescription }
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
        .confirmationDialog("Eliminar carpeta",
                            isPresented: Binding(
                                get: { folderToDelete != nil },
                                set: { if !$0 { folderToDelete = nil } }),
                            titleVisibility: .visible) {
            Button("Eliminar la carpeta, conservar las obras", role: .destructive) {
                if let folder = folderToDelete {
                    library.deleteFolder(folder)
                    if selectedFolder == folder { selectedFolder = "" }
                }
                folderToDelete = nil
            }
            Button("Cancelar", role: .cancel) { folderToDelete = nil }
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
private struct NativeReaderNavigationPoint: Identifiable {
    let offset: Int
    let title: String
    var id: Int { offset }
}

private struct NativeReaderTextLayout {
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
        var headings: [Int] = [0]
        var chapters: [Int] = []
        var pageEntries: [NativeReaderNavigationPoint] = []
        var headingEntries: [NativeReaderNavigationPoint] = []
        var lineOffset = 0
        for line in body.components(separatedBy: "\n") {
            let normalized = line.trimmingCharacters(in: .whitespaces).lowercased()
            if normalized.range(of: #"^(página|pagina|diapositiva|hoja)\s+[0-9]+"#,
                                options: .regularExpression) != nil {
                pages.append(lineOffset)
                headings.append(lineOffset)
                pageEntries.append(.init(offset: lineOffset, title: line.trimmingCharacters(in: .whitespaces)))
            } else if normalized.range(
                of: #"^(#{1,6}\s+|capítulo\s+|capitulo\s+|sección\s+|seccion\s+)"#,
                options: .regularExpression) != nil {
                headings.append(lineOffset)
                headingEntries.append(.init(offset: lineOffset,
                    title: line.trimmingCharacters(in: .whitespaces)))
                if normalized.range(of: #"^(capítulo\s+|capitulo\s+|#{1,2}\s+)"#,
                                    options: .regularExpression) != nil {
                    chapters.append(lineOffset)
                }
            }
            lineOffset += line.count + 1
        }
        // Sin marcas de página explícitas, los fragmentos hacen de páginas virtuales.
        pageStarts = Array(Set((pages.count > 1 ? pages : offsets) + [0, totalCharacters])).sorted()
        headingStarts = headings.count > 1 ? Array(Set(headings)).sorted() : []
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
            ? boundaries.first(where: { $0 > offset })
            : boundaries.last(where: { $0 < offset })
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

struct NativeReadingScreen: View {
    let document: NativeReadingDocument
    @ObservedObject var speech: NativeReadingSpeech
    @AppStorage("native-ios-language") private var languageIndex = 0
    var startPercent: Int? = nil
    var startTrack: Int? = nil

    @EnvironmentObject private var library: NativeReaderLibrary
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @AppStorage("native-reading-text-size") private var textSize = 20.0
    @AppStorage("native-reading-speed-index") private var speedIndex = 2
    @AppStorage("native-reading-pitch-index") private var pitchIndex = 2
    @AppStorage("native-reading-voice-id") private var voiceID = ""
    @AppStorage("native-reading-line-spacing-index") private var lineSpacingIndex = 0
    @AppStorage("native-reading-strong-text") private var strongText = false
    @AppStorage("native-reader-navigation-unit") private var navigationUnit = 0
    @AppStorage("native-reader-time-step-index") private var timeStepIndex = 1
    @AppStorage("native-reader-reading-mode") private var readingMode = 0
    @AppStorage("native-reader-reading-engine") private var readingEngine = 0
    @AppStorage("native-reader-gemini-voice") private var geminiVoice = "Kore"
    @AppStorage("native-reader-phonon-voice") private var phononVoice = ""
    @State private var didApplyOpeningMode = false
    @State private var sleepIndex = 0 // Each open document starts with timer disabled.
    @State private var sleepDeadline: Date?
    @State private var currentPercent = 0
    @State private var readingOffset = 0
    @State private var lastSavedPercent = -1
    @State private var trackIndex = 0
    @State private var didRestoreAudioPosition = false
    @State private var elapsedSpeakingSeconds = 0
    @State private var playbackTick = 0
    @State private var showTranslation = false
    @State private var showStructure = false
    @State private var showWordTools = false
    @State private var showAudioSettings = false
    @State private var showVisualSettings = false
    @State private var showAudioExport = false
    @State private var audioExportBusy = false
    @State private var audioExportProgress = ""
    @State private var audioExportTask: Task<Void, Never>?
    @State private var audioExportFormat: NativeGeminiAudioExport.Format = .mp3
    @State private var audioExportLanguage = "es"
    @State private var audioExportEngine: NativeGeminiAudioExport.Engine = .system
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
    @State private var actionMessage: String?
    @AccessibilityFocusState private var focusedFragment: Int?
    @State private var lastReaderFragment: Int?

    private let textLayout: NativeReaderTextLayout
    private let wordCount: Int
    private static let percentages = (0...100).map { "\($0) por ciento" }
    private static let timeStepChoices = ["30 segundos", "1 minuto", "2 minutos", "5 minutos"]
    private static let timeStepSeconds = [30, 60, 120, 300]
    private var timeStep: Int {
        Self.timeStepSeconds[max(0, min(Self.timeStepSeconds.count - 1, timeStepIndex))]
    }
    private static let sleepChoices = [
        "Desactivado", "5 minutos", "10 minutos", "15 minutos",
        "30 minutos", "45 minutos", "60 minutos"
    ]
     private let sleepMinutes: [Int] = [0, 5, 10, 15, 30, 45, 60]

    init(document: NativeReadingDocument, speech: NativeReadingSpeech,
         startPercent: Int? = nil, startTrack: Int? = nil) {
        self.document = document
        self.speech = speech
        self.startPercent = startPercent
        self.startTrack = startTrack
        self.textLayout = NativeReaderTextLayout(document.body)
        self.wordCount = document.body.split(whereSeparator: \.isWhitespace).count
    }

    private var latest: NativeReadingDocument { library.latest(document) }
    private var tracks: [String] { latest.trackPaths ?? [] }
    private var effectiveSpeedIndex: Int { latest.readerPreferences?.speedIndex ?? speedIndex }
    private var effectivePitchIndex: Int { latest.readerPreferences?.pitchIndex ?? pitchIndex }
    private var pitch: Float { [0.8, 0.9, 1.0, 1.1, 1.2][max(0, min(4, effectivePitchIndex))] }
    private var effectiveVoiceID: String { latest.readerPreferences?.voiceID ?? voiceID }
    private var effectiveTextSize: Double { latest.readerPreferences?.textSize ?? textSize }
    private var effectiveLineSpacing: Int { latest.readerPreferences?.lineSpacingIndex ?? lineSpacingIndex }
    private var effectiveStrongText: Bool { latest.readerPreferences?.strongText ?? strongText }
    private var speed: Double { NativeReaderSpeedOptions.rate(for: effectiveSpeedIndex) }
    private var effectiveReadingEngine: Int { latest.readerPreferences?.readingEngineIndex ?? readingEngine }
    private var effectiveGeminiVoice: String { latest.readerPreferences?.geminiVoiceID ?? geminiVoice }
    private var effectivePhononVoice: String { latest.readerPreferences?.phononVoiceID ?? phononVoice }
    private var isAudioOnly: Bool { latest.body.isEmpty && !tracks.isEmpty }
    private var navigationOptions: [(unit: Int, label: String)] {
        var options: [(unit: Int, label: String)] = []
        if !latest.body.isEmpty {
            options += [(0, "Bloque"), (1, "Párrafo"), (2, "Frase"), (3, "Página")]
            if !textLayout.headingStarts.isEmpty { options.append((4, "Encabezado")) }
        }
        if !tracks.isEmpty {
            if (latest.daisyNavigation ?? []).contains(where: { $0.kind == "Página" }) {
                options.append((9, "Página DAISY"))
            }
            if (latest.daisyNavigation ?? []).contains(where: { $0.kind == "Referencia" }) {
                options.append((10, "Referencia DAISY"))
            }
        }
        if !tracks.isEmpty || !latest.body.isEmpty { options.append((5, "Tiempo")) }
        if latest.hasBookmarks { options.append((6, "Marcas")) }
        if !textLayout.linkStarts.isEmpty || !(latest.textLinks ?? []).isEmpty {
            options.append((8, "Enlaces"))
        }
        if !textLayout.chapterStarts.isEmpty ||
            (latest.daisyNavigation ?? []).contains(where: { $0.kind != "Página" && $0.kind != "Referencia" }) {
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
            }
        )
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
                                      seconds: speech.hasAudio ? speech.audioElapsed : nil)
        }
        lastSavedPercent = currentPercent
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
                actionMessage = "Configura la clave Gemini en Motores externos."
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
                actionMessage = "Generando el primer fragmento con Gemini. La reproducción comenzará cuando Google devuelva el audio."
            } catch { actionMessage = error.localizedDescription }
        } else if effectiveReadingEngine == 2 {
            guard NativePhononRuntime.isUsable else {
                actionMessage = "Instala el motor y modelo Phonon en Motores externos."
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
        if speech.isPaused {
            speech.resume()
        } else if !tracks.isEmpty {
            playTrack()
            if !didRestoreAudioPosition {
                restoreAudioPosition()
                didRestoreAudioPosition = true
            }
        } else {
            startTextSpeech()
        }
        applySleepTimer()
    }

    private func applySleepTimer(reset: Bool = false) {
        let index = max(0, min(sleepMinutes.count - 1, sleepIndex))
        let minutes = sleepMinutes[index]
        guard speech.isPlaying, minutes > 0 else {
            sleepDeadline = nil
            speech.sleep(after: 0)
            return
        }
        speech.onSleepExpired = { persistPosition() }
        if reset || sleepDeadline == nil {
            sleepDeadline = Date().addingTimeInterval(TimeInterval(minutes * 60))
        }
        let seconds = max(0, sleepDeadline!.timeIntervalSinceNow)
        if seconds == 0 {
            stopPlayback()
            actionMessage = "Apagado automático completado."
        } else {
            speech.sleep(afterSeconds: seconds)
        }
    }

    private func playTrack() {
        guard tracks.indices.contains(trackIndex),
              NativeReaderFormats.storedURL(for: tracks[trackIndex]) != nil else {
            actionMessage = "No se encuentra la pista de audio."
            return
        }
        let urls = tracks.compactMap { NativeReaderFormats.storedURL(for: $0) }
        guard urls.count == tracks.count else {
            actionMessage = "Faltan archivos de audio de esta obra."
            return
        }
        do {
            try speech.playPlaylist(urls, speed: speed, track: trackIndex, at: currentPercent,
                onTrackChanged: { next in
                    trackIndex = next
                    currentPercent = 0
                    persistPosition()
                    applySleepTimer()
                },
                onError: { error in actionMessage = "No se pudo reproducir: " + error })
            actionMessage = nil
        } catch {
            actionMessage = "No se pudo reproducir: \(error.localizedDescription)"
        }
    }

    private func restoreAudioPosition() {
        guard speech.hasAudio, trackIndex == (latest.lastTrackIndex ?? 0),
              let seconds = latest.lastAudioSeconds else { return }
        speech.seek(toSeconds: seconds)
        currentPercent = speech.audioPercent
        persistPosition()
    }

    private func jumpToDaisy(_ point: NativeDaisyNavigationPoint) {
        guard tracks.indices.contains(point.track) else {
            actionMessage = "La pista indicada no está disponible."
            return
        }
        trackIndex = point.track
        currentPercent = 0
        didRestoreAudioPosition = true
        playTrack()
        if speech.hasAudio, let seconds = point.seconds {
            speech.seek(toSeconds: seconds)
            currentPercent = speech.audioPercent
        }
        persistPosition()
        applySleepTimer()
        showStructure = false
    }

    private func pausePlayback() {
        speech.pause()
        sleepDeadline = nil
        persistPosition()
    }

    private func stopPlayback() {
        // Save the exact audio time before stop() discards the AVAudioPlayer.
        persistPosition()
        speech.stop()
        sleepDeadline = nil
    }

    private func changeTrack(_ delta: Int) {
        guard tracks.indices.contains(trackIndex + delta) else { return }
        persistPosition()
        trackIndex += delta
        didRestoreAudioPosition = true
        move(to: 0)
        playTrack()
        applySleepTimer()
    }

    private func jump(to offset: Int) {
        readingOffset = max(0, min(textLayout.totalCharacters, offset))
        let ratio = Double(readingOffset) / Double(max(1, textLayout.totalCharacters))
        currentPercent = min(100, Int((ratio * 100).rounded()))
        persistPosition()
        let index = textLayout.fragmentIndex(for: readingOffset)
        programmaticFocusRequest = true
        focusedFragment = index
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
            actionMessage = "Selecciona Enlaces en Modo de navegación."
            return
        }
        guard let link = latest.textLinks?.first(where: { $0.offset == readingOffset }) else {
            actionMessage = "No hay un enlace estructurado en esta posición."
            return
        }
        if let target = link.targetOffset {
            jump(to: target)
            actionMessage = "Destino: \(link.title)"
        } else if let url = URL(string: link.url),
                  ["https", "http"].contains(url.scheme?.lowercased() ?? ""),
                  url.host != nil {
            UIApplication.shared.open(url)
        } else {
            actionMessage = "Este enlace no tiene un destino disponible."
        }
    }

    private func moveUnit(_ direction: Int) {
        let unit = effectiveNavigationUnit
        if unit == 9 || unit == 10 {
            moveDaisyPoint(direction, kind: unit == 9 ? "Página" : "Referencia")
            return
        }
        if unit == 8 {
            let offsets = Array(Set(textLayout.linkStarts +
                                    (latest.textLinks ?? []).map { $0.offset })).sorted()
            let next = direction > 0
                ? offsets.first(where: { $0 > readingOffset })
                : offsets.last(where: { $0 < readingOffset })
            guard let next else {
                actionMessage = "No hay más enlaces en esa dirección."
                return
            }
            jump(to: next)
            if let link = latest.textLinks?.first(where: { $0.offset == next }) {
                actionMessage = "Enlace: \(link.title)"
            }
            return
        }
        if unit == 7 && !tracks.isEmpty {
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
        guard !document.body.isEmpty,
              let next = textLayout.nearbyOffset(readingOffset,
                                                  direction: direction, unit: unit)
        else { return }
        jump(to: next)
    }

    private func moveDaisyPoint(_ direction: Int, kind: String?) {
        let points = (latest.daisyNavigation ?? []).filter { point in
            if let kind { return point.kind == kind }
            return point.kind != "Página" && point.kind != "Referencia"
        }.sorted {
            $0.track == $1.track ? ($0.seconds ?? 0) < ($1.seconds ?? 0) : $0.track < $1.track
        }
        let currentTime = speech.hasAudio ? speech.audioElapsed : (latest.lastAudioSeconds ?? 0)
        let candidates = points.filter { point in
            if point.track != trackIndex {
                return direction > 0 ? point.track > trackIndex : point.track < trackIndex
            }
            let seconds = point.seconds ?? 0
            return direction > 0 ? seconds > currentTime + 0.5 : seconds < currentTime - 0.5
        }
        guard let point = direction > 0 ? candidates.first : candidates.last else {
            actionMessage = "No hay más elementos de ese tipo en esa dirección."
            return
        }
        jumpToDaisy(point)
        actionMessage = point.title
    }

    private func moveBetweenMarks(_ direction: Int) {
        if !tracks.isEmpty {
            let marks = latest.savedAudioBookmarks.sorted {
                $0.track == $1.track
                    ? ($0.seconds ?? Double($0.percent)) < ($1.seconds ?? Double($1.percent))
                    : $0.track < $1.track
            }
            let candidates = marks.filter { mark in
                if mark.track != trackIndex {
                    return direction > 0 ? mark.track > trackIndex : mark.track < trackIndex
                }
                if let seconds = mark.seconds, speech.hasAudio {
                    return direction > 0 ? seconds > speech.audioElapsed + 0.5
                        : seconds < speech.audioElapsed - 0.5
                }
                return direction > 0 ? mark.percent > currentPercent
                    : mark.percent < currentPercent
            }
            guard let mark = direction > 0 ? candidates.first : candidates.last else {
                actionMessage = "No hay más marcas en esa dirección."
                return
            }
            trackIndex = mark.track
            currentPercent = mark.percent
            didRestoreAudioPosition = true
            playTrack()
            if speech.hasAudio, let seconds = mark.seconds {
                speech.seek(toSeconds: seconds)
                currentPercent = speech.audioPercent
            }
            persistPosition()
            applySleepTimer()
        } else {
            let offsets = Set(latest.savedTextBookmarks.map(\.offset)
                + latest.bookmarks.map {
                    Int(Double(textLayout.totalCharacters) * Double($0) / 100.0)
                }).sorted()
            let next = direction > 0
                ? offsets.first(where: { $0 > readingOffset })
                : offsets.last(where: { $0 < readingOffset })
            guard let next else {
                actionMessage = "No hay más marcas en esa dirección."
                return
            }
            jump(to: next)
        }
    }

    // Quitar de las etiquetas de marcas los prefijos Markdown de EPUB.
    // Las posiciones y el documento original permanecen intactos.
    private func spokenBookmarkExcerpt(_ source: String) -> String {
        source.replacingOccurrences(
            of: #"^#{1,6}\s+"#,
            with: "",
            options: .regularExpression
        )
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
        if speech.hasAudio && !speech.isGeneratedSpeech {
            speech.skip(seconds: TimeInterval(direction * timeStep))
            currentPercent = speech.audioPercent
            persistPosition()
            actionMessage = "Posición: \(currentPercent) por ciento."
        } else {
            guard !document.body.isEmpty else { return }
            let charactersPerMinute = Double(textLayout.totalCharacters) /
                Double(max(1, wordCount)) * 165.0 * speed
            let offset = readingOffset + direction * max(1,
                Int(charactersPerMinute * Double(timeStep) / 60.0))
            jump(to: offset)
            actionMessage = "Posición: \(currentPercent) por ciento."
        }
    }

    private func addBookmark() {
        let code = NativeAppLanguage.code(for: languageIndex)
        let locale = Locale(identifier: code)
        if tracks.isEmpty {
            library.addTextBookmark(document, offset: readingOffset)
            let format = NativeAppLanguage.message("Marca guardada en %d por ciento.", languageCode: code)
            actionMessage = String(format: format, locale: locale, currentPercent)
        } else {
            library.addAudioBookmark(document, track: trackIndex, percent: currentPercent,
                                     seconds: speech.hasAudio ? speech.audioElapsed : nil)
            let format = NativeAppLanguage.message("Marca guardada en la pista %d, %d por ciento.", languageCode: code)
            actionMessage = String(format: format, locale: locale, trackIndex + 1, currentPercent)
        }
        if let actionMessage {
            UIAccessibility.post(notification: .announcement, argument: actionMessage)
        }
    }

    private func exportGeneratedAudio() {
        guard !audioExportBusy, !latest.body.isEmpty else { return }
        let engine = audioExportEngine
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
                    format: audioExportFormat, engine: engine,
                    speed: NativeReaderSpeedOptions.rate(for: effectiveSpeedIndex),
                    pitch: pitch, language: audioExportLanguage,
                    progress: { finished, total in
                        audioExportProgress = "Generados \(finished) de \(total) fragmentos"
                    })
                try Task.checkCancellation()
                showAudioExport = false
                audioExportProgress = "Exportación completada."
                NativeShare.present(url: url)
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
                    Picker("Formato", selection: $audioExportFormat) {
                        ForEach(NativeGeminiAudioExport.Format.allCases) { item in
                            Text(item.rawValue).tag(item)
                        }
                    }
                }
                if audioExportFormat == .daisy {
                    Section("Idioma del libro DAISY") {
                        Picker("Idioma del contenido", selection: $audioExportLanguage) {
                            Text("Español").tag("es")
                            Text("Inglés").tag("en")
                            Text("Portugués").tag("pt")
                            Text("Francés").tag("fr")
                            Text("Alemán").tag("de")
                            Text("Italiano").tag("it")
                        }
                        Text("Selecciona el idioma del texto original, aunque utilices otro motor de voz.")
                    }
                }
                Section("Motor de voz") {
                    Picker("Motor", selection: $audioExportEngine) {
                        Text("Voces del sistema").tag(NativeGeminiAudioExport.Engine.system)
                        Text("Gemini").tag(NativeGeminiAudioExport.Engine.gemini)
                        if NativePhononRuntime.isUsable {
                            Text("Phonon").tag(NativeGeminiAudioExport.Engine.phonon)
                        }
                    }
                    if audioExportEngine == .system {
                        Picker("Voz", selection: $audioExportSystemVoice) {
                            Text("Voz del documento").tag("")
                            ForEach(AVSpeechSynthesisVoice.speechVoices(), id: \.identifier) { voice in
                                Text("\(voice.name), \(voice.language)").tag(voice.identifier)
                            }
                        }
                    } else if audioExportEngine == .gemini {
                        Picker("Voz", selection: $audioExportGeminiVoice) {
                            ForEach(NativeGeminiSpeech.voices, id: \.self) { voice in
                                Text(voice).tag(voice)
                            }
                        }
                        Text("Gemini requiere una clave personal configurada en Motores externos.")
                    } else {
                        Text("Phonon requiere el motor y sus modelos instalados.")
                        TextField("Nombre de la voz Phonon", text: $audioExportPhononVoice)
                    }
                }
                Section("Estado") {
                    Text(audioExportProgress.isEmpty ? "Selecciona el formato y el motor." : audioExportProgress)
                        .accessibilityAddTraits(.updatesFrequently)
                    Button(audioExportBusy ? "Generando…" : "Generar y compartir") {
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
            .navigationTitle("Exportar audio")
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
            actionMessage = "No se pudo exportar: \(error.localizedDescription)"
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

    private var playbackRow: some View {
        AnyLayout(
            dynamicTypeSize.isAccessibilitySize
                ? AnyLayout(VStackLayout(alignment: .leading, spacing: 6))
                : AnyLayout(HStackLayout(spacing: 8))
        ) {
            Button(speech.isPlaying ? "Pausar" : "Reproducir") {
                speech.isPlaying ? pausePlayback() : play()
            }
            .accessibilityHint("Doble toque para reproducir o pausar. Desliza arriba o abajo para moverte según el modo de navegación seleccionado.")
            .accessibilityValue("\(currentPercent) por ciento")
            .accessibilityAdjustableAction { direction in
                switch direction {
                case .increment: moveUnit(1)
                case .decrement: moveUnit(-1)
                @unknown default: break
                }
            }
            .accessibilityAction(named: Text("Abrir enlace actual")) {
                activateCurrentLink()
            }

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
            if effectiveNavigationUnit == 5 {
                NativeAdjustableChoice(
                    title: "Intervalo de tiempo",
                    choices: Self.timeStepChoices,
                    selectedIndex: $timeStepIndex
                )
            }
            Button("Añadir marca") { addBookmarkFromReaderSelection() }
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

    // El botón y la acción general usan el último párrafo recorrido
    // con VoiceOver cuando no hay reproducción activa.
    private func addBookmarkFromReaderSelection() {
        if tracks.isEmpty && !speech.isPlaying,
           let fragment = focusedFragment ?? lastReaderFragment,
           textLayout.fragmentStarts.indices.contains(fragment) {
            bookmarkFromContextMenu(at: fragment)
        } else {
            addBookmark()
        }
    }

    private func bookmarkFromContextMenu(at fragment: Int) {
        let wasPlaying = speech.isPlaying
        if wasPlaying { pausePlayback() }
        // La marca siempre pertenece al párrafo sobre el que actuó VoiceOver,
        // aunque la reproducción estuviera en pausa o todavía activa.
        guard textLayout.fragmentStarts.indices.contains(fragment) else { return }
        readingOffset = textLayout.fragmentStarts[fragment]
        currentPercent = min(100, Int(Double(readingOffset) * 100 /
            Double(max(1, textLayout.totalCharacters))))
        addBookmark()
        // No reanudar una lectura detenida de antemano.
        if wasPlaying {
            Task { @MainActor in
                try? await Task.sleep(for: .milliseconds(1000))
                if speech.isPaused { speech.resume(); applySleepTimer() }
            }
        }
    }

    /// Restore manual VoiceOver/braille reading without starting audio or
    /// stealing focus from an active speech session.
    private func restoreManualReadingFocus(using proxy: ScrollViewProxy) {
        guard readingMode != 1, !speech.isPlaying,
              !textLayout.fragmentStarts.isEmpty else { return }
        let savedOffset = max(0, min(textLayout.totalCharacters,
            latest.lastTextOffset ?? readingOffset))
        let savedFragment = textLayout.fragmentIndex(for: savedOffset)
        lastReaderFragment = savedFragment
        programmaticFocusRequest = true
        proxy.scrollTo(savedFragment, anchor: .center)
        focusedFragment = savedFragment
    }

    private func readerFragment(at index: Int) -> some View {
        Text(textLayout.fragments[index])
            .font(.system(size: effectiveTextSize))
            .fontWeight(effectiveStrongText ? .bold : .regular)
            .lineSpacing(CGFloat(effectiveLineSpacing) * 4)
            .frame(maxWidth: .infinity, alignment: .leading)
            // La selección de texto abre el menú de edición de iOS e impide
            // que VoiceOver presente el menú contextual de la aplicación.
            // Dejar este elemento como lectura estática con una sola acción.
            .contentShape(Rectangle())
            .accessibilityFocused($focusedFragment, equals: index)
            .accessibilityHint("Acciones disponibles: Crear marca. Con VoiceOver, usa las acciones del rotor.")
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

    private var readingContent: some View {
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
                    // A five-percent threshold could lose several chapters.
                    persistPosition()
                }
            }
            .task {
                await Task.yield()
                restoreManualReadingFocus(using: proxy)
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

    @ViewBuilder
    private var documentActions: some View {
        Button("Información de la obra") { showDocumentInformation = true }
        if !latest.body.isEmpty {
            Button("Buscar en el documento") { openDocumentSearch() }
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
        if let original = library.originalURL(for: document) {
            Button("Compartir documento original") { NativeShare.present(url: original) }
        }
        if !latest.body.isEmpty {
            Button("Exportar texto") { exportText() }
            Button("Exportar audio MP3 o DAISY") { showAudioExport = true }
            Button("Diccionario y pronunciación") {
                if speech.isPlaying { pausePlayback() }
                showWordTools = true
            }
            if #available(iOS 18.0, *) {
                Button("Traducir fragmento actual") { showTranslation = true }
            }
        }
        if tracks.count == 1, let track = tracks.first,
           let url = NativeReaderFormats.storedURL(for: track) {
            Button("Compartir archivo de audio") { NativeShare.present(url: url) }
        } else if tracks.count > 1 {
            Button("Compartir todas las pistas de audio (ZIP)") {
                do {
                    NativeShare.present(url: try library.exportAudioTracks(document))
                } catch {
                    actionMessage = "No se pudieron compartir todas las pistas: \(error.localizedDescription)"
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
                                Button(point.kind == "Página" ? "Página. \(point.title)" :
                                       point.kind == "Referencia" ? "Referencia. \(point.title)" :
                                       "Nivel \(point.level). \(point.title)") {
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
            translatedReadingContent
            readerFooterControls
        }
        .tifloScreenSurface()
        .navigationTitle(document.title)
        .navigationBarTitleDisplayMode(.inline)

        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("Acciones") { showDocumentActions = true }
                    .accessibilityHint("Marcas, favoritos, traducción, exportación y navegación.")
            }
        }
        .sheet(isPresented: $showAudioExport) { audioExportSheet }
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
            let initial = max(0, min(100, startPercent ?? latest.lastPercent ?? 0))
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
            // The live reader owns the current cursor, not a stale saved position.
            // Shortcuts invokes this directly; no stop, seek or navigation occurs.
            NativeQuickBookmarkBridge.saveActiveReader = { addBookmark() }
            if !didApplyOpeningMode {
                didApplyOpeningMode = true
                if readingMode == 1 { play() }
            }
        }
        .onChange(of: sleepIndex) { _, _ in
            applySleepTimer(reset: true)
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
            guard (!speech.hasAudio || speech.isGeneratedSpeech), speech.isPlaying else { return }
            readingOffset = max(0, min(textLayout.totalCharacters, offset))
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
            NativeQuickBookmarkBridge.saveActiveReader = nil
            persistPosition()
            speech.onSleepExpired = nil
            speech.stop()
        }
        .accessibilityAction(.magicTap) {
            if speech.isPlaying { pausePlayback() }
            else if speech.isPaused {
                speech.resume()
                applySleepTimer()
            }
        }
        .accessibilityAction(named: Text("Añadir marca")) { addBookmarkFromReaderSelection() }
        .accessibilityAction(named: Text("Avanzar cinco por ciento")) {
            move(to: min(100, currentPercent + 5))
        }
        .accessibilityAction(named: Text("Retroceder cinco por ciento")) {
            move(to: max(0, currentPercent - 5))
        }
    }
}
