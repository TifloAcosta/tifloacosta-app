import SwiftUI
import UIKit
import Combine

// Orden acordado de la portada TifloAcosta, con navegación SwiftUI.
private enum NativeDestination: String, CaseIterable, Hashable, Identifiable {
    case actualidad = "Actualidad"
    case recursos = "Recursos"
    case tifloLector = "TifloLector"
    case miMusica = "Mi Música"
    case multicines = "Multicines Accesibles"
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
    @EnvironmentObject private var podcastPlayer: NativePodcastPlayer
    @EnvironmentObject private var podcastLibrary: NativePodcastLibrary
    @EnvironmentObject private var podcastDownloads: NativePodcastDownloads
    @EnvironmentObject private var favorites: NativeFavoritesStore
    @EnvironmentObject private var readingActivity: NativeReadingActivity
    @ObservedObject private var backups = NativeBackupCoordinator.shared
    @Environment(\.scenePhase) private var scenePhase
    @StateObject private var sharedReadingSpeech = NativeReadingSpeech()
    @EnvironmentObject private var catalog: NativeCatalogStore
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @AppStorage("native-ios-language") private var languageIndex = 0
    @State private var searchText = ""
    @State private var submittedSearch = ""
    @State private var showingSearch = false
    @State private var navigationPath = NavigationPath()
    @State private var podcastScreenVisible = false
    @State private var lastPodcastProgressEpisodeID = ""
    @State private var lastPodcastProgressSeconds = 0.0

    private func processSharedContent() {
        guard !backups.blocksExternalActions else { return }
        let receivedMusic = inbox.importPendingMusicContent()
        Task {
            guard !backups.blocksExternalActions else { return }
            await inbox.importPendingReaderContent(into: library)
            if receivedMusic && inbox.readyToRead == nil {
                navigationPath = NavigationPath()
                navigationPath.append(NativeDestination.miMusica)
            }
        }
    }

    private func openRequestedShortcut() {
        guard !backups.blocksExternalActions else { return }
        let defaults = UserDefaults.standard
        guard let route = defaults.string(forKey: NativeShortcutRoute.key) else { return }
        let destination: NativeDestination?
        switch route {
        case "actualidad": destination = .actualidad
        case "tifloLector": destination = .tifloLector
        case "createBookmark":
            // Preserve the current reader screen and its playback position.
            defaults.removeObject(forKey: NativeShortcutRoute.key)
            NativeQuickBookmarkBridge.save()
            return
        case "resumeReader":
            // The library consumes this request after it has opened.
            defaults.set(true, forKey: "native-ios-resume-last-book-shortcut-v1")
            destination = .tifloLector
        case "videos": destination = .videos
        case "miMusica": destination = .miMusica
        default: destination = nil
        }
        defaults.removeObject(forKey: NativeShortcutRoute.key)
        guard let destination else { return }
        navigationPath = NavigationPath()
        navigationPath.append(destination)
    }

    private var automaticBackupEligible: Bool {
        scenePhase == .active && navigationPath.isEmpty && !showingSearch &&
            !backups.isManagingBackups && !backups.requiresRecovery &&
            inbox.readyForBackupManagement && podcastPlayer.episode == nil
    }

    private func runAutomaticBackupChecks() async {
        while automaticBackupEligible && !Task.isCancelled {
            do {
                let result = try await backups.runAutomaticBackupIfDue(reader: library,
                    podcastLibrary: podcastLibrary, podcastDownloads: podcastDownloads,
                    favorites: favorites, activity: readingActivity,
                    canCollectSnapshot: { automaticBackupEligible && !Task.isCancelled })
                backups.recordAutomaticNotice(result)
            } catch is CancellationError {
                return
            } catch {
                if !Task.isCancelled { backups.recordAutomaticFailure() }
            }
            do { try await Task.sleep(nanoseconds: 60_000_000_000) }
            catch { return }
        }
    }

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
            TextField("Buscar con TifloAcosta", text: $searchText)
                .textFieldStyle(.plain)
                .font(.body)
                .submitLabel(.search)
                .textInputAutocapitalization(.sentences)
                .onSubmit(search)
                .accessibilityLabel(Text("Buscar con TifloAcosta"))
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

