import SwiftUI
import UniformTypeIdentifiers
import ZIPFoundation
import UIKit
import AVFoundation

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
    let playlists: [MusicPortablePlaylist]
    let smartFolders: [MusicPortableSmartFolder]
    let audioProfiles: [String: String]
}

private struct MusicPortablePlaylist: Codable {
    let id: String
    let name: String
    let trackIds: [String]
    var orderedEntries: [MusicPlaylistEntry]? = nil
}

struct MusicPlaylistEntry: Codable, Identifiable {
    enum Provider: String, Codable { case local, appleMusic, audius, jamendo }
    let id: UUID
    let provider: Provider
    let localId: UUID?
    // Legacy JSON key also holds the stable remote track ID for Audius/Jamendo.
    let appleMusicSongId: String?
    let title: String
    let artist: String?

    fileprivate static func local(_ file: MusicLocalFile) -> Self {
        Self(id: UUID(), provider: .local, localId: file.id, appleMusicSongId: nil,
             title: file.name, artist: nil)
    }

    static func remote(provider: Provider, id: String, title: String, artist: String) -> Self {
        Self(id: UUID(), provider: provider, localId: nil, appleMusicSongId: id,
             title: title, artist: artist)
    }
}

private struct MusicPortableSmartFolder: Codable {
    let id: String
    let name: String
    let titleContains: String
    var rule: String? = nil
}

private struct MusicPortableCatalog: Codable {
    let version: Int
    let tracks: [String: MusicPortableTrack]
}

private struct MusicPortableTrack: Codable {
    let id: String
    let title: String
    let locations: [MusicPortableLocation]
    var album: String? = nil
    var artist: String? = nil
    var genre: String? = nil
    var importedAt: Date? = nil
    var playCount: Int? = nil
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
    var album: String? = nil
    var artist: String? = nil
    var genre: String? = nil
    var importedAt: Date? = nil
    var playCount: Int? = nil

    var albumKey: String? {
        guard let album = album?.trimmingCharacters(in: .whitespacesAndNewlines), !album.isEmpty else { return nil }
        let stableLocale = Locale(identifier: "en_US_POSIX")
        let title = album.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: stableLocale).lowercased()
        let author = (artist ?? "").folding(options: [.diacriticInsensitive, .caseInsensitive], locale: stableLocale).lowercased()
        return "\(author)|\(title)"
    }
}

private struct MusicVirtualFolder: Identifiable, Codable {
    let id: UUID
    var name: String
    var trackIds: [UUID]
}

private struct MusicPlaylist: Identifiable, Codable {
    let id: UUID
    var name: String
    var trackIds: [UUID]
    var orderedEntries: [MusicPlaylistEntry]? = nil
}

private struct MusicSmartFolder: Identifiable, Codable {
    let id: UUID
    var name: String
    var titleContains: String
    var rule: String? = nil

    var ruleKind: MusicSmartRuleKind { MusicSmartRuleKind(rawValue: rule ?? "title") ?? .title }
}

private enum MusicSmartRuleKind: String, CaseIterable, Identifiable {
    case title, artist, genre, importDate, playCount
    var id: Self { self }
    var label: String {
        switch self {
        case .title: return "Título contiene"
        case .artist: return "Artista contiene"
        case .genre: return "Género contiene"
        case .importDate: return "Importada desde fecha (AAAA-MM-DD)"
        case .playCount: return "Reproducciones como mínimo"
        }
    }
}

private struct MusicAlbumGroup: Identifiable {
    let id: String
    let name: String
}

