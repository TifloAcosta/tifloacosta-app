import Foundation
import CoreGraphics
import CoreText
import ZIPFoundation

enum NativeDocumentFormat: String, CaseIterable, Identifiable, Sendable {
    case txt, rtf, docx, html, epub, pdf, md, odt, fb2, daisy

    var id: String { rawValue }
    var label: String {
        switch self {
        case .md: return "Markdown"
        case .daisy: return NSLocalizedString("DAISY de texto", comment: "Text-only DAISY export")
        default: return rawValue.uppercased()
        }
    }

    var fileExtension: String { self == .daisy ? "zip" : rawValue }
}

struct NativeConversionSource: Sendable {
    struct Link: Sendable {
        let offset: Int
        let title: String
        let url: String
        let targetOffset: Int?
    }

    let filename: String
    let title: String
    let format: String
    let text: String
    let links: [Link]
    var original: URL? = nil

    var canConvert: Bool { text.contains { !$0.isWhitespace } }
}

enum NativeDocumentConversion {
    enum Failure: Error { case empty, invalidOutput }

    private struct Run {
        let text: String
        var url: URL?
        var target: Int?
    }

    private struct Paragraph {
        let offset: Int
        let level: Int
        let runs: [Run]
        var text: String { runs.map(\.text).joined() }
    }

    static func convert(_ input: NativeConversionSource, to format: NativeDocumentFormat,
                        in destination: URL, onProgress: (Double) -> Void = { _ in }) throws -> URL {
        guard input.canConvert else { throw Failure.empty }
        try Task.checkCancellation()
        let filename = URL(fileURLWithPath: input.filename).lastPathComponent
        let stem = input.format.isEmpty ? filename : (filename as NSString).deletingPathExtension
        let safeStem = stem.isEmpty || stem == "." || stem == ".." ? "document" : stem
        let output = destination.appendingPathComponent(safeStem).appendingPathExtension(format.fileExtension)
        try FileManager.default.createDirectory(at: destination, withIntermediateDirectories: true)
        do {
            if format == .txt || (format == .md && ["md", "markdown"].contains(input.format)) {
                try Data(input.text.utf8).write(to: output, options: .atomic)
            } else {
                let markup: NativeConversionMarkup.Document?
                do {
                    markup = try NativeConversionMarkup.read(input, for: format)
                } catch is CancellationError {
                    throw CancellationError()
                } catch {
                    markup = nil
                }
                let paragraphs = try parse(input) { onProgress($0 * 0.6) }
                onProgress(0.6)
                let title = xml(input.title)
                switch format {
                case .txt: break
                case .md: try write(try markdown(paragraphs), to: output)
                case .rtf: try write(try rtf(paragraphs, title: input.title), to: output)
                case .html:
                    let contents = try markup?.xhtml() ?? xhtml(paragraphs, title: title)
                    try write("<!DOCTYPE html>\n" + contents, to: output)
                case .epub: try epub(paragraphs, title: title, markup: markup, output: output)
                case .docx: try docx(paragraphs, title: title, output: output)
                case .odt: try odt(paragraphs, title: title, output: output)
                case .fb2: try fb2(paragraphs, title: title, output: output)
                case .daisy: try daisy(paragraphs, title: title, markup: markup, output: output)
                case .pdf: try pdf(paragraphs, title: input.title, markup: markup, output: output) { onProgress(0.6 + $0 * 0.4) }
                }
            }
            try Task.checkCancellation()
            guard try output.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0 > 0 else {
                throw Failure.invalidOutput
            }
            onProgress(1)
            return output
        } catch {
            try? FileManager.default.removeItem(at: output)
            throw error
        }
    }