            if !searchText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                Button("Buscar", action: search)
                    .buttonStyle(.borderedProminent)
                    .tint(TifloVisual.brandRed)
                    .frame(minHeight: 48)
            }
        }
    }

    private var guidePanel: some View {
        NavigationLink {
            NativeUsageGuideScreen()
        } label: {
            HStack(spacing: 12) {
                RoundedRectangle(cornerRadius: 2)
                    .fill(TifloVisual.brandRed)
                    .frame(width: 4, height: 28)
                    .accessibilityHidden(true)
                Text(LocalizedStringKey("Guía de uso"))
                    .font(.body.weight(.semibold))
                    .foregroundStyle(TifloVisual.primaryText)
                    .fixedSize(horizontal: false, vertical: true)
                Spacer(minLength: 8)
                Image(systemName: "chevron.right")
                    .foregroundStyle(TifloVisual.secondaryText)
                    .accessibilityHidden(true)
            }
            .frame(maxWidth: .infinity, minHeight: 48, alignment: .leading)
            .padding(16)
            .background(
                RoundedRectangle(cornerRadius: TifloVisual.cornerRadius)
                    .fill(TifloVisual.surfaceRaised)
            )
        }
        .buttonStyle(.plain)
        .accessibilityLabel(Text(LocalizedStringKey("Guía de uso")))
        .accessibilityHint(Text(LocalizedStringKey("Instrucciones para utilizar cada sección de TifloAcosta.")))
    }

    private var destinationsPanel: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Secciones")
                .font(.headline)
                .foregroundStyle(TifloVisual.primaryText)
                .accessibilityAddTraits(.isHeader)

            LazyVStack(spacing: 0) {
                ForEach(NativeDestination.allCases.filter { $0 != .privacidad && $0 != .contacto && $0 != .recibidos }) { destination in
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
                    .accessibilityIdentifier("tiflo.home." + destination.rawValue)

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

    private func closePodcastPlayback() {
        podcastPlayer.updatePosition()
        if let episode = podcastPlayer.episode {
            podcastLibrary.remember(episode, seconds: podcastPlayer.seconds,
                                    duration: podcastPlayer.duration)
        }
        podcastPlayer.stop()
    }

    private var persistentPodcastControls: some View {
        VStack(alignment: .leading, spacing: 6) {
            if let episode = podcastPlayer.episode {
                Text(MusicLocalized.format("Escuchando en TifloAcosta: %@", episode.title))
                    .font(.subheadline.weight(.semibold))
                    .lineLimit(1)
                    .accessibilityLabel(MusicLocalized.format("Pódcast en reproducción: %@", episode.title))
                HStack(spacing: 12) {
                    Button(MusicLocalized.message(podcastPlayer.isPlaying ? "Pausar" : "Reproducir")) {
                        podcastPlayer.toggle()
                    }
                    Button("Retroceder 30 segundos") { podcastPlayer.skip(-30) }
                    Button("Avanzar 30 segundos") { podcastPlayer.skip(30) }
                    Button("Cerrar reproductor") { closePodcastPlayback() }
                }
                .buttonStyle(.bordered)
                .controlSize(.small)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(TifloVisual.surfaceRaised)
        .accessibilityElement(children: .contain)
    }

    var body: some View {
        NavigationStack(path: $navigationPath) {
            ScrollView {
                VStack(alignment: .leading, spacing: TifloVisual.sectionSpacing) {
                    brandHeader
                    searchPanel
                    guidePanel
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
            .safeAreaInset(edge: .bottom) {
                if let progress = inbox.readerImportProgress {
                    ProgressView {
                        Text(progress)
                    }
                    .padding()
                    .frame(maxWidth: .infinity)
                    .background(.regularMaterial)
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .navigationDestination(item: $inbox.readyToRead) { document in
                NativeReadingScreen(document: document, speech: sharedReadingSpeech)
            }
            .onAppear {
                processSharedContent()
                openRequestedShortcut()
            }
            .onReceive(NotificationCenter.default.publisher(for: .nativeShortcutRouteRequested)) { _ in
                openRequestedShortcut()
            }
            .onChange(of: scenePhase) { _, phase in
                if phase == .active {
                    processSharedContent()
                    openRequestedShortcut()
                }
            }
            .onChange(of: backups.blocksExternalActions) { _, blocked in
                if !blocked && scenePhase == .active {
                    processSharedContent()
                    openRequestedShortcut()
                }
            }
            .task(id: automaticBackupEligible) {
                if automaticBackupEligible { await runAutomaticBackupChecks() }
            }
            .navigationDestination(isPresented: $showingSearch) {
                NativeSearchResultsScreen(query: submittedSearch)
            }
            .navigationDestination(for: NativeDestination.self) { destination in
                switch destination {
                case .actualidad: NativeNewsScreen()
                case .recursos: NativeResourcesScreen()
                case .tifloLector: NativeReaderLibraryScreen()
                case .miMusica: NativeMyMusicScreen()
                case .multicines: NativeAccessibleCinemaScreen()
                case .recibidos: NativeInboxScreen()
                case .novedades: NativeUpdatesScreen()
                case .descargas: NativeDownloadsScreen()
                case .videos: NativeVideosScreen()
                case .podcasts: NativePodcastScreen()
                    .onAppear { podcastScreenVisible = true }
                    .onDisappear { podcastScreenVisible = false }
                case .configuracion: NativeSettingsScreen()
                case .contacto: NativeContactScreen()
                case .favoritos: NativeFavoritesScreen()
                case .privacidad: NativePrivacyAccessibilityScreen()
                }
            }
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            if podcastPlayer.episode != nil && !podcastScreenVisible && !backups.isManagingBackups {
                persistentPodcastControls
            }
        }
        .onAppear {
            podcastPlayer.resolveAudioURL = { episode in
                podcastDownloads.localURL(for: episode.id)
            }
            podcastPlayer.onEpisodeFinished = { completed in
                podcastLibrary.clearProgress(for: completed)
            }
        }
        .onReceive(Timer.publish(every: 5, on: .main, in: .common).autoconnect()) { _ in
            guard !backups.isRestoring, !backups.requiresRecovery else { return }
            guard let episode = podcastPlayer.episode else {
                lastPodcastProgressEpisodeID = ""
                lastPodcastProgressSeconds = 0
                return
            }
            podcastPlayer.updatePosition()
            guard podcastPlayer.duration > 0 else { return }
            if episode.id != lastPodcastProgressEpisodeID ||
               abs(podcastPlayer.seconds - lastPodcastProgressSeconds) >= 10 {
                podcastLibrary.remember(episode, seconds: podcastPlayer.seconds,
                                        duration: podcastPlayer.duration)
                lastPodcastProgressEpisodeID = episode.id
                lastPodcastProgressSeconds = podcastPlayer.seconds
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
            HStack(alignment: .center, spacing: 12) {
                RoundedRectangle(cornerRadius: 3)
                    .fill(TifloVisual.actionTint)
                    .frame(width: 4, height: 46)
                    .accessibilityHidden(true)

                VStack(alignment: .leading, spacing: 7) {
                    Text(LocalizedStringKey(title))
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(TifloVisual.actionTint)
                    Text(LocalizedStringKey(currentValue))
                        .font(.body.weight(.semibold))
                        .foregroundStyle(TifloVisual.primaryText)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(
                            RoundedRectangle(cornerRadius: 8)
                                .fill(TifloVisual.surface)
                        )
                        .overlay(
                            RoundedRectangle(cornerRadius: 8)
                                .strokeBorder(TifloVisual.border, lineWidth: 1)
                        )
                }
                Spacer(minLength: 4)
                Image(systemName: "arrow.up.arrow.down.circle.fill")
                    .font(.title3)
                    .foregroundStyle(TifloVisual.actionTint)
                    .accessibilityHidden(true)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .frame(maxWidth: .infinity, minHeight: 68, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: TifloVisual.controlCornerRadius)
                    .fill(TifloVisual.selectorSurface)
            )
            .overlay(
                RoundedRectangle(cornerRadius: TifloVisual.controlCornerRadius)
                    .strokeBorder(TifloVisual.selectorBorder, lineWidth: 1.5)
            )
            .contentShape(RoundedRectangle(cornerRadius: TifloVisual.controlCornerRadius))
        }
        .buttonStyle(.plain)
        .disabled(choices.isEmpty)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text(LocalizedStringKey(title)))
        .accessibilityValue(Text(LocalizedStringKey(currentValue)))
        .accessibilityAdjustableAction { direction in
            switch direction {
            case .increment: advance(1)
            case .decrement: advance(-1)
            @unknown default: break
            }
        }
    }
}

/// A folder is derived from the relative path of published documents, not
/// from its name or title. Direct documents and folders remain separate.
private struct NativeResourceFolderRows<Row: View>: View {
    let items: [NativeCatalogItem]
    let path: [String]
    let row: (NativeCatalogItem) -> Row

    private var directItems: [NativeCatalogItem] {
        items.filter { $0.resourceFolderPath == path }
    }

    private var childFolders: [String] {
        Set(items.compactMap { item -> String? in
            let components = item.resourceFolderPath
            guard components.count > path.count,
                  Array(components.prefix(path.count)) == path else { return nil }
            return components[path.count]
        }).sorted { $0.localizedStandardCompare($1) == .orderedAscending }
    }

    var body: some View {
        ForEach(childFolders, id: \.self) { folder in
            NavigationLink {
                NativeResourceFolderScreen(items: items, path: path + [folder], row: row)
            } label: {
                Label(folder, systemImage: "folder")
            }
        }
        ForEach(directItems) { item in
            row(item)
        }
    }
}

private struct NativeResourceFolderScreen<Row: View>: View {
    let items: [NativeCatalogItem]
    let path: [String]
    let row: (NativeCatalogItem) -> Row
    @State private var query = ""

    private var descendants: [NativeCatalogItem] {
        items.filter { Array($0.resourceFolderPath.prefix(path.count)) == path }
    }

    var body: some View {
        List {
            if query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                NativeResourceFolderRows(items: descendants, path: path, row: row)
            } else {
                ForEach(descendants.filter { $0.matchesResourceQuery(query) }) { item in
                    row(item)
                }
            }
        }
        .tifloScreenSurface()
        .navigationTitle(path.last ?? "")
        .searchable(text: $query, prompt: "Buscar recursos")
    }
}

struct NativeResourcesScreen: View {
    @EnvironmentObject private var catalog: NativeCatalogStore
    @EnvironmentObject private var library: NativeReaderLibrary
    @EnvironmentObject private var resourceService: NativeResourceService
    @EnvironmentObject private var favorites: NativeFavoritesStore
    @EnvironmentObject private var readingActivity: NativeReadingActivity
    @AppStorage("native-ios-language") private var languageIndex = 0
    @State private var chosenCategory: String?
    @State private var languageFilterIndex = 0
    @State private var resourceQuery = ""
    @State private var resourceToOpen: NativeCatalogItem?
    @State private var presentingResource = false
    @State private var actionStatus: String?
    @State private var offlineTask: Task<Void, Never>?
    @State private var offlineProgress: String?

    private var spanishResources: [NativeCatalogItem] {
        catalog.resources.filter { item in
            switch languageFilterIndex {
            case 1: return true
            case 2: return item.lang == "es"
            case 3: return item.lang == "en"
            case 4: return item.lang == "pt"
            case 5: return item.lang == "fr"
            case 6: return item.lang == "it"
            case 7: return item.lang == "de"
            default: return languageIndex > 1 || item.lang == NativeAppLanguage.code(for: languageIndex)
            }
        }
    }

    private var categories: [String] {
        Array(Set(spanishResources.compactMap(\.category))).sorted {
            $0.localizedStandardCompare($1) == .orderedAscending
        }
    }

    private var categoryChoices: [String] {
        ["Selecciona un apartado"] + categories
    }

    // Píldoras use dates for 2024/2025 and edition numbers for 2026.
    private var isPillsCategory: Bool {
        chosenCategory == "Píldoras" || chosenCategory == "Pills"
    }

    private func metadataYear(for item: NativeCatalogItem) -> Int? {
        for value in [item.id, item.openUrl ?? "", item.url ?? "",
                      item.publishedAt ?? ""] {
            let parts = value.components(separatedBy: CharacterSet.decimalDigits.inverted)
            for part in parts where part.count == 4 {
                if let year = Int(part), (2000...2100).contains(year) { return year }
            }
        }
        return nil
    }

    private func pillEditionNumber(_ item: NativeCatalogItem) -> Int? {
        let parts = item.title.components(
            separatedBy: CharacterSet.decimalDigits.inverted).filter { !$0.isEmpty }
        guard let value = parts.last, value.count <= 3 else { return nil }
        return Int(value)
    }

    private func pillsYear(for item: NativeCatalogItem) -> Int? {
        if let year = metadataYear(for: item) { return year }
        // A few legacy translated records have opaque IDs. Infer the year
        // only from an unambiguous dated counterpart of the same edition.
        guard let edition = pillEditionNumber(item) else { return nil }
        let candidates = Set(catalog.resources.filter {
            ($0.category == "Píldoras" || $0.category == "Pills") &&
                pillEditionNumber($0) == edition
        }.compactMap { metadataYear(for: $0) })
        return candidates.count == 1 ? candidates.first : nil
    }

    private var pillsYears: [Int] {
        Array(Set(filtered.compactMap { pillsYear(for: $0) })).sorted(by: >)
    }

    private func pillsOrder(_ item: NativeCatalogItem, year: Int) -> Int {
        let fields = item.id.split(separator: "-").map(String.init)
        if let index = fields.firstIndex(of: String(year)),
           index + 2 < fields.count,
           let month = Int(fields[index + 1]),
           let day = Int(fields[index + 2]),
           (1...12).contains(month), (1...31).contains(day) {
            return month * 100 + day
        }
        return pillEditionNumber(item) ?? 0
    }

    private func pillsForYear(_ year: Int) -> [NativeCatalogItem] {
        filtered.filter { pillsYear(for: $0) == year }
            .sorted {
                let first = pillsOrder($0, year: year)
                let second = pillsOrder($1, year: year)
                return first == second
                    ? $0.title.localizedStandardCompare($1.title) == .orderedAscending
                    : first > second
            }
    }

    private var pillsWithoutYear: [NativeCatalogItem] {
        filtered.filter { pillsYear(for: $0) == nil }
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

    private var isSearchingResources: Bool {
        !resourceQuery.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private var filtered: [NativeCatalogItem] {
        guard isSearchingResources || (chosenCategory != nil && categories.contains(chosenCategory!))
        else { return [] }
        return spanishResources.filter { item in
            if isSearchingResources {
                // A query searches all categories in the selected language(s).
                return item.matchesResourceQuery(resourceQuery)
            }
            return item.category == chosenCategory
        }
        .sorted { $0.title.localizedStandardCompare($1.title) == .orderedAscending }
    }

    private func updateResources() {
        Task {
            await catalog.refresh()
            announce(catalog.updateMessage ?? MusicLocalized.message("La actualización está en curso."))
        }
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
                announce(MusicLocalized.format("«%@» guardado en TifloLector.", item.title))
            } catch {
                announce(MusicLocalized.format("No se pudo guardar «%@»: %@", item.title, error.localizedDescription))
            }
        }
    }

    private func download(_ item: NativeCatalogItem) {
        Task {
            do {
                try await resourceService.exportToFiles(item)
                announce(MusicLocalized.format("Selecciona una carpeta en Archivos para descargar «%@».", item.title))
            } catch {
                announce(MusicLocalized.format("No se pudo descargar «%@»: %@", item.title, error.localizedDescription))
            }
        }
    }


    private func saveOffline(_ items: [NativeCatalogItem]) {
        guard offlineTask == nil, !items.isEmpty else { return }
        let targets = items
        offlineTask = Task { @MainActor in
            defer { offlineTask = nil; offlineProgress = nil }
            var completed = 0
            var failed = 0
            for (index, item) in targets.enumerated() {
                if Task.isCancelled { break }
                offlineProgress = "\(index + 1)/\(targets.count)"
                do {
                    try await resourceService.saveOffline(item)
                    completed += 1
                } catch {
                    if Task.isCancelled { break }
                    failed += 1
                }
            }
            announce(MusicLocalized.format("Copias sin conexión: %d guardadas, %d fallidas.", completed, failed))
        }
    }

    @ViewBuilder
    private func resourceRow(_ item: NativeCatalogItem) -> some View {
        NavigationLink {
            NativeRemoteResourceScreen(item: item)
        } label: {
            VStack(alignment: .leading, spacing: 4) {
                Text(item.title).font(.body)
                if !item.resourceLocation.isEmpty {
                    Text(item.resourceLocation).font(.caption).foregroundStyle(.secondary)
                }
            }
        }
        .accessibilityLabel(item.title)
        .accessibilityValue(Text(item.resourceLocation + (resourceService.isAvailableOffline(item)
            ? ". " + MusicLocalized.message("Disponible sin conexión") : "")))
        .accessibilityAction(named: Text("Guardar sin conexión")) { saveOffline([item]) }
        .accessibilityAction(named: Text("Leer")) { read(item) }
        .accessibilityAction(named: Text("Guardar")) { save(item) }
        .accessibilityAction(named: Text("Descargar")) { download(item) }
        .accessibilityAction(named: Text(readingActivity.isSaved(.resource, item: item)
            ? "Quitar de Leer después" : "Guardar para leer después")) {
            let saved = readingActivity.toggleReadLater(.resource, item: item)
            announce(MusicLocalized.message(saved ? "Recurso guardado para leer después." :
                "Recurso retirado de Leer después."))
        }
        .accessibilityAction(named: Text("Compartir")) {
            if let url = item.resourceURL { NativeShare.present(url: url) }
        }
        .accessibilityAction(named: Text(favorites.contains(.resource, item: item)
            ? "Quitar de favoritos" : "Añadir a favoritos")) {
            let added = favorites.toggle(.resource, item: item)
            announce(MusicLocalized.message(added ? "Añadido a Favoritos" : "Eliminado de Favoritos"))
        }
    }

    var body: some View {
        List {
            Section("Mis lecturas") {
                NavigationLink("Leer después e historial") {
                    NativeReadingActivityScreen(kind: .resource)
                }
            }
            Section("Contenido de Recursos") {
                if let offlineProgress {
                    ProgressView("Guardar sin conexión")
                    Text(offlineProgress).accessibilityAddTraits(.updatesFrequently)
                    Button("Cancelar") { offlineTask?.cancel() }
                }
                Button("Actualizar recursos") { updateResources() }
                    .disabled(catalog.loading)
                if catalog.loading {
                    ProgressView("Actualizando recursos")
                }
                if let lastUpdated = catalog.lastUpdated {
                    Text(MusicLocalized.format("Última actualización correcta: %@", lastUpdated.formatted(.dateTime.year().month(.abbreviated).day().hour().minute().locale(Locale(identifier: NativeAppLanguage.code(for: UserDefaults.standard.integer(forKey: NativeAppLanguage.storageKey)))))))
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                } else {
                    Text("Todavía no se ha confirmado una actualización correcta.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                if let error = catalog.error {
                    Text(error).font(.footnote).foregroundStyle(.secondary)
                }
                if let status = catalog.updateMessage, catalog.error == nil {
                    Text(status).font(.footnote).foregroundStyle(.secondary)
                }
            }
            Section("Filtrar recursos") {
                NativeAdjustableChoice(
                    title: "Idioma de los recursos",
                    choices: ["Idioma de la aplicación", "Todos los idiomas", "Español", "Inglés",
                                  "Português", "Français", "Italiano", "Deutsch"],
                    selectedIndex: $languageFilterIndex
                )
                NativeAdjustableChoice(
                    title: "Categoría",
                    choices: categoryChoices,
                    selectedIndex: categorySelection
                )
            }

            if (chosenCategory != nil && categories.contains(chosenCategory!)) ||
               !resourceQuery.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                Section(isSearchingResources ? "Resultados de búsqueda" : (chosenCategory ?? "Resultados de búsqueda")) {
                    if filtered.isEmpty {
                        Text(MusicLocalized.message(isSearchingResources ? "No hay resultados." : "No hay recursos en la categoría elegida."))
                    }

                    if !isSearchingResources && chosenCategory != nil && !filtered.isEmpty {
                        Button(MusicLocalized.format("Guardar %d recursos sin conexión", filtered.count)) {
                            saveOffline(filtered)
                        }
                        .disabled(offlineTask != nil)
                    }
                    if isPillsCategory && !isSearchingResources {
                        ForEach(pillsYears, id: \.self) { year in
                            NavigationLink(String(year)) {
                                List {
                                    ForEach(pillsForYear(year)) { item in
                                        resourceRow(item)
                                    }
                                }
                                .tifloScreenSurface()
                                .navigationTitle(chosenCategory == "Pills"
                                    ? "Pills \(year)" : "Píldoras \(year)")
                            }
                        }
                        // Keep undated legacy entries reachable.
                        ForEach(pillsWithoutYear) { item in
                            resourceRow(item)
                        }
                    } else if isSearchingResources {
                        ForEach(filtered) { item in
                            resourceRow(item)
                        }
                    } else {
                        NativeResourceFolderRows(items: filtered, path: [], row: resourceRow)
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
        .searchable(text: $resourceQuery, prompt: "Buscar recursos")
        .onChange(of: languageFilterIndex) { _, _ in chosenCategory = nil }
        .navigationDestination(isPresented: $presentingResource) {
            if let resourceToOpen {
                NativeRemoteResourceScreen(item: resourceToOpen)
            }
        }
    }
}

struct NativeVideosScreen: View {
    var body: some View {
        List {
            Section("Explorar vídeos") {
                NavigationLink("Buscar en YouTube") {
                    NativeYouTubeSearchScreen()
                }
                NavigationLink("Vídeos del canal TifloAcosta") {
                    NativeTifloAcostaChannelVideosScreen()
                }
            }
            Section("Mis canales") {
                NavigationLink("Mis suscripciones de YouTube") {
                    NativeYouTubeSubscriptionsScreen()
                }
                NavigationLink("Canales seguidos sin cuenta Google") {
                    NativeYouTubeLocalChannelsScreen()
                }
                NavigationLink("Novedades de mis canales") {
                    NativeYouTubeFollowedUpdatesScreen(useYouTubeSubscriptions: false)
                }
            }
            Section("Mi actividad") {
                NavigationLink("Continuar viendo") {
                    NativeYouTubePersonalVideosScreen(showWatchLater: false)
                }
                NavigationLink("Ver después") {
                    NativeYouTubePersonalVideosScreen(showWatchLater: true)
                }
            }
        }
        .tifloScreenSurface()
        .navigationTitle("Vídeos")
    }
}

/// La búsqueda y sus resultados se recorren solamente al activar Buscar en YouTube.
private struct NativeYouTubeSearchScreen: View {
    @Environment(\.openURL) private var openURL
    @StateObject private var youtubeSearch = NativeYouTubeSearchStore()
    @ObservedObject private var personalVideos = NativeYouTubePersonalLibrary.shared
    @State private var searchText = ""
    @State private var filterIndex = 0
    @State private var selectedVideo: NativeYouTubeVideo?
    @State private var commentingOnVideo: NativeYouTubeVideo?

    private let searchFilters = [
        "Todos", "Vídeos", "Canales", "Listas de reproducción",
        "Vídeos cortos, menos de cuatro minutos", "En directo", "Con subtítulos"
    ]
    private let filterValues = ["all", "video", "channel", "playlist", "short", "live", "captions"]

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
                    .accessibilityIdentifier("tiflo.youtube.search.field")
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
                if youtubeSearch.searchFailed {
                    Button("Reintentar búsqueda") {
                        // Preserve results already loaded if only the next
                        // page failed; do not make VoiceOver start over.
                        let retryMore = !youtubeSearch.nextPageToken.isEmpty &&
                            (!youtubeSearch.videos.isEmpty ||
                             !youtubeSearch.channels.isEmpty ||
                             !youtubeSearch.playlists.isEmpty)
                        search(loadMore: retryMore)
                    }
                        .disabled(youtubeSearch.isLoading)
                    Button("Buscar directamente en YouTube") {
                        let term = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
                        guard term.count >= 2 else { return }
                        var target = URLComponents(string: "https://www.youtube.com/results")!
                        target.queryItems = [URLQueryItem(name: "search_query", value: term)]
                        if let url = target.url { openURL(url) }
                    }
                    .disabled(searchText.trimmingCharacters(in: .whitespacesAndNewlines).count < 2)
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
                        .accessibilityLabel(MusicLocalized.format("%@. Canal de YouTube", channel.title))
                        .accessibilityAction(named: Text("Compartir canal")) {
                            NativeShare.present(url: channel.url)
                        }
                        .accessibilityAction(named: Text(personalVideos.isFollowing(channel.id)
                            ? MusicLocalized.message("Dejar de seguir canal") : MusicLocalized.message("Seguir canal sin cuenta Google"))) {
                            personalVideos.toggleFollowed(channel)
                        }
                    }
                    ForEach(youtubeSearch.playlists) { playlist in
                        NavigationLink {
                            NativeYouTubePlaylistScreen(playlist: playlist)
                        } label: {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(playlist.title).font(.headline)
                                Text("Lista de reproducción de YouTube")
                                    .font(.subheadline)
                                    .foregroundStyle(TifloVisual.secondaryText)
                                Text(playlist.channelTitle)
                                    .font(.footnote)
                            }
                        }
                        .accessibilityElement(children: .ignore)
                        .accessibilityLabel(MusicLocalized.format(
                            "%@. Lista de reproducción de YouTube. Canal: %@",
                            playlist.title, playlist.channelTitle))
                        .accessibilityAction(named: Text("Compartir lista")) {
                            NativeShare.present(url: playlist.url)
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

        }
        .tifloScreenSurface()
        .navigationTitle("Buscar en YouTube")
        .sheet(item: $selectedVideo) { video in
            NavigationStack { NativeYouTubePlayerScreen(video: video, playlist: youtubeSearch.videos) }
        }
        .sheet(item: $commentingOnVideo) { video in
            NavigationStack { NativeYouTubeCommentScreen(video: video) }
        }
    }
}

/// Los vídeos del canal editorial mantienen ordenación y carga de diez en diez.
private struct NativeTifloAcostaChannelVideosScreen: View {
    @EnvironmentObject private var catalog: NativeCatalogStore
    @EnvironmentObject private var favorites: NativeFavoritesStore
    @State private var sortIndex = 0
    @State private var visibleCount = 10
    @State private var selectedVideo: NativeYouTubeVideo?
    @State private var commentingOnVideo: NativeYouTubeVideo?

    private var ordered: [NativeCatalogItem] {
        sortIndex == 0 ? catalog.videos : Array(catalog.videos.reversed())
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
        .navigationTitle("Vídeos de TifloAcosta")
        .sheet(item: $selectedVideo) { video in
            NavigationStack {
                NativeYouTubePlayerScreen(video: video,
                    playlist: Array(ordered.prefix(visibleCount)).compactMap(NativeYouTubeVideo.init(catalog:)))
            }
        }
        .sheet(item: $commentingOnVideo) { video in
            NavigationStack { NativeYouTubeCommentScreen(video: video) }
        }
        .onChange(of: sortIndex) { _, _ in visibleCount = 10 }
    }
}

/// Los contenidos personales se consultan por separado, con controles de VoiceOver.
private struct NativeYouTubePersonalVideosScreen: View {
    let showWatchLater: Bool
    @ObservedObject private var personalVideos = NativeYouTubePersonalLibrary.shared
    @State private var selectedVideo: NativeYouTubeVideo?
    @State private var commentingOnVideo: NativeYouTubeVideo?

    var body: some View {
        List {
            if showWatchLater {
            Section("Ver después") {
                if personalVideos.watchLater.isEmpty {
                    Text("No has guardado vídeos para ver después.")
                }
                ForEach(personalVideos.watchLater) { saved in
                    if let video = NativeYouTubeVideo(saved: saved) {
                        NativeYouTubeVideoRow(
                            video: video, onPlay: { selectedVideo = $0 },
                            onComment: { commentingOnVideo = $0 }
                        )
                    }
                }
            }

            } else {
            Section("Continuar viendo") {
                if personalVideos.continueWatching.isEmpty {
                    Text("No hay vídeos con una reproducción pendiente.")
                }
                ForEach(personalVideos.continueWatching) { saved in
                    if let video = NativeYouTubeVideo(saved: saved) {
                        NativeYouTubeVideoRow(
                            video: video, onPlay: { selectedVideo = $0 },
                            onComment: { commentingOnVideo = $0 }
                        )
                        .accessibilityHint(MusicLocalized.format("Retoma el vídeo desde %@.", NativeYouTubeTime.spoken(saved.resumeSeconds)))
                    }
                }
            }

            }
        }
        .tifloScreenSurface()
        .navigationTitle(MusicLocalized.message(showWatchLater ? "Ver después" : "Continuar viendo"))
        .sheet(item: $selectedVideo) { video in
            NavigationStack { NativeYouTubePlayerScreen(video: video) }
        }
        .sheet(item: $commentingOnVideo) { video in
            NavigationStack { NativeYouTubeCommentScreen(video: video) }
        }
    }
}

private struct NativeYouTubeLocalChannelsScreen: View {
    @ObservedObject private var personalVideos = NativeYouTubePersonalLibrary.shared

    var body: some View {
        List {
            Section("Canales seguidos sin cuenta Google") {
                if personalVideos.followedChannels.isEmpty {
                    Text("No hay canales seguidos. Busca un canal y elige Seguir canal en sus acciones.")
                }
                ForEach(personalVideos.followedChannels) { saved in
                    if let channel = NativeYouTubeChannel(saved: saved) {
                        NavigationLink(channel.title) {
                            NativeYouTubeChannelVideosScreen(channel: channel)
                        }
                        .accessibilityAction(named: Text("Dejar de seguir canal")) {
                            personalVideos.toggleFollowed(channel)
                        }
                    }
                }
            }

        }
        .tifloScreenSurface()
        .navigationTitle("Canales seguidos")
    }
}

/// Noticias de canales seguidos sin cuenta Google. Cada canal aporta una página
/// de 10 elementos por cada pulsación de Cargar 10 más, y la lista se ordena
/// conjuntamente por fecha, no agrupada por canal.
private struct NativeYouTubeFollowedUpdatesScreen: View {
    let useYouTubeSubscriptions: Bool
    @EnvironmentObject private var account: NativeYouTubeAccountStore
    @ObservedObject private var personalVideos = NativeYouTubePersonalLibrary.shared
    @State private var searches: [String: NativeYouTubeSearchStore] = [:]
    @State private var collected: [NativeYouTubeVideo] = []
    @State private var visibleCount = 10
    @State private var loading = false
    @State private var message: String?
    @State private var channelProgress = ""
    @State private var loadGeneration = 0
    @State private var selectedVideo: NativeYouTubeVideo?
    @State private var commentingOnVideo: NativeYouTubeVideo?

    private var channels: [NativeYouTubeChannel] {
        let local = personalVideos.followedChannels.compactMap(NativeYouTubeChannel.init(saved:))
        let subscriptions = account.authenticated ? account.subscriptions : []
        var seen = Set<String>()
        return (useYouTubeSubscriptions ? subscriptions : subscriptions + local)
            .filter { seen.insert($0.id).inserted }
    }

    private var channelSignature: String {
        // Subscription pagination changes the list during loading; it must
        // not cancel the very task that requested those pages.
        let local = useYouTubeSubscriptions ? [] : personalVideos.followedChannels.compactMap(NativeYouTubeChannel.init(saved:)).map(\.id)
        return "\(account.authenticated):" + local.sorted().joined(separator: ",")
    }

    private var hasMore: Bool {
        searches.values.contains { !$0.nextPageToken.isEmpty }
    }

    private static func publicationDate(_ text: String?) -> Date? {
        guard let text, !text.isEmpty else { return nil }
        let parser = ISO8601DateFormatter()
        parser.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = parser.date(from: text) { return date }
        parser.formatOptions = [.withInternetDateTime]
        return parser.date(from: text)
    }

    private func gather() {
        var seen = Set<String>()
        collected = searches.values.flatMap(\.videos)
            .filter { seen.insert($0.id).inserted }
            .sorted {
                let left = Self.publicationDate($0.publishedAt) ?? .distantPast
                let right = Self.publicationDate($1.publishedAt) ?? .distantPast
                return left == right
                    ? $0.title.localizedStandardCompare($1.title) == .orderedAscending
                    : left > right
            }
    }

    private func load(loadMore: Bool = false) async {
        // A newly entered screen or changed session may supersede a cancelled
        // task. Generation checks prevent its late results from replacing ours.
        if loadMore && loading { return }
        loadGeneration += 1
        let generation = loadGeneration
        loading = true
        defer {
            if generation == loadGeneration {
                loading = false
                channelProgress = ""
            }
        }
        if !loadMore {
            searches.removeAll()
            collected.removeAll()
            visibleCount = 10
            message = nil
            if account.authenticated {
                if account.subscriptions.isEmpty { await account.loadSubscriptions() }
                var tokens = Set<String>()
                while generation == loadGeneration && !Task.isCancelled,
                      !account.subscriptionsNextPageToken.isEmpty,
                      tokens.count < 50,
                      tokens.insert(account.subscriptionsNextPageToken).inserted {
                    await account.loadSubscriptions(loadMore: true)
                    if account.subscriptionsMessage != nil { break }
                }
            }
        }
        guard generation == loadGeneration, !Task.isCancelled else { return }
        let targets = channels
        var failures: [String] = []
        if account.authenticated, let subscriptionError = account.subscriptionsMessage {
            failures.append(subscriptionError)
        }
        for (index, channel) in targets.enumerated() {
            guard generation == loadGeneration, !Task.isCancelled else { return }
            channelProgress = "\(index + 1)/\(targets.count)"
            let store = searches[channel.id] ?? NativeYouTubeSearchStore()
            if loadMore {
                if !store.nextPageToken.isEmpty {
                    await store.search("", channelID: channel.id, loadMore: true, recentUploads: true)
                }
            } else {
                await store.search("", channelID: channel.id, recentUploads: true)
            }
            guard generation == loadGeneration, !Task.isCancelled else { return }
            searches[channel.id] = store
            if store.searchFailed {
                failures.append(channel.title + (store.message.map { ": " + $0 } ?? ""))
            }
            // Show useful results immediately instead of waiting for every channel.
            gather()
        }
        gather()
        if loadMore { visibleCount += 10 }
        message = failures.isEmpty ? nil
            : MusicLocalized.format("No se pudieron consultar algunos canales: %@", failures.joined(separator: ", "))
    }

    var body: some View {
        List {
            Section(useYouTubeSubscriptions ? "Novedades de mis suscripciones" : "Novedades de mis canales") {
                Button("Actualizar novedades") { Task { await load() } }
                    .disabled(loading)
                if loading {
                    ProgressView("Consultando canales seguidos")
                    if !channelProgress.isEmpty { Text(channelProgress).accessibilityAddTraits(.updatesFrequently) }
                }
                if let message { Text(message).accessibilityAddTraits(.updatesFrequently) }
                if channels.isEmpty {
                    Text(MusicLocalized.message(useYouTubeSubscriptions
                        ? "No hay suscripciones disponibles. Comprueba tu sesión y actualiza las suscripciones."
                        : "Sigue un canal desde los resultados de YouTube para ver aquí sus novedades."))
                }
                ForEach(Array(collected.prefix(visibleCount))) { video in
                    NativeYouTubeVideoRow(video: video,
                        onPlay: { selectedVideo = $0 },
                        onComment: { commentingOnVideo = $0 })
                }
                if !loading && collected.isEmpty && !channels.isEmpty {
                    Text("Todavía no se han recibido vídeos de los canales seguidos.")
                }
                if !loading && (collected.count > visibleCount || hasMore) {
                    Button("Cargar 10 más") {
                        if collected.count > visibleCount { visibleCount += 10 }
                        else if hasMore { Task { await load(loadMore: true) } }
                    }
                }
            }
        }
        .tifloScreenSurface()
        .navigationTitle(MusicLocalized.message(useYouTubeSubscriptions
            ? "Novedades de suscripciones" : "Novedades de canales"))
        .sheet(item: $selectedVideo) { video in
            NavigationStack { NativeYouTubePlayerScreen(video: video) }
        }
        .sheet(item: $commentingOnVideo) { video in
            NavigationStack { NativeYouTubeCommentScreen(video: video) }
        }
        .task(id: channelSignature) { await load() }
        .onDisappear {
            loadGeneration += 1
            loading = false
        }
    }
}

// Una sola definición de gestos para títulos en búsquedas, canal y suscripciones.
private struct NativeYouTubeTitleActions: ViewModifier {
    @EnvironmentObject private var account: NativeYouTubeAccountStore
    @ObservedObject private var personalVideos = NativeYouTubePersonalLibrary.shared
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
            .accessibilityAction(named: Text(personalVideos.isWatchLater(video.id)
                ? MusicLocalized.message("Quitar de Ver después") : MusicLocalized.message("Guardar para ver después"))) {
                personalVideos.toggleWatchLater(video)
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

/// Miniatura meramente visual: la fila conserva un solo elemento accesible,
/// con las mismas acciones de VoiceOver, sin introducir paradas adicionales.
private struct NativeYouTubeThumbnail: View {
    let video: NativeYouTubeVideo

    private var fallback: some View {
        ZStack {
            TifloVisual.surfaceRaised
            Image(systemName: "play.rectangle.fill")
                .font(.title2)
                .foregroundStyle(TifloVisual.actionTint)
        }
    }

    var body: some View {
        AsyncImage(url: video.thumbnailURL) { phase in
            switch phase {
            case .success(let image):
                image.resizable().scaledToFill()
            case .empty, .failure:
                fallback
            @unknown default:
                fallback
            }
        }
        .frame(width: 112, height: 63)
        .clipped()
        .clipShape(RoundedRectangle(cornerRadius: 9))
        .overlay(
            RoundedRectangle(cornerRadius: 9)
                .strokeBorder(TifloVisual.border, lineWidth: 1)
        )
        .accessibilityHidden(true)
    }
}

struct NativeYouTubeVideoRow: View {
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @State private var showingDetails = false
    let video: NativeYouTubeVideo
    let onPlay: (NativeYouTubeVideo) -> Void
    let onComment: (NativeYouTubeVideo) -> Void

    private var details: some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(video.title)
                .font(.headline)
                .foregroundStyle(TifloVisual.primaryText)
            Text(MusicLocalized.format("Canal: %@", video.channelTitle))
                .font(.subheadline)
                .foregroundStyle(TifloVisual.secondaryText)
            if let date = NativeNewsMetadata.publication(video.publishedAt) {
                Text(MusicLocalized.format("Publicado: %@", date))
                    .font(.subheadline)
                    .foregroundStyle(TifloVisual.secondaryText)
            } else {
                Text("Fecha de publicación no disponible")
                    .font(.subheadline)
                    .foregroundStyle(TifloVisual.secondaryText)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    var body: some View {
        Button { onPlay(video) } label: {
            Group {
                if dynamicTypeSize.isAccessibilitySize {
                    VStack(alignment: .leading, spacing: 10) {
                        NativeYouTubeThumbnail(video: video)
                        details
                    }
                } else {
                    HStack(alignment: .top, spacing: 12) {
                        NativeYouTubeThumbnail(video: video)
                        details
                    }
                }
            }
            .padding(.vertical, 5)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .buttonStyle(.plain)
        // Conservar el botón real: un elemento artificial pierde la acción de doble toque.
        .accessibilityLabel(MusicLocalized.format("%@. Canal: %@. %@", video.title, video.channelTitle,
            NativeNewsMetadata.publication(video.publishedAt).map { MusicLocalized.format("Publicado: %@", $0) }
                ?? MusicLocalized.format("Fecha de publicación no disponible")))
        .modifier(NativeYouTubeTitleActions(
            video: video, onPlay: onPlay, onComment: onComment
        ))
        .accessibilityAction(named: Text("Detalles del vídeo")) { showingDetails = true }
        .accessibilityAction(.default) { onPlay(video) }
        .contextMenu {
            Button("Detalles del vídeo") { showingDetails = true }
        }
        .sheet(isPresented: $showingDetails) {
            NavigationStack { NativeYouTubeVideoDetailsScreen(video: video) }
        }
    }
}

struct NativeYouTubeCommentScreen: View {
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
                Section("Novedades de mis suscripciones") {
                    NavigationLink("Ver novedades de mis suscripciones") {
                        NativeYouTubeFollowedUpdatesScreen(useYouTubeSubscriptions: true)
                    }
                    .accessibilityHint("Vídeos de los canales de tu cuenta de YouTube ordenados por fecha.")
                }
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
    @ObservedObject private var personalVideos = NativeYouTubePersonalLibrary.shared
    @StateObject private var youtubeSearch = NativeYouTubeSearchStore()
    @State private var channelQuery = ""
    @State private var selectedVideo: NativeYouTubeVideo?
    @State private var commentingOnVideo: NativeYouTubeVideo?

    var body: some View {
        List {
            Section("Canal") {
                Button(personalVideos.isFollowing(channel.id)
                    ? MusicLocalized.message("Dejar de seguir canal") : MusicLocalized.message("Seguir canal sin cuenta Google")) {
                    personalVideos.toggleFollowed(channel)
                }
            }
            Section("Buscar en este canal") {
                TextField("Buscar vídeos de este canal", text: $channelQuery)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .submitLabel(.search)
                    .onSubmit {
                        let term = channelQuery.trimmingCharacters(in: .whitespacesAndNewlines)
                        guard term.count >= 2, !youtubeSearch.isLoading else { return }
                        Task { await youtubeSearch.search(term, channelID: channel.id) }
                    }
                Button("Buscar en este canal") {
                    Task { await youtubeSearch.search(channelQuery, channelID: channel.id) }
                }
                .disabled(youtubeSearch.isLoading ||
                    channelQuery.trimmingCharacters(in: .whitespacesAndNewlines).count < 2)
                Button("Mostrar todos los vídeos de este canal") {
                    channelQuery = ""
                    Task { await youtubeSearch.search("", channelID: channel.id) }
                }
                .disabled(youtubeSearch.isLoading)
            }
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
                            channelQuery, channelID: channel.id, loadMore: true
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
            NavigationStack { NativeYouTubePlayerScreen(video: video, playlist: youtubeSearch.videos) }
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
        present(urls: [url])
    }

    static func present(urls: [URL]) {
        guard !urls.isEmpty else { return }
        guard let scene = UIApplication.shared.connectedScenes
            .compactMap({ $0 as? UIWindowScene })
            .first(where: { $0.activationState == .foregroundActive }),
            var presenter = scene.keyWindow?.rootViewController else { return }

        while let presented = presenter.presentedViewController {
            presenter = presented
        }
        presenter.present(
            UIActivityViewController(activityItems: urls, applicationActivities: nil),
            animated: true
        )
    }
}
