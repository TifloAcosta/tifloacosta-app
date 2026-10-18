import SwiftUI
import UIKit

private enum NativeDestination: String, CaseIterable, Hashable, Identifiable {
    case actualidad = "Actualidad"
    case recursos = "Recursos"
    case tifloLector = "TifloLector"
    case videos = "Vídeos"
    case recibidos = "Recibidos"
    case podcasts = "Podcasts"

    var id: String { rawValue }
}

struct NativeHomeScreen: View {
    @EnvironmentObject private var catalog: NativeCatalogStore

    var body: some View {
        NavigationStack {
            List {
                Section {
                    ForEach(NativeDestination.allCases) { destination in
                        NavigationLink(value: destination) {
                            Text(destination.rawValue)
                                .font(.body)
                                .frame(minHeight: 44, alignment: .leading)
                        }
                    }
                } header: {
                    Text("TifloAcosta")
                }

                if let error = catalog.error {
                    Section {
                        Text(error).accessibilityAddTraits(.updatesFrequently)
                        Button("Actualizar contenido") {
                            Task { await catalog.refresh() }
                        }
                    }
                }
            }
            .navigationTitle("TifloAcosta")
            .navigationDestination(for: NativeDestination.self) { destination in
                switch destination {
                case .actualidad: NativeNewsScreen()
                case .recursos: NativeResourcesScreen()
                case .tifloLector: NativeReaderLibraryScreen()
                case .videos: NativeVideosScreen()
                case .recibidos: NativeInboxScreen()
                case .podcasts: NativePodcastScreen()
                }
            }
        }
    }
}

/// A real SwiftUI element with adjustable VoiceOver values. The same button can be
/// activated without VoiceOver, so the choice has a non-rotor fallback.
struct NativeAdjustableChoice: View {
    let title: String
    let choices: [String]
    @Binding var selectedIndex: Int

    private var validIndex: Int { min(max(0, selectedIndex), max(choices.count - 1, 0)) }
    private var currentValue: String { choices.indices.contains(validIndex) ? choices[validIndex] : "" }

    private func advance(_ delta: Int) {
        guard !choices.isEmpty else { return }
        selectedIndex = (validIndex + delta + choices.count) % choices.count
    }

    var body: some View {
        Button {
            advance(1)
        } label: {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(title).font(.subheadline)
                    Text(currentValue).font(.body).bold()
                }
                Spacer()
                Image(systemName: "arrow.up.arrow.down")
                    .accessibilityHidden(true)
            }
            .frame(minHeight: 44)
        }
        .disabled(choices.isEmpty)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(title)
        .accessibilityValue(currentValue)
        .accessibilityHint("Desliza arriba o abajo para cambiar. Doble toque para la siguiente opción.")
        .accessibilityAdjustableAction { direction in
            switch direction {
            case .increment: advance(1)
            case .decrement: advance(-1)
            @unknown default: break
            }
        }
    }
}

struct NativeResourcesScreen: View {
    @EnvironmentObject private var catalog: NativeCatalogStore
    @Environment(\.openURL) private var openURL
    @State private var categoryIndex = 0

    private var spanishResources: [NativeCatalogItem] {
        catalog.resources.filter { $0.lang == "es" }
    }

    private var categories: [String] {
        Array(Set(spanishResources.compactMap(\.category))).sorted {
            $0.localizedStandardCompare($1) == .orderedAscending
        }
    }

    private var categoryChoices: [String] { ["Todas"] + categories }

    private var filtered: [NativeCatalogItem] {
        guard categoryIndex > 0, categoryChoices.indices.contains(categoryIndex) else {
            return spanishResources
        }
        return spanishResources.filter { $0.category == categoryChoices[categoryIndex] }
    }

    var body: some View {
        List {
            Section {
                NativeAdjustableChoice(
                    title: "Categoría",
                    choices: categoryChoices,
                    selectedIndex: $categoryIndex
                )
            }

            Section("Recursos disponibles") {
                if filtered.isEmpty {
                    Text("No hay recursos en la categoría elegida.")
                }
                ForEach(filtered) { item in
                    Button {
                        if let url = item.resourceURL { openURL(url) }
                    } label: {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(item.title).font(.body)
                            if let category = item.category {
                                Text(category).font(.caption).foregroundStyle(.secondary)
                            }
                        }
                    }
                    .disabled(item.resourceURL == nil)
                    .accessibilityLabel(item.title)
                    .accessibilityHint("Abre el recurso seleccionado.")
                    .accessibilityAction(named: Text("Compartir")) {
                        if let url = item.resourceURL { NativeShare.present(url: url) }
                    }
                }
            }
        }
        .navigationTitle("Recursos")
    }
}

