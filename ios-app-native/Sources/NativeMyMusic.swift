import SwiftUI
import UniformTypeIdentifiers
import ZIPFoundation
import UIKit

private struct MusicArchiveSelection: Identifiable {
    let url: URL
    var id: URL { url }
}

private struct MusicArchiveShareSheet: UIViewControllerRepresentable {
    let archiveURL: URL
    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: [archiveURL], applicationActivities: nil)
    }
    func updateUIViewController(_ controller: UIActivityViewController, context: Context) {}
}

private struct MusicBackupDocument: FileDocument {
    static var readableContentTypes: [UTType] { [.json] }
    var text: String = ""
    init(text: String = "") { self.text = text }
    init(configuration: ReadConfiguration) throws {
        guard let bytes = configuration.file.regularFileContents, let value = String(data: bytes, encoding: .utf8) else {
            throw CocoaError(.fileReadCorruptFile)
        }
        text = value
    }
    func fileWrapper(configuration: WriteConfiguration) throws -> FileWrapper {
        FileWrapper(regularFileWithContents: Data(text.utf8))
    }
}

private struct MusicIndexBackup: Codable {
    let format: String
    let version: Int
    let createdAt: String
    let includesAudioFiles: Bool
    let catalog: MusicPortableCatalog
    let folders: [MusicPortableFolder]
    let playlists: [String]
    let audioProfiles: [String: String]
}

private struct MusicPortableCatalog: Codable {
    let version: Int
    let tracks: [String: MusicPortableTrack]
}

private struct MusicPortableTrack: Codable {
    let id: String
    let title: String
    let locations: [MusicPortableLocation]
}

private struct MusicPortableLocation: Codable {
    let provider: String
    let remoteId: String
}

private struct MusicPortableFolder: Codable {
    let id: String
    let name: String
    let trackIds: [String]
}

private struct MusicLocalFile: Identifiable, Codable {
    let id: UUID
    let name: String
    let fileName: String
}

private struct MusicVirtualFolder: Identifiable, Codable {
    let id: UUID
    var name: String
    var trackIds: [UUID]
}

@MainActor
private final class NativeMusicLibrary: ObservableObject {
    @Published private(set) var files: [MusicLocalFile] = []
    @Published private(set) var folders: [MusicVirtualFolder] = []
    @Published var error: String?
    @Published private(set) var autoBackupDays = UserDefaults.standard.integer(forKey: "mi-musica-auto-backup-days")
    @Published private(set) var lastAutomaticBackup: Date?

    private var directory: URL {
        FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("MiMusica", isDirectory: true)
    }

    init() {
        let manifest = directory.appendingPathComponent("library.json")
        if let data = try? Data(contentsOf: manifest),
           let decoded = try? JSONDecoder().decode([MusicLocalFile].self, from: data) {
            files = decoded
        }
        let folderManifest = directory.appendingPathComponent("folders.json")
        if let data = try? Data(contentsOf: folderManifest),
           let decoded = try? JSONDecoder().decode([MusicVirtualFolder].self, from: data) {
            folders = decoded
        }
        lastAutomaticBackup = UserDefaults.standard.object(forKey: "mi-musica-last-auto-backup") as? Date
        performAutomaticBackupIfDue()
    }

    func importFiles(_ urls: [URL]) {
        do {
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            for url in urls {
                let allowed = ["mp3", "m4a", "aac", "wav", "flac"]
                guard allowed.contains(url.pathExtension.lowercased()) else { continue }
                let accessed = url.startAccessingSecurityScopedResource()
                defer { if accessed { url.stopAccessingSecurityScopedResource() } }
                let fileName = UUID().uuidString + "." + url.pathExtension.lowercased()
                let target = directory.appendingPathComponent(fileName)
                try FileManager.default.copyItem(at: url, to: target)
                files.append(MusicLocalFile(id: UUID(), name: url.deletingPathExtension().lastPathComponent, fileName: fileName))
            }
            try save()
        } catch {
            self.error = "No se pudo importar la música: \(error.localizedDescription)"
        }
    }

