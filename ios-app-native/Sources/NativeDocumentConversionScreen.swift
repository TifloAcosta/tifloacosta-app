import SwiftUI
import UIKit

extension NativeReadingDocument {
    var conversionSource: NativeConversionSource {
        let filename = originalRelativePath.map { URL(fileURLWithPath: $0).lastPathComponent }
            ?? title.replacingOccurrences(of: "/", with: "_")
        return NativeConversionSource(filename: filename, title: title,
            format: (fileExtension ?? "").lowercased(), text: body,
            links: (textLinks ?? []).map {
                .init(offset: $0.offset, title: $0.title, url: $0.url, targetOffset: $0.targetOffset)
            }, original: originalRelativePath.flatMap { NativeReaderFormats.storedURL(for: $0) })
    }
}

struct NativeConversionSelection: Identifiable {
    let id = UUID()
    let sources: [NativeConversionSource]
}

// Keep the temporary files alive for the worker and the presented result screen.
private final class NativeConversionWorkspace: Sendable {
    let directory = FileManager.default.temporaryDirectory
        .appendingPathComponent("TifloConversion-" + UUID().uuidString, isDirectory: true)
    deinit { try? FileManager.default.removeItem(at: directory) }
}

struct NativeDocumentConversionScreen: View {
    @EnvironmentObject private var library: NativeReaderLibrary
    @Environment(\.dismiss) private var dismiss
    let sources: [NativeConversionSource]

    @State private var formatIndex = 0
    @State private var progress = 0.0
    @State private var position = 0
    @State private var outputs: [URL] = []
    @State private var saved: Set<URL> = []
    @State private var failures: [String] = []
    @State private var status = ""
    @State private var job: Task<Void, Never>?
    @State private var saving = false
    @State private var workspace: NativeConversionWorkspace?
    @State private var resultFormat: NativeDocumentFormat?
    @State private var confirmRestart = false
    @State private var confirmClose = false

    private let formats = NativeDocumentFormat.allCases
    private var format: NativeDocumentFormat { formats[formatIndex] }

    private var showsLossNotice: Bool {
        let plainFormats = ["", "txt", "text"]
        return sources.contains { source in
            if plainFormats.contains(source.format) { return false }
            return !(format == .md && ["md", "markdown"].contains(source.format))
        }
    }

    var body: some View {
        NavigationStack {
            Form {
                NativeAdjustableChoice(title: "Formato de destino",
                    choices: formats.map(\.label), selectedIndex: $formatIndex)
                    .disabled(job != nil || saving)
                if job == nil && showsLossNotice {
                    Text("Se conservará el texto. Si el original contiene imágenes, tablas, listas, notas o estilos, pueden perderse.")
                        .font(.footnote)
                }
                if format == .pdf {
                    Text("PDF con texto seleccionable y etiquetas de párrafo y encabezado. La accesibilidad completa depende del documento de origen.")
                        .font(.footnote)
                }
                if job != nil {
                    ProgressView(value: progress) {
                        Text(MusicLocalized.format("Convirtiendo documento %d de %d.", position, sources.count))
                    }
                    Button("Cancelar conversión", role: .cancel) { job?.cancel() }
                } else {
                    Button("Iniciar conversión") {
                        if outputs.contains(where: { !saved.contains($0) }) { confirmRestart = true }
                        else { start() }
                    }
                        .disabled(saving || sources.isEmpty)
                }
                if !status.isEmpty { Text(status).accessibilityAddTraits(.updatesFrequently) }
                ForEach(Array(failures.enumerated()), id: \.offset) { _, failure in
                    Text(failure)
                }
                if !outputs.isEmpty {
                    Section {
                        ForEach(outputs, id: \.self) { url in
                            VStack(alignment: .leading) {
                                Text(url.lastPathComponent)
                                if saved.contains(url) { Text("Guardado en la biblioteca").font(.caption) }
                            }
                            .accessibilityElement(children: .combine)
                        }
                    } header: {
                        Text(resultFormat.map { MusicLocalized.format("Resultados: %@", $0.label) } ?? MusicLocalized.message("Resultados"))
                    }
                    Button("Guardar en la biblioteca") { saveResults() }
                        .disabled(saving || job != nil || saved.count == outputs.count)
                    Button("Compartir o exportar a Archivos y nubes") {
                        NativeShare.present(urls: outputs)
                    }
                    .disabled(saving || job != nil)
                }
            }
            .tifloScreenSurface()
            .navigationTitle("Convertir documento")
            .toolbar {
                Button("Cerrar") {
                    if outputs.contains(where: { !saved.contains($0) }) { confirmClose = true }
                    else { dismiss() }
                }.disabled(saving || job != nil)
            }
            .interactiveDismissDisabled(saving || job != nil || outputs.contains { !saved.contains($0) })
            .confirmationDialog("¿Descartar los archivos convertidos que no has guardado en la biblioteca?",
                isPresented: $confirmRestart, titleVisibility: .visible) {
                Button("Descartar e iniciar conversión", role: .destructive) { start() }
                Button("Cancelar", role: .cancel) {}
            }
            .confirmationDialog("¿Descartar los archivos convertidos que no has guardado en la biblioteca?",
                isPresented: $confirmClose, titleVisibility: .visible) {
                Button("Descartar y cerrar", role: .destructive) { dismiss() }
                Button("Cancelar", role: .cancel) {}
            }
            .onDisappear { job?.cancel() }
        }
    }

