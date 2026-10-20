import SwiftUI
import PDFKit
import UIKit
import AVFoundation
import Translation
import UniformTypeIdentifiers

struct NativeReaderPreferences: Codable, Hashable {
    var speedIndex: Int? = nil
    var voiceID: String? = nil
    var textSize: Double? = nil
    var lineSpacingIndex: Int? = nil
    var strongText: Bool? = nil
}

struct NativeReadingDocument: Codable, Identifiable, Hashable {
    let id: UUID
    var title: String
    let body: String
    let importedAt: Date
    // Optional properties allow older beta library JSON to remain decodable.
    var fileExtension: String? = nil
    var trackPaths: [String]? = nil
    var markedPositions: [Int]? = nil
    var isFavorite: Bool? = nil
    var lastPercent: Int? = nil
    var folderName: String? = nil
    var readerPreferences: NativeReaderPreferences? = nil

    var hasAudio: Bool { !(trackPaths ?? []).isEmpty }
    var bookmarks: [Int] { markedPositions ?? [] }
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

    func importDocuments(from urls: [URL], sharingID: UUID? = nil) throws {
        for url in urls {
            let accessed = url.startAccessingSecurityScopedResource()
            defer { if accessed { url.stopAccessingSecurityScopedResource() } }
            let identifier = sharingID ?? UUID()
            if documents.contains(where: { $0.id == identifier }) { continue }
            do {
                let payload = try NativeReaderFormats.read(url, documentID: identifier)
                documents.insert(
                    NativeReadingDocument(
                        id: identifier,
                        title: url.deletingPathExtension().lastPathComponent,
                        body: payload.body,
                        importedAt: .now,
                        fileExtension: payload.fileExtension,
                        trackPaths: payload.trackPaths
                    ), at: 0
                )
                try save()
            } catch {
                NativeReaderFormats.deleteStoredFiles(for: identifier)
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
    var onWord: ((NSRange) -> Void)?
    var onFinish: (() -> Void)?

    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer,
                           willSpeakRangeOfSpeechString characterRange: NSRange,
                           utterance: AVSpeechUtterance) {
        onWord?(characterRange)
    }

    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer,
                           didFinish utterance: AVSpeechUtterance) {
        onFinish?()
    }
}

@MainActor
final class NativeReadingSpeech: ObservableObject {
    private let synthesizer = AVSpeechSynthesizer()
    private let progressDelegate = NativeSpeechProgressDelegate()
    private var baseUTF16 = 0
    private var totalUTF16 = 0
    @Published private(set) var textPercent = 0

    init() {
        progressDelegate.onWord = { [weak self] range in
            Task { @MainActor [weak self] in
                guard let self, self.isPlaying, self.player == nil,
                      self.totalUTF16 > 0 else { return }
                let count = self.baseUTF16 + range.location + range.length
                self.textPercent = max(0, min(100,
                    Int(Double(count) * 100 / Double(self.totalUTF16))))
            }
        }
        progressDelegate.onFinish = { [weak self] in
            Task { @MainActor [weak self] in
                guard let self, self.player == nil else { return }
                self.textPercent = 100
                self.isPlaying = false
                self.isPaused = false
            }
        }
        synthesizer.delegate = progressDelegate
    }
    private var player: AVAudioPlayer?
    private var sleepTask: Task<Void, Never>?
    @Published private(set) var isPlaying = false
    @Published private(set) var isPaused = false

    var hasAudio: Bool { player != nil }
    var audioDuration: TimeInterval { player?.duration ?? 0 }
    var audioElapsed: TimeInterval { player?.currentTime ?? 0 }
    var audioPercent: Int {
        guard audioDuration > 0 else { return 0 }
        return max(0, min(100, Int(audioElapsed / audioDuration * 100)))
    }

