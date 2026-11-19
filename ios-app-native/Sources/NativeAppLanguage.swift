import Foundation

/// Stable index mapping: 0 = Spanish and 1 = English were already persisted
/// in released builds. Never reorder these values when adding languages.
enum NativeAppLanguage {
    static let codes = ["es", "en", "pt", "fr", "it", "de"]
    static let names = ["Español", "English", "Português", "Français", "Italiano", "Deutsch"]
    static let storageKey = "native-ios-language"

    static func index(for languageIdentifier: String) -> Int? {
        // Covers regional identifiers such as pt-BR, fr-CA and de-DE.
        let code = languageIdentifier.lowercased()
            .replacingOccurrences(of: "_", with: "-")
            .split(separator: "-").first.map(String.init) ?? ""
        return codes.firstIndex(of: code)
    }

    static func preferredIndex(_ languages: [String]) -> Int {
        for language in languages {
            if let index = index(for: language) { return index }
        }
        return 0
    }

    static func initializeIfMissing(defaults: UserDefaults = .standard,
                                    preferredLanguages: [String] = Locale.preferredLanguages) {
        // An existing user-selected Spanish/English index is never overwritten.
        guard defaults.object(forKey: storageKey) == nil else { return }
        defaults.set(preferredIndex(preferredLanguages), forKey: storageKey)
    }

    /// UIAccessibility announcements are plain strings, so the SwiftUI locale
    /// environment cannot localize them automatically. Resolve against the
    /// language explicitly selected inside the app instead of the phone locale.
    static func message(_ key: String, languageCode: String) -> String {
        guard let path = Bundle.main.path(forResource: languageCode, ofType: "lproj"),
              let bundle = Bundle(path: path) else { return key }
        return bundle.localizedString(forKey: key, value: key, table: nil)
    }

    static func code(for index: Int) -> String {
        codes.indices.contains(index) ? codes[index] : "es"
    }
}
