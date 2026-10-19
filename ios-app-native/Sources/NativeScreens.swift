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
    @EnvironmentObject private var inbox: NativeShareInbox
    @EnvironmentObject private var library: NativeReaderLibrary
    @Environment(\.scenePhase) private var scenePhase
    @StateObject private var sharedReadingSpeech = NativeReadingSpeech()
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

    // Una portada compacta y adaptable. ScrollView evita los márgenes y
    // alturas automáticas de List(.insetGrouped) en tamaños de accesibilidad.
    // No se limita Dynamic Type ni se cambia el recorrido de VoiceOver.
    private var brandHeader: some View {
        AnyLayout(
            dynamicTypeSize.isAccessibilitySize
                ? AnyLayout(VStackLayout(alignment: .leading, spacing: 8))
                : AnyLayout(HStackLayout(alignment: .center, spacing: 12))
        ) {
            NativeBrandMark()
                .frame(width: 48, height: 48)
            VStack(alignment: .leading, spacing: 4) {
                Text("TifloAcosta App")
                    .font(.title3.bold())
                    .accessibilityAddTraits(.isHeader)
                Text("Recursos de accesibilidad y tecnología, organizados para llegar a ellos sin perderse por el camino.")
                    .font(.subheadline)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .foregroundStyle(.white)
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: TifloVisual.cornerRadius)
                .fill(TifloVisual.brandDeepRed)
        )
    }

    private var searchPanel: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Buscar con TifloAcosta")
                .font(.headline)
                .foregroundStyle(TifloVisual.primaryText)
                .accessibilityAddTraits(.isHeader)

            AnyLayout(
                dynamicTypeSize.isAccessibilitySize
                    ? AnyLayout(VStackLayout(alignment: .leading, spacing: 10))
                    : AnyLayout(HStackLayout(alignment: .center, spacing: 10))
            ) {
                TextField("Introduce tu búsqueda", text: $searchText)
                    .textFieldStyle(.plain)
                    .font(.body)
                    .submitLabel(.search)
                    .textInputAutocapitalization(.sentences)
                    .onSubmit(search)
                    .padding(.horizontal, 14)
                    .frame(maxWidth: .infinity, minHeight: 48)
                    .background(
                        RoundedRectangle(cornerRadius: TifloVisual.controlCornerRadius)
                            .fill(TifloVisual.surfaceRaised)
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: TifloVisual.controlCornerRadius)
                            .strokeBorder(TifloVisual.border, lineWidth: 1)
                    )

                Button(action: search) {
                    Text("Buscar")
                        .font(.body.weight(.semibold))
                        .frame(minHeight: 48)
                        .padding(.horizontal, 12)
                }
                .buttonStyle(.borderedProminent)
                .tint(TifloVisual.brandRed)
                .disabled(searchText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
        }
    }

    private var destinationsPanel: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Secciones")
                .font(.headline)
                .foregroundStyle(TifloVisual.primaryText)
                .accessibilityAddTraits(.isHeader)

            LazyVStack(spacing: 0) {
                ForEach(NativeDestination.allCases) { destination in
                    NavigationLink(value: destination) {
                        HStack(spacing: 12) {
                            RoundedRectangle(cornerRadius: 2)
                                .fill(TifloVisual.brandRed)
                                .frame(width: 4, height: 28)
                                .accessibilityHidden(true)
                            Text(LocalizedStringKey(destination.rawValue))
                                .font(.body)
                                .foregroundStyle(.primary)
                                .fixedSize(horizontal: false, vertical: true)
                            Spacer(minLength: 8)
                            Image(systemName: "chevron.right")
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(TifloVisual.secondaryText)
                                .accessibilityHidden(true)
                        }
                        .frame(maxWidth: .infinity, minHeight: 48, alignment: .leading)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 6)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(Text(LocalizedStringKey(destination.rawValue)))

                    if destination != NativeDestination.allCases.last {
                        Divider()
                            .padding(.leading, 32)
                            .accessibilityHidden(true)
                    }
                }
            }
            .background(
                RoundedRectangle(cornerRadius: TifloVisual.cornerRadius)
                    .fill(TifloVisual.surfaceRaised)
            )
        }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: TifloVisual.sectionSpacing) {
                    brandHeader
                    searchPanel
                    destinationsPanel

                    if let error = catalog.error {
                        VStack(alignment: .leading, spacing: 8) {
                            Text(error).foregroundStyle(TifloVisual.secondaryText)
                            Button("Actualizar contenido") {
                                Task { await catalog.refresh() }
                            }
                        }
                    }
                }
                .frame(maxWidth: 680)
                .frame(maxWidth: .infinity)
                .padding(.horizontal, 16)
                .padding(.vertical, 16)
            }
            .background(TifloVisual.canvas)
            .tifloScreenSurface()
            .navigationTitle("Inicio")
            .navigationBarTitleDisplayMode(.inline)
            .navigationDestination(item: $inbox.readyToRead) { document in
                NativeReadingScreen(document: document, speech: sharedReadingSpeech)
            }
            .onAppear { inbox.importPendingReaderContent(into: library) }
            .onChange(of: scenePhase) { _, phase in
                if phase == .active {
                    inbox.importPendingReaderContent(into: library)
                }
            }
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
    @EnvironmentObject private var account: NativeYouTubeAccountStore
    @StateObject private var youtubeSearch = NativeYouTubeSearchStore()
    @State private var searchText = ""
    @State private var filterIndex = 0
    @State private var sortIndex = 0
    @State private var visibleCount = 10
    @State private var selectedVideo: NativeYouTubeVideo?
    @State private var commentingOnVideo: NativeYouTubeVideo?

    private let searchFilters = [
        "Todos", "Vídeos", "Canales", "Vídeos cortos, menos de cuatro minutos",
        "En directo", "Con subtítulos"
    ]
    private let filterValues = ["all", "video", "channel", "short", "live", "captions"]

    private var ordered: [NativeCatalogItem] {
        sortIndex == 0 ? catalog.videos : Array(catalog.videos.reversed())
    }

    private func search(loadMore: Bool = false) {
        let filter = filterValues[filterIndex]
        Task { await youtubeSearch.search(searchText, filter: filter, loadMore: loadMore) }
    }

    var body: some View {
        List {
            Section("YouTube accesible") {
                // La indicación del campo aparece una sola vez en VoiceOver.
                TextField("Buscar en todo YouTube", text: $searchText)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .submitLabel(.search)
                    .onSubmit { search() }
                NativeAdjustableChoice(
                    title: "Tipo de resultados",
                    choices: searchFilters,
                    selectedIndex: $filterIndex
                )
                Button("Buscar en YouTube") { search() }
                    .disabled(youtubeSearch.isLoading)
                if youtubeSearch.isLoading {
                    ProgressView("Buscando en YouTube")
                }
                if let message = youtubeSearch.message {
                    Text(message)
                        .font(.subheadline)
                        .foregroundStyle(TifloVisual.secondaryText)
                        .accessibilityAddTraits(.updatesFrequently)
                }
            }
            .listRowBackground(TifloVisual.surfaceRaised)

            if youtubeSearch.hasSearched {
                Section("Resultados de YouTube") {
                    ForEach(youtubeSearch.channels) { channel in
                        NavigationLink {
                            NativeYouTubeChannelVideosScreen(channel: channel)
                        } label: {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(channel.title).font(.headline)
                                Text("Canal de YouTube")
                                    .font(.subheadline)
                                    .foregroundStyle(TifloVisual.secondaryText)
                            }
                        }
                        .accessibilityElement(children: .ignore)
                        .accessibilityLabel("\(channel.title). Canal de YouTube")
                        .accessibilityHint("Doble toque para consultar sus vídeos en TifloAcosta.")
                        .accessibilityAction(named: Text("Compartir canal")) {
                            NativeShare.present(url: channel.url)
                        }
                    }
                    ForEach(youtubeSearch.videos) { video in
                        NativeYouTubeVideoRow(
                            video: video, onPlay: { selectedVideo = $0 },
                            onComment: { commentingOnVideo = $0 }
                        )
                    }
                    if !youtubeSearch.nextPageToken.isEmpty {
                        Button("Mostrar diez resultados más") { search(loadMore: true) }
                            .disabled(youtubeSearch.isLoading)
                    }
                }
                .listRowBackground(TifloVisual.surfaceRaised)
            }

            Section("Cuenta de YouTube") {
                NavigationLink("Mis suscripciones de YouTube") {
                    NativeYouTubeSubscriptionsScreen()
                }
                if !account.authenticated {
                    Text("Puedes buscar y reproducir sin iniciar sesión. Las suscripciones requieren acceso con Google.")
                        .font(.subheadline)
                        .foregroundStyle(TifloVisual.secondaryText)
                }
            }
            .listRowBackground(TifloVisual.surfaceRaised)

            Section {
                NativeAdjustableChoice(
                    title: "Orden",
                    choices: ["Más recientes primero", "Más antiguos primero"],
                    selectedIndex: $sortIndex
                )
            }
            .listRowBackground(TifloVisual.surfaceRaised)

            Section("Vídeos del canal TifloAcosta") {
                if ordered.isEmpty {
                    Text("No hay vídeos del canal disponibles.")
                        .foregroundStyle(TifloVisual.secondaryText)
                }
                ForEach(Array(ordered.prefix(visibleCount))) { item in
                    if let video = NativeYouTubeVideo(catalog: item) {
                        NativeYouTubeVideoRow(
                            video: video, onPlay: { selectedVideo = $0 },
                            onComment: { commentingOnVideo = $0 }
                        )
                        .accessibilityAction(named: Text(favorites.contains(.video, item: item)
                            ? "Quitar de favoritos" : "Añadir a favoritos")) {
                            _ = favorites.toggle(.video, item: item)
                        }
                    } else {
                        Text(item.title)
                            .foregroundStyle(TifloVisual.secondaryText)
                    }
                }
                if visibleCount < ordered.count {
                    Button("Mostrar diez más") { visibleCount += 10 }
                }
            }
            .listRowBackground(TifloVisual.surfaceRaised)
        }
        .tifloScreenSurface()
        .navigationTitle("Vídeos")
        .sheet(item: $selectedVideo) { video in
            NavigationStack { NativeYouTubePlayerScreen(video: video) }
        }
        .sheet(item: $commentingOnVideo) { video in
            NavigationStack { NativeYouTubeCommentScreen(video: video) }
        }
        .onChange(of: sortIndex) { _, _ in visibleCount = 10 }
    }
}