    func play(_ text: String, speed: Double = 1.0, language: String = "es-ES",
              voiceIdentifier: String = "", baseUTF16: Int = 0,
              totalUTF16: Int? = nil) {
        stop()
        guard !text.isEmpty else { return }
        self.baseUTF16 = baseUTF16
        self.totalUTF16 = max(1, totalUTF16 ?? text.utf16.count)
        textPercent = max(0, min(100,
            Int(Double(baseUTF16) * 100 / Double(self.totalUTF16))))
        // La voz sigue sonando con la pantalla bloqueada y otras apps abiertas.
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .spokenAudio)
        try? AVAudioSession.sharedInstance().setActive(true)
        let utterance = AVSpeechUtterance(string: text)
        utterance.voice = (voiceIdentifier.isEmpty ? nil : AVSpeechSynthesisVoice(identifier: voiceIdentifier))
            ?? AVSpeechSynthesisVoice(language: language)
        utterance.rate = min(AVSpeechUtteranceMaximumSpeechRate,
            max(AVSpeechUtteranceMinimumSpeechRate,
                AVSpeechUtteranceDefaultSpeechRate * Float(speed)))
        synthesizer.speak(utterance)
        isPlaying = true
        isPaused = false
    }

    func playAudio(_ url: URL, speed: Double = 1.0, at percent: Int = 0) throws {
        stop()
        try AVAudioSession.sharedInstance().setCategory(.playback, mode: .spokenAudio)
        try AVAudioSession.sharedInstance().setActive(true)
        let audio = try AVAudioPlayer(contentsOf: url)
        audio.enableRate = true
        audio.rate = Float(max(0.5, min(2.0, speed)))
        audio.prepareToPlay()
        audio.currentTime = audio.duration * Double(max(0, min(100, percent))) / 100
        guard audio.play() else { throw NativeReaderFormatError.unsupported(url.pathExtension) }
        player = audio
        isPlaying = true
        isPaused = false
    }

    func seek(to percent: Int) {
        guard let player else { return }
        player.currentTime = player.duration * Double(max(0, min(100, percent))) / 100
    }

    func skip(seconds: TimeInterval) {
        guard let player else { return }
        player.currentTime = max(0, min(player.duration, player.currentTime + seconds))
    }

    func pause() {
        if let player { player.pause() } else { synthesizer.pauseSpeaking(at: .word) }
        sleep(after: 0) // Al pausar no sigue corriendo la cuenta del apagado.
        isPlaying = false
        isPaused = true
    }

    func resume() {
        if let player { player.play() } else { synthesizer.continueSpeaking() }
        isPlaying = true
        isPaused = false
    }

    func refresh() {
        if let player, !player.isPlaying && !isPaused { isPlaying = false }
        if player == nil && !synthesizer.isSpeaking && !isPaused { isPlaying = false }
    }

    func sleep(after minutes: Int) {
        sleepTask?.cancel()
        guard minutes > 0 else { return }
        sleepTask = Task { [weak self] in
            try? await Task.sleep(for: .seconds(minutes * 60))
            guard !Task.isCancelled else { return }
            self?.stop()
        }
    }

    func stop() {
        sleepTask?.cancel()
        sleepTask = nil
        player?.stop()
        player = nil
        synthesizer.stopSpeaking(at: .immediate)
        isPlaying = false
        isPaused = false
    }
}

struct NativeReaderLibraryScreen: View {
    @EnvironmentObject private var library: NativeReaderLibrary
    @StateObject private var speech = NativeReadingSpeech()
    @State private var importPresented = false
    @State private var information: NativeReadingDocument?
    @State private var documentToDelete: NativeReadingDocument?
    @State private var confirmDeletion = false
    @State private var importError: String?
    @State private var documentToRename: NativeReadingDocument?
    @State private var proposedTitle = ""
    @State private var newFolderName = ""
    @State private var showCreateFolder = false
    @State private var folderToDelete: String?
    @State private var folderForDocument: NativeReadingDocument?
    @State private var documentToConfigure: NativeReadingDocument?
    @AppStorage("native-reading-folder-filter") private var selectedFolder = ""
    @AppStorage("native-reading-filter") private var filterIndex = 0
    @AppStorage("native-reading-sort") private var sortIndex = 0
    @AppStorage("native-reading-speed-index") private var speedIndex = 2
    @AppStorage("native-reading-voice-id") private var voiceID = ""
    private let speeds: [Double] = [0.75, 0.9, 1.0, 1.25, 1.5]

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

