import Foundation

/// Build translated VoiceOver labels with names and artists inserted safely.
enum MusicLocalized {
    static func format(_ key: String, _ arguments: CVarArg...) -> String {
        String(format: NSLocalizedString(key, comment: "Mi Música"),
               locale: Locale.current, arguments: arguments)
    }
}