struct NativeVideosScreen: View {
    @EnvironmentObject private var catalog: NativeCatalogStore
    @Environment(\.openURL) private var openURL
    @State private var query = ""
    @State private var sortIndex = 0
    @State private var visibleCount = 10

    private var ordered: [NativeCatalogItem] {
        let source = sortIndex == 0 ? catalog.videos : Array(catalog.videos.reversed())
        guard !query.isEmpty else { return source }
        return source.filter {
            $0.title.localizedCaseInsensitiveContains(query)
                || ($0.description?.localizedCaseInsensitiveContains(query) ?? false)
        }
    }

    var body: some View {
        List {
            Section {
                NativeAdjustableChoice(
                    title: "Orden",
                    choices: ["Más recientes primero", "Más antiguos primero"],
                    selectedIndex: $sortIndex
                )
            }

            Section("Vídeos del canal") {
                if ordered.isEmpty {
                    Text("No hay vídeos para esta búsqueda.")
                }
                ForEach(Array(ordered.prefix(visibleCount))) { item in
                    Button {
                        if let url = item.videoURL { openURL(url) }
                    } label: {
                        Text(item.title)
                    }
                    .disabled(item.videoURL == nil)
                    .accessibilityLabel(item.title)
                    .accessibilityHint("Abre el vídeo en YouTube. El reproductor interno nativo sigue pendiente de migración.")
                    .accessibilityAction(named: Text("Abrir en YouTube")) {
                        if let url = item.videoURL { openURL(url) }
                    }
                    .accessibilityAction(named: Text("Compartir")) {
                        if let url = item.videoURL { NativeShare.present(url: url) }
                    }
                }

                if visibleCount < ordered.count {
                    Button("Mostrar diez más") { visibleCount += 10 }
                }
            }
        }
        .navigationTitle("Vídeos")
        .searchable(text: $query, prompt: "Buscar en los vídeos del canal")
        .onChange(of: query) { _, _ in visibleCount = 10 }
        .onChange(of: sortIndex) { _, _ in visibleCount = 10 }
    }
}

struct NativeNewsScreen: View {
    @EnvironmentObject private var catalog: NativeCatalogStore

    private var articles: [NativeCatalogItem] {
        catalog.news.filter { $0.lang == "es" }
    }

    var body: some View {
        List(articles) { item in
            NavigationLink {
                NativeNewsArticleScreen(item: item)
            } label: {
                VStack(alignment: .leading, spacing: 5) {
                    Text(item.title).font(.headline)
                    if let excerpt = item.summary {
                        Text(excerpt).font(.subheadline).foregroundStyle(.secondary).lineLimit(3)
                    }
                }
            }
        }
        .overlay {
            if articles.isEmpty { ContentUnavailableView("Sin noticias", systemImage: "newspaper") }
        }
        .navigationTitle("Actualidad")
    }
}

struct NativeNewsArticleScreen: View {
    let item: NativeCatalogItem
    @Environment(\.openURL) private var openURL

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                Text(item.title).font(.title2).bold()
                Text(item.body ?? item.summary ?? "")
                    .textSelection(.enabled)
                if let url = item.articleURL {
                    Button("Abrir fuente original") { openURL(url) }
                }
            }
            .padding()
        }
        .navigationTitle("Noticia")
        .navigationBarTitleDisplayMode(.inline)
    }
}

@MainActor
enum NativeShare {
    static func present(url: URL) {
        guard let scene = UIApplication.shared.connectedScenes
            .compactMap({ $0 as? UIWindowScene })
            .first(where: { $0.activationState == .foregroundActive }),
            var presenter = scene.keyWindow?.rootViewController else { return }

        while let presented = presenter.presentedViewController {
            presenter = presented
        }
        presenter.present(
            UIActivityViewController(activityItems: [url], applicationActivities: nil),
            animated: true
        )
    }
}
