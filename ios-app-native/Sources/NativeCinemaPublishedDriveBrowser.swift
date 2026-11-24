import SwiftUI
import AVFoundation
import UIKit

/// Catalogue driven by the publisher's current public Google Drive tree.
/// No user Google account required; nothing is indexed or cached persistently.
/// A title removed by the publisher disappears on the next refresh.
@MainActor
struct NativeCinemaPublishedDriveBrowser: View {
    let sourceID: String
    let sourceName: String

    @ObservedObject private var player = NativeCinemaAudioPlayer.shared
    @ObservedObject private var network = NativeMusicConnectionPolicy.shared
    @StateObject private var library = NativeCinemaLocalLibrary.shared
    @AppStorage("cinema.cellularDownloads") private var allowCellularDownloads = false

    @State private var path: [NativeCinemaPublicDriveEntry] = []
    @State private var entries: [NativeCinemaPublicDriveEntry] = []
    @State private var cursor: String?
    @State private var loading = false
    @State private var downloading = false
    @State private var query = ""
    @State private var message: String?
    @State private var alertMessage: String?
    @State private var lastSelected: NativeCinemaPublicDriveEntry?

    private var currentFolder: NativeCinemaPublicDriveEntry? { path.last }
    private var activeSourcePrefix: String {
        "gdrive-public:" + sourceID + ":" + ":"
    }
    private var isThisSourcePlaying: Bool {
        player.currentCloudReference?.hasPrefix(activeSourcePrefix) == true
    }
    private var filtered: [NativeCinemaPublicDriveEntry] {
        let search = query.trimmingCharacters(in: .whitespacesAndNewlines)
        return entries.filter {
            ($0.isFolder || $0.isSupportedMedia) &&
                (search.isEmpty || $0.name.localizedStandardContains(search))
        }.sorted {
            if $0.isFolder != $1.isFolder { return $0.isFolder }
            return $0.name.localizedStandardCompare($1.name) == .orderedAscending
        }
    }
    private var providerLink: URL? {
        guard let first = path.first else { return nil }
        var address = URLComponents(string: "https://drive.google.com/drive/folders/" + first.id)
        if let key = first.resourceKey {
            address?.queryItems = [URLQueryItem(name: "resourcekey", value: key)]
        }
        return address?.url
    }
    private var isCurrentPlaybackFailed: Bool {
        isThisSourcePlaying && player.playbackError != nil
    }

    var body: some View {
        List {
            if let folder = currentFolder {
                Section("Biblioteca de audiodescripción") {
                    Text(folder.name)
                        .font(.headline)
                        .accessibilityAddTraits(.isHeader)
                    if path.count > 1 {
                        Button("Volver a la carpeta anterior") {
                            path.removeLast()
                            query = ""
                            Task { await loadPage(reset: true) }
                        }
                        .disabled(loading || downloading)
                    }
                    Button("Actualizar esta carpeta") {
                        Task { await loadPage(reset: true) }
                    }
                    .disabled(loading || downloading)
                    if let providerLink {
                        Link("Abrir carpeta original en Google Drive", destination: providerLink)
                    }
                }

                Section("Obras disponibles") {
                    TextField("Buscar dentro de esta carpeta", text: $query)
                        .textInputAutocapitalization(.never)
                        .submitLabel(.search)
                    if loading {
                        ProgressView("Consultando la carpeta…")
                    } else if filtered.isEmpty {
                        Text("No hay obras compatibles en esta carpeta.")
                    }
                    ForEach(filtered) { entry in
                        if entry.isFolder {
                            Button(MusicLocalized.message("Abrir carpeta: ") + entry.name) {
                                path.append(entry)
                                query = ""
                                Task { await loadPage(reset: true) }
                            }
                            .disabled(loading || downloading)
                        } else {
                            Button(MusicLocalized.message("Reproducir: ") + entry.name) {
                                Task { await play(entry) }
                            }
                            .disabled(loading || downloading)
                        }
                    }
                    if cursor != nil {
                        Button("Cargar más archivos de esta carpeta") {
                            Task { await loadPage(reset: false) }
                        }
                        .disabled(loading || downloading)
                    }
                }
            } else if loading {
                ProgressView("Consultando la carpeta…")
            } else {
                Section("Biblioteca de audiodescripción") {
                    Text("No se ha podido abrir el catálogo público de esta fuente.")
                    Button("Reintentar conexión") {
                        Task { await openRoot() }
                    }
                }
            }

            if isThisSourcePlaying {
                Section("Reproducción desde Google Drive") {
                    if let failure = player.playbackError {
                        Text(failure)
                            .accessibilityAddTraits(.updatesFrequently)
                    }
                    if player.currentCloudIsVideo, let video = player.videoPlayer {
                        NativeCinemaVideoSurface(player: video)
                            .frame(maxWidth: .infinity)
                            .frame(height: 210)
                            .accessibilityHidden(true)
                    }
                    Button(player.playing ? "Pausar reproducción" : "Reanudar reproducción") {
                        player.toggle(library: library)
                    }
                    .disabled(player.playbackError != nil)
                    Button("Retroceder treinta segundos") {
                        player.seek(by: -30, library: library)
                    }
                    Button("Avanzar treinta segundos") {
                        player.seek(by: 30, library: library)
                    }
                    Button("Detener reproducción") {
                        player.pauseAndSave(library: library)
                    }
                    if isCurrentPlaybackFailed, let lastSelected {
                        Button("Descargar temporalmente y reproducir") {
                            Task { await downloadAndPlay(lastSelected) }
                        }
                        .disabled(downloading)
                    }
                }
            }

            Section("Conexión") {
                Toggle("Permitir descargas mediante datos móviles", isOn: $allowCellularDownloads)
                Text("Las carpetas y los títulos se consultan directamente al proveedor. Los estrenos pueden desaparecer cuando venza su disponibilidad.")
                    .font(.footnote)
                if let message {
                    Text(message)
                        .accessibilityAddTraits(.updatesFrequently)
                }
            }
        }
        .navigationTitle(sourceName)
        .tifloScreenSurface()
        .task { if path.isEmpty { await openRoot() } }
        .alert("Google Drive", isPresented: Binding(
            get: { alertMessage != nil },
            set: { if !$0 { alertMessage = nil } }
        )) {
            Button("Aceptar") { alertMessage = nil }
        } message: {
            Text(alertMessage ?? "")
        }
    }

