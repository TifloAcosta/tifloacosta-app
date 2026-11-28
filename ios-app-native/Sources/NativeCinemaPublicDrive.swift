import Foundation

/// Read-only access to publisher-authorized public Google Drive catalogues.
/// Uses a separately restricted Google Drive API key. It never requests a
/// user's Google account or another feature's OAuth token. Local metadata
/// indexes are time-limited and every selected work is checked live.
struct NativeCinemaPublicDriveEntry: Identifiable, Equatable, Codable, Sendable {
    let id: String
    let name: String
    let isFolder: Bool
    let size: Int64?
    let resourceKey: String?

    var isSupportedMedia: Bool {
        let ext = (name as NSString).pathExtension.lowercased()
        return ["mp3", "m4a", "m4b", "aac", "wav", "aif", "aiff",
                "caf", "flac", "mp4", "m4v", "mov"].contains(ext)
    }

    var isVideo: Bool {
        ["mp4", "m4v", "mov"].contains((name as NSString).pathExtension.lowercased())
    }
}

struct NativeCinemaPublicDrivePage: Sendable {
    let entries: [NativeCinemaPublicDriveEntry]
    let nextCursor: String?
    var incomplete = false
}

enum NativeCinemaPublicDriveError: LocalizedError, Equatable {
    case unconfigured, invalidFolder, badResponse, denied, noLongerAvailable,
         unavailable, oversized, unsupported

    var errorDescription: String? {
        switch self {
        case .unconfigured:
            return MusicLocalized.message("El catálogo público de Google Drive necesita terminar su configuración.")
        case .invalidFolder:
            return MusicLocalized.message("El enlace a la carpeta no es válido.")
        case .badResponse:
            return MusicLocalized.message("Google Drive ha devuelto un catálogo que no se puede leer.")
        case .denied:
            return MusicLocalized.message("Google Drive no permite consultar esta obra con los permisos publicados.")
        case .noLongerAvailable:
            return MusicLocalized.message("Esta obra ya no está disponible en el catálogo.")
        case .unavailable:
            return MusicLocalized.message("No se ha podido contactar con Google Drive.")
        case .oversized:
            return MusicLocalized.message("El archivo supera el tamaño máximo permitido de 2 GB.")
        case .unsupported:
            return MusicLocalized.message("Este formato no se puede reproducir desde Google Drive.")
        }
    }
}

private final class NativeCinemaPublicDriveRedirects: NSObject, URLSessionTaskDelegate {
    func urlSession(_ session: URLSession, task: URLSessionTask,
                    willPerformHTTPRedirection response: HTTPURLResponse,
                    newRequest request: URLRequest,
                    completionHandler: @escaping (URLRequest?) -> Void) {
        // Do not send API keys to any Google Drive download redirection host.
        completionHandler(nil)
    }
}