@MainActor
private final class NativeMusicLibrary: ObservableObject {
    static let shared = NativeMusicLibrary()
    @Published private(set) var files: [MusicLocalFile] = []
    @Published private(set) var folders: [MusicVirtualFolder] = []
    @Published private(set) var playlists: [MusicPlaylist] = []
    @Published private(set) var smartFolders: [MusicSmartFolder] = []
    @Published var error: String?
    @Published private(set) var autoBackupDays = UserDefaults.standard.integer(forKey: "mi-musica-auto-backup-days")
    @Published private(set) var lastAutomaticBackup: Date?
    @Published private(set) var automaticBackupDestinationName = UserDefaults.standard.string(
        forKey: "mi-musica-auto-backup-destination-name") ?? "Carpeta interna de Mi Música"
    private let automaticBackupBookmarkKey = "mi-musica-auto-backup-destination-bookmark"

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
        if let data = try? Data(contentsOf: directory.appendingPathComponent("playlists.json")),
           let decoded = try? JSONDecoder().decode([MusicPlaylist].self, from: data) { playlists = decoded }
        if let data = try? Data(contentsOf: directory.appendingPathComponent("smart-folders.json")),
           let decoded = try? JSONDecoder().decode([MusicSmartFolder].self, from: data) { smartFolders = decoded }
        lastAutomaticBackup = UserDefaults.standard.object(forKey: "mi-musica-last-auto-backup") as? Date
        NativeMusicPlayer.shared.onTrackStarted = { [weak self] url in self?.recordPlay(for: url) }
        performAutomaticBackupIfDue()
        Task { await refreshMissingAlbumMetadata() }
    }

    func refreshMissingAlbumMetadata() async {
        await refreshAlbumMetadata(for: files.filter { $0.album == nil }.map(\.id))
    }

    private func refreshAlbumMetadata(for ids: [UUID]) async {
        for id in ids {
            guard let index = files.firstIndex(where: { $0.id == id }) else { continue }
            let asset = AVURLAsset(url: audioURL(for: files[index]))
            guard let metadata = try? await asset.load(.commonMetadata) else { continue }
            let album = AVMetadataItem.metadataItems(from: metadata, filteredByIdentifier: .commonIdentifierAlbumName).first?.stringValue
            let artist = AVMetadataItem.metadataItems(from: metadata, filteredByIdentifier: .commonIdentifierArtist).first?.stringValue
            guard let freshIndex = files.firstIndex(where: { $0.id == id }) else { continue }
            files[freshIndex].album = album
            files[freshIndex].artist = artist
        }
        try? save()
    }

    func importFiles(_ urls: [URL]) {
        let previousFiles = files
        var copiedDestinations: [URL] = []
        var newlyImported: [UUID] = []
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
                copiedDestinations.append(target)
                let newID = UUID()
                files.append(MusicLocalFile(id: newID, name: url.deletingPathExtension().lastPathComponent,
                                            fileName: fileName, importedAt: Date(), playCount: 0))
                newlyImported.append(newID)
            }
            try save()
            let importedIDs = newlyImported
            Task { await refreshAlbumMetadata(for: importedIDs) }
        } catch {
            files = previousFiles
            copiedDestinations.forEach { try? FileManager.default.removeItem(at: $0) }
            try? save()
            self.error = MusicLocalized.format("No se pudo importar la música: %@", error.localizedDescription)
        }
    }

    func importFolder(_ folder: URL) {
        let accessed = folder.startAccessingSecurityScopedResource()
        defer { if accessed { folder.stopAccessingSecurityScopedResource() } }
        guard let enumerator = FileManager.default.enumerator(at: folder,
            includingPropertiesForKeys: [.isRegularFileKey], options: [.skipsHiddenFiles]) else {
            error = MusicLocalized.format("No se pudo acceder al contenido de la carpeta seleccionada")
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
            error = MusicLocalized.format("No se encontraron archivos musicales compatibles en esa carpeta")
        } else {
            importFiles(candidates)
        }
    }

    private func save() throws {
        let data = try JSONEncoder().encode(files)
        try data.write(to: directory.appendingPathComponent("library.json"), options: .atomic)
        try JSONEncoder().encode(folders).write(to: directory.appendingPathComponent("folders.json"), options: .atomic)
        try JSONEncoder().encode(playlists).write(to: directory.appendingPathComponent("playlists.json"), options: .atomic)
        try JSONEncoder().encode(smartFolders).write(to: directory.appendingPathComponent("smart-folders.json"), options: .atomic)
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

    func addPlaylist(_ name: String) {
        let clean = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !clean.isEmpty else { return }
        playlists.append(MusicPlaylist(id: UUID(), name: clean, trackIds: []))
        do { try save() } catch { self.error = error.localizedDescription }
    }

    func addToPlaylist(_ trackId: UUID, playlistId: UUID) {
        guard let index = playlists.firstIndex(where: { $0.id == playlistId }) else { return }
        let oldEntries = playlistEntries(playlists[index])
        playlists[index].trackIds.append(trackId)
        if let file = files.first(where: { $0.id == trackId }) {
            playlists[index].orderedEntries = oldEntries + [.local(file)]
        }
        do { try save() } catch { self.error = error.localizedDescription }
    }

    func addRemoteToPlaylist(provider: MusicPlaylistEntry.Provider, songID: String,
                             title: String, artist: String, playlistID: UUID) {
        guard provider != .local, !songID.isEmpty,
              let index = playlists.firstIndex(where: { $0.id == playlistID }) else { return }
        let previous = playlistEntries(playlists[index])
        playlists[index].orderedEntries = previous + [.remote(provider: provider, id: songID,
                                                               title: title, artist: artist)]
        do { try save() } catch { self.error = error.localizedDescription }
    }

    func playlistEntries(_ playlist: MusicPlaylist) -> [MusicPlaylistEntry] {
        playlist.orderedEntries ?? playlist.trackIds.compactMap { id in
            files.first(where: { $0.id == id }).map(MusicPlaylistEntry.local)
        }
    }

    func movePlaylistEntry(playlistID: UUID, entryID: UUID, by offset: Int) {
        guard offset == -1 || offset == 1,
              let index = playlists.firstIndex(where: { $0.id == playlistID }) else { return }
        var orderedEntries = playlistEntries(playlists[index])
        guard let position = orderedEntries.firstIndex(where: { $0.id == entryID }),
              orderedEntries.indices.contains(position + offset) else { return }
        let destination = position + offset
        orderedEntries.swapAt(position, destination)
        playlists[index].orderedEntries = orderedEntries
        playlists[index].trackIds = orderedEntries.compactMap(\.localId)
        do { try save() } catch { self.error = error.localizedDescription }
    }

    func updateGenre(_ id: UUID, genre: String) {
        guard let index = files.firstIndex(where: { $0.id == id }) else { return }
        let clean = genre.trimmingCharacters(in: .whitespacesAndNewlines)
        files[index].genre = clean.isEmpty ? nil : clean
        do { try save() } catch { self.error = error.localizedDescription }
    }

    func recordPlay(for url: URL) {
        guard let index = files.firstIndex(where: { audioURL(for: $0) == url }) else { return }
        files[index].playCount = min(Int.max - 1, max(0, min(Int.max - 2, files[index].playCount ?? 0)) + 1)
        do { try save() } catch { self.error = error.localizedDescription }
    }

    func removePlaylist(_ id: UUID) {
        playlists.removeAll { $0.id == id }
        do { try save() } catch { self.error = error.localizedDescription }
    }

    func addSmartFolder(_ name: String, titleContains: String, rule: MusicSmartRuleKind = .title) {
        let cleanName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        let keyword = titleContains.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleanName.isEmpty, !keyword.isEmpty else { return }
        smartFolders.append(MusicSmartFolder(id: UUID(), name: cleanName, titleContains: keyword,
                                             rule: rule.rawValue))
        do { try save() } catch { self.error = error.localizedDescription }
    }

    func removeSmartFolder(_ id: UUID) {
        smartFolders.removeAll { $0.id == id }
        do { try save() } catch { self.error = error.localizedDescription }
    }

    func matchingTracks(for smart: MusicSmartFolder) -> [MusicLocalFile] {
        let query = smart.titleContains.trimmingCharacters(in: .whitespacesAndNewlines)
        return files.filter { file in
            switch smart.ruleKind {
            case .title: return file.name.localizedStandardContains(query)
            case .artist: return file.artist?.localizedStandardContains(query) == true
            case .genre: return file.genre?.localizedStandardContains(query) == true
            case .playCount:
                guard let minimum = Int(query), minimum >= 0 else { return false }
                return (file.playCount ?? 0) >= minimum
            case .importDate:
                let formatter = DateFormatter()
                formatter.dateFormat = "yyyy-MM-dd"
                formatter.locale = Locale(identifier: "en_US_POSIX")
                formatter.timeZone = TimeZone(secondsFromGMT: 0)
                formatter.isLenient = false
                guard let since = formatter.date(from: query) else { return false }
                let recorded = file.importedAt ?? ((try? FileManager.default.attributesOfItem(atPath: audioURL(for: file).path))?[.creationDate] as? Date)
                return recorded.map { $0 >= since } ?? false
            }
        }
    }

    func removeFolder(_ id: UUID) {
        folders.removeAll { $0.id == id }
        do { try save() } catch { self.error = error.localizedDescription }
    }

    func removeFromLibrary(_ id: UUID) {
        files.removeAll { $0.id == id }
        for index in folders.indices { folders[index].trackIds.removeAll { $0 == id } }
        for index in playlists.indices {
            playlists[index].trackIds.removeAll { $0 == id }
            playlists[index].orderedEntries?.removeAll { $0.localId == id }
        }
        do { try save() } catch { self.error = error.localizedDescription }
    }

    func audioURL(for file: MusicLocalFile) -> URL {
        directory.appendingPathComponent(file.fileName)
    }

    func exportIndex() -> MusicBackupDocument? {
        do {
            let tracks = Dictionary(uniqueKeysWithValues: files.map { file in
                (file.id.uuidString, MusicPortableTrack(id: file.id.uuidString, title: file.name,
                    locations: [MusicPortableLocation(provider: "ios-local", remoteId: file.fileName)],
                    album: file.album, artist: file.artist, genre: file.genre,
                    importedAt: file.importedAt, playCount: file.playCount))
            })
            let portableFolders = folders.map { folder in
                MusicPortableFolder(id: folder.id.uuidString, name: folder.name,
                    trackIds: folder.trackIds.map { $0.uuidString })
            }
            let backup = MusicIndexBackup(format: "tifloacosta-mi-musica", version: 1,
                createdAt: ISO8601DateFormatter().string(from: Date()), includesAudioFiles: false,
                catalog: MusicPortableCatalog(version: 1, tracks: tracks),
                folders: portableFolders,
                playlists: playlists.map { MusicPortablePlaylist(id: $0.id.uuidString, name: $0.name,
                    trackIds: $0.trackIds.map { $0.uuidString }, orderedEntries: $0.orderedEntries) },
                smartFolders: smartFolders.map { MusicPortableSmartFolder(id: $0.id.uuidString, name: $0.name,
                    titleContains: $0.titleContains, rule: $0.rule) }, audioProfiles: NativeMusicPlayer.shared.exportProfiles())
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

    func chooseAutomaticBackupDestination(_ url: URL) {
        let accessed = url.startAccessingSecurityScopedResource()
        defer { if accessed { url.stopAccessingSecurityScopedResource() } }
        guard accessed else {
            error = "No se obtuvo permiso para guardar copias en la carpeta seleccionada."
            return
        }
        do {
            let bookmark = try url.bookmarkData(options: [],
                includingResourceValuesForKeys: nil, relativeTo: nil)
            guard let document = exportIndex() else { return }
            try writeAutomaticBackup(document, to: url, custom: true)
            UserDefaults.standard.set(bookmark, forKey: automaticBackupBookmarkKey)
            UserDefaults.standard.set(url.lastPathComponent,
                forKey: "mi-musica-auto-backup-destination-name")
            automaticBackupDestinationName = url.lastPathComponent
            lastAutomaticBackup = Date()
            UserDefaults.standard.set(lastAutomaticBackup, forKey: "mi-musica-last-auto-backup")
            error = nil
        } catch {
            self.error = "No se pudo guardar el destino elegido: \(error.localizedDescription)"
        }
    }

    func resetAutomaticBackupDestination() {
        guard let document = exportIndex() else { return }
        do {
            try writeAutomaticBackup(document, to: directory.appendingPathComponent("Respaldos", isDirectory: true), custom: false)
            UserDefaults.standard.removeObject(forKey: automaticBackupBookmarkKey)
            UserDefaults.standard.removeObject(forKey: "mi-musica-auto-backup-destination-name")
            automaticBackupDestinationName = "Carpeta interna de Mi Música"
            lastAutomaticBackup = Date()
            UserDefaults.standard.set(lastAutomaticBackup, forKey: "mi-musica-last-auto-backup")
            error = nil
        } catch { self.error = "No se pudo restablecer el destino interno: \(error.localizedDescription)" }
    }

    private func automaticBackupDirectory() throws -> URL {
        guard let bookmark = UserDefaults.standard.data(forKey: automaticBackupBookmarkKey) else {
            return directory.appendingPathComponent("Respaldos", isDirectory: true)
        }
        var stale = false
        let folder = try URL(resolvingBookmarkData: bookmark, options: [],
            relativeTo: nil, bookmarkDataIsStale: &stale)
        guard !stale else { throw CocoaError(.fileReadNoPermission) }
        return folder
    }

    private func writeAutomaticBackup(_ document: MusicBackupDocument, to folder: URL, custom: Bool) throws {
        // The caller holds any security-scoped access while choosing a new destination.
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        let destination = folder.appendingPathComponent("MiMusica-indice-automatico.json")
        try Data(document.text.utf8).write(to: destination, options: .atomic)
    }

    func performAutomaticBackupIfDue() {
        guard autoBackupDays > 0 else { return }
        if let previous = lastAutomaticBackup,
           Date().timeIntervalSince(previous) < Double(autoBackupDays) * 86_400 { return }
        guard let document = exportIndex() else { return }
        do {
            let folder = try automaticBackupDirectory()
            let custom = UserDefaults.standard.data(forKey: automaticBackupBookmarkKey) != nil
            let accessed = custom ? folder.startAccessingSecurityScopedResource() : false
            defer { if accessed { folder.stopAccessingSecurityScopedResource() } }
            guard !custom || accessed else { throw CocoaError(.fileWriteNoPermission) }
            try writeAutomaticBackup(document, to: folder, custom: custom)
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
            let originalPlaylists = playlists
            let originalSmart = smartFolders
            let importable = imported.catalog.tracks.values.compactMap { track -> MusicLocalFile? in
                guard let location = track.locations.first(where: { $0.provider == "ios-local" }),
                      let id = UUID(uuidString: track.id),
                      URL(fileURLWithPath: location.remoteId).lastPathComponent == location.remoteId,
                      FileManager.default.fileExists(atPath: directory.appendingPathComponent(location.remoteId).path) else { return nil }
                return MusicLocalFile(id: id, name: track.title, fileName: location.remoteId,
                    album: track.album, artist: track.artist, genre: track.genre,
                    importedAt: track.importedAt, playCount: track.playCount)
            }
            files = Array(Dictionary((files + importable).map { ($0.id, $0) }, uniquingKeysWith: { existing, _ in existing }).values)
            let importedFolders = imported.folders.map { folder in
                MusicVirtualFolder(id: UUID(uuidString: folder.id) ?? UUID(), name: folder.name,
                    trackIds: folder.trackIds.compactMap { UUID(uuidString: $0) })
            }
            folders = Array(Dictionary((folders + importedFolders).map { ($0.name, $0) }, uniquingKeysWith: { existing, _ in existing }).values)
            let addedLists = imported.playlists.map { item in
                MusicPlaylist(id: UUID(uuidString: item.id) ?? UUID(), name: item.name,
                    trackIds: item.trackIds.compactMap { UUID(uuidString: $0) }, orderedEntries: item.orderedEntries)
            }
            playlists = Array(Dictionary((playlists + addedLists).map { ($0.name, $0) }, uniquingKeysWith: { existing, _ in existing }).values)
            let addedSmart = imported.smartFolders.map { item in
                MusicSmartFolder(id: UUID(uuidString: item.id) ?? UUID(), name: item.name,
                                 titleContains: item.titleContains, rule: item.rule)
            }
            smartFolders = Array(Dictionary((smartFolders + addedSmart).map { ($0.name, $0) }, uniquingKeysWith: { existing, _ in existing }).values)
            do { try save() } catch { files = originalFiles; folders = originalFolders; playlists = originalPlaylists; smartFolders = originalSmart; throw error }
            NativeMusicPlayer.shared.restoreProfiles(imported.audioProfiles)
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
                        locations: track.locations + [MusicPortableLocation(provider: "archive", remoteId: relative)],
                        album: track.album, artist: track.artist, genre: track.genre,
                        importedAt: track.importedAt, playCount: track.playCount)
                }
            }
            let complete = MusicIndexBackup(format: backup.format, version: backup.version,
                createdAt: backup.createdAt, includesAudioFiles: true,
                catalog: MusicPortableCatalog(version: 1, tracks: tracks),
                folders: backup.folders, playlists: backup.playlists,
                smartFolders: backup.smartFolders, audioProfiles: backup.audioProfiles)
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
                imported.append(MusicLocalFile(id: newID, name: track.title, fileName: fileName,
                    album: track.album, artist: track.artist, genre: track.genre,
                    importedAt: track.importedAt, playCount: track.playCount))
                ids[id] = newID
            }
            let additions = backup.folders.map { folder in
                MusicVirtualFolder(id: UUID(), name: folder.name, trackIds: folder.trackIds.compactMap { ids[$0] })
            }
            let importedLists = backup.playlists.map { item in
                let restored = item.orderedEntries?.compactMap { entry -> MusicPlaylistEntry? in
                    guard entry.provider == .local else { return entry }
                    guard let localId = entry.localId, let mapped = ids[localId.uuidString] else { return nil }
                    return MusicPlaylistEntry(id: entry.id, provider: .local, localId: mapped,
                                              appleMusicSongId: nil, title: entry.title, artist: entry.artist)
                }
                return MusicPlaylist(id: UUID(), name: item.name,
                                     trackIds: item.trackIds.compactMap { ids[$0] }, orderedEntries: restored)
            }
            let importedSmart = backup.smartFolders.map { item in
                MusicSmartFolder(id: UUID(), name: item.name, titleContains: item.titleContains,
                                 rule: item.rule)
            }
            let originalFiles = files
            let originalFolders = folders
            let originalPlaylists = playlists
            let originalSmart = smartFolders
            files += imported
            folders += additions
            playlists += importedLists
            smartFolders += importedSmart
            do { try save() } catch { files = originalFiles; folders = originalFolders; playlists = originalPlaylists; smartFolders = originalSmart; throw error }
            NativeMusicPlayer.shared.restoreProfiles(backup.audioProfiles)
        } catch {
            createdFiles.forEach { try? FileManager.default.removeItem(at: $0) }
            self.error = "No se pudo restaurar la copia con audio: \(error.localizedDescription)"
        }
        try? FileManager.default.removeItem(at: staging)
    }
}