// Una sola definición de gestos para títulos en búsquedas, canal y suscripciones.
private struct NativeYouTubeTitleActions: ViewModifier {
    @EnvironmentObject private var account: NativeYouTubeAccountStore
    @Environment(\.openURL) private var openURL
    let video: NativeYouTubeVideo
    let onPlay: (NativeYouTubeVideo) -> Void
    let onComment: (NativeYouTubeVideo) -> Void

    @ViewBuilder func body(content: Content) -> some View {
        let basic = content
            .accessibilityAction(named: Text("Reproducir")) { onPlay(video) }
            .accessibilityAction(named: Text("Abrir en YouTube")) { openURL(video.url) }
            .accessibilityAction(named: Text("Compartir")) {
                NativeShare.present(url: video.url)
            }
        if account.authenticated {
            basic
                .accessibilityAction(named: Text("Me gusta")) {
                    Task { await account.setLiked(true, videoID: video.id) }
                }
                .accessibilityAction(named: Text("Quitar Me gusta")) {
                    Task { await account.setLiked(false, videoID: video.id) }
                }
                .accessibilityAction(named: Text("Suscribirse al canal")) {
                    Task { await account.setSubscribed(true, videoID: video.id) }
                }
                .accessibilityAction(named: Text("Cancelar suscripción al canal")) {
                    Task { await account.setSubscribed(false, videoID: video.id) }
                }
                .accessibilityAction(named: Text("Comentar")) { onComment(video) }
        } else {
            basic
                .accessibilityAction(named: Text("Iniciar sesión con Google")) {
                    account.signIn(videoID: video.id)
                }
        }
    }
}