    private static func parse(_ input: NativeConversionSource, onProgress: (Double) -> Void) throws -> [Paragraph] {
        let headingFormats: Set<String> = ["html", "htm", "xhtml", "epub", "md", "markdown", "docx", "odt", "daisy"]
        let links = input.links.filter { $0.offset >= 0 && !$0.title.isEmpty }.sorted { $0.offset < $1.offset }
        var linkIndex = 0
        var offset = 0
        var start = input.text.startIndex
        var paragraphs: [Paragraph] = []
        let total = max(1, input.text.count)
        while start < input.text.endIndex {
            try Task.checkCancellation()
            let end = input.text[start...].firstIndex(where: \.isNewline) ?? input.text.endIndex
            let line = input.text[start..<end]
            let length = line.count
            let marks = line.prefix(while: { $0 == "#" }).count
            let marked = headingFormats.contains(input.format) && (1...6).contains(marks)
                && line.dropFirst(marks).first == " "
            let prefix = marked ? marks + 1 : 0
            var cursor = line.index(line.startIndex, offsetBy: prefix)
            var cursorOffset = offset + prefix
            var runs: [Run] = []
            while linkIndex < links.count, links[linkIndex].offset < offset + length {
                let link = links[linkIndex]
                linkIndex += 1
                guard link.offset >= cursorOffset,
                      link.title.count <= offset + length - link.offset else { continue }
                let lower = line.index(cursor, offsetBy: link.offset - cursorOffset)
                let upper = line.index(lower, offsetBy: link.title.count)
                guard line[lower..<upper] == link.title else { continue }
                let url = URL(string: link.url).flatMap { url in
                    ["http", "https", "mailto"].contains(url.scheme?.lowercased() ?? "") ? url : nil
                }
                guard url != nil || link.targetOffset != nil else { continue }
                if cursor < lower { runs.append(Run(text: String(line[cursor..<lower]))) }
                runs.append(Run(text: link.title, url: url, target: link.targetOffset))
                cursor = upper
                cursorOffset = link.offset + link.title.count
            }
            if cursor < end { runs.append(Run(text: String(line[cursor..<end]))) }
            paragraphs.append(Paragraph(offset: offset, level: marked ? marks : 0, runs: runs))
            if end == input.text.endIndex { break }
            start = input.text.index(after: end)
            offset += length + 1
            if paragraphs.count.isMultiple(of: 128) { onProgress(Double(offset) / Double(total)) }
        }
        return paragraphs
    }

    static func xml(_ value: String) -> String {
        let scalars = value.unicodeScalars.filter {
            switch $0.value {
            case 9, 10, 13, 32...0xD7FF, 0xE000...0xFFFD, 0x10000...0x10FFFF: return true
            default: return false
            }
        }
        return String(String.UnicodeScalarView(scalars))
            .replacingOccurrences(of: "&", with: "&amp;")
            .replacingOccurrences(of: "<", with: "&lt;")
            .replacingOccurrences(of: ">", with: "&gt;")
            .replacingOccurrences(of: "\"", with: "&quot;")
            .replacingOccurrences(of: "'", with: "&apos;")
    }

    private static func write(_ contents: String, to url: URL) throws {
        try Data(contents.utf8).write(to: url, options: .atomic)
    }

    private static func anchor(for target: Int?, in paragraphs: [Paragraph]) -> String? {
        guard let target, target >= 0, !paragraphs.isEmpty else { return nil }
        var lower = 0
        var upper = paragraphs.count
        while lower + 1 < upper {
            let middle = (lower + upper) / 2
            if paragraphs[middle].offset <= target { lower = middle } else { upper = middle }
        }
        return "p\(paragraphs[lower].offset)"
    }

    private static func xhtml(_ paragraphs: [Paragraph], title: String,
                              header: String = "<meta charset=\"utf-8\"/>") throws -> String {
        let body = try paragraphs.map { paragraph in
            try Task.checkCancellation()
            let tag = paragraph.level > 0 ? "h\(paragraph.level)" : "p"
            let text = paragraph.runs.map { run in
                let label = xml(run.text)
                let href = anchor(for: run.target, in: paragraphs).map { "#" + $0 } ?? run.url?.absoluteString
                return href.map { "<a href=\"\(xml($0))\">\(label)</a>" } ?? label
            }.joined()
            return "<\(tag) id=\"p\(paragraph.offset)\">\(text)</\(tag)>"
        }.joined(separator: "\n")
        return "<html xmlns=\"http://www.w3.org/1999/xhtml\"><head>\(header)<title>\(title)</title></head><body>\(body)</body></html>"
    }

