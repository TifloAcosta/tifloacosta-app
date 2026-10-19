import Foundation
import PDFKit
import ZIPFoundation

/// Short, accessible preview shown INSIDE the share sheet. Full-library reading
/// stays in the containing app and uses the saved App Group file.
enum ShareReadingPreview {
    enum Failure: LocalizedError {
        case unsupported
        case empty
        case oversized

        var errorDescription: String? {
            switch self {
            case .unsupported: "No hay una vista de lectura disponible para este formato."
            case .empty: "El documento no contiene texto que se pueda leer en la vista rápida."
            case .oversized: "La vista rápida no puede procesar un capítulo tan grande."
            }
        }
    }

    static func text(for file: URL, named filename: String) throws -> String {
        let ext = URL(fileURLWithPath: filename).pathExtension.lowercased()
        let excerpt: String
        switch ext {
        case "epub":
            excerpt = try epubPreview(from: file)
        case "pdf":
            guard let pdf = PDFDocument(url: file) else { throw Failure.empty }
            excerpt = (0..<min(8, pdf.pageCount)).compactMap { pdf.page(at: $0)?.string }
                .joined(separator: "\n\n")
        case "txt", "text", "md", "markdown", "csv", "srt", "log":
            let data = try Data(contentsOf: file)
            excerpt = String(data: data, encoding: .utf8)
                ?? String(data: data, encoding: .utf16) ?? ""
        case "html", "htm":
            let data = try Data(contentsOf: file)
            excerpt = plainText(String(decoding: data, as: UTF8.self))
        case "rtf":
            let data = try Data(contentsOf: file)
            excerpt = (try? NSAttributedString(data: data,
                options: [.documentType: NSAttributedString.DocumentType.rtf],
                documentAttributes: nil))?.string ?? ""
        default:
            throw Failure.unsupported
        }
        let clean = excerpt.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !clean.isEmpty else { throw Failure.empty }
        return String(clean.prefix(30_000))
    }

    private static func epubPreview(from url: URL) throws -> String {
        guard let archive = Archive(url: url, accessMode: .read) else {
            throw Failure.unsupported
        }
        let pages = archive.filter { entry in
            let name = entry.path.lowercased()
            return entry.type == .file
                && (name.hasSuffix(".xhtml") || name.hasSuffix(".html") || name.hasSuffix(".htm"))
                && !name.hasSuffix("nav.xhtml")
                && !name.hasSuffix("toc.xhtml")
        }.sorted {
            $0.path.localizedStandardCompare($1.path) == .orderedAscending
        }
        var content: [String] = []
        var length = 0
        // The preview is deliberately bounded. Whole-book import occurs in TifloLector.
        for entry in pages {
            if length >= 30_000 { break }
            guard entry.uncompressedSize <= 3_000_000 else { continue }
            var raw = Data()
            _ = try archive.extract(entry, consumer: { bytes in
                if raw.count + bytes.count > 3_000_000 { throw Failure.oversized }
                raw.append(bytes)
            })
            let text = plainText(String(decoding: raw, as: UTF8.self))
            if !text.isEmpty {
                content.append(text)
                length += text.count
            }
        }
        return content.joined(separator: "\n\n")
    }

    private static func plainText(_ html: String) -> String {
        var value = html
        for pattern in [
            "(?is)<!--.*?-->",
            "(?is)<head\\b[^>]*>.*?</head\\s*>",
            "(?is)<(script|style|svg|noscript)\\b[^>]*>.*?</\\1\\s*>"
        ] {
            value = value.replacingOccurrences(of: pattern, with: " ",
                                                 options: .regularExpression)
        }
        for pattern in [
            "(?i)<br\\s*/?>",
            "(?i)</(?:p|h[1-6]|div|li|section|blockquote|tr|article)\\s*>"
        ] {
            value = value.replacingOccurrences(of: pattern, with: "\n",
                                                 options: .regularExpression)
        }
        value = value.replacingOccurrences(of: "(?s)<[^>]+>", with: " ",
                                           options: .regularExpression)
        for (entity, replacement) in [
            "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">",
            "&quot;": "\"", "&apos;": "'", "&mdash;": "—", "&ndash;": "–",
            "&aacute;": "á", "&eacute;": "é", "&iacute;": "í",
            "&oacute;": "ó", "&uacute;": "ú", "&ntilde;": "ñ"
        ] {
            value = value.replacingOccurrences(of: entity, with: replacement)
        }
        return value.components(separatedBy: .newlines)
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
            .joined(separator: "\n\n")
    }
}
