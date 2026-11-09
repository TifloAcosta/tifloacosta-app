import Foundation
import SwiftUI

/// Matches the published mobile-content.json schema without rendering any HTML interface.
struct NativeCatalogItem: Decodable, Identifiable {
    let id: String
    let title: String
    let lang: String?
    let category: String?
    let categories: [String]?
    let sourceName: String?
    let publishedAt: String?
    let newsDate: String?
    let url: String?
    let openUrl: String?
    let originalUrl: String?
    let description: String?
    let excerpt: String?
    let summary: String?
    let body: String?
    let isNew: Bool?

    var resourceURL: URL? {
        URL(string: openUrl ?? url ?? "")
    }

    var videoURL: URL? {
        URL(string: url ?? "")
    }

    var articleURL: URL? {
        URL(string: originalUrl ?? url ?? "")
    }
}

struct NativeCatalogSnapshot: Decodable {
    let schemaVersion: Int
    let generatedAt: String?
    let resources: [NativeCatalogItem]
    let videos: [NativeCatalogItem]
    let news: [NativeCatalogItem]
}

@MainActor
final class NativeCatalogStore: ObservableObject {
    @Published private(set) var resources: [NativeCatalogItem] = []
    @Published private(set) var videos: [NativeCatalogItem] = []
    @Published private(set) var news: [NativeCatalogItem] = []
    @Published private(set) var loading = false
    @Published private(set) var error: String?
    @Published private(set) var lastUpdated: Date?
    @Published private(set) var lastSource: String?
    @Published private(set) var updateMessage: String?

    // Alternate public copy of the same published catalog. Never rely on the
    // website's domain being reachable to refresh the native resource list.
    private let endpoints = [
        URL(string: "https://tifloacosta.com/mobile-content.json")!,
        URL(string: "https://raw.githubusercontent.com/TifloAcosta/tifloacosta-app/main/mobile-content.json")!
    ]

    private var updateDateURL: URL {
        FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("tifloacosta-catalog-last-success.txt")
    }

    private var cacheURL: URL {
        FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("tifloacosta-native-catalog.json")
    }

    init() {
        if let data = try? Data(contentsOf: cacheURL),
           let snapshot = try? JSONDecoder().decode(NativeCatalogSnapshot.self, from: data),
           snapshot.schemaVersion == 1 {
            apply(snapshot)
            if let text = try? String(contentsOf: updateDateURL, encoding: .utf8),
               let timestamp = TimeInterval(text) {
                lastUpdated = Date(timeIntervalSince1970: timestamp)
            }
        }
    }

    private func apply(_ snapshot: NativeCatalogSnapshot) {
        resources = snapshot.resources
        videos = snapshot.videos
        news = snapshot.news
    }

    private func persistTimestamp(_ date: Date) {
        let directory = updateDateURL.deletingLastPathComponent()
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        try? String(date.timeIntervalSince1970).write(to: updateDateURL, atomically: true, encoding: .utf8)
    }

    func refresh() async {
        guard !loading else { return }
        loading = true
        updateMessage = nil
        defer { loading = false }
        var failures: [String] = []

        for endpoint in endpoints {
            var components = URLComponents(url: endpoint, resolvingAgainstBaseURL: false)
            components?.queryItems = [URLQueryItem(name: "v", value: String(Int(Date().timeIntervalSince1970)))]
            var request = URLRequest(url: components?.url ?? endpoint)
            request.cachePolicy = .reloadIgnoringLocalAndRemoteCacheData
            request.timeoutInterval = 25
            request.setValue("no-cache, no-store, max-age=0", forHTTPHeaderField: "Cache-Control")

            do {
                let (data, response) = try await URLSession.shared.data(for: request)
                guard let http = response as? HTTPURLResponse else {
                    throw URLError(.badServerResponse)
                }
                guard http.statusCode == 200 else {
                    throw NSError(domain: "TifloAcosta.Catalog", code: http.statusCode,
                                  userInfo: [NSLocalizedDescriptionKey: "HTTP \(http.statusCode)"])
                }
                let snapshot = try JSONDecoder().decode(NativeCatalogSnapshot.self, from: data)
                guard snapshot.schemaVersion == 1 else {
                    throw NSError(domain: "TifloAcosta.Catalog", code: 1,
                                  userInfo: [NSLocalizedDescriptionKey: "Versión de catálogo no compatible"])
                }
                guard !snapshot.resources.isEmpty else {
                    throw NSError(domain: "TifloAcosta.Catalog", code: 2,
                                  userInfo: [NSLocalizedDescriptionKey: "El catálogo no contiene recursos"])
                }
                apply(snapshot)
                try? data.write(to: cacheURL, options: .atomic)
                let now = Date()
                lastUpdated = now
                lastSource = endpoint.host
                persistTimestamp(now)
                error = nil
                updateMessage = "Contenido actualizado: \(snapshot.resources.count) recursos, \(snapshot.videos.count) vídeos y \(snapshot.news.count) noticias."
                return
            } catch {
                failures.append("\(endpoint.host ?? "servidor"): \(error.localizedDescription)")
            }
        }

        let detail = failures.joined(separator: ". ")
        if resources.isEmpty && videos.isEmpty && news.isEmpty {
            error = "No se pudo descargar el catálogo. \(detail)"
        } else {
            error = "No se pudo actualizar el catálogo. Se muestran los contenidos guardados. \(detail)"
        }
        updateMessage = error
    }
}
