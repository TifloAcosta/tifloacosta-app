import AppIntents
import Foundation

/// Siri/Shortcuts opens native destinations without requiring an external service.
enum NativeShortcutRoute {
    static let key = "native-ios-pending-shortcut-route-v1"
    static func request(_ route: String) {
        UserDefaults.standard.set(route, forKey: key)
        NotificationCenter.default.post(name: .nativeShortcutRouteRequested, object: nil)
    }
}

extension Notification.Name {
    static let nativeShortcutRouteRequested = Notification.Name("NativeShortcutRouteRequested")
}

struct NativeOpenNewsIntent: AppIntent {
    static var title: LocalizedStringResource = "Abrir Actualidad en TifloAcosta"
    static var description = IntentDescription("Abre la sección Actualidad de TifloAcosta.")
    static var openAppWhenRun: Bool = true

    func perform() async throws -> some IntentResult {
        NativeShortcutRoute.request("actualidad")
        return .result()
    }
}

struct NativeOpenReaderIntent: AppIntent {
    static var title: LocalizedStringResource = "Abrir TifloLector"
    static var description = IntentDescription("Abre la biblioteca de TifloLector en TifloAcosta.")
    static var openAppWhenRun: Bool = true

    func perform() async throws -> some IntentResult {
        NativeShortcutRoute.request("tifloLector")
        return .result()
    }
}

struct NativeResumeReaderIntent: AppIntent {
    static var title: LocalizedStringResource = "Continuar el último libro en TifloLector"
    static var description = IntentDescription("Reanuda el último libro abierto, desde la posición guardada.")
    static var openAppWhenRun: Bool = true

    func perform() async throws -> some IntentResult {
        NativeShortcutRoute.request("resumeReader")
        return .result()
    }
}

struct NativeOpenVideosIntent: AppIntent {
    static var title: LocalizedStringResource = "Abrir vídeos de TifloAcosta"
    static var description = IntentDescription("Abre los vídeos accesibles de TifloAcosta.")
    static var openAppWhenRun: Bool = true

    func perform() async throws -> some IntentResult {
        NativeShortcutRoute.request("videos")
        return .result()
    }
}

struct NativeTifloAppShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: NativeOpenNewsIntent(),
            phrases: ["Abre Actualidad en \(.applicationName)"],
            shortTitle: "Abrir Actualidad",
            systemImageName: "newspaper"
        )
        AppShortcut(
            intent: NativeOpenReaderIntent(),
            phrases: ["Abre TifloLector en \(.applicationName)"],
            shortTitle: "Abrir TifloLector",
            systemImageName: "books.vertical"
        )
        AppShortcut(
            intent: NativeResumeReaderIntent(),
            phrases: ["Continúa el libro en \(.applicationName)"],
            shortTitle: "Continuar libro",
            systemImageName: "book"
        )
        AppShortcut(
            intent: NativeOpenVideosIntent(),
            phrases: ["Abre vídeos en \(.applicationName)"],
            shortTitle: "Abrir vídeos",
            systemImageName: "play.rectangle"
        )
    }
}