    private func openRoot() async {
        guard !loading else { return }
        loading = true
        defer { loading = false }
        do {
            guard NativeCinemaPublicDrive.configuredKey != nil else {
                throw NativeCinemaPublicDriveError.unconfigured
            }
            guard let root = NativeCinemaPublicDrive.publisherRoot(for: sourceID) else {
                throw NativeCinemaPublicDriveError.invalidFolder
            }
            path = [root]
            loading = false
            await loadPage(reset: true)
        } catch {
            alertMessage = error.localizedDescription
        }
    }

    private func loadPage(reset: Bool) async {
        guard !loading, let folder = currentFolder else { return }
        loading = true
        defer { loading = false }
        do {
            let service = try NativeCinemaPublicDrive()
            let page = try await service.listFolder(
                folder, ancestors: Array(path.dropLast()),
                cursor: reset ? nil : cursor
            )
            if reset {
                entries = page.entries
            } else {
                let existing = Set(entries.map(\.id))
                entries.append(contentsOf: page.entries.filter {
                    !existing.contains($0.id)
                })
            }
            cursor = page.nextCursor
            message = nil
            UIAccessibility.post(
                notification: .announcement,
                argument: MusicLocalized.format(
                    "%d elementos en %@", entries.count, folder.name)
            )
        } catch {
            if reset { entries = [] }
            cursor = nil
            alertMessage = error.localizedDescription
        }
    }

    private func reference(for entry: NativeCinemaPublicDriveEntry) -> String {
        activeSourcePrefix + entry.id
    }

    private func play(_ entry: NativeCinemaPublicDriveEntry) async {
        guard !loading, !downloading else { return }
        guard network.canDownload(allowCellular: allowCellularDownloads) else {
            alertMessage = MusicLocalized.message(
                "La descarga está limitada a Wi-Fi. Activa los datos móviles si quieres permitirla.")
            return
        }
        lastSelected = entry
        do {
            guard let loader = NativeCinemaDriveResourceLoader(
                item: entry, ancestors: path,
                allowsCellular: allowCellularDownloads) else {
                throw NativeCinemaPublicDriveError.unsupported
            }
            let asset = loader.makeAsset()
            try player.openPublicStream(
                asset: asset, loader: loader,
                title: entry.name,
                reference: reference(for: entry),
                isVideo: entry.isVideo, library: library
            )
            message = MusicLocalized.message("Reproduciendo: ") + entry.name
            UIAccessibility.post(notification: .announcement, argument: message)
        } catch NativeCinemaPublicDriveError.denied {
            // Files protected by resource keys cannot use a bare AVPlayer
            // URL; a controlled temporary transfer preserves those headers.
            await downloadAndPlay(entry)
        } catch {
            alertMessage = error.localizedDescription
        }
    }

    private func downloadAndPlay(_ entry: NativeCinemaPublicDriveEntry) async {
        guard !downloading, !loading else { return }
        guard network.canDownload(allowCellular: allowCellularDownloads) else {
            alertMessage = MusicLocalized.message(
                "La descarga está limitada a Wi-Fi. Activa los datos móviles si quieres permitirla.")
            return
        }
        downloading = true
        message = MusicLocalized.message("Descargando ") + entry.name +
            MusicLocalized.message(". La reproducción comenzará al terminar.")
        defer { downloading = false }
        var temporary: URL?
        do {
            let service = try NativeCinemaPublicDrive()
            let file = try await service.download(
                entry, ancestors: path,
                allowsCellular: allowCellularDownloads
            )
            temporary = file
            try player.openTemporaryFile(
                file, title: entry.name,
                reference: reference(for: entry), library: library
            )
            temporary = nil
            message = MusicLocalized.message("Reproduciendo: ") + entry.name
            UIAccessibility.post(notification: .announcement, argument: message)
        } catch {
            if let file = temporary {
                let folder = file.deletingLastPathComponent()
                if folder.deletingLastPathComponent().standardizedFileURL ==
                    FileManager.default.temporaryDirectory.standardizedFileURL {
                    try? FileManager.default.removeItem(at: folder)
                }
            }
            message = nil
            alertMessage = error.localizedDescription
        }
    }
}
