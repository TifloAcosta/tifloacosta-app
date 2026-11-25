import Foundation
import ZIPFoundation

/// Reuses the saved original when it offers verifiable XHTML structure.
enum NativeConversionMarkup {
    struct Asset {
        let path: String
        let mediaType: String
        let data: Data
    }

    struct Document {
        var body: String
        var title: String
        var language: String?
        var metadata: [String: String]
        var assets: [Asset]
        var headings: [(id: String, label: String)]

        func xhtml() -> String {
            let escape = NativeDocumentConversion.xml
            let lang = language.map { " xml:lang=\"\(escape($0))\" lang=\"\(escape($0))\"" } ?? ""
            let meta = metadata.sorted { $0.key < $1.key }.map {
                "<meta name=\"\(escape($0.key))\" content=\"\(escape($0.value))\"/>"
            }.joined()
            return "<html xmlns=\"http://www.w3.org/1999/xhtml\" xmlns:epub=\"http://www.idpf.org/2007/ops\"\(lang)><head><meta charset=\"utf-8\"/><title>\(escape(title))</title>\(meta)</head><body>\(body)</body></html>"
        }
    }

    private static let maximumTextBytes = 16 * 1024 * 1024
    private static let maximumImageBytes = 4 * 1024 * 1024
    private static let imageTypes = ["png": "image/png", "jpg": "image/jpeg",
                                     "jpeg": "image/jpeg", "gif": "image/gif"]