    func importFolder(_ folder: URL) {
        let accessed = folder.startAccessingSecurityScopedResource()
        defer { if accessed { folder.stopAccessingSecurityScopedResource() } }
        guard let enumerator = FileManager.default.enumerator(at: folder,
            includingPropertiesForKeys: [.isRegularFileKey], options: [.skipsHiddenFiles]) else {
            error = "No se pudo acceder al contenido de la carpeta seleccionada"
            return
        }
        let allowed = Set(["mp3", "m4a", "aac", "wav", "flac", "ogg"])
        var candidates: [URL] = []
        for case let url as URL in enumerator {
            guard allowed.contains(url.pathExtension.lowercased()),
                  (try? url.resourceValues(forKeys: [.isRegularFileKey]).isRegularFile) == true else { continue }
            candidates.append(url)
            if candidates.count >= 5_000 { break }
        }
        if candidates.isEmpty {
            error = "No se encontraron archivos musicales compatibles en esa carpeta"
        } else {
            importFiles(candidates)
        }
    }

    private func save() throws {
        let data = try JSONEncoder().encode(files)
        try data.write(to: directory.appendingPathComponent("library.json"), options: .atomic)
        try JSONEncoder().encode(folders).write(to: directory.appendingPathComponent("folders.json"), options: .atomic)
    }

    func addFolder(_ name: String) {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        folders.append(MusicVirtualFolder(id: UUID(), name: trimmed, trackIds: []))
        do { try save() } catch { self.error = error.localizedDescription }
    }

    func assign(_ trackId: UUID, to folderId: UUID) {
        guard let index = folders.firstIndex(where: { $0.id == folderId }) else { return }
        if !folders[index].trackIds.contains(trackId) { folders[index].trackIds.append(trackId) }
        do { try save() } catch { self.error = error.localizedDescription }
    }

    func removeFolder(_ id: UUID) {
        folders.removeAll { $0.id == id }
        do { try save() } catch { self.error = error.localizedDescription }
    }

    func removeFromLibrary(_ id: UUID) {
        files.removeAll { $0.id == id }
        for index in folders.indices { folders[index].trackIds.removeAll { $0 == id } }
        do { try save() } catch { self.error = error.localizedDescription }
    }

    func audioURL(for file: MusicLocalFile) -> URL {
        directory.appendingPathComponent(file.fileName)
    }

    func exportIndex() -> MusicBackupDocument? {
        do {
            let tracks = Dictionary(uniqueKeysWithValues: files.map { file in
                (file.id.uuidString, MusicPortableTrack(id: file.id.uuidString, title: file.name,
                    locations: [MusicPortableLocation(provider: "ios-local", remoteId: file.fileName)]))
            })
            let portableFolders = folders.map { folder in
                MusicPortableFolder(id: folder.id.uuidString, name: folder.name,
                    trackIds: folder.trackIds.map { $0.uuidString })
            }
            let backup = MusicIndexBackup(format: "tifloacosta-mi-musica", version: 1,
                createdAt: ISO8601DateFormatter().string(from: Date()), includesAudioFiles: false,
                catalog: MusicPortableCatalog(version: 1, tracks: tracks),
                folders: portableFolders, playlists: [], audioProfiles: [:])
            let bytes = try JSONEncoder().encode(backup)
            return MusicBackupDocument(text: String(decoding: bytes, as: UTF8.self))
        } catch { self.error = "No se pudo preparar el respaldo: \(error.localizedDescription)"; return nil }
    }

    func setAutomaticBackup(days: Int) {
        guard [0, 7, 30].contains(days) else { return }
        autoBackupDays = days
        UserDefaults.standard.set(days, forKey: "mi-musica-auto-backup-days")
        performAutomaticBackupIfDue()
    }

    func performAutomaticBackupIfDue() {
        guard autoBackupDays > 0 else { return }
        if let previous = lastAutomaticBackup,
           Date().timeIntervalSince(previous) < Double(autoBackupDays) * 86_400 { return }
        guard let document = exportIndex() else { return }
        do {
            let folder = directory.appendingPathComponent("Respaldos", isDirectory: true)
            try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
            let destination = folder.appendingPathComponent("MiMusica-indice-automatico.json")
            try Data(document.text.utf8).write(to: destination, options: .atomic)
            lastAutomaticBackup = Date()
            UserDefaults.standard.set(lastAutomaticBackup, forKey: "mi-musica-last-auto-backup")
        } catch { self.error = "No se pudo guardar la copia automática: \(error.localizedDescription)" }
    }

