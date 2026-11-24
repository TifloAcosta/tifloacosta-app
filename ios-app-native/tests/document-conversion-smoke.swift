import AppKit
import Foundation
import PDFKit
import ZIPFoundation

// The spine parser only uses this error case. The app supplies the production error.
enum NativeReaderFormatError: Error { case invalidArchive }

@main
struct DocumentConversionSmoke {
    static func main() throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: root) }
        let body = "# Capítulo & prólogo\n\nLeer guía: café y pingüino.\n\nÚltima línea."
        let linkOffset = body.distance(from: body.startIndex, to: body.range(of: "Leer guía")!.lowerBound)
        let source = NativeConversionSource(filename: "Obra.versión.md", title: "Obra & título",
            format: "md", text: body,
            links: [.init(offset: linkOffset, title: "Leer guía", url: "https://example.com/a?x=1&y=2", targetOffset: nil)])
        var results: [NativeDocumentFormat: URL] = [:]
        for format in NativeDocumentFormat.allCases {
            var lastProgress = 0.0
            let url = try NativeDocumentConversion.convert(source, to: format, in: root) { value in
                precondition(value >= lastProgress && value <= 1)
                lastProgress = value
            }
            precondition(lastProgress == 1)
            precondition(url.lastPathComponent == "Obra.versión.\(format.rawValue)")
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
        let epub = try members(results[.epub]!, mime: "application/epub+zip")
        for name in ["EPUB/book.xhtml", "EPUB/book.opf", "EPUB/nav.xhtml", "META-INF/container.xml"] { xml(epub[name]!) }
        precondition(epub["EPUB/book.xhtml"]!.contains("café y pingüino") &&
            epub["EPUB/nav.xhtml"]!.contains("book.xhtml#p0"))

        let pdf = PDFDocument(url: results[.pdf]!)!
        let plain = pdf.string!
        precondition(pdf.pageCount == 1 && plain.range(of: "Capítulo & prólogo")!.lowerBound <
            plain.range(of: "Última línea.")!.lowerBound && plain.contains("café y pingüino"))
        let raw = CGPDFDocument(results[.pdf]! as CFURL)!
        guard let catalog = raw.catalog else { fatalError("Missing PDF catalog") }
        var structure: CGPDFDictionaryRef?
        precondition(CGPDFDictionaryGetDictionary(catalog, "StructTreeRoot", &structure), "PDF lacks structure tags")
        precondition(pdf.page(at: 0)!.annotations.contains { $0.url?.host == "example.com" })

        let xhtml = root.appendingPathComponent("Original.xhtml")
        let png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zr9kAAAAASUVORK5CYII="
        try """
        <html lang="es"><head><title>Tabla original</title><meta name="author" content="Autora"/></head><body>
        <h2 id="tabla">Tabla</h2><ul><li>Primero</li></ul>
        <table><caption>Datos</caption><tr><th scope="col">Valor</th><td>Ñ</td></tr></table>
        <img src="data:image/png;base64,\(png)" alt="Imagen de prueba" onload="bad()"/>
        <script>bad()</script><a href="#tabla">Volver</a></body></html>
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
        precondition(table.contains("<table>") && table.contains(png) && table.contains("href=\"#c0-"))
        print("Nine local formats opened and validated; EPUB/HTML structure and assets, PDF text and tags verified.")
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
