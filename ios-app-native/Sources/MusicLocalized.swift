import Foundation

/// Build translated VoiceOver labels with names and artists inserted safely.
enum MusicLocalized {
    static func message(_ key: String) -> String {
        NativeAppLanguage.message(key, languageCode: NativeAppLanguage.code(for:
            UserDefaults.standard.integer(forKey: NativeAppLanguage.storageKey)))
    }

    static func format(_ key: String, _ arguments: CVarArg...) -> String {
        let code = NativeAppLanguage.code(for: UserDefaults.standard.integer(forKey: NativeAppLanguage.storageKey))
        let template = message(key)
        return String(format: template, locale: Locale(identifier: code), arguments: arguments)
    }
}
