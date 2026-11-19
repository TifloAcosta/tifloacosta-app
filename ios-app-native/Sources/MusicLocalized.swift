import Foundation

/// Las etiquetas dinámicas se traducen antes de incorporar nombres propios.
/// El idioma procede de la configuración regional del sistema iOS.
enum MusicLocalized {
    static func format(_ key: String, _ arguments: CVarArg...) -> String {
        let template = NSLocalizedString(key, comment: "Mi Música")
        return String(format: template, locale: Locale.current, arguments: arguments)
    }
}