    private var shownDocuments: [NativeReadingDocument] {
        let calendar = Calendar.current
        var items = library.documents.filter { doc in
            if selectedFolder == "__unfiled__" && doc.folderName != nil { return false }
            if selectedFolder != "" && selectedFolder != "__unfiled__"
                && doc.folderName != selectedFolder { return false }
            let ext = (doc.fileExtension ?? "txt").lowercased()
            switch filterIndex {
            case 1: return ["txt", "text", "md", "markdown", "html", "htm", "rtf",
                             "csv", "json", "xml", "log", "srt"].contains(ext)
            case 2: return ext == "pdf"
            case 3: return ext == "epub"
            case 4: return ["docx", "pptx", "xlsx"].contains(ext)
            case 5: return doc.hasAudio || ext == "daisy"
            case 6: return !doc.bookmarks.isEmpty
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
        default: items.sort { $0.importedAt > $1.importedAt }
        }
        return items
    }

    private func play(_ document: NativeReadingDocument) {
        let latest = library.latest(document)
        let chosenSpeed = latest.readerPreferences?.speedIndex ?? speedIndex
        let speed = speeds[max(0, min(speeds.count - 1, chosenSpeed))]
        if let track = latest.trackPaths?.first,
           let url = NativeReaderFormats.storedURL(for: track) {
            do { try speech.playAudio(url, speed: speed, at: latest.lastPercent ?? 0) }
            catch { importError = error.localizedDescription }
        } else {
            let offset = Int(Double(latest.body.count) * Double(latest.lastPercent ?? 0) / 100)
            speech.play(String(latest.body.dropFirst(offset)), speed: speed,
                language: AVSpeechSynthesisVoice(identifier: latest.readerPreferences?.voiceID ?? voiceID)?.language ?? "es-ES",
                voiceIdentifier: latest.readerPreferences?.voiceID ?? voiceID)
        }
    }

    var body: some View {
        List {
            Section {
                Button("Importar", systemImage: "square.and.arrow.down") {
                    importPresented = true
                }
                NavigationLink("Ajustes") { NativeReaderSettingsScreen() }
            }
            Section("Filtrar y ordenar") {
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
                              "Título Z a A", "Formato"],
                    selectedIndex: $sortIndex
                )
            }
            Section("Carpetas") {
                NativeAdjustableChoice(
                    title: "Mostrar carpeta",
                    choices: ["Todas", "Sin carpeta"] + library.folders,
                    selectedIndex: folderFilterIndex
                )
                Button("Crear carpeta") { newFolderName = ""; showCreateFolder = true }
                ForEach(library.folders, id: \.self) { folder in
                    Button(folder) { selectedFolder = folder }
                        .accessibilityLabel("Carpeta \(folder)")
                        .accessibilityHint("Filtra la biblioteca por esta carpeta.")
                        .accessibilityAction(named: Text("Eliminar carpeta")) {
                            folderToDelete = folder
                        }
                }
            }
            Section("Mi biblioteca") {
                if shownDocuments.isEmpty { Text("No hay documentos con el filtro actual.") }
                ForEach(shownDocuments) { document in
                    NavigationLink {
                        NativeReadingScreen(document: document, speech: speech)
                    } label: { Text(document.title) }
                    .accessibilityLabel("\(document.title), \(document.formatLabel)")
                    .accessibilityHint("Doble toque para abrir. Hay acciones de accesibilidad.")
                    .accessibilityAction(named: Text("Reproducir")) { play(document) }
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
                    .accessibilityAction(named: Text("Eliminar")) {
                        documentToDelete = document
                        confirmDeletion = true
                    }
                }
            }
            Section("Marcas") {
                let marked = library.documents.filter { !$0.bookmarks.isEmpty }
                if marked.isEmpty { Text("Todavía no hay marcas guardadas.") }
                ForEach(marked) { document in
                    ForEach(document.bookmarks, id: \.self) { percent in
                        NavigationLink {
                            NativeReadingScreen(document: document, speech: speech,
                                                startPercent: percent)
                        } label: {
                            Text("\(document.title), \(percent) por ciento")
                        }
                        .accessibilityAction(named: Text("Eliminar marca")) {
                            library.removeBookmark(document, at: percent)
                        }
                    }
                }
            }
        }
        .tifloScreenSurface()
        .navigationTitle("TifloLector")
        .onDisappear { speech.stop() }
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
        .confirmationDialog("Eliminar documento", isPresented: $confirmDeletion,
                            titleVisibility: .visible) {
            Button("Eliminar definitivamente", role: .destructive) {
                if let doc = documentToDelete { library.delete(doc) }
                documentToDelete = nil
            }
            Button("Cancelar", role: .cancel) { documentToDelete = nil }
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
private struct NativeReaderTextLayout {
    let fragments: [String]
    let fragmentStarts: [Int]
    let paragraphStarts: [Int]
    let sentenceStarts: [Int]
    let pageStarts: [Int]
    let headingStarts: [Int]
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
        var lineOffset = 0
        for line in body.components(separatedBy: "\n") {
            let normalized = line.trimmingCharacters(in: .whitespaces).lowercased()
            if normalized.range(of: #"^(página|pagina|diapositiva|hoja)\s+[0-9]+"#,
                                options: .regularExpression) != nil {
                pages.append(lineOffset)
                headings.append(lineOffset)
            } else if normalized.hasPrefix("# ") || normalized.hasPrefix("## ")
                        || normalized.hasPrefix("capítulo ") || normalized.hasPrefix("capitulo ")
                        || normalized.hasPrefix("sección ") || normalized.hasPrefix("seccion ") {
                headings.append(lineOffset)
            }
            lineOffset += line.count + 1
        }
        // Sin marcas de página explícitas, los fragmentos hacen de páginas virtuales.
        pageStarts = Array(Set((pages.count > 1 ? pages : offsets) + [0, totalCharacters])).sorted()
        headingStarts = headings.count > 1 ? Array(Set(headings)).sorted() : []
    }

    func nearbyOffset(_ offset: Int, direction: Int, unit: Int) -> Int? {
        let boundaries: [Int]
        switch unit {
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
    var startPercent: Int = 0

    @EnvironmentObject private var library: NativeReaderLibrary
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @AppStorage("native-reading-text-size") private var textSize = 20.0
    @AppStorage("native-reading-speed-index") private var speedIndex = 2
    @AppStorage("native-reading-voice-id") private var voiceID = ""
    @AppStorage("native-reading-line-spacing-index") private var lineSpacingIndex = 0
    @AppStorage("native-reading-strong-text") private var strongText = false
    @AppStorage("native-reader-navigation-unit") private var navigationUnit = 0
    @AppStorage("native-reader-reading-mode") private var readingMode = 0
    @State private var didApplyOpeningMode = false
    @State private var sleepIndex = 0 // Each open document starts with timer disabled.
    @State private var currentPercent = 0
    @State private var readingOffset = 0
    @State private var lastSavedPercent = -1
    @State private var trackIndex = 0
    @State private var elapsedSpeakingSeconds = 0
    @State private var playbackTick = 0
    @State private var showTranslation = false
    @State private var showAudioSettings = false
    @State private var showVisualSettings = false
    @State private var showDocumentActions = false
    @State private var showDocumentInformation = false
    @State private var showSavedMarks = false
    @State private var programmaticFocusRequest = false
    @State private var actionMessage: String?
    @AccessibilityFocusState private var focusedFragment: Int?

    private let textLayout: NativeReaderTextLayout
    private let wordCount: Int
    private static let percentages = (0...100).map { "\($0) por ciento" }
    private static let sleepChoices = [
        "Desactivado", "5 minutos", "10 minutos", "15 minutos",
        "30 minutos", "45 minutos", "60 minutos"
    ]
    private let speeds: [Double] = [0.75, 0.9, 1.0, 1.25, 1.5]
    private let sleepMinutes: [Int] = [0, 5, 10, 15, 30, 45, 60]

    init(document: NativeReadingDocument, speech: NativeReadingSpeech,
         startPercent: Int = 0) {
        self.document = document
        self.speech = speech
        self.startPercent = startPercent
        self.textLayout = NativeReaderTextLayout(document.body)
        self.wordCount = document.body.split(whereSeparator: \.isWhitespace).count
    }

    private var latest: NativeReadingDocument { library.latest(document) }
    private var tracks: [String] { latest.trackPaths ?? [] }
    private var effectiveSpeedIndex: Int { latest.readerPreferences?.speedIndex ?? speedIndex }
    private var effectiveVoiceID: String { latest.readerPreferences?.voiceID ?? voiceID }
    private var effectiveTextSize: Double { latest.readerPreferences?.textSize ?? textSize }
    private var effectiveLineSpacing: Int { latest.readerPreferences?.lineSpacingIndex ?? lineSpacingIndex }
    private var effectiveStrongText: Bool { latest.readerPreferences?.strongText ?? strongText }
    private var speed: Double { speeds[max(0, min(4, effectiveSpeedIndex))] }
    private var isAudioOnly: Bool { latest.body.isEmpty && !tracks.isEmpty }
    private var excerpt: String {
        guard !textLayout.fragments.isEmpty else { return "" }
        return textLayout.fragments[textLayout.fragmentIndex(for: readingOffset)]
    }

    private func persistPosition() {
        library.savePosition(document, percent: currentPercent)
        lastSavedPercent = currentPercent
    }

    private func move(to percent: Int) {
        let value = max(0, min(100, percent))
        currentPercent = value
        readingOffset = Int(Double(textLayout.totalCharacters) * Double(value) / 100)
        if speech.hasAudio {
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
        speech.play(remainder, speed: speed,
                    language: AVSpeechSynthesisVoice(identifier: effectiveVoiceID)?.language ?? "es-ES",
                    voiceIdentifier: effectiveVoiceID,
                    baseUTF16: String(document.body.prefix(readingOffset)).utf16.count,
                    totalUTF16: document.body.utf16.count)
    }

    private func play() {
        if speech.isPaused {
            speech.resume()
        } else if !tracks.isEmpty {
            playTrack()
        } else {
            startTextSpeech()
        }
        applySleepTimer()
    }

    private func applySleepTimer() {
        let index = max(0, min(sleepMinutes.count - 1, sleepIndex))
        speech.sleep(after: speech.isPlaying ? sleepMinutes[index] : 0)
    }

    private func playTrack() {
        guard tracks.indices.contains(trackIndex),
              let url = NativeReaderFormats.storedURL(for: tracks[trackIndex]) else {
            actionMessage = "No se encuentra la pista de audio."
            return
        }
        do {
            try speech.playAudio(url, speed: speed, at: currentPercent)
            actionMessage = nil
        } catch {
            actionMessage = "No se pudo reproducir: \(error.localizedDescription)"
        }
    }

    private func pausePlayback() {
        speech.pause()
        persistPosition()
    }

    private func stopPlayback() {
        speech.stop()
        persistPosition()
    }

    private func changeTrack(_ delta: Int) {
        guard tracks.indices.contains(trackIndex + delta) else { return }
        trackIndex += delta
        move(to: 0)
        playTrack()
        applySleepTimer()
    }

    private func moveUnit(_ direction: Int) {
        guard !document.body.isEmpty,
              let next = textLayout.nearbyOffset(readingOffset,
                                                  direction: direction, unit: navigationUnit)
        else { return }
        readingOffset = max(0, min(textLayout.totalCharacters, next))
        let ratio = Double(readingOffset) / Double(max(1, textLayout.totalCharacters))
        currentPercent = min(100, Int((ratio * 100).rounded()))
        persistPosition()
        let index = textLayout.fragmentIndex(for: readingOffset)
        programmaticFocusRequest = true
        focusedFragment = index
        if speech.isPlaying || speech.isPaused {
            let wasPaused = speech.isPaused
            startTextSpeech()
            if wasPaused { speech.pause() }
            else { applySleepTimer() }
        }
    }

    private func addBookmark() {
        library.addBookmark(document, at: currentPercent)
        actionMessage = "Marca guardada en \(currentPercent) por ciento."
    }

    private func exportText() {
        guard !latest.body.isEmpty else { return }
        let name = latest.title.replacingOccurrences(
            of: #"[^A-Za-z0-9 _.-]"#, with: "_", options: .regularExpression
        )
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent(name + ".txt")
        do {
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
        let position = "Leído \(currentPercent) por ciento. Falta \(100 - currentPercent) por ciento."
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
            Button("Detener") { stopPlayback() }
            Button("Audio") { showAudioSettings = true }
                .accessibilityHint("Abre velocidad, voz e idioma de lectura.")
            Button("Visual") { showVisualSettings = true }
                .accessibilityHint("Abre tamaño de letra y presentación visual.")
        }
        .buttonStyle(.bordered)
        .controlSize(.small)
    }

    @ViewBuilder
    private var trackButtons: some View {
        if tracks.count > 1 {
            HStack {
                Button("Pista anterior") { changeTrack(-1) }
                    .disabled(trackIndex == 0)
                Button("Pista siguiente") { changeTrack(1) }
                    .disabled(trackIndex == tracks.count - 1)
            }
            .buttonStyle(.bordered)
            .controlSize(.small)
        }
    }

    private var quickControls: some View {
        VStack(alignment: .leading, spacing: 6) {
            playbackRow
            trackButtons
            Text(progressDescription)
                .font(.footnote)
                .accessibilityLabel(progressDescription)
            if speech.hasAudio {
                HStack(spacing: 12) {
                    Button("Retroceder 30 segundos") {
                        speech.skip(seconds: -30)
                        currentPercent = speech.audioPercent
                        persistPosition()
                    }
                    Button("Avanzar 30 segundos") {
                        speech.skip(seconds: 30)
                        currentPercent = speech.audioPercent
                        persistPosition()
                    }
                }
                .buttonStyle(.bordered)
                .controlSize(.small)
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

    private func readerFragment(at index: Int) -> some View {
        Text(textLayout.fragments[index])
            .font(.system(size: effectiveTextSize))
            .fontWeight(effectiveStrongText ? .bold : .regular)
            .lineSpacing(CGFloat(effectiveLineSpacing) * 4)
            .frame(maxWidth: .infinity, alignment: .leading)
            .textSelection(.enabled)
            .accessibilityFocused($focusedFragment, equals: index)
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
                    if abs(currentPercent - lastSavedPercent) >= 5 { persistPosition() }
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

    @ViewBuilder
    private var documentActions: some View {
        Button("Información de la obra") { showDocumentInformation = true }
        Button("Marcas guardadas") { showSavedMarks = true }
        Button("Añadir marca") { addBookmark() }
        Button(latest.isFavorite == true ? "Quitar de favoritos" : "Añadir a favoritos") {
            library.toggleFavorite(document)
        }
        if !latest.body.isEmpty {
            Button("Exportar texto") { exportText() }
            if #available(iOS 18.0, *) {
                Button("Traducir fragmento actual") { showTranslation = true }
            }
            Button("Unidad anterior") { moveUnit(-1) }
            Button("Unidad siguiente") { moveUnit(1) }
        }
        if let track = tracks.first,
           let url = NativeReaderFormats.storedURL(for: track) {
            Button("Compartir archivo de audio") { NativeShare.present(url: url) }
        }
        Button("Cancelar", role: .cancel) {}
    }

    var body: some View {
        VStack(spacing: 0) {
            quickControls
            Divider().accessibilityHidden(true)
            translatedReadingContent
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
        .confirmationDialog("Acciones del documento",
                            isPresented: $showDocumentActions,
                            titleVisibility: .visible) {
            documentActions
        }
        .sheet(isPresented: $showDocumentInformation) {
            NavigationStack {
                List {
                    LabeledContent("Título", value: latest.title)
                    LabeledContent("Formato", value: latest.formatLabel)
                    LabeledContent("Importado", value:
                        latest.importedAt.formatted(date: .abbreviated, time: .shortened))
                    LabeledContent("Carpeta", value: latest.folderName ?? "Sin carpeta")
                    LabeledContent("Marcas", value: "\(latest.bookmarks.count)")
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
        .sheet(isPresented: $showSavedMarks) {
            NavigationStack {
                List {
                    if latest.bookmarks.isEmpty {
                        Text("Esta obra todavía no tiene marcas.")
                    }
                    ForEach(latest.bookmarks, id: \.self) { percent in
                        Button("Ir a \(percent) por ciento") {
                            move(to: percent)
                            showSavedMarks = false
                        }
                        .accessibilityAction(named: Text("Eliminar esta marca")) {
                            library.removeBookmark(document, at: percent)
                        }
                    }
                }
                .tifloScreenSurface()
                .navigationTitle("Marcas guardadas")
                .toolbar { Button("Cerrar") { showSavedMarks = false } }
            }
        }
        .sheet(isPresented: $showAudioSettings) {
            NativeReaderDocumentAudioSettingsScreen(document: document)
        }
        .sheet(isPresented: $showVisualSettings) {
            NativeReaderDocumentVisualSettingsScreen(document: document)
        }
        .onAppear {
            let initial = max(0, min(100,
                startPercent > 0 ? startPercent : (latest.lastPercent ?? 0)))
            currentPercent = initial
            readingOffset = Int(Double(textLayout.totalCharacters) * Double(initial) / 100)
            lastSavedPercent = initial
            if !didApplyOpeningMode {
                didApplyOpeningMode = true
                if readingMode == 1 { play() }
            }
        }
        .onChange(of: sleepIndex) { _, _ in
            applySleepTimer()
        }
        .onReceive(speech.$textPercent) { percentage in
            // AVSpeechSynthesizer reports each spoken word; no artificial timer
            // advances the text cursor while paused or reading visually.
            guard !speech.hasAudio, speech.isPlaying else { return }
            if percentage != currentPercent {
                currentPercent = percentage
                readingOffset = Int(Double(textLayout.totalCharacters) *
                                    Double(percentage) / 100)
                if abs(percentage - lastSavedPercent) >= 5 { persistPosition() }
            }
        }
        .onReceive(Timer.publish(every: 1, on: .main, in: .common).autoconnect()) { _ in
            speech.refresh()
            if speech.isPlaying {
                playbackTick += 1
                if !speech.hasAudio { elapsedSpeakingSeconds += 1 }
            }
            if speech.hasAudio {
                let updated = speech.audioPercent
                if updated != currentPercent { currentPercent = updated }
                if abs(updated - lastSavedPercent) >= 5 { persistPosition() }
            }
        }
        .onDisappear {
            persistPosition()
            speech.stop()
        }
        .accessibilityAction(named: Text("Añadir marca")) { addBookmark() }
        .accessibilityAction(named: Text("Avanzar diez por ciento")) {
            move(to: min(100, currentPercent + 10))
        }
        .accessibilityAction(named: Text("Retroceder diez por ciento")) {
            move(to: max(0, currentPercent - 10))
        }
    }
}