    func restoreIndex(_ url: URL) {
        let accessed = url.startAccessingSecurityScopedResource()
        defer { if accessed { url.stopAccessingSecurityScopedResource() } }
        do {
            let imported = try JSONDecoder().decode(MusicIndexBackup.self, from: Data(contentsOf: url))
            guard imported.format == "tifloacosta-mi-musica", imported.version == 1,
                  !imported.includesAudioFiles else { throw CocoaError(.fileReadCorruptFile) }
            let originalFiles = files
            let originalFolders = folders
            let importable = imported.catalog.tracks.values.compactMap { track -> MusicLocalFile? in
                guard let location = track.locations.first(where: { $0.provider == "ios-local" }),
                      let id = UUID(uuidString: track.id),
                      URL(fileURLWithPath: location.remoteId).lastPathComponent == location.remoteId,
                      FileManager.default.fileExists(atPath: directory.appendingPathComponent(location.remoteId).path) else { return nil }
                return MusicLocalFile(id: id, name: track.title, fileName: location.remoteId)
            }
            files = Array(Dictionary((files + importable).map { ($0.id, $0) }, uniquingKeysWith: { existing, _ in existing }).values)
            let importedFolders = imported.folders.map { folder in
                MusicVirtualFolder(id: UUID(uuidString: folder.id) ?? UUID(), name: folder.name,
                    trackIds: folder.trackIds.compactMap { UUID(uuidString: $0) })
            }
            folders = Array(Dictionary((folders + importedFolders).map { ($0.name, $0) }, uniquingKeysWith: { existing, _ in existing }).values)
            do { try save() } catch { files = originalFiles; folders = originalFolders; throw error }
            let unavailable = imported.catalog.tracks.count - importable.count
            if unavailable > 0 { self.error = "Organización restaurada. Hay \(unavailable) canciones sin audio local; tendrás que importarlas para reproducirlas." }
        } catch { self.error = "No se pudo restaurar el índice: \(error.localizedDescription)" }
    }

    func createCompleteArchive() -> URL? {
        let staging = FileManager.default.temporaryDirectory.appendingPathComponent("music-export-\(UUID().uuidString)", isDirectory: true)
        let output = FileManager.default.temporaryDirectory.appendingPathComponent("MiMusica-completa-\(UUID().uuidString).zip")
        do {
            try FileManager.default.createDirectory(at: staging.appendingPathComponent("audio"), withIntermediateDirectories: true)
            guard let text = exportIndex()?.text,
                  let bytes = text.data(using: .utf8),
                  let backup = try? JSONDecoder().decode(MusicIndexBackup.self, from: bytes) else {
                throw CocoaError(.fileReadCorruptFile)
            }
            var tracks = backup.catalog.tracks
            var copied: [String] = []
            for file in files {
                let original = audioURL(for: file)
                guard FileManager.default.fileExists(atPath: original.path) else {
                    throw NSError(domain: "MiMusica", code: 1, userInfo: [NSLocalizedDescriptionKey: "No se puede completar la copia: falta el audio de \(file.name)"])
                }
                let relative = "audio/\(UUID().uuidString).\(original.pathExtension.lowercased())"
                try FileManager.default.copyItem(at: original, to: staging.appendingPathComponent(relative))
                copied.append(relative)
                if let track = tracks[file.id.uuidString] {
                    tracks[file.id.uuidString] = MusicPortableTrack(id: track.id, title: track.title,
                        locations: track.locations + [MusicPortableLocation(provider: "archive", remoteId: relative)])
                }
            }
            let complete = MusicIndexBackup(format: backup.format, version: backup.version,
                createdAt: backup.createdAt, includesAudioFiles: true,
                catalog: MusicPortableCatalog(version: 1, tracks: tracks),
                folders: backup.folders, playlists: backup.playlists, audioProfiles: backup.audioProfiles)
            try JSONEncoder().encode(complete).write(to: staging.appendingPathComponent("manifest.json"))
            guard let archive = Archive(url: output, accessMode: .create) else { throw CocoaError(.fileWriteUnknown) }
            try archive.addEntry(with: "manifest.json", relativeTo: staging)
            for relative in copied { try archive.addEntry(with: relative, relativeTo: staging) }
            try? FileManager.default.removeItem(at: staging)
            return output
        } catch {
            try? FileManager.default.removeItem(at: staging)
            try? FileManager.default.removeItem(at: output)
            self.error = "No se pudo crear la copia con audio: \(error.localizedDescription)"
            return nil
        }
    }

