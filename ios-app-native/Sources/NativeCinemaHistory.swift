import SwiftUI
import Foundation
import CryptoKit
import AVFoundation
import UIKit

struct NativeCinemaRecent: Codable, Identifiable {
    let id: String
    let source: String
    let title: String
    var seconds: Double
    var duration: Double
    var finished: Bool
    static func digest(_ value: String) -> String {
        SHA256.hash(data: Data(value.utf8)).map { String(format: "%02x", $0) }.joined()
    }
    static func source(_ reference: String) -> String {
        if reference.hasPrefix("gdrive-public:audesc-es:") { return "public-es" }
        if reference.hasPrefix("gdrive-public:audesc-latino:") { return "public-latino" }
        if reference.hasPrefix("gdrive:audesc-es:") { return "drive-es" }
        if reference.hasPrefix("gdrive:audesc-latino:") { return "drive-latino" }
        if reference.hasPrefix("audiocinemateca:") { return "audiocinemateca" }
        if reference.hasPrefix("tape-territory:") { return "tape-territory" }
        if reference.hasPrefix("movies-for-the-blind:") { return "movies-for-the-blind" }
        return ""
    }
    var providerName: String {
        switch source {
        case "personal": return "Mi colección personal"
        case "audiocinemateca": return "Audiocinemateca"
        case "tape-territory": return "Tape Territory"
        case "movies-for-the-blind": return "Movies for the Blind"
        case "public-es", "drive-es": return "Universo Audesc España"
        case "public-latino", "drive-latino": return "Universo Audesc Latino"
        default: return ""
        }
    }
}

@MainActor
final class NativeCinemaRecentStore: ObservableObject {
    static let shared = NativeCinemaRecentStore()
    @Published private(set) var entries: [NativeCinemaRecent] = []
    @Published private(set) var favorites: [NativeCinemaRecent] = []
    private var favoritesURL: URL { url.deletingLastPathComponent().appendingPathComponent("cinema-favorites-v1.json") }
    private var suppressedKeys = Set<String>()
    private let url = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        .appendingPathComponent("cinema-recent-v1.json")
    init() {
        if let data = try? Data(contentsOf: url),
           let saved = try? JSONDecoder().decode([NativeCinemaRecent].self, from: data) {
            entries = Self.retained(saved)
        }
        if let data = try? Data(contentsOf: favoritesURL),
           let saved = try? JSONDecoder().decode([NativeCinemaRecent].self, from: data) {
            favorites = saved
        }
    }

