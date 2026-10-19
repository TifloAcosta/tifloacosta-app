import SwiftUI

/// A separate, truly native application entry point with no browser-based presentation.
/// The existing TestFlight application keeps its original bundle identifier until feature parity.
@main
struct TifloAcostaNativeApp: App {
    @StateObject private var catalog = NativeCatalogStore()
    @StateObject private var library = NativeReaderLibrary()
    @StateObject private var resourceService = NativeResourceService()
    @StateObject private var inbox = NativeShareInbox()
    @StateObject private var podcasts = NativePodcastStore()
    @AppStorage("native-ios-color-scheme") private var schemeIndex = 0

    var body: some Scene {
        WindowGroup {
            NativeHomeScreen()
                .environmentObject(catalog)
                .environmentObject(library)
                .environmentObject(resourceService)
                .environmentObject(inbox)
                .environmentObject(podcasts)
                .onAppear { inbox.refresh() }
                .task { await catalog.refresh(); await podcasts.refresh() }
                .tint(Color(red: 0.70, green: 0.18, blue: 0.18))
                .preferredColorScheme(schemeIndex == 1 ? .light : schemeIndex == 2 ? .dark : nil)
        }
    }
}
