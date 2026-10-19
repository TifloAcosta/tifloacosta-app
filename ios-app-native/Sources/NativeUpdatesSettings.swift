import Foundation
import SwiftUI

/// Native SwiftUI lists: resources and published news are content, never web screens.
struct NativeUpdatesScreen: View {
    @EnvironmentObject private var catalog: NativeCatalogStore

    private var recentResources: [NativeCatalogItem] {
        catalog.resources.filter { $0.lang == "es" && $0.isNew == true }
    }

    private var recentNews: [NativeCatalogItem] {
        catalog.news.filter { $0.lang == "es" }
    }

    var body: some View {
        List {
            Section("Recursos nuevos") {
                if recentResources.isEmpty { Text("No hay recursos nuevos.") }
                ForEach(recentResources) { item in
                    NavigationLink {
                        NativeRemoteResourceScreen(item: item)
                    } label: {
                        Text(item.title).font(.body)
                    }
                }
            }
            Section("Últimas noticias") {
                ForEach(Array(recentNews.prefix(10))) { item in
                    NavigationLink {
                        NativeNewsArticleScreen(item: item)
                    } label: {
                        Text(item.title).font(.body)
                    }
                }
            }
        }
        .tifloScreenSurface()
        .navigationTitle("Novedades")
    }
}

struct NativeSettingsScreen: View {
    @AppStorage("native-ios-color-scheme") private var schemeIndex = 0
    @Environment(\.openURL) private var openURL

    private var version: String {
        let dictionary = Bundle.main.infoDictionary
        let short = dictionary?["CFBundleShortVersionString"] as? String ?? "1.0"
        let build = dictionary?["CFBundleVersion"] as? String ?? ""
        return "\(short) (\(build))"
    }

    var body: some View {
        Form {
            Section("Aspecto") {
                NativeAdjustableChoice(
                    title: "Interfaz",
                    choices: ["Según el sistema", "Claro", "Oscuro"],
                    selectedIndex: $schemeIndex
                )
                Text("Se respetan el tamaño del texto, el contraste y VoiceOver de iOS.")
                    .font(.footnote).foregroundStyle(.secondary)
            }
            Section("Aplicación") {
                LabeledContent("Versión", value: version)
                Text("TifloAcosta para iOS utiliza pantallas nativas.")
                    .font(.footnote)
                Button("Sitio web de TifloAcosta") {
                    if let url = URL(string: "https://tifloacosta.com") { openURL(url) }
                }
            }
        }
        .tifloScreenSurface()
        .navigationTitle("Configuración")
    }
}