    static func read(_ input: NativeConversionSource, for format: NativeDocumentFormat) throws -> Document? {
        guard [.html, .epub, .odt, .rtf, .docx, .daisy, .daisy3, .pdf].contains(format), let source = input.original else { return nil }
        if input.format == "rtf" {
            guard let size = try? source.resourceValues(forKeys: [.fileSizeKey]).fileSize,
                  size <= maximumTextBytes,
                  let data = try? Data(contentsOf: source, options: .mappedIfSafe),
                  let xhtml = try NativeRTFConversionMarkup.xhtml(data, title: input.title) else { return nil }
            return try parse([(path: "book.xhtml", data: xhtml)], fallbackTitle: input.title,
                             packageImages: [.epub, .odt, .rtf, .docx, .pdf].contains(format)) { _, _ in nil }
        }
        if ["html", "htm", "xhtml"].contains(input.format) {
            guard let size = try? source.resourceValues(forKeys: [.fileSizeKey]).fileSize,
                  size <= maximumTextBytes,
                  let data = try? Data(contentsOf: source, options: .mappedIfSafe) else { return nil }
            return try parse([(path: "book.xhtml", data: data)], fallbackTitle: input.title,
                             packageImages: [.epub, .odt, .rtf, .docx, .pdf].contains(format)) { _, _ in nil }
        }
        guard ["epub", "odt", "docx"].contains(input.format),
              let archive = Archive(url: source, accessMode: .read) else { return nil }
        if input.format == "docx" {
            let relationships: Data?
            if let entry = archive["word/_rels/document.xml.rels"], entry.type == .file {
                relationships = try entryData(entry, in: archive, limit: maximumTextBytes / 4)
            } else { relationships = nil }
            let footnotes: Data?
            if let entry = archive["word/footnotes.xml"], entry.type == .file {
                footnotes = try entryData(entry, in: archive, limit: maximumTextBytes / 4)
            } else { footnotes = nil }
            guard let entry = archive["word/document.xml"], entry.type == .file,
                  let content = try entryData(entry, in: archive, limit: maximumTextBytes),
                  let xhtml = NativeDOCXConversionMarkup.xhtml(content: content, relationships: relationships,
                    title: input.title, footnotes: footnotes) else { return nil }
            return try parse([(path: "word/book.xhtml", data: xhtml)], fallbackTitle: input.title,
                             packageImages: [.epub, .odt, .rtf, .docx, .pdf].contains(format)) { href, chapter in
                guard let path = member(href, relativeTo: chapter), path.hasPrefix("word/media/"),
                      let type = imageTypes[URL(fileURLWithPath: path).pathExtension.lowercased()],
                      let entry = archive[path], entry.type == .file,
                      let data = try entryData(entry, in: archive, limit: maximumImageBytes) else { return nil }
                return (type, data)
            }
        }
        if input.format == "odt" {
            func xmlMember(_ name: String) throws -> Data? {
                guard let entry = archive[name], entry.type == .file else { return nil }
                return try entryData(entry, in: archive, limit: maximumTextBytes / 3)
            }
            guard let content = try xmlMember("content.xml"),
                  let xhtml = try NativeODTConversionMarkup.xhtml(content: content,
                    styles: xmlMember("styles.xml"), metadata: xmlMember("meta.xml"), title: input.title)
            else { return nil }
            return try parse([(path: "book.xhtml", data: xhtml)], fallbackTitle: input.title,
                             packageImages: [.epub, .odt, .rtf, .docx, .pdf].contains(format)) { href, chapter in
                guard let path = member(href, relativeTo: chapter), path.hasPrefix("Pictures/"),
                      let type = imageTypes[URL(fileURLWithPath: path).pathExtension.lowercased()],
                      let entry = archive[path], entry.type == .file,
                      let data = try entryData(entry, in: archive, limit: maximumImageBytes) else { return nil }
                return (type, data)
            }
        }
        let temporary = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: temporary) }
        var total = 0
        var entries: [String: Entry] = [:]
        var files: Set<String> = []
        for (index, entry) in archive.enumerated() {
            try Task.checkCancellation()
            if index >= 8000 { return nil }
            guard entry.type == .file, let path = member(entry.path, relativeTo: ""),
                  path == entry.path, entries[path] == nil else { continue }
            entries[path] = entry
            guard path == "META-INF/container.xml" || path.lowercased().hasSuffix(".opf") ||
                  ["html", "htm", "xhtml"].contains(URL(fileURLWithPath: path).pathExtension.lowercased()) else { continue }
            guard entry.uncompressedSize <= UInt64(maximumTextBytes - total),
                  let data = try entryData(entry, in: archive, limit: maximumTextBytes - total) else { return nil }
            total += data.count
            let file = temporary.appendingPathComponent(path)
            try FileManager.default.createDirectory(at: file.deletingLastPathComponent(),
                withIntermediateDirectories: true)
            try data.write(to: file)
            files.insert(path)
        }
        guard let order = try? NativeEpubSpine.readingOrder(in: temporary, availableFiles: files),
              Set(order).count == order.count else { return nil }
        let chapters = try order.map { ($0, try Data(contentsOf: temporary.appendingPathComponent($0))) }
        return try parse(chapters, fallbackTitle: input.title, packageImages: [.epub, .odt, .rtf, .docx, .pdf].contains(format)) { href, chapter in
            guard let path = member(href, relativeTo: chapter),
                  let type = imageTypes[URL(fileURLWithPath: path).pathExtension.lowercased()],
                  let entry = entries[path], let data = try entryData(entry, in: archive, limit: maximumImageBytes)
            else { return nil }
            return (type, data)
        }
    }

    private static func entryData(_ entry: Entry, in archive: Archive, limit: Int) throws -> Data? {
        guard entry.uncompressedSize <= UInt64(limit) else { return nil }
        var result = Data()
        let crc = try archive.extract(entry) { chunk in
            try Task.checkCancellation()
            guard chunk.count <= limit - result.count else { throw NativeDocumentConversion.Failure.invalidOutput }
            result.append(chunk)
        }
        return UInt64(result.count) == entry.uncompressedSize && crc == entry.checksum ? result : nil
    }

    private static func member(_ href: String, relativeTo chapter: String) -> String? {
        guard let path = href.removingPercentEncoding, !path.hasPrefix("/"),
              !path.contains(":"), !path.contains("\\"), !path.contains("\u{0}") else { return nil }
        var parts = chapter.split(separator: "/").dropLast().map(String.init)
        for part in path.split(separator: "/") {
            if part == ".." {
                guard !parts.isEmpty else { return nil }
                parts.removeLast()
            } else if part != "." {
                parts.append(String(part))
            }
        }
        return parts.isEmpty ? nil : parts.joined(separator: "/")
    }

    private static func parse(_ chapters: [(path: String, data: Data)], fallbackTitle: String,
                              packageImages: Bool,
                              image: @escaping (String, String) throws -> (String, Data)?) throws -> Document? {
        var result = Document(body: "", title: fallbackTitle, language: nil, metadata: [:], assets: [], headings: [])
        let prefixes = Dictionary(uniqueKeysWithValues: chapters.enumerated().map { ($0.element.path, "c\($0.offset)") })
        var imageBytes = 0
        for (path, data) in chapters {
            try Task.checkCancellation()
            guard let declaration = String(data: data, encoding: .utf8),
                  !declaration.localizedCaseInsensitiveContains("<!ENTITY"),
                  let prefix = prefixes[path] else { return nil }
            let parser = XMLParser(data: data)
            var assetIndex = result.assets.count
            var assets: [Asset] = []
            let delegate = Parser(id: prefix, anchor: { href in
                let pair = href.split(separator: "#", maxSplits: 1, omittingEmptySubsequences: false)
                guard let first = pair.first else { return nil }
                let page = String(first)
                if let url = URL(string: href),
                   ["https", "http", "mailto"].contains(url.scheme?.lowercased() ?? "") { return url.absoluteString }
                let target = page.isEmpty ? path : member(page, relativeTo: path)
                guard let target, let targetPrefix = prefixes[target] else { return nil }
                let fragment = pair.count == 2 ? (pair[1].removingPercentEncoding ?? String(pair[1])) : ""
                return "#" + targetPrefix + (fragment.isEmpty ? "" : "-" + fragment)
            }, image: { href in
                var payload: (String, Data)?
                if href.hasPrefix("data:"), let comma = href.firstIndex(of: ",") {
                    let header = href[href.index(href.startIndex, offsetBy: 5)..<comma]
                    let type = String(header.dropLast(";base64".count))
                    if header.hasSuffix(";base64"), imageTypes.values.contains(type),
                       href.distance(from: comma, to: href.endIndex) <= (maximumImageBytes * 4 / 3 + 8),
                       let data = Data(base64Encoded: String(href[href.index(after: comma)...])) {
                        payload = (type, data)
                    }
                } else {
                    payload = try? image(href, path)
                }
                guard let (type, data) = payload, imageTypes.values.contains(type), !data.isEmpty,
                      data.count <= maximumImageBytes,
                      data.count <= maximumTextBytes - imageBytes else { return nil }
                imageBytes += data.count
                if packageImages {
                    assetIndex += 1
                    let ext = type == "image/jpeg" ? "jpg" : String(type.dropFirst("image/".count))
                    let name = "assets/image-\(assetIndex).\(ext)"
                    assets.append(Asset(path: name, mediaType: type, data: data))
                    return name
                }
                return "data:\(type);base64,\(data.base64EncodedString())"
            })
            parser.delegate = delegate
            parser.shouldResolveExternalEntities = false
            guard parser.parse(), delegate.foundBody else { return nil }
            if chapters.count == 1 && !delegate.title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                result.title = delegate.title
            }
            result.language = result.language ?? delegate.language
            result.metadata.merge(delegate.metadata) { original, _ in original }
            result.body += "<div id=\"\(prefix)\">\(delegate.html)</div>"
            result.assets += assets
            result.headings += delegate.headings
        }
        return result
    }

    private final class Parser: NSObject, XMLParserDelegate {
        private let id: String
        private let anchor: (String) -> String?
        private let image: (String) -> String?
        private let allowed: Set<String> = [
            "p", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "dl", "dt", "dd", "div",
            "span", "br", "hr", "a", "strong", "em", "b", "i", "u", "small", "sub", "sup",
            "blockquote", "pre", "code", "main", "article", "section", "figure", "figcaption", "aside", "footer",
            "table", "caption", "thead", "tbody", "tfoot", "tr", "th", "td"
        ]
        private var stack: [String?] = []
        private var inBody = false
        private var suppressed = 0
        private var inTitle = false
        private var headingID: String?
        private var headingText = ""
        var foundBody = false
        var html = ""
        var title = ""
        var language: String?
        var metadata: [String: String] = [:]
        var headings: [(id: String, label: String)] = []

        init(id: String, anchor: @escaping (String) -> String?, image: @escaping (String) -> String?) {
            self.id = id
            self.anchor = anchor
            self.image = image
        }

        func parser(_ parser: XMLParser, didStartElement elementName: String,
                    namespaceURI: String?, qualifiedName qName: String?, attributes: [String: String]) {
            if Task.isCancelled { parser.abortParsing(); return }
            let tag = elementName.lowercased()
            if suppressed > 0 || ["script", "style", "iframe", "object", "svg", "noscript", "template"].contains(tag) {
                suppressed += 1
                return
            }
            if !inBody {
                switch tag {
                case "html": language = attributes["lang"] ?? attributes["xml:lang"]
                case "title": inTitle = true
                case "meta":
                    if let name = attributes["name"]?.lowercased(),
                       ["author", "description", "keywords"].contains(name), let content = attributes["content"] {
                        metadata[name] = content
                    }
                case "body": foundBody = true; inBody = true
                default: break
                }
                return
            }
            let escape = NativeDocumentConversion.xml
            if tag == "img" {
                stack.append(nil)
                let alt = attributes["alt"] ?? ""
                if let href = attributes["src"], let source = image(href) {
                    html += "<img src=\"\(escape(source))\" alt=\"\(escape(alt))\"/>"
                } else { html += escape(alt) }
                return
            }
            guard allowed.contains(tag) else { stack.append(nil); return }
            if tag == "br" || tag == "hr" { html += "<\(tag)/>"; stack.append(nil); return }
            stack.append(tag)
            var renderedAttributes = ""
            let existingID = attributes["id"].map { id + "-" + $0 }
            let isHeading = tag.count == 2 && tag.first == "h" && ("1"..."6").contains(String(tag.suffix(1)))
            if isHeading {
                headingID = existingID ?? "\(id)-heading-\(headings.count)"
                headingText = ""
            }
            if let identifier = isHeading ? headingID : existingID {
                renderedAttributes += " id=\"\(escape(identifier))\""
            }
            if tag == "a", let href = attributes["href"], let destination = anchor(href) {
                renderedAttributes += " href=\"\(escape(destination))\""
            }
            for name in ["scope", "rowspan", "colspan", "start", "value", "lang", "xml:lang", "dir", "epub:type"] {
                if let value = attributes[name] { renderedAttributes += " \(name)=\"\(escape(value))\"" }
            }
            if tag == "ol", let type = attributes["type"], ["1", "a", "A", "i", "I"].contains(type) {
                renderedAttributes += " type=\"\(type)\""
            }
            if let role = attributes["role"], ["doc-noteref", "doc-footnote", "doc-endnote",
                                                "doc-endnotes", "doc-backlink"].contains(role) {
                renderedAttributes += " role=\"\(role)\""
            }
            if let names = attributes["headers"] {
                renderedAttributes += " headers=\"\(escape(names.split(separator: " ").map { id + "-" + $0 }.joined(separator: " ")))\""
            }
            html += "<\(tag)\(renderedAttributes)>"
        }

        func parser(_ parser: XMLParser, didEndElement elementName: String,
                    namespaceURI: String?, qualifiedName qName: String?) {
            if suppressed > 0 { suppressed -= 1; return }
            if elementName.lowercased() == "title" { inTitle = false }
            if elementName.lowercased() == "body" { inBody = false; return }
            guard inBody, !stack.isEmpty, let tag = stack.removeLast() else { return }
            html += "</\(tag)>"
            if tag.count == 2, tag.first == "h", let headingID {
                let label = headingText.trimmingCharacters(in: .whitespacesAndNewlines)
                if !label.isEmpty { headings.append((headingID, label)) }
                self.headingID = nil
            }
        }

        func parser(_ parser: XMLParser, foundCharacters string: String) {
            if suppressed > 0 { return }
            if inTitle { title += string }
            if inBody {
                html += NativeDocumentConversion.xml(string)
                if headingID != nil { headingText += string }
            }
        }
    }
}
