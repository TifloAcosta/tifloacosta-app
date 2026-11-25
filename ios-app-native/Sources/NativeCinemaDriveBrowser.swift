import SwiftUI
import AVFoundation
import UIKit

/// Cinema's first reusable cloud source connector. Files are selected with
/// the already-approved Google OAuth + Picker and never redistributed.
/// This is separate from a publisher-curated automatic public folder feed.
@MainActor
struct NativeCinemaDriveBrowser: View {
    let sourceID: String
    let sourceName: String

    @StateObject private var accounts = NativeCloudAccountStore.shared
    @ObservedObject private var player = NativeCinemaAudioPlayer.shared
    @ObservedObject private var network = NativeMusicConnectionPolicy.shared
    @StateObject private var personalLibrary = NativeCinemaLocalLibrary.shared
    @AppStorage("cinema.cellularDownloads") private var allowCellularDownloads = false

    @State private var folders: [NativeCloudItem] = []
    @State private var files: [NativeCloudItem] = []
    @State private var nextCursor: String?
    @State private var search = ""
    @State private var loading = false
    @State private var downloadingID: String?
    @State private var message: String?
    @State private var alertMessage: String?

    private var storedFolderKey: String { "cinema.drive.root." + sourceID }

    private var shownFiles: [NativeCloudItem] {
        let query = search.trimmingCharacters(in: .whitespacesAndNewlines)
        return files.filter { item in
            (item.isFolder || Self.supportsCinema(item.name))
                && (query.isEmpty || item.name.localizedStandardContains(query))
        }.sorted {
            if $0.isFolder != $1.isFolder { return $0.isFolder }
            return $0.name.localizedStandardCompare($1.name) == .orderedAscending
        }
    }

    private var thisSourceIsPlaying: Bool {
        player.currentCloudReference?.hasPrefix("gdrive:" + sourceID + ":") == true
    }

    private static func supportsCinema(_ name: String) -> Bool {
        let ext = (name as NSString).pathExtension.lowercased()
        return ["mp3", "m4a", "m4b", "aac", "wav", "aif",
                "aiff", "caf", "flac", "mp4", "m4v", "mov"].contains(ext)
    }

    var body: some View {
        List {
            Section("Carpeta compartida de Google Drive") {
                Text("Se utilizará tu conexión segura de Google Drive. Elige una carpeta que tengas permiso para consultar. Solo se descargarán las obras que selecciones.")
                    .font(.footnote)
                if accounts.isAvailable(.googleDrive) {
                    Button(loading ? "Abriendo Google Drive…" : "Elegir carpeta autorizada") {
                        Task { await chooseRootFolder() }
                    }
                    .disabled(loading || downloadingID != nil)
                    if !folders.isEmpty {
                        Text(MusicLocalized.message("Carpeta: ") + folders.map(\.name).joined(separator: " / "))
                            .font(.subheadline)
                        if folders.count > 1 {
                            Button("Volver a la carpeta anterior") {
                                folders.removeLast()
                                Task { await loadFolder(reset: true) }
                            }
                            .disabled(loading)
                        }
                        Button("Actualizar esta carpeta") {
                            Task { await loadFolder(reset: true) }
                        }
                        .disabled(loading)
                        Button("Cambiar carpeta de origen") {
                            Task { await chooseRootFolder() }
                        }
                        .disabled(loading)
                    }
                    Toggle("Permitir descargas mediante datos móviles", isOn: $allowCellularDownloads)
                } else {
                    Text("Google Drive todavía no está configurado en esta compilación.")
                }
            }

            if !folders.isEmpty {
                Section("Archivos y subcarpetas") {
                    TextField("Buscar dentro de esta carpeta", text: $search)
                        .textInputAutocapitalization(.never)
                        .submitLabel(.search)
                    if loading {
                        ProgressView("Consultando la carpeta…")
                    } else if shownFiles.isEmpty {
                        Text("No hay archivos de audio o vídeo compatibles en esta carpeta.")
                    }
                    ForEach(shownFiles) { item in
                        if item.isFolder {
                            Button(MusicLocalized.message("Abrir carpeta: ") + item.name) {
                                folders.append(item)
                                search = ""
                                Task { await loadFolder(reset: true) }
                            }
                            .disabled(loading || downloadingID != nil)
                        } else {
                            Button(downloadingID == item.id
                                ? MusicLocalized.message("Descargando: ") + item.name
                                : MusicLocalized.message("Descargar temporalmente y reproducir: ") + item.name) {
                                Task { await loadAndPlay(item) }
                            }
                            .disabled(loading || downloadingID != nil)
                        }
                    }
                    if nextCursor != nil {
                        Button("Cargar más archivos de esta carpeta") {
                            Task { await loadFolder(reset: false) }
                        }
                        .disabled(loading || downloadingID != nil)
                    }
                }
            }

            if thisSourceIsPlaying {
                Section("Reproducción desde Google Drive") {
                    Text("El archivo se ha descargado temporalmente para reproducirse. No se ha importado a tu colección personal.")
                        .font(.footnote)
                    if let error = player.playbackError {
                        Text(error)
                            .accessibilityAddTraits(.updatesFrequently)
                    }
                    if player.currentCloudIsVideo, let video = player.videoPlayer {
                        NativeCinemaVideoSurface(player: video)
                            .frame(maxWidth: .infinity)
                            .frame(height: 210)
                            .accessibilityHidden(true)
                    }
                    NativeCinemaTransportControls(player: player, library: personalLibrary)
                }
            }

            if let message {
                Section("Estado") {
                    Text(message)
                        .accessibilityAddTraits(.updatesFrequently)
                }
            }
        }
        .navigationTitle(sourceName)
        .tifloScreenSurface()
        .task { await restoreFolder() }
        .alert("Google Drive", isPresented: Binding(
            get: { alertMessage != nil },
            set: { if !$0 { alertMessage = nil } }
        )) {
            Button("Aceptar") { alertMessage = nil }
        } message: {
            Text(alertMessage ?? "")
        }
    }