private struct NativeYouTubeVideoRow: View {
    let video: NativeYouTubeVideo
    let onPlay: (NativeYouTubeVideo) -> Void
    let onComment: (NativeYouTubeVideo) -> Void

    var body: some View {
        Button { onPlay(video) } label: {
            VStack(alignment: .leading, spacing: 4) {
                Text(video.title).font(.headline)
                Text("Canal: \(video.channelTitle)")
                    .font(.subheadline)
                    .foregroundStyle(TifloVisual.secondaryText)
                if let date = NativeNewsMetadata.publication(video.publishedAt) {
                    Text("Publicado: \(date)")
                        .font(.subheadline)
                        .foregroundStyle(TifloVisual.secondaryText)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(video.title). Canal: \(video.channelTitle)")
        .accessibilityHint("Doble toque para reproducir. Desliza arriba o abajo para más acciones.")
        .modifier(NativeYouTubeTitleActions(
            video: video, onPlay: onPlay, onComment: onComment
        ))
    }
}

private struct NativeYouTubeCommentScreen: View {
    @EnvironmentObject private var account: NativeYouTubeAccountStore
    @Environment(\.dismiss) private var dismiss
    let video: NativeYouTubeVideo
    @State private var commentText = ""

    var body: some View {
        Form {
            Section("Comentario público") {
                Text(video.title)
                    .font(.headline)
                TextEditor(text: $commentText)
                    .frame(minHeight: 130)
                    .accessibilityLabel("Escribir comentario en YouTube")
            }
            .listRowBackground(TifloVisual.surfaceRaised)
            Button("Publicar comentario") {
                Task {
                    if await account.publishComment(commentText, videoID: video.id) {
                        dismiss()
                    }
                }
            }
            .disabled(!account.authenticated || account.busy ||
                      commentText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            if let message = account.message {
                Text(message).foregroundStyle(TifloVisual.secondaryText)
            }
        }
        .tifloScreenSurface()
        .navigationTitle("Comentar en YouTube")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button("Cancelar") { dismiss() }
            }
        }
    }
}

private struct NativeYouTubeSubscriptionsScreen: View {
    @EnvironmentObject private var account: NativeYouTubeAccountStore

    var body: some View {
        List {
            if !account.authenticated {
                Section {
                    Text("Inicia sesión con Google para consultar los canales a los que estás suscrito.")
                    Button("Iniciar sesión con Google") { account.signIn() }
                        .disabled(account.busy)
                }
                .listRowBackground(TifloVisual.surfaceRaised)
            } else {
                Section("Canales a los que estás suscrito") {
                    ForEach(account.subscriptions) { channel in
                        NavigationLink {
                            NativeYouTubeChannelVideosScreen(channel: channel)
                        } label: {
                            Text(channel.title).font(.headline)
                        }
                        .accessibilityAction(named: Text("Compartir canal")) {
                            NativeShare.present(url: channel.url)
                        }
                    }
                    if !account.subscriptionsNextPageToken.isEmpty {
                        Button("Mostrar diez canales más") {
                            Task { await account.loadSubscriptions(loadMore: true) }
                        }
                        .disabled(account.subscriptionsBusy)
                    }
                    if account.subscriptionsBusy {
                        ProgressView("Cargando suscripciones")
                    }
                    if let message = account.subscriptionsMessage {
                        Text(message).foregroundStyle(TifloVisual.secondaryText)
                        Button("Reintentar") {
                            Task { await account.loadSubscriptions() }
                        }
                    }
                }
                .listRowBackground(TifloVisual.surfaceRaised)
            }
        }
        .tifloScreenSurface()
        .navigationTitle("Mis suscripciones")
        .task(id: account.authenticated) {
            if account.authenticated {
                await account.verifySession()
                if account.authenticated { await account.loadSubscriptions() }
            }
        }
    }
}

private struct NativeYouTubeChannelVideosScreen: View {
    let channel: NativeYouTubeChannel
    @StateObject private var youtubeSearch = NativeYouTubeSearchStore()
    @State private var selectedVideo: NativeYouTubeVideo?
    @State private var commentingOnVideo: NativeYouTubeVideo?

    var body: some View {
        List {
            Section("Vídeos del canal") {
                if youtubeSearch.isLoading {
                    ProgressView("Cargando vídeos")
                }
                if let message = youtubeSearch.message {
                    Text(message)
                        .font(.subheadline)
                        .foregroundStyle(TifloVisual.secondaryText)
                }
                ForEach(youtubeSearch.videos) { video in
                    NativeYouTubeVideoRow(
                        video: video, onPlay: { selectedVideo = $0 },
                        onComment: { commentingOnVideo = $0 }
                    )
                }
                if !youtubeSearch.nextPageToken.isEmpty {
                    Button("Mostrar diez vídeos más") {
                        Task { await youtubeSearch.search(
                            "", channelID: channel.id, loadMore: true
                        ) }
                    }
                    .disabled(youtubeSearch.isLoading)
                }
            }
            .listRowBackground(TifloVisual.surfaceRaised)
        }
        .tifloScreenSurface()
        .navigationTitle(channel.title)
        .sheet(item: $selectedVideo) { video in
            NavigationStack { NativeYouTubePlayerScreen(video: video) }
        }
        .sheet(item: $commentingOnVideo) { video in
            NavigationStack { NativeYouTubeCommentScreen(video: video) }
        }
        .task(id: channel.id) {
            await youtubeSearch.search("", channelID: channel.id)
        }
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
