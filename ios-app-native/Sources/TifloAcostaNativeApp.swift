import SwiftUI

/// Entrada única y oficial de TifloAcosta para iOS; SwiftUI sin WebView ni Capacitor.
/// Se publica con com.tifloacosta.app en TestFlight y posteriormente App Store.
@main
struct TifloAcostaNativeApp: App {
    @StateObject private var catalog = NativeCatalogStore()
    @StateObject private var library = NativeReaderLibrary()
    @StateObject private var resourceService = NativeResourceService()
    @StateObject private var inbox = NativeShareInbox()
    @StateObject private var podcasts = NativePodcastStore()
    @StateObject private var media = NativeMediaStore()
    @AppStorage("native-ios-color-scheme") private var schemeIndex = 0
    @AppStorage("native-ios-language") private var languageIndex = 0

    var body: some Scene {
        WindowGroup {
            NativeHomeScreen()
                .environmentObject(catalog)
                .environmentObject(library)
                .environmentObject(resourceService)
                .environmentObject(inbox)
                .environmentObject(podcasts)
                .environmentObject(media)
                .onAppear { inbox.refresh() }
                .task { await catalog.refresh(); await podcasts.refresh() }
                .tint(TifloVisual.actionTint)
                .environment(\.defaultMinListRowHeight, 48)
                .environment(\.locale, Locale(identifier: languageIndex == 1 ? "en" : "es"))
                .preferredColorScheme(schemeIndex == 1 ? .light : schemeIndex == 2 ? .dark : nil)
        }
    }
}
