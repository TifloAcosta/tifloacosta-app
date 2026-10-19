import Foundation
import SwiftUI
import UIKit

// Novedades solo contiene incorporaciones propias del catálogo de TifloAcosta.
// Las noticias de fuentes externas pertenecen exclusivamente a Actualidad.
private enum NativeUpdateEntry: Identifiable {
    case resource(NativeCatalogItem)
    case video(NativeCatalogItem)

    var item: NativeCatalogItem {
        switch self {
        case .resource(let item): return item
        case .video(let item): return item
        }
    }

    var id: String {
        switch self {
        case .resource(let item): return "resource:" + item.id
        case .video(let item): return "video:" + item.id
        }
    }

    var publication: String {
        item.newsDate ?? item.publishedAt ?? ""
    }

    var kind: String {
        switch self {
        case .resource: return "Recurso de TifloAcosta"
        case .video: return "Vídeo del canal TifloAcosta"
        }
    }
}

struct NativeUpdatesScreen: View {
    @EnvironmentObject private var catalog: NativeCatalogStore
    @EnvironmentObject private var library: NativeReaderLibrary
    @EnvironmentObject private var resourceService: NativeResourceService
    @EnvironmentObject private var favorites: NativeFavoritesStore
    @AppStorage("native-ios-language") private var languageIndex = 0
    @Environment(\.openURL) private var openURL

    @State private var selectedResource: NativeCatalogItem?
    @State private var showingResource = false
    @State private var actionStatus: String?

    // Seleccionar las tres publicaciones propias más recientes, ya sean recursos
    // marcados como nuevos o vídeos del canal, sin noticias externas.
    private var latestUpdates: [NativeUpdateEntry] {
        let resources = catalog.resources
            .filter { $0.lang == (languageIndex == 1 ? "en" : "es") && $0.isNew == true && $0.resourceURL != nil }
            .map(NativeUpdateEntry.resource)
        let videos = catalog.videos
            .filter { $0.videoURL != nil }
            .map(NativeUpdateEntry.video)

        return Array((resources + videos)
            .filter { !$0.publication.isEmpty }
            .sorted {
                if $0.publication != $1.publication {
                    return $0.publication > $1.publication
                }
                return $0.id < $1.id
            }
            .prefix(3))
    }

    private func announce(_ message: String) {
        actionStatus = message
        UIAccessibility.post(notification: .announcement, argument: message)
    }

    private func read(_ item: NativeCatalogItem) {
        selectedResource = item
        showingResource = true
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

    private func openVideo(_ item: NativeCatalogItem) {
        if let url = item.videoURL {
            openURL(url)
        } else {
            announce("El enlace del vídeo no está disponible.")
        }
    }

    private func share(_ item: NativeCatalogItem, isVideo: Bool) {
        let url = isVideo ? item.videoURL : item.resourceURL
        if let url {
            NativeShare.present(url: url)
        } else {
            announce("No hay un enlace disponible para compartir.")
        }
    }

    private func titleLabel(_ entry: NativeUpdateEntry) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(entry.item.title)
                .font(.body)
                .foregroundStyle(TifloVisual.primaryText)
            Text(entry.kind)
                .font(.subheadline)
                .foregroundStyle(TifloVisual.secondaryText)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    var body: some View {
        List {
            Section("Últimas incorporaciones de TifloAcosta") {
                if latestUpdates.isEmpty {
                    Text("No hay incorporaciones recientes disponibles.")
                        .foregroundStyle(TifloVisual.secondaryText)
                }
                ForEach(latestUpdates) { entry in
                    switch entry {
                    case .resource(let item):
                        NavigationLink {
                            NativeRemoteResourceScreen(item: item)
                        } label: {
                            titleLabel(entry)
                        }
                        .accessibilityElement(children: .ignore)
                        .accessibilityLabel("\(item.title). Recurso de TifloAcosta")
                        .accessibilityHint("Doble toque para leer. Acciones: Leer, Guardar, Descargar y Compartir.")
                        .accessibilityAction(named: Text("Leer")) { read(item) }
                        .accessibilityAction(named: Text("Guardar")) { save(item) }
                        .accessibilityAction(named: Text("Descargar")) { download(item) }
                        .accessibilityAction(named: Text("Compartir")) {
                            share(item, isVideo: false)
                        }
                        .accessibilityAction(named: Text(favorites.contains(.resource, item: item) ? "Quitar de favoritos" : "Añadir a favoritos")) {
                            _ = favorites.toggle(.resource, item: item)
                        }

                    case .video(let item):
                        Button {
                            openVideo(item)
                        } label: {
                            titleLabel(entry)
                        }
                        .accessibilityElement(children: .ignore)
                        .accessibilityLabel("\(item.title). Vídeo del canal TifloAcosta")
                        .accessibilityHint("Doble toque para abrir el vídeo. Acciones: Abrir en YouTube y Compartir.")
                        .accessibilityAction(named: Text("Abrir en YouTube")) {
                            openVideo(item)
                        }
                        .accessibilityAction(named: Text("Compartir")) {
                            share(item, isVideo: true)
                        }
                        .accessibilityAction(named: Text(favorites.contains(.video, item: item) ? "Quitar de favoritos" : "Añadir a favoritos")) {
                            _ = favorites.toggle(.video, item: item)
                        }
                    }
                }
            }
            .listRowBackground(TifloVisual.surfaceRaised)

            if let actionStatus {
                Text(actionStatus)
                    .font(.footnote)
                    .foregroundStyle(TifloVisual.secondaryText)
                    .listRowBackground(TifloVisual.surfaceRaised)
            }
            if let error = catalog.error {
                Text(error).foregroundStyle(TifloVisual.secondaryText)
                Button("Actualizar novedades") {
                    Task { await catalog.refresh() }
                }
            }
        }
        .tifloScreenSurface()
        .navigationTitle("Novedades")
        .navigationDestination(isPresented: $showingResource) {
            if let selectedResource {
                NativeRemoteResourceScreen(item: selectedResource)
            }
        }
    }
}

struct NativeSettingsScreen: View {
    @AppStorage("native-ios-color-scheme") private var schemeIndex = 0
    @AppStorage("native-ios-text-size") private var textSizeIndex = 0
    @AppStorage("native-ios-line-spacing") private var lineSpacingIndex = 0
    @AppStorage("native-ios-strong-text") private var strongText = false
    @AppStorage("native-ios-language") private var languageIndex = 0
    @Environment(\.openURL) private var openURL
    @State private var showVisualSettings = false

