import SwiftUI

/// Shared, concise navigation for reading later and recently opened items.
/// A catalog item is resolved by stable ID and language, not by title.
struct NativeReadingActivityScreen: View {
    let kind: NativeFavoriteKind
    @EnvironmentObject private var catalog: NativeCatalogStore
    @EnvironmentObject private var activity: NativeReadingActivity

    private var catalogItems: [NativeCatalogItem] {
        kind == .news ? catalog.news : catalog.resources
    }

    private func resolve(_ keys: [NativeFavoriteKey]) -> [NativeCatalogItem] {
        let matching = keys.filter { $0.kind == kind }
        return matching.compactMap { key in
            catalogItems.first { NativeFavoriteKey(kind, $0) == key }
        }
    }

    private var saved: [NativeCatalogItem] {
        resolve(Array(activity.savedForLater).sorted {
            $0.id.localizedStandardCompare($1.id) == .orderedAscending
        })
    }

    private var recent: [NativeCatalogItem] {
        resolve(activity.recentlyRead)
    }

    @ViewBuilder
    private func detail(_ item: NativeCatalogItem) -> some View {
        if kind == .news {
            NativeNewsArticleScreen(item: item)
        } else {
            NativeRemoteResourceScreen(item: item)
        }
    }

    var body: some View {
        List {
            Section("Leer después") {
                if saved.isEmpty {
                    Text("Todavía no hay contenidos guardados para leer después.")
                }
                ForEach(saved) { item in
                    NavigationLink(item.title) { detail(item) }
                        .accessibilityAction(named: Text("Quitar de Leer después")) {
                            _ = activity.toggleReadLater(kind, item: item)
                        }
                    Button("Quitar de Leer después: \(item.title)") {
                        _ = activity.toggleReadLater(kind, item: item)
                    }
                }
            }
            Section("Consultados recientemente") {
                if recent.isEmpty {
                    Text("No hay contenidos recientes disponibles en el catálogo.")
                }
                ForEach(recent) { item in
                    NavigationLink(item.title) { detail(item) }
                }
                if !activity.recentlyRead.isEmpty {
                    Button("Borrar historial de consulta") { activity.clearHistory() }
                }
            }
        }
        .tifloScreenSurface()
        .navigationTitle(kind == .news ? "Lecturas de Actualidad" : "Lecturas de Recursos")
    }
}
