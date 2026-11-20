import Foundation

/// Build translated VoiceOver labels with names and artists inserted safely.
enum MusicLocalized {
    static func format(_ key: String, _ arguments: CVarArg...) -> String {
        let code = NativeAppLanguage.code(for: UserDefaults.standard.integer(forKey: NativeAppLanguage.storageKey))
        let template = NativeAppLanguage.message(key, languageCode: code)
        return String(format: template, locale: Locale(identifier: code), arguments: arguments)
    }
}
