import SwiftUI
import PDFKit
import UIKit
import AVFoundation
import Translation
import UniformTypeIdentifiers

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

    private static var storageURL: URL {
        let directory = FileManager.default.urls(
            for: .applicationSupportDirectory, in: .userDomainMask
        )[0]
        return directory.appendingPathComponent("NativeReaderDocuments.json")
    }

    init() {
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

@MainActor
final class NativeReadingSpeech: ObservableObject {
    private let synthesizer = AVSpeechSynthesizer()
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

    func play(_ text: String, speed: Double = 1.0, language: String = "es-ES", voiceIdentifier: String = "") {
        stop()
        guard !text.isEmpty else { return }
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
    @AppStorage("native-reading-filter") private var filterIndex = 0
    @AppStorage("native-reading-sort") private var sortIndex = 0
    @AppStorage("native-reading-speed-index") private var speedIndex = 2
    @AppStorage("native-reading-voice-id") private var voiceID = ""
    @AppStorage("native-reader-sleep-index") private var sleepIndex = 0
    private let speeds: [Double] = [0.75, 0.9, 1.0, 1.25, 1.5]
    private let sleepMinutes = [0, 5, 10, 15, 30, 45, 60]

    private var shownDocuments: [NativeReadingDocument] {
        let calendar = Calendar.current
        var items = library.documents.filter { doc in
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
        let speed = speeds[max(0, min(speeds.count - 1, speedIndex))]
        if let track = latest.trackPaths?.first,
           let url = NativeReaderFormats.storedURL(for: track) {
            do { try speech.playAudio(url, speed: speed, at: latest.lastPercent ?? 0) }
            catch { importError = error.localizedDescription }
        } else {
            let offset = Int(Double(latest.body.count) * Double(latest.lastPercent ?? 0) / 100)
            speech.play(String(latest.body.dropFirst(offset)), speed: speed,
                language: AVSpeechSynthesisVoice(identifier: voiceID)?.language ?? "es-ES",
                voiceIdentifier: voiceID)
        }
        speech.sleep(after: sleepMinutes[max(0, min(6, sleepIndex))])
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
    }

    func nearbyOffset(_ offset: Int, direction: Int, unit: Int) -> Int? {
        let boundaries: [Int]
        switch unit {
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
    @State private var sleepIndex = 0 // Each open document starts with timer disabled.
    @State private var currentPercent = 0
    @State private var readingOffset = 0
    @State private var lastSavedPercent = -1
    @State private var trackIndex = 0
    @State private var showTranslation = false
    @State private var showAudioSettings = false
    @State private var showVisualSettings = false
    @State private var showDocumentActions = false
    @State private var actionMessage: String?
    @AccessibilityFocusState private var focusedFragment: Int?

    private let textLayout: NativeReaderTextLayout
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
    }

    private var latest: NativeReadingDocument { library.latest(document) }
    private var tracks: [String] { latest.trackPaths ?? [] }
    private var speed: Double { speeds[max(0, min(4, speedIndex))] }
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
        if speech.hasAudio { speech.seek(to: value) }
        persistPosition()
    }

    private var positionBinding: Binding<Int> {
        Binding(get: { currentPercent }, set: { move(to: $0) })
    }

    private func play() {
        if speech.isPaused {
            speech.resume()
        } else if !tracks.isEmpty {
            playTrack()
        } else {
            speech.play(String(document.body.dropFirst(readingOffset)),
                        speed: speed,
                        language: AVSpeechSynthesisVoice(identifier: voiceID)?.language ?? "es-ES",
                        voiceIdentifier: voiceID)
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
        focusedFragment = index
        if speech.isPlaying {
            speech.play(String(document.body.dropFirst(readingOffset)),
                        speed: speed,
                        language: AVSpeechSynthesisVoice(identifier: voiceID)?.language ?? "es-ES",
                        voiceIdentifier: voiceID)
            applySleepTimer()
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
            .font(.system(size: textSize))
            .fontWeight(strongText ? .bold : .regular)
            .lineSpacing(CGFloat(lineSpacingIndex) * 4)
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
                if let index { proxy.scrollTo(index, anchor: .center) }
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
        .sheet(isPresented: $showAudioSettings) {
            NativeReaderAudioSettingsScreen()
        }
        .sheet(isPresented: $showVisualSettings) {
            NativeReaderVisualSettingsScreen()
        }
        .onAppear {
            let initial = max(0, min(100,
                startPercent > 0 ? startPercent : (latest.lastPercent ?? 0)))
            currentPercent = initial
            readingOffset = Int(Double(textLayout.totalCharacters) * Double(initial) / 100)
            lastSavedPercent = initial
        }
        .onChange(of: sleepIndex) { _, _ in
            applySleepTimer()
        }
        .onReceive(Timer.publish(every: 1, on: .main, in: .common).autoconnect()) { _ in
            // Poll only audio playback. Updating the position from playback must
            // NEVER call seek again or write JSON every second.
            speech.refresh()
            if speech.hasAudio && speech.isPlaying {
                let updated = speech.audioPercent
                if abs(updated - currentPercent) >= 2 {
                    currentPercent = updated
                }
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