    private static func daisy(_ paragraphs: [Paragraph], title: String,
                              markup: NativeConversionMarkup.Document?, output: URL) throws {
        let declaration = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>"
        let xhtmlDTD = #"<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">"#
        let smilDTD = #"<!DOCTYPE smil PUBLIC "-//W3C//DTD SMIL 1.0//EN" "http://www.w3.org/TR/REC-smil/SMIL10.dtd">"#
        let encoding = #"<meta http-equiv="Content-Type" content="text/html; charset=UTF-8"/>"#
        let identifier = "urn:uuid:" + UUID().uuidString.lowercased()
        let date = String(ISO8601DateFormatter().string(from: Date()).prefix(10))
        let headings = paragraphs.filter { $0.level > 0 && !$0.text.trimmingCharacters(in: .whitespaces).isEmpty }
        // The NCC requires a title entry at level 1, even when the source has no headings.
        let first = paragraphs[0].offset
        var index = "<h1 id=\"start\" class=\"title\"><a href=\"book.smil#s\(first)\">\(title)</a></h1>"
        for heading in headings {
            try Task.checkCancellation()
            index += "<h\(heading.level) id=\"n\(heading.offset)\"><a href=\"book.smil#s\(heading.offset)\">\(xml(heading.text))</a></h\(heading.level)>"
        }
        var metadata = [
            "dc:title": title, "dc:format": "Daisy 2.02", "dc:identifier": identifier,
            "dc:publisher": "TifloAcosta", "dc:date": date, "dc:language": xml(markup?.language ?? "und"),
            "ncc:charset": "UTF-8", "ncc:multimediaType": "textNcc", "ncc:totalTime": "00:00:00",
            "ncc:tocItems": String(headings.count + 1), "ncc:files": "3",
            "ncc:pageFront": "0", "ncc:pageNormal": "0", "ncc:pageSpecial": "0",
            "ncc:depth": String(headings.map(\.level).max() ?? 1)
        ]
        for (source, target) in [("author", "dc:creator"), ("description", "dc:description")] {
            if let value = markup?.metadata[source] { metadata[target] = xml(value) }
        }
        let meta = metadata.sorted { $0.key < $1.key }.map {
            "<meta name=\"\($0.key)\" content=\"\($0.value)\"/>"
        }.joined()
        let ncc = declaration + "\n" + xhtmlDTD + "\n" +
            "<html xmlns=\"http://www.w3.org/1999/xhtml\"><head><title>\(title)</title>\(encoding)\(meta)</head><body>\(index)</body></html>"
        let segments = try paragraphs.map { paragraph in
            try Task.checkCancellation()
            let id = paragraph.offset
            return "<par id=\"s\(id)\" endsync=\"last\"><text id=\"t\(id)\" src=\"book.xhtml#p\(id)\"/></par>"
        }.joined()
        let smil = declaration + "\n" + smilDTD + "\n" +
            "<smil><head><meta name=\"dc:format\" content=\"Daisy 2.02\"/><meta name=\"dc:identifier\" content=\"\(identifier)\"/><layout><region id=\"txtView\"/></layout></head><body><seq dur=\"0.0s\">\(segments)</seq></body></smil>"
        let book = try declaration + "\n" + xhtmlDTD + "\n" +
            xhtml(paragraphs, title: title, header: encoding)
        try package([("ncc.html", ncc), ("book.smil", smil), ("book.xhtml", book)], output: output)
    }

    private static func markdown(_ paragraphs: [Paragraph]) throws -> String {
        func escaped(_ text: String) -> String {
            var result = ""
            for character in text {
                if "\\`*_{}[]<>#+-.!|~".contains(character) { result.append("\\") }
                result.append(character)
            }
            return result
        }
        return try paragraphs.map { paragraph in
            try Task.checkCancellation()
            let heading = paragraph.level > 0 ? String(repeating: "#", count: paragraph.level) + " " : ""
            let content = paragraph.runs.map { run in
                let label = escaped(run.text)
                return run.url.map { "[\(label)](<\($0.absoluteString)>)" } ?? label
            }.joined()
            return heading + content
        }.joined(separator: "\n")
    }

    private static func rtf(_ paragraphs: [Paragraph], title: String) throws -> String {
        func escaped(_ text: String) -> String {
            var result = ""
            for unit in text.utf16 {
                switch unit {
                case 9: result += "\\tab "
                case 92, 123, 125: result += "\\" + String(UnicodeScalar(unit)!)
                case 32...126: result += String(UnicodeScalar(unit)!)
                case 0...31: continue
                default: result += "\\u\(Int16(bitPattern: unit))?"
                }
            }
            return result
        }
        var result = "{\\rtf1\\ansi\\uc1{\\fonttbl{\\f0 Arial;}}{\\info{\\title \(escaped(title))}}\\f0\\fs24 "
        for paragraph in paragraphs {
            try Task.checkCancellation()
            let text = paragraph.runs.map { run in
                let label = escaped(run.text)
                guard let url = run.url else { return label }
                return "{\\field{\\*\\fldinst HYPERLINK \"\(escaped(url.absoluteString))\"}{\\fldrslt \(label)}}"
            }.joined()
            if paragraph.level > 0 {
                result += "\\pard\\outlinelevel\(paragraph.level - 1)\\b \(text)\\b0\\par\n"
            } else {
                result += "\\pard \(text)\\par\n"
            }
        }
        return result + "}"
    }

