import Foundation
import SwiftUI

/// Resultados multimedia dentro de Actualidad, sin una segunda pantalla ni HTML.
struct NativeMediaInlineContent: View {
    @EnvironmentObject private var store: NativeMediaStore
    @EnvironmentObject private var player: NativePodcastPlayer
    @EnvironmentObject private var podcastLibrary: NativePodcastLibrary
    @Environment(\.openURL) private var openURL
    @State private var selectedVideo: NativeYouTubeVideo?

    let formatIndex: Int // 1: podcasts, 2: YouTube, 3: ambos
    @State private var sourceIndex = 0
    @State private var languageIndex = 0
    @State private var query = ""
    @State private var visibleCount = 10

    private var selectedType: String? {
        switch formatIndex {
        case 1: return "audio"
        case 2: return "video"
        default: return nil
        }
    }

    private var sources: [String] {
        Array(Set(store.items
            .filter { selectedType == nil || $0.type == selectedType }
            .map(\.sourceName)))
            .sorted { $0.localizedStandardCompare($1) == .orderedAscending }
    }

    private var sourceChoices: [String] { ["Todas las fuentes"] + sources }

    private var filteredItems: [NativeMediaItem] {
        let words = query.trimmingCharacters(in: .whitespacesAndNewlines)
            .folding(options: [.caseInsensitive, .diacriticInsensitive],
                     locale: Locale(identifier: "es_ES"))
            .split(whereSeparator: { $0.isWhitespace }).map(String.init)
        let chosenSource = sources.indices.contains(sourceIndex - 1)
            ? sources[sourceIndex - 1] : nil

        return store.items.filter { item in
            if let selectedType, item.type != selectedType { return false }
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
            let a = $0.publishedAt ?? ""
            let b = $1.publishedAt ?? ""
            return a != b ? a > b
                : $0.title.localizedStandardCompare($1.title) == .orderedAscending
        }
    }

    private func open(_ item: NativeMediaItem) {
        NativeMediaPlayback.open(item, player: player, library: podcastLibrary,
            playVideo: { selectedVideo = $0 }, openExternal: { openURL($0) })
    }

    var body: some View {
        Section("Filtrar contenidos multimedia") {
            NativeAdjustableChoice(
                title: "Fuente o canal",
                choices: sourceChoices,
                selectedIndex: $sourceIndex
            )
            NativeAdjustableChoice(
                title: "Idioma",
                choices: ["Todos los idiomas", "Español", "Inglés"],
                selectedIndex: $languageIndex
            )
            TextField("Buscar podcasts y vídeos", text: $query)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .accessibilityLabel("Buscar podcasts y vídeos")
        }
        .listRowBackground(TifloVisual.surfaceRaised)

        Section("Escuchar y ver") {
            if store.loading && store.items.isEmpty {
                ProgressView("Cargando podcasts y vídeos")
            } else {
                Text(MusicLocalized.format("%d contenidos encontrados", filteredItems.count))
                    .font(.subheadline)
                    .foregroundStyle(TifloVisual.secondaryText)
                if filteredItems.isEmpty && store.error == nil {
                    Text("No hay contenidos que coincidan con esta selección.")
                        .foregroundStyle(TifloVisual.secondaryText)
                }
                ForEach(Array(filteredItems.prefix(visibleCount))) { item in
                    NavigationLink {
                        NativeMediaDetailScreen(item: item)
                    } label: {
                        VStack(alignment: .leading, spacing: 5) {
                            Text(item.title).font(.headline)
                            Text(MusicLocalized.format("%@. Fuente: %@", MusicLocalized.message(item.formatLabel), item.sourceName))
                                .font(.subheadline)
                                .foregroundStyle(TifloVisual.secondaryText)
                            if let published = NativeNewsMetadata.publication(item.publishedAt) {
                                Text(MusicLocalized.format("Publicado: %@", published))
                                    .font(.subheadline)
                                    .foregroundStyle(TifloVisual.secondaryText)
                            }
                        }
                        .frame(maxWidth: .infinity, minHeight: 48, alignment: .leading)
                    }
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel(
                        "\(item.title). \(item.formatLabel). Fuente: \(item.sourceName). " +
                        (NativeNewsMetadata.publication(item.publishedAt)
                            .map { "Publicado: \($0)" } ?? "")
                    )
                    .accessibilityAction(named: Text(item.openLabel)) { open(item) }
                    .accessibilityAction(named: Text("Visitar fuente")) {
                        if let url = item.sourceURL { openURL(url) }
                    }
                    .accessibilityAction(named: Text("Compartir")) {
                        if let url = item.originalURL { NativeShare.present(url: url) }
                    }
                }
                if visibleCount < filteredItems.count {
                    Button("Mostrar diez más") { visibleCount += 10 }
                }
            }
            if let error = store.error {
                Text(error)
                    .foregroundStyle(TifloVisual.secondaryText)
            }
            Button(store.loading ? "Actualizando contenidos multimedia" : "Actualizar contenidos multimedia") {
                Task { await store.refresh() }
            }
            .disabled(store.loading)
        }
        .listRowBackground(TifloVisual.surfaceRaised)
        .onChange(of: formatIndex) { _, _ in sourceIndex = 0; visibleCount = 10 }
        .onChange(of: sourceIndex) { _, _ in visibleCount = 10 }
        .onChange(of: languageIndex) { _, _ in visibleCount = 10 }
        .onChange(of: query) { _, _ in visibleCount = 10 }
        .task { await store.refresh() }
        .sheet(item: $selectedVideo) { video in
            NavigationStack { NativeYouTubePlayerScreen(video: video) }
        }
    }
}
