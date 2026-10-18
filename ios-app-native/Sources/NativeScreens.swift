import SwiftUI
import UIKit

// Orden acordado de la portada TifloAcosta, con navegación SwiftUI.
private enum NativeDestination: String, CaseIterable, Hashable, Identifiable {
    case actualidad = "Actualidad"
    case recursos = "Recursos"
    case tifloLector = "TifloLector"
    case recibidos = "Recibidos"
    case novedades = "Novedades"
    case descargas = "Descargar desde un enlace"
    case favoritos = "Favoritos"
    case videos = "Vídeos"
    case podcasts = "Podcast"
    case libro = "Mi libro"
    case contacto = "Contacto y redes"
    case privacidad = "Privacidad y accesibilidad"
    case configuracion = "Configuración"

    var id: String { rawValue }
}

private enum NativeHomePalette {
    static let red = Color(red: 166.0 / 255.0, green: 27.0 / 255.0, blue: 27.0 / 255.0)
    static let deepRed = Color(red: 127.0 / 255.0, green: 20.0 / 255.0, blue: 20.0 / 255.0)
}

struct NativeHomeScreen: View {
    @EnvironmentObject private var catalog: NativeCatalogStore
    @State private var searchText = ""
    @State private var submittedSearch = ""
    @State private var showingSearch = false

    private func search() {
        let term = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !term.isEmpty else { return }
        submittedSearch = term
        showingSearch = true
    }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("TifloAcosta App")
                            .font(.title2.bold())
                            .accessibilityAddTraits(.isHeader)
                        Text("Recursos de accesibilidad y tecnología, organizados para llegar a ellos sin perderse por el camino.")
                            .font(.subheadline)
                    }
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(16)
                    .background(
                        RoundedRectangle(cornerRadius: 14).fill(NativeHomePalette.deepRed)
                    )
                    .listRowInsets(EdgeInsets(top: 8, leading: 16, bottom: 8, trailing: 16))
                    .listRowBackground(Color.clear)
                }

                Section("Buscar con TifloAcosta") {
                    TextField("Introduce tu búsqueda", text: $searchText)
                        .submitLabel(.search)
                        .textInputAutocapitalization(.sentences)
                        .onSubmit(search)
                        .accessibilityLabel("Introduce tu búsqueda")
                    Button(action: search) {
                        Text("Buscar")
                            .frame(maxWidth: .infinity, minHeight: 44)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(NativeHomePalette.red)
                    .disabled(searchText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }

                Section("Secciones") {
                    ForEach(NativeDestination.allCases) { destination in
                        NavigationLink(value: destination) {
                            HStack(spacing: 12) {
                                RoundedRectangle(cornerRadius: 2)
                                    .fill(NativeHomePalette.red)
                                    .frame(width: 4, height: 30)
                                    .accessibilityHidden(true)
                                Text(destination.rawValue)
                                    .font(.body)
                                    .foregroundStyle(.primary)
                            }
                            .frame(maxWidth: .infinity, minHeight: 48, alignment: .leading)
                        }
                        .accessibilityLabel(destination.rawValue)
                    }
                }

                if let error = catalog.error {
                    Section {
                        Text(error).foregroundStyle(.secondary)
                        Button("Actualizar contenido") {
                            Task { await catalog.refresh() }
                        }
                    }
                }
            }
            .listStyle(.insetGrouped)
            .scrollContentBackground(.hidden)
            .background(Color(uiColor: .systemGroupedBackground))
            .navigationTitle("Inicio")
            .navigationBarTitleDisplayMode(.inline)
            .navigationDestination(isPresented: $showingSearch) {
                NativeSearchResultsScreen(query: submittedSearch)
            }
            .navigationDestination(for: NativeDestination.self) { destination in
                switch destination {
                case .actualidad: NativeNewsScreen()
                case .recursos: NativeResourcesScreen()
                case .tifloLector: NativeReaderLibraryScreen()
                case .recibidos: NativeInboxScreen()
                case .novedades: NativeUpdatesScreen()
                case .descargas: NativeDownloadsScreen()
                case .videos: NativeVideosScreen()
                case .podcasts: NativePodcastScreen()
                case .configuracion: NativeSettingsScreen()
                case .favoritos, .libro, .contacto, .privacidad:
                    NativePendingSectionScreen(title: destination.rawValue)
                }
            }
        }
    }
}

private struct NativePendingSectionScreen: View {
    let title: String

    var body: some View {
        ContentUnavailableView(
            "Sección en preparación",
            systemImage: "square.stack",
            description: Text("La versión nativa de esta sección todavía no está terminada.")
        )
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.inline)
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
                    NavigationLink {
                        NativeRemoteResourceScreen(item: item)
                    } label: {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(item.title).font(.body)
                            if let category = item.category {
                                Text(category).font(.caption).foregroundStyle(.secondary)
                            }
                        }
                    }
                    .accessibilityLabel(item.title)
                    .accessibilityHint("Doble toque para leer el recurso dentro de TifloAcosta.")
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
