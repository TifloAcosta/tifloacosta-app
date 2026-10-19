import SwiftUI
import PDFKit
import AVFoundation
import UniformTypeIdentifiers

struct NativeReadingDocument: Codable, Identifiable {
    let id: UUID
    var title: String
    let body: String
    let importedAt: Date
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

    func importDocuments(from urls: [URL]) throws {
        for url in urls {
            let accessed = url.startAccessingSecurityScopedResource()
            defer { if accessed { url.stopAccessingSecurityScopedResource() } }
            let data = try Data(contentsOf: url)
            let text: String
            if url.pathExtension.lowercased() == "pdf" {
                text = PDFDocument(data: data)?.string ?? ""
            } else if ["html", "htm", "rtf"].contains(url.pathExtension.lowercased()) {
                text = NativeDocumentText.extract(data, from: url)
            } else {
                text = String(data: data, encoding: .utf8)
                    ?? String(data: data, encoding: .utf16)
                    ?? ""
            }
            guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
                throw NativeReaderImportError.noReadableText(url.lastPathComponent)
            }
            documents.insert(
                NativeReadingDocument(
                    id: UUID(),
                    title: url.deletingPathExtension().lastPathComponent,
                    body: text,
                    importedAt: .now
                ),
                at: 0
            )
        }
        try save()
    }

    func importSharedText(_ text: String, title: String) throws {
        guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw NativeReaderImportError.noReadableText(title)
        }
        documents.insert(
            NativeReadingDocument(id: UUID(), title: title, body: text, importedAt: .now),
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
        try? save()
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

    func play(_ text: String, speed: Double = 1.0, language: String = "es-ES", voiceIdentifier: String = "") {
        synthesizer.stopSpeaking(at: .immediate)
        let utterance = AVSpeechUtterance(string: text)
        utterance.voice = (voiceIdentifier.isEmpty ? nil : AVSpeechSynthesisVoice(identifier: voiceIdentifier))
            ?? AVSpeechSynthesisVoice(language: language)
        utterance.rate = min(
            AVSpeechUtteranceMaximumSpeechRate,
            max(AVSpeechUtteranceMinimumSpeechRate,
                AVSpeechUtteranceDefaultSpeechRate * Float(speed))
        )
        synthesizer.speak(utterance)
    }

    func pause() {
        synthesizer.pauseSpeaking(at: .word)
    }

    func resume() {
        synthesizer.continueSpeaking()
    }

    func stop() {
        synthesizer.stopSpeaking(at: .immediate)
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
    @State private var searchText = ""
    @State private var showSettings = false
    @State private var filterIndex = 0
    @State private var sortIndex = 0
    @State private var showFilters = false
    @State private var showAudioSettings = false
    @State private var showVisualSettings = false
    @AppStorage("native-reading-speed-index") private var readerRateIndex = 2
    @AppStorage("native-reading-language-index") private var readerLanguageIndex = 0
    @AppStorage("native-reading-voice-id") private var readerVoiceID = ""
    @AppStorage("native-reading-text-size") private var readerTextSize = 20.0
    @AppStorage("native-reading-line-spacing-index") private var readerLineSpacingIndex = 0
    @AppStorage("native-reading-strong-text") private var readerStrongText = false
    private let speechRates: [Double] = [0.75, 0.9, 1.0, 1.25, 1.5]
    private let languages = ["es-ES", "en-US"]

    private var availableVoices: [AVSpeechSynthesisVoice] {
        let prefix = readerLanguageIndex == 1 ? "en" : "es"
        return AVSpeechSynthesisVoice.speechVoices()
            .filter { $0.language.lowercased().hasPrefix(prefix) }
            .sorted { $0.name.localizedStandardCompare($1.name) == .orderedAscending }
    }

    private var shownDocuments: [NativeReadingDocument] {
        var current = library.documents.filter {
            searchText.isEmpty || $0.title.localizedCaseInsensitiveContains(searchText)
        }
        let calendar = Calendar.current
        if filterIndex == 1 {
            current = current.filter { calendar.isDateInToday($0.importedAt) }
        } else if filterIndex == 2, let weekAgo = calendar.date(byAdding: .day, value: -7, to: .now) {
            current = current.filter { $0.importedAt >= weekAgo }
        }
        switch sortIndex {
        case 1: return current.sorted { $0.importedAt < $1.importedAt }
        case 2: return current.sorted {
            $0.title.localizedStandardCompare($1.title) == .orderedAscending
        }
        case 3: return current.sorted {
            $0.title.localizedStandardCompare($1.title) == .orderedDescending
        }
        default: return current.sorted { $0.importedAt > $1.importedAt }
        }
    }

    var body: some View {
        List {
            Section {
                Button("Importar documento", systemImage: "square.and.arrow.down") {
                    importPresented = true
                }
            }

            Section {
                DisclosureGroup("Ajustes", isExpanded: $showSettings) {
                    DisclosureGroup("Audio y voz", isExpanded: $showAudioSettings) {
                        NativeAdjustableChoice(
                            title: "Idioma de lectura",
                            choices: ["Español", "Inglés"],
                            selectedIndex: $readerLanguageIndex
                        )
                        NativeAdjustableChoice(
                            title: "Velocidad de voz",
                            choices: ["0,75×", "0,9×", "1×", "1,25×", "1,5×"],
                            selectedIndex: $readerRateIndex
                        )
                        Picker("Voz", selection: $readerVoiceID) {
                            Text("Voz predeterminada del sistema").tag("")
                            ForEach(availableVoices, id: \.identifier) { voice in
                                Text("\(voice.name), \(voice.language)").tag(voice.identifier)
                            }
                        }
                        .onChange(of: readerLanguageIndex) { _, _ in readerVoiceID = "" }
                    }
                    DisclosureGroup("Presentación visual", isExpanded: $showVisualSettings) {
                        Slider(value: $readerTextSize, in: 14...40, step: 2) {
                            Text("Tamaño del texto")
                        }
                        .accessibilityValue("\(Int(readerTextSize)) puntos")
                        NativeAdjustableChoice(
                            title: "Espacio entre líneas",
                            choices: ["Normal", "Cómodo", "Amplio"],
                            selectedIndex: $readerLineSpacingIndex
                        )
                        Toggle("Texto reforzado", isOn: $readerStrongText)
                            .tint(TifloVisual.actionTint)
                    }
                }
                DisclosureGroup("Filtrar y ordenar", isExpanded: $showFilters) {
                    NativeAdjustableChoice(
                        title: "Filtro de documentos",
                        choices: ["Todos", "Importados hoy", "Importados en los últimos siete días"],
                        selectedIndex: $filterIndex
                    )
                    NativeAdjustableChoice(
                        title: "Ordenar documentos",
                        choices: ["Más recientes", "Más antiguos", "Título A a Z", "Título Z a A"],
                        selectedIndex: $sortIndex
                    )
                }
            }

            Section("Mi biblioteca") {
                if shownDocuments.isEmpty {
                    Text("No hay documentos con el filtro actual.")
                }
                ForEach(shownDocuments) { document in
                    NavigationLink {
                        NativeReadingScreen(document: document, speech: speech)
                    } label: {
                        Text(document.title)
                    }
                    .accessibilityLabel(document.title)
                    .accessibilityHint("Doble toque para abrir. Acciones disponibles.")
                    .accessibilityAction(named: Text("Reproducir")) {
                        speech.play(document.body, speed: speechRates[readerRateIndex], language: languages[readerLanguageIndex], voiceIdentifier: readerVoiceID)
                    }
                    .accessibilityAction(named: Text("Información")) {
                        information = document
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
        }
        .tifloScreenSurface()
        .navigationTitle("TifloLector")
        .searchable(text: $searchText, prompt: "Buscar en mi biblioteca")
        .alert("Cambiar título", isPresented: Binding(
            get: { documentToRename != nil },
            set: { if !$0 { documentToRename = nil } }
        )) {
            TextField("Título", text: $proposedTitle)
            Button("Guardar") {
                if let documentToRename {
                    library.rename(documentToRename, to: proposedTitle)
                }
                documentToRename = nil
            }
            Button("Cancelar", role: .cancel) { documentToRename = nil }
        } message: {
            Text("Escribe el nuevo título del documento.")
        }
        .fileImporter(
            isPresented: $importPresented,
            allowedContentTypes: [.plainText, .pdf, .html, .rtf],
            allowsMultipleSelection: true
        ) { result in
            switch result {
            case .success(let urls):
                do {
                    try library.importDocuments(from: urls)
                } catch {
                    importError = error.localizedDescription
                }
            case .failure(let error):
                importError = error.localizedDescription
            }
        }
        .confirmationDialog(
            "Eliminar documento",
            isPresented: $confirmDeletion,
            titleVisibility: .visible
        ) {
            Button("Eliminar definitivamente", role: .destructive) {
                if let documentToDelete { library.delete(documentToDelete) }
                documentToDelete = nil
            }
            Button("Cancelar", role: .cancel) { documentToDelete = nil }
        } message: {
            Text("El documento se eliminará de la nueva biblioteca nativa.")
        }
        .alert("No se pudo importar", isPresented: Binding(
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
                    LabeledContent(
                        "Importado",
                        value: document.importedAt.formatted(date: .abbreviated, time: .shortened)
                    )
                }
                .tifloScreenSurface()
        .navigationTitle("Información")
                .toolbar {
                    Button("Cerrar") { information = nil }
                }
            }
        }
    }
}

struct NativeReadingScreen: View {
    let document: NativeReadingDocument
    @ObservedObject var speech: NativeReadingSpeech

    @AppStorage("native-reading-text-size") private var textSize = 20.0
    @AppStorage("native-reading-speed-index") private var rateIndex = 2
    @AppStorage("native-reading-language-index") private var languageIndex = 0
    @AppStorage("native-reading-voice-id") private var voiceIdentifier = ""
    @AppStorage("native-reading-line-spacing-index") private var lineSpacingIndex = 0
    @AppStorage("native-reading-strong-text") private var strongText = false
    @State private var showSettings = false
    private let speechRates: [Double] = [0.75, 0.9, 1.0, 1.25, 1.5]

    var body: some View {
        ScrollView {
            Text(document.body)
                .font(.system(size: textSize))
                .fontWeight(strongText ? .bold : .regular)
                .lineSpacing(CGFloat(lineSpacingIndex) * 4)
                .textSelection(.enabled)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding()
        }
        .tifloScreenSurface()
        .navigationTitle(document.title)
        .navigationBarTitleDisplayMode(.inline)
        .safeAreaInset(edge: .bottom) {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Button("Reproducir") {
                        speech.play(document.body, speed: speechRates[rateIndex],
                                    language: languageIndex == 1 ? "en-US" : "es-ES",
                                    voiceIdentifier: voiceIdentifier)
                    }
                    Button("Pausar") { speech.pause() }
                    Button("Continuar") { speech.resume() }
                    Button("Detener") { speech.stop() }
                }
                .buttonStyle(.bordered)
                .controlSize(.small)

                DisclosureGroup("Ajustes de lectura", isExpanded: $showSettings) {
                    NativeAdjustableChoice(
                        title: "Velocidad de lectura",
                        choices: ["0,75×", "0,9×", "1×", "1,25×", "1,5×"],
                        selectedIndex: $rateIndex
                    )

                    Slider(value: $textSize, in: 14...40, step: 2) {
                        Text("Tamaño del texto")
                    } minimumValueLabel: {
                        Text("A").font(.caption)
                    } maximumValueLabel: {
                        Text("A").font(.headline)
                    }
                    .accessibilityLabel("Tamaño del texto")
                    .accessibilityValue("\(Int(textSize)) puntos")
                }
            }
            .padding()
            .background(.regularMaterial)
        }
    }
}