    private static func package(_ files: [(String, String)], mime: String? = nil, assets: [NativeConversionMarkup.Asset] = [], output: URL) throws {
        guard let archive = Archive(url: output, accessMode: .create) else { throw Failure.invalidOutput }
        let textMembers = mime.map { [("mimetype", $0)] + files } ?? files
        let members = textMembers.map { ($0.0, Data($0.1.utf8)) } + assets.map { ($0.path, $0.data) }
        for (path, data) in members {
            try Task.checkCancellation()
            try archive.addEntry(with: path, type: .file, uncompressedSize: Int64(data.count),
                compressionMethod: path == "mimetype" ? .none : .deflate) { position, size in
                    try Task.checkCancellation()
                    let offset = Int(position)
                    return data.subdata(in: offset..<min(offset + size, data.count))
                }
        }
    }

    private static func epub(_ paragraphs: [Paragraph], title fallbackTitle: String,
                             markup: NativeConversionMarkup.Document?, output: URL) throws {
        let title = markup.map { xml($0.title) } ?? fallbackTitle
        let headings = markup?.headings ?? paragraphs.filter { $0.level > 0 }.map { ("p\($0.offset)", $0.text) }
        let links = headings.map { "<li><a href=\"book.xhtml#\(xml($0.0))\">\(xml($0.1))</a></li>" }.joined()
        let assetItems = (markup?.assets ?? []).enumerated().map {
            "<item id=\"image-\($0.offset + 1)\" href=\"\(xml($0.element.path))\" media-type=\"\(xml($0.element.mediaType))\"/>"
        }.joined()
        let author = markup?.metadata["author"].map { "<dc:creator>\(xml($0))</dc:creator>" } ?? ""
        let language = xml(markup?.language ?? "und")
        let toc = links.isEmpty ? "<li><a href=\"book.xhtml\">\(title)</a></li>" : links
        let nav = "<html xmlns=\"http://www.w3.org/1999/xhtml\" xmlns:epub=\"http://www.idpf.org/2007/ops\"><head><title>\(title)</title></head><body><nav epub:type=\"toc\"><ol>\(toc)</ol></nav></body></html>"
        let opf = """
        <package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">urn:uuid:\(UUID().uuidString.lowercased())</dc:identifier><dc:title>\(title)</dc:title><dc:language>\(language)</dc:language>\(author)<meta property="dcterms:modified">\(ISO8601DateFormatter().string(from: Date()))</meta></metadata><manifest><item id="book" href="book.xhtml" media-type="application/xhtml+xml"/><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>\(assetItems)</manifest><spine><itemref idref="book"/></spine></package>
        """
        try package([
            ("META-INF/container.xml", "<container version=\"1.0\" xmlns=\"urn:oasis:names:tc:opendocument:xmlns:container\"><rootfiles><rootfile full-path=\"EPUB/book.opf\" media-type=\"application/oebps-package+xml\"/></rootfiles></container>"),
            ("EPUB/book.opf", opf), ("EPUB/book.xhtml", try markup?.xhtml() ?? xhtml(paragraphs, title: title)),
            ("EPUB/nav.xhtml", nav)
        ], mime: "application/epub+zip", assets: (markup?.assets ?? []).map {
            .init(path: "EPUB/" + $0.path, mediaType: $0.mediaType, data: $0.data)
        }, output: output)
    }

