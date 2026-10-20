import Foundation
import SwiftUI
import UIKit

enum NativeFavoriteKind: String, Codable {
    case resource
    case news
    case video

    var spokenName: String {
        switch self {
        case .resource: return "Recurso"
        case .news: return "Noticia"
        case .video: return "Vídeo"
        }
    }
}

struct NativeFavoriteKey: Hashable, Codable {
    let kind: NativeFavoriteKind
    let id: String
    let language: String?
    init(_ kind: NativeFavoriteKind, _ item: NativeCatalogItem) {
        self.kind = kind
        self.id = item.id
        self.language = item.lang
    }
}

@MainActor
final class NativeFavoritesStore: ObservableObject {
    @Published private(set) var keys: Set<NativeFavoriteKey> = []
    private let storageKey = "native-ios-favorites-v1"

    init() {
        if let saved = UserDefaults.standard.data(forKey: storageKey),
           let decoded = try? JSONDecoder().decode(Set<NativeFavoriteKey>.self, from: saved) {
            keys = decoded
        }
    }

    func contains(_ kind: NativeFavoriteKind, item: NativeCatalogItem) -> Bool {
        keys.contains(NativeFavoriteKey(kind, item))
    }

    @discardableResult
    func toggle(_ kind: NativeFavoriteKind, item: NativeCatalogItem) -> Bool {
        let key = NativeFavoriteKey(kind, item)
        let isNowFavorite: Bool
        if keys.contains(key) {
            keys.remove(key)
            isNowFavorite = false
        } else {
            keys.insert(key)
            isNowFavorite = true
        }
        if let data = try? JSONEncoder().encode(keys) {
            UserDefaults.standard.set(data, forKey: storageKey)
        }
        return isNowFavorite
    }
}

private struct NativeFavoriteDisplay: Identifiable {
    let key: NativeFavoriteKey
    let item: NativeCatalogItem
    var id: String { key.kind.rawValue + ":" + key.id + ":" + (key.language ?? "") }
}

struct NativeFavoritesScreen: View {
    @EnvironmentObject private var store: NativeFavoritesStore
    @EnvironmentObject private var catalog: NativeCatalogStore
    @Environment(\.openURL) private var openURL
    @State private var status: String?
    @State private var selectedVideo: NativeYouTubeVideo?

    private var entries: [NativeFavoriteDisplay] {
        let resources = catalog.resources.map { (NativeFavoriteKind.resource, $0) }
        let news = catalog.news.map { (NativeFavoriteKind.news, $0) }
        let videos = catalog.videos.map { (NativeFavoriteKind.video, $0) }
        return (resources + news + videos).compactMap { kind, item in
            let key = NativeFavoriteKey(kind, item)
            return store.keys.contains(key) ? NativeFavoriteDisplay(key: key, item: item) : nil
        }
        .sorted {
            let cmp = $0.item.title.localizedStandardCompare($1.item.title)
            return cmp == .orderedSame ? $0.id < $1.id : cmp == .orderedAscending
        }
    }

    private func remove(_ entry: NativeFavoriteDisplay) {
        _ = store.toggle(entry.key.kind, item: entry.item)
        status = "Eliminado de Favoritos: \(entry.item.title)"
        UIAccessibility.post(notification: .announcement, argument: status)
    }

    var body: some View {
        List {
            Section("Contenidos favoritos") {
                if store.keys.isEmpty {
                    Text("Todavía no tienes favoritos. Desde Recursos, Actualidad o Vídeos puedes añadir contenidos con las acciones de VoiceOver.")
                        .foregroundStyle(TifloVisual.secondaryText)
                } else if entries.isEmpty {
                    Text("No hay coincidencias en el catálogo disponible. Los favoritos se conservarán y volverán a aparecer cuando se actualice el contenido.")
                        .foregroundStyle(TifloVisual.secondaryText)
                }

                ForEach(entries) { entry in
                    switch entry.key.kind {
                    case .resource:
                        NavigationLink {
                            NativeRemoteResourceScreen(item: entry.item)
                        } label: {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(entry.item.title)
                                Text(entry.key.kind.spokenName)
                                    .font(.caption)
                                    .foregroundStyle(TifloVisual.secondaryText)
                            }
                        }
                        .accessibilityElement(children: .ignore)
                        .accessibilityLabel("\(entry.item.title), recurso favorito")
                        .accessibilityHint("Doble toque para leer. Acción: Quitar de favoritos.")
                        .accessibilityAction(named: Text("Quitar de favoritos")) { remove(entry) }

                    case .news:
                        NavigationLink {
                            NativeNewsArticleScreen(item: entry.item)
                        } label: {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(entry.item.title)
                                Text(entry.key.kind.spokenName)
                                    .font(.caption)
                                    .foregroundStyle(TifloVisual.secondaryText)
                            }
                        }
                        .accessibilityElement(children: .ignore)
                        .accessibilityLabel("\(entry.item.title), noticia favorita")
                        .accessibilityHint("Doble toque para leer. Acción: Quitar de favoritos.")
                        .accessibilityAction(named: Text("Quitar de favoritos")) { remove(entry) }

                    case .video:
                        Button {
                            selectedVideo = NativeYouTubeVideo(catalog: entry.item)
                        } label: {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(entry.item.title)
                                Text(entry.key.kind.spokenName)
                                    .font(.caption)
                                    .foregroundStyle(TifloVisual.secondaryText)
                            }
                        }
                        .accessibilityLabel("\(entry.item.title), vídeo favorito")
                        .accessibilityHint("Doble toque para reproducir en TifloAcosta. Acciones: Abrir en YouTube y Quitar de favoritos.")
                        .accessibilityAction(named: Text("Abrir en YouTube")) {
                            if let url = entry.item.videoURL { openURL(url) }
                        }
                        .accessibilityAction(named: Text("Quitar de favoritos")) { remove(entry) }
                        .accessibilityAction(.default) {
                            selectedVideo = NativeYouTubeVideo(catalog: entry.item)
                        }
                    }
                }
            }
            .listRowBackground(TifloVisual.surfaceRaised)

            if let status {
                Text(status)
                    .font(.footnote)
                    .foregroundStyle(TifloVisual.secondaryText)
            }
        }
        .tifloScreenSurface()
        .navigationTitle("Favoritos")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(item: $selectedVideo) { video in
            NavigationStack { NativeYouTubePlayerScreen(video: video) }
        }
    }
}
