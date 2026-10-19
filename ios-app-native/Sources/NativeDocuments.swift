import SwiftUI
import Foundation
import UIKit
import PDFKit

/// Convert remote HTML document DATA to readable text; never display HTML UI.
/// Paragraph boundaries are preserved so a long guide can render lazily.
enum NativeDocumentText {
    static func extract(_ data: Data, from url: URL) -> String {
        switch url.pathExtension.lowercased() {
        case "pdf":
            return PDFDocument(data: data)?.string?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        case "txt":
            return (String(data: data, encoding: .utf8)
                ?? String(data: data, encoding: .utf16)
                ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        case "rtf":
            if let result = try? NSAttributedString(
                data: data,
                options: [.documentType: NSAttributedString.DocumentType.rtf],
                documentAttributes: nil
            ) {
                return result.string.trimmingCharacters(in: .whitespacesAndNewlines)
            }
            return ""
        default:
            break
        }

        var content = String(data: data, encoding: .utf8)
            ?? String(decoding: data, as: UTF8.self)

        // Large TifloAcosta courses contain substantial CSS in <head>.
        // Exclude it BEFORE extracting the text; the former attributed-HTML
        // conversion could leave a blank SwiftUI reading screen.
        for pattern in [
            "(?is)<!\\-\\-[\\s\\S]*?\\-\\->",
            "(?is)<head\\b[^>]*>.*?</head\\s*>",
            "(?is)<(script|style|template|svg|noscript)\\b[^>]*>.*?</\\1\\s*>"
        ] {
            content = content.replacingOccurrences(
                of: pattern, with: " ", options: .regularExpression
            )
        }
        content = content.replacingOccurrences(
            of: "(?i)<br\\s*/?>", with: "\n", options: .regularExpression
        )
        content = content.replacingOccurrences(
            of: "(?i)</?(?:p|h[1-6]|li|div|section|article|blockquote|tr|ul|ol)\\b[^>]*>",
            with: "\n\n", options: .regularExpression
        )
        content = content.replacingOccurrences(
            of: "(?s)<[^>]*>", with: " ", options: .regularExpression
        )
        content = decodeEntities(content)

        let paragraphs = content.components(separatedBy: .newlines).compactMap { line -> String? in
            let clean = line.replacingOccurrences(
                of: "[ \\t\\r]+", with: " ", options: .regularExpression
            ).trimmingCharacters(in: .whitespacesAndNewlines)
            return clean.isEmpty ? nil : clean
        }
        return paragraphs.joined(separator: "\n\n")
    }

    private static func decodeEntities(_ text: String) -> String {
        let named = [
            "amp": "&", "lt": "<", "gt": ">", "quot": "\"",
            "apos": "'", "nbsp": " ", "ndash": "–", "mdash": "—",
            "hellip": "…", "laquo": "«", "raquo": "»",
            "aacute": "á", "eacute": "é", "iacute": "í",
            "oacute": "ó", "uacute": "ú", "ntilde": "ñ"
        ]
        guard let expression = try? NSRegularExpression(
            pattern: "&(#x[0-9a-fA-F]+|#[0-9]+|[A-Za-z][A-Za-z0-9]+);"
        ) else { return text }
        let matches = expression.matches(
            in: text, range: NSRange(text.startIndex..., in: text)
        )
        var result = text
        for match in matches.reversed() {
            guard let entityRange = Range(match.range(at: 1), in: text),
                  let fullRange = Range(match.range, in: result) else { continue }
            let entity = String(text[entityRange])
            var replacement = named[entity.lowercased()]
            if replacement == nil {
                let digits: String
                let radix: Int
                if entity.hasPrefix("#x") || entity.hasPrefix("#X") {
                    digits = String(entity.dropFirst(2))
                    radix = 16
                } else if entity.hasPrefix("#") {
                    digits = String(entity.dropFirst())
                    radix = 10
                } else {
                    continue
                }
                if let scalarValue = UInt32(digits, radix: radix),
                   let scalar = UnicodeScalar(scalarValue) {
                    replacement = String(scalar)
                }
            }
            if let replacement {
                result.replaceSubrange(fullRange, with: replacement)
            }
        }
        return result
    }
}

struct NativeRemoteResourceScreen: View {
    let item: NativeCatalogItem
    @EnvironmentObject private var library: NativeReaderLibrary
    @EnvironmentObject private var resourceService: NativeResourceService
    @StateObject private var speech = NativeReadingSpeech()
    @State private var documentText = ""
    @State private var paragraphs: [String] = []
    @State private var loading = true
    @State private var error: String?
    @State private var status: String?
    @State private var busy = false
    @State private var imported = false