    private static func docx(_ paragraphs: [Paragraph], title: String, output: URL) throws {
        let office = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
        let relationship = "http://schemas.openxmlformats.org/package/2006/relationships"
        var references = "<Relationship Id=\"styles\" Type=\"\(office)/styles\" Target=\"styles.xml\"/>"
        var number = 0
        let body = try paragraphs.map { paragraph in
            try Task.checkCancellation()
            let style = paragraph.level > 0 ? "<w:pPr><w:pStyle w:val=\"Heading\(paragraph.level)\"/></w:pPr>" : ""
            let text = paragraph.runs.map { run in
                let label = "<w:r><w:t xml:space=\"preserve\">\(xml(run.text))</w:t></w:r>"
                if let bookmark = anchor(for: run.target, in: paragraphs) {
                    return "<w:hyperlink w:anchor=\"\(bookmark)\">\(label)</w:hyperlink>"
                }
                guard let url = run.url else { return label }
                number += 1
                references += "<Relationship Id=\"url\(number)\" Type=\"\(office)/hyperlink\" Target=\"\(xml(url.absoluteString))\" TargetMode=\"External\"/>"
                return "<w:hyperlink r:id=\"url\(number)\">\(label)</w:hyperlink>"
            }.joined()
            return "<w:p>\(style)<w:bookmarkStart w:id=\"\(paragraph.offset)\" w:name=\"p\(paragraph.offset)\"/>\(text)<w:bookmarkEnd w:id=\"\(paragraph.offset)\"/></w:p>"
        }.joined()
        let styleNS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
        let styles = (1...6).map {
            "<w:style w:type=\"paragraph\" w:styleId=\"Heading\($0)\"><w:name w:val=\"heading \($0)\"/><w:pPr><w:outlineLvl w:val=\"\($0 - 1)\"/></w:pPr><w:rPr><w:b/><w:sz w:val=\"\(38 - $0 * 2)\"/></w:rPr></w:style>"
        }.joined()
        let types = """
        <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>
        """
        try package([
            ("[Content_Types].xml", types),
            ("_rels/.rels", "<Relationships xmlns=\"\(relationship)\"><Relationship Id=\"doc\" Type=\"\(office)/officeDocument\" Target=\"word/document.xml\"/><Relationship Id=\"meta\" Type=\"\(relationship)/metadata/core-properties\" Target=\"docProps/core.xml\"/></Relationships>"),
            ("word/document.xml", "<w:document xmlns:w=\"\(styleNS)\" xmlns:r=\"\(office)\"><w:body>\(body)</w:body></w:document>"),
            ("word/styles.xml", "<w:styles xmlns:w=\"\(styleNS)\">\(styles)</w:styles>"),
            ("word/_rels/document.xml.rels", "<Relationships xmlns=\"\(relationship)\">\(references)</Relationships>"),
            ("docProps/core.xml", "<cp:coreProperties xmlns:cp=\"http://schemas.openxmlformats.org/package/2006/metadata/core-properties\" xmlns:dc=\"http://purl.org/dc/elements/1.1/\"><dc:title>\(title)</dc:title></cp:coreProperties>")
        ], output: output)
    }

    private static func odt(_ paragraphs: [Paragraph], title: String, output: URL) throws {
        let mime = "application/vnd.oasis.opendocument.text"
        let office = "urn:oasis:names:tc:opendocument:xmlns:office:1.0"
        let body = try paragraphs.map { paragraph in
            try Task.checkCancellation()
            let tag = paragraph.level > 0 ? "h" : "p"
            let level = paragraph.level > 0 ? " text:outline-level=\"\(paragraph.level)\"" : ""
            let content = paragraph.runs.map { run in
                let text = xml(run.text).replacingOccurrences(of: " ", with: "<text:s/>")
                    .replacingOccurrences(of: "\t", with: "<text:tab/>")
                let href = anchor(for: run.target, in: paragraphs).map { "#" + $0 } ?? run.url?.absoluteString
                return href.map { "<text:a xlink:href=\"\(xml($0))\">\(text)</text:a>" } ?? text
            }.joined()
            return "<text:\(tag)\(level)><text:bookmark text:name=\"p\(paragraph.offset)\"/>\(content)</text:\(tag)>"
        }.joined()
        try package([
            ("content.xml", "<office:document-content xmlns:office=\"\(office)\" xmlns:text=\"urn:oasis:names:tc:opendocument:xmlns:text:1.0\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" office:version=\"1.2\"><office:body><office:text>\(body)</office:text></office:body></office:document-content>"),
            ("meta.xml", "<office:document-meta xmlns:office=\"\(office)\" xmlns:dc=\"http://purl.org/dc/elements/1.1/\" office:version=\"1.2\"><office:meta><dc:title>\(title)</dc:title></office:meta></office:document-meta>"),
            ("META-INF/manifest.xml", "<manifest:manifest xmlns:manifest=\"urn:oasis:names:tc:opendocument:xmlns:manifest:1.0\" manifest:version=\"1.2\"><manifest:file-entry manifest:full-path=\"/\" manifest:media-type=\"\(mime)\"/><manifest:file-entry manifest:full-path=\"content.xml\" manifest:media-type=\"text/xml\"/><manifest:file-entry manifest:full-path=\"meta.xml\" manifest:media-type=\"text/xml\"/></manifest:manifest>")
        ], mime: mime, output: output)
    }

