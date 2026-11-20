import SwiftUI
import UIKit

/// A client of the global cloud accounts. Other TifloAcosta sections may
/// reuse the account and selection APIs with their own file import handlers.
struct NativeCloudGooglePickerScreen: View {
    let onImport: (URL) -> Void

    @StateObject private var accounts = NativeCloudAccountStore.shared
    @State private var selection: [NativeCloudItem] = []
    @State private var loading = false
    @State private var importingID: String?
    @State private var alertMessage: String?

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
            Section("Archivos seleccionados") {
                if selection.isEmpty {
                    Text("Selecciona archivos de audio en Google Drive para importarlos.")
                }
                ForEach(selection) { item in
                    if item.isFolder {
                        Text("Carpeta: \(item.name)")
                    } else {
                        Button(importingID == item.id ? "Importando \(item.name)…" : "Importar \(item.name)") {
                            Task { await importItem(item) }
                        }
                        .disabled(loading || importingID != nil)
                        .accessibilityLabel("Importar \(item.name) desde Google Drive")
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
    }

    private func selectFiles() async {
        loading = true
        defer { loading = false }
        do {
            selection = try await accounts.selectGoogleDriveFiles()
            UIAccessibility.post(notification: .announcement,
                                 argument: "\(selection.count) elementos seleccionados en Google Drive")
        } catch is CancellationError {
            // Leaving the Google consent screen is not a failed import.
        } catch {
            alertMessage = error.localizedDescription
        }
    }

    private func importItem(_ item: NativeCloudItem) async {
        importingID = item.id
        defer { importingID = nil }
        do {
            let token = try await accounts.validAccessToken(for: .googleDrive)
            let cloud = try NativeCloudStorage(provider: .googleDrive, accessToken: token)
            let file = try await cloud.download(item)
            onImport(file)
            UIAccessibility.post(notification: .announcement, argument: "Importado \(item.name)")
        } catch {
            alertMessage = error.localizedDescription
        }
    }
}
