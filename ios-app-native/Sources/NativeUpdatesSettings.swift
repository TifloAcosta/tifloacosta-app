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
            .filter { (languageIndex > 1 || $0.lang == NativeAppLanguage.code(for: languageIndex)) && $0.isNew == true && $0.resourceURL != nil }
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
            Section("Actualizar contenidos") {
                Button("Actualizar novedades") {
                    Task {
                        await catalog.refresh()
                        let message = catalog.updateMessage ?? "La actualización está en curso."
                        actionStatus = message
                        UIAccessibility.post(notification: .announcement, argument: message)
                    }
                }
                .disabled(catalog.loading)
                if catalog.loading {
                    ProgressView("Actualizando novedades")
                }
                if let lastUpdated = catalog.lastUpdated {
                    Text("Última actualización correcta: \(lastUpdated.formatted(date: .abbreviated, time: .shortened))")
                        .font(.footnote)
                } else {
                    Text("Todavía no se ha confirmado una actualización correcta.")
                        .font(.footnote)
                }
                if let error = catalog.error {
                    Text(error).foregroundStyle(TifloVisual.secondaryText)
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
    @AppStorage("native-voiceover-library-detail-index") private var voiceOverDetailIndex = 0
    @Environment(\.openURL) private var openURL
    @State private var showVisualSettings = false
    @ObservedObject private var ownUpdatesNotifications = NativeOwnUpdatesNotifications.shared

    private var version: String {
        let dictionary = Bundle.main.infoDictionary
        let short = dictionary?["CFBundleShortVersionString"] as? String ?? "1.0"
        let build = dictionary?["CFBundleVersion"] as? String ?? ""
        return "\(short) (\(build))"
    }

    var body: some View {
        Form {
            Section {
                NativeAdjustableChoice(
                    title: "Idioma",
                    choices: NativeAppLanguage.names,
                    selectedIndex: $languageIndex
                )
            }
            .listRowBackground(TifloVisual.surfaceRaised)

            Section {
                DisclosureGroup("Ajustes visuales", isExpanded: $showVisualSettings) {
                    NativeAdjustableChoice(
                        title: "Perfil de contraste",
                        choices: ["Seguir el sistema", "Alto contraste claro", "Alto contraste oscuro"],
                        selectedIndex: $schemeIndex
                    )
                    NativeAdjustableChoice(
                        title: "Tamaño del texto",
                        choices: ["Predeterminado", "Grande", "Muy grande", "Máximo"],
                        selectedIndex: $textSizeIndex
                    )
                    Text("El tamaño nunca será inferior al configurado en Accesibilidad de iOS.")
                        .font(.footnote)
                        .foregroundStyle(TifloVisual.secondaryText)
                    NativeAdjustableChoice(
                        title: "Separación entre líneas",
                        choices: ["Normal", "Cómoda", "Amplia"],
                        selectedIndex: $lineSpacingIndex
                    )
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

            Section {
                NativeAdjustableChoice(
                    title: "Detalle de VoiceOver",
                    choices: ["Breve: título y porcentaje leído",
                              "Intermedia: título, porcentaje y formato",
                              "Completa: título, porcentaje, formato y carpeta"],
                    selectedIndex: $voiceOverDetailIndex
                )
             }
            .listRowBackground(TifloVisual.surfaceRaised)

            Section("Atajos de Siri") {
                NavigationLink("Consultar y configurar atajos") {
                    NativeSiriShortcutsHelpScreen()
                }
                Text("Las acciones de TifloAcosta están disponibles en Atajos de Apple. Puedes crear tus propias frases de activación desde la aplicación Atajos.")
                    .font(.footnote)
                    .foregroundStyle(TifloVisual.secondaryText)
            }
            .listRowBackground(TifloVisual.surfaceRaised)

            Section("Notificaciones de novedades propias") {
                Text("Los avisos automáticos solo pueden referirse a nuevos documentos de TifloAcosta y vídeos de su canal. No se generan avisos desde Actualidad ni desde fuentes externas.")
                    .font(.footnote)
                    .foregroundStyle(TifloVisual.secondaryText)
                Text("Estos avisos locales se comprueban cuando la aplicación actualiza su catálogo; no son notificaciones push mientras está cerrada.")
                    .font(.footnote)
                    .foregroundStyle(TifloVisual.secondaryText)
                if ownUpdatesNotifications.enabled {
                    Button("Desactivar avisos de novedades") {
                        ownUpdatesNotifications.disable()
                    }
                } else {
                    Button("Activar avisos de novedades") {
                        Task { await ownUpdatesNotifications.enable() }
                    }
                }
                if !ownUpdatesNotifications.status.isEmpty {
                    Text(ownUpdatesNotifications.status)
                        .font(.footnote)
                        .accessibilityAddTraits(.updatesFrequently)
                }
            }
            .listRowBackground(TifloVisual.surfaceRaised)

            Section("Ayuda y diagnóstico") {
                NavigationLink("Comunicar incidencia de accesibilidad") {
                    NativeAccessibilityReportScreen()
                }
                Text("Puedes describir el problema y compartir un informe opcional con información técnica básica. El envío siempre depende de tu confirmación.")
                    .font(.footnote)
                    .foregroundStyle(TifloVisual.secondaryText)
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


/// Guía accesible de las acciones App Intents registradas en TifloAcosta.
struct NativeSiriShortcutsHelpScreen: View {
    @Environment(\.openURL) private var openURL

    private let shortcuts: [(name: String, detail: String)] = [
        ("Abrir Actualidad", "Accede a las noticias de Actualidad."),
        ("Abrir TifloLector", "Abre la biblioteca de documentos."),
        ("Continuar el último libro", "Recupera la lectura del último libro abierto."),
        ("Abrir Vídeos", "Abre la sección de vídeos accesibles.")
    ]

    var body: some View {
        List {
            Section("Atajos disponibles") {
                ForEach(shortcuts.indices, id: \.self) { index in
                    LabeledContent(shortcuts[index].name, value: shortcuts[index].detail)
                }
            }
            Section("Frases personales") {
                Text("Para usar tus propias órdenes, abre Atajos, crea un nuevo atajo y añade una de las acciones de TifloAcosta. Ponle el nombre con el que quieras llamarlo mediante Siri.")
                Button("Abrir la aplicación Atajos") {
                    guard let url = URL(string: "shortcuts://") else { return }
                    openURL(url)
                }
                .accessibilityHint("Abre la aplicación Atajos de Apple, si está disponible.")
                Text("No es necesario activar permisos individuales en TifloAcosta para utilizar las acciones publicadas por la aplicación.")
                    .font(.footnote)
            }
        }
        .tifloScreenSurface()
        .navigationTitle("Atajos de Siri")
    }
}
