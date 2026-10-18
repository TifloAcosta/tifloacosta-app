import Foundation
import SwiftUI
import UniformTypeIdentifiers
import UIKit

struct NativeDownload: Identifiable {
    let id: URL
    let title: String
    var url: URL { id }
}

@MainActor
final class NativeDownloadStore: ObservableObject {
    @Published private(set) var downloads: [NativeDownload] = []
    @Published var busy = false
    @Published var message: String?

    private var folder: URL {
        FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("TifloAcostaDescargas", isDirectory: true)
    }

    init() { refresh() }

    func refresh() {
        let entries = (try? FileManager.default.contentsOfDirectory(
            at: folder, includingPropertiesForKeys: nil
        )) ?? []
        downloads = entries
            .filter { !$0.hasDirectoryPath }
            .map { url in
                let name = url.lastPathComponent
                let label = name.split(separator: "-", maxSplits: 1)
                    .dropFirst().first.map(String.init) ?? name
                return NativeDownload(id: url, title: label)
            }
            .sorted { $0.title.localizedStandardCompare($1.title) == .orderedAscending }
    }

    func download(_ raw: String) async {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let url = URL(string: trimmed), url.scheme == "https", url.host != nil else {
            message = "Introduce un enlace HTTPS válido."
            return
        }
        busy = true
        defer { busy = false }
        do {
            let (temporary, response) = try await URLSession.shared.download(from: url)
            if let http = response as? HTTPURLResponse, http.statusCode != 200 {
                throw URLError(.badServerResponse)
            }
            let size = (try? temporary.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0
            guard size <= 100 * 1024 * 1024 else { throw CocoaError(.fileReadTooLarge) }
            let candidate = response.suggestedFilename ?? url.lastPathComponent
            let safe = URL(fileURLWithPath: candidate).lastPathComponent
                .replacingOccurrences(of: "/", with: "-")
            let filename = safe.isEmpty ? "Archivo" : safe
            try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
            let destination = folder.appendingPathComponent(UUID().uuidString + "-" + filename)
            try FileManager.default.copyItem(at: temporary, to: destination)
            refresh()
            message = "Archivo descargado: \(filename)"
        } catch {
            message = "No se pudo descargar el archivo: \(error.localizedDescription)"
        }
    }

    func delete(_ item: NativeDownload) {
        try? FileManager.default.removeItem(at: item.url)
        refresh()
    }
}

struct NativeDownloadsScreen: View {
    @EnvironmentObject private var library: NativeReaderLibrary
    @StateObject private var store = NativeDownloadStore()
    @State private var address = ""
    @State private var alertText: String?

    var body: some View {
        List {
            Section("Descargar desde un enlace") {
                TextField("Enlace HTTPS", text: $address)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .keyboardType(.URL)
                Button("Pegar enlace") {
                    address = UIPasteboard.general.string ?? ""
                }
                Button(store.busy ? "Descargando" : "Descargar") {
                    Task { await store.download(address) }
                }
                .disabled(store.busy)
                if store.busy { ProgressView("Descargando archivo") }
                if let message = store.message { Text(message) }
            }

            Section("Mis descargas") {
                if store.downloads.isEmpty { Text("Todavía no hay archivos descargados.") }
                ForEach(store.downloads) { file in
                    HStack {
                        Text(file.title)
                        Spacer()
                        ShareLink(item: file.url) {
                            Text("Compartir")
                        }
                    }
                    .accessibilityElement(children: .contain)
                    .accessibilityAction(named: Text("Importar en TifloLector")) {
                        do {
                            try library.importDocuments(from: [file.url])
                        } catch {
                            alertText = error.localizedDescription
                        }
                    }
                    .swipeActions {
                        Button("Eliminar", role: .destructive) { store.delete(file) }
                    }
                }
            }
        }
        .navigationTitle("Descargas")
        .alert("No se pudo importar", isPresented: Binding(
            get: { alertText != nil },
            set: { if !$0 { alertText = nil } }
        )) {
            Button("Aceptar", role: .cancel) { alertText = nil }
        } message: {
            Text(alertText ?? "")
        }
    }
}
