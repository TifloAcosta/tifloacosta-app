import Foundation
import NaturalLanguage
import Capacitor
import SwiftUI
import Translation

/// Uses Apple's on-device Translation framework, never a browser or remote translator.
@objc(TifloReadingLanguagePlugin)
public final class TifloReadingLanguagePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "TifloReadingLanguagePlugin"
    public let jsName = "TifloReadingLanguage"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "identifyLanguage", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "listTranslationLanguages", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "prepareTranslationPair", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "downloadTranslationModel", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "translateBatch", returnType: CAPPluginReturnPromise)
    ]

    @objc public func identifyLanguage(_ call: CAPPluginCall) {
        let input = call.getString("text") ?? ""
        let identified = NLLanguageRecognizer.dominantLanguage(for: input)?.rawValue ?? "und"
        call.resolve(["language": identified])
    }

    @objc public func listTranslationLanguages(_ call: CAPPluginCall) {
        guard #available(iOS 18.0, *) else {
            call.resolve(["languages": []])
            return
        }
        Task { @MainActor in
            let all = await LanguageAvailability().supportedLanguages
            let codes = Set(all.compactMap { $0.languageCode?.identifier.lowercased() })
            call.resolve(["languages": codes.sorted()])
        }
    }

    /// The system authorizes downloads by language PAIR through translationTask.
    @objc public func prepareTranslationPair(_ call: CAPPluginCall) {
        let sourceCode = (call.getString("sourceLanguage") ?? "").trimmingCharacters(in: .whitespaces)
        let targetCode = (call.getString("targetLanguage") ?? "").trimmingCharacters(in: .whitespaces)
        guard !sourceCode.isEmpty, !targetCode.isEmpty, sourceCode != targetCode else {
            call.resolve(["ready": false])
            return
        }
        guard #available(iOS 18.0, *) else {
            call.resolve(["ready": false])
            return
        }

        Task { @MainActor in
            let source = Locale.Language(identifier: sourceCode)
            let target = Locale.Language(identifier: targetCode)
            let status = await LanguageAvailability().status(from: source, to: target)
            if status == .installed {
                call.resolve(["ready": true])
                return
            }
            if status == .unsupported {
                call.resolve(["ready": false])
                return
            }
            guard let presenter = self.bridge?.viewController else {
                call.resolve(["ready": false])
                return
            }
            var host: UIViewController?
            let view = TifloLanguagePreparationView(source: source, target: target) { prepared in
                host?.dismiss(animated: true)
                call.resolve(["ready": prepared])
            }
            let controller = UIHostingController(rootView: view)
            controller.modalPresentationStyle = .formSheet
            controller.isModalInPresentation = true
            host = controller
            presenter.present(controller, animated: true)
        }
    }

    @objc public func downloadTranslationModel(_ call: CAPPluginCall) {
        // A single-language download is not the iOS Translation API contract.
        // JavaScript calls prepareTranslationPair(sourceLanguage,targetLanguage).
        call.resolve(["downloaded": false])
    }

    @objc public func translateBatch(_ call: CAPPluginCall) {
        let sourceCode = call.getString("sourceLanguage") ?? ""
        let targetCode = call.getString("targetLanguage") ?? ""
        let texts = call.getArray("texts") as? [String] ?? []
        guard !sourceCode.isEmpty, !targetCode.isEmpty, sourceCode != targetCode,
              !texts.isEmpty, texts.count <= 50 else {
            call.resolve(["translations": [], "status": "error"])
            return
        }
        guard #available(iOS 18.0, *) else {
            call.resolve(["translations": [], "status": "unsupported-language"])
            return
        }

        Task { @MainActor in
            let source = Locale.Language(identifier: sourceCode)
            let target = Locale.Language(identifier: targetCode)
            let status = await LanguageAvailability().status(from: source, to: target)
            guard status == .installed else {
                call.resolve([
                    "translations": [],
                    "status": status == .supported ? "model-unavailable" : "unsupported-language"
                ])
                return
            }
            let session = TranslationSession(installedSource: source, target: target)
            do {
                var results: [String] = []
                results.reserveCapacity(texts.count)
                // Batches are small and bounded; preserve source order for the reader.
                for value in texts {
                    let translated = try await session.translate(value)
                    results.append(translated.targetText)
                }
                call.resolve(["translations": results, "status": "ok"])
            } catch {
                call.resolve(["translations": [], "status": "error"])
            }
        }
    }
}

/// Native, accessible download consent: the system controls the download prompt.
@available(iOS 18.0, *)
private struct TifloLanguagePreparationView: View {
    let source: Locale.Language
    let target: Locale.Language
    let completion: (Bool) -> Void
    @State private var finished = false

    private func finish(_ result: Bool) {
        guard !finished else { return }
        finished = true
        completion(result)
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 20) {
                Text("Preparando traducción")
                    .font(.headline)
                    .accessibilityAddTraits(.isHeader)
                ProgressView()
                    .accessibilityLabel("Preparando los idiomas de traducción")
                Text("iOS puede solicitar autorización para descargar los idiomas.")
            }
            .padding()
            .navigationTitle("Traducir con iOS")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancelar") { finish(false) }
                }
            }
            .translationTask(source: source, target: target) { session in
                do {
                    try await session.prepareTranslation()
                    finish(true)
                } catch {
                    finish(false)
                }
            }
        }
    }
}
