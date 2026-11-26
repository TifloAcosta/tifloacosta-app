import SwiftUI
import Foundation
import CryptoKit

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
        case "public-latino", "drive-latino": return "Universo Audesc Latina"
        default: return ""
        }
    }
}

@MainActor
final class NativeCinemaRecentStore: ObservableObject {
    static let shared = NativeCinemaRecentStore()
    @Published private(set) var entries: [NativeCinemaRecent] = []
    private var suppressedKeys = Set<String>()
    private let url = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        .appendingPathComponent("cinema-recent-v1.json")
    init() {
        if let data = try? Data(contentsOf: url),
           let saved = try? JSONDecoder().decode([NativeCinemaRecent].self, from: data) {
            entries = Array(saved.prefix(100))
        }
    }
    private func persist() {
        try? FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        if let data = try? JSONEncoder().encode(entries) {
            try? data.write(to: url, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
        }
    }

    func prepareBackupHistory(_ incoming: [NativeCinemaRecent], recovery: NativeBackupRecoveryBuilder? = nil) throws
        -> (apply: () throws -> Void, rollback: () throws -> Void, omitted: Int) {
        let old = entries
        var ids = Set(entries.map(\.id))
        let missing = incoming.filter { !suppressedKeys.contains($0.id) && ids.insert($0.id).inserted }
        let accepted = Array(missing.prefix(max(0, 100 - entries.count)))
        let combined = entries + accepted
        let disk = try NativeBackupFileRestore(moves: [], indexes: [(url, try JSONEncoder().encode(combined))], recovery: recovery)
        return ({
            try disk.apply()
            self.entries = combined
        }, {
            try disk.rollback()
            self.entries = old
        }, incoming.filter { candidate in !old.contains(where: { $0.id == candidate.id }) }.count - accepted.count)
    }

    func remember(key: String, source: String, title: String, seconds: Double, duration: Double) {
        guard !key.isEmpty, !source.isEmpty, !suppressedKeys.contains(key),
              seconds.isFinite, duration.isFinite, seconds >= 0, duration >= 0 else { return }
        entries = NativeCinemaRules.upsert(NativeCinemaRecent(id: key, source: source, title: title,
            seconds: seconds, duration: duration, finished: false), in: entries)
        persist()
    }
    func markFinished(key: String) {
        guard let index = entries.firstIndex(where: { $0.id == key }) else { return }
        entries[index].finished = true
        entries[index].seconds = 0
        persist()
    }
    func allow(key: String) { suppressedKeys.remove(key) }
    func remove(_ key: String) { suppressedKeys.insert(key); entries.removeAll { $0.id == key }; persist() }
    func clear() { suppressedKeys.formUnion(entries.map(\.id)); entries = []; persist() }
    func removeSource(_ source: String) {
        suppressedKeys.formUnion(entries.filter { $0.source == source }.map(\.id))
        entries.removeAll { $0.source == source }
        persist()
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
struct NativeCinemaResumeScreen: View {
    let recent: NativeCinemaRecent
    @ObservedObject private var player = NativeCinemaAudioPlayer.shared
    @ObservedObject private var library = NativeCinemaLocalLibrary.shared
    @State private var tapeFilm: NativeTapeTerritoryCatalogue.Film?
    @State private var movieWork: NativeMoviesForTheBlindWork?
    @State private var audioEntry: NativeAudiocinematecaCatalogueIndex.Entry?
    @State private var audioPart: NativeAudiocinematecaCatalogueIndex.Part?
    @State private var driveHit: NativeCinemaDriveSearchHit?
    @State private var loading = false
    @State private var failed = false
    var body: some View {
        List {
            Text(recent.title).accessibilityAddTraits(.isHeader)
            if recent.source == "personal", let item = library.items.first(where: { $0.id.uuidString == recent.id }) {
                Button("Reproducir") { do { try player.open(item, library: library) } catch { failed = true } }
            } else if let tapeFilm {
                Button("Reproducir") {
                    guard let url = tapeFilm.describedStream else { return }
                    do { try player.openTapeTerritory(url, title: tapeFilm.title, slug: tapeFilm.slug, library: library) }
                    catch { failed = true }
                }
            } else if let movieWork, let part = movieWork.parts.first(where: {
                NativeCinemaRecent.digest("movies-for-the-blind:" + NativeCinemaRecent.digest($0.id)) == recent.id
            }) {
                Button("Reproducir") {
                    do {
                        let remaining = movieWork.parts.drop(while: { $0.id != part.id }).dropFirst()
                        try player.openMoviePart(part, workTitle: movieWork.title, followedBy: Array(remaining), library: library)
                    } catch { failed = true }
                }
            } else if let audioEntry, let audioPart {
                NativeAudiocinematecaPlaybackRow(entry: audioEntry, part: audioPart, label: MusicLocalized.message("Reproducir"))
            } else if let driveHit {
                NavigationLink("Explorar catálogo audiodescrito") {
                    NativeCinemaPublishedDriveBrowser(sourceID: driveHit.sourceID, sourceName: recent.providerName, initialHit: driveHit)
                }
            } else if ["drive-es", "drive-latino"].contains(recent.source) {
                NavigationLink("Explorar carpeta de Google Drive") {
                    NativeCinemaDriveBrowser(sourceID: recent.source == "drive-es" ? "audesc-es" : "audesc-latino", sourceName: recent.providerName)
                }
            }
            if recent.source != "audiocinemateca" && player.currentID != nil &&
                (player.currentCloudReference.map(NativeCinemaRecent.digest) == recent.id || player.currentID?.uuidString == recent.id) {
                if let error = player.playbackError { Text(error) }
                NativeCinemaTransportControls(player: player, library: library)
            }
            if loading { ProgressView("Consultando catálogos…") }
            if failed {
                Text("No se ha podido recuperar esta obra del catálogo actual.")
                Button("Reintentar") { Task { await resolve() } }
            }
        }
        .tifloScreenSurface()
        .navigationTitle(recent.title)
        .task { await resolve() }
    }
    private func resolve() async {
        guard !loading else { return }
        loading = true; failed = false
        defer { loading = false }
        do {
            switch recent.source {
            case "personal": failed = !library.items.contains { $0.id.uuidString == recent.id }
            case "tape-territory":
                tapeFilm = try await NativeTapeTerritoryCatalogue.fetchFilms().first {
                    NativeCinemaRecent.digest("tape-territory:" + $0.slug) == recent.id
                }
                failed = tapeFilm == nil
            case "movies-for-the-blind":
                movieWork = try await NativeMoviesForTheBlindWork.fetchWorks().first { work in
                    work.parts.contains { NativeCinemaRecent.digest("movies-for-the-blind:" + NativeCinemaRecent.digest($0.id)) == recent.id }
                }
                failed = movieWork == nil
            case "audiocinemateca":
                guard let account = NativeAudiocinematecaCredentials.load() else { failed = true; return }
                let entries = try await NativeAudiocinematecaCache.shared.refresh(account: account)
                guard let current = NativeAudiocinematecaCredentials.load(), current.username == account.username,
                      current.password == account.password else { failed = true; return }
                for entry in entries where entry.title == recent.title {
                    if let part = entry.parts.first(where: {
                        NativeCinemaRecent.digest(NativeAudiocinematecaPlaybackRow.reference(entry: entry, part: $0)) == recent.id
                    }) { audioEntry = entry; audioPart = part; break }
                }
                failed = audioEntry == nil
            case "public-es", "public-latino":
                let sourceID = recent.source == "public-es" ? "audesc-es" : "audesc-latino"
                let result = try await NativeCinemaPublicDrive().searchPublished(sourceID: sourceID, query: recent.title, kind: .all)
                driveHit = result.hits.first { NativeCinemaRecent.digest("gdrive-public:" + sourceID + "::" + $0.entry.id) == recent.id }
                failed = driveHit == nil
            case "drive-es", "drive-latino": break
            default: failed = true
            }
        } catch { if !Task.isCancelled { failed = true } }
    }
}
