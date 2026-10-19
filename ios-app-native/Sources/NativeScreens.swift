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
    case contacto = "Contacto y redes"
    case privacidad = "Privacidad y accesibilidad"
    case configuracion = "Configuración"

    var id: String { rawValue }
}

// Símbolo dibujado con trazos nativos, siguiendo las proporciones del
// emblema vectorial oficial, sin cargar imágenes web ni introducir WebView.
private struct NativeBrandMark: View {
    var body: some View {
        Canvas { context, size in
            let factor = min(size.width, size.height) / 290.88
            context.scaleBy(x: factor, y: factor)

            var glyph = Path()
            glyph.addRect(CGRect(x: 32.0832, y: 63.9936, width: 139.392, height: 32.9472))
            glyph.addRect(CGRect(x: 70.0992, y: 86.8032, width: 35.4816, height: 136.8576))
            glyph.move(to: CGPoint(x: 95.4432, y: 223.6608))
            glyph.addLine(to: CGPoint(x: 130.9248, y: 223.6608))
            glyph.addLine(to: CGPoint(x: 166.4064, y: 96.9408))
            glyph.addLine(to: CGPoint(x: 146.1312, y: 96.9408))
            glyph.closeSubpath()
            glyph.move(to: CGPoint(x: 166.4064, y: 96.9408))
            glyph.addLine(to: CGPoint(x: 227.232, y: 223.6608))
            glyph.addLine(to: CGPoint(x: 189.216, y: 223.6608))
            glyph.addLine(to: CGPoint(x: 156.2688, y: 140.0256))
            glyph.closeSubpath()
            glyph.addRect(CGRect(x: 130.9248, y: 167.904, width: 58.2912, height: 20.2752))
            context.fill(glyph, with: .color(.white))

            // Ondas curvas del emblema; el trazado queda dentro de Canvas.
            for (radius, color) in [
                (71.0, TifloVisual.brandMarkHighlight),
                (51.0, Color.white),
                (32.0, TifloVisual.brandMarkHighlight)
            ] {
                var wave = Path()
                wave.addArc(
                    center: CGPoint(x: 151, y: 101),
                    radius: radius,
                    startAngle: .degrees(-78),
                    endAngle: .degrees(-7),
                    clockwise: false
                )
                context.stroke(wave, with: .color(color), lineWidth: 12)
            }
        }
        .accessibilityHidden(true)
    }
}