    func restoreCompleteArchive(_ source: URL) {
        let accessed = source.startAccessingSecurityScopedResource()
        defer { if accessed { source.stopAccessingSecurityScopedResource() } }
        let staging = FileManager.default.temporaryDirectory.appendingPathComponent("music-import-\(UUID().uuidString)", isDirectory: true)
        var createdFiles: [URL] = []
        do {
            try FileManager.default.createDirectory(at: staging, withIntermediateDirectories: true)
            guard let archive = Archive(url: source, accessMode: .read) else { throw CocoaError(.fileReadCorruptFile) }
            var total: Int64 = 0
            for entry in archive {
                let name = entry.path
                guard name == "manifest.json" || name.range(of: #"^audio/[a-zA-Z0-9-]+\.(mp3|m4a|aac|wav|flac|ogg)$"#, options: .regularExpression) != nil,
                      entry.type == .file else { throw CocoaError(.fileReadCorruptFile) }
                total += Int64(entry.uncompressedSize)
                guard total <= 2_147_483_648 else { throw CocoaError(.fileReadCorruptFile) }
                let target = staging.appendingPathComponent(name)
                try FileManager.default.createDirectory(at: target.deletingLastPathComponent(), withIntermediateDirectories: true)
                _ = try archive.extract(entry, to: target)
            }
            let manifest = staging.appendingPathComponent("manifest.json")
            guard let attributes = try? FileManager.default.attributesOfItem(atPath: manifest.path),
                  let size = attributes[.size] as? NSNumber, size.intValue <= 8_388_608 else { throw CocoaError(.fileReadCorruptFile) }
            let backup = try JSONDecoder().decode(MusicIndexBackup.self, from: Data(contentsOf: manifest))
            guard backup.format == "tifloacosta-mi-musica", backup.version == 1, backup.includesAudioFiles else { throw CocoaError(.fileReadCorruptFile) }
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            var imported: [MusicLocalFile] = []
            var ids: [String: UUID] = [:]
            for (id, track) in backup.catalog.tracks {
                guard let stored = track.locations.first(where: { $0.provider == "archive" }),
                      stored.remoteId.range(of: #"^audio/[a-zA-Z0-9-]+\.(mp3|m4a|aac|wav|flac|ogg)$"#, options: .regularExpression) != nil else { continue }
                let original = staging.appendingPathComponent(stored.remoteId)
                guard FileManager.default.fileExists(atPath: original.path) else { throw CocoaError(.fileReadCorruptFile) }
                let newID = UUID()
                let fileName = UUID().uuidString + "." + original.pathExtension
                let destination = directory.appendingPathComponent(fileName)
                try FileManager.default.copyItem(at: original, to: destination)
                createdFiles.append(destination)
                imported.append(MusicLocalFile(id: newID, name: track.title, fileName: fileName))
                ids[id] = newID
            }
            let additions = backup.folders.map { folder in
                MusicVirtualFolder(id: UUID(), name: folder.name, trackIds: folder.trackIds.compactMap { ids[$0] })
            }
            let originalFiles = files
            let originalFolders = folders
            files += imported
            folders += additions
            do { try save() } catch { files = originalFiles; folders = originalFolders; throw error }
        } catch {
            createdFiles.forEach { try? FileManager.default.removeItem(at: $0) }
            self.error = "No se pudo restaurar la copia con audio: \(error.localizedDescription)"
        }
        try? FileManager.default.removeItem(at: staging)
    }
}

struct NativeMyMusicScreen: View {
    @StateObject private var library = NativeMusicLibrary()
    @StateObject private var player = NativeMusicPlayer()
    @State private var isImporting = false
    @State private var isImportingFolder = false
    @State private var searchText = ""
    @State private var newFolderName = ""
    @State private var showingFolderEditor = false
    @State private var pendingRemoval: MusicLocalFile?
    @State private var exportingBackup = false
    @State private var importingBackup = false
    @State private var backupDocument: MusicBackupDocument?
    @State private var completeArchiveURL: URL?
    @State private var importingCompleteBackup = false

    private var visibleFiles: [MusicLocalFile] {
        let query = searchText.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: .current)
        return library.files.filter {
            query.isEmpty || $0.name.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: .current).contains(query)
        }
    }

