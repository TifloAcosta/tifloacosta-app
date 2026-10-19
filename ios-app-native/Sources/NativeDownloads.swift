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
    @Published private(set) var analysis: NativeAnalyzedDownload?
    @Published private(set) var canDownload = false
    @Published var checking = false
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

    func clearAnalysis() {
        analysis = nil
        canDownload = false
        message = nil
    }

    // Analyze is a separate, accessible action. A HEAD request checks the
    // server where possible without saving a page as a document.
    func analyze(_ raw: String) async {
        analysis = nil
        canDownload = false
        message = nil
        checking = true
        defer { checking = false }
        do {
            let item = try NativeAnalyzedDownload.inspect(raw)
            analysis = item
            var note = "El servidor se comprobará al descargar."
            var request = URLRequest(url: item.downloadURL)
            request.httpMethod = "HEAD"
            request.timeoutInterval = 15
            do {
                let (_, response) = try await URLSession.shared.data(for: request)
                if let http = response as? HTTPURLResponse, http.statusCode == 405 {
                    note = "El servidor no admite análisis previo; se comprobará al descargar."
                } else {
                    try NativeAnalyzedDownload.verifyResponse(response, for: item)
                    note = "El servidor ha respondido correctamente."
                }
            } catch let error as NativeDownloadLinkError {
                if item.isGoogleDrive {
                    switch error {
                    case .accessDenied, .webPageInsteadOfFile:
                        // Google Drive may refuse HEAD while allowing a normal
                        // download. Only the actual GET can confirm its access.
                        canDownload = true
                        message = "Enlace de Google Drive reconocido, pero no se pudo verificar el acceso previamente. Prueba Descargar. Si falla, abre el enlace original y revisa sus permisos."
                        return
                    default: break
                    }
                }
                message = error.localizedDescription
                return
            } catch {
                // Some file hosts block HEAD but accept GET. Do not report a
                // successful accessibility check when none was possible.
                note = "No se pudo verificar el acceso previo. Se comprobará al descargar."
            }
            canDownload = true
            message = "\(item.type) reconocido. \(note)"
        } catch {
            message = error.localizedDescription
        }
    }

    func download(_ item: NativeAnalyzedDownload) async {
        guard !busy else { return }
        busy = true
        defer { busy = false }
        message = "Descargando archivo…"
        do {
            let (temporary, response) = try await NativeDriveTransfer.download(item)
            try NativeAnalyzedDownload.verifyResponse(response, for: item)
            let size = (try? temporary.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0
            guard size > 0 else { throw NativeDownloadLinkError.emptyFile }
            guard size <= 100 * 1024 * 1024 else { throw NativeDownloadLinkError.tooLarge }

            let proposed = response.suggestedFilename ?? ""
            let generic = ["", "uc", "download", "export"]
            var name = generic.contains(proposed.lowercased()) ? item.fallbackFilename : proposed
            name = URL(fileURLWithPath: name).lastPathComponent
                .replacingOccurrences(of: "[\\\\/:*?\"<>|\\p{C}]", with: "-", options: .regularExpression)
                .trimmingCharacters(in: .whitespacesAndNewlines)
            if name.isEmpty { name = "Archivo" }
            if URL(fileURLWithPath: name).pathExtension.isEmpty,
               let mimeType = response.mimeType,
               let suffix = UTType(mimeType: mimeType)?.preferredFilenameExtension {
                name += "." + suffix
            }
            try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
            let destination = folder.appendingPathComponent(UUID().uuidString + "-" + String(name.prefix(120)))
            try FileManager.default.copyItem(at: temporary, to: destination)
            refresh()
            message = "Archivo descargado en TifloAcosta: \(name). Está disponible en Mis descargas para importar a TifloLector o compartir."
        } catch let error as NativeDownloadLinkError {
            message = error.localizedDescription
        } catch let error as URLError {
            switch error.code {
            case .timedOut:
                message = "La descarga ha agotado el tiempo de espera. Comprueba la conexión."
            case .notConnectedToInternet, .networkConnectionLost:
                message = "No hay conexión a Internet disponible para descargar."
            default:
                message = "No fue posible descargar el archivo. Comprueba el enlace y vuelve a intentarlo."
            }
        } catch {
            message = "No se pudo guardar el archivo: \(error.localizedDescription)"
        }
    }

    func delete(_ item: NativeDownload) throws {
        try FileManager.default.removeItem(at: item.url)
        refresh()
    }
}

