import SwiftUI

/// A separate, truly native application entry point with no browser-based presentation.
/// The existing TestFlight application keeps its original bundle identifier until feature parity.
@main
struct TifloAcostaNativeApp: App {
    @StateObject private var catalog = NativeCatalogStore()
    @StateObject private var library = NativeReaderLibrary()

    var body: some Scene {
        WindowGroup {
            NativeHomeScreen()
                .environmentObject(catalog)
                .environmentObject(library)
                .task { await catalog.refresh() }
                .tint(Color(red: 0.70, green: 0.18, blue: 0.18))
        }
    }
}
