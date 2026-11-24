import AppKit
import Foundation
import PDFKit
import ZIPFoundation

// The spine parser only uses this error case. The app supplies the production error.
enum NativeReaderFormatError: Error { case invalidArchive }

@main
struct DocumentConversionSmoke {
    @MainActor static func main() async throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: root) }
        let body = "# Capítulo & prólogo\n\nLeer guía: café y pingüino.\n\n## 第二章 – Ελληνικά\n\nVolver. Última línea."
        let linkOffset = body.distance(from: body.startIndex, to: body.range(of: "Leer guía")!.lowerBound)
        let source = NativeConversionSource(filename: "Obra.versión.md", title: "Obra & título",
            format: "md", text: body,
            links: [.init(offset: linkOffset, title: "Leer guía", url: "https://example.com/a?x=1&y=2", targetOffset: nil),
                .init(offset: body.distance(from: body.startIndex, to: body.range(of: "Volver")!.lowerBound),
                      title: "Volver", url: "#chapter", targetOffset: 0)])
        var results: [NativeDocumentFormat: URL] = [:]
        for format in NativeDocumentFormat.allCases {
            var lastProgress = 0.0
            let url = try NativeDocumentConversion.convert(source, to: format, in: root.appendingPathComponent(format.rawValue)) { value in
                precondition(value >= lastProgress && value <= 1)
                lastProgress = value
            }
            precondition(lastProgress == 1)
            precondition(url.lastPathComponent == "Obra.versión.\(format.fileExtension)")
            results[format] = url
        }
        func text(_ format: NativeDocumentFormat) throws -> String {
            try String(contentsOf: results[format]!, encoding: .utf8)
        }
        let txt = try text(.txt)
        let md = try text(.md)
        precondition(txt == body && md == body, "Plain/Markdown conversion changed source text")
        let rtf = try NSAttributedString(url: results[.rtf]!,
            options: [.documentType: NSAttributedString.DocumentType.rtf], documentAttributes: nil)
        precondition(rtf.string.contains("Capítulo & prólogo") && rtf.string.contains("café y pingüino"))
        let html = try text(.html)
        xml(html)
        precondition(html.contains("<h1") && html.contains("Capítulo &amp; prólogo"))
        precondition(html.contains("href=\"https://example.com/a?x=1&amp;y=2\""))
        let fb2 = try text(.fb2)
        xml(fb2)
        precondition(fb2.contains("<title><p>Capítulo &amp; prólogo</p></title>") && fb2.contains("Última línea."))
        if CommandLine.arguments.count > 1 {
            let schemaCheck = Process()
            schemaCheck.executableURL = URL(fileURLWithPath: "/usr/bin/xmllint")
            schemaCheck.arguments = ["--nonet", "--noout", "--schema", CommandLine.arguments[1], results[.fb2]!.path]
            try schemaCheck.run()
            schemaCheck.waitUntilExit()
            precondition(schemaCheck.terminationStatus == 0, "FB2 failed its format schema")
        }
        let docx = try members(results[.docx]!)
        for name in ["[Content_Types].xml", "_rels/.rels", "word/document.xml", "word/styles.xml", "word/_rels/document.xml.rels", "docProps/core.xml"] {
            xml(docx[name]!)
        }
        precondition(docx["word/document.xml"]!.contains("Heading1") &&
            docx["word/document.xml"]!.contains("café y pingüino") &&
            docx["word/_rels/document.xml.rels"]!.contains("TargetMode=\"External\""))
        let odt = try members(results[.odt]!, mime: "application/vnd.oasis.opendocument.text")
        for name in ["content.xml", "META-INF/manifest.xml", "meta.xml"] { xml(odt[name]!) }
        precondition(odt["content.xml"]!.contains("text:outline-level=\"1\"") &&
            odt["content.xml"]!.contains("pingüino"))
        for (format, type) in [(NativeDocumentFormat.docx, NSAttributedString.DocumentType.officeOpenXML),
                               (.odt, .openDocument), (.html, .html)] {
            let opened = try NSAttributedString(url: results[format]!,
                options: [.documentType: type], documentAttributes: nil)
            precondition(opened.string.contains("café y pingüino") &&
                opened.string.contains("Última línea."), "\(format.label) lost readable text")
        }
        let epub = try members(results[.epub]!, mime: "application/epub+zip")
        for name in ["EPUB/book.xhtml", "EPUB/book.opf", "EPUB/nav.xhtml", "META-INF/container.xml"] { xml(epub[name]!) }
        precondition(epub["EPUB/book.xhtml"]!.contains("café y pingüino") &&
            epub["EPUB/nav.xhtml"]!.contains("book.xhtml#p0"))

        let daisy = try members(results[.daisy]!)
        precondition(Set(daisy.keys) == ["ncc.html", "book.smil", "book.xhtml"])
        for document in daisy.values { xml(document) }
        precondition(daisy["ncc.html"]!.contains("textNcc") && daisy["ncc.html"]!.contains("第二章"))
        precondition(daisy["book.xhtml"]!.contains("href=\"#p0\">Volver") &&
            daisy["book.xhtml"]!.contains("Ελληνικά"))
        precondition(!daisy["book.smil"]!.contains("<audio"))
        if CommandLine.arguments.count > 2 {
            let samples = URL(fileURLWithPath: CommandLine.arguments[2], isDirectory: true)
            for (name, contents) in daisy {
                try contents.write(to: samples.appendingPathComponent(name), atomically: true, encoding: .utf8)
            }
            let version3 = samples.appendingPathComponent("daisy3", isDirectory: true)
            try FileManager.default.createDirectory(at: version3, withIntermediateDirectories: true)
            let daisy3 = try members(results[.daisy3]!)
            precondition(Set(daisy3.keys) == ["book.opf", "book.ncx", "book.smil", "book.xml"])
            for (name, contents) in daisy3 {
                xml(contents)
                try contents.write(to: version3.appendingPathComponent(name), atomically: true, encoding: .utf8)
            }
            try FileManager.default.copyItem(at: results[.pdf]!, to: samples.appendingPathComponent("conversion.pdf"))
        }

        let pdf = PDFDocument(url: results[.pdf]!)!
        let plain = pdf.string!
        precondition(pdf.pageCount == 1 && plain.range(of: "Capítulo & prólogo")!.lowerBound <
            plain.range(of: "Última línea.")!.lowerBound && plain.contains("café y pingüino"))
        let raw = CGPDFDocument(results[.pdf]! as CFURL)!
        guard let catalog = raw.catalog else { fatalError("Missing PDF catalog") }
        var structure: CGPDFDictionaryRef?
        precondition(CGPDFDictionaryGetDictionary(catalog, "StructTreeRoot", &structure), "PDF lacks structure tags")
        precondition(pdf.page(at: 0)!.annotations.contains { $0.url?.host == "example.com" })
        precondition(pdf.page(at: 0)!.annotations.contains { $0.destination?.page != nil || $0.action is PDFActionGoTo },
                     "PDF lost its internal heading link")
        var pdfMetadata: CGPDFStreamRef?
        precondition(CGPDFDictionaryGetStream(catalog, "Metadata", &pdfMetadata), "PDF lacks XMP metadata")

        let reopenedDOCX = NativeConversionSource(filename: "Obra.versión.docx", title: "DOCX",
            format: "docx", text: "Text fallback", links: [], original: results[.docx]!)
        let docxHTML = try NativeDocumentConversion.convert(reopenedDOCX, to: .html,
            in: root.appendingPathComponent("docx-roundtrip"))
        let docxMarkup = try String(contentsOf: docxHTML, encoding: .utf8)
        precondition(docxMarkup.contains("<h2") && docxMarkup.contains("Ελληνικά") &&
            docxMarkup.contains("href=\"#c0-p0\">Volver"))

        let reopenedODT = NativeConversionSource(filename: "Obra.versión.odt", title: "Fallback",
            format: "odt", text: "Text fallback", links: [], original: results[.odt]!)
        let reopenedHTML = try NativeDocumentConversion.convert(reopenedODT, to: .html,
            in: root.appendingPathComponent("roundtrip"))
        let odtHTML = try String(contentsOf: reopenedHTML, encoding: .utf8)
        precondition(odtHTML.contains("Obra &amp; título") && odtHTML.contains("<h2") &&
            odtHTML.contains("href=\"#c0-p0\">Volver") && odtHTML.contains("Ελληνικά"))

        let longBody = (0..<220).map { "Línea \($0): contenido extenso para paginación." }.joined(separator: "\n")
        let longInput = NativeConversionSource(filename: "Largo.txt", title: "Largo", format: "txt",
            text: longBody, links: [])
        let longPDF = try NativeDocumentConversion.convert(longInput, to: .pdf, in: root)
        let openedLong = PDFDocument(url: longPDF)!
        precondition(openedLong.pageCount > 1 && openedLong.page(at: 0)!.string!.contains("Línea 0:"))
        precondition(openedLong.page(at: openedLong.pageCount - 1)!.string!.contains("Línea 219:"))
        let cancelled = Task.detached { () throws -> Bool in
            withUnsafeCurrentTask { $0?.cancel() }
            do {
                _ = try NativeDocumentConversion.convert(longInput, to: .html, in: root.appendingPathComponent("cancelled"))
                return false
            } catch is CancellationError { return true }
        }
        let didCancel = try await cancelled.value
        precondition(didCancel && !FileManager.default.fileExists(atPath: root.appendingPathComponent("cancelled").path))

        let xhtml = root.appendingPathComponent("Original.xhtml")
        let png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zr9kAAAAASUVORK5CYII="
        try """
        <html lang="es"><head><title>Tabla original</title><meta name="author" content="Autora"/></head><body>
        <h2 id="tabla">Tabla</h2><ul><li>Primero</li></ul>
        <table><caption>Datos</caption><tr><th scope="col">Valor</th><td>Ñ</td></tr></table>
        <img src="data:image/png;base64,\(png)" alt="Imagen de prueba" onload="bad()"/>
        <script>bad()</script><a href="#tabla">Volver</a>
        <p xml:lang="fr">Déjà vu <a href="#nota" role="doc-noteref">1</a></p>
        <aside id="nota" role="doc-footnote"><p>Hinweis – opinião.</p></aside></body></html>
        """.write(to: xhtml, atomically: true, encoding: .utf8)
        let rich = NativeConversionSource(filename: "Original.xhtml", title: "Original", format: "xhtml",
            text: "Tabla\nDatos", links: [], original: xhtml)
        let richOutput = root.appendingPathComponent("rich")
        let richEpub = try NativeDocumentConversion.convert(rich, to: .epub, in: richOutput)
        let richFiles = try members(richEpub, mime: "application/epub+zip")
        let chapter = richFiles["EPUB/book.xhtml"]!
        xml(chapter)
        precondition(chapter.contains("<table>") && chapter.contains("<ul>") &&
            chapter.contains("alt=\"Imagen de prueba\"") && !chapter.contains("bad()"))
        precondition(richFiles["EPUB/book.opf"]!.contains("Autora") &&
            richFiles["EPUB/book.opf"]!.contains("assets/image-1.png"))
        let reopened = NativeConversionSource(filename: "Original.epub", title: "Original", format: "epub",
            text: "Tabla", links: [], original: richEpub)
        let richHTML = try NativeDocumentConversion.convert(reopened, to: .html, in: richOutput)
        let table = try String(contentsOf: richHTML, encoding: .utf8)
        precondition(table.contains("<table>") && table.contains(png) && table.contains("href=\"#c0-") &&
            table.contains("xml:lang=\"fr\"") && table.contains("role=\"doc-footnote\"") &&
            table.contains("Hinweis – opinião."))
        let complexODT = root.appendingPathComponent("Complejo.odt")
        let archive = try Archive(url: complexODT, accessMode: .create)
        let odtSource = """
        <office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
          xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"
          xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"
          xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0"
          xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0"
          xmlns:xlink="http://www.w3.org/1999/xlink">
          <office:body><office:text>
            <text:h text:outline-level="2">Reunión – 会議</text:h>
            <text:list><text:list-item><text:p>Café</text:p></text:list-item></text:list>
            <table:table><table:table-header-rows><table:table-row><table:table-cell>
              <text:p>Résumé</text:p>
            </table:table-cell></table:table-row></table:table-header-rows></table:table>
            <text:p><draw:frame><draw:image xlink:href="Pictures/frame.png"/>
              <svg:desc>Descripción de la imagen</svg:desc></draw:frame></text:p>
          </office:text></office:body>
        </office:document-content>
        """
        for (path, bytes) in [("content.xml", Data(odtSource.utf8)),
                              ("Pictures/frame.png", Data(base64Encoded: png)!)] {
            try archive.addEntry(with: path, type: .file, uncompressedSize: Int64(bytes.count)) { offset, size in
                let start = Int(offset)
                return bytes.subdata(in: start..<min(bytes.count, start + size))
            }
        }
        let complex = NativeConversionSource(filename: complexODT.lastPathComponent, title: "Complejo",
            format: "odt", text: "Text fallback", links: [], original: complexODT)
        let complexEPUB = try NativeDocumentConversion.convert(complex, to: .epub, in: richOutput)
        let complexFiles = try members(complexEPUB, mime: "application/epub+zip")
        let complexBook = complexFiles["EPUB/book.xhtml"]!
        xml(complexBook)
        precondition(complexBook.contains("<thead><tr><th>") && complexBook.contains("<ul><li>") &&
            complexBook.contains("alt=\"Descripción de la imagen\"") && complexBook.contains("会議"))
        precondition(complexFiles["EPUB/book.opf"]!.contains("assets/image-1.png"))
        print("Eleven local formats opened and validated; EPUB/HTML structure and assets, PDF text and tags verified.")
    }

    static func xml(_ string: String) {
        let parser = XMLParser(data: Data(string.utf8))
        parser.shouldResolveExternalEntities = false
        precondition(parser.parse(), parser.parserError?.localizedDescription ?? "Invalid XML")
    }

    static func members(_ url: URL, mime: String? = nil) throws -> [String: String] {
        let archive = try Archive(url: url, accessMode: .read)
        var files: [String: String] = [:]
        for (index, entry) in archive.enumerated() {
            var bytes = Data()
            let checksum = try archive.extract(entry) { bytes.append($0) }
            precondition(checksum == entry.checksum && UInt64(bytes.count) == entry.uncompressedSize)
            if index == 0, let mime {
                precondition(entry.path == "mimetype" && entry.compressedSize == entry.uncompressedSize)
                precondition(String(decoding: bytes, as: UTF8.self) == mime)
            }
            if let value = String(data: bytes, encoding: .utf8) { files[entry.path] = value }
        }
        precondition(!files.isEmpty)
        return files
    }
}