    var body: some View {
        List {
            Section {
                Button("Importar canciones") { isImporting = true }
                    .accessibilityHint("Selecciona archivos de audio. Los originales se conservarán en su ubicación.")
                Button("Importar carpeta desde Archivos o nube") { isImportingFolder = true }
                    .accessibilityHint("Elige una carpeta disponible en Archivos. Las canciones se copiarán a Mi Música para escucharlas sin depender de la conexión.")
                Button("Crear carpeta") { showingFolderEditor = true }
            }
            Section("Copias de seguridad") {
                Button("Exportar respaldo de biblioteca") {
                    backupDocument = library.exportIndex()
                    exportingBackup = backupDocument != nil
                }
                Button("Restaurar respaldo de biblioteca") { importingBackup = true }
                Button("Exportar copia completa con audio") { completeArchiveURL = library.createCompleteArchive() }
                Button("Restaurar copia completa con audio") { importingCompleteBackup = true }
                Text("Copia automática: \(library.autoBackupDays == 0 ? "desactivada" : "cada \(library.autoBackupDays) días")")
                Button("Desactivar copia automática") { library.setAutomaticBackup(days: 0) }
                Button("Cada 7 días") { library.setAutomaticBackup(days: 7) }
                Button("Cada 30 días") { library.setAutomaticBackup(days: 30) }
                Text("Las copias automáticas del índice se crean al abrir Mi Música cuando corresponde; no se ejecutan en segundo plano.")
                Text("Este respaldo conserva el índice y las carpetas, pero no incluye los archivos de audio. Para recuperar música en otro dispositivo tendrás que importar también las canciones.")
            }
            Section("Mis carpetas") {
                ForEach(library.folders) { folder in
                    HStack {
                        Text("\(folder.name), \(folder.trackIds.count) canciones")
                        Spacer()
                        Button("Eliminar carpeta \(folder.name)") { library.removeFolder(folder.id) }
                            .accessibilityHint("Solo elimina esta carpeta virtual; las canciones se conservan.")
                    }
                }
            }
            Section("Mi biblioteca") {
                if library.files.isEmpty {
                    Text("Todavía no hay canciones. Usa Importar canciones para añadir música.")
                } else {
                    ForEach(visibleFiles) { file in
                        HStack {
                            Button("Reproducir \(file.name)") {
                                player.play(
                                    name: file.name,
                                    url: library.audioURL(for: file),
                                    queue: library.files.map { (name: $0.name, url: library.audioURL(for: $0)) }
                                )
                            }
                            Spacer()
                            Menu("Acciones de \(file.name)") {
                                ForEach(library.folders) { folder in
                                    Button("Añadir a \(folder.name)") { library.assign(file.id, to: folder.id) }
                                }
                                Button("Eliminar de la biblioteca", role: .destructive) { pendingRemoval = file }
                            }
                        }
                    }
                }
            }
            Section("Reproductor") {
                Text(player.currentName.isEmpty ? "Ninguna canción en reproducción" : player.currentName)
                    .accessibilityAddTraits(.isHeader)
                Button(player.isPlaying ? "Pausar" : "Reproducir") { player.toggle() }
                    .disabled(player.currentName.isEmpty)
                Button("Canción anterior") { player.previous() }
                    .disabled(player.currentName.isEmpty)
                Button("Retroceder 15 segundos") { player.skip(seconds: -15) }
                    .disabled(player.currentName.isEmpty)
                Button("Avanzar 15 segundos") { player.skip(seconds: 15) }
                    .disabled(player.currentName.isEmpty)
                Button("Canción siguiente") { player.next() }
                    .disabled(player.currentName.isEmpty)
                Button("Reproducción aleatoria: \(player.shuffleEnabled ? "activada" : "desactivada")") { player.toggleShuffle() }
                Button("Repetición: \(player.repeatMode == "off" ? "desactivada" : player.repeatMode == "all" ? "toda la lista" : "una canción")") { player.changeRepeat() }
                Button("Temporizador de 15 minutos") { player.setSleep(minutes: 15) }
                    .disabled(player.currentName.isEmpty)
                Button("Temporizador de 30 minutos") { player.setSleep(minutes: 30) }
                    .disabled(player.currentName.isEmpty)
                if player.sleepRemaining > 0 {
                    Text("Temporizador: \(player.sleepRemaining) segundos restantes")
                    Button("Cancelar temporizador") { player.cancelSleep() }
                }
                Text("Posición: \(Int(player.position)) de \(Int(player.duration)) segundos")
            }
            Section("Ecualizador") {
                Text("Perfil actual: \(player.selectedPreset)")
                ForEach(NativeMusicPlayer.presets.map { $0.name }, id: \.self) { name in
                    Button("Perfil \(name)") { player.selectPreset(name) }
                }
                ForEach(NativeMusicPlayer.frequencies.indices, id: \.self) { index in
                    let frequency = NativeMusicPlayer.frequencies[index]
                    Text("\(Int(frequency)) hercios: \(Int(player.gains[index])) decibelios")
                    Button("Reducir \(Int(frequency)) hercios") { player.adjustBand(index, by: -1) }
                    Button("Aumentar \(Int(frequency)) hercios") { player.adjustBand(index, by: 1) }
                }
                Button("Guardar como perfil general") { player.saveAsGeneral() }
                Button("Guardar perfil para esta canción") { player.saveForCurrent() }
                    .disabled(player.currentName.isEmpty)
                if player.currentHasOverride {
                    Button("Quitar perfil de esta canción") { player.removeCurrentOverride() }
                }
            }
        }
        .navigationTitle("Mi Música")
        .searchable(text: $searchText, prompt: "Buscar canciones")
        .alert("Crear carpeta", isPresented: $showingFolderEditor) {
            TextField("Nombre de la carpeta", text: $newFolderName)
            Button("Crear") { library.addFolder(newFolderName); newFolderName = "" }
            Button("Cancelar", role: .cancel) { newFolderName = "" }
        } message: {
            Text("La carpeta será virtual y no modificará tus archivos originales.")
        }
        .confirmationDialog("Eliminar de la biblioteca", isPresented: Binding(
            get: { pendingRemoval != nil },
            set: { if !$0 { pendingRemoval = nil } }
        )) {
            Button("Eliminar de la biblioteca", role: .destructive) {
                if let file = pendingRemoval { library.removeFromLibrary(file.id) }
                pendingRemoval = nil
            }
        } message: {
            Text("La canción dejará de aparecer en Mi Música, pero no se borrará el archivo original.")
        }
        .fileImporter(isPresented: $isImporting, allowedContentTypes: [.audio], allowsMultipleSelection: true) { result in
            switch result {
            case .success(let urls): library.importFiles(urls)
            case .failure(let error): library.error = error.localizedDescription
            }
        }
        .fileImporter(isPresented: $isImportingFolder, allowedContentTypes: [.folder]) { result in
            switch result {
            case .success(let url): library.importFolder(url)
            case .failure(let failure): library.error = failure.localizedDescription
            }
        }
        .fileExporter(isPresented: $exportingBackup, document: backupDocument, contentType: .json, defaultFilename: "MiMusica-respaldo") { result in
            if case .failure(let failure) = result { library.error = failure.localizedDescription }
        }
        .fileImporter(isPresented: $importingBackup, allowedContentTypes: [.json]) { result in
            switch result {
            case .success(let url): library.restoreIndex(url)
            case .failure(let failure): library.error = failure.localizedDescription
            }
        }
        .sheet(item: Binding(
            get: { completeArchiveURL.map { MusicArchiveSelection(url: $0) } },
            set: { if $0 == nil { completeArchiveURL = nil } }
        )) { selection in MusicArchiveShareSheet(archiveURL: selection.url) }
        .fileImporter(isPresented: $importingCompleteBackup, allowedContentTypes: [.zip]) { result in
            switch result {
            case .success(let url): library.restoreCompleteArchive(url)
            case .failure(let failure): library.error = failure.localizedDescription
            }
        }
        .alert("Importación de música", isPresented: Binding(
            get: { library.error != nil },
            set: { if !$0 { library.error = nil } }
        )) {
            Button("Aceptar") { library.error = nil }
        } message: {
            Text(library.error ?? "")
        }
        .alert("Reproducción de música", isPresented: Binding(
            get: { player.error != nil },
            set: { if !$0 { player.error = nil } }
        )) {
            Button("Aceptar") { player.error = nil }
        } message: {
            Text(player.error ?? "")
        }
    }
}
