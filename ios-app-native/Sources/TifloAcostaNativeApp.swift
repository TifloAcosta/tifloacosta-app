import SwiftUI

/// Entrada única y oficial de TifloAcosta para iOS; SwiftUI sin WebView ni Capacitor.
/// Se publica con com.tifloacosta.app en TestFlight y posteriormente App Store.
@main
struct TifloAcostaNativeApp: App {
    @StateObject private var catalog = NativeCatalogStore()
    @StateObject private var library = NativeReaderLibrary()
    @StateObject private var favorites = NativeFavoritesStore()
    @StateObject private var resourceService = NativeResourceService()
    @StateObject private var inbox = NativeShareInbox()
    @StateObject private var podcasts = NativePodcastStore()
    @StateObject private var media = NativeMediaStore()
    @StateObject private var youtubeAccount = NativeYouTubeAccountStore()
    @AppStorage("native-ios-color-scheme") private var schemeIndex = 0
    @AppStorage("native-ios-text-size") private var textSizeIndex = 0
    @AppStorage("native-ios-line-spacing") private var lineSpacingIndex = 0
    @AppStorage("native-ios-strong-text") private var strongText = false
    @AppStorage("native-ios-language") private var languageIndex = 0
    @Environment(\.dynamicTypeSize) private var systemTextSize

    // Nunca reducimos el tamaño de letra seleccionado en iOS, ni siquiera
    // cuando TifloAcosta utiliza una preferencia visual propia.
    private var effectiveTextSize: DynamicTypeSize {
        let requested: DynamicTypeSize
        switch textSizeIndex {
        case 1: requested = .xxLarge
        case 2: requested = .accessibility1
        case 3: requested = .accessibility3
        default: return systemTextSize
        }
        return max(systemTextSize, requested)
    }

    var body: some Scene {
        WindowGroup {
            NativeHomeScreen()
                .environmentObject(catalog)
                .environmentObject(library)
                .environmentObject(favorites)
                .environmentObject(resourceService)
                .environmentObject(inbox)
                .environmentObject(podcasts)
                .environmentObject(media)
                .environmentObject(youtubeAccount)
                .onAppear { inbox.refresh() }
                .task { await catalog.refresh(); await podcasts.refresh() }
                .tint(TifloVisual.actionTint)
                .environment(\.defaultMinListRowHeight, 48)
                .environment(\.locale, Locale(identifier: languageIndex == 1 ? "en" : "es"))
                .dynamicTypeSize(effectiveTextSize)
                .lineSpacing(lineSpacingIndex == 1 ? 6 : lineSpacingIndex == 2 ? 12 : 0)
                .fontWeight(strongText ? .semibold : nil)
                .preferredColorScheme(schemeIndex == 1 ? .light : schemeIndex == 2 ? .dark : nil)
        }
    }
}
