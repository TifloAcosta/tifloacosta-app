import AppIntents
import Foundation
import SwiftUI
import UIKit

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


/// The reader owns the live playback cursor. The shortcut only asks that
/// active reader to save a bookmark; it never pauses or restarts speech.
@MainActor
enum NativeQuickBookmarkBridge {
    static var saveActiveReader: (() -> Void)?

    static func save() {
        if let saveActiveReader {
            saveActiveReader()
        } else {
            let message = NativeAppLanguage.message(
                "Abre un libro en TifloLector para crear una marca.",
                languageCode: NativeAppLanguage.code(for: UserDefaults.standard.integer(forKey: "native-ios-language"))
            )
            UIAccessibility.post(notification: .announcement, argument: message)
        }
    }
}

struct NativeCreateBookmarkIntent: AppIntent {
    static var title: LocalizedStringResource = "Crear marca en TifloLector"
    static var description = IntentDescription(
        "Guarda una marca en la posición actual sin interrumpir la reproducción."
    )
    static var openAppWhenRun: Bool = true

    func perform() async throws -> some IntentResult {
        NativeShortcutRoute.request("createBookmark")
        return .result()
    }
}

struct NativeQuickBookmarkHelpScreen: View {
    @Environment(\.openURL) private var openURL

    var body: some View {
        List {
            Section("Preparar el atajo") {
                Text("En Atajos, crea uno nuevo, añade la acción Crear marca en TifloLector y guárdalo con ese nombre.")
                Button("Abrir Atajos") {
                    guard let url = URL(string: "shortcuts://") else { return }
                    openURL(url)
                }
            }
            Section("Triple toque posterior") {
                Text("Ve a Ajustes del iPhone, Accesibilidad, Tocar, Tocar atrás y Triple toque. Selecciona el atajo Crear marca en TifloLector.")
            }
            Section("Botón de Acción") {
                Text("Ve a Ajustes del iPhone, Botón de Acción, Atajo y selecciona Crear marca en TifloLector.")
            }
            Section("Durante la lectura") {
                Text("Con un libro abierto, ejecuta el atajo para guardar la posición sin detener la reproducción. También puedes utilizar la acción Crear marca del rotor de VoiceOver.")
            }
        }
        .tifloScreenSurface()
        .navigationTitle("Creación rápida de marcas")
        .navigationBarTitleDisplayMode(.inline)
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
            intent: NativeCreateBookmarkIntent(),
            phrases: ["Crea una marca en \(.applicationName)"],
            shortTitle: "Crear marca",
            systemImageName: "bookmark"
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
