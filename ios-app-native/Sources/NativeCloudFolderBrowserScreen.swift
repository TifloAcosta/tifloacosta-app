import SwiftUI
import UIKit

/// Shared cloud file explorer. Each TifloAcosta module supplies its own importer.
struct NativeCloudFolderBrowserScreen: View {
    let provider: NativeCloudProvider
    let onImport: (URL) -> Void
    var allowCellularDownloads = true

    @StateObject private var accounts = NativeCloudAccountStore.shared
    @ObservedObject private var network = NativeMusicConnectionPolicy.shared
    @State private var folderID: String?
    @State private var folderHistory: [String?] = []
    @State private var items: [NativeCloudItem] = []
    @State private var nextCursor: String?
    @State private var busy = false
    @State private var importingID: String?
    @State private var error: String?
    @State private var pendingDownload: NativeCloudItem?

    var body: some View {
        List {
            Section("Cuenta") {
                if !accounts.isAvailable(provider) {
                    Text("La conexión todavía no está configurada en esta compilación.")
                } else if !accounts.connected.contains(provider) {
                    Button("Conectar cuenta") { Task { await connect() } }
                        .disabled(busy)
                } else {
                    Button("Desconectar cuenta", role: .destructive) {
                        accounts.disconnect(provider: provider)
                        items = []
                        folderHistory = []
                        folderID = nil
                        nextCursor = nil
                    }
                    Button("Actualizar archivos") { Task { await loadFolder(id: folderID) } }
                        .disabled(busy)
                }
            }
            if accounts.connected.contains(provider) {
                Section("Archivos y carpetas") {
                    if !folderHistory.isEmpty {
                        Button("Volver a la carpeta anterior") {
                            let previous = folderHistory.removeLast()
                            Task { await loadFolder(id: previous) }
                        }
                    }
                    if items.isEmpty && !busy { Text("No hay archivos en esta carpeta.") }
                    ForEach(items) { item in
                        if item.isFolder {
                            Button("Abrir carpeta: \(item.name)") {
                                folderHistory.append(folderID)
                                Task { await loadFolder(id: item.id) }
                            }
                            .disabled(busy)
                        } else {
                            Button("Importar \(item.name)") { requestImport(item) }
                                .disabled(busy || importingID != nil)
                                .accessibilityLabel(MusicLocalized.format("Importar %@ desde %@", item.name, provider.title))
                        }
                    }
                    if nextCursor != nil {
                        Button("Cargar más archivos") { Task { await loadNextPage() } }
                            .disabled(busy)
                    }
                }
            }
        }
        .navigationTitle(provider.title)
        .task {
            if accounts.connected.contains(provider) { await loadFolder(id: nil) }
        }
        .alert(provider.title, isPresented: Binding(
            get: { error != nil }, set: { if !$0 { error = nil } }
        )) { Button("Aceptar") { error = nil } } message: { Text(error ?? "") }
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

    private func connect() async {
        busy = true
        defer { busy = false }
        do {
            try await accounts.connect(provider: provider)
            await loadFolder(id: nil)
        } catch is CancellationError {
            // User cancelled the provider's consent screen.
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func loadFolder(id: String?) async {
        busy = true
        defer { busy = false }
        do {
            let token = try await accounts.validAccessToken(for: provider)
            let storage = try NativeCloudStorage(provider: provider, accessToken: token)
            let page = try await storage.listFolder(id: id)
            folderID = id
            items = page.items
            nextCursor = page.nextCursor
            UIAccessibility.post(notification: .announcement, argument: MusicLocalized.format("%d elementos", items.count))
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func loadNextPage() async {
        guard let cursor = nextCursor else { return }
        busy = true
        defer { busy = false }
        do {
            let token = try await accounts.validAccessToken(for: provider)
            let storage = try NativeCloudStorage(provider: provider, accessToken: token)
            let page = try await storage.listFolder(id: folderID, cursor: cursor)
            items.append(contentsOf: page.items)
            nextCursor = page.nextCursor
        } catch {
            self.error = error.localizedDescription
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
                error = MusicLocalized.message("No hay una conexión permitida para descargar este archivo.")
                return
            }
            let token = try await accounts.validAccessToken(for: provider)
            let storage = try NativeCloudStorage(provider: provider, accessToken: token)
            let file = try await storage.download(item, allowsCellular: allowCellular)
            onImport(file)
            UIAccessibility.post(notification: .announcement, argument: MusicLocalized.format("Importado %@", item.name))
        } catch {
            self.error = error.localizedDescription
        }
    }
}