    private var version: String {
        let dictionary = Bundle.main.infoDictionary
        let short = dictionary?["CFBundleShortVersionString"] as? String ?? "1.0"
        let build = dictionary?["CFBundleVersion"] as? String ?? ""
        return "\(short) (\(build))"
    }

    var body: some View {
        Form {
            Section("Idioma") {
                NativeAdjustableChoice(
                    title: "Idioma de la aplicación",
                    choices: ["Español", "English"],
                    selectedIndex: $languageIndex
                )
                Text("El idioma elegido se conserva. El cambio se aplica a la interfaz nativa; los títulos y contenidos de fuentes externas mantienen su idioma original.")
                    .font(.footnote)
                    .foregroundStyle(TifloVisual.secondaryText)
            }
            .listRowBackground(TifloVisual.surfaceRaised)

            Section {
                DisclosureGroup("Ajustes visuales", isExpanded: $showVisualSettings) {
                    Text("Color y contraste").font(.headline)
                    NativeAdjustableChoice(
                        title: "Perfil de contraste",
                        choices: ["Seguir el sistema", "Alto contraste claro", "Alto contraste oscuro"],
                        selectedIndex: $schemeIndex
                    )
                    Text("Tamaño del texto").font(.headline)
                    NativeAdjustableChoice(
                        title: "Tamaño",
                        choices: ["Predeterminado", "Grande", "Muy grande", "Máximo"],
                        selectedIndex: $textSizeIndex
                    )
                    Text("El tamaño nunca será inferior al configurado en Accesibilidad de iOS.")
                        .font(.footnote)
                        .foregroundStyle(TifloVisual.secondaryText)
                    Text("Espaciado").font(.headline)
                    NativeAdjustableChoice(
                        title: "Separación entre líneas",
                        choices: ["Normal", "Cómoda", "Amplia"],
                        selectedIndex: $lineSpacingIndex
                    )
                    Text("Legibilidad").font(.headline)
                    Toggle("Usar texto reforzado", isOn: $strongText)
                        .tint(TifloVisual.actionTint)
                    Button("Restablecer ajustes visuales") {
                        schemeIndex = 0
                        textSizeIndex = 0
                        lineSpacingIndex = 0
                        strongText = false
                        UIAccessibility.post(notification: .announcement, argument: "Ajustes visuales restablecidos.")
                    }
                }
                .accessibilityHint("Abre este menú para modificar la presentación de TifloAcosta.")
            }
            .listRowBackground(TifloVisual.surfaceRaised)

            Section("Aplicación") {
                LabeledContent("Versión", value: version)
                Text("TifloAcosta para iOS utiliza pantallas nativas.")
                    .font(.footnote)
                Button("Sitio web de TifloAcosta") {
                    if let url = URL(string: "https://tifloacosta.com") { openURL(url) }
                }
            }
            .listRowBackground(TifloVisual.surfaceRaised)
        }
        .tifloScreenSurface()
        .navigationTitle("Configuración")
    }
}
