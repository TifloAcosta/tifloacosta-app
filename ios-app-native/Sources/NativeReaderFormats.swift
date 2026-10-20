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
        return .init(body: text, fileExtension: ext, trackPaths: [])
    }

    static func storedURL(for relativePath: String) -> URL? {
        // Stored paths must remain underneath our application support directory.
        guard !relativePath.contains(".."), !relativePath.hasPrefix("/") else { return nil }
        return supportDirectory.appendingPathComponent(relativePath)
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
            body = joined(pages)
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
            for path in audioFiles {
                let copy = try storeMedia(directory.appendingPathComponent(path), documentID: documentID)
                media.append(copy)
            }
        }
        guard !body.isEmpty || !media.isEmpty else {
            throw NativeReaderFormatError.empty(url.lastPathComponent)
        }
        return .init(body: body, fileExtension: format, trackPaths: media)
    }
}
