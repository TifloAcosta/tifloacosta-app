import Foundation
import SwiftUI
import Translation

/// The original catalog text is never modified or automatically translated.
/// The user must press the translation button to initiate any model download
/// or translation, and can always return to the unmodified original.
struct NativeOnDemandTranslationScreen: View {
    let title: String
    let originalText: String
    let sourceLanguage: String?
    let targetLanguage: String

    @State private var configuration: TranslationSession.Configuration?
    @State private var translatedParagraphs: [String] = []
    @State private var translatedCount = 0
    @State private var isTranslating = false
    @State private var finished = false
    @State private var showingOriginal = false
    @State private var errorMessage: String?

    private var targetName: String {
        Locale(identifier: "es").localizedString(forLanguageCode: targetLanguage)
            ?? targetLanguage
    }

    /// Keep translation requests bounded without silently discarding text.
    /// Split long paragraphs on character boundaries (not UTF-8 bytes).
    static func segments(_ text: String, limit: Int = 1400) -> [String] {
        guard limit > 0 else { return [] }
        let paragraphs = text.components(separatedBy: "\n\n")
        var result: [String] = []
        for paragraph in paragraphs {
            var remaining = paragraph.trimmingCharacters(in: .whitespacesAndNewlines)
            while !remaining.isEmpty {
                let piece = String(remaining.prefix(limit))
                result.append(piece)
                remaining.removeFirst(piece.count)
            }
        }
        return result
    }

    private var segments: [String] { Self.segments(originalText) }

    private func beginTranslation() {
        guard !isTranslating && !segments.isEmpty else { return }
        translatedParagraphs = []
        translatedCount = 0
        finished = false
        errorMessage = nil
        showingOriginal = false
        isTranslating = true
        let source = sourceLanguage.flatMap { $0.isEmpty ? nil : Locale.Language(identifier: $0) }
        let target = Locale.Language(identifier: targetLanguage)
        if configuration == nil {
            configuration = TranslationSession.Configuration(source: source, target: target)
        } else {
            configuration?.invalidate()
        }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                Text(title).font(.title3.bold())
                    .accessibilityAddTraits(.isHeader)
                Text("Idioma solicitado: \(targetName)")
                    .font(.subheadline).foregroundStyle(.secondary)
                Text("El documento original se conserva. La traducción solo comienza cuando la solicitas.")
                    .font(.footnote).foregroundStyle(.secondary)

                Button(finished ? "Volver a traducir" : "Traducir ahora") {
                    beginTranslation()
                }
                .disabled(isTranslating || segments.isEmpty)

                if isTranslating {
                    ProgressView("Traduciendo fragmento \(min(translatedCount + 1, segments.count)) de \(segments.count)")
                        .accessibilityLabel("Traducción en curso, \(translatedCount) de \(segments.count) fragmentos terminados")
                }
                if let errorMessage {
                    Text(errorMessage).foregroundStyle(.secondary)
                        .accessibilityAddTraits(.updatesFrequently)
                }
                if finished {
                    Button(showingOriginal ? "Mostrar traducción" : "Mostrar texto original") {
                        showingOriginal.toggle()
                    }
                    Text(showingOriginal ? "Texto original" : "Texto traducido")
                        .font(.headline)
                    Text(showingOriginal ? originalText : translatedParagraphs.joined(separator: "\n\n"))
                        .textSelection(.enabled)
                        .frame(maxWidth: .infinity, alignment: .leading)
                } else if !isTranslating {
                    Text("Pulsa «Traducir ahora» para solicitar la traducción.")
                        .font(.footnote).foregroundStyle(.secondary)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding()
        }
        .tifloScreenSurface()
        .navigationTitle("Traducir contenido")
        .navigationBarTitleDisplayMode(.inline)
        .translationTask(configuration) { session in
            await MainActor.run {
                translatedParagraphs = []
                translatedCount = 0
                errorMessage = nil
                finished = false
            }
            do {
                for segment in segments {
                    try Task.checkCancellation()
                    let response = try await session.translate(segment)
                    await MainActor.run {
                        translatedParagraphs.append(response.targetText)
                        translatedCount += 1
                    }
                }
                await MainActor.run {
                    isTranslating = false
                    finished = true
                    UIAccessibility.post(notification: .announcement,
                        argument: "Traducción terminada. Disponible en pantalla.")
                }
            } catch {
                await MainActor.run {
                    isTranslating = false
                    errorMessage = "No se pudo completar la traducción: \(error.localizedDescription). Puedes intentarlo nuevamente."
                    UIAccessibility.post(notification: .announcement,
                        argument: "No se pudo completar la traducción.")
                }
            }
        }
    }
}