struct NativeDownloadsScreen: View {
    @EnvironmentObject private var library: NativeReaderLibrary
    @StateObject private var store = NativeDownloadStore()
    @State private var address = ""
    @State private var alertText: String?
    @State private var pendingDeletion: NativeDownload?

    private func announce() {
        if let message = store.message {
            UIAccessibility.post(notification: .announcement, argument: message)
        }
    }

    private func importFile(_ file: NativeDownload) {
        do {
            try library.importDocuments(from: [file.url])
            alertText = "«\(file.title)» importado a TifloLector."
        } catch {
            alertText = "No se pudo importar «\(file.title)»: \(error.localizedDescription)"
        }
    }

    var body: some View {
        List {
            Section("Descargar desde un enlace") {
                TextField("Enlace HTTPS", text: $address)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .keyboardType(.URL)
                    .accessibilityLabel("Dirección del archivo")
                    .onChange(of: address) { _, _ in store.clearAnalysis() }

                Button("Pegar enlace") {
                    address = UIPasteboard.general.string ?? ""
                }

                Button(store.checking ? "Analizando enlace" : "Analizar enlace") {
                    Task {
                        await store.analyze(address)
                        announce()
                    }
                }
                .disabled(store.checking || store.busy || address.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)

                if let analysis = store.analysis {
                    Text("Contenido: \(analysis.type)")
                        .font(.subheadline)
                        .foregroundStyle(TifloVisual.secondaryText)
                    Button(store.busy ? "Descargando en TifloAcosta" : "Descargar en TifloAcosta") {
                        Task {
                            await store.download(analysis)
                            announce()
                        }
                    }
                    .disabled(store.busy || store.checking || !store.canDownload)
                    Link("Abrir enlace original", destination: analysis.sourceURL)
                        .accessibilityHint("Abre el enlace fuera de TifloAcosta para revisar permisos.")
                }
                if store.checking { ProgressView("Analizando enlace") }
                if store.busy { ProgressView("Descargando archivo") }
                if let message = store.message {
                    Text(message)
                        .foregroundStyle(TifloVisual.primaryText)
                        .accessibilityAddTraits(.updatesFrequently)
                }
            }
            .listRowBackground(TifloVisual.surfaceRaised)

            Section("Mis descargas") {
                if store.downloads.isEmpty {
                    Text("Todavía no hay archivos descargados.")
                }
                ForEach(store.downloads) { file in
                    Button {
                        importFile(file)
                    } label: {
                        Text(file.title)
                            .foregroundStyle(TifloVisual.primaryText)
                            .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
                    }
                    .accessibilityLabel(file.title)
                    .accessibilityHint("Doble toque para importar en TifloLector. Otras acciones: Compartir y Eliminar.")
                    .accessibilityAction(named: Text("Importar en TifloLector")) { importFile(file) }
                    .accessibilityAction(named: Text("Compartir")) { NativeShare.present(url: file.url) }
                    .accessibilityAction(named: Text("Eliminar")) { pendingDeletion = file }
                }
                Text("Los archivos descargados se guardan en esta sección hasta que los elimines. Importarlos en TifloLector añade una copia a su biblioteca.")
                    .font(.footnote)
                    .foregroundStyle(TifloVisual.secondaryText)
            }
            .listRowBackground(TifloVisual.surfaceRaised)
        }
        .tifloScreenSurface()
        .navigationTitle("Descargas")
        .alert("Resultado", isPresented: Binding(
            get: { alertText != nil },
            set: { if !$0 { alertText = nil } }
        )) {
            Button("Aceptar", role: .cancel) { alertText = nil }
        } message: {
            Text(alertText ?? "")
        }
        .confirmationDialog(
            "Eliminar descarga",
            isPresented: Binding(
                get: { pendingDeletion != nil },
                set: { if !$0 { pendingDeletion = nil } }
            ),
            titleVisibility: .visible
        ) {
            Button("Eliminar definitivamente", role: .destructive) {
                if let file = pendingDeletion {
                    do { try store.delete(file) }
                    catch { alertText = error.localizedDescription }
                }
                pendingDeletion = nil
            }
            Button("Cancelar", role: .cancel) { pendingDeletion = nil }
        } message: {
            Text("Este archivo se eliminará de Mis descargas, pero no de TifloLector si ya lo importaste.")
        }
    }
}