struct NativeHomeScreen: View {
    @EnvironmentObject private var catalog: NativeCatalogStore
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
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
                    AnyLayout(
                        dynamicTypeSize.isAccessibilitySize
                            ? AnyLayout(VStackLayout(alignment: .leading, spacing: 8))
                            : AnyLayout(HStackLayout(alignment: .center, spacing: 12))
                    ) {
                        NativeBrandMark()
                            .frame(width: 56, height: 56)
                        VStack(alignment: .leading, spacing: 6) {
                            Text("TifloAcosta App")
                                .font(.title2.bold())
                                .accessibilityAddTraits(.isHeader)
                            Text("Recursos de accesibilidad y tecnología, organizados para llegar a ellos sin perderse por el camino.")
                                .font(.subheadline)
                        }
                    }
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(16)
                    .background(
                        RoundedRectangle(cornerRadius: TifloVisual.cornerRadius).fill(TifloVisual.brandDeepRed)
                    )
                    .listRowInsets(EdgeInsets(top: 8, leading: 16, bottom: 8, trailing: 16))
                    .listRowBackground(Color.clear)
                }

                Section("Buscar con TifloAcosta") {
                    TextField("Introduce tu búsqueda", text: $searchText)
                        .submitLabel(.search)
                        .textInputAutocapitalization(.sentences)
                        .onSubmit(search)
                    Button(action: search) {
                        Text("Buscar")
                            .frame(maxWidth: .infinity, minHeight: 44)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(TifloVisual.brandRed)
                    .disabled(searchText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
                .listRowBackground(TifloVisual.surfaceRaised)

                Section("Secciones") {
                    ForEach(NativeDestination.allCases) { destination in
                        NavigationLink(value: destination) {
                            HStack(spacing: 12) {
                                RoundedRectangle(cornerRadius: 2)
                                    .fill(TifloVisual.brandRed)
                                    .frame(width: 4, height: 30)
                                    .accessibilityHidden(true)
                                Text(LocalizedStringKey(destination.rawValue))
                                    .font(.body)
                                    .foregroundStyle(.primary)
                            }
                            .frame(maxWidth: .infinity, minHeight: 48, alignment: .leading)
                        }
                        .accessibilityLabel(Text(LocalizedStringKey(destination.rawValue)))
                    }
                }
                .listRowBackground(TifloVisual.surfaceRaised)

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
            .background(TifloVisual.canvas)
            .tifloScreenSurface()
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
                case .contacto: NativeContactScreen()
                case .favoritos: NativeFavoritesScreen()
                case .privacidad: NativePrivacyAccessibilityScreen()
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
        .tifloScreenSurface()
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
                    Text(LocalizedStringKey(title))
                        .font(.subheadline)
                        .foregroundStyle(TifloVisual.secondaryText)
                    Text(LocalizedStringKey(currentValue))
                        .font(.body).bold()
                        .foregroundStyle(TifloVisual.primaryText)
                }
                Spacer()
                Image(systemName: "arrow.up.arrow.down")
                    .foregroundStyle(TifloVisual.actionTint)
                    .accessibilityHidden(true)
            }
            .frame(minHeight: 44)
        }
        .disabled(choices.isEmpty)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text(LocalizedStringKey(title)))
        .accessibilityValue(Text(LocalizedStringKey(currentValue)))
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
    @EnvironmentObject private var library: NativeReaderLibrary
    @EnvironmentObject private var resourceService: NativeResourceService
    @EnvironmentObject private var favorites: NativeFavoritesStore
    @AppStorage("native-ios-language") private var languageIndex = 0
    @State private var chosenCategory: String?
    @State private var resourceToOpen: NativeCatalogItem?
    @State private var presentingResource = false
    @State private var actionStatus: String?

    private var spanishResources: [NativeCatalogItem] {
        catalog.resources.filter { $0.lang == (languageIndex == 1 ? "en" : "es") }
    }

    private var categories: [String] {
        Array(Set(spanishResources.compactMap(\.category))).sorted {
            $0.localizedStandardCompare($1) == .orderedAscending
        }
    }

    private var categoryChoices: [String] {
        ["Selecciona un apartado"] + categories
    }

    // Preserve the native adjustable selector and its currently chosen category.
    private var categorySelection: Binding<Int> {
        Binding(
            get: {
                guard let chosenCategory else { return 0 }
                return categoryChoices.firstIndex(of: chosenCategory) ?? 0
            },
            set: { index in
                chosenCategory = index > 0 && categoryChoices.indices.contains(index)
                    ? categoryChoices[index]
                    : nil
            }
        )
    }

    private var filtered: [NativeCatalogItem] {
        guard let chosenCategory, categories.contains(chosenCategory) else {
            return []
        }
        return spanishResources.filter { $0.category == chosenCategory }
    }

    private func announce(_ message: String) {
        actionStatus = message
        UIAccessibility.post(notification: .announcement, argument: message)
    }

    private func read(_ item: NativeCatalogItem) {
        resourceToOpen = item
        presentingResource = true
    }

    private func save(_ item: NativeCatalogItem) {
        Task {
            do {
                try await resourceService.saveInReader(item, library: library)
                announce("«\(item.title)» guardado en TifloLector.")
            } catch {
                announce("No se pudo guardar «\(item.title)»: \(error.localizedDescription)")
            }
        }
    }

    private func download(_ item: NativeCatalogItem) {
        Task {
            do {
                try await resourceService.exportToFiles(item)
                announce("Selecciona una carpeta en Archivos para descargar «\(item.title)».")
            } catch {
                announce("No se pudo descargar «\(item.title)»: \(error.localizedDescription)")
            }
        }
    }

    var body: some View {
        List {
            Section {
                NativeAdjustableChoice(
                    title: "Categoría",
                    choices: categoryChoices,
                    selectedIndex: categorySelection
                )
            }

            if let chosenCategory, categories.contains(chosenCategory) {
                Section(chosenCategory) {
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
                        .accessibilityHint("Doble toque para leer. Acciones: Leer, Guardar, Descargar y Compartir.")
                        .accessibilityAction(named: Text("Leer")) { read(item) }
                        .accessibilityAction(named: Text("Guardar")) { save(item) }
                        .accessibilityAction(named: Text("Descargar")) { download(item) }
                        .accessibilityAction(named: Text("Compartir")) {
                            if let url = item.resourceURL { NativeShare.present(url: url) }
                        }
                        .accessibilityAction(named: Text(favorites.contains(.resource, item: item)
                            ? "Quitar de favoritos" : "Añadir a favoritos")) {
                            let added = favorites.toggle(.resource, item: item)
                            announce(added ? "Añadido a Favoritos" : "Eliminado de Favoritos")
                        }
                    }
                }
            }
            if let actionStatus {
                Section {
                    Text(actionStatus)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .tifloScreenSurface()
        .navigationTitle("Recursos")
        .navigationDestination(isPresented: $presentingResource) {
            if let resourceToOpen {
                NativeRemoteResourceScreen(item: resourceToOpen)
            }
        }
    }
}

struct NativeVideosScreen: View {
    @EnvironmentObject private var catalog: NativeCatalogStore
    @EnvironmentObject private var favorites: NativeFavoritesStore
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
                    .accessibilityAction(named: Text(favorites.contains(.video, item: item)
                        ? "Quitar de favoritos" : "Añadir a favoritos")) {
                        _ = favorites.toggle(.video, item: item)
                    }
                }

                if visibleCount < ordered.count {
                    Button("Mostrar diez más") { visibleCount += 10 }
                }
            }
        }
        .tifloScreenSurface()
        .navigationTitle("Vídeos")
        .searchable(text: $query, prompt: "Buscar en los vídeos del canal")
        .onChange(of: query) { _, _ in visibleCount = 10 }
        .onChange(of: sortIndex) { _, _ in visibleCount = 10 }
    }
}

// Actualidad con filtros y VoiceOver se mantiene en NativeNews.swift.

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
