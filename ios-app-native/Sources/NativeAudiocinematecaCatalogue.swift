import Foundation

// Provider protocol independently implemented from the documented endpoints.
enum NativeAudiocinematecaCatalogueError: Error {
    case invalidAccount, denied, invalidResponse, tooLarge, invalidCatalogue
}

private final class NativeAudiocinematecaNoRedirect: NSObject, URLSessionTaskDelegate {
    func urlSession(_ session: URLSession, task: URLSessionTask,
                    willPerformHTTPRedirection response: HTTPURLResponse,
                    newRequest request: URLRequest,
                    completionHandler: @escaping (URLRequest?) -> Void) {
        completionHandler(nil)
    }
}

struct NativeAudiocinematecaCatalogueClient {
    enum Resource: String {
        case catalogue = "catalogo.json.bz2"
        case catalogueGzip = "catalogo.json.gz"
        case version = "version.json.gz"
    }

    static func request(for resource: Resource,
                        account: NativeAudiocinematecaCredentials.Account) throws -> URLRequest {
        guard !account.username.isEmpty, !account.username.contains(":"),
              !account.password.isEmpty else {
            throw NativeAudiocinematecaCatalogueError.invalidAccount
        }
        let url = URL(string: "https://audiocinemateca.com/system/files/catalogo/" + resource.rawValue)!
        var request = URLRequest(url: url)
        request.timeoutInterval = 45
        request.setValue("identity", forHTTPHeaderField: "Accept-Encoding")
        let credentials = Data((account.username + ":" + account.password).utf8)
        request.setValue("Basic " + credentials.base64EncodedString(), forHTTPHeaderField: "Authorization")
        return request
    }

    static func fetch(_ resource: Resource,
                      account: NativeAudiocinematecaCredentials.Account) async throws -> Data {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.httpShouldSetCookies = false
        configuration.urlCredentialStorage = nil
        configuration.urlCache = nil
        let session = URLSession(configuration: configuration,
                                 delegate: NativeAudiocinematecaNoRedirect(), delegateQueue: nil)
        defer { session.invalidateAndCancel() }
        let (bytes, response) = try await session.bytes(for: request(for: resource, account: account))
        guard let http = response as? HTTPURLResponse,
              http.url?.scheme == "https", http.url?.host == "audiocinemateca.com" else {
            throw NativeAudiocinematecaCatalogueError.invalidResponse
        }
        if http.statusCode == 401 || http.statusCode == 403 {
            throw NativeAudiocinematecaCatalogueError.denied
        }
        guard http.statusCode == 200 else { throw NativeAudiocinematecaCatalogueError.invalidResponse }
        let limit = resource == .version ? 256 * 1024 : 32 * 1024 * 1024
        guard http.expectedContentLength <= Int64(limit) else {
            throw NativeAudiocinematecaCatalogueError.tooLarge
        }
        var data = Data()
        for try await byte in bytes {
            guard data.count < limit else { throw NativeAudiocinematecaCatalogueError.tooLarge }
            data.append(byte)
        }
        let magic: [UInt8] = resource == .catalogue ? [66,90,104] : [31,139]
        guard data.starts(with: magic) else { throw NativeAudiocinematecaCatalogueError.invalidResponse }
        return data
    }
}

struct NativeAudiocinematecaCatalogueIndex {
    struct Part: Identifiable {
        let id: String
        let season: String?
        let number: String
        let title: String
        let url: URL
    }

    static func mediaURL(_ reference: String) -> URL? {
        guard !reference.isEmpty, !reference.hasPrefix("//"),
              let base = URL(string: "https://audiocinemateca.com/"),
              let url = URL(string: reference, relativeTo: base)?.absoluteURL,
              url.scheme == "https", url.host == "audiocinemateca.com",
              url.user == nil, url.password == nil, url.port == nil,
              url.fragment == nil else { return nil }
        return url
    }

    struct Entry: Identifiable {
        let id: String
        let title: String
        let category: String
        let year: String
        let genre: String
        let languageCode: String
        let synopsis: String
        let parts: [Part]
    }

    static func parse(_ data: Data) throws -> [Entry] {
        guard data.count <= 128 * 1024 * 1024,
              let root = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw NativeAudiocinematecaCatalogueError.invalidCatalogue
        }
        var entries: [Entry] = []
        var seen = Set<String>()
        for category in ["peliculas", "series", "documentales", "cortometrajes"] {
            guard let rows = root[category] as? [[String: Any]] else {
                throw NativeAudiocinematecaCatalogueError.invalidCatalogue
            }
            for row in rows {
                func field(_ key: String) -> String {
                    if let value = row[key] as? String { return value }
                    if let value = row[key] as? NSNumber { return value.stringValue }
                    return ""
                }
                let title = field("titulo").isEmpty ? field("Titulo") : field("titulo")
                let sourceID = field("id")
                guard !title.isEmpty, !sourceID.isEmpty else { continue }
                let id = category + ":" + sourceID
                guard seen.insert(id).inserted else { continue }
                var parts: [Part] = []
                func appendPart(_ ref: String, season: String?, number: String, title: String) {
                    guard let url = mediaURL(ref) else { return }
                    parts.append(.init(id: id + ":" + String(parts.count), season: season,
                                       number: number, title: title, url: url))
                }
                if category == "peliculas" {
                    for (index, ref) in (row["enlaces"] as? [String] ?? []).enumerated() {
                        appendPart(ref, season: nil, number: String(index + 1), title: "")
                    }
                } else if category == "series" {
                    if let seasons = row["capitulos"] as? [String: [[String: Any]]] {
                        for season in seasons.keys.sorted(by: { $0.localizedStandardCompare($1) == .orderedAscending }) {
                            for episode in seasons[season] ?? [] {
                                let number = (episode["capitulo"] as? String) ?? (episode["capitulo"] as? NSNumber)?.stringValue ?? ""
                                appendPart(episode["enlace"] as? String ?? "", season: season,
                                           number: number, title: episode["titulo"] as? String ?? "")
                            }
                        }
                    }
                } else {
                    appendPart(field("enlace"), season: nil, number: "1", title: "")
                }
                entries.append(.init(id: id, title: title, category: category,
                                     year: field("anio"), genre: field("genero"),
                                     languageCode: field("idioma"), synopsis: field("sinopsis"), parts: parts))
            }
        }
        return entries
    }
}
