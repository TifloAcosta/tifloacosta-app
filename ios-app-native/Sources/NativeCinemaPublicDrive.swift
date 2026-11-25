import Foundation

/// Read-only access to publisher-authorized public Google Drive catalogues.
/// Uses a separately restricted Google Drive API key. It never requests a
/// user's Google account, uses another feature's OAuth token, or caches a
/// publisher's expired title list.
struct NativeCinemaPublicDriveEntry: Identifiable, Equatable {
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

struct NativeCinemaPublicDrivePage {
    let entries: [NativeCinemaPublicDriveEntry]
    let nextCursor: String?
}

enum NativeCinemaPublicDriveError: LocalizedError {
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
                    cursor: String? = nil) async throws -> NativeCinemaPublicDrivePage {
        guard folder.isFolder, Self.isValidID(folder.id),
              cursor == nil || (cursor!.count < 2048 && !cursor!.isEmpty) else {
            throw NativeCinemaPublicDriveError.invalidFolder
        }
        let folderName = folder.id
        var query = [
            URLQueryItem(name: "q", value: "'\(folderName)' in parents and trashed = false"),
            URLQueryItem(name: "fields", value:
                "nextPageToken,files(id,name,mimeType,size,resourceKey)"),
            URLQueryItem(name: "pageSize", value: "100"),
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
            nextCursor: root["nextPageToken"] as? String
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


// Live, bounded traversal of the publisher's configured folder, never the
// user's entire Drive. No title or resource key is persisted.
struct NativeCinemaDriveSearchHit: Identifiable {
    let sourceID: String
    let entry: NativeCinemaPublicDriveEntry
    let path: [NativeCinemaPublicDriveEntry]
    let pageCursor: String?
    var id: String { sourceID + ":" + entry.id }
}
struct NativeCinemaDriveSearchResult {
    var hits: [NativeCinemaDriveSearchHit] = []
    var incomplete = false
}
extension NativeCinemaPublicDrive {
    func searchPublished(sourceID: String, query: String, kind: AccessibleCinemaKind) async throws -> NativeCinemaDriveSearchResult {
        guard let root = Self.publisherRoot(for: sourceID) else { throw NativeCinemaPublicDriveError.invalidFolder }
        let term = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !term.isEmpty else { return NativeCinemaDriveSearchResult() }
        var result = NativeCinemaDriveSearchResult()
        var queue: [([NativeCinemaPublicDriveEntry], String?)] = [([root], nil)]
        var seenFolders: Set<String> = [root.id]
        var seenFiles = Set<String>()
        let started = Date()
        var pages = 0
        while !queue.isEmpty && pages < 40 && Date().timeIntervalSince(started) < 20 && result.hits.count < 100 {
            try Task.checkCancellation()
            let (path, cursor) = queue.removeFirst()
            guard let folder = path.last else { continue }
            pages += 1
            let page: NativeCinemaPublicDrivePage
            do {
                page = try await listFolder(folder, ancestors: Array(path.dropLast()), cursor: cursor)
            } catch is CancellationError { throw CancellationError() }
            catch {
                if pages == 1 { throw error }
                result.incomplete = true
                continue
            }
            let category = Self.searchCategory(path: path)
            for entry in page.entries {
                if entry.isFolder {
                    if seenFolders.insert(entry.id).inserted { queue.append((path + [entry], nil)) }
                } else if entry.isSupportedMedia && (kind == .all || kind == category)
                    && entry.name.localizedStandardContains(term) && seenFiles.insert(entry.id).inserted {
                    result.hits.append(.init(sourceID: sourceID, entry: entry, path: path, pageCursor: cursor))
                }
            }
            if let next = page.nextCursor, next != cursor { queue.insert((path, next), at: 0) }
        }
        result.incomplete = result.incomplete || !queue.isEmpty
        result.hits.sort { $0.entry.name.localizedStandardCompare($1.entry.name) == .orderedAscending }
        return result
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
