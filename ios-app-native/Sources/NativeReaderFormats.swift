import Foundation
import UIKit
import PDFKit
import Vision
import ZIPFoundation

/// Native readers use real decoders; unknown formats fail rather than being presented as UTF-8.
struct NativeReaderImportedPayload {
    let body: String
    let fileExtension: String
    let trackPaths: [String]
    var daisyNavigation: [NativeDaisyNavigationPoint] = []
    var textLinks: [NativeReaderTextLink] = []
}

enum NativeReaderFormatError: LocalizedError {
    case unsupported(String)
    case empty(String)
    case invalidArchive
    case oversizedArchive

    var errorDescription: String? {
        switch self {
        case .unsupported(let ext): return "El formato \(ext) todavía no dispone de un lector compatible."
        case .empty(let name): return "No se ha encontrado contenido legible en «\(name)»."
        case .invalidArchive: return "No se ha podido abrir el paquete o el ZIP no contiene un libro DAISY ni pistas de audio reconocibles."
        case .oversizedArchive: return "El archivo comprimido supera los límites de seguridad de tamaño o cantidad de ficheros."
        }
    }
}

struct NativeReaderFormatGroup: Identifiable {
    let title: String
    let details: String
    var id: String { title }
}

enum NativeReaderFormats {
    static let supportedFormatGroups: [NativeReaderFormatGroup] = [
        .init(title: "Textos", details: "TXT, TEXT, MD, MARKDOWN, CSV, JSON, XML, LOG y SRT."),
        .init(title: "Documentos y publicaciones", details: "PDF con texto o escaneado mediante OCR; EPUB; HTML, HTM y RTF; DOCX, ODT y FB2 (texto sin imágenes incrustadas)."),
        .init(title: "Presentaciones", details: "PPTX, PPSX y PPTM: lectura por diapositivas. Las presentaciones PPS y PPT antiguas todavía no están admitidas."),
        .init(title: "Hojas de cálculo", details: "XLSX y XLSM: lectura por hojas, filas y columnas, incluidas cadenas compartidas. Los archivos XLS antiguos todavía no están admitidos."),
        .init(title: "Imágenes con OCR", details: "JPG, JPEG, PNG, HEIC, HEIF, TIF y TIFF."),
        .init(title: "Audiolibros y audio", details: "MP3, M4A, M4B, AAC, WAV, AIF, AIFF y CAF. Pistas consecutivas dentro de un ZIP de audiolibro, ordenadas naturalmente por sus nombres."),
        .init(title: "DAISY", details: "Libros DAISY empaquetados en ZIP o con extensión DAISY. Lectura de texto y pistas de audio; la navegación SMIL completa sigue en desarrollo."),
        .init(title: "Archivos comprimidos", details: "ZIP con pistas de audio o libros DAISY. No se admiten ZIP arbitrarios, RAR, 7Z ni CBR/CBZ.")
    ]