    private func restoreFolder() async {
        guard folders.isEmpty,
              let id = UserDefaults.standard.string(forKey: storedFolderKey),
              !id.isEmpty else { return }
        folders = [NativeCloudItem(id: id, name: "Carpeta seleccionada",
                                   isFolder: true, size: nil, provider: .googleDrive)]
        // An expired login must not delete the user's saved folder choice.
        if accounts.connected.contains(.googleDrive) {
            await loadFolder(reset: true)
        } else {
            message = MusicLocalized.message("Vuelve a elegir la carpeta para autorizar el acceso con Google Drive.")
        }
    }

    private func chooseRootFolder() async {
        guard !loading, downloadingID == nil else { return }
        loading = true
        defer { loading = false }
        do {
            let selected = try await accounts.selectGoogleDriveFiles()
            guard let folder = selected.first(where: \.isFolder) else {
                // Picker may offer individual files; do not treat one as a folder.
                message = MusicLocalized.message("Selecciona una carpeta en Google Drive, no un archivo.")
                return
            }
            folders = [folder]
            UserDefaults.standard.set(folder.id, forKey: storedFolderKey)
            files = []
            nextCursor = nil
            message = nil
            loading = false
            await loadFolder(reset: true)
            UIAccessibility.post(notification: .announcement, argument: MusicLocalized.message("Carpeta seleccionada: ") + folder.name)
        } catch is CancellationError {
            // Cancellation is not an authorization error.
        } catch {
            alertMessage = error.localizedDescription
        }
    }

    private func loadFolder(reset: Bool) async {
        guard let folder = folders.last, !loading else { return }
        loading = true
        defer { loading = false }
        do {
            let token = try await accounts.validAccessToken(for: .googleDrive)
            let storage = try NativeCloudStorage(provider: .googleDrive, accessToken: token)
            let page = try await storage.listFolder(id: folder.id, cursor: reset ? nil : nextCursor)
            if reset { files = page.items } else { files.append(contentsOf: page.items) }
            nextCursor = page.nextCursor
            message = nil
            UIAccessibility.post(notification: .announcement, argument: MusicLocalized.format("%d elementos en %@", files.count, folder.name))
        } catch {
            // No fallback to broad Drive scopes or undocumented public sharing.
            nextCursor = nil
            alertMessage = MusicLocalized.message("No se pudo leer esta carpeta con los permisos actuales de Google Drive. ") +
                MusicLocalized.message("Vuelve a elegirla con Google Picker o consulta el enlace original. ") + error.localizedDescription
        }
    }

    private func loadAndPlay(_ item: NativeCloudItem) async {
        guard downloadingID == nil, !loading else { return }
        guard network.canDownload(allowCellular: allowCellularDownloads) else {
            alertMessage = MusicLocalized.message("La descarga está limitada a Wi-Fi. Activa los datos móviles si quieres permitirla.")
            return
        }
        downloadingID = item.id
        message = MusicLocalized.message("Descargando ") + item.name +
            MusicLocalized.message(". La reproducción comenzará al terminar.")
        defer { downloadingID = nil }
        var temporary: URL?
        do {
            let token = try await accounts.validAccessToken(for: .googleDrive)
            let storage = try NativeCloudStorage(provider: .googleDrive, accessToken: token)
            let file = try await storage.downloadCinema(item, allowsCellular: allowCellularDownloads)
            temporary = file
            try player.openTemporaryFile(
                file, title: item.name,
                reference: "gdrive:" + sourceID + ":" + item.id,
                library: personalLibrary
            )
            temporary = nil // NativeCinemaAudioPlayer owns file and cleanup.
            message = MusicLocalized.message("Reproduciendo: ") + item.name
            UIAccessibility.post(notification: .announcement, argument: message)
        } catch {
            if let temporary {
                try? FileManager.default.removeItem(at: temporary)
            }
            message = nil
            alertMessage = error.localizedDescription
        }
    }
}