struct NativeMyMusicScreen: View {
    @AppStorage("music.cellularPlayback") private var allowCellularPlayback = true
    @AppStorage("music.cellularDownloads") private var allowCellularDownloads = false
    @AppStorage("music.detailedVoiceOver") private var detailedVoiceOver = false
    @ObservedObject private var network = NativeMusicConnectionPolicy.shared
    @StateObject private var library = NativeMusicLibrary.shared
    @ObservedObject private var player = NativeMusicPlayer.shared
    @ObservedObject private var mixedQueue = NativeMixedMusicQueue.shared
    @State private var isImporting = false
    @State private var isImportingFolder = false
    @State private var searchText = ""
    @State private var newFolderName = ""
    @State private var showingFolderEditor = false
    @State private var showingPlaylistEditor = false
    @State private var showingSmartFolderEditor = false
    @State private var newPlaylistName = ""
    @State private var newSmartFolderName = ""
    @State private var newSmartFolderKeyword = ""
    @State private var selectedSmartRule = MusicSmartRuleKind.title
    @State private var editingGenreFile: MusicLocalFile?
    @State private var editingGenreValue = ""
    @State private var pendingRemoval: MusicLocalFile?
    @State private var exportingBackup = false
    @State private var importingBackup = false
    @State private var backupDocument: MusicBackupDocument?
    @State private var completeArchiveURL: URL?
    @State private var importingCompleteBackup = false
    @State private var selectingBackupDestination = false
    @State private var connectionWarning: String?