    private func persistFavorites() {
        try? FileManager.default.createDirectory(at: favoritesURL.deletingLastPathComponent(), withIntermediateDirectories: true)
        if let data = try? JSONEncoder().encode(favorites) {
            try? data.write(to: favoritesURL, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
        }
    }

    func isFavorite(_ selection: NativeCinemaPlaybackSelection) -> Bool {
        guard let id = selection.keys.first else { return false }
        return favorites.contains { $0.id == id }
    }

    func toggleFavorite(_ selection: NativeCinemaPlaybackSelection) {
        guard let id = selection.keys.first else { return }
        if favorites.contains(where: { $0.id == id }) {
            favorites.removeAll { $0.id == id }
        } else {
            favorites.insert(NativeCinemaRecent(id: id, source: selection.historySource, title: selection.title,
                seconds: 0, duration: 0, finished: false), at: 0)
        }
        persistFavorites()
    }

    func removeFavorite(_ id: String) {
        favorites.removeAll { $0.id == id }
        persistFavorites()
    }
    private func persist() {
        try? FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        if let data = try? JSONEncoder().encode(entries) {
            try? data.write(to: url, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
        }
    }

    func prepareBackupHistory(_ incoming: [NativeCinemaRecent], favorites incomingFavorites: [NativeCinemaRecent] = [],
                              recovery: NativeBackupRecoveryBuilder? = nil) throws
        -> (apply: () throws -> Void, rollback: () throws -> Void, omitted: Int) {
        let old = entries
        var ids = Set(entries.map(\.id))
        recovery?.recordPreserved(section: "cinema", kind: "history",
            identifiers: incoming.filter { ids.contains($0.id) }.map(\.id))
        let missing = incoming.filter { !suppressedKeys.contains($0.id) && ids.insert($0.id).inserted }
        let combined = Self.retained(entries + missing)
        let accepted = missing.filter { candidate in combined.contains { $0.id == candidate.id } }
        let oldFavorites = favorites
        var favoriteIDs = Set(favorites.map(\.id))
        let combinedFavorites = favorites + incomingFavorites.filter { favoriteIDs.insert($0.id).inserted }
        let disk = try NativeBackupFileRestore(moves: [], indexes: [
            (url, try JSONEncoder().encode(combined)),
            (favoritesURL, try JSONEncoder().encode(combinedFavorites))
        ], recovery: recovery)
        return ({
            try disk.apply()
            self.entries = combined
            self.favorites = combinedFavorites
        }, {
            try disk.rollback()
            self.entries = old
            self.favorites = oldFavorites
        }, incoming.filter { candidate in !old.contains(where: { $0.id == candidate.id }) }.count - accepted.count)
    }

    // Never evict an unfinished work because another one was played.
    private static func retained(_ values: [NativeCinemaRecent]) -> [NativeCinemaRecent] {
        var completed = 0
        return values.filter {
            if !$0.finished { return true }
            completed += 1
            return completed <= 100
        }
    }

    func remember(key: String, source: String, title: String, seconds: Double, duration: Double) {
        guard !key.isEmpty, !source.isEmpty, !suppressedKeys.contains(key),
              seconds.isFinite, duration.isFinite, seconds >= 0, duration >= 0 else { return }
        let recent = NativeCinemaRecent(id: key, source: source, title: title,
            seconds: seconds, duration: duration, finished: false)
        entries = Self.retained([recent] + entries.filter { $0.id != key })
        persist()
    }
    func markFinished(key: String) {
        guard let index = entries.firstIndex(where: { $0.id == key }) else { return }
        entries[index].finished = true
        entries[index].seconds = 0
        entries = Self.retained(entries)
        persist()
    }
    func allow(key: String) { suppressedKeys.remove(key) }
    func remove(_ key: String) { suppressedKeys.insert(key); entries.removeAll { $0.id == key }; persist() }
    func clear() { suppressedKeys.formUnion(entries.map(\.id)); entries = []; persist() }
    func removeSource(_ source: String) {
        suppressedKeys.formUnion(entries.filter { $0.source == source }.map(\.id))
        entries.removeAll { $0.source == source }
        favorites.removeAll { $0.source == source }
        persist()
        persistFavorites()
    }
}

@MainActor
struct NativeCinemaTransportControls: View {
    @ObservedObject var player: NativeCinemaAudioPlayer
    let library: NativeCinemaLocalLibrary
    static func clock(_ seconds: Double) -> String {
        guard seconds.isFinite, seconds >= 0, seconds < Double(Int.max) else { return "0:00" }
        let total = Int(seconds)
        return total >= 3600 ? String(format: "%d:%02d:%02d", total / 3600, total / 60 % 60, total % 60)
            : String(format: "%d:%02d", total / 60, total % 60)
    }
    var body: some View {
        if player.buffering { ProgressView("Cargando reproducción") }
        Text(MusicLocalized.format("Posición: %@. Duración: %@.", Self.clock(player.seconds),
            player.duration > 0 ? Self.clock(player.duration) : MusicLocalized.message("Desconocida")))
        Button(player.playing ? "Pausar reproducción" : "Reanudar reproducción") { player.toggle(library: library) }
            .disabled(player.playbackError != nil)
        Button("Retroceder treinta segundos") { player.seek(by: -30, library: library) }
            .disabled(player.playbackError != nil || player.buffering)
        Button("Avanzar treinta segundos") { player.seek(by: 30, library: library) }
            .disabled(player.playbackError != nil || player.buffering)
        Button("Detener reproducción") { player.pauseAndSave(library: library) }
    }
}

@MainActor
struct NativeCinemaHistoryScreen: View {
    @ObservedObject private var store = NativeCinemaRecentStore.shared
    @State private var confirm = false
    @State private var pendingRemoval: NativeCinemaRecent?
    var body: some View {
        List {
            ForEach(store.entries) { recent in
                NavigationLink {
                    NativeCinemaResumeScreen(recent: recent)
                } label: {
                    VStack(alignment: .leading) {
                        Text(recent.title)
                        Text(MusicLocalized.message(recent.providerName))
                        if recent.finished { Text("Finalizado") }
                        else { Text(MusicLocalized.format("Posición: %@. Duración: %@.", NativeCinemaTransportControls.clock(recent.seconds),
                            recent.duration > 0 ? NativeCinemaTransportControls.clock(recent.duration) : MusicLocalized.message("Desconocida"))) }
                    }.accessibilityElement(children: .combine)
                }
                .swipeActions(allowsFullSwipe: false) { Button("Eliminar", role: .destructive) { pendingRemoval = recent; confirm = true } }
                .accessibilityAction(named: Text("Eliminar del historial")) { pendingRemoval = recent; confirm = true }
            }
            if store.entries.isEmpty { Text("No hay obras en el historial.") }
            if !store.entries.isEmpty { Button("Borrar historial", role: .destructive) { pendingRemoval = nil; confirm = true } }
        }
        .tifloScreenSurface()
        .navigationTitle("Historial de Multicines")
        .confirmationDialog(pendingRemoval.map { MusicLocalized.format("¿Eliminar «%@»?", $0.title) } ?? MusicLocalized.message("¿Borrar el historial de Multicines?"), isPresented: $confirm, titleVisibility: .visible) {
            if let recent = pendingRemoval {
                Button("Eliminar del historial", role: .destructive) { store.remove(recent.id); pendingRemoval = nil }
            } else {
                Button("Borrar historial", role: .destructive) { store.clear() }
            }
            Button("Cancelar", role: .cancel) { pendingRemoval = nil }
        }
    }
}


@MainActor
enum NativeCinemaPlaybackSelection {
    case personal(NativeCinemaLocalItem)
    case tape(NativeTapeTerritoryCatalogue.Film)
    case movie(NativeMoviesForTheBlindWork)
    case audio(NativeAudiocinematecaCatalogueIndex.Entry)
    case drive(NativeCinemaDriveSearchHit)
    case privateDrive(sourceID: String, item: NativeCloudItem)

    var title: String {
        switch self {
        case .personal(let item): return item.title
        case .tape(let film): return film.title
        case .movie(let work): return work.title
        case .audio(let entry): return entry.title
        case .drive(let hit): return hit.entry.name
        case .privateDrive(_, let item): return item.name
        }
    }
    var provider: String {
        switch self {
        case .personal: return "Mi colección personal"
        case .tape: return "Tape Territory"
        case .movie: return "Movies for the Blind"
        case .audio: return "Audiocinemateca"
        case .drive, .privateDrive: return "Universo Audesc"
        }
    }
    var language: String {
        switch self {
        case .personal(let item): return item.language.rawValue
        case .tape, .movie: return "Inglés"
        case .audio(let entry):
            return entry.languageCode == "1" ? "Español de España" :
                entry.languageCode == "2" ? "Español de Latinoamérica" : "No indicado"
        case .drive(let hit): return hit.sourceID == "audesc-es" ? "Español de España" : "Español latino"
        case .privateDrive(let sourceID, _): return sourceID == "audesc-es" ? "Español de España" : "Español latino"
        }
    }
    var year: String {
        switch self {
        case .tape(let film): return String(film.year)
        case .audio(let entry): return entry.year
        default: return ""
        }
    }
    var details: String? {
        switch self {
        case .tape(let film): return film.synopsis
        case .audio(let entry): return entry.synopsis
        default: return nil
        }
    }
    var label: String {
        [title, year, MusicLocalized.message(provider), MusicLocalized.message(language)].filter { !$0.isEmpty }.joined(separator: ", ")
    }
    var keys: [String] {
        switch self {
        case .personal(let item): return [item.id.uuidString]
        case .tape(let film): return [NativeCinemaRecent.digest("tape-territory:" + film.slug)]
        case .movie(let work):
            return work.parts.map { NativeCinemaRecent.digest("movies-for-the-blind:" + NativeCinemaRecent.digest($0.id)) }
        case .audio(let entry):
            return entry.parts.map { NativeCinemaRecent.digest(NativeAudiocinematecaPlaybackRow.reference(entry: entry, part: $0)) }
        case .drive(let hit): return [NativeCinemaRecent.digest("gdrive-public:" + hit.sourceID + "::" + hit.entry.id)]
        case .privateDrive(let sourceID, let item): return [NativeCinemaRecent.digest("gdrive:" + sourceID + ":" + item.id)]
        }
    }
    var historySource: String {
        switch self {
        case .personal: return "personal"
        case .tape: return "tape-territory"
        case .movie: return "movies-for-the-blind"
        case .audio: return "audiocinemateca"
        case .drive(let hit): return hit.sourceID == "audesc-es" ? "public-es" : "public-latino"
        case .privateDrive(let sourceID, _): return sourceID == "audesc-es" ? "drive-es" : "drive-latino"
        }
    }
    var hasSavedPosition: Bool {
        NativeCinemaRecentStore.shared.entries.contains { !$0.finished && keys.contains($0.id) && $0.seconds > 0 }
    }
    func containsCurrent(_ player: NativeCinemaAudioPlayer) -> Bool {
        guard let id = player.currentID else { return false }
        let key = player.currentCloudReference.map(NativeCinemaRecent.digest) ?? id.uuidString
        return keys.contains(key)
    }
    private func startIndex(fromBeginning: Bool) -> Int {
        guard !fromBeginning else { return 0 }
        let recent = NativeCinemaRecentStore.shared.entries
        if let latest = recent.first(where: { !$0.finished && keys.contains($0.id) }),
           let index = keys.firstIndex(of: latest.id) { return index }
        if keys.count > 1, let latest = recent.first(where: { $0.finished && keys.contains($0.id) }),
           let index = keys.firstIndex(of: latest.id), index + 1 < keys.count { return index + 1 }
        return 0
    }

    func start(fromBeginning: Bool, library: NativeCinemaLocalLibrary, player: NativeCinemaAudioPlayer) async throws {
        if containsCurrent(player), !fromBeginning, player.playbackError == nil {
            if !player.playing { player.toggle(library: library) }
            return
        }
        try Task.checkCancellation()
        switch self {
        case .personal(let item):
            try player.open(item, library: library, fromBeginning: fromBeginning)
        case .tape(let film):
            guard let url = film.describedStream else { throw NativeCinemaLocalError.unsupported }
            try player.openTapeTerritory(url, title: film.title, slug: film.slug, library: library, fromBeginning: fromBeginning)
        case .movie(let work):
            let index = startIndex(fromBeginning: fromBeginning)
            guard work.parts.indices.contains(index) else { throw NativeCinemaLocalError.missing }
            try player.openMoviePart(work.parts[index], workTitle: work.title,
                followedBy: Array(work.parts.dropFirst(index + 1)), library: library, fromBeginning: fromBeginning)
        case .audio(let entry):
            let index = startIndex(fromBeginning: fromBeginning)
            guard entry.parts.indices.contains(index) else { throw NativeCinemaLocalError.missing }
            // Films in several files continue automatically; series respect the selected episode.
            let remaining = entry.category == "series" ? [] : Array(entry.parts.dropFirst(index + 1))
            try player.openAudiocinematecaPart(entry: entry, part: entry.parts[index],
                followedBy: remaining, library: library, fromBeginning: fromBeginning)
        case .drive(let hit):
            let allowCellular = UserDefaults.standard.bool(forKey: "cinema.cellularDownloads")
            guard NativeMusicConnectionPolicy.shared.canDownload(allowCellular: allowCellular) else {
                throw NativeCinemaDirectError.wifiRequired
            }
            let resolved = try await NativeCinemaPublicDrive().resolveSearchHit(hit)
            try Task.checkCancellation()
            guard let loader = NativeCinemaDriveResourceLoader(item: resolved.entry, ancestors: resolved.path,
                                                                allowsCellular: allowCellular) else {
                throw NativeCinemaPublicDriveError.unsupported
            }
            do {
                try player.openPublicStream(asset: loader.makeAsset(), loader: loader, title: resolved.entry.name,
                    reference: "gdrive-public:" + hit.sourceID + "::" + resolved.entry.id,
                    isVideo: resolved.entry.isVideo, library: library, fromBeginning: fromBeginning)
            } catch {
                loader.cancel()
                throw error
            }
        case .privateDrive(let sourceID, let item):
            let allowCellular = UserDefaults.standard.bool(forKey: "cinema.cellularDownloads")
            guard NativeMusicConnectionPolicy.shared.canDownload(allowCellular: allowCellular) else {
                throw NativeCinemaDirectError.wifiRequired
            }
            let token = try await NativeCloudAccountStore.shared.validAccessToken(for: .googleDrive)
            let storage = try NativeCloudStorage(provider: .googleDrive, accessToken: token)
            let file = try await storage.downloadCinema(item, allowsCellular: allowCellular)
            do {
                try Task.checkCancellation()
                try player.openTemporaryFile(file, title: item.name, reference: "gdrive:" + sourceID + ":" + item.id,
                    library: library, fromBeginning: fromBeginning)
            } catch {
                try? FileManager.default.removeItem(at: file)
                throw error
            }
        }
    }

    /// Recover only from the user's previously selected authorized folder.
    /// No OAuth expansion, raw references or credentials are persisted.
    static func resolvePrivateDrive(sourceID: String, key: String) async throws -> Self? {
        guard ["audesc-es", "audesc-latino"].contains(sourceID),
              let root = UserDefaults.standard.string(forKey: "cinema.drive.root." + sourceID), !root.isEmpty else { return nil }
        let token = try await NativeCloudAccountStore.shared.validAccessToken(for: .googleDrive)
        let storage = try NativeCloudStorage(provider: .googleDrive, accessToken: token)
        var pending: [String] = [root]
        var offset = 0
        var visited = Set<String>()
        while offset < pending.count {
            try Task.checkCancellation()
            let folder = pending[offset]
            offset += 1
            guard visited.insert(folder).inserted else { continue }
            var cursor: String?
            var cursors = Set<String>()
            repeat {
                try Task.checkCancellation()
                let page = try await storage.listFolder(id: folder, cursor: cursor)
                for item in page.items {
                    if item.isFolder { pending.append(item.id) }
                    else if NativeCinemaRecent.digest("gdrive:" + sourceID + ":" + item.id) == key {
                        return .privateDrive(sourceID: sourceID, item: item)
                    }
                }
                cursor = page.nextCursor
                if let cursor, !cursors.insert(cursor).inserted { throw NativeCinemaPublicDriveError.badResponse }
            } while cursor != nil
        }
        return nil
    }
}

private enum NativeCinemaDirectError: LocalizedError {
    case wifiRequired
    var errorDescription: String? {
        MusicLocalized.message("La descarga está limitada a Wi-Fi. Activa los datos móviles si quieres permitirla.")
    }
}

@MainActor
struct NativeCinemaPlaybackRequest: Identifiable {
    let id = UUID()
    let selection: NativeCinemaPlaybackSelection
    var fromBeginning = false
    var informationOnly = false
}

@MainActor
struct NativeCinemaDirectPlaybackScreen: View {
    let request: NativeCinemaPlaybackRequest
    @Environment(\.dismiss) private var dismiss
    @ObservedObject private var player = NativeCinemaAudioPlayer.shared
    @ObservedObject private var library = NativeCinemaLocalLibrary.shared
    @ObservedObject private var recents = NativeCinemaRecentStore.shared
    @State private var started = false
    @State private var loading = false
    @State private var failure: String?
    var body: some View {
        List {
            Text(request.selection.label).accessibilityAddTraits(.isHeader)
            if request.informationOnly {
                if let details = request.selection.details, !details.isEmpty { Text(details) }
                Button("Reproducir") { Task { await play(fromBeginning: false) } }
                Button("Reproducir desde el principio") { Task { await play(fromBeginning: true) } }
                switch request.selection {
                case .audio(let entry):
                    NavigationLink("Ficha de la obra") { NativeAudiocinematecaDetail(entry: entry) }
                case .personal(let item):
                    Text(MusicLocalized.message(item.kind.rawValue))
                default: EmptyView()
                }
            }
            Button(recents.isFavorite(request.selection) ? "Quitar de favoritos" : "Añadir a favoritos") {
                recents.toggleFavorite(request.selection)
            }
            if loading { ProgressView("Cargando reproducción") }
            if let failure {
                Text(failure).accessibilityAddTraits(.updatesFrequently)
                Button("Reintentar") { Task { await play(fromBeginning: request.fromBeginning) } }
            }
            if request.selection.containsCurrent(player) {
                if let error = player.playbackError {
                    Text(error).accessibilityAddTraits(.updatesFrequently)
                    Button("Volver a intentar") { Task { await play(fromBeginning: false) } }
                    if case .drive(let hit) = request.selection {
                        NavigationLink("Explorar catálogo audiodescrito") {
                            NativeCinemaPublishedDriveBrowser(sourceID: hit.sourceID, sourceName: request.selection.provider, initialHit: hit)
                        }
                    }
                }
                if player.currentCloudIsVideo, let video = player.videoPlayer {
                    NativeCinemaVideoSurface(player: video).frame(height: 210).accessibilityHidden(true)
                }
                NativeCinemaTransportControls(player: player, library: library)
                Button("Reproducir desde el principio") { Task { await play(fromBeginning: true) } }
            }
        }
        .tifloScreenSurface()
        .navigationTitle(request.selection.title)
        .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Cerrar") { dismiss() } } }
        .task {
            guard !started, !request.informationOnly else { return }
            started = true
            await play(fromBeginning: request.fromBeginning)
        }
    }
    private func play(fromBeginning: Bool) async {
        guard !loading else { return }
        loading = true
        failure = nil
        defer { loading = false }
        do { try await request.selection.start(fromBeginning: fromBeginning, library: library, player: player) }
        catch { if !Task.isCancelled { failure = error.localizedDescription } }
    }
}

@MainActor
struct NativeCinemaResumeScreen: View {
    let recent: NativeCinemaRecent
    var autoResume = false
    @ObservedObject private var player = NativeCinemaAudioPlayer.shared
    @ObservedObject private var library = NativeCinemaLocalLibrary.shared
    @State private var selection: NativeCinemaPlaybackSelection?
    @State private var loading = false
    @State private var failed = false
    @State private var didResolve = false
    @State private var errorText: String?
    var body: some View {
        List {
            Text(recent.title).accessibilityAddTraits(.isHeader)
            if let selection {
                Button("Reproducir") { Task { await play(selection, fromBeginning: false) } }
                Button("Reproducir desde el principio") { Task { await play(selection, fromBeginning: true) } }
                if selection.containsCurrent(player) {
                    if let error = player.playbackError { Text(error) }
                    if player.currentCloudIsVideo, let video = player.videoPlayer {
                        NativeCinemaVideoSurface(player: video).frame(height: 210).accessibilityHidden(true)
                    }
                    NativeCinemaTransportControls(player: player, library: library)
                }
            } else if ["drive-es", "drive-latino"].contains(recent.source) {
                NavigationLink("Explorar carpeta de Google Drive") {
                    NativeCinemaDriveBrowser(sourceID: recent.source == "drive-es" ? "audesc-es" : "audesc-latino", sourceName: recent.providerName)
                }
            }
            if loading { ProgressView("Consultando catálogos…") }
            if failed {
                Text(errorText ?? MusicLocalized.message("No se ha podido recuperar esta obra del catálogo actual."))
                Button("Reintentar") { Task { await resolve() } }
            }
        }
        .tifloScreenSurface()
        .navigationTitle(recent.title)
        .task {
            guard !didResolve else { return }
            didResolve = true
            await resolve()
        }
    }

    private func play(_ selection: NativeCinemaPlaybackSelection, fromBeginning: Bool) async {
        do { try await selection.start(fromBeginning: fromBeginning, library: library, player: player) }
        catch {
            if !Task.isCancelled {
                failed = true
                errorText = error.localizedDescription
            }
        }
    }

    private func resolve() async {
        guard !loading else { return }
        loading = true; failed = false; errorText = nil
        defer { loading = false }
        do {
            switch recent.source {
            case "personal":
                if let item = library.items.first(where: { $0.id.uuidString == recent.id }) {
                    selection = .personal(item)
                }
            case "tape-territory":
                if let film = try await NativeTapeTerritoryCatalogue.fetchFilms().first(where: {
                    NativeCinemaRecent.digest("tape-territory:" + $0.slug) == recent.id
                }) { selection = .tape(film) }
            case "movies-for-the-blind":
                if let work = try await NativeMoviesForTheBlindWork.fetchWorks().first(where: { work in
                    work.parts.contains { NativeCinemaRecent.digest("movies-for-the-blind:" + NativeCinemaRecent.digest($0.id)) == recent.id }
                }) { selection = .movie(work) }
            case "audiocinemateca":
                guard let account = NativeAudiocinematecaCredentials.load() else { failed = true; return }
                let entries = try await NativeAudiocinematecaCache.shared.refresh(account: account)
                guard let current = NativeAudiocinematecaCredentials.load(), current.username == account.username,
                      current.password == account.password else { failed = true; return }
                if let entry = entries.first(where: { entry in
                    entry.parts.contains {
                        NativeCinemaRecent.digest(NativeAudiocinematecaPlaybackRow.reference(entry: entry, part: $0)) == recent.id
                    }
                }) { selection = .audio(entry) }
            case "public-es", "public-latino":
                let sourceID = recent.source == "public-es" ? "audesc-es" : "audesc-latino"
                let result = try await NativeCinemaPublicDrive().searchPublished(sourceID: sourceID, query: recent.title, kind: .all)
                if let hit = result.hits.first(where: { NativeCinemaRecent.digest("gdrive-public:" + sourceID + "::" + $0.entry.id) == recent.id }) {
                    selection = .drive(hit)
                }
            case "drive-es", "drive-latino":
                selection = try await NativeCinemaPlaybackSelection.resolvePrivateDrive(
                    sourceID: recent.source == "drive-es" ? "audesc-es" : "audesc-latino", key: recent.id)
            default: break
            }
            try Task.checkCancellation()
            guard let selection else { failed = true; return }
            if autoResume { await play(selection, fromBeginning: false) }
        } catch { if !Task.isCancelled { failed = true; errorText = error.localizedDescription } }
    }
}
