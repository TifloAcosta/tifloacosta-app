import Foundation
import SwiftUI

/// Noticias audiovisuales publicadas por el mismo catálogo editorial que la web.
/// No hay vistas HTML ni un reproductor ficticio: un enlace externo se identifica como tal.
struct NativeMediaItem: Decodable, Identifiable {
    let id: String
    let type: String
    let sourceName: String
    let sourceUrl: String?
    let originalUrl: String?
    let originalLanguage: String?
    let publishedAt: String?
    let title: String
    let summary: String?
    let mediaUrl: String?

    private func verifiedURL(_ raw: String?) -> URL? {
        guard let raw, let url = URL(string: raw),
              ["https", "http"].contains(url.scheme?.lowercased() ?? ""),
              url.host != nil else { return nil }
        return url
    }

    var originalURL: URL? { verifiedURL(originalUrl) ?? verifiedURL(sourceUrl) }
    var sourceURL: URL? { verifiedURL(sourceUrl) }
    var directAudioURL: URL? { type == "audio" ? verifiedURL(mediaUrl) : nil }
    var formatLabel: String { type == "audio" ? "Podcast" : "Vídeo de YouTube" }
    var openLabel: String {
        if type == "video" { return "Ver vídeo en YouTube" }
        return directAudioURL == nil ? "Abrir episodio en la fuente original" : "Escuchar episodio"
    }
}

@MainActor
final class NativeMediaStore: ObservableObject {
    @Published private(set) var items: [NativeMediaItem] = []
    @Published private(set) var loading = false
    @Published private(set) var error: String?

    private let endpoint = URL(string: "https://tifloacosta.com/actualidad-media.json")!

    private var cacheURL: URL {
        FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("tifloacosta-native-media.json")
    }

    init() {
        if let data = try? Data(contentsOf: cacheURL),
           let snapshot = try? JSONDecoder().decode([NativeMediaItem].self, from: data) {
            items = snapshot
        }
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
            let snapshot = try JSONDecoder().decode([NativeMediaItem].self, from: data)
            items = snapshot.filter { $0.type == "audio" || $0.type == "video" }
            try? data.write(to: cacheURL, options: .atomic)
            error = nil
        } catch {
            self.error = items.isEmpty
                ? "No se pudieron cargar los podcasts y canales de YouTube."
                : "Sin conexión. Se muestran los contenidos multimedia guardados."
        }
    }
}

struct NativeMediaScreen: View {
    @EnvironmentObject private var store: NativeMediaStore
    @Environment(\.openURL) private var openURL

    // Al entrar desde Actualidad, conservar el tipo elegido mediante VoiceOver.
    init(initialFormatIndex: Int = 0) {
        _formatIndex = State(initialValue: min(max(0, initialFormatIndex), 3))
    }

    @State private var formatIndex: Int
    @State private var sourceIndex = 0
    @State private var languageIndex = 0
    @State private var query = ""
    @State private var visibleCount = 10

    private let formatChoices = [
        "Selecciona un formato", "Todos los formatos", "Podcasts", "Canales de YouTube"
    ]
    private let languageChoices = ["Todos los idiomas", "Español", "Inglés"]

    private var chosenType: String? {
        switch formatIndex {
        case 2: return "audio"
        case 3: return "video"
        default: return nil
        }
    }

    private var sources: [String] {
        Array(Set(store.items
            .filter { chosenType == nil || $0.type == chosenType }
            .map(\.sourceName)))
            .sorted { $0.localizedStandardCompare($1) == .orderedAscending }
    }

    private var sourceChoices: [String] { ["Todas las fuentes"] + sources }

    private var filteredItems: [NativeMediaItem] {
        let words = query.trimmingCharacters(in: .whitespacesAndNewlines)
            .folding(options: [.caseInsensitive, .diacriticInsensitive],
                     locale: Locale(identifier: "es_ES"))
            .split(whereSeparator: { $0.isWhitespace }).map(String.init)
        guard formatIndex > 0 || !words.isEmpty else { return [] }
        let chosenSource = sources.indices.contains(sourceIndex - 1) ? sources[sourceIndex - 1] : nil

        return store.items.filter { item in
            if let chosenType, item.type != chosenType { return false }
            if let chosenSource, item.sourceName != chosenSource { return false }
            if languageIndex == 1 && item.originalLanguage != "es" { return false }
            if languageIndex == 2 && item.originalLanguage != "en" { return false }
            let searchable = [item.title, item.sourceName, item.summary ?? ""]
                .joined(separator: " ")
                .folding(options: [.caseInsensitive, .diacriticInsensitive],
                         locale: Locale(identifier: "es_ES"))
            return words.allSatisfy { searchable.contains($0) }
        }
        .sorted {
            let first = $0.publishedAt ?? ""
            let second = $1.publishedAt ?? ""
            if first != second { return first > second }
            return $0.title.localizedStandardCompare($1.title) == .orderedAscending
        }
    }

    private func open(_ item: NativeMediaItem) {
        if let url = item.directAudioURL ?? item.originalURL { openURL(url) }
    }

    private func share(_ item: NativeMediaItem) {
        if let url = item.originalURL { NativeShare.present(url: url) }
    }