    private var playbackConnection: Binding<Int> {
        Binding(get: { allowCellularPlayback ? 1 : 0 }, set: { allowCellularPlayback = $0 == 1 })
    }

    private var downloadConnection: Binding<Int> {
        Binding(get: { allowCellularDownloads ? 1 : 0 }, set: { allowCellularDownloads = $0 == 1 })
    }

    private var voiceOverInformation: Binding<Int> {
        Binding(get: { detailedVoiceOver ? 1 : 0 }, set: { detailedVoiceOver = $0 == 1 })
    }

    private func playOnline(_ action: () -> Void) {
        guard network.canStream(allowCellular: allowCellularPlayback) else {
            connectionWarning = "La reproducción necesita una conexión permitida. Puedes cambiarla en Ajustes, Conexión."
            return
        }
        action()
    }

    private func stopOnlineIfConnectionIsRestricted() {
        guard !network.canStream(allowCellular: allowCellularPlayback) else { return }
        NativeRadioPlayer.shared.stop()
        NativeAudiusPlayer.shared.stop()
        NativeJamendoPlayer.shared.stop()
        NativeAppleMusicPlayer.shared.stop()
    }

    private var visibleFiles: [MusicLocalFile] {
        let query = searchText.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: .current)
        return library.files.filter {
            query.isEmpty || $0.name.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: .current).contains(query)
        }
    }

    private var musicAlbums: [MusicAlbumGroup] {
        let groups = library.files.compactMap { file -> MusicAlbumGroup? in
            guard let key = file.albumKey, let name = file.album else { return nil }
            return MusicAlbumGroup(id: key, name: name)
        }
        return Array(Dictionary(groups.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first }).values)
            .sorted { $0.name.localizedStandardCompare($1.name) == .orderedAscending }
    }

    private var albumKeysByURL: [URL: String] {
        Dictionary(uniqueKeysWithValues: library.files.compactMap { file -> (URL, String)? in
            guard let albumKey = file.albumKey else { return nil }
            return (library.audioURL(for: file), albumKey)
        })
    }

    private var automaticBackupChoice: Binding<Int> {
        Binding(
            get: { [0, 7, 30].firstIndex(of: library.autoBackupDays) ?? 0 },
            set: { index in
                guard [0, 7, 30].indices.contains(index) else { return }
                library.setAutomaticBackup(days: [0, 7, 30][index])
            }
        )
    }

    private var equalizerPresetChoice: Binding<Int> {
        let names = NativeMusicPlayer.presets.map(\.name)
        return Binding(
            get: { names.firstIndex(of: player.selectedPreset) ?? names.count },
            set: { index in
                guard names.indices.contains(index) else { return }
                player.selectPreset(names[index])
            }
        )
    }

    private var equalizerBandValues: [String] {
        (-12...12).map { "\($0) dB" }
    }

    private func equalizerBandChoice(_ index: Int) -> Binding<Int> {
        Binding(
            get: { min(24, max(0, Int(player.gains[index].rounded()) + 12)) },
            set: { selected in
                guard (0...24).contains(selected) else { return }
                let change = Float(selected - 12) - player.gains[index]
                player.adjustBand(index, by: change)
            }
        )
    }

    private var musicSettings: some View {
        List {
            Section("Conexión") {
                NativeAdjustableChoice(title: "Reproducción",
                    choices: ["Solo Wi-Fi", "Wi-Fi y datos móviles"], selectedIndex: playbackConnection)
                NativeAdjustableChoice(title: "Descargas",
                    choices: ["Solo Wi-Fi", "Wi-Fi y datos móviles"], selectedIndex: downloadConnection)
            }
            Section("Información de VoiceOver") {
                NativeAdjustableChoice(title: "Nivel",
                    choices: ["Normal", "Detallada"], selectedIndex: voiceOverInformation)
            }
            Section("Copias de seguridad") {
                Button("Exportar respaldo de biblioteca") {
                    backupDocument = library.exportIndex()
                    exportingBackup = backupDocument != nil
                }
                Button("Restaurar respaldo de biblioteca") { importingBackup = true }
                Button("Exportar copia completa con audio") { completeArchiveURL = library.createCompleteArchive() }
                Button("Restaurar copia completa con audio") { importingCompleteBackup = true }
                NativeAdjustableChoice(
                    title: "Copia automática",
                    choices: ["Desactivada", "Cada 7 días", "Cada 30 días"],
                    selectedIndex: automaticBackupChoice
                )
                if library.automaticBackupDestinationName == "Carpeta interna de Mi Música" {
                    Text("Destino de copias: Carpeta interna de Mi Música")
                } else {
                    Text(MusicLocalized.format("Destino de copias: %@", library.automaticBackupDestinationName))
                }
                Button("Elegir destino de copias automáticas") {
                    selectingBackupDestination = true
                }
                Button("Restablecer destino interno") {
                    library.resetAutomaticBackupDestination()
                }
                Text("Las copias automáticas del índice se crean al abrir Mi Música cuando corresponde; no se ejecutan en segundo plano.")
                Text("Este respaldo conserva el índice y las carpetas, pero no incluye los archivos de audio. Para recuperar música en otro dispositivo tendrás que importar también las canciones.")
            }
            Section("Ecualizador") {
                NativeAdjustableChoice(
                    title: "Perfil de ecualización",
                    choices: NativeMusicPlayer.presets.map(\.name) + ["Personalizado"],
                    selectedIndex: equalizerPresetChoice
                )
                ForEach(NativeMusicPlayer.frequencies.indices, id: \.self) { index in
                    NativeAdjustableChoice(
                        title: "\(Int(NativeMusicPlayer.frequencies[index])) Hz",
                        choices: equalizerBandValues,
                        selectedIndex: equalizerBandChoice(index)
                    )
                }
                Button("Guardar como perfil general") { player.saveAsGeneral() }
                Button("Guardar perfil para esta canción") { player.saveForCurrent() }
                    .disabled(player.currentName.isEmpty)
                if player.currentHasOverride {
                    Button("Quitar perfil de esta canción") { player.removeCurrentOverride() }
                }
            }
        }
        .navigationTitle("Ajustes de Mi Música")
    }

    private var musicPlayerSection: some View {
        Section("Reproductor") {
            musicTransportControls
            musicPlaybackOptions
        }
    }

    @ViewBuilder private var musicTransportControls: some View {
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
    }

    @ViewBuilder private var musicPlaybackOptions: some View {
        Button("Reproducción aleatoria: \(player.shuffleEnabled ? "activada" : "desactivada")") { player.toggleShuffle() }
        Button("Repetición: \(musicRepeatDescription)") { player.changeRepeat() }
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

    private var musicRepeatDescription: String {
        switch player.repeatMode {
        case "off": return "desactivada"
        case "all": return "toda la lista"
        default: return "una canción"
        }
    }

    private var musicLibrarySection: some View {
        Section("Mi biblioteca") {
            if library.files.isEmpty {
                Text("Todavía no hay canciones. Usa Organizar mi música para importarlas.")
            } else {
                ForEach(visibleFiles) { file in
                    HStack {
                        Button("Reproducir \(file.name)") {
                            player.play(
                                name: file.name,
                                url: library.audioURL(for: file),
                                queue: library.files.map { (name: $0.name, url: library.audioURL(for: $0)) },
                                albumKeysByURL: albumKeysByURL
                            )
                        }
                        .accessibilityLabel(detailedVoiceOver ?
                            MusicLocalized.format("Reproducir %@, artista %@, álbum %@, disponible sin conexión", file.name, file.artist ?? MusicLocalized.format("No indicado"), file.album ?? MusicLocalized.format("No indicado")) :
                            MusicLocalized.format("Reproducir %@", file.name))
                        Spacer()
                        Menu("Acciones de \(file.name)") {
                            Button("Editar género") {
                                editingGenreFile = file
                                editingGenreValue = file.genre ?? ""
                            }
                            ForEach(library.folders) { folder in
                                Button("Añadir a \(folder.name)") { library.assign(file.id, to: folder.id) }
                            }
                            ForEach(library.playlists) { playlist in
                                Button("Añadir a lista \(playlist.name)") { library.addToPlaylist(file.id, playlistId: playlist.id) }
                            }
                            Button("Eliminar de la biblioteca", role: .destructive) { pendingRemoval = file }
                        }
                    }
                }
            }
        }
    }

    private var musicAlbumsSection: some View {
        Section("Álbumes") {
            ForEach(musicAlbums) { album in
                Text(album.name)
                Button(MusicLocalized.format("Guardar ecualización para álbum %@", album.name)) {
                    player.saveForAlbum(album.id)
                }
                Button(MusicLocalized.format("Quitar ecualización de álbum %@", album.name)) {
                    player.removeAlbumOverride(album.id)
                }
                .disabled(!player.hasAlbumOverride(album.id))
            }
        }
    }

    private var musicFoldersSection: some View {
        Section("Mis carpetas") {
            ForEach(library.folders) { folder in
                HStack {
                    Text("\(folder.name), \(folder.trackIds.count) canciones")
                        .accessibilityLabel(detailedVoiceOver ?
                            MusicLocalized.format("%@, carpeta, %d canciones, guardadas en el iPhone", folder.name, folder.trackIds.count) :
                            MusicLocalized.format("%@, %d canciones", folder.name, folder.trackIds.count))
                    Spacer()
                    Button("Eliminar carpeta \(folder.name)") { library.removeFolder(folder.id) }
                        .accessibilityHint("Solo elimina esta carpeta virtual; las canciones se conservan.")
                }
            }
        }
    }

    @ViewBuilder private var musicQueueSection: some View {
        if mixedQueue.entries.indices.contains(mixedQueue.currentIndex) {
            Section("Reproducción de lista") {
                Text(MusicLocalized.format("Canción %d de %d: %@", mixedQueue.currentIndex + 1,
                    mixedQueue.entries.count, mixedQueue.entries[mixedQueue.currentIndex].title))
                Button("Canción anterior de la lista") { mixedQueue.previous() }
                    .disabled(mixedQueue.currentIndex == 0)
                Button("Siguiente canción de la lista") { mixedQueue.next() }
                    .disabled(mixedQueue.currentIndex + 1 >= mixedQueue.entries.count)
                Button("Detener reproducción de lista") { mixedQueue.stop() }
                if let problem = mixedQueue.error { Text(problem) }
            }
        }
    }

    private var musicPlaylistsSection: some View {
        Section("Listas de reproducción") {
            ForEach(library.playlists) { playlist in
                Text("\(playlist.name), \(library.playlistEntries(playlist).count) canciones")
                Button("Reproducir lista \(playlist.name)") {
                    mixedQueue.play(entries: library.playlistEntries(playlist), playlistID: playlist.id, localURLs: Dictionary(
                        uniqueKeysWithValues: library.files.map { ($0.id, library.audioURL(for: $0)) }),
                        albumKeysByURL: albumKeysByURL)
                }
                .disabled(library.playlistEntries(playlist).isEmpty)
                Button(MusicLocalized.format("Guardar ecualización para lista %@", playlist.name)) {
                    player.saveForPlaylist(playlist.id)
                }
                Button(MusicLocalized.format("Quitar ecualización de lista %@", playlist.name)) {
                    player.removePlaylistOverride(playlist.id)
                }
                .disabled(!player.hasPlaylistOverride(playlist.id))
                ForEach(library.playlistEntries(playlist)) { entry in
                    switch entry.provider {
                    case .appleMusic:
                        Button(MusicLocalized.format("Escuchar %@, %@, Apple Music", entry.title, entry.artist ?? "")) {
                            playOnline {
                                Task {
                                    await NativeAppleMusicPlayer.shared.playSaved(
                                        id: entry.appleMusicSongId ?? "", title: entry.title)
                                }
                            }
                        }
                    case .audius:
                        Button(MusicLocalized.format("Escuchar %@, %@, Audius", entry.title, entry.artist ?? "")) {
                            playOnline { NativeAudiusPlayer.shared.play(id: entry.appleMusicSongId ?? "", title: entry.title) }
                        }
                    case .jamendo:
                        Button(MusicLocalized.format("Escuchar %@, %@, Jamendo", entry.title, entry.artist ?? "")) {
                            playOnline { Task { await NativeJamendoPlayer.shared.playSaved(id: entry.appleMusicSongId ?? "") } }
                        }
                    case .local:
                        if entry.localId != nil,
                           !library.files.contains(where: { $0.id == entry.localId }) {
                            Text("\(entry.title), archivo no disponible")
                        }
                    }
                    HStack {
                        Button(MusicLocalized.format("Subir %@ en la lista", entry.title)) {
                            library.movePlaylistEntry(playlistID: playlist.id, entryID: entry.id, by: -1)
                        }
                        .disabled(library.playlistEntries(playlist).first?.id == entry.id)
                        Button(MusicLocalized.format("Bajar %@ en la lista", entry.title)) {
                            library.movePlaylistEntry(playlistID: playlist.id, entryID: entry.id, by: 1)
                        }
                        .disabled(library.playlistEntries(playlist).last?.id == entry.id)
                    }
                }
                Button("Eliminar lista \(playlist.name)") { library.removePlaylist(playlist.id) }
            }
        }
    }

    private var musicSmartFoldersSection: some View {
        Section("Carpetas inteligentes") {
            ForEach(library.smartFolders) { folder in
                let matches = library.matchingTracks(for: folder)
                Text("\(folder.name), criterio: \(folder.ruleKind.label) \(folder.titleContains), \(matches.count) canciones")
                Button("Reproducir carpeta inteligente \(folder.name)") {
                    let items = matches.map { (name: $0.name, url: library.audioURL(for: $0)) }
                    if let first = items.first { player.play(name: first.name, url: first.url, queue: items,
                        albumKeysByURL: albumKeysByURL) }
                }
                .disabled(matches.isEmpty)
                Button("Eliminar carpeta inteligente \(folder.name)") { library.removeSmartFolder(folder.id) }
            }
        }
    }

    private var musicOrganizeSection: some View {
        Section {
            Menu("Organizar mi música") {
                Button("Importar canciones") { isImporting = true }
                Button("Importar carpeta desde Archivos o nube") { isImportingFolder = true }
                Button("Crear carpeta") { showingFolderEditor = true }
                Button("Crear lista de reproducción") { showingPlaylistEditor = true }
                Button("Crear carpeta inteligente") { showingSmartFolderEditor = true }
            }
            NavigationLink("Google Drive") {
                NativeCloudGooglePickerScreen(onImport: { file in
                    library.importFiles([file])
                }, allowCellularDownloads: allowCellularDownloads)
            }
            NavigationLink("Dropbox") {
                NativeCloudFolderBrowserScreen(provider: .dropbox, onImport: { file in
                    library.importFiles([file])
                }, allowCellularDownloads: allowCellularDownloads)
            }
            NavigationLink("Ajustes") { musicSettings }
            NavigationLink("Plataformas musicales") {
                NativeMusicPlatformsScreen(playlists: library.playlists.map {
                    MusicPlaylistDestination(id: $0.id, name: $0.name)
                }, addToPlaylist: { provider, songID, title, artist, playlistID in
                    guard let source = MusicPlaylistEntry.Provider(rawValue: provider) else { return }
                    library.addRemoteToPlaylist(provider: source, songID: songID,
                        title: title, artist: artist, playlistID: playlistID)
                })
            }
        }
    }

    var body: some View {
        List {
            musicPlayerSection
            musicLibrarySection
            musicAlbumsSection
            musicFoldersSection
            musicQueueSection
            musicPlaylistsSection
            musicSmartFoldersSection
            musicOrganizeSection
        }
        .navigationTitle("Mi Música")
        .onReceive(network.$path) { _ in stopOnlineIfConnectionIsRestricted() }
        .onChange(of: allowCellularPlayback) { _, _ in stopOnlineIfConnectionIsRestricted() }
        .alert("Conexión", isPresented: Binding(
            get: { connectionWarning != nil }, set: { if !$0 { connectionWarning = nil } }
        )) { Button("Aceptar") { connectionWarning = nil } } message: { Text(connectionWarning ?? "") }
        .searchable(text: $searchText, prompt: "Buscar canciones")
        .alert("Crear carpeta", isPresented: $showingFolderEditor) {
            TextField("Nombre de la carpeta", text: $newFolderName)
            Button("Crear") { library.addFolder(newFolderName); newFolderName = "" }
            Button("Cancelar", role: .cancel) { newFolderName = "" }
        } message: {
            Text("La carpeta será virtual y no modificará tus archivos originales.")
        }
        .alert("Crear lista de reproducción", isPresented: $showingPlaylistEditor) {
            TextField("Nombre de la lista", text: $newPlaylistName)
            Button("Crear") { library.addPlaylist(newPlaylistName); newPlaylistName = "" }
            Button("Cancelar", role: .cancel) { newPlaylistName = "" }
        } message: { Text("Puedes añadir canciones desde el menú Acciones de cada canción.") }
        .sheet(isPresented: $showingSmartFolderEditor) {
            NavigationStack {
                Form {
                    TextField("Nombre de la carpeta", text: $newSmartFolderName)
                    Picker("Criterio de carpeta inteligente", selection: $selectedSmartRule) {
                        ForEach(MusicSmartRuleKind.allCases) { rule in
                            Text(LocalizedStringKey(rule.label)).tag(rule)
                        }
                    }
                    TextField("Valor del criterio", text: $newSmartFolderKeyword)
                    Text("Para fecha, escribe AAAA-MM-DD. Para reproducciones, escribe el número mínimo.")
                    Text("Su contenido se actualiza automáticamente al añadir o retirar canciones.")
                }
                .navigationTitle("Crear carpeta inteligente")
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Cancelar") { showingSmartFolderEditor = false }
                    }
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Crear") {
                            library.addSmartFolder(newSmartFolderName, titleContains: newSmartFolderKeyword, rule: selectedSmartRule)
                            newSmartFolderName = ""
                            newSmartFolderKeyword = ""
                            selectedSmartRule = .title
                            showingSmartFolderEditor = false
                        }
                        .disabled(newSmartFolderName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ||
                            newSmartFolderKeyword.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    }
                }
            }
        }
        .alert("Editar género", isPresented: Binding(
            get: { editingGenreFile != nil },
            set: { if !$0 { editingGenreFile = nil } }
        )) {
            TextField("Género musical", text: $editingGenreValue)
            Button("Guardar") {
                if let file = editingGenreFile { library.updateGenre(file.id, genre: editingGenreValue) }
                editingGenreFile = nil
            }
            Button("Cancelar", role: .cancel) { editingGenreFile = nil }
        } message: {
            Text("Este género solo se guardará en tu biblioteca y no modificará el archivo original.")
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
        .fileImporter(isPresented: $selectingBackupDestination, allowedContentTypes: [.folder]) { result in
            switch result {
            case .success(let url): library.chooseAutomaticBackupDestination(url)
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
