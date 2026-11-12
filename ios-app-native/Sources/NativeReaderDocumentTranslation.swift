import SwiftUI
import Translation

/// Translates an imported text as a new library entry without modifying the original.
@available(iOS 18.0, *)
struct NativeReaderDocumentTranslationScreen: View {
    let document: NativeReadingDocument
    let saveTranslation: (String, String) throws -> Void

    @Environment(\.dismiss) private var dismiss
    @AppStorage("native-ios-language") private var appLanguageIndex = 0
    @State private var targetLanguage = "es"
    @State private var configuration: TranslationSession.Configuration?
    @State private var isTranslating = false
    @State private var completed = 0
    @State private var total = 0
    @State private var translationError: String?
    @State private var finished = false

    private let choices = ["es", "en", "fr", "pt"]

    private func chunks(_ text: String, maximum: Int = 1800) -> [String] {
        // Keep paragraph boundaries and preserve empty lines when possible.
        var result: [String] = []
        var current = ""
        for line in text.components(separatedBy: "\n") {
            let next = line + "\n"
            if !current.isEmpty && current.count + next.count > maximum {
                result.append(current)
                current = ""
            }
            if next.count > maximum {
                var remaining = next[...]
                while !remaining.isEmpty {
                    let end = remaining.index(remaining.startIndex,
                                              offsetBy: maximum,
                                              limitedBy: remaining.endIndex) ?? remaining.endIndex
                    result.append(String(remaining[..<end]))
                    remaining = remaining[end...]
                }
            } else {
                current += next
            }
        }
        if !current.isEmpty { result.append(current) }
        return result
    }

    private func beginTranslation() {
        guard !isTranslating, !document.body.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            translationError = String(localized: "No hay texto que traducir en este documento.")
            return
        }
        translationError = nil
        completed = 0
        total = 0
        isTranslating = true
        configuration = TranslationSession.Configuration(
            source: nil, target: Locale.Language(identifier: targetLanguage)
        )
    }

    var body: some View {
        Form {
            Section {
                Text(document.title)
                Picker("Idioma de destino", selection: $targetLanguage) {
                    Text("Español").tag("es")
                    Text("Inglés").tag("en")
                    Text("Francés").tag("fr")
                    Text("Portugués").tag("pt")
                }
                .disabled(isTranslating)
                Text("Se guardará una copia traducida en la biblioteca. El documento original no se modifica.")
                    .font(.footnote)
                Button("Traducir documento") { beginTranslation() }
                    .disabled(isTranslating || finished || document.body.isEmpty)
            }
            if isTranslating {
                Section("Progreso de la traducción") {
                    ProgressView(value: Double(completed), total: Double(max(total, 1)))
                    Text("\(completed) de \(total) fragmentos")
                        .accessibilityLabel(Text("Fragmentos traducidos: \(completed) de \(total)"))
                }
            }
            if finished {
                Section {
                    Text("Traducción guardada en la biblioteca.")
                    Button("Cerrar") { dismiss() }
                }
            }
            if let translationError {
                Section {
                    Text(translationError).foregroundStyle(.red)
                }
            }
        }
        .navigationTitle("Traducir documento")
        .onAppear { targetLanguage = appLanguageIndex == 1 ? "en" : "es" }
        .translationTask(configuration) { session in
            let portions = chunks(document.body)
            total = portions.count
            var translated = ""
            do {
                for portion in portions {
                    try Task.checkCancellation()
                    let response = try await session.translate(portion)
                    translated += response.targetText
                    completed += 1
                }
                let languageName = Locale.current.localizedString(forLanguageCode: targetLanguage)
                    ?? targetLanguage.uppercased()
                try saveTranslation(translated, "\(document.title) (\(languageName))")
                finished = true
            } catch is CancellationError {
                translationError = String(localized: "Traducción cancelada.")
            } catch {
                translationError = error.localizedDescription
            }
            isTranslating = false
            configuration = nil
        }
    }
}
