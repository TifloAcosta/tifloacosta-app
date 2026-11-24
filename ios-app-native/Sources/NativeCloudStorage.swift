import Foundation

/// Shared, read-only cloud transport. Authentication and user consent live in
/// separate adapters; this type never persists or exports an access token.
enum NativeCloudProvider: String, Codable, CaseIterable, Identifiable {
    case googleDrive, dropbox, oneDrive
    var id: String { rawValue }
    var title: String {
        switch self {
        case .googleDrive: return "Google Drive"
        case .dropbox: return "Dropbox"
        case .oneDrive: return "OneDrive"
        }
    }
}

struct NativeCloudItem: Identifiable, Equatable {
    let id: String
    let name: String
    let isFolder: Bool
    let size: Int64?
    let provider: NativeCloudProvider
    var remoteId: String { id }
}

struct NativeCloudPage {
    let items: [NativeCloudItem]
    let nextCursor: String?
}

enum NativeCloudStorageError: LocalizedError {
    case unauthenticated, unauthorized, unavailable, notFound, invalidResponse, oversized, oversizedCinema, unsupportedFile

    var errorDescription: String? {
        switch self {
        case .unauthenticated: return "Conecta tu cuenta antes de explorar archivos."
        case .unauthorized: return "La autorización de la nube ha caducado o no permite acceder a este archivo."
        case .unavailable: return "No se pudo conectar con el servicio. Comprueba tu conexión."
        case .notFound: return "El archivo ya no está disponible en esa ubicación."
        case .invalidResponse: return "El servicio de nube devolvió una respuesta no reconocida."
        case .oversized: return "El archivo supera el límite de importación de 250 MB."
        case .oversizedCinema:
            return MusicLocalized.message("El archivo supera el tamaño máximo permitido de 2 GB.")
        case .unsupportedFile: return "Selecciona un archivo musical compatible."
        }
    }
}

private final class NativeCloudNoRedirects: NSObject, URLSessionTaskDelegate {
    let allowRedirect: Bool
    init(allowRedirect: Bool) {
        self.allowRedirect = allowRedirect
        super.init()
    }
    func urlSession(_ session: URLSession, task: URLSessionTask,
                    willPerformHTTPRedirection response: HTTPURLResponse,
                    newRequest request: URLRequest,
                    completionHandler: @escaping (URLRequest?) -> Void) {
        // OneDrive may redirect /content to a pre-authorized download host.
        // Follow HTTPS only, and strip all original authorization headers.
        guard allowRedirect, task.originalRequest?.url?.path.hasSuffix("/content") == true,
              let destination = request.url, destination.scheme == "https" else {
            completionHandler(nil)
            return
        }
        var redirected = URLRequest(url: destination)
        redirected.setValue(nil, forHTTPHeaderField: "Authorization")
        completionHandler(redirected)
    }
}

final class NativeCloudStorage {
    static let maximumAudioBytes = 250 * 1_024 * 1_024
    private let provider: NativeCloudProvider
    private let accessToken: String
    private let session: URLSession

    private static func encodedID(_ value: String) -> String {
        let allowed = CharacterSet.urlPathAllowed.subtracting(CharacterSet(charactersIn: "/?#%"))
        return value.addingPercentEncoding(withAllowedCharacters: allowed) ?? ""
    }