    private func announce(_ message: String) {
        status = message
        UIAccessibility.post(notification: .announcement, argument: message)
    }

    private func load() async {
        loading = true
        error = nil
        defer { loading = false }
        do {
            let text = try await resourceService.text(for: item)
            documentText = text
            paragraphs = text.components(separatedBy: "\n\n").filter { !$0.isEmpty }
            if paragraphs.isEmpty { throw NativeResourceError.emptyDocument }
        } catch {
            self.error = "No se pudo leer este documento: \(error.localizedDescription)"
        }
    }

    private func readAloud() {
        guard !documentText.isEmpty else {
            announce("El documento aún no está disponible para leer.")
            return
        }
        speech.play(documentText)
        announce("Lectura iniciada.")
    }

    private func saveInReader() {
        guard !busy && !imported else { return }
        busy = true
        Task {
            defer { busy = false }
            do {
                try await resourceService.saveInReader(item, library: library)
                imported = true
                announce("Documento guardado en TifloLector.")
            } catch {
                announce("No se pudo guardar: \(error.localizedDescription)")
            }
        }
    }

    private func download() {
        guard !busy else { return }
        busy = true
        Task {
            defer { busy = false }
            do {
                try await resourceService.exportToFiles(item)
                announce("Selecciona la ubicación para descargar el archivo.")
            } catch {
                announce("No se pudo descargar: \(error.localizedDescription)")
            }
        }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text(item.title)
                    .font(.title2).bold()
                    .accessibilityAddTraits(.isHeader)
                    .accessibilityAction(named: Text("Leer")) { readAloud() }
                    .accessibilityAction(named: Text("Guardar")) { saveInReader() }
                    .accessibilityAction(named: Text("Descargar")) { download() }
                    .accessibilityAction(named: Text("Compartir")) {
                        if let url = item.resourceURL { NativeShare.present(url: url) }
                    }

                if loading { ProgressView("Abriendo recurso") }

                if let error {
                    Text(error).foregroundStyle(.secondary)
                    if let url = item.resourceURL {
                        Button("Abrir fuente externa") {
                            UIApplication.shared.open(url)
                        }
                    }
                    Button("Reintentar lectura") { Task { await load() } }
                }

                if !documentText.isEmpty {
                    VStack(alignment: .leading, spacing: 10) {
                        Button("Leer en voz alta") { readAloud() }
                        Button("Detener lectura") { speech.stop() }
                        Button(imported ? "Guardado en TifloLector" : "Guardar en TifloLector") {
                            saveInReader()
                        }
                        .disabled(imported || busy)
                        Button("Descargar en Archivos") { download() }
                            .disabled(busy)
                    }
                    .buttonStyle(.bordered)

                    // Thousands of paragraphs must not become one oversized Text view.
                    LazyVStack(alignment: .leading, spacing: 12) {
                        ForEach(paragraphs.indices, id: \.self) { index in
                            Text(paragraphs[index])
                                .font(.body)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .textSelection(.enabled)
                        }
                    }
                }

                if let status {
                    Text(status).font(.footnote).foregroundStyle(.secondary)
                }
            }
            .padding()
        }
        .navigationTitle(item.title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if let url = item.resourceURL {
                Button("Compartir", systemImage: "square.and.arrow.up") {
                    NativeShare.present(url: url)
                }
            }
        }
        .task(id: item.id) { await load() }
        .onDisappear { speech.stop() }
    }
}
