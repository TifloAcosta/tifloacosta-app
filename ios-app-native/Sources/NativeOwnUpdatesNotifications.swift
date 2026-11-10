import Foundation
import Combine
import UserNotifications

/// Quiet delivery in Notification Center while the app is foregrounded.
/// VoiceOver is not interrupted by a banner while the user is reading.
final class NativeLocalNotificationDelegate: NSObject, UNUserNotificationCenterDelegate {
    static let shared = NativeLocalNotificationDelegate()

    func userNotificationCenter(_ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        completionHandler([.list])
    }
}

/// Opt-in local notifications for *own* TifloAcosta documents and channel
/// videos only. External news, podcast RSS and third-party feeds are excluded.
@MainActor
final class NativeOwnUpdatesNotifications: ObservableObject {
    static let shared = NativeOwnUpdatesNotifications()

    @Published private(set) var enabled: Bool
    @Published var status = ""

    private let enabledKey = "native-own-updates-notifications-enabled-v1"
    private let seenKey = "native-own-updates-notifications-seen-v1"

    private init() {
        enabled = UserDefaults.standard.bool(forKey: enabledKey)
    }

    func enable() async {
        do {
            let accepted = try await UNUserNotificationCenter.current()
                .requestAuthorization(options: [.alert, .badge, .sound])
            enabled = accepted
            UserDefaults.standard.set(accepted, forKey: enabledKey)
            status = accepted
                ? "Avisos activados para novedades propias de TifloAcosta."
                : "No se ha concedido permiso para los avisos. Puedes revisarlo en Ajustes de iOS."
        } catch {
            enabled = false
            UserDefaults.standard.set(false, forKey: enabledKey)
            status = "No se pudieron activar los avisos: \(error.localizedDescription)"
        }
    }

    func disable() {
        enabled = false
        UserDefaults.standard.set(false, forKey: enabledKey)
        status = "Avisos automáticos desactivados."
    }

    /// Runs only when the app successfully refreshes its native catalog.
    /// First refresh establishes a baseline, never alerts about old items.
    func checkOwnContent(resources: [NativeCatalogItem],
                         videos: [NativeCatalogItem]) async {
        let ownDocuments = resources.filter {
            $0.isNew == true && $0.resourceURL != nil
        }.map { ("document:" + $0.id + ":" + ($0.lang ?? ""), $0.title) }
        let ownVideos = videos.filter { $0.videoURL != nil }
            .map { ("video:" + $0.id, $0.title) }
        let candidates = ownDocuments + ownVideos
        let defaults = UserDefaults.standard
        let existing = defaults.stringArray(forKey: seenKey)
        var seen = Set(existing ?? [])
        let additions = candidates.filter { !seen.contains($0.0) }
        for item in candidates { seen.insert(item.0) }
        defaults.set(Array(seen).sorted(), forKey: seenKey)

        guard existing != nil, enabled, !additions.isEmpty else { return }
        let settings = await UNUserNotificationCenter.current().notificationSettings()
        guard settings.authorizationStatus == .authorized ||
              settings.authorizationStatus == .provisional else {
            status = "Los avisos están bloqueados en Ajustes de iOS."
            return
        }
        // One digest prevents a burst of individual alerts after a refresh.
        let content = UNMutableNotificationContent()
        content.title = "Novedades de TifloAcosta"
        if additions.count == 1, let only = additions.first {
            content.body = only.1
        } else {
            content.body = "Hay \(additions.count) nuevas incorporaciones propias: documentos o vídeos."
        }
        content.sound = .default
        let request = UNNotificationRequest(
            identifier: "tiflo-own-updates-" + UUID().uuidString,
            content: content, trigger: nil
        )
        do {
            try await UNUserNotificationCenter.current().add(request)
        } catch {
            status = "No se pudo mostrar el aviso: \(error.localizedDescription)"
        }
    }
}
