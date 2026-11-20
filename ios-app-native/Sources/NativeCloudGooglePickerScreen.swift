import SwiftUI
import UIKit

/// A client of the global cloud accounts. Other TifloAcosta sections may
/// reuse the account and selection APIs with their own file import handlers.
struct NativeCloudGooglePickerScreen: View {
    let onImport: (URL) -> Void
    var allowCellularDownloads = true

    @StateObject private var accounts = NativeCloudAccountStore.shared
    @ObservedObject private var network = NativeMusicConnectionPolicy.shared
    @State private var selection: [NativeCloudItem] = []
    @State private var loading = false
    @State private var importingID: String?
    @State private var alertMessage: String?
    @State private var pendingDownload: NativeCloudItem?

    var body: some View {
        List {
            Section("Cuenta") {
                if accounts.isAvailable(.googleDrive) {
                    Button(loading ? "Abriendo Google Drive…" : "Elegir archivos de Google Drive") {
                        Task { await selectFiles() }
                    }
                    .disabled(loading || importingID != nil)
                    .accessibilityLabel("Elegir archivos de Google Drive")
                    if accounts.connected.contains(.googleDrive) {
                        Button("Desconectar Google Drive", role: .destructive) {
                            accounts.disconnect(provider: .googleDrive)
                            selection = []
                        }
                    }
                } else {
                    Text("Google Drive todavía no está configurado en esta compilación.")
                }
            }
            if !selection.isEmpty {
                Section("Archivos seleccionados") {
                    ForEach(selection) { item in
                        if item.isFolder {
                            Text("Carpeta: \(item.name)")
                        } else {
                            Button(importingID == item.id ? "Importando \(item.name)…" : "Importar \(item.name)") {
                                requestImport(item)
                            }
                            .disabled(loading || importingID != nil)
                            .accessibilityLabel(MusicLocalized.format("Importar %@ desde Google Drive", item.name))
                        }
                    }
                }
            }
        }
        .navigationTitle("Google Drive")
        .alert("Google Drive", isPresented: Binding(
            get: { alertMessage != nil },
            set: { if !$0 { alertMessage = nil } }
        )) {
            Button("Aceptar") { alertMessage = nil }
        } message: {
            Text(alertMessage ?? "")
        }
        .alert("Descarga con datos móviles", isPresented: Binding(
            get: { pendingDownload != nil },
            set: { if !$0 { pendingDownload = nil } }
        )) {
            Button("Usar datos una vez") {
                if let item = pendingDownload { Task { await importItem(item, allowCellular: true) } }
                pendingDownload = nil
            }
            Button("Cancelar", role: .cancel) { pendingDownload = nil }
        } message: {
            Text("La descarga está limitada a Wi-Fi. Puedes autorizar solo este archivo con datos móviles.")
        }
    }

    private func selectFiles() async {
        loading = true
        defer { loading = false }
        do {
            selection = try await accounts.selectGoogleDriveFiles()
            UIAccessibility.post(notification: .announcement,
                                 argument: MusicLocalized.format("%d elementos seleccionados en Google Drive", selection.count))
        } catch is CancellationError {
            // Leaving the Google consent screen is not a failed import.
        } catch {
            alertMessage = error.localizedDescription
        }
    }

    private func requestImport(_ item: NativeCloudItem) {
        if !network.canDownload(allowCellular: allowCellularDownloads) {
            pendingDownload = item
        } else {
            Task { await importItem(item, allowCellular: allowCellularDownloads) }
        }
    }

    private func importItem(_ item: NativeCloudItem, allowCellular: Bool) async {
        importingID = item.id
        defer { importingID = nil }
        do {
            guard network.canDownload(allowCellular: allowCellular) else {
                alertMessage = MusicLocalized.message("No hay una conexión permitida para descargar este archivo.")
                return
            }
            let token = try await accounts.validAccessToken(for: .googleDrive)
            let cloud = try NativeCloudStorage(provider: .googleDrive, accessToken: token)
            let file = try await cloud.download(item, allowsCellular: allowCellular)
            onImport(file)
            UIAccessibility.post(notification: .announcement, argument: MusicLocalized.format("Importado %@", item.name))
        } catch {
            alertMessage = error.localizedDescription
        }
    }
}
