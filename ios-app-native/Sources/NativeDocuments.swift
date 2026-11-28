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
        // Keep explicit HTML/XHTML headings visible in plain-text library records.
        // A Markdown heading marker is recognized by both reader navigation
        // and DAISY export; no title is inferred from visual styling.
        for level in 1...6 {
            content = content.replacingOccurrences(
                of: "(?i)<h\(level)\\b[^>]*>",
                with: "\n\n\(String(repeating: "#", count: level)) ",
                options: .regularExpression
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

    static func decodeEntities(_ text: String) -> String {
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

/// A native reading stop, either text or a real link. Never run document HTML.
struct NativeResourceReadingBlock: Sendable {
    let text: String
    let url: URL?

    private static func safeURL(_ url: URL) -> Bool {
        ["https", "http"].contains(url.scheme?.lowercased() ?? "") &&
            url.host != nil && url.user == nil && url.password == nil
    }

    private static func plainBlocks(_ text: String) -> [Self] {
        guard !text.isEmpty else { return [] }
        guard let detector = try? NSDataDetector(types: NSTextCheckingResult.CheckingType.link.rawValue)
        else { return [Self(text: text, url: nil)] }
        var result: [Self] = []
        var cursor = text.startIndex
        for match in detector.matches(in: text, range: NSRange(text.startIndex..., in: text)) {
            guard let url = match.url, safeURL(url),
                  let range = Range(match.range, in: text) else { continue }
            let prefix = String(text[cursor..<range.lowerBound]).trimmingCharacters(in: .whitespacesAndNewlines)
            if !prefix.isEmpty { result.append(Self(text: prefix, url: nil)) }
            result.append(Self(text: String(text[range]), url: url))
            cursor = range.upperBound
        }
        let suffix = String(text[cursor...]).trimmingCharacters(in: .whitespacesAndNewlines)
        if !suffix.isEmpty { result.append(Self(text: suffix, url: nil)) }
        return result
    }

    static func make(data: Data, source: URL, fallback: String) -> [Self] {
        let plain = fallback.components(separatedBy: "\n\n").flatMap(plainBlocks)
        guard !["pdf", "txt", "rtf"].contains(source.pathExtension.lowercased()) else { return plain }
        var html = String(data: data, encoding: .utf8) ?? String(decoding: data, as: UTF8.self)
        // Remove non-reading markup before inspecting anchors; nothing is executed.
        for pattern in [
            #"(?is)<!--.*?-->"#,
            #"(?is)<head\b[^>]*>.*?</head\s*>"#,
            #"(?is)<(script|style|template|svg|noscript)\b[^>]*>.*?</\1\s*>"#
        ] {
            html = html.replacingOccurrences(of: pattern, with: " ", options: .regularExpression)
        }
        // Only recognize explicit anchors, not arbitrary strings that resemble URLs.
        guard let anchors = try? NSRegularExpression(
            pattern: #"(?is)<a\b((?:[^>"']|"[^"]*"|'[^']*')*)>(.*?)</a\s*>"#),
              let href = try? NSRegularExpression(
                pattern: #"(?is)(?:^|\s)href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>]+))"#)
        else { return plain }
        let matches = anchors.matches(in: html, range: NSRange(html.startIndex..., in: html))
        guard !matches.isEmpty else { return plain }
        let marker = "TIFLOLINK" + UUID().uuidString.replacingOccurrences(of: "-", with: "") + "X"
        var links: [String: Self] = [:]
        var tagged = html
        let htmlSource = URL(fileURLWithPath: "/resource.html")
        for (index, match) in matches.enumerated().reversed() {
            guard let attrsRange = Range(match.range(at: 1), in: html),
                  let labelRange = Range(match.range(at: 2), in: html),
                  let full = Range(match.range, in: tagged) else { continue }
            let attrs = String(html[attrsRange])
            guard let found = href.firstMatch(in: attrs, range: NSRange(attrs.startIndex..., in: attrs)),
                  let valueRange = (1...3).compactMap({ Range(found.range(at: $0), in: attrs) }).first
            else { continue }
            let raw = NativeDocumentText.decodeEntities(String(attrs[valueRange]))
                .trimmingCharacters(in: .whitespacesAndNewlines)
            guard !raw.isEmpty,
                  let url = URL(string: raw, relativeTo: source)?.absoluteURL,
                  ["https", "http"].contains(url.scheme?.lowercased() ?? ""),
                  url.host != nil, url.user == nil, url.password == nil else { continue }
            let label = NativeDocumentText.extract(Data(html[labelRange].utf8), from: htmlSource)
                .replacingOccurrences(of: "\n\n", with: " ")
            let token = marker + String(index) + "END"
            links[token] = Self(text: label.isEmpty ? url.absoluteString : label, url: url)
            tagged.replaceSubrange(full, with: "\n\n" + token + "\n\n")
        }
        guard !links.isEmpty else { return plain }
        let text = NativeDocumentText.extract(Data(tagged.utf8), from: htmlSource)
        return text.components(separatedBy: "\n\n").flatMap { paragraph in
            if let link = links[paragraph] { return [link] }
            return plainBlocks(paragraph)
        }
    }
}

struct NativeRemoteResourceScreen: View {
    let item: NativeCatalogItem
    @EnvironmentObject private var library: NativeReaderLibrary
    @EnvironmentObject private var resourceService: NativeResourceService
    @EnvironmentObject private var readingActivity: NativeReadingActivity
    @AppStorage("native-ios-language") private var languageIndex = 0
    @StateObject private var speech = NativeReadingSpeech()
    @State private var documentText = ""
    @State private var paragraphs: [NativeResourceReadingBlock] = []
    @State private var offlineSaved = false
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
            let (text, blocks) = try await resourceService.readingContent(for: item)
            documentText = text
            paragraphs = blocks
            offlineSaved = resourceService.isAvailableOffline(item)
            if paragraphs.isEmpty { throw NativeResourceError.emptyDocument }
        } catch {
            self.error = MusicLocalized.format("No se pudo leer este documento: %@", error.localizedDescription)
        }
    }

    private func readAloud() {
        guard !documentText.isEmpty else {
            announce(MusicLocalized.message("El documento aún no está disponible para leer."))
            return
        }
        speech.play(documentText)
        announce(MusicLocalized.message("Lectura iniciada."))
    }

    private func saveInReader() {
        guard !busy && !imported else { return }
        busy = true
        Task {
            defer { busy = false }
            do {
                try await resourceService.saveInReader(item, library: library)
                imported = true
                announce(MusicLocalized.message("Documento guardado en TifloLector."))
            } catch {
                announce(MusicLocalized.format("No se pudo guardar: %@", error.localizedDescription))
            }
        }
    }

    private func saveOffline(refresh: Bool = false) {
        guard !busy else { return }
        busy = true
        Task {
            defer { busy = false }
            do {
                try await resourceService.saveOffline(item, refresh: refresh)
                offlineSaved = true
                if refresh { await load() }
                announce(MusicLocalized.message("Disponible sin conexión"))
            } catch {
                announce(MusicLocalized.format("No se pudo guardar: %@", error.localizedDescription))
            }
        }
    }

    private func removeOffline() {
        guard !busy else { return }
        do {
            try resourceService.removeOffline(item)
            offlineSaved = false
            announce(MusicLocalized.message("Copia sin conexión eliminada"))
        } catch { announce(error.localizedDescription) }
    }

    private func download() {
        guard !busy else { return }
        busy = true
        Task {
            defer { busy = false }
            do {
                try await resourceService.exportToFiles(item)
                announce(MusicLocalized.message("Selecciona la ubicación para descargar el archivo."))
            } catch {
                announce(MusicLocalized.format("No se pudo descargar: %@", error.localizedDescription))
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
                        Button(MusicLocalized.message(readingActivity.isSaved(.resource, item: item)
                            ? "Quitar de Leer después" : "Guardar para leer después")) {
                            let saved = readingActivity.toggleReadLater(.resource, item: item)
                            announce(MusicLocalized.message(saved ? "Recurso guardado para leer después." :
                                "Recurso retirado de Leer después."))
                        }
                        if #available(iOS 18.0, *) {
                            NavigationLink("Traducir recurso al idioma de la aplicación") {
                                NativeOnDemandTranslationScreen(
                                    title: item.title,
                                    originalText: documentText,
                                    sourceLanguage: item.lang,
                                    targetLanguage: NativeAppLanguage.code(for: languageIndex)
                                )
                            }
                        }
                        Button("Leer en voz alta") { readAloud() }
                        Button("Detener lectura") { speech.stop() }
                        Button(MusicLocalized.message(imported ? "Guardado en TifloLector" : "Guardar en TifloLector")) {
                            saveInReader()
                        }
                        .disabled(imported || busy)
                        Button("Descargar en Archivos") { download() }
                            .disabled(busy)
                        if offlineSaved {
                            Text("Disponible sin conexión")
                            Button("Actualizar copia sin conexión") { saveOffline(refresh: true) }
                                .disabled(busy)
                            Button("Eliminar copia sin conexión") { removeOffline() }
                                .disabled(busy)
                        } else {
                            Button("Guardar sin conexión") { saveOffline() }
                                .disabled(busy)
                        }
                    }
                    .buttonStyle(TifloSecondaryActionStyle())

                    // Thousands of paragraphs must not become one oversized Text view.
                    LazyVStack(alignment: .leading, spacing: 12) {
                        ForEach(paragraphs.indices, id: \.self) { index in
                            if let url = paragraphs[index].url {
                                Link(paragraphs[index].text, destination: url)
                                    .accessibilityAddTraits(.isLink)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                            } else {
                                Text(paragraphs[index].text)
                                    .font(.body)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .textSelection(.enabled)
                            }
                        }
                    }
                }

                if let status {
                    Text(status).font(.footnote).foregroundStyle(.secondary)
                }
            }
            .padding()
        }
        .tifloScreenSurface()
        .navigationTitle(item.title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if let url = item.resourceURL {
                Button("Compartir", systemImage: "square.and.arrow.up") {
                    NativeShare.present(url: url)
                }
            }
        }
        .task(id: item.id) {
            readingActivity.markOpened(.resource, item: item)
            await load()
        }
        .onDisappear { speech.stop() }
    }
}