    var body: some View {
        List {
            Section {
                NativeAdjustableChoice(
                    title: "Formato",
                    choices: formatChoices,
                    selectedIndex: $formatIndex
                )
            }
            .listRowBackground(TifloVisual.surfaceRaised)

            if formatIndex == 0 && query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                Text("Selecciona Podcasts o Canales de YouTube para consultar los contenidos. También puedes escribir una búsqueda.")
                    .foregroundStyle(TifloVisual.secondaryText)
                    .listRowBackground(TifloVisual.surfaceRaised)
            } else {
                Section("Filtrar contenidos") {
                    NativeAdjustableChoice(
                        title: "Fuente o canal",
                        choices: sourceChoices,
                        selectedIndex: $sourceIndex
                    )
                    NativeAdjustableChoice(
                        title: "Idioma",
                        choices: languageChoices,
                        selectedIndex: $languageIndex
                    )
                }
                .listRowBackground(TifloVisual.surfaceRaised)

                Section("Escuchar y ver") {
                    Text("\(filteredItems.count) contenidos encontrados")
                        .font(.subheadline)
                        .foregroundStyle(TifloVisual.secondaryText)
                    if filteredItems.isEmpty {
                        Text("No hay contenidos que coincidan con esta selección.")
                            .foregroundStyle(TifloVisual.secondaryText)
                    }
                    ForEach(Array(filteredItems.prefix(visibleCount))) { item in
                        NavigationLink {
                            NativeMediaDetailScreen(item: item)
                        } label: {
                            HStack(alignment: .top, spacing: 12) {
                                RoundedRectangle(cornerRadius: 2)
                                    .fill(TifloVisual.brandRed)
                                    .frame(width: 4, height: 48)
                                    .accessibilityHidden(true)
                                VStack(alignment: .leading, spacing: 5) {
                                    Text(item.title).font(.headline)
                                    Text("\(item.formatLabel). Fuente: \(item.sourceName)")
                                        .font(.subheadline)
                                        .foregroundStyle(TifloVisual.secondaryText)
                                    if let published = NativeNewsMetadata.publication(item.publishedAt) {
                                        Text("Publicado: \(published)")
                                            .font(.subheadline)
                                            .foregroundStyle(TifloVisual.secondaryText)
                                    }
                                }
                            }
                        }
                        .accessibilityElement(children: .ignore)
                        .accessibilityLabel(
                            "\(item.title). \(item.formatLabel). Fuente: \(item.sourceName). " +
                            (NativeNewsMetadata.publication(item.publishedAt)
                                .map { "Publicado: \($0)" } ?? "")
                        )
                        .accessibilityHint("Doble toque para conocer el contenido. Acciones: \(item.openLabel), Visitar fuente y Compartir.")
                        .accessibilityAction(named: Text(item.openLabel)) { open(item) }
                        .accessibilityAction(named: Text("Visitar fuente")) {
                            if let url = item.sourceURL { openURL(url) }
                        }
                        .accessibilityAction(named: Text("Compartir")) { share(item) }
                    }
                    if visibleCount < filteredItems.count {
                        Button("Mostrar diez más") { visibleCount += 10 }
                    }
                }
                .listRowBackground(TifloVisual.surfaceRaised)
            }

            if store.loading && store.items.isEmpty {
                ProgressView("Cargando podcasts y vídeos")
                    .listRowBackground(TifloVisual.surfaceRaised)
            }
            if let error = store.error {
                Text(error)
                    .foregroundStyle(TifloVisual.secondaryText)
                    .listRowBackground(TifloVisual.surfaceRaised)
                Button("Actualizar contenidos multimedia") {
                    Task { await store.refresh() }
                }
                .listRowBackground(TifloVisual.surfaceRaised)
            }
        }
        .tifloScreenSurface()
        .navigationTitle("Escuchar y ver")
        .searchable(text: $query, prompt: "Buscar podcasts y canales")
        .onChange(of: formatIndex) { _, _ in sourceIndex = 0; visibleCount = 10 }
        .onChange(of: sourceIndex) { _, _ in visibleCount = 10 }
        .onChange(of: languageIndex) { _, _ in visibleCount = 10 }
        .onChange(of: query) { _, _ in visibleCount = 10 }
        .task { if store.items.isEmpty { await store.refresh() } }
    }
}

private struct NativeMediaDetailScreen: View {
    let item: NativeMediaItem
    @Environment(\.openURL) private var openURL

    var body: some View {
        List {
            Section {
                Text(item.title)
                    .font(.title2.bold())
                    .accessibilityAddTraits(.isHeader)
                Text("\(item.formatLabel). Fuente: \(item.sourceName)")
                    .foregroundStyle(TifloVisual.secondaryText)
                if let published = NativeNewsMetadata.publication(item.publishedAt) {
                    Text("Publicado: \(published)")
                        .foregroundStyle(TifloVisual.secondaryText)
                }
                if let summary = item.summary, !summary.isEmpty {
                    Text(summary).textSelection(.enabled)
                }
            }
            .listRowBackground(TifloVisual.surfaceRaised)

            Section("Acciones") {
                if let url = item.directAudioURL ?? item.originalURL {
                    Button(item.openLabel) { openURL(url) }
                }
                if let url = item.sourceURL {
                    Button("Visitar fuente o canal") { openURL(url) }
                }
                if let url = item.originalURL {
                    Button("Compartir") { NativeShare.present(url: url) }
                }
                if item.type == "audio" && item.directAudioURL == nil {
                    Text("Este episodio se abre en la página original porque el catálogo no proporciona un archivo de audio directo.")
                        .font(.footnote)
                        .foregroundStyle(TifloVisual.secondaryText)
                }
            }
            .listRowBackground(TifloVisual.surfaceRaised)
        }
        .tifloScreenSurface()
        .navigationTitle(item.formatLabel)
        .navigationBarTitleDisplayMode(.inline)
    }
}
