import Foundation
import CoreGraphics
import CoreText
import NaturalLanguage
#if canImport(TifloPDFPostprocess)
import TifloPDFPostprocess
#endif
import ZIPFoundation

enum NativeDocumentFormat: String, CaseIterable, Identifiable, Sendable {
    case txt, rtf, docx, html, epub, pdf, md, odt, fb2, daisy, daisy3

    var id: String { rawValue }
    var label: String {
        switch self {
        case .md: return "Markdown"
        case .daisy: return NSLocalizedString("DAISY 2.02 de texto", comment: "Text-only DAISY 2.02 export")
        case .daisy3: return NSLocalizedString("DAISY 3 de texto", comment: "Text-only DAISY 3 export")
        default: return rawValue.uppercased()
        }
    }

    var fileExtension: String { self == .daisy || self == .daisy3 ? "zip" : rawValue }
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
        let finalURL = destination.appendingPathComponent(safeStem).appendingPathExtension(format.fileExtension)
        let files = FileManager.default
        try files.createDirectory(at: destination, withIntermediateDirectories: true)
        let staging = destination.appendingPathComponent(".conversion-" + UUID().uuidString, isDirectory: true)
        try files.createDirectory(at: staging, withIntermediateDirectories: false)
        defer { try? files.removeItem(at: staging) }
        let output = staging.appendingPathComponent(finalURL.lastPathComponent)

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
            let usesOnlyMarkup = markup != nil && [.html, .epub, .odt, .rtf, .docx].contains(format)
            let paragraphs = usesOnlyMarkup ? [] : try parse(input) { onProgress($0 * 0.6) }
            onProgress(0.6)
            let title = xml(input.title)
            switch format {
            case .txt: break
            case .md: try write(try markdown(paragraphs), to: output)
            case .rtf: try write(try markup.map { try NativeRTFConversionWriter(assets: $0.assets).write($0) } ?? rtf(paragraphs, title: input.title), to: output)
            case .html:
                let contents = try markup?.xhtml() ?? xhtml(paragraphs, title: title)
                try write("<!DOCTYPE html>\n" + contents, to: output)
            case .epub: try epub(paragraphs, title: title, markup: markup, output: output)
            case .docx: try docx(paragraphs, title: title, markup: markup, output: output)
            case .odt: try odt(paragraphs, title: title, markup: markup, output: output)
            case .fb2: try fb2(paragraphs, title: title, output: output)
            case .daisy: try daisy(paragraphs, title: title, markup: markup, output: output)
            case .daisy3: try daisy3(paragraphs, title: title, markup: markup, output: output)
            case .pdf:
                let intermediate = staging.appendingPathComponent("rendered-" + UUID().uuidString + ".pdf")
                let metadata = try pdf(paragraphs, title: input.title, markup: markup, output: intermediate) {
                    onProgress(0.6 + $0 * 0.35)
                }
                try Task.checkCancellation()
                try finishPDF(intermediate, output: output, language: metadata.language, labels: metadata.labels)
            }
        }
        try Task.checkCancellation()
        guard try output.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0 > 0 else {
            throw Failure.invalidOutput
        }
        try files.moveItem(at: output, to: finalURL)
        onProgress(1)
        return finalURL
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

    private static func daisy3(_ paragraphs: [Paragraph], title: String,
                               markup: NativeConversionMarkup.Document?, output: URL) throws {
        let language = xml(markup?.language ?? "und")
        let uid = "urn:uuid:" + UUID().uuidString.lowercased()
        let declaration = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n"
        var book = ""
        var smil = ""
        var navigation = ""
        var level = 0
        var headingNeedsBody = false
        var navigationLevels: [Int] = []
        var headingDepth = 1
        var playOrder = 0

        func navPoint(_ text: String, id: Int) -> String {
            playOrder += 1
            return "<navPoint id=\"nav\(id)\" playOrder=\"\(playOrder)\"><navLabel><text>\(text)</text></navLabel><content src=\"book.smil#s\(id)\"/>"
        }

        for paragraph in paragraphs {
            try Task.checkCancellation()
            let id = paragraph.offset
            let isHeading = paragraph.level > 0 && !paragraph.text.trimmingCharacters(in: .whitespaces).isEmpty
            let tag: String
            if isHeading {
                let nextLevel = min(paragraph.level, level + 1)
                while level >= nextLevel {
                    if headingNeedsBody { book += "<p/>"; headingNeedsBody = false }
                    book += "</level\(level)>"
                    level -= 1
                }
                level = nextLevel
                book += "<level\(level)>"
                tag = "h\(level)"
                headingNeedsBody = true
                while let last = navigationLevels.last, last >= level {
                    navigation += "</navPoint>"
                    navigationLevels.removeLast()
                }
                navigation += navPoint(xml(paragraph.text), id: id)
                navigationLevels.append(level)
                headingDepth = max(headingDepth, navigationLevels.count)
            } else {
                if level == 0 {
                    level = 1
                    book += "<level1>"
                    navigation += navPoint(title, id: id)
                    navigationLevels.append(1)
                }
                tag = "p"
                headingNeedsBody = false
            }
            let body = paragraph.runs.map { run in
                let label = xml(run.text)
                let href = anchor(for: run.target, in: paragraphs).map { "#" + $0 } ?? run.url?.absoluteString
                return href.map { "<a href=\"\(xml($0))\">\(label)</a>" } ?? label
            }.joined()
            book += "<\(tag) id=\"p\(id)\" smilref=\"book.smil#s\(id)\">\(body)</\(tag)>"
            smil += "<par id=\"s\(id)\"><text id=\"t\(id)\" src=\"book.xml#p\(id)\"/></par>"
        }
        if headingNeedsBody { book += "<p/>" }
        while level > 0 {
            book += "</level\(level)>"
            level -= 1
        }
        navigation += String(repeating: "</navPoint>", count: navigationLevels.count)
        let author = markup?.metadata["author"].map { "<dc:Creator>\(xml($0))</dc:Creator>" } ?? ""
        let description = markup?.metadata["description"].map { "<dc:Description>\(xml($0))</dc:Description>" } ?? ""
        let dtbook = """
        <!DOCTYPE dtbook PUBLIC "-//NISO//DTD dtbook 2005-3//EN" "http://www.daisy.org/z3986/2005/dtbook-2005-3.dtd">
        <dtbook xmlns="http://www.daisy.org/z3986/2005/dtbook/" version="2005-3" xml:lang="\(language)">
          <head><meta name="dtb:uid" content="\(uid)"/><meta name="dc:Title" content="\(title)"/></head>
          <book><bodymatter>\(book)</bodymatter></book>
        </dtbook>
        """
        let ncx = """
        <!DOCTYPE ncx PUBLIC "-//NISO//DTD ncx 2005-1//EN" "http://www.daisy.org/z3986/2005/ncx-2005-1.dtd">
        <ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1" xml:lang="\(language)">
          <head><meta name="dtb:uid" content="\(uid)"/><meta name="dtb:depth" content="\(headingDepth)"/><meta name="dtb:totalPageCount" content="0"/><meta name="dtb:maxPageNumber" content="0"/></head>
          <docTitle><text>\(title)</text></docTitle><navMap>\(navigation)</navMap>
        </ncx>
        """
        let timing = """
        <!DOCTYPE smil PUBLIC "-//NISO//DTD dtbsmil 2005-1//EN" "http://www.daisy.org/z3986/2005/dtbsmil-2005-1.dtd">
        <smil xmlns="http://www.w3.org/2001/SMIL20/">
          <head><meta name="dtb:uid" content="\(uid)"/><meta name="dtb:totalElapsedTime" content="00:00:00"/></head>
          <body><seq id="sequence">\(smil)</seq></body>
        </smil>
        """
        let opf = """
        <!DOCTYPE package PUBLIC "+//ISBN 0-9673008-1-9//DTD OEB 1.2 Package//EN" "http://www.daisy.org/z3986/2005/oebpkg12.dtd">
        <package xmlns="http://openebook.org/namespaces/oeb-package/1.0/" unique-identifier="uid">
          <metadata><dc-metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:Title>\(title)</dc:Title><dc:Identifier id="uid">\(uid)</dc:Identifier><dc:Language>\(language)</dc:Language>\(author)\(description)</dc-metadata>
          <x-metadata><meta name="dtb:multimediaType" content="textNCX"/><meta name="dtb:multimediaContent" content="text"/><meta name="dtb:totalTime" content="00:00:00"/></x-metadata></metadata>
          <manifest><item id="package" href="book.opf" media-type="text/xml"/><item id="book" href="book.xml" media-type="application/x-dtbook+xml"/><item id="nav" href="book.ncx" media-type="application/x-dtbncx+xml"/><item id="timing" href="book.smil" media-type="application/smil"/></manifest>
          <spine><itemref idref="timing"/></spine>
        </package>
        """
        try package([("book.opf", opf), ("book.ncx", ncx), ("book.smil", timing), ("book.xml", dtbook)]
            .map { ($0.0, declaration + $0.1) }, output: output)
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
        var result = "{\\rtf1\\ansi\\uc1{\\fonttbl{\\f0 Arial;}}{\\info{\\title \(NativeRTFConversionWriter.escape(title))}}\\f0\\fs24 "
        for paragraph in paragraphs {
            try Task.checkCancellation()
            let text = paragraph.runs.map { run in
                let label = NativeRTFConversionWriter.escape(run.text)
                guard let url = run.url else { return label }
                return "{\\field{\\*\\fldinst HYPERLINK \"\(NativeRTFConversionWriter.escape(url.absoluteString))\"}{\\fldrslt \(label)}}"
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

    private static func docx(_ paragraphs: [Paragraph], title: String, markup: NativeConversionMarkup.Document?, output: URL) throws {
        let office = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
        let relationship = "http://schemas.openxmlformats.org/package/2006/relationships"
        var references = "<Relationship Id=\"styles\" Type=\"\(office)/styles\" Target=\"styles.xml\"/>"
        var number = 0
        let plainBody = try paragraphs.map { paragraph in
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
        let rich = try markup.map { try NativeDOCXConversionWriter().write($0) }
        let body = rich?.body ?? plainBody
        references += rich?.relationships ?? ""
        let imageParts = (rich?.assets ?? []).map {
            NativeConversionMarkup.Asset(path: "word/media/" + $0.path, mediaType: $0.mediaType, data: $0.data)
        }
        let imageTypes = imageParts.map {
            "<Override PartName=\"/\(xml($0.path))\" ContentType=\"\(xml($0.mediaType))\"/>"
        }.joined()
        let styleNS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
        let styles = (1...6).map {
            "<w:style w:type=\"paragraph\" w:styleId=\"Heading\($0)\"><w:name w:val=\"heading \($0)\"/><w:pPr><w:outlineLvl w:val=\"\($0 - 1)\"/></w:pPr><w:rPr><w:b/><w:sz w:val=\"\(38 - $0 * 2)\"/></w:rPr></w:style>"
        }.joined()
        let types = """
        <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>\(imageTypes)</Types>
        """
        try package([
            ("[Content_Types].xml", types),
            ("_rels/.rels", "<Relationships xmlns=\"\(relationship)\"><Relationship Id=\"doc\" Type=\"\(office)/officeDocument\" Target=\"word/document.xml\"/><Relationship Id=\"meta\" Type=\"\(relationship)/metadata/core-properties\" Target=\"docProps/core.xml\"/></Relationships>"),
            ("word/document.xml", "<w:document xmlns:w=\"\(styleNS)\" xmlns:r=\"\(office)\" xmlns:wp=\"http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing\" xmlns:a=\"http://schemas.openxmlformats.org/drawingml/2006/main\" xmlns:pic=\"http://schemas.openxmlformats.org/drawingml/2006/picture\"><w:body>\(body)</w:body></w:document>"),
            ("word/styles.xml", "<w:styles xmlns:w=\"\(styleNS)\">\(styles)</w:styles>"),
            ("word/_rels/document.xml.rels", "<Relationships xmlns=\"\(relationship)\">\(references)</Relationships>"),
            ("docProps/core.xml", "<cp:coreProperties xmlns:cp=\"http://schemas.openxmlformats.org/package/2006/metadata/core-properties\" xmlns:dc=\"http://purl.org/dc/elements/1.1/\"><dc:title>\(title)</dc:title></cp:coreProperties>")
        ], assets: imageParts, output: output)
    }

    private static func odt(_ paragraphs: [Paragraph], title: String, markup: NativeConversionMarkup.Document?, output: URL) throws {
        let mime = "application/vnd.oasis.opendocument.text"
        let office = "urn:oasis:names:tc:opendocument:xmlns:office:1.0"
        let plainBody = try paragraphs.map { paragraph in
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
        let body = try markup.map { try NativeODTConversionWriter(assets: $0.assets).write($0.body) } ?? plainBody
        let assetEntries = (markup?.assets ?? []).map {
            NativeConversionMarkup.Asset(path: "Pictures/" + $0.path, mediaType: $0.mediaType, data: $0.data)
        }
        let assetManifest = assetEntries.map {
            "<manifest:file-entry manifest:full-path=\"\(xml($0.path))\" manifest:media-type=\"\(xml($0.mediaType))\"/>"
        }.joined()
        let metadata = [("author", "creator"), ("description", "description"), ("keywords", "subject")].compactMap { key, tag in
            markup?.metadata[key].map { "<dc:\(tag)>\(xml($0))</dc:\(tag)>" }
        }.joined() + (markup?.language.map { "<dc:language>\(xml($0))</dc:language>" } ?? "")
        let automaticStyles = """
        <office:automatic-styles>
        <style:style style:name="Bold" style:family="text"><style:text-properties fo:font-weight="bold"/></style:style>
        <style:style style:name="Italic" style:family="text"><style:text-properties fo:font-style="italic"/></style:style>
        <text:list-style style:name="Bullets"><text:list-level-style-bullet text:level="1" text:bullet-char="•"/></text:list-style>
        <text:list-style style:name="Numbered"><text:list-level-style-number text:level="1" style:num-format="1"/></text:list-style>
        </office:automatic-styles>
        """
        try package([
            ("content.xml", "<office:document-content xmlns:office=\"\(office)\" xmlns:text=\"urn:oasis:names:tc:opendocument:xmlns:text:1.0\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" xmlns:style=\"urn:oasis:names:tc:opendocument:xmlns:style:1.0\" xmlns:fo=\"urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0\" xmlns:table=\"urn:oasis:names:tc:opendocument:xmlns:table:1.0\" xmlns:draw=\"urn:oasis:names:tc:opendocument:xmlns:drawing:1.0\" xmlns:svg=\"urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0\" office:version=\"1.2\">\(markup == nil ? "" : automaticStyles)<office:body><office:text>\(body)</office:text></office:body></office:document-content>"),
            ("meta.xml", "<office:document-meta xmlns:office=\"\(office)\" xmlns:dc=\"http://purl.org/dc/elements/1.1/\" office:version=\"1.2\"><office:meta><dc:title>\(markup.map { xml($0.title) } ?? title)</dc:title>\(metadata)</office:meta></office:document-meta>"),
            ("META-INF/manifest.xml", "<manifest:manifest xmlns:manifest=\"urn:oasis:names:tc:opendocument:xmlns:manifest:1.0\" manifest:version=\"1.2\"><manifest:file-entry manifest:full-path=\"/\" manifest:media-type=\"\(mime)\"/><manifest:file-entry manifest:full-path=\"content.xml\" manifest:media-type=\"text/xml\"/><manifest:file-entry manifest:full-path=\"meta.xml\" manifest:media-type=\"text/xml\"/>\(assetManifest)</manifest:manifest>")
        ], mime: mime, assets: assetEntries, output: output)
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

    private static func finishPDF(_ input: URL, output: URL, language: String?, labels: [String]) throws {
        let buffers = labels.map { strdup($0) }
        defer { buffers.forEach { free($0) } }
        guard buffers.allSatisfy({ $0 != nil }) else { throw Failure.invalidOutput }
        let pointers: [UnsafePointer<CChar>?] = buffers.map { $0.map { UnsafePointer($0) } }
        let result = pointers.withUnsafeBufferPointer { labels in
            tiflo_pdf_postprocess(input.path, output.path, language ?? "", labels.baseAddress, labels.count)
        }
        guard result == 0 else { throw Failure.invalidOutput }
        try Task.checkCancellation()
    }

    private static func pdf(_ paragraphs: [Paragraph], title: String, markup: NativeConversionMarkup.Document?, output: URL,
                            onProgress: (Double) -> Void) throws -> (language: String?, labels: [String]) {
        var annotationLabels: [String] = []
        let text = NSMutableAttributedString(string: "")
        let key = NSAttributedString.Key(kCTFontAttributeName as String)
        let normal = CTFontCreateWithName("Helvetica" as CFString, 11, nil)
        let heading = CTFontCreateWithName("Helvetica-Bold" as CFString, 15, nil)
        let headerTags: [CGPDFTagType] = [.paragraph, .header1, .header2, .header3, .header4, .header5, .header6]
        var paragraphStarts: [Int] = []
        var linkRanges: [(range: NSRange, url: URL?, anchor: String?, label: String)] = []
        var destinationNames: Set<String> = []
        let declaredLanguage = markup?.language?.trimmingCharacters(in: .whitespacesAndNewlines)
        let languageKey = CGPDFTagProperty.languageText.rawValue as String
        let recognizer = NLLanguageRecognizer()
        func detectedLanguage(_ text: String) -> String? {
            let sample = String(text.prefix(1_024))
            guard sample.unicodeScalars.filter({ CharacterSet.letters.contains($0) }).count >= 32 else { return nil }
            recognizer.reset()
            recognizer.processString(sample)
            guard let match = recognizer.languageHypotheses(withMaximum: 1).first, match.value >= 0.95 else { return nil }
            return match.key.rawValue
        }
        let language = declaredLanguage.flatMap { $0.isEmpty || $0 == "und" ? nil : $0 }
            ?? detectedLanguage(paragraphs.prefix(12).map { String($0.text.prefix(256)) }.joined(separator: " "))
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
                        linkRanges.append((NSRange(location: lineOffset, length: length), run.url, target, run.text))
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
        let translatedTitle = language.map { "<rdf:li xml:lang=\"\(xml($0))\">\(xml(title))</rdf:li>" } ?? ""
        let xmp = """
        <x:xmpmeta xmlns:x="adobe:ns:meta/">
          <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
            <rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/">
              <dc:title><rdf:Alt><rdf:li xml:lang="x-default">\(xml(title))</rdf:li>\(translatedTitle)</rdf:Alt></dc:title>
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
                if Task.isCancelled { break }
                let range = CTLineGetStringRange(line)
                while paragraphIndex + 1 < paragraphStarts.count,
                      paragraphStarts[paragraphIndex + 1] <= range.location { paragraphIndex += 1 }
                if openParagraph != paragraphIndex {
                    if openParagraph != nil { CGPDFContextEndTag(context) }
                    let paragraph = paragraphs[paragraphIndex]
                    let tagLanguage = detectedLanguage(paragraph.text) ?? language
                    let properties = tagLanguage.map { [languageKey: $0] } ?? [:]
                    CGPDFContextBeginTag(context, headerTags[paragraph.level], properties as CFDictionary)
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
                    let (link, url, anchor, label) = linkRanges[index]
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
                        annotationLabels.append(label)
                    }
                    index += 1
                }
            }
            if openParagraph != nil { CGPDFContextEndTag(context) }
            context.endPDFPage()
            try Task.checkCancellation()
            offset += visible.length
            onProgress(Double(offset) / Double(text.length))
        }
        return (language, annotationLabels)
    }
}
