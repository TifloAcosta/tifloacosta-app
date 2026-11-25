import Foundation

/// Reads the structural vocabulary of an ODT main document into the same
/// sanitized XHTML pipeline used for EPUB and HTML.
final class NativeODTConversionMarkup: NSObject, XMLParserDelegate {
    private static let office = "urn:oasis:names:tc:opendocument:xmlns:office:1.0"
    private var inText = false
    private var suppressDepth = 0
    private var stack: [String?] = []
    private var metadataField: String?
    private var metadataValue = ""
    private var listStyle: String?
    private var orderedListStyles: Set<String> = []
    private struct ImageFrame {
        var depth = 0
        var source: String?
        var title = ""
        var description = ""
        var textField: String?
        var text = ""
    }
    private var frame: ImageFrame?
    private var expandedSpaces = 0
    private var foundText = false
    private var body = ""
    private var metadata: [String: String] = [:]

    static func xhtml(content: Data, styles: Data?, metadata: Data?, title: String) -> Data? {
        let delegate = NativeODTConversionMarkup()
        for data in [styles, metadata, content].compactMap({ $0 }) {
            guard let xml = String(data: data, encoding: .utf8),
                  !xml.localizedCaseInsensitiveContains("<!DOCTYPE"),
                  !xml.localizedCaseInsensitiveContains("<!ENTITY") else { return nil }
            let parser = XMLParser(data: data)
            parser.shouldProcessNamespaces = true
            parser.shouldResolveExternalEntities = false
            parser.delegate = delegate
            guard parser.parse() else { return nil }
        }
        guard delegate.foundText else { return nil }
        let escape = NativeDocumentConversion.xml
        let documentTitle = escape(delegate.metadata["title"] ?? title)
        let language = delegate.metadata["language"].map { " lang=\"\(escape($0))\"" } ?? ""
        let meta = ["author", "description"].compactMap { name in
            delegate.metadata[name].map { "<meta name=\"\(name)\" content=\"\(escape($0))\"/>" }
        }.joined()
        return Data("<html\(language)><head><title>\(documentTitle)</title>\(meta)</head><body>\(delegate.body)</body></html>".utf8)
    }

    func parser(_ parser: XMLParser, didStartElement element: String,
                namespaceURI: String?, qualifiedName: String?, attributes: [String: String]) {
        if Task.isCancelled { parser.abortParsing(); return }
        let escape = NativeDocumentConversion.xml
        let name = qualifiedName ?? element
        if !inText {
            if element == "text", namespaceURI == Self.office {
                inText = true
                foundText = true
            } else if namespaceURI == "http://purl.org/dc/elements/1.1/",
                      ["title", "language", "creator", "description"].contains(element) {
                metadataField = element == "creator" ? "author" : element
                metadataValue = ""
            } else if name == "text:list-style" {
                listStyle = attributes["style:name"]
            } else if name == "text:list-level-style-number", attributes["text:level"] == "1", let listStyle {
                orderedListStyles.insert(listStyle)
            }
            return
        }
        if suppressDepth > 0 || ["text:tracked-changes", "office:annotation", "table:covered-table-cell"].contains(name) {
            suppressDepth += 1
            return
        }

        if name == "draw:frame", frame == nil { frame = ImageFrame() }
        if frame != nil {
            frame?.depth += 1
            switch name {
            case "draw:image": if frame?.source == nil { frame?.source = attributes["xlink:href"] }
            case "svg:title", "svg:desc": frame?.textField = name
            default: break
            }
            return
        }

        var tag: String?
        var htmlAttributes = ""
        switch name {
        case "text:p": tag = "p"
        case "text:h":
            if let raw = attributes["text:outline-level"], let level = Int(raw), (1...6).contains(level) {
                tag = "h\(level)"
            } else { tag = "p" }
        case "text:list":
            tag = attributes["text:style-name"].map { orderedListStyles.contains($0) } == true ? "ol" : "ul"
        case "text:list-item":
            tag = "li"
            if let start = attributes["text:start-value"].flatMap(Int.init), start > 0 {
                htmlAttributes += " value=\"\(start)\""
            }
        case "table:table": tag = "table"
        case "table:table-header-rows": tag = "thead"
        case "table:table-row": tag = "tr"
        case "table:table-cell":
            tag = stack.contains("thead") ? "th" : "td"
            for (source, target) in [("table:number-columns-spanned", "colspan"),
                                     ("table:number-rows-spanned", "rowspan")] {
                if let count = attributes[source].flatMap(Int.init), (2...10_000).contains(count) {
                    htmlAttributes += " \(target)=\"\(count)\""
                }
            }
        case "text:a":
            tag = "a"
            if let href = attributes["xlink:href"] { htmlAttributes += " href=\"\(escape(href))\"" }
        case "text:span": tag = "span"
        case "text:bookmark", "text:bookmark-start":
            if let bookmark = attributes["text:name"] { body += "<span id=\"\(escape(bookmark))\"></span>" }
        case "text:line-break": body += "<br/>"
        case "text:tab": body += "&#9;"
        case "text:s":
            let count = max(1, min(1_000, attributes["text:c"].flatMap(Int.init) ?? 1))
            expandedSpaces += count
            guard expandedSpaces <= 1_000_000 else { parser.abortParsing(); return }
            body += " " + String(repeating: "&#160;", count: count - 1)
        default: break
        }

        if let tag {
            if let id = attributes["xml:id"] { htmlAttributes += " id=\"\(escape(id))\"" }
            body += "<\(tag)\(htmlAttributes)>"
        }
        stack.append(tag)
    }

    func parser(_ parser: XMLParser, didEndElement element: String,
                namespaceURI: String?, qualifiedName: String?) {
        if !inText {
            if qualifiedName == "text:list-style" { listStyle = nil }
            if let name = metadataField, namespaceURI == "http://purl.org/dc/elements/1.1/" {
                let value = metadataValue.trimmingCharacters(in: .whitespacesAndNewlines)
                if !value.isEmpty { metadata[name] = value }
                metadataField = nil
            }
            return
        }
        if suppressDepth > 0 { suppressDepth -= 1; return }
        if let frame {
            self.frame?.depth -= 1
            if frame.depth == 1 {
                let escape = NativeDocumentConversion.xml
                let alt = frame.description.isEmpty ? frame.title : frame.description
                if let source = frame.source {
                    body += "<img src=\"\(escape(source))\" alt=\"\(escape(alt))\"/>"
                } else {
                    body += escape(alt.isEmpty ? frame.text : alt)
                }
                self.frame = nil
            } else if ["svg:title", "svg:desc"].contains(qualifiedName ?? "") {
                self.frame?.textField = nil
            }
            return
        }
        if element == "text", namespaceURI == Self.office { inText = false; return }
        if let tag = stack.popLast() ?? nil { body += "</\(tag)>" }
    }

    func parser(_ parser: XMLParser, foundCharacters string: String) {
        if metadataField != nil { metadataValue += string }
        guard inText, suppressDepth == 0 else { return }
        if let frame {
            switch frame.textField {
            case "svg:title": self.frame?.title += string
            case "svg:desc": self.frame?.description += string
            default: self.frame?.text += string
            }
        } else {
            body += NativeDocumentConversion.xml(string)
        }
    }
}
