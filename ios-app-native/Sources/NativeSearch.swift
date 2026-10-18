import Foundation
import SwiftUI

// La búsqueda funciona sobre el catálogo nativo; no utiliza pantallas HTML.
private enum NativeSearchKind: String, CaseIterable {
    case resource
    case video
    case news

    var title: String {
        switch self {
        case .resource: return "Recursos"
        case .video: return "Vídeos del canal"
        case .news: return "Actualidad"
        }
    }
}

private struct NativeSearchMatch: Identifiable {
    let kind: NativeSearchKind
    let item: NativeCatalogItem
    var id: String { kind.rawValue + ":" + item.id }
}

struct NativeSearchResultsScreen: View {
    @EnvironmentObject private var catalog: NativeCatalogStore
    let query: String

    private func normalize(_ value: String) -> String {
        value.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: Locale(identifier: "es_ES"))
    }

    private func searchableText(_ match: NativeSearchMatch) -> String {
        let item = match.item
        return normalize([
            item.title, item.category ?? "", item.summary ?? "",
            item.description ?? "", item.excerpt ?? "", item.body ?? ""
        ].joined(separator: " "))
    }

    private func relevance(_ match: NativeSearchMatch, normalizedQuery: String) -> Int {
        let title = normalize(match.item.title)
        if title == normalizedQuery { return 0 }
        if title.hasPrefix(normalizedQuery) { return 1 }
        return 2
    }

    private var matches: [NativeSearchMatch] {
        let normalizedQuery = normalize(query.trimmingCharacters(in: .whitespacesAndNewlines))
        let words = normalizedQuery.split(whereSeparator: { $0.isWhitespace }).map(String.init)
        guard !words.isEmpty else { return [] }

        let resources = catalog.resources
            .filter { $0.lang == nil || $0.lang == "es" }
            .map { NativeSearchMatch(kind: .resource, item: $0) }
        let videos = catalog.videos.map { NativeSearchMatch(kind: .video, item: $0) }
        let news = catalog.news
            .filter { $0.lang == nil || $0.lang == "es" }
            .map { NativeSearchMatch(kind: .news, item: $0) }

        return (resources + videos + news)
            .filter { match in
                let text = searchableText(match)
                return words.allSatisfy { text.contains($0) }
            }
            .sorted { first, second in
                let firstScore = relevance(first, normalizedQuery: normalizedQuery)
                let secondScore = relevance(second, normalizedQuery: normalizedQuery)
                if firstScore != secondScore { return firstScore < secondScore }
                let ordered = first.item.title.localizedStandardCompare(second.item.title)
                if ordered != .orderedSame { return ordered == .orderedAscending }
                return first.id < second.id
            }
    }

    var body: some View {
        List {
            Section {
                Text("Búsqueda: \(query)")
                    .font(.subheadline)
                if catalog.loading && matches.isEmpty {
                    ProgressView("Buscando en el catálogo")
                } else {
                    Text("\(matches.count) resultados")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                if let error = catalog.error {
                    Text(error).foregroundStyle(.secondary)
                    Button("Actualizar contenido") {
                        Task { await catalog.refresh() }
                    }
                }
            }

            if matches.isEmpty && !catalog.loading {
                Section {
                    Text("No se encontraron resultados en el catálogo disponible.")
                }
            }

            ForEach(NativeSearchKind.allCases, id: \.self) { kind in
                let group = matches.filter { $0.kind == kind }
                if !group.isEmpty {
                    Section(kind.title) {
                        ForEach(group) { match in
                            switch kind {
                            case .resource:
                                NavigationLink {
                                    NativeRemoteResourceScreen(item: match.item)
                                } label: {
                                    Text(match.item.title)
                                        .frame(minHeight: 44, alignment: .leading)
                                }
                                .accessibilityLabel(match.item.title)
                            case .news:
                                NavigationLink {
                                    NativeNewsArticleScreen(item: match.item)
                                } label: {
                                    Text(match.item.title)
                                        .frame(minHeight: 44, alignment: .leading)
                                }
                                .accessibilityLabel(match.item.title)
                            case .video:
                                NavigationLink {
                                    NativeSearchVideoDetailScreen(item: match.item)
                                } label: {
                                    Text(match.item.title)
                                        .frame(minHeight: 44, alignment: .leading)
                                }
                                .accessibilityLabel(match.item.title)
                            }
                        }
                    }
                }
            }
            Section {
                Text("Se busca en los recursos, noticias y vídeos del catálogo de TifloAcosta. La búsqueda en todo YouTube se incorporará con TifloReproductor.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
        .navigationTitle("Resultados de búsqueda")
        .navigationBarTitleDisplayMode(.inline)
    }
}

// El título mantiene al usuario dentro de la aplicación. Abrir YouTube
// requiere una acción adicional hasta que el reproductor interno esté listo.
private struct NativeSearchVideoDetailScreen: View {
    let item: NativeCatalogItem
    @Environment(\.openURL) private var openURL

    var body: some View {
        List {
            Section {
                Text(item.title).font(.headline)
                if let description = item.description ?? item.excerpt {
                    Text(description).textSelection(.enabled)
                }
            }
            Section("Reproducción") {
                Text("El reproductor accesible de TifloAcosta todavía no está disponible en esta versión nativa.")
                    .font(.subheadline)
                if let url = item.videoURL {
                    Button("Abrir este vídeo en YouTube") {
                        openURL(url)
                    }
                }
            }
        }
        .navigationTitle("Vídeo")
        .navigationBarTitleDisplayMode(.inline)
    }
}