    init(provider: NativeCloudProvider, accessToken: String) throws {
        guard !accessToken.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw NativeCloudStorageError.unauthenticated
        }
        self.provider = provider
        self.accessToken = accessToken
        self.session = URLSession(configuration: .ephemeral,
                                  delegate: NativeCloudNoRedirects(allowRedirect: provider == .oneDrive), delegateQueue: nil)
    }

    private func authorized(_ url: URL, method: String = "GET") throws -> URLRequest {
        guard url.scheme == "https", allowedHost(for: url) else {
            throw NativeCloudStorageError.invalidResponse
        }
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        request.timeoutInterval = 45
        return request
    }

    private func allowedHost(for url: URL) -> Bool {
        switch provider {
        case .googleDrive: return url.host == "www.googleapis.com" && url.path.hasPrefix("/drive/v3/files")
        case .dropbox: return (url.host == "api.dropboxapi.com" || url.host == "content.dropboxapi.com")
            && url.path.hasPrefix("/2/files/")
        case .oneDrive: return url.host == "graph.microsoft.com" && url.path.hasPrefix("/v1.0/")
        }
    }

    private func validated(_ response: URLResponse, allowDownloadHost: Bool = false) throws -> HTTPURLResponse {
        guard let result = response as? HTTPURLResponse,
              response.url?.scheme == "https", let url = response.url,
              (allowDownloadHost || allowedHost(for: url)) else {
            throw NativeCloudStorageError.invalidResponse
        }
        switch result.statusCode {
        case 200...299: return result
        case 401, 403: throw NativeCloudStorageError.unauthorized
        case 404: throw NativeCloudStorageError.notFound
        default: throw NativeCloudStorageError.unavailable
        }
    }

    private func send(_ request: URLRequest) async throws -> [String: Any] {
        let (data, response) = try await session.data(for: request)
        _ = try validated(response)
        guard data.count <= 2_000_000,
              let object = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw NativeCloudStorageError.invalidResponse
        }
        return object
    }

    /// Resolves an item explicitly selected in Google Picker with the drive.file scope.
    func googleDriveSelection(id: String) async throws -> NativeCloudItem {
        guard provider == .googleDrive, !id.isEmpty,
              var parts = URLComponents(string: "https://www.googleapis.com/drive/v3/files/\(Self.encodedID(id))") else {
            throw NativeCloudStorageError.invalidResponse
        }
        parts.queryItems = [URLQueryItem(name: "fields", value: "id,name,mimeType,size")]
        guard let url = parts.url else { throw NativeCloudStorageError.invalidResponse }
        let json = try await send(authorized(url))
        guard let selection = item(json, provider: .googleDrive), selection.id == id else {
            throw NativeCloudStorageError.invalidResponse
        }
        return selection
    }

    /// Lists one page only; the caller explicitly requests subsequent pages.
    func listFolder(id: String?, cursor: String? = nil) async throws -> NativeCloudPage {
        switch provider {
        case .googleDrive:
            var parts = URLComponents(string: "https://www.googleapis.com/drive/v3/files")!
            let folder = (id ?? "root").replacingOccurrences(of: "'", with: "\\'")
            parts.queryItems = [URLQueryItem(name: "q", value: "'\(folder)' in parents and trashed = false"),
                                URLQueryItem(name: "fields", value: "nextPageToken,files(id,name,mimeType,size)"),
                                URLQueryItem(name: "pageSize", value: "100")]
            if let cursor { parts.queryItems?.append(URLQueryItem(name: "pageToken", value: cursor)) }
            let json = try await send(authorized(parts.url!))
            let files = (json["files"] as? [[String: Any]]) ?? []
            return NativeCloudPage(items: files.compactMap { item($0, provider: .googleDrive) },
                                   nextCursor: json["nextPageToken"] as? String)
        case .dropbox:
            let continuation = cursor != nil
            let endpoint = continuation ? "list_folder/continue" : "list_folder"
            var request = try authorized(URL(string: "https://api.dropboxapi.com/2/files/\(endpoint)")!, method: "POST")
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            let payload: [String: Any] = continuation
                ? ["cursor": cursor!] : ["path": id ?? "", "recursive": false, "limit": 100]
            request.httpBody = try JSONSerialization.data(withJSONObject: payload)
            let json = try await send(request)
            let entries = (json["entries"] as? [[String: Any]]) ?? []
            return NativeCloudPage(items: entries.compactMap { item($0, provider: .dropbox) },
                                   nextCursor: (json["has_more"] as? Bool == true) ? json["cursor"] as? String : nil)
        case .oneDrive:
            let url: URL
            if let cursor {
                guard let continuation = URL(string: cursor), allowedHost(for: continuation) else {
                    throw NativeCloudStorageError.invalidResponse
                }
                url = continuation
            } else if let id {
                url = URL(string: "https://graph.microsoft.com/v1.0/me/drive/items/\(Self.encodedID(id))/children?$top=100")!
            } else {
                url = URL(string: "https://graph.microsoft.com/v1.0/me/drive/root/children?$top=100")!
            }
            let json = try await send(authorized(url))
            let files = (json["value"] as? [[String: Any]]) ?? []
            return NativeCloudPage(items: files.compactMap { item($0, provider: .oneDrive) },
                                   nextCursor: json["@odata.nextLink"] as? String)
        }
    }

    private func item(_ value: [String: Any], provider: NativeCloudProvider) -> NativeCloudItem? {
        guard let id = value["id"] as? String,
              let name = value["name"] as? String else { return nil }
        let folder: Bool
        switch provider {
        case .googleDrive: folder = (value["mimeType"] as? String) == "application/vnd.google-apps.folder"
        case .dropbox: folder = (value[".tag"] as? String) == "folder"
        case .oneDrive: folder = value["folder"] != nil
        }
        let bytes = (value["size"] as? NSNumber)?.int64Value ?? (value["size"] as? String).flatMap { Int64($0) }
        return NativeCloudItem(id: id, name: name, isFolder: folder, size: bytes, provider: provider)
    }

    /// Cinema can handle larger authorized audio/video works without changing the
    /// 250 MiB music import ceiling. Returns a private temporary file only.
    /// The caller must clean up after playback. This is a full-file download,
    /// not progressive streaming; never describe it as instantaneous playback.
    func downloadCinema(_ item: NativeCloudItem, allowsCellular: Bool = true) async throws -> URL {
        try await downloadItem(
            item,
            allowsCellular: allowsCellular,
            permittedExtensions: ["mp3", "m4a", "m4b", "aac", "wav", "aif",
                                  "aiff", "caf", "flac", "mp4", "m4v", "mov"],
            limit: 2_000_000_000
        )
    }

    /// A temporary file is returned; the consumer must explicitly import or discard it.
    func download(_ item: NativeCloudItem, allowsCellular: Bool = true) async throws -> URL {
        try await downloadItem(
            item,
            allowsCellular: allowsCellular,
            permittedExtensions: ["mp3", "m4a", "aac", "wav", "flac", "ogg"],
            limit: Int64(Self.maximumAudioBytes)
        )
    }

    private func downloadItem(
        _ item: NativeCloudItem,
        allowsCellular: Bool,
        permittedExtensions: Set<String>,
        limit: Int64
    ) async throws -> URL {
        guard item.provider == provider, !item.isFolder,
              permittedExtensions.contains((item.name as NSString).pathExtension.lowercased()) else {
            throw NativeCloudStorageError.unsupportedFile
        }
        if let size = item.size, size > limit {
            throw limit > Int64(Self.maximumAudioBytes)
                ? NativeCloudStorageError.oversizedCinema : NativeCloudStorageError.oversized
        }
        var request: URLRequest
        switch provider {
        case .googleDrive:
            var parts = URLComponents(string: "https://www.googleapis.com/drive/v3/files/\(Self.encodedID(item.remoteId))")!
            parts.queryItems = [URLQueryItem(name: "alt", value: "media")]
            request = try authorized(parts.url!)
        case .dropbox:
            var next = try authorized(URL(string: "https://content.dropboxapi.com/2/files/download")!, method: "POST")
            let argument = try JSONSerialization.data(withJSONObject: ["path": item.remoteId])
            next.setValue(String(decoding: argument, as: UTF8.self), forHTTPHeaderField: "Dropbox-API-Arg")
            request = next
        case .oneDrive:
            request = try authorized(URL(string: "https://graph.microsoft.com/v1.0/me/drive/items/\(Self.encodedID(item.remoteId))/content")!)
        }
        // The OS must also enforce Wi-Fi-only if the route changes mid-transfer.
        request.allowsCellularAccess = allowsCellular
        let (temporary, response) = try await session.download(for: request)
        _ = try validated(response, allowDownloadHost: provider == .oneDrive)
        let size = (try FileManager.default.attributesOfItem(atPath: temporary.path)[.size] as? NSNumber)?.int64Value ?? 0
        guard size > 0, size <= limit else {
            throw limit > Int64(Self.maximumAudioBytes)
                ? NativeCloudStorageError.oversizedCinema : NativeCloudStorageError.oversized
        }
        // Keep the title shown in the user's library; isolate the remote filename
        // under an unpredictable local directory rather than trusting its path.
        let folder = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        let destination = folder.appendingPathComponent((item.name as NSString).lastPathComponent)
        try FileManager.default.moveItem(at: temporary, to: destination)
        return destination
    }
}
