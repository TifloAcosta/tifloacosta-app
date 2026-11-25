import Foundation

/// Reads the structural vocabulary of an ODT main document into the same
/// sanitized XHTML pipeline used for EPUB and HTML.
final class NativeODTConversionMarkup: NSObject, XMLParserDelegate {
    private static let office = "urn:oasis:names:tc:opendocument:xmlns:office:1.0"
    private var inText = false
    private var suppressDepth = 0
    private var stack: [String] = []
    private var textStyle: String?
    private var textStyleProperties: [String: [String: String]] = [:]
    private var metadataField: String?
    private var metadataValue = ""
    private var listStyle: String?
    private var orderedListStyles: [String: String] = [:]
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
    private struct Note {
        let id: String
        let role: String
        var outerBody: String?
    }
    private var note: Note?
    private var notes: [String] = []
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
        return Data("<html\(language)><head><title>\(documentTitle)</title>\(meta)</head><body>\(delegate.body)\(delegate.notes.joined())</body></html>".utf8)
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
            } else if name == "style:style", attributes["style:family"] == "text" {
                textStyle = attributes["style:name"]
            } else if name == "style:text-properties", let textStyle {
                textStyleProperties[textStyle] = attributes
            } else if name == "text:list-style" {
                listStyle = attributes["style:name"]
            } else if name == "text:list-level-style-number", attributes["text:level"] == "1", let listStyle {
                orderedListStyles[listStyle] = attributes["style:num-format"] ?? "1"
            }
            return
        }
        if suppressDepth > 0 || ["text:tracked-changes", "office:annotation", "table:covered-table-cell"].contains(name) {
            suppressDepth += 1
            return
        }

        if name == "text:note" {
            guard note == nil else { suppressDepth = 1; return }
            let id = attributes["text:id"] ?? "odt-generated-note-\(notes.count + 1)"
            let role = attributes["text:note-class"] == "endnote" ? "doc-endnote" : "doc-footnote"
            note = Note(id: id, role: role)
            return
        }
        if name == "text:note-body", note != nil {
            note?.outerBody = body
            body = ""
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
        var inlineEmphasis: [String] = []
        switch name {
        case "text:p": tag = "p"
        case "text:h":
            if let raw = attributes["text:outline-level"], let level = Int(raw), (1...6).contains(level) {
                tag = "h\(level)"
            } else { tag = "p" }
        case "text:list":
            if let style = attributes["text:style-name"], let format = orderedListStyles[style] {
                tag = "ol"
                if ["I", "i", "A", "a"].contains(format) { htmlAttributes = " type=\"\(format)\"" }
            } else { tag = "ul" }
        case "text:list-item":
            tag = "li"
            if let start = attributes["text:start-value"].flatMap(Int.init), start > 0 {
                htmlAttributes += " value=\"\(start)\""
            }
        case "table:table": tag = "table"
        case "table:table-header-rows": tag = "thead"
        case "table:table-row": tag = "tr"
        case "table:table-cell":
            tag = stack.contains("</thead>") ? "th" : "td"
            for (source, target) in [("table:number-columns-spanned", "colspan"),
                                     ("table:number-rows-spanned", "rowspan")] {
                if let count = attributes[source].flatMap(Int.init), (2...10_000).contains(count) {
                    htmlAttributes += " \(target)=\"\(count)\""
                }
            }
        case "text:note-citation", "text:note-ref":
            if let id = name == "text:note-citation" ? note?.id : attributes["text:ref-name"] {
                tag = "a"
                htmlAttributes = " href=\"#\(escape(id))\" role=\"doc-noteref\""
            }
        case "text:a":
            tag = "a"
            if let href = attributes["xlink:href"] { htmlAttributes += " href=\"\(escape(href))\"" }
        case "text:span":
            tag = "span"
            if let name = attributes["text:style-name"], let style = textStyleProperties[name] {
                if style["fo:font-weight"] == "bold" { inlineEmphasis.append("strong") }
                if style["fo:font-style"] == "italic" { inlineEmphasis.append("em") }
                if let underline = style["style:text-underline-style"], underline != "none" {
                    inlineEmphasis.append("u")
                }
                if let position = style["style:text-position"]?.split(separator: " ").first {
                    if position == "sub" { inlineEmphasis.append("sub") }
                    if position == "super" { inlineEmphasis.append("sup") }
                }
                if let language = style["fo:language"], !language.isEmpty, language != "none" {
                    let country = style["fo:country"].flatMap { $0 == "none" || $0.isEmpty ? nil : "-" + $0 } ?? ""
                    htmlAttributes += " lang=\"\(escape(language + country))\""
                }
            }
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
            let emphasis = inlineEmphasis.map { "<\($0)>" }.joined()
            body += "<\(tag)\(htmlAttributes)>\(emphasis)"
            let close = inlineEmphasis.reversed().map { "</\($0)>" }.joined()
            stack.append(close + "</\(tag)>")
        } else { stack.append("") }
    }

    func parser(_ parser: XMLParser, didEndElement element: String,
                namespaceURI: String?, qualifiedName: String?) {
        if !inText {
            if qualifiedName == "text:list-style" { listStyle = nil }
            if qualifiedName == "style:style" { textStyle = nil }
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
        if qualifiedName == "text:note-body", let note, let outside = note.outerBody {
            let escape = NativeDocumentConversion.xml
            notes.append("<aside id=\"\(escape(note.id))\" role=\"\(note.role)\">\(body)</aside>")
            body = outside
            self.note?.outerBody = nil
            return
        }
        if qualifiedName == "text:note" { note = nil; return }
        if element == "text", namespaceURI == Self.office { inText = false; return }
        body += stack.popLast() ?? ""
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
