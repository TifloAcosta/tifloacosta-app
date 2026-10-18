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

    func play(_ text: String, speed: Double = 1.0) {
        synthesizer.stopSpeaking(at: .immediate)
        let utterance = AVSpeechUtterance(string: text)
        utterance.voice = AVSpeechSynthesisVoice(language: "es-ES")
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

    var body: some View {
        List {
            Section {
                Button("Importar documento", systemImage: "square.and.arrow.down") {
                    importPresented = true
                }
                Text("Importación nativa inicial: TXT y PDF con texto. La biblioteca anterior permanece intacta.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }

            Section("Mi biblioteca") {
                if library.documents.isEmpty {
                    Text("Todavía no hay documentos importados en esta versión nativa.")
                }
                ForEach(library.documents) { document in
                    NavigationLink {
                        NativeReadingScreen(document: document, speech: speech)
                    } label: {
                        Text(document.title)
                    }
                    .accessibilityLabel(document.title)
                    .accessibilityHint("Doble toque para abrir. Acciones disponibles.")
                    .accessibilityAction(named: Text("Abrir")) {
                        // Opening is already the native NavigationLink's default action.
                        // Use the default activation rather than a second navigation stack.
                    }
                    .accessibilityAction(named: Text("Reproducir")) {
                        speech.play(document.body)
                    }
                    .accessibilityAction(named: Text("Información")) {
                        information = document
                    }
                    .accessibilityAction(named: Text("Eliminar")) {
                        documentToDelete = document
                        confirmDeletion = true
                    }
                }
            }
        }
        .navigationTitle("TifloLector")
        .fileImporter(
            isPresented: $importPresented,
            allowedContentTypes: [.plainText, .pdf],
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
    @State private var rateIndex = 2
    private let speechRates: [Double] = [0.75, 0.9, 1.0, 1.25, 1.5]

    var body: some View {
        ScrollView {
            Text(document.body)
                .font(.system(size: textSize))
                .textSelection(.enabled)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding()
        }
        .navigationTitle(document.title)
        .navigationBarTitleDisplayMode(.inline)
        .safeAreaInset(edge: .bottom) {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Button("Reproducir") {
                        speech.play(document.body, speed: speechRates[rateIndex])
                    }
                    Button("Pausar") { speech.pause() }
                    Button("Continuar") { speech.resume() }
                    Button("Detener") { speech.stop() }
                }
                .buttonStyle(.bordered)
                .controlSize(.small)

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
            .padding()
            .background(.regularMaterial)
        }
    }
}