    private static func fb2(_ paragraphs: [Paragraph], title: String, output: URL) throws {
        var body = ""
        var openSection = false
        var sectionHasContent = false
        func closeSection() {
            if openSection {
                if !sectionHasContent { body += "<empty-line/>" }
                body += "</section>"
            }
        }
        for paragraph in paragraphs {
            try Task.checkCancellation()
            let text = paragraph.runs.map { run in
                let label = xml(run.text)
                let href = anchor(for: run.target, in: paragraphs).map { "#" + $0 } ?? run.url?.absoluteString
                return href.map { "<a l:href=\"\(xml($0))\">\(label)</a>" } ?? label
            }.joined()
            if paragraph.level > 0 {
                closeSection()
                body += "<section id=\"p\(paragraph.offset)\"><title><p>\(text)</p></title>"
                openSection = true
                sectionHasContent = false
            } else {
                if !openSection {
                    body += "<section>"
                    openSection = true
                }
                sectionHasContent = true
                body += "<p id=\"p\(paragraph.offset)\">\(text)</p>"
            }
        }
        closeSection()
        let date = String(ISO8601DateFormatter().string(from: Date()).prefix(10))
        let contents = "<FictionBook xmlns=\"http://www.gribuser.ru/xml/fictionbook/2.0\" xmlns:l=\"http://www.w3.org/1999/xlink\"><description><title-info><genre>unrecognised</genre><author><nickname/></author><book-title>\(title)</book-title><lang>und</lang></title-info><document-info><author><nickname/></author><date value=\"\(date)\">\(date)</date><id>\(UUID().uuidString)</id><version>1.0</version></document-info></description><body>\(body)</body></FictionBook>"
        try write(contents, to: output)
    }