    private func start() {
        guard job == nil, !saving else { return }
        let nextWorkspace = NativeConversionWorkspace()
        workspace = nextWorkspace
        let selected = format
        resultFormat = selected
        status = ""
        failures = []
        outputs = []
        saved = []
        position = 1
        progress = 0
        job = Task { @MainActor in
            var cancelled = false
            defer { job = nil; withExtendedLifetime(nextWorkspace) {} }
            for (index, source) in sources.enumerated() {
                guard !Task.isCancelled else { cancelled = true; break }
                position = index + 1
                let events = AsyncStream<Double>.makeStream(bufferingPolicy: .bufferingNewest(1))
                let monitor = Task { @MainActor in
                    for await value in events.stream {
                        progress = (Double(index) + value) / Double(sources.count)
                    }
                }
                let target = nextWorkspace.directory.appendingPathComponent(String(index), isDirectory: true)
                let worker = Task.detached(priority: .userInitiated) {
                    defer { events.continuation.finish() }
                    return try NativeDocumentConversion.convert(source, to: selected, in: target) {
                        events.continuation.yield($0)
                    }
                }
                do {
                    let output = try await withTaskCancellationHandler {
                        try await worker.value
                    } onCancel: { worker.cancel() }
                    outputs.append(output)
                } catch is CancellationError {
                    cancelled = true
                } catch {
                    failures.append(MusicLocalized.format("No se pudo convertir «%@».", source.title))
                }
                await monitor.value
                if cancelled { break }
                progress = Double(index + 1) / Double(sources.count)
            }
            let summary = MusicLocalized.format("Documentos convertidos: %d. Fallidos: %d.", outputs.count, failures.count)
            status = cancelled || Task.isCancelled
                ? MusicLocalized.message("Conversión cancelada.") + " " + summary : summary
            UIAccessibility.post(notification: .announcement, argument: status)
        }
    }

    private func saveResults() {
        guard !saving, job == nil else { return }
        saving = true
        Task { @MainActor in
            defer { saving = false }
            var failed = 0
            for url in outputs where !saved.contains(url) {
                status = MusicLocalized.format("Guardando «%@».", url.lastPathComponent)
                do {
                    try await library.importFile(from: url)
                    saved.insert(url)
                } catch { failed += 1 }
            }
            status = MusicLocalized.format("Documentos guardados: %d. Fallidos: %d.", saved.count, failed)
            UIAccessibility.post(notification: .announcement, argument: status)
        }
    }
}
