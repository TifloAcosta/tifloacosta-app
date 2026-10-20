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
        case .invalidArchive: return "El archivo comprimido no es un EPUB ni un libro DAISY reconocible."
        case .oversizedArchive: return "El paquete supera el límite de seguridad de 250 MB descomprimidos."
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
        .init(title: "Documentos y publicaciones", details: "PDF con texto o escaneado mediante OCR; EPUB; HTML, HTM y RTF; DOCX."),
        .init(title: "Presentaciones", details: "PPTX: extracción del texto de las diapositivas. Las presentaciones PPS y PPT antiguas todavía no están admitidas."),
        .init(title: "Hojas de cálculo", details: "XLSX: extracción de texto de las hojas. Los archivos XLS antiguos todavía no están admitidos."),
        .init(title: "Imágenes con OCR", details: "JPG, JPEG, PNG, HEIC, HEIF, TIF y TIFF."),
        .init(title: "Audiolibros y audio", details: "MP3, M4A, M4B, AAC, WAV, AIF, AIFF y CAF."),
        .init(title: "DAISY", details: "Libros DAISY empaquetados en ZIP o con extensión DAISY. Lectura de texto y pistas de audio; la navegación SMIL completa sigue en desarrollo.")
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
        if ["epub", "docx", "pptx", "xlsx", "zip", "daisy"].contains(ext) {
            return try readPackage(url, documentID: documentID, ext: ext)
        }

        let data = try Data(contentsOf: url)
        let text: String
        switch ext {
        case "pdf":
            let pdf = PDFDocument(data: data)
            let extracted = pdf?.string?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            text = !extracted.isEmpty ? extracted : try ocrPDF(pdf)
        case "jpg", "jpeg", "png", "heic", "heif", "tif", "tiff":
            text = try recognizeText(in: data)
        case "html", "htm", "rtf":
            text = NativeDocumentText.extract(data, from: url)
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

    private static func ocrPDF(_ pdf: PDFDocument?) throws -> String {
        guard let pdf, pdf.pageCount > 0 else { return "" }
        var output: [String] = []
        // An explicit cap prevents inadvertently freezing the app on enormous scans.
        guard pdf.pageCount <= 150 else {
            throw NativeReaderFormatError.unsupported("PDF escaneado de más de 150 páginas; divide el documento para aplicar OCR")
        }
        for index in 0..<pdf.pageCount {
            guard let image = pdf.page(at: index)?
                .thumbnail(of: CGSize(width: 1700, height: 2200), for: .mediaBox).cgImage
            else { continue }
            let request = VNRecognizeTextRequest()
            request.recognitionLevel = .accurate
            request.usesLanguageCorrection = true
            try VNImageRequestHandler(cgImage: image, options: [:]).perform([request])
            let text = (request.results ?? []).compactMap {
                $0.topCandidates(1).first?.string
            }.joined(separator: "\n")
            if !text.isEmpty { output.append(text) }
        }
        return output.joined(separator: "\n\n")
    }

    private static func recognizeText(in data: Data) throws -> String {
        let request = VNRecognizeTextRequest()
        request.recognitionLevel = .accurate
        request.usesLanguageCorrection = true
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
        for entry in archive {
            let path = entry.path.replacingOccurrences(of: "\\", with: "/")
            guard !path.hasPrefix("/"), !path.split(separator: "/").contains(".."),
                  !path.contains(":"), entry.type == .file else { continue }
            total += Int64(entry.uncompressedSize)
            guard total <= 250_000_000 else { throw NativeReaderFormatError.oversizedArchive }
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
                of: "(?i)</(?:a:p|w:p|text:p|row|c|p)>", with: "\n",
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
        case "pptx":
            body = joined(all.filter {
                $0.range(of: #"^ppt/slides/slide[0-9]+\.xml$"#, options: .regularExpression) != nil
            })
            format = "pptx"
        case "xlsx":
            body = joined(all.filter {
                $0.hasPrefix("xl/worksheets/sheet") && $0.hasSuffix(".xml")
            })
            format = "xlsx"
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
            guard isDaisy else { throw NativeReaderFormatError.invalidArchive }
            let pages = all.filter {
                ($0.hasSuffix(".html") || $0.hasSuffix(".xhtml") || $0.hasSuffix(".xml"))
                    && !$0.lowercased().hasSuffix("ncc.html")
                    && !$0.lowercased().hasSuffix(".smil")
                    && !$0.lowercased().hasSuffix(".ncx")
                    && !$0.lowercased().hasSuffix(".opf")
            }
            body = joined(pages)
            format = "daisy"
            for path in all where audioExtensions.contains(
                URL(fileURLWithPath: path).pathExtension.lowercased()
            ) {
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