    private static func pdf(_ paragraphs: [Paragraph], title: String, markup: NativeConversionMarkup.Document?, output: URL,
                            onProgress: (Double) -> Void) throws {
        let text = NSMutableAttributedString(string: "")
        let key = NSAttributedString.Key(kCTFontAttributeName as String)
        let normal = CTFontCreateWithName("Helvetica" as CFString, 11, nil)
        let heading = CTFontCreateWithName("Helvetica-Bold" as CFString, 15, nil)
        let headerTags: [CGPDFTagType] = [.paragraph, .header1, .header2, .header3, .header4, .header5, .header6]
        var paragraphStarts: [Int] = []
        var linkRanges: [(range: NSRange, url: URL?, anchor: String?)] = []
        var destinationNames: Set<String> = []
        let language = markup?.language?.trimmingCharacters(in: .whitespacesAndNewlines)
        var tagProperties: [String: String] = [:]
        if let language, !language.isEmpty {
            tagProperties[CGPDFTagProperty.languageText.rawValue as String] = language
        }
        for paragraph in paragraphs {
            try Task.checkCancellation()
            paragraphStarts.append(text.length)
            var lineOffset = text.length
            for run in paragraph.runs {
                let length = run.text.utf16.count
                if length > 0 {
                    let target = anchor(for: run.target, in: paragraphs)
                    if let target { destinationNames.insert(target) }
                    if run.url != nil || target != nil {
                        linkRanges.append((NSRange(location: lineOffset, length: length), run.url, target))
                    }
                }
                lineOffset += length
            }
            text.append(NSAttributedString(string: paragraph.text + "\n",
                attributes: [key: paragraph.level > 0 ? heading : normal]))
        }
        let framesetter = CTFramesetterCreateWithAttributedString(text)
        var page = CGRect(x: 0, y: 0, width: 595, height: 842)
        let author = markup?.metadata["author"]
        let description = markup?.metadata["description"]
        var metadata = [kCGPDFContextTitle as String: title, kCGPDFContextCreator as String: "TifloAcosta"]
        if let author { metadata[kCGPDFContextAuthor as String] = author }
        if let description { metadata[kCGPDFContextSubject as String] = description }
        guard let context = CGContext(output as CFURL, mediaBox: &page, metadata as CFDictionary) else { throw Failure.invalidOutput }
        defer { context.closePDF() }
        let creatorXML = author.map { "<dc:creator><rdf:Seq><rdf:li>\(xml($0))</rdf:li></rdf:Seq></dc:creator>" } ?? ""
        let descriptionXML = description.map {
            "<dc:description><rdf:Alt><rdf:li xml:lang=\"x-default\">\(xml($0))</rdf:li></rdf:Alt></dc:description>"
        } ?? ""
        let languageXML = language.map { "<dc:language><rdf:Bag><rdf:li>\(xml($0))</rdf:li></rdf:Bag></dc:language>" } ?? ""
        let xmp = """
        <x:xmpmeta xmlns:x="adobe:ns:meta/">
          <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
            <rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/">
              <dc:title><rdf:Alt><rdf:li xml:lang="x-default">\(xml(title))</rdf:li></rdf:Alt></dc:title>
              \(creatorXML)\(descriptionXML)\(languageXML)
            </rdf:Description>
          </rdf:RDF>
        </x:xmpmeta>
        """
        context.addDocumentMetadata(Data(xmp.utf8) as CFData)
        let path = CGPath(rect: page.insetBy(dx: 48, dy: 48), transform: nil)
        var offset = 0
        var paragraphIndex = 0
        var linkIndex = 0
        while offset < text.length {
            try Task.checkCancellation()
            let frame = CTFramesetterCreateFrame(framesetter, CFRange(location: offset, length: 0), path, nil)
            let visible = CTFrameGetVisibleStringRange(frame)
            guard visible.length > 0 else { throw Failure.invalidOutput }
            context.beginPDFPage(nil)
            context.textMatrix = .identity
            let lines = CTFrameGetLines(frame) as! [CTLine]
            var origins = Array(repeating: CGPoint.zero, count: lines.count)
            CTFrameGetLineOrigins(frame, CFRange(location: 0, length: 0), &origins)
            var openParagraph: Int?
            for (line, origin) in zip(lines, origins) {
                let range = CTLineGetStringRange(line)
                while paragraphIndex + 1 < paragraphStarts.count,
                      paragraphStarts[paragraphIndex + 1] <= range.location { paragraphIndex += 1 }
                if openParagraph != paragraphIndex {
                    if openParagraph != nil { CGPDFContextEndTag(context) }
                    CGPDFContextBeginTag(context, headerTags[paragraphs[paragraphIndex].level], tagProperties as CFDictionary)
                    openParagraph = paragraphIndex
                }
                let point = CGPoint(x: origin.x + path.boundingBox.minX, y: origin.y + path.boundingBox.minY)
                if range.location == paragraphStarts[paragraphIndex] {
                    let destination = "p\(paragraphs[paragraphIndex].offset)"
                    if destinationNames.contains(destination) {
                        context.addDestination(destination as CFString, at: point)
                    }
                }
                context.textPosition = point
                CTLineDraw(line, context)
                let lineEnd = range.location + range.length
                while linkIndex < linkRanges.count,
                      NSMaxRange(linkRanges[linkIndex].0) <= range.location { linkIndex += 1 }
                var index = linkIndex
                while index < linkRanges.count, linkRanges[index].0.location < lineEnd {
                    let (link, url, anchor) = linkRanges[index]
                    let bounds = NSIntersectionRange(link, NSRange(location: range.location, length: range.length))
                    let startX = CTLineGetOffsetForStringIndex(line, bounds.location, nil)
                    let endX = CTLineGetOffsetForStringIndex(line, NSMaxRange(bounds), nil)
                    var ascent: CGFloat = 0
                    var descent: CGFloat = 0
                    CTLineGetTypographicBounds(line, &ascent, &descent, nil)
                    if bounds.length > 0, endX != startX {
                        let rect = CGRect(x: point.x + min(startX, endX), y: point.y - descent,
                            width: abs(endX - startX), height: ascent + descent)
                        if let anchor { context.setDestination(anchor as CFString, for: rect) }
                        else if let url { context.setURL(url as CFURL, for: rect) }
                    }
                    index += 1
                }
            }
            if openParagraph != nil { CGPDFContextEndTag(context) }
            context.endPDFPage()
            offset += visible.length
            onProgress(Double(offset) / Double(text.length))
        }
    }
}
