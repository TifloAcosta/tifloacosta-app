import Foundation
import SwiftUI

/// Matches the published mobile-content.json schema without rendering any HTML interface.
struct NativeCatalogItem: Decodable, Identifiable {
    let id: String
    let title: String
    let lang: String?
    let category: String?
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

    private let endpoint = URL(string: "https://tifloacosta.com/mobile-content.json")!

    private var cacheURL: URL {
        FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("tifloacosta-native-catalog.json")
    }

    init() {
        if let data = try? Data(contentsOf: cacheURL),
           let snapshot = try? JSONDecoder().decode(NativeCatalogSnapshot.self, from: data),
           snapshot.schemaVersion == 1 {
            apply(snapshot)
        }
    }

    private func apply(_ snapshot: NativeCatalogSnapshot) {
        resources = snapshot.resources
        videos = snapshot.videos
        news = snapshot.news
    }

    func refresh() async {
        loading = true
        defer { loading = false }
        var request = URLRequest(url: endpoint)
        request.cachePolicy = .reloadIgnoringLocalCacheData
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard (response as? HTTPURLResponse)?.statusCode == 200 else {
                throw URLError(.badServerResponse)
            }
            let snapshot = try JSONDecoder().decode(NativeCatalogSnapshot.self, from: data)
            guard snapshot.schemaVersion == 1 else { throw URLError(.cannotParseResponse) }
            apply(snapshot)
            try? data.write(to: cacheURL, options: .atomic)
            error = nil
        } catch {
            // Keep a previously cached catalog usable when offline.
            self.error = resources.isEmpty && videos.isEmpty && news.isEmpty
                ? "No se pudo cargar el contenido. Comprueba la conexión."
                : "Sin conexión. Se muestra el contenido guardado."
        }
    }
}