final class NativeCinemaPublicDrive {
    /// The client key is public on iOS; restrict it in Google Cloud to the
    /// Google Drive API and this bundle ID. Never use an OAuth client secret.
    static var configuredKey: String? {
        guard let key = Bundle.main.object(
            forInfoDictionaryKey: "TifloCinemaPublicDriveAPIKey") as? String,
              key.hasPrefix("AIza"), (30...200).contains(key.count),
              key.unicodeScalars.allSatisfy({
                  CharacterSet(charactersIn:
                    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-").contains($0)
              }) else { return nil }
        return key
    }

    /// These IDs are links the publisher explicitly offered for public access,
    /// not bearer credentials. Keep the resource keys separate if supplied.
    static func publisherRoot(for sourceID: String) -> NativeCinemaPublicDriveEntry? {
        let setting: String
        switch sourceID {
        case "audesc-es": setting = "TifloCinemaAudescSpainFolderID"
        case "audesc-latino": setting = "TifloCinemaAudescLatinoFolderID"
        default: return nil
        }
        guard let id = Bundle.main.object(forInfoDictionaryKey: setting) as? String,
              isValidID(id) else { return nil }
        let keyName = setting.replacingOccurrences(of: "FolderID", with: "ResourceKey")
        let resourceKey = Bundle.main.object(forInfoDictionaryKey: keyName) as? String
        return NativeCinemaPublicDriveEntry(
            id: id, name: sourceID == "audesc-es" ? "Audesc España" : "Audesc Latino",
            isFolder: true, size: nil,
            resourceKey: resourceKey.flatMap { isValidID($0) ? $0 : nil }
        )
    }

    /// A safe original-provider fallback independent of any API key.
    /// The official Drive interface remains accessible when the native
    /// catalogue connector is not yet enabled or a request is refused.
    static func originalFolderURL(for sourceID: String) -> URL? {
        guard let folder = publisherRoot(for: sourceID) else { return nil }
        var url = URLComponents()
        url.scheme = "https"
        url.host = "drive.google.com"
        url.path = "/drive/folders/" + folder.id
        if let resourceKey = folder.resourceKey {
            url.queryItems = [URLQueryItem(name: "resourcekey", value: resourceKey)]
        }
        return url.url
    }

    private let key: String
    private let session: URLSession
    private static let sizeLimit: Int64 = 2_000_000_000
    private static let metadataLimit = 2_000_000

    init() throws {
        guard let key = Self.configuredKey else {
            throw NativeCinemaPublicDriveError.unconfigured
        }
        self.key = key
        self.session = URLSession(
            configuration: URLSessionConfiguration.ephemeral,
            delegate: NativeCinemaPublicDriveRedirects(),
            delegateQueue: nil
        )
    }

    private static func isValidID(_ id: String) -> Bool {
        (10...200).contains(id.count) &&
        id.unicodeScalars.allSatisfy {
            CharacterSet(charactersIn:
                "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-").contains($0)
        }
    }

    private func endpoint(for fileID: String? = nil, query: [URLQueryItem]) throws -> URL {
        guard fileID == nil || Self.isValidID(fileID!) else {
            throw NativeCinemaPublicDriveError.invalidFolder
        }
        var url = URLComponents()
        url.scheme = "https"
        url.host = "www.googleapis.com"
        url.path = "/drive/v3/files" + (fileID.map { "/" + $0 } ?? "")
        url.queryItems = query + [URLQueryItem(name: "key", value: key)]
        guard let result = url.url else { throw NativeCinemaPublicDriveError.badResponse }
        return result
    }

    private func request(_ url: URL, resourceKeys: [NativeCinemaPublicDriveEntry]) -> URLRequest {
        var request = URLRequest(url: url)
        request.timeoutInterval = 45
        request.cachePolicy = .reloadIgnoringLocalCacheData
        request.setValue(Bundle.main.bundleIdentifier ?? "com.tifloacosta.app",
                         forHTTPHeaderField: "X-Ios-Bundle-Identifier")
        let keys = resourceKeys.compactMap { item -> String? in
            guard Self.isValidID(item.id),
                  let key = item.resourceKey, Self.isValidID(key) else { return nil }
            return item.id + "/" + key
        }
        if !keys.isEmpty {
            request.setValue(keys.joined(separator: ","), forHTTPHeaderField: "X-Goog-Drive-Resource-Keys")
        }
        return request
    }

    private func validated(_ response: URLResponse) throws {
        guard let http = response as? HTTPURLResponse,
              http.url?.scheme == "https", http.url?.host == "www.googleapis.com" else {
            throw NativeCinemaPublicDriveError.badResponse
        }
        switch http.statusCode {
        case 200..<300: return
        case 401, 403: throw NativeCinemaPublicDriveError.denied
        case 404, 410: throw NativeCinemaPublicDriveError.noLongerAvailable
        default: throw NativeCinemaPublicDriveError.unavailable
        }
    }

    func listFolder(_ folder: NativeCinemaPublicDriveEntry,
                    ancestors: [NativeCinemaPublicDriveEntry] = [],
                    cursor: String? = nil, pageSize: Int = 100) async throws -> NativeCinemaPublicDrivePage {
        guard folder.isFolder, Self.isValidID(folder.id),
              cursor == nil || (cursor!.count < 2048 && !cursor!.isEmpty) else {
            throw NativeCinemaPublicDriveError.invalidFolder
        }
        let folderName = folder.id
        var query = [
            URLQueryItem(name: "q", value: "'\(folderName)' in parents and trashed = false"),
            URLQueryItem(name: "fields", value:
                "nextPageToken,incompleteSearch,files(id,name,mimeType,size,resourceKey,shortcutDetails(targetId,targetMimeType))"),
            URLQueryItem(name: "pageSize", value: String(min(1000, max(1, pageSize)))),
            URLQueryItem(name: "supportsAllDrives", value: "true"),
            URLQueryItem(name: "includeItemsFromAllDrives", value: "true")
        ]
        if let cursor { query.append(URLQueryItem(name: "pageToken", value: cursor)) }
        let url = try endpoint(query: query)
        let (data, response) = try await session.data(for: request(
            url, resourceKeys: ancestors + [folder]))
        try validated(response)
        guard data.count < Self.metadataLimit,
              let root = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              let records = root["files"] as? [[String: Any]] else {
            throw NativeCinemaPublicDriveError.badResponse
        }
        let entries = records.compactMap { value -> NativeCinemaPublicDriveEntry? in
            guard let id = value["id"] as? String, Self.isValidID(id),
                  let name = value["name"] as? String,
                  !name.isEmpty, name.count < 500 else { return nil }
            let folder = (value["mimeType"] as? String)
                == "application/vnd.google-apps.folder"
            let number = (value["size"] as? String).flatMap(Int64.init)
                ?? (value["size"] as? NSNumber)?.int64Value
            let resourceKey = value["resourceKey"] as? String
            return NativeCinemaPublicDriveEntry(
                id: id, name: name, isFolder: folder, size: number,
                resourceKey: resourceKey.flatMap { Self.isValidID($0) ? $0 : nil }
            )
        }
        return NativeCinemaPublicDrivePage(
            entries: entries,
            nextCursor: root["nextPageToken"] as? String,
            // A shortcut can lead outside the approved root. Do not silently
            // claim complete coverage of a tree with unresolved shortcuts.
            incomplete: (root["incompleteSearch"] as? Bool ?? false) ||
                records.contains { ($0["mimeType"] as? String) == "application/vnd.google-apps.shortcut" } ||
                entries.count != records.count
        )
    }

    /// Bounded full download is the fallback when progressive access is not
    /// available. Respect cell-data preferences and clean up temp files.
    func download(_ item: NativeCinemaPublicDriveEntry,
                  ancestors: [NativeCinemaPublicDriveEntry],
                  allowsCellular: Bool) async throws -> URL {
        guard !item.isFolder, item.isSupportedMedia else {
            throw NativeCinemaPublicDriveError.unsupported
        }
        if let size = item.size, size > Self.sizeLimit {
            throw NativeCinemaPublicDriveError.oversized
        }
        let url = try endpoint(
            for: item.id, query: [URLQueryItem(name: "alt", value: "media")]
        )
        var req = request(url, resourceKeys: ancestors + [item])
        req.allowsCellularAccess = allowsCellular
        let (file, response) = try await session.download(for: req)
        try validated(response)
        let size = (try FileManager.default.attributesOfItem(
            atPath: file.path)[.size] as? NSNumber)?.int64Value ?? 0
        guard size > 0, size <= Self.sizeLimit else {
            throw NativeCinemaPublicDriveError.oversized
        }
        let parent = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        try FileManager.default.createDirectory(
            at: parent, withIntermediateDirectories: true
        )
        let safeName = UUID().uuidString + "." +
            (item.name as NSString).pathExtension.lowercased()
        let destination = parent.appendingPathComponent(safeName)
        do {
            try FileManager.default.moveItem(at: file, to: destination)
            return destination
        } catch {
            try? FileManager.default.removeItem(at: parent)
            throw error
        }
    }

}


// Search only within the configured publisher roots. Completed metadata
// snapshots stay on this device, without resource keys, cursors or media.
// Every selected result must be resolved again through the live folder tree.
struct NativeCinemaDriveSearchHit: Identifiable, Codable, Sendable {
    let sourceID: String
    let entry: NativeCinemaPublicDriveEntry
    let path: [NativeCinemaPublicDriveEntry]
    let pageCursor: String?
    var id: String { sourceID + ":" + entry.id }
}
struct NativeCinemaDriveSearchResult: Sendable {
    var hits: [NativeCinemaDriveSearchHit] = []
    var incomplete = false
    var stale = false
}

actor NativeCinemaDriveIndex {
    static let shared = NativeCinemaDriveIndex()
    private struct Cursor: Hashable {
        let folderID: String
        let token: String?
    }
    private struct Pending {
        let path: [NativeCinemaPublicDriveEntry]
        let token: String?
    }
    private struct Snapshot {
        let rootID: String
        let started: Date
        var completed: Date?
        var queue: [Pending]
        var offset = 0
        var seenFolders: Set<String>
        var pages = Set<Cursor>()
        var hits: [String: NativeCinemaDriveSearchHit] = [:]
        var failed = false
    }
    private struct StoredIndex: Codable {
        let rootID: String
        let date: Date
        let hits: [NativeCinemaDriveSearchHit]
    }
    private struct CentralIndex: Decodable {
        let schema: Int
        let sourceID: String
        let rootID: String
        let generatedAt: String
        let complete: Bool
        let hits: [NativeCinemaDriveSearchHit]
    }
    private var snapshots: [String: Snapshot] = [:]
    private var active = Set<String>()
    private var centralChecked: [String: Date] = [:]
    private var centralLoaded = Set<String>()

    /// Opt-in only. No central endpoint is configured until the owner authorizes
    /// publishing the metadata. The on-device index works independently.
    private func fetchCentral(_ sourceID: String, rootID: String) async throws -> Snapshot? {
        guard let raw = Bundle.main.object(forInfoDictionaryKey: "TifloCinemaCentralIndexBaseURL") as? String,
              !raw.isEmpty,
              let base = URL(string: raw), base.scheme == "https",
              ["tifloacosta.com", "www.tifloacosta.com"].contains(base.host ?? ""),
              base.user == nil, base.password == nil, base.query == nil, base.fragment == nil,
              ["audesc-es", "audesc-latino"].contains(sourceID) else { return nil }
        let url = base.appendingPathComponent(sourceID + ".json")
        var request = URLRequest(url: url)
        request.timeoutInterval = 15
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, http.statusCode == 200,
              http.url == url, data.count <= 64 * 1024 * 1024 else {
            throw NativeCinemaPublicDriveError.badResponse
        }
        let value = try JSONDecoder().decode(CentralIndex.self, from: data)
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        guard value.schema == 1, value.complete, value.sourceID == sourceID,
              value.rootID == rootID,
              let date = formatter.date(from: value.generatedAt) ?? ISO8601DateFormatter().date(from: value.generatedAt),
              date <= Date(), Date().timeIntervalSince(date) < 6 * 3600 else {
            throw NativeCinemaPublicDriveError.badResponse
        }
        func valid(_ item: NativeCinemaPublicDriveEntry) -> Bool {
            !item.name.isEmpty && item.name.count < 500 && item.resourceKey == nil &&
            (10...200).contains(item.id.count) &&
            item.id.range(of: "^[A-Za-z0-9_-]+$", options: .regularExpression) != nil
        }
        var hits: [String: NativeCinemaDriveSearchHit] = [:]
        for hit in value.hits {
            guard hit.sourceID == sourceID, hit.pageCursor == nil, valid(hit.entry),
                  !hit.entry.isFolder, hit.entry.isSupportedMedia,
                  hit.path.first?.id == rootID, !hit.path.isEmpty,
                  hit.path.allSatisfy({ $0.isFolder && valid($0) }),
                  Set(hit.path.map(\.id)).count == hit.path.count,
                  hits[hit.entry.id] == nil else { throw NativeCinemaPublicDriveError.badResponse }
            hits[hit.entry.id] = hit
        }
        return Snapshot(rootID: rootID, started: date, completed: date,
                        queue: [], seenFolders: [], hits: hits)
    }

    private static func storageURL(_ sourceID: String) throws -> URL {
        guard ["audesc-es", "audesc-latino"].contains(sourceID) else {
            throw NativeCinemaPublicDriveError.invalidFolder
        }
        let base = try FileManager.default.url(for: .cachesDirectory, in: .userDomainMask,
                                               appropriateFor: nil, create: true)
        return base.appendingPathComponent("cinema-drive-index-v1-" + sourceID + ".json")
    }
    private static func withoutKey(_ item: NativeCinemaPublicDriveEntry) -> NativeCinemaPublicDriveEntry {
        NativeCinemaPublicDriveEntry(id: item.id, name: item.name, isFolder: item.isFolder,
                                     size: item.size, resourceKey: nil)
    }
    private func readComplete(_ sourceID: String, rootID: String) -> Snapshot? {
        guard let url = try? Self.storageURL(sourceID),
              let data = try? Data(contentsOf: url, options: .mappedIfSafe),
              let value = try? JSONDecoder().decode(StoredIndex.self, from: data),
              value.rootID == rootID, value.date <= Date(),
              Date().timeIntervalSince(value.date) <= 86_400 else { return nil }
        var entries: [String: NativeCinemaDriveSearchHit] = [:]
        for hit in value.hits where hit.sourceID == sourceID && hit.path.first?.id == rootID {
            entries[hit.entry.id] = hit
        }
        return Snapshot(rootID: rootID, started: value.date, completed: value.date,
                        queue: [], seenFolders: [], hits: entries)
    }
    private func storeComplete(_ snapshot: Snapshot, sourceID: String) {
        guard let date = snapshot.completed, !snapshot.failed,
              let url = try? Self.storageURL(sourceID) else { return }
        let hits = snapshot.hits.values.map {
            NativeCinemaDriveSearchHit(sourceID: sourceID, entry: Self.withoutKey($0.entry),
                path: $0.path.map(Self.withoutKey), pageCursor: nil)
        }
        let value = StoredIndex(rootID: snapshot.rootID, date: date, hits: hits)
        if let data = try? JSONEncoder().encode(value) {
            try? data.write(to: url, options: [.atomic, .completeFileProtection])
        }
    }

    func search(sourceID: String, query: String, kind: AccessibleCinemaKind,
                refresh: Bool = false,
                progress: @MainActor @Sendable (NativeCinemaDriveSearchResult, Int) -> Void) async throws -> NativeCinemaDriveSearchResult {
        guard let root = NativeCinemaPublicDrive.publisherRoot(for: sourceID) else {
            throw NativeCinemaPublicDriveError.invalidFolder
        }
        let term = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !term.isEmpty else { return NativeCinemaDriveSearchResult() }
        // Wait for a cancelled prior search to release this same root.
        while active.contains(sourceID) {
            try await Task.sleep(nanoseconds: 100_000_000)
        }
        try Task.checkCancellation()
        active.insert(sourceID)
        defer { active.remove(sourceID) }
        if refresh || Date().timeIntervalSince(centralChecked[sourceID] ?? .distantPast) >= 900 {
            centralChecked[sourceID] = Date()
            centralLoaded.remove(sourceID)
            do {
                if let central = try await fetchCentral(sourceID, rootID: root.id) {
                    try Task.checkCancellation()
                    // Prefer a complete newer snapshot; keep local fallback if the service fails.
                    if (snapshots[sourceID]?.completed ?? .distantPast) <= (central.completed ?? .distantPast) {
                        snapshots[sourceID] = central
                        centralLoaded.insert(sourceID)
                        storeComplete(central, sourceID: sourceID)
                    }
                }
            } catch {
                if Task.isCancelled { throw CancellationError() }
                // A failed central endpoint is never interpreted as an empty catalogue.
            }
        }
        let stored = snapshots[sourceID]?.completed != nil ? nil : readComplete(sourceID, rootID: root.id)
        let previous = snapshots[sourceID] ?? stored
        let lastComplete = previous?.completed != nil ? previous : stored
        let fresh = previous?.completed.map { Date().timeIntervalSince($0) < 900 } ?? false
        let centralFresh = centralChecked[sourceID].map { Date().timeIntervalSince($0) < 900 } == true &&
            centralLoaded.contains(sourceID) &&
            (previous?.completed.map { Date().timeIntervalSince($0) < 6 * 3600 } ?? false)
        let usable = previous?.rootID == root.id &&
            (fresh || centralFresh || (previous?.completed == nil && previous?.failed == false &&
                Date().timeIntervalSince(previous?.started ?? .distantPast) < 900))
        var state = ((!refresh || centralFresh) && usable ? previous : nil) ?? Snapshot(
            rootID: root.id, started: Date(), queue: [Pending(path: [root], token: nil)],
            seenFolders: [root.id])
        func result(_ state: Snapshot, incomplete: Bool) -> NativeCinemaDriveSearchResult {
            var uncertain = incomplete
            let matches = state.hits.values.filter { hit in
                guard NativeCinemaRules.matches(term, fields: [hit.entry.name] + hit.path.dropFirst().map(\.name)) else { return false }
                let category = Self.searchCategory(path: hit.path)
                if kind != .all && category == nil {
                    // Unknown categories must not silently hide a matching title.
                    uncertain = true
                }
                return kind == .all || category == nil || kind == category
            }.sorted { $0.entry.name.localizedStandardCompare($1.entry.name) == .orderedAscending }
            return NativeCinemaDriveSearchResult(hits: matches, incomplete: uncertain)
        }
        if state.completed != nil {
            snapshots[sourceID] = state
            return result(state, incomplete: state.failed)
        }
        if let lastComplete, !refresh {
            var cached = result(lastComplete, incomplete: true)
            cached.stale = true
            await progress(cached, 0)
        }
        defer {
            // Keep the checkpoint even on cancellation; resume on next query.
            snapshots[sourceID] = state
        }
        let service = try NativeCinemaPublicDrive()
        // No overall time, page or hit cutoff. Individual network requests
        // retain their timeout; user cancellation and repeated cursors stop safely.
        while state.offset < state.queue.count {
            try Task.checkCancellation()
            let pending = state.queue[state.offset]
            guard let folder = pending.path.last else { state.offset += 1; continue }
            let cursor = Cursor(folderID: folder.id, token: pending.token)
            if state.pages.contains(cursor) {
                state.failed = true
                state.offset += 1
                continue
            }
            let page: NativeCinemaPublicDrivePage
            do {
                page = try await Self.listPage(service, pending: pending, folder: folder)
            } catch {
                if Task.isCancelled || (error as? URLError)?.code == .cancelled { throw CancellationError() }
                if state.pages.isEmpty {
                    if let failure = error as? NativeCinemaPublicDriveError,
                       failure == .denied || failure == .noLongerAvailable {
                        if let url = try? Self.storageURL(sourceID) { try? FileManager.default.removeItem(at: url) }
                        snapshots.removeValue(forKey: sourceID)
                        state.failed = true
                        throw error
                    }
                    if let lastComplete {
                        var cached = result(lastComplete, incomplete: true)
                        cached.stale = true
                        return cached
                    }
                    throw error
                }
                state.failed = true
                state.offset += 1
                continue
            }
            try Task.checkCancellation()
            state.pages.insert(cursor)
            state.offset += 1
            if page.incomplete { state.failed = true }
            for entry in page.entries {
                if entry.isFolder {
                    if state.seenFolders.insert(entry.id).inserted {
                        state.queue.append(Pending(path: pending.path + [entry], token: nil))
                    }
                } else if entry.isSupportedMedia {
                    state.hits[entry.id] = NativeCinemaDriveSearchHit(sourceID: sourceID,
                        entry: entry, path: pending.path, pageCursor: pending.token)
                }
            }
            if let next = page.nextCursor, !next.isEmpty {
                if state.pages.contains(Cursor(folderID: folder.id, token: next)) {
                    state.failed = true
                } else {
                    state.queue.append(Pending(path: pending.path, token: next))
                }
            }
            // Release processed path arrays as the queue grows.
            if state.offset >= 256 {
                state.queue.removeFirst(state.offset)
                state.offset = 0
            }
            // Publish partial matches as the traversal progresses, not just at completion.
            if state.pages.count == 1 || state.pages.count % 5 == 0 || state.offset == state.queue.count {
                await progress(result(state, incomplete: true), state.pages.count)
            }
        }
        if !state.failed {
            state.completed = Date()
            state.queue = []
            state.offset = 0
            storeComplete(state, sourceID: sourceID)
        }
        return result(state, incomplete: state.failed)
    }
    private static func listPage(_ service: NativeCinemaPublicDrive, pending: Pending,
                                 folder: NativeCinemaPublicDriveEntry) async throws -> NativeCinemaPublicDrivePage {
        for attempt in 0..<3 {
            try Task.checkCancellation()
            do {
                return try await service.listFolder(folder, ancestors: Array(pending.path.dropLast()),
                                                    cursor: pending.token, pageSize: 500)
            } catch {
                if Task.isCancelled || (error as? URLError)?.code == .cancelled { throw CancellationError() }
                let temporary = (error as? NativeCinemaPublicDriveError) == .unavailable ||
                    [.timedOut, .networkConnectionLost, .cannotConnectToHost].contains((error as? URLError)?.code ?? .unknown)
                guard temporary, attempt < 2 else { throw error }
                try await Task.sleep(nanoseconds: UInt64(attempt + 1) * 1_000_000_000)
            }
        }
        throw NativeCinemaPublicDriveError.unavailable
    }

    private static func searchCategory(path: [NativeCinemaPublicDriveEntry]) -> AccessibleCinemaKind? {
        for folder in path.dropFirst().reversed() {
            let name = folder.name.folding(options: [.caseInsensitive, .diacriticInsensitive], locale: Locale(identifier: "es"))
            if name.contains("documental") { return .documentary }
            if name.contains("cortometraje") || name.contains("cortos") { return .short }
            if name.contains("series") { return .series }
            if name.contains("pelicula") || name.contains("cine por orden") { return .film }
        }
        return nil
    }
}

extension NativeCinemaPublicDrive {
    /// Resolve from the approved root using fresh parent listings. Never play
    /// solely from a cached file ID or an expired page token.
    func resolveSearchHit(_ hit: NativeCinemaDriveSearchHit) async throws
        -> (path: [NativeCinemaPublicDriveEntry], entry: NativeCinemaPublicDriveEntry) {
        guard let root = Self.publisherRoot(for: hit.sourceID),
              hit.path.first?.id == root.id else { throw NativeCinemaPublicDriveError.invalidFolder }
        var path = [root]
        let targets = Array(hit.path.dropFirst()) + [hit.entry]
        for (index, target) in targets.enumerated() {
            guard let folder = path.last else { throw NativeCinemaPublicDriveError.invalidFolder }
            var cursor: String?
            var seen = Set<String>()
            var found: NativeCinemaPublicDriveEntry?
            repeat {
                try Task.checkCancellation()
                let page = try await listFolder(folder, ancestors: Array(path.dropLast()), cursor: cursor, pageSize: 500)
                if let entry = page.entries.first(where: { $0.id == target.id }) { found = entry; break }
                cursor = page.nextCursor
                if let cursor, !seen.insert(cursor).inserted { throw NativeCinemaPublicDriveError.badResponse }
            } while cursor != nil
            guard let found else { throw NativeCinemaPublicDriveError.noLongerAvailable }
            if index == targets.count - 1 {
                guard found.isSupportedMedia, !found.isFolder else { throw NativeCinemaPublicDriveError.unsupported }
                return (path, found)
            }
            guard found.isFolder else { throw NativeCinemaPublicDriveError.invalidFolder }
            path.append(found)
        }
        throw NativeCinemaPublicDriveError.invalidFolder
    }

    func searchPublished(sourceID: String, query: String, kind: AccessibleCinemaKind,
                         refresh: Bool = false,
                         progress: @MainActor @Sendable (NativeCinemaDriveSearchResult, Int) -> Void = { _, _ in }) async throws -> NativeCinemaDriveSearchResult {
        try await NativeCinemaDriveIndex.shared.search(sourceID: sourceID, query: query, kind: kind,
                                                       refresh: refresh, progress: progress)
    }
}
