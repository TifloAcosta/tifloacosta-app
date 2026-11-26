import SwiftUI
import UserNotifications

/// Entrada única y oficial de TifloAcosta para iOS; SwiftUI sin WebView ni Capacitor.
/// Se publica con com.tifloacosta.app en TestFlight y posteriormente App Store.
@main
struct TifloAcostaNativeApp: App {
    @StateObject private var catalog = NativeCatalogStore()
    @StateObject private var library = NativeReaderLibrary()
    @StateObject private var favorites = NativeFavoritesStore()
    @StateObject private var readingActivity = NativeReadingActivity()
    @StateObject private var resourceService = NativeResourceService()
    @StateObject private var inbox = NativeShareInbox()
    @StateObject private var podcasts = NativePodcastStore()
    @StateObject private var podcastPlayer = NativePodcastPlayer()
    @StateObject private var podcastLibrary = NativePodcastLibrary()
    @StateObject private var podcastDownloads = NativePodcastDownloads()
    @StateObject private var media = NativeMediaStore()
    @StateObject private var youtubeAccount = NativeYouTubeAccountStore()
    @AppStorage("native-ios-color-scheme") private var schemeIndex = 0
    @AppStorage("native-ios-language") private var languageIndex = 0

    @ObservedObject private var backups = NativeBackupCoordinator.shared
    private let recoveryFailed: Bool

    init() {
        // StateObject factories are lazy. Recover before the home hierarchy
        // can instantiate libraries or start background tasks.
        do {
            try NativeBackupRestoreJournal.application.recover { record in
                let payload = try PropertyListDecoder().decode(NativeBackupRecoveryPayload.self,
                    from: record.recoveryPayload)
                try payload.replay()
            }
            recoveryFailed = false
        } catch {
            recoveryFailed = true
            return
        }
        NativeAppLanguage.initializeIfMissing()
        UserDefaults(suiteName: "group.com.tifloacosta.app")?.set(
            NativeAppLanguage.code(for: UserDefaults.standard.integer(forKey: NativeAppLanguage.storageKey)),
            forKey: "native-share-language")
        UNUserNotificationCenter.current().delegate = NativeLocalNotificationDelegate.shared
    }

    var body: some Scene {
        WindowGroup {
            if recoveryFailed || backups.requiresRecovery {
                VStack(spacing: 16) {
                    Text("No se pudo completar la recuperación de la copia de seguridad.")
                        .font(.headline)
                        .accessibilityAddTraits(.isHeader)
                    Text("Cierra y vuelve a abrir TifloAcosta. No borres la aplicación ni sus datos.")
                }
                .padding()
                .environment(\.locale, Locale(identifier: NativeAppLanguage.code(for: languageIndex)))
                .tifloVisualPreferences()
            } else {
            NativeHomeScreen()
                .environmentObject(catalog)
                .environmentObject(library)
                .environmentObject(favorites)
                .environmentObject(readingActivity)
                .environmentObject(resourceService)
                .environmentObject(inbox)
                .environmentObject(podcasts)
                .environmentObject(podcastPlayer)
                .environmentObject(podcastLibrary)
                .environmentObject(podcastDownloads)
                .environmentObject(media)
                .environmentObject(youtubeAccount)
                .onAppear { inbox.refresh() }
                .onChange(of: languageIndex) { _, index in
                    UserDefaults(suiteName: "group.com.tifloacosta.app")?.set(
                        NativeAppLanguage.code(for: index), forKey: "native-share-language")
                }
                .task { await catalog.refresh(); await podcasts.refresh() }
                .tint(TifloVisual.actionTint)
                .environment(\.defaultMinListRowHeight, 48)
                .environment(\.locale, Locale(identifier: NativeAppLanguage.code(for: languageIndex)))
                .tifloVisualPreferences()
                .preferredColorScheme(schemeIndex == 1 ? .light : schemeIndex == 2 ? .dark : nil)
            }
        }
    }
}