    /// Conserva solo vínculos HTTPS/HTTP cuyo texto visible pueda ubicarse
    /// inequívocamente en el texto extraído. No reconstruye HTML ni altera offsets.
    private static func textLinks(in html: String, extracted text: String,
                                  includeInternal: Bool = false) -> [NativeReaderTextLink] {
        let pattern = #"<a\b[^>]*href\s*=\s*['\"]([^'\"]+)['\"][^>]*>(.*?)</a>"#
        guard let regex = try? NSRegularExpression(pattern: pattern,
                                                    options: [.caseInsensitive, .dotMatchesLineSeparators])
        else { return [] }
        let ns = html as NSString
        let anchors = regex.matches(in: html, range: NSRange(location: 0, length: ns.length))
        // Repeated labels are safe only when every occurrence in the extracted
        // text corresponds to an anchor in the same order. Otherwise a phrase
        // in ordinary prose could be mistaken for a link.
        var candidates: [(title: String, url: String)] = []
        for match in anchors {
            guard match.range(at: 1).location != NSNotFound,
                  match.range(at: 2).location != NSNotFound else { continue }
            let destination = ns.substring(with: match.range(at: 1))
                .replacingOccurrences(of: "&amp;", with: "&")
            let external = URL(string: destination).map {
                ["http", "https"].contains($0.scheme?.lowercased() ?? "") && $0.host != nil
            } ?? false
            let internalReference = includeInternal && !destination.isEmpty
                && !destination.hasPrefix("//") && !destination.hasPrefix("/")
                && !destination.contains(":")
            guard external || internalReference else { continue }
            let markup = ns.substring(with: match.range(at: 2))
            let title = NativeDocumentText.extract(Data(markup.utf8),
                from: URL(fileURLWithPath: "link.html"))
                .trimmingCharacters(in: .whitespacesAndNewlines)
            if !title.isEmpty { candidates.append((title: title, url: destination)) }
        }
        var positions: [String: [Int]] = [:]
        for title in Set(candidates.map { $0.title }) {
            var occurrences: [Int] = []
            var cursor = text.startIndex
            while cursor < text.endIndex,
                  let range = text.range(of: title, range: cursor..<text.endIndex) {
                occurrences.append(text.distance(from: text.startIndex, to: range.lowerBound))
                cursor = range.upperBound
            }
            positions[title] = occurrences
        }
        let linkCounts = Dictionary(candidates.map { ($0.title, 1) },
                                    uniquingKeysWith: +)
        var consumed: [String: Int] = [:]
        var results: [NativeReaderTextLink] = []
        for candidate in candidates {
            let title = candidate.title
            guard let offsets = positions[title],
                  offsets.count == linkCounts[title] else { continue }
            let occurrence = consumed[title, default: 0]
            guard offsets.indices.contains(occurrence) else { continue }
            results.append(.init(offset: offsets[occurrence],
                                 title: title, url: candidate.url))
            consumed[title] = occurrence + 1
        }
        return results
    }

    /// Resolve EPUB fragment anchors only if their target text has a unique
    /// location in the actual extracted page. Never guess an offset.
    private static func targetOffset(fragment: String, html: String, text: String) -> Int? {
        let decoded = fragment.removingPercentEncoding ?? fragment
        guard !decoded.isEmpty else { return 0 }
        let escaped = NSRegularExpression.escapedPattern(for: decoded)
        let pattern = "<([a-zA-Z][a-zA-Z0-9]*)\\b[^>]*\\bid\\s*=\\s*['\\\"]"
            + escaped + "['\\\"][^>]*>(.*?)</\\1>"
        guard let regex = try? NSRegularExpression(pattern: pattern,
                                                    options: [.caseInsensitive, .dotMatchesLineSeparators])
        else { return nil }
        let ns = html as NSString
        guard let match = regex.firstMatch(in: html,
                    range: NSRange(location: 0, length: ns.length)),
              match.range(at: 2).location != NSNotFound else { return nil }
        let markup = ns.substring(with: match.range(at: 2))
        let label = NativeDocumentText.extract(Data(markup.utf8),
                    from: URL(fileURLWithPath: "target.html"))
                    .trimmingCharacters(in: .whitespacesAndNewlines)
        guard !label.isEmpty, let first = text.range(of: label),
              text.range(of: label, range: first.upperBound..<text.endIndex) == nil
        else { return nil }
        return text.distance(from: text.startIndex, to: first.lowerBound)
    }

    private static let audioExtensions: Set<String> = [
        "mp3", "m4a", "m4b", "aac", "wav", "aif", "aiff", "caf"
    ]
    private static let textExtensions: Set<String> = [
        "txt", "text", "md", "markdown", "csv", "json", "xml", "log", "srt"
    ]

