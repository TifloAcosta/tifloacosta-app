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
        let body = "# Capítulo & prólogo\n\nAntes, Leer guía: café y pingüino.\n\n## 第二章 – Ελληνικά\n\nVolver. Última línea."
        let linkOffset = body.distance(from: body.startIndex, to: body.range(of: "Leer guía")!.lowerBound)
        let source = NativeConversionSource(filename: "Obra.versión.md", title: "Obra & título",
            format: "md", text: body,
            links: [.init(offset: linkOffset, title: "Leer guía", url: "https://example.com/a?x=1&y=2", targetOffset: nil),
                .init(offset: body.distance(from: body.startIndex, to: body.range(of: "Volver")!.lowerBound),
                      title: "Volver", url: "#chapter", targetOffset: 0)])
        // Real-world HTML uses void elements, unquoted attributes, HTML
        // entities and implicit closing tags that XMLParser rejects.
        let ordinaryHTML = root.appendingPathComponent("ordinary.html")
        let ordinary = """
        <!doctype html><html lang=es><head><meta charset=utf-8><title>Ejemplo</title></head>
        <body><h2 id=cap>Capítulo&nbsp;1</h2><p>Texto &eacute;<br><a href='#cap'>Volver</a>
        <p><a href='https://example.org/guia'>Guía</a><img src='https://example.org/remote.png' alt='Foto externa'>
        <ul><li>Uno<li>Dos</ul><script>if (a < b) alert('no')</script><a href='javascript:alert(1)'>No ejecutar</a>
        </body></html>
        """
        try Data(ordinary.utf8).write(to: ordinaryHTML)
        let ordinarySource = NativeConversionSource(filename: "ordinary.html", title: "Ejemplo",
            format: "html", text: "Capítulo 1 Texto é Volver Guía Foto externa Uno Dos No ejecutar", links: [], original: ordinaryHTML)
        let ordinaryResult = try NativeDocumentConversion.convert(ordinarySource, to: .html,
            in: root.appendingPathComponent("ordinary-html"))
        let ordinaryOutput = try String(contentsOf: ordinaryResult, encoding: .utf8)
        precondition(ordinaryOutput.contains("<h2 id=\"c0-cap\">") && ordinaryOutput.contains("Texto é") &&
            ordinaryOutput.contains("href=\"#c0-cap\"") && ordinaryOutput.contains("href=\"https://example.org/guia\"") &&
            ordinaryOutput.contains("<li>Uno</li>") && ordinaryOutput.contains("<li>Dos</li>") &&
            ordinaryOutput.contains("Foto externa") && !ordinaryOutput.contains("<script") &&
            !ordinaryOutput.contains("javascript:") && !ordinaryOutput.contains("remote.png"))

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
        precondition(plain.contains("Antes, Leer guía: café"), "Inline glyph runs must retain text order and layout")
        let raw = CGPDFDocument(results[.pdf]! as CFURL)!
        guard let catalog = raw.catalog else { fatalError("Missing PDF catalog") }
        var structure: CGPDFDictionaryRef?
        precondition(CGPDFDictionaryGetDictionary(catalog, "StructTreeRoot", &structure), "PDF lacks structure tags")
        precondition(pdf.page(at: 0)!.annotations.contains { $0.url?.host == "example.com" })
        precondition(pdf.page(at: 0)!.annotations.contains { $0.destination?.page != nil || $0.action is PDFActionGoTo },
                     "PDF lost its internal heading link")
        var pdfMetadata: CGPDFStreamRef?
        precondition(CGPDFDictionaryGetStream(catalog, "Metadata", &pdfMetadata), "PDF lacks XMP metadata")

        precondition(pdf.page(at: 0)?.annotations.first { $0.url?.host == "example.com" }?.contents == "Leer guía")
        withExtendedLifetime(raw) {
            var reverseTree: CGPDFDictionaryRef?
            precondition(CGPDFDictionaryGetDictionary(structure!, "ParentTree", &reverseTree),
                         "PDF lacks the reverse structural index")
        }
        withExtendedLifetime(raw) {
            var document: CGPDFDictionaryRef?
            var children: CGPDFArrayRef?
            precondition(CGPDFDictionaryGetDictionary(structure!, "K", &document))
            precondition(CGPDFDictionaryGetArray(document!, "K", &children))
            var inlineLinks = 0
            var linkBetweenSpans = false
            for index in 0..<CGPDFArrayGetCount(children!) {
                var block: CGPDFDictionaryRef?
                var contents: CGPDFArrayRef?
                guard CGPDFArrayGetDictionary(children!, index, &block),
                      CGPDFDictionaryGetArray(block!, "K", &contents) else { continue }
                for childIndex in 0..<CGPDFArrayGetCount(contents!) {
                    var child: CGPDFDictionaryRef?
                    var role: UnsafePointer<CChar>?
                    if CGPDFArrayGetDictionary(contents!, childIndex, &child),
                       CGPDFDictionaryGetName(child!, "S", &role),
                       let role, String(cString: role) == "Link" {
                        inlineLinks += 1
                        var linkChildren: CGPDFArrayRef?
                        var markedContent: CGPDFInteger = -1
                        var reference: CGPDFDictionaryRef?
                        precondition(CGPDFDictionaryGetArray(child!, "K", &linkChildren) &&
                            CGPDFArrayGetInteger(linkChildren!, 0, &markedContent) && markedContent >= 0 &&
                            CGPDFArrayGetDictionary(linkChildren!, 1, &reference))
                        var type: UnsafePointer<CChar>?
                        precondition(CGPDFDictionaryGetName(reference!, "Type", &type) &&
                            type.map { String(cString: $0) } == "OBJR")
                        if childIndex > 0 && childIndex + 1 < CGPDFArrayGetCount(contents!) {
                            linkBetweenSpans = true
                        }
                    }
                }
            }
            precondition(inlineLinks == 2 && linkBetweenSpans, "Links must own their text in its original position")
        }
        let reopenedDOCX = NativeConversionSource(filename: "Obra.versión.docx", title: "DOCX",
            format: "docx", text: "Text fallback", links: [], original: results[.docx]!)
        let docxHTML = try NativeDocumentConversion.convert(reopenedDOCX, to: .html,
            in: root.appendingPathComponent("docx-roundtrip"))
        let docxMarkup = try String(contentsOf: docxHTML, encoding: .utf8)
        precondition(docxMarkup.contains("<h2") && docxMarkup.contains("Ελληνικά") &&
            docxMarkup.contains("href=\"#c0-p0\">Volver") && docxMarkup.contains("https://example.com/a?x=1&amp;y=2"))

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

        let interruptedPDF = root.appendingPathComponent("interrupted-pdf")
        let interrupted = Task.detached { () throws -> Bool in
            do {
                _ = try NativeDocumentConversion.convert(source, to: .pdf, in: interruptedPDF) { progress in
                    if progress == 0.96 { withUnsafeCurrentTask { $0?.cancel() } }
                }
                return false
            } catch is CancellationError { return true }
        }
        let interruptedResult = try await interrupted.value
        let stagedFiles = try FileManager.default.contentsOfDirectory(atPath: interruptedPDF.path)
        precondition(interruptedResult && stagedFiles.isEmpty, "A cancelled PDF conversion must discard staging")

        let badZIP = root.appendingPathComponent("Dañado.epub")
        try Data([0x50, 0x4b, 0x03, 0x04]).write(to: badZIP)
        let damaged = NativeConversionSource(filename: badZIP.lastPathComponent, title: "Dañado",
            format: "epub", text: "Texto disponible en la biblioteca", links: [], original: badZIP)
        let fallbackHTML = try NativeDocumentConversion.convert(damaged, to: .html,
            in: root.appendingPathComponent("damaged"))
        let fallbackText = try String(contentsOf: fallbackHTML, encoding: .utf8)
        precondition(fallbackText.contains("Texto disponible en la biblioteca"))

        let collision = root.appendingPathComponent("collision", isDirectory: true)
        try FileManager.default.createDirectory(at: collision, withIntermediateDirectories: true)
        let existing = collision.appendingPathComponent("Largo.txt")
        try "Original intacto".write(to: existing, atomically: true, encoding: .utf8)
        do {
            _ = try NativeDocumentConversion.convert(longInput, to: .txt, in: collision)
            fatalError("The converter overwrote an existing destination")
        } catch {}
        let remaining = try FileManager.default.contentsOfDirectory(atPath: collision.path)
        let original = try String(contentsOf: existing, encoding: .utf8)
        precondition(original == "Original intacto" && remaining == ["Largo.txt"])

        let xhtml = root.appendingPathComponent("Original.xhtml")
        let png = "iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAFElEQVR4nGN0C0hhgAEmBiSAmwMAMboBAgT+U/YAAAAASUVORK5CYII="
        try """
        <html lang="es"><head><title>Tabla original</title><meta name="author" content="Autora"/></head><body>
        <h2 id="tabla">Tabla</h2><ul><li>Primero</li></ul><ol type="I" start="3"><li>Romano</li><li value="7">Reinicio</li></ol>
        <table><caption>Datos</caption><tr><th scope="col">Valor</th><td>Ñ</td></tr></table>
        <figure><img src="data:image/png;base64,\(png)" alt="Imagen de prueba" onload="bad()"/><figcaption>Figura original</figcaption></figure>
        <script>bad()</script><a href="#tabla">Volver</a>
        <p xml:lang="fr"><strong><em>Déjà vu</em></strong> <a href="#nota" role="doc-noteref">1</a></p>
        <aside id="nota" role="doc-footnote"><p>Hinweis – opinião.</p><p><strong>Énfasis en nota</strong> <u>Subrayado en nota</u> x<sup>2</sup> H<sub>2</sub>O</p></aside></body></html>
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
        let richDOCX = try NativeDocumentConversion.convert(reopened, to: .docx, in: richOutput)
        let richWord = try members(richDOCX)
        let wordXML = richWord["word/document.xml"]!
        let wordNumbering = richWord["word/numbering.xml"]!
        xml(wordNumbering)
        precondition(wordXML.contains("<w:numPr>") && wordNumbering.contains("upperRoman") &&
            wordNumbering.contains("<w:start w:val=\"7\"/>"))
        xml(wordXML)
        precondition(wordXML.contains("<w:tbl>") && wordXML.contains("descr=\"Imagen de prueba\"") &&
            wordXML.contains("<w:lang w:val=\"fr\""))
        let readWord = NativeConversionSource(filename: richDOCX.lastPathComponent, title: "Original",
            format: "docx", text: "Fallback", links: [], original: richDOCX)
        let wordAgain = try NativeDocumentConversion.convert(readWord, to: .epub,
            in: richOutput.appendingPathComponent("docx-roundtrip"))
        let wordRoundtrip = try members(wordAgain, mime: "application/epub+zip")["EPUB/book.xhtml"]!
        precondition(wordRoundtrip.contains("<strong>Énfasis en nota</strong>"))
        precondition(wordRoundtrip.contains("<ol start=\"3\" type=\"I\">") &&
            wordRoundtrip.contains("<ol start=\"7\" type=\"I\">"))
        precondition(wordRoundtrip.contains("<table>") && wordRoundtrip.contains("alt=\"Imagen de prueba\""))
        let richRTF = try NativeDocumentConversion.convert(reopened, to: .rtf, in: richOutput)
        let rtfMarkup = try String(contentsOf: richRTF, encoding: .utf8)
        precondition(rtfMarkup.contains("{\\footnote") && rtfMarkup.contains("Hinweis"))
        precondition(rtfMarkup.contains("\\outlinelevel1") && rtfMarkup.contains("\\pict") &&
            rtfMarkup.contains("Imagen de prueba") && rtfMarkup.contains("HYPERLINK") &&
            rtfMarkup.contains("\\trowd") && rtfMarkup.contains("\\cellx") && rtfMarkup.contains("\\listtable") && rtfMarkup.contains("\\levelnfc1") &&
            rtfMarkup.contains("\\levelstartat7") && rtfMarkup.contains("VII.\\tab"))
        let rtfRoundtrip = try NativeRTFConversionMarkup.xhtml(Data(rtfMarkup.utf8), title: "Prueba")
            .flatMap { String(data: $0, encoding: .utf8) } ?? ""
        precondition(rtfRoundtrip.contains("role=\"doc-footnote\"") && rtfRoundtrip.contains("role=\"doc-noteref\"") &&
            rtfRoundtrip.contains("Hinweis – opinião.") && rtfRoundtrip.contains("<strong>Énfasis en nota</strong>"))
        let richRTFReader = try NSAttributedString(url: richRTF,
            options: [.documentType: NSAttributedString.DocumentType.rtf], documentAttributes: nil)
        precondition(richRTFReader.string.contains("Imagen de prueba") && richRTFReader.string.contains("Déjà vu"))

        let merged = NativeConversionMarkup.Document(
            body: "<table><tr><td colspan=\"2\" rowspan=\"2\"><p>Combinada</p></td><td><p>A</p></td></tr><tr><td><p>B</p></td></tr></table><p><u>Subrayado</u> H<sub>2</sub>O x<sup>2</sup></p>",
            title: "Combinaciones", language: "es", metadata: [:], assets: [], headings: [])
        let mergedWord = try NativeDOCXConversionWriter().write(merged)
        precondition(mergedWord.body.contains("<w:vMerge w:val=\"restart\"/>") &&
            mergedWord.body.contains("<w:vMerge/>") && mergedWord.body.contains("<w:gridSpan w:val=\"2\"/>"))
        let mergedXML = "<w:document xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\"><w:body>\(mergedWord.body)</w:body></w:document>"
        let mergedRead = NativeDOCXConversionMarkup.xhtml(content: Data(mergedXML.utf8),
            relationships: nil, title: "Combinaciones").flatMap { String(data: $0, encoding: .utf8) } ?? ""
        precondition(mergedRead.contains("colspan=\"2\" rowspan=\"2\"") &&
            mergedRead.contains("<u>Subrayado</u>") && mergedRead.contains("<sub>2</sub>") &&
            mergedRead.contains("<sup>2</sup>"))
        precondition(mergedRead.components(separatedBy: "Combinada").count == 2)
        let mergedRTF = try NativeRTFConversionWriter(assets: []).write(merged)
        precondition(mergedRTF.contains("\\clvmgf\\clmgf") && mergedRTF.contains("\\clvmrg\\clmrg"))
        let importedRTF = try NativeRTFConversionMarkup.xhtml(Data(mergedRTF.utf8), title: "Combinaciones")
            .flatMap { String(data: $0, encoding: .utf8) } ?? ""
        precondition(importedRTF.contains("<table>") && importedRTF.contains("Combinada") &&
            importedRTF.contains("colspan=\"2\" rowspan=\"2\""), importedRTF)
        let mergedODT = try NativeODTConversionWriter(assets: []).write(merged.body)
        precondition(mergedODT.contains("table:number-columns-spanned=\"2\"") &&
            mergedODT.contains("table:number-rows-spanned=\"2\"") &&
            mergedODT.components(separatedBy: "<table:covered-table-cell/>").count == 4)

        // Numbering restarts must change the native list identity, not only the visible marker.
        let numbered = NativeConversionMarkup.Document(
            body: "<ol start=\"3\"><li>A</li><li value=\"8\">B</li><li>C</li></ol>",
            title: "Numeración", language: "es", metadata: [:], assets: [], headings: [])
        let numberedRTF = try NativeRTFConversionWriter(assets: []).write(numbered)
        precondition(numberedRTF.contains("\\levelstartat3") && numberedRTF.contains("\\levelstartat8"))
        precondition(numberedRTF.contains("\\ls1\\ilvl0 {\\listtext 3.\\tab}"))
        precondition(numberedRTF.contains("\\ls2\\ilvl0 {\\listtext 8.\\tab}"))
        precondition(numberedRTF.contains("\\ls2\\ilvl0 {\\listtext 9.\\tab}"))
        let nestedLists = NativeConversionMarkup.Document(
            body: "<ol><li>Exterior<ul><li>Interior</li></ul></li></ol>",
            title: "Jerarquía", language: "es", metadata: [:], assets: [], headings: [])
        let nestedRTF = try NativeRTFConversionWriter(assets: []).write(nestedLists)
        precondition(nestedRTF.contains("\\listhybrid") && nestedRTF.contains("\\ilvl1"))
        let numberedReader = try NSAttributedString(data: Data(numberedRTF.utf8),
            options: [.documentType: NSAttributedString.DocumentType.rtf], documentAttributes: nil)
        precondition(numberedReader.string.contains("A") && numberedReader.string.contains("B") &&
            numberedReader.string.contains("C"))

        let rtfSourceURL = root.appendingPathComponent("Estilo.rtf")
        try #"{\rtf1\ansi{\fonttbl{\f0 Helvetica;}}\f0 Texto {\b importante} {\i cursiva}.}"#
            .write(to: rtfSourceURL, atomically: true, encoding: .utf8)
        let rtfSource = NativeConversionSource(filename: "Estilo.rtf", title: "Estilo", format: "rtf",
            text: "Texto importante cursiva.", links: [], original: rtfSourceURL)
        let rtfHTML = try NativeDocumentConversion.convert(rtfSource, to: .html, in: richOutput)
        let rtfReopened = try String(contentsOf: rtfHTML, encoding: .utf8)
        precondition(rtfReopened.contains("<strong>importante</strong>") && rtfReopened.contains("<em>cursiva</em>"))

        let richODT = try NativeDocumentConversion.convert(reopened, to: .odt, in: richOutput)
        let odtPackage = try members(richODT, mime: "application/vnd.oasis.opendocument.text")
        let contentXML = odtPackage["content.xml"]!
        xml(contentXML)
        precondition(contentXML.contains("<text:note ") && contentXML.contains("<text:note-body>"))
        precondition(contentXML.contains("<table:table>") && contentXML.contains("<text:list ") &&
            contentXML.contains("Imagen de prueba") && contentXML.contains("text:outline-level=\"2\""))
        precondition(odtPackage["META-INF/manifest.xml"]!.contains("Pictures/assets/image-1.png"))
        let asODT = NativeConversionSource(filename: richODT.lastPathComponent, title: "Original",
            format: "odt", text: "Fallback", links: [], original: richODT)
        let recoveredEPUB = try NativeDocumentConversion.convert(asODT, to: .epub,
            in: richOutput.appendingPathComponent("odt-roundtrip"))
        let recoveredBook = try members(recoveredEPUB, mime: "application/epub+zip")["EPUB/book.xhtml"]!
        precondition(recoveredBook.contains("<table>") && recoveredBook.contains("<ul>") &&
            recoveredBook.contains("alt=\"Imagen de prueba\"") && recoveredBook.contains("Hinweis – opinião."))
        precondition(recoveredBook.contains("lang=\"fr\""))
        precondition(recoveredBook.contains("<u>Subrayado en nota</u>") &&
            recoveredBook.contains("<sup>2</sup>") && recoveredBook.contains("<sub>2</sub>"))
        precondition(recoveredBook.contains("<strong>Énfasis en nota</strong>"))
        precondition(recoveredBook.contains("role=\"doc-footnote\"") && recoveredBook.contains("role=\"doc-noteref\""))
        precondition(recoveredBook.contains("<ol type=\"I\">") &&
            recoveredBook.contains("<li value=\"3\">") && recoveredBook.contains("<li value=\"7\">") &&
            recoveredBook.contains("<span><strong><span><em>Déjà vu</em></span></strong></span>"))
        if CommandLine.arguments.count > 2 {
            let samples = URL(fileURLWithPath: CommandLine.arguments[2], isDirectory: true)
            let pdfText = "# Tabla\n\n## Primera sección\n\n" + longBody
            let languageSource = root.appendingPathComponent("Idioma.xhtml")
            try #"<html lang="es"><head><title>Documento multilingüe</title></head><body><p>Texto original.</p></body></html>"#
                .write(to: languageSource, atomically: true, encoding: .utf8)
            let pdfSource = NativeConversionSource(filename: "Multilingue.xhtml", title: "Documento multilingüe",
                format: "xhtml", text: pdfText + "\nRésumé — Ελληνικά — 会議", links: [], original: languageSource)
            let richPDF = try NativeDocumentConversion.convert(pdfSource, to: .pdf,
                in: root.appendingPathComponent("pdf-multipage"))
            let reopenedPDF = PDFDocument(url: richPDF)!
            precondition(reopenedPDF.pageCount > 1 && reopenedPDF.string!.contains("Primera sección"))
            try FileManager.default.copyItem(at: richPDF, to: samples.appendingPathComponent("conversion-multipage.pdf"))
        }

        precondition(NativeDocumentConversion.pdfHeadingLevels([3, 5, 4, 0, 2, 4, 4, 1, 6]) == [1, 2, 2, 0, 1, 2, 2, 1, 2])
        precondition(NativeDocumentConversion.pdfHeadingLevels([0, 1, 2, 3, 2, 1, 0]) == [0, 1, 2, 3, 2, 1, 0])
        precondition(NativeDocumentConversion.pdfHeadingLevels([0, 0]) == [0, 0])

        // A document with only headings and links also has useful source structure.
        let simpleMarkup = root.appendingPathComponent("Encabezados.xhtml")
        try """
        <html lang="es"><head><title>Encabezados y enlaces</title></head><body>
        <h3 id="inicio">Título original</h3><p>Un <a href="https://example.org/guia">enlace original</a>.</p>
        <h5>Subtítulo original</h5><p><a href="#inicio">Volver al título</a></p>
        </body></html>
        """.write(to: simpleMarkup, atomically: true, encoding: .utf8)
        let simpleSource = NativeConversionSource(filename: "Encabezados.xhtml", title: "Encabezados y enlaces",
            format: "xhtml", text: "Título original\nUn enlace original.\nSubtítulo original\nVolver al título",
            links: [], original: simpleMarkup)
        let simplePDF = try NativeDocumentConversion.convert(simpleSource, to: .pdf,
            in: root.appendingPathComponent("pdf-heading-links"))
        let simpleReopened = PDFDocument(url: simplePDF)!
        precondition(simpleReopened.string!.contains("Subtítulo original"))
        precondition(simpleReopened.page(at: 0)!.annotations.contains { $0.url?.host == "example.org" })
        precondition(simpleReopened.page(at: 0)!.annotations.contains { $0.destination?.page != nil || $0.action is PDFActionGoTo })
        if CommandLine.arguments.count > 2 {
            let samples = URL(fileURLWithPath: CommandLine.arguments[2], isDirectory: true)
            try FileManager.default.copyItem(at: simplePDF, to: samples.appendingPathComponent("conversion-heading-links.pdf"))
        }

        let simpleMarkdown = try NativeDocumentConversion.convert(simpleSource, to: .md,
            in: root.appendingPathComponent("markup-md"))
        let markdownSource = try String(contentsOf: simpleMarkdown, encoding: .utf8)
        precondition(markdownSource.contains("### Título original") && markdownSource.contains("##### Subtítulo original"))
        precondition(markdownSource.contains("[enlace original](<https://example.org/guia>)") &&
            markdownSource.contains("<a id=\"p0\"></a>") && markdownSource.contains("[Volver al título](<#p0>)"))
        for format in [NativeDocumentFormat.daisy, .daisy3, .fb2] {
            let url = try NativeDocumentConversion.convert(simpleSource, to: format,
                in: root.appendingPathComponent("markup-" + format.rawValue))
            if format == .fb2 {
                let contents = try String(contentsOf: url, encoding: .utf8)
                xml(contents)
                precondition(contents.contains("<title><p>Título original</p></title>"))
                precondition(contents.contains("l:href=\"#p0\"") && contents.contains("https://example.org/guia"))
            } else {
                let archive = try members(url)
                let book = archive[format == .daisy ? "book.xhtml" : "book.xml"]!
                let navigation = archive[format == .daisy ? "ncc.html" : "book.ncx"]!
                xml(book); xml(navigation)
                precondition(navigation.contains("Título original") && navigation.contains("Subtítulo original"))
                precondition(book.contains("href=\"#p0\"") && book.contains("https://example.org/guia"))
            }
        }

        let structuralPDF = try NativeDocumentConversion.convert(reopened, to: .pdf,
            in: root.appendingPathComponent("pdf-structured"))
        let structuredCG = CGPDFDocument(structuralPDF as CFURL)!
        withExtendedLifetime(structuredCG) {
            var rootTag: CGPDFDictionaryRef?
            precondition(CGPDFDictionaryGetDictionary(structuredCG.catalog!, "StructTreeRoot", &rootTag))
            var imageAlternative = false
            var columnScope = false
            var noteID: String?
            func roles(_ node: CGPDFDictionaryRef) -> Set<String> {
                var result: Set<String> = []
                var entry: UnsafePointer<CChar>?
                if CGPDFDictionaryGetName(node, "S", &entry), let entry {
                    let role = String(cString: entry)
                    result.insert(role)
                    var attributes: CGPDFDictionaryRef?
                    var scope: UnsafePointer<CChar>?
                    if role == "TH", CGPDFDictionaryGetDictionary(node, "A", &attributes), let attributes,
                       CGPDFDictionaryGetName(attributes, "Scope", &scope), let scope, String(cString: scope) == "Column" {
                        columnScope = true
                    }
                    var identifier: CGPDFStringRef?
                    if role == "Note", CGPDFDictionaryGetString(node, "ID", &identifier), let identifier,
                       let value = CGPDFStringCopyTextString(identifier) {
                        noteID = value as String
                    }
                    var alternative: CGPDFStringRef?
                    if role == "Figure", CGPDFDictionaryGetString(node, "Alt", &alternative), let alternative,
                       let value = CGPDFStringCopyTextString(alternative), value as String == "Imagen de prueba" {
                        imageAlternative = true
                    }
                }
                var child: CGPDFDictionaryRef?
                if CGPDFDictionaryGetDictionary(node, "K", &child), let child {
                    result.formUnion(roles(child))
                }
                var kids: CGPDFArrayRef?
                if CGPDFDictionaryGetArray(node, "K", &kids), let kids {
                    for index in 0..<CGPDFArrayGetCount(kids) {
                        var item: CGPDFDictionaryRef?
                        if CGPDFArrayGetDictionary(kids, index, &item), let item {
                            result.formUnion(roles(item))
                        }
                    }
                }
                return result
            }
            let actualRoles = roles(rootTag!)
            precondition(Set(["Table", "TR", "TH", "TD", "L", "LI", "LBody", "Figure", "Caption", "Note", "H1"]).isSubset(of: actualRoles))
            precondition(!actualRoles.contains("H2"), "The sole source H2 must start the PDF hierarchy at H1")
            precondition(imageAlternative && columnScope)
            var idTree: CGPDFDictionaryRef?
            var names: CGPDFArrayRef?
            var firstName: CGPDFStringRef?
            precondition(noteID != nil && CGPDFDictionaryGetDictionary(rootTag!, "IDTree", &idTree) &&
                CGPDFDictionaryGetArray(idTree!, "Names", &names) &&
                CGPDFArrayGetString(names!, 0, &firstName))
            precondition(CGPDFStringCopyTextString(firstName!).map { $0 as String } == noteID)
            var resources: CGPDFDictionaryRef?
            var xobjects: CGPDFDictionaryRef?
            let page = structuredCG.page(at: 1)!
            precondition(CGPDFDictionaryGetDictionary(page.dictionary!, "Resources", &resources) &&
                CGPDFDictionaryGetDictionary(resources!, "XObject", &xobjects), "The PDF must contain the image resource")
        }
        let structuredText = PDFDocument(url: structuralPDF)?.string ?? ""
        precondition(structuredText.contains("Hinweis – opinião.") && structuredText.contains("Figura original"))
        if CommandLine.arguments.count > 2 {
            let samples = URL(fileURLWithPath: CommandLine.arguments[2], isDirectory: true)
            try FileManager.default.copyItem(at: structuralPDF, to: samples.appendingPathComponent("conversion-complex.pdf"))
        }

        let complexODT = root.appendingPathComponent("Complejo.odt")
        let archive = try Archive(url: complexODT, accessMode: .create)
        let odtSource = """
        <office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
          xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"
          xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"
          xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0"
          xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0"
          xmlns:xlink="http://www.w3.org/1999/xlink"
          xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0"
          xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0">
          <office:automatic-styles>
            <style:style style:name="base" style:family="text">
              <style:text-properties fo:font-weight="bold" fo:language="fr"/>
            </style:style>
            <style:style style:name="child" style:family="text" style:parent-style-name="base">
              <style:text-properties fo:font-style="italic"/>
            </style:style>
          </office:automatic-styles>
          <office:body><office:text>
            <text:h text:outline-level="2">Reunión – 会議</text:h>
            <text:list><text:list-item><text:p>Café</text:p></text:list-item></text:list>
            <table:table><table:table-header-rows><table:table-row><table:table-cell>
              <text:p><text:span text:style-name="child">Résumé</text:span></text:p>
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
        precondition(complexBook.contains("<span lang=\"fr\"><strong><em>Résumé</em></strong></span>"))
        precondition(complexFiles["EPUB/book.opf"]!.contains("assets/image-1.png"))
        let complexDOCX = root.appendingPathComponent("Complejo.docx")
        let wordArchive = try Archive(url: complexDOCX, accessMode: .create)
        let wordSource = """
        <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
           xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
           xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
           xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
          <w:body><w:tbl><w:tr><w:trPr><w:tblHeader/></w:trPr><w:tc><w:p><w:r>
            <w:rPr><w:b/><w:lang w:val="fr"/></w:rPr><w:t>Résumé</w:t>
          </w:r></w:p></w:tc></w:tr></w:tbl><w:p><w:r><w:drawing>
            <wp:inline><wp:docPr id="1" name="Image" descr="Descripción en DOCX"/><a:blip r:embed="image1"/></wp:inline>
          </w:drawing></w:r></w:p></w:body>
        </w:document>
        """
        let wordRelations = """
        <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
          <Relationship Id="image1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/frame.png"/>
        </Relationships>
        """
        for (path, bytes) in [("word/document.xml", Data(wordSource.utf8)),
                              ("word/_rels/document.xml.rels", Data(wordRelations.utf8)),
                              ("word/media/frame.png", Data(base64Encoded: png)!)] {
            try wordArchive.addEntry(with: path, type: .file, uncompressedSize: Int64(bytes.count)) { offset, size in
                let start = Int(offset)
                return bytes.subdata(in: start..<min(bytes.count, start + size))
            }
        }
        let wordDocument = NativeConversionSource(filename: complexDOCX.lastPathComponent, title: "DOCX",
            format: "docx", text: "Text fallback", links: [], original: complexDOCX)
        let wordEPUB = try NativeDocumentConversion.convert(wordDocument, to: .epub,
            in: richOutput.appendingPathComponent("word"))
        let wordFiles = try members(wordEPUB, mime: "application/epub+zip")
        let wordBook = wordFiles["EPUB/book.xhtml"]!
        xml(wordBook)
        precondition(wordBook.contains("<th>") && wordBook.contains("<strong>Résumé</strong>") &&
            wordBook.contains("xml:lang=\"fr\"") && wordBook.contains("alt=\"Descripción en DOCX\""))
        precondition(wordFiles["EPUB/book.opf"]!.contains("assets/image-1.png"))
        let batchText = (0..<1200).map { "Línea \($0): Contenido para comprobar el lote." }.joined(separator: "\n")
        for index in 0..<12 {
            try autoreleasepool {
                let batchSource = NativeConversionSource(filename: "Lote-\(index).txt", title: "Lote",
                    format: "txt", text: batchText, links: [])
                let output = try NativeDocumentConversion.convert(batchSource, to: .rtf,
                    in: root.appendingPathComponent("batch-\(index)"))
                let size = try output.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0
                precondition(size > 10_000)
            }
        }
        print("Completed 12 sequential conversions of 1,200 paragraphs.")
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