    static func read(_ url: URL, documentID: UUID) throws -> NativeReaderImportedPayload {
        let ext = url.pathExtension.lowercased()
        if audioExtensions.contains(ext) {
            let saved = try storeMedia(url, documentID: documentID)
            return .init(body: "", fileExtension: ext, trackPaths: [saved])
        }
        if ["epub", "docx", "odt", "pptx", "ppsx", "pptm", "xlsx", "xlsm", "zip", "daisy"].contains(ext) {
            return try readPackage(url, documentID: documentID, ext: ext)
        }

        let data = try Data(contentsOf: url)
        let text: String
        var textLinks: [NativeReaderTextLink] = []
        switch ext {
        case "pdf":
            guard let pdf = PDFDocument(data: data) else {
                throw NativeReaderFormatError.empty(url.lastPathComponent)
            }
            var pages: [String] = []
            var scannedPages = 0
            for index in 0..<pdf.pageCount {
                var pageText = pdf.page(at: index)?.string?
                    .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
                if pageText.isEmpty {
                    scannedPages += 1
                    guard scannedPages <= 150 else {
                        throw NativeReaderFormatError.unsupported("PDF con más de 150 páginas escaneadas; divide el archivo para realizar OCR")
                    }
                    pageText = try ocrPDFPage(pdf, at: index)
                }
                if !pageText.isEmpty { pages.append("Página \(index + 1)\n\n\(pageText)") }
            }
            text = pages.joined(separator: "\n\n")
        case "jpg", "jpeg", "png", "heic", "heif", "tif", "tiff":
            text = try recognizeText(in: data)
        case "html", "htm", "rtf":
            text = NativeDocumentText.extract(data, from: url)
            if ext != "rtf", let html = String(data: data, encoding: .utf8) {
                textLinks = Self.textLinks(in: html, extracted: text)
            }
        case "fb2":
            let source = String(data: data, encoding: .utf8)
                ?? String(data: data, encoding: .utf16) ?? ""
            // FictionBook embeds images as base64; never speak those binary blocks.
            let clean = source.replacingOccurrences(
                of: "(?is)<binary\\b[^>]*>.*?</binary>", with: " ",
                options: .regularExpression
            ).replacingOccurrences(
                of: "(?i)</?(?:section|title|subtitle|stanza|v)\\b[^>]*>",
                with: "\n", options: .regularExpression
            )
            text = NativeDocumentText.extract(Data(clean.utf8),
                                              from: URL(fileURLWithPath: "book.html"))
        default:
            guard textExtensions.contains(ext) else { throw NativeReaderFormatError.unsupported(ext) }
            text = String(data: data, encoding: .utf8)
                ?? String(data: data, encoding: .utf16) ?? ""
        }
        guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw NativeReaderFormatError.empty(url.lastPathComponent)
        }
        return .init(body: text, fileExtension: ext, trackPaths: [],
                     textLinks: textLinks)
    }

    static func storedURL(for relativePath: String) -> URL? {
        // Stored paths must remain underneath our application support directory.
        guard !relativePath.hasPrefix("/"),
              !relativePath.split(separator: "/").contains(where: { $0 == ".." || $0 == "." }) else { return nil }
        return supportDirectory.appendingPathComponent(relativePath)
    }

    /// Guarda el archivo importado sin modificar su nombre ni su formato.
    /// La copia permanece dentro del contenedor de la aplicación para compartirla después.
    static func storeOriginal(_ source: URL, documentID: UUID) throws -> String {
        let directory = supportDirectory
            .appendingPathComponent("ReaderOriginals", isDirectory: true)
            .appendingPathComponent(documentID.uuidString, isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let filename = source.lastPathComponent
        guard !filename.isEmpty, filename != ".", filename != ".." else {
            throw NativeReaderFormatError.invalidArchive
        }
        let destination = directory.appendingPathComponent(filename, isDirectory: false)
        try FileManager.default.copyItem(at: source, to: destination)
        return "ReaderOriginals/\(documentID.uuidString)/\(filename)"
    }

    static func deleteOriginal(for id: UUID) {
        try? FileManager.default.removeItem(at: supportDirectory
            .appendingPathComponent("ReaderOriginals", isDirectory: true)
            .appendingPathComponent(id.uuidString, isDirectory: true))
    }

    static func deleteStoredFiles(for id: UUID) {
        try? FileManager.default.removeItem(at: supportDirectory
            .appendingPathComponent("ReaderMedia", isDirectory: true)
            .appendingPathComponent(id.uuidString, isDirectory: true))
    }

    private static var supportDirectory: URL {
        FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
    }

    private static func mediaDirectory(for id: UUID) throws -> URL {
        let dir = supportDirectory.appendingPathComponent("ReaderMedia", isDirectory: true)
            .appendingPathComponent(id.uuidString, isDirectory: true)
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }

    private static func storeMedia(_ source: URL, documentID: UUID) throws -> String {
        let dir = try mediaDirectory(for: documentID)
        let name = UUID().uuidString + "." + source.pathExtension.lowercased()
        try FileManager.default.copyItem(at: source, to: dir.appendingPathComponent(name))
        return "ReaderMedia/\(documentID.uuidString)/\(name)"
    }

    private static func makeOCRRequest() -> VNRecognizeTextRequest {
        let request = VNRecognizeTextRequest()
        request.recognitionLevel = UserDefaults.standard.integer(
            forKey: "native-reader-ocr-accuracy-index") == 1 ? .fast : .accurate
        request.usesLanguageCorrection = true
        switch UserDefaults.standard.integer(forKey: "native-reader-ocr-language-index") {
        case 1: request.recognitionLanguages = ["es-ES"]
        case 2: request.recognitionLanguages = ["en-US"]
        case 3: request.recognitionLanguages = ["es-ES", "en-US"]
        default: request.automaticallyDetectsLanguage = true
        }
        return request
    }

    private static func ocrPDFPage(_ pdf: PDFDocument, at index: Int) throws -> String {
        guard let image = pdf.page(at: index)?
            .thumbnail(of: CGSize(width: 1700, height: 2200), for: .mediaBox).cgImage
        else { return "" }
        let request = makeOCRRequest()
        try VNImageRequestHandler(cgImage: image, options: [:]).perform([request])
        return (request.results ?? []).compactMap {
            $0.topCandidates(1).first?.string
        }.joined(separator: "\n")
    }

    private static func recognizeText(in data: Data) throws -> String {
        let request = makeOCRRequest()
        try VNImageRequestHandler(data: data, options: [:]).perform([request])
        return (request.results ?? []).compactMap {
            $0.topCandidates(1).first?.string
        }.joined(separator: "\n")
    }


    // SMIL fragment links refer to a <par> or <seq> in a particular file.
    // Keep the audio lookup inside that fragment instead of using the first
    // audio element of the entire chapter.
    private static func daisyAudio(in xml: String, fragment: String?) -> (file: String, seconds: TimeInterval?)? {
        let segment: String
        if let fragment, !fragment.isEmpty {
            let escaped = NSRegularExpression.escapedPattern(for: fragment)
            let pattern = #"(?is)<(?:par|seq)\b[^>]*\bid\s*=\s*["']"# +
                escaped + #"["'][^>]*>.*?</(?:par|seq)>"#
            guard let range = xml.range(of: pattern, options: .regularExpression) else {
                return nil
            }
            segment = String(xml[range])
        } else {
            segment = xml
        }
        guard let audio = segment.range(of: #"(?is)<audio\b[^>]*>"#, options: .regularExpression)
        else { return nil }
        let tag = String(segment[audio])
        guard let src = attribute("src", in: tag) else { return nil }
        let file = URL(fileURLWithPath: src.components(separatedBy: "#")[0])
            .lastPathComponent.lowercased()
        let start = attribute("clipBegin", in: tag) ?? attribute("clip-begin", in: tag)
        return (file, start.flatMap(smilSeconds))
    }

    private static func attribute(_ name: String, in tag: String) -> String? {
        let pattern = #"(?i)\b"# + NSRegularExpression.escapedPattern(for: name) +
            #"\s*=\s*["']([^"']*)["']"#
        guard let expression = try? NSRegularExpression(pattern: pattern) else { return nil }
        let text = tag as NSString
        guard let match = expression.firstMatch(in: tag,
            range: NSRange(location: 0, length: text.length)) else { return nil }
        return text.substring(with: match.range(at: 1))
    }

    private static func smilSeconds(_ clock: String) -> TimeInterval? {
        let clean = clock.trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: "npt=", with: "", options: .caseInsensitive)
        let normalized = clean.hasSuffix("s") ? String(clean.dropLast()) : clean
        let parts = normalized.split(separator: ":")
        guard !parts.isEmpty, parts.count <= 3 else { return nil }
        var total: Double = 0
        for part in parts {
            guard let amount = Double(part), amount >= 0, amount.isFinite else { return nil }
            total = total * 60 + amount
        }
        return total
    }

    private static func readPackage(_ url: URL, documentID: UUID, ext: String) throws -> NativeReaderImportedPayload {
        guard let archive = Archive(url: url, accessMode: .read) else {
            throw NativeReaderFormatError.invalidArchive
        }
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("reader-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: directory) }
        var paths: [String] = []
        var total: Int64 = 0
        var entries = 0
        let sizeLimit: Int64 = ext == "zip" ? 750_000_000 : 250_000_000
        for entry in archive {
            let path = entry.path.replacingOccurrences(of: "\\", with: "/")
            guard !path.hasPrefix("/"), !path.split(separator: "/").contains(".."),
                  !path.contains(":"), entry.type == .file else { continue }
            entries += 1
            guard entries <= 4000 else { throw NativeReaderFormatError.oversizedArchive }
            total += Int64(entry.uncompressedSize)
            guard total <= sizeLimit else { throw NativeReaderFormatError.oversizedArchive }
            let target = directory.appendingPathComponent(path)
            try FileManager.default.createDirectory(
                at: target.deletingLastPathComponent(), withIntermediateDirectories: true
            )
            _ = try archive.extract(entry, to: target)
            paths.append(path)
        }
        let all = paths.sorted { $0.localizedStandardCompare($1) == .orderedAscending }
        func extractedText(_ path: String) -> String {
            let file = directory.appendingPathComponent(path)
            guard let data = try? Data(contentsOf: file) else { return "" }
            // Normalize XML namespaced paragraph/line tags before HTML text extraction.
            let raw = String(data: data, encoding: .utf8) ?? ""
            let normalized = raw.replacingOccurrences(
                of: "(?i)</(?:a:p|w:p|text:p|text:h|row|c|p)>", with: "\n",
                options: .regularExpression
            ).replacingOccurrences(
                of: "(?i)<h[1-6]\\b[^>]*>", with: "\n# ",
                options: .regularExpression
            )
            let text = NativeDocumentText.extract(
                Data(normalized.utf8), from: URL(fileURLWithPath: "content.html")
            )
            return text
        }
        func joined(_ candidates: [String]) -> String {
            candidates.map(extractedText).filter { !$0.isEmpty }.joined(separator: "\n\n")
        }
        let body: String
        let format: String
        var media: [String] = []
        var daisyNavigation: [NativeDaisyNavigationPoint] = []
        var textLinks: [NativeReaderTextLink] = []
        switch ext {
        case "docx":
            body = joined(all.filter { $0 == "word/document.xml" })
            format = "docx"
        case "odt":
            body = joined(all.filter { $0 == "content.xml" })
            format = "odt"
        case "pptx", "ppsx", "pptm":
            body = NativeOfficeText.slides(all, text: extractedText)
            format = ext
        case "xlsx", "xlsm":
            body = NativeOfficeText.spreadsheet(all) { path in
                try? Data(contentsOf: directory.appendingPathComponent(path))
            }
            format = ext
        case "epub":
            let pages = all.filter {
                ($0.hasSuffix(".xhtml") || $0.hasSuffix(".html") || $0.hasSuffix(".htm"))
                    && !$0.contains("nav.")
                    && !$0.contains("toc.")
            }
            var segments: [String] = []
            var pageOffsets: [String: Int] = [:]
            var pageTexts: [String: String] = [:]
            var pageHTML: [String: String] = [:]
            var offset = 0
            for page in pages {
                let pageText = extractedText(page)
                guard !pageText.isEmpty else { continue }
                pageOffsets[page] = offset
                pageTexts[page] = pageText
                if let html = try? String(contentsOf: directory.appendingPathComponent(page),
                                          encoding: .utf8) {
                    pageHTML[page] = html
                }
                segments.append(pageText)
                offset += pageText.count + 2
            }
            for page in pages {
                guard let pageText = pageTexts[page], let html = pageHTML[page],
                      let baseOffset = pageOffsets[page] else { continue }
                for link in Self.textLinks(in: html, extracted: pageText, includeInternal: true) {
                    if let url = URL(string: link.url), ["http", "https"].contains(url.scheme?.lowercased() ?? ""),
                       url.host != nil {
                        textLinks.append(.init(offset: baseOffset + link.offset,
                                               title: link.title, url: link.url))
                        continue
                    }
                    let parts = link.url.split(separator: "#", maxSplits: 1,
                                               omittingEmptySubsequences: false)
                    let relative = String(parts[0]).removingPercentEncoding ?? String(parts[0])
                    let targetPath = relative.isEmpty ? page : String(
                        URL(fileURLWithPath: "/" + page).deletingLastPathComponent()
                            .appendingPathComponent(relative).standardizedFileURL.path.dropFirst())
                    guard let targetBase = pageOffsets[targetPath],
                          let targetText = pageTexts[targetPath] else { continue }
                    let target: Int?
                    if parts.count == 1 || parts[1].isEmpty {
                        target = 0
                    } else if let targetHTML = pageHTML[targetPath] {
                        target = Self.targetOffset(fragment: String(parts[1]),
                                                   html: targetHTML, text: targetText)
                    } else { target = nil }
                    guard let target else { continue }
                    textLinks.append(.init(offset: baseOffset + link.offset, title: link.title,
                                           url: link.url, targetOffset: targetBase + target))
                }
            }
            body = segments.joined(separator: "\n\n")
            format = "epub"
        default:
            let isDaisy = all.contains {
                let lower = $0.lowercased()
                return lower.hasSuffix("ncc.html") || lower.hasSuffix(".smil")
                    || lower.hasSuffix(".ncx")
            }
            let audioFiles = all.filter { path in
                // Mac ZIP metadata (._name.mp3 in __MACOSX) is NOT playable audio.
                let components = path.split(separator: "/")
                guard !components.contains(where: {
                    $0 == "__MACOSX" || $0.hasPrefix("._")
                }) else { return false }
                return audioExtensions.contains(
                    URL(fileURLWithPath: path).pathExtension.lowercased()
                )
            }
            guard isDaisy || (ext == "zip" && !audioFiles.isEmpty) else {
                throw NativeReaderFormatError.invalidArchive
            }
            let pages = all.filter {
                ($0.hasSuffix(".html") || $0.hasSuffix(".xhtml") || $0.hasSuffix(".xml"))
                    && !$0.lowercased().hasSuffix("ncc.html")
                    && !$0.lowercased().hasSuffix(".smil")
                    && !$0.lowercased().hasSuffix(".ncx")
                    && !$0.lowercased().hasSuffix(".opf")
            }
            body = isDaisy ? joined(pages) : ""
            format = isDaisy ? "daisy" : "zip"
            if isDaisy, let ncc = all.first(where: { $0.lowercased().hasSuffix("ncc.html") }) {
                let raw = (try? String(contentsOf: directory.appendingPathComponent(ncc), encoding: .utf8)) ?? ""
                let expression = try? NSRegularExpression(
                    pattern: #"(?is)<h([1-6])\b[^>]*>(.*?)</h[1-6]>"#)
                let ns = raw as NSString
                for match in expression?.matches(in: raw, range: NSRange(location: 0, length: ns.length)) ?? [] {
                    let level = Int(ns.substring(with: match.range(at: 1))) ?? 1
                    let headingHTML = ns.substring(with: match.range(at: 2))
                    let title = NativeDocumentText.extract(Data(headingHTML.utf8),
                        from: URL(fileURLWithPath: "heading.html"))
                        .trimmingCharacters(in: .whitespacesAndNewlines)
                    guard !title.isEmpty,
                          let hrefMatch = headingHTML.range(
                            of: #"(?i)href\s*=\s*["']([^"']+\.smil)(?:#[^"']*)?["']"#,
                            options: .regularExpression) else { continue }
                    let href = String(headingHTML[hrefMatch])
                    let path = href.replacingOccurrences(
                        of: #"(?is)^.*?["']([^"']+\.smil)(?:#[^"']*)?["'].*$"#,
                        with: "$1", options: .regularExpression)
                    let fragment = href.components(separatedBy: "#").dropFirst().first?
                        .replacingOccurrences(of: #"["'].*$"#, with: "", options: .regularExpression)
                    let smilName = URL(fileURLWithPath: path).lastPathComponent.lowercased()
                    guard let smil = all.first(where: {
                        $0.lowercased().hasSuffix("/" + smilName) ||
                        $0.lowercased() == smilName
                    }), let xml = try? String(contentsOf: directory.appendingPathComponent(smil),
                                              encoding: .utf8),
                          let target = daisyAudio(in: xml, fragment: fragment)
                    else { continue }
                    let file = target.file
                    guard let track = audioFiles.firstIndex(where: {
                        URL(fileURLWithPath: $0).lastPathComponent.lowercased() == file
                    }) else { continue }
                    let point = NativeDaisyNavigationPoint(title: title, level: level, track: track,
                                                          seconds: target.seconds)
                    if !daisyNavigation.contains(point) { daisyNavigation.append(point) }
                }
            }
            // DAISY 3 books can provide their navigation only through NCX.
            // Preserve hierarchy and resolve SMIL targets, if present.
            if isDaisy,
               let ncx = all.first(where: { $0.lowercased().hasSuffix(".ncx") }),
               let ncxData = try? Data(contentsOf: directory.appendingPathComponent(ncx)) {
                for link in NativeDaisyNCX.parse(ncxData) {
                    let parts = link.href.components(separatedBy: "#")
                    let smilFile = URL(fileURLWithPath: parts[0]).lastPathComponent.lowercased()
                    guard smilFile.hasSuffix(".smil"),
                          let smil = all.first(where: {
                              $0.lowercased().hasSuffix("/" + smilFile) ||
                              $0.lowercased() == smilFile
                          }),
                          let xml = try? String(contentsOf: directory.appendingPathComponent(smil),
                                                encoding: .utf8),
                          let target = daisyAudio(in: xml, fragment: parts.count > 1 ? parts[1] : nil),
                          let track = audioFiles.firstIndex(where: {
                              URL(fileURLWithPath: $0).lastPathComponent.lowercased() == target.file
                          })
                    else { continue }
                    let point = NativeDaisyNavigationPoint(
                        title: link.title, level: link.level, track: track, seconds: target.seconds,
                        kind: link.kind)
                    // Retain NCX pages/references even when NCC supplies chapters.
                    if !daisyNavigation.contains(where: {
                        $0.title == point.title && $0.track == point.track &&
                        $0.seconds == point.seconds
                    }) {
                        daisyNavigation.append(point)
                    }
                }
            }
            for path in audioFiles {
                let copy = try storeMedia(directory.appendingPathComponent(path), documentID: documentID)
                media.append(copy)
            }
        }
        guard !body.isEmpty || !media.isEmpty else {
            throw NativeReaderFormatError.empty(url.lastPathComponent)
        }
        return .init(body: body, fileExtension: format, trackPaths: media,
                     daisyNavigation: daisyNavigation, textLinks: textLinks)
    }
}
