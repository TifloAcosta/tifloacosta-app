import Foundation

/// Converts sanitized XHTML into a reading-order sequence while retaining
/// the unique, ordered ancestors needed to rebuild the PDF structure tree.
final class NativePDFMarkup: NSObject, XMLParserDelegate {
    struct Part {
        let offset: Int
        let heading: Int
        let text: [(String, String?)]
        let path: String
        let language: String?
        var image: Data?
        var alternative: String?
    }

    private struct Frame {
        let element: String
        let roles: [String]
        let language: String?
    }

    private var stack: [Frame] = []
    private var parts: [Part] = []
    private var runs: [(String, String?)] = []
    private var link: String?
    private var identifier = 0
    private var offset = 0
    private var anchors: [String: Int] = [:]
    private var semantic = false
    private var images: [String: Data] = [:]
    private let blocks: Set<String> = ["body", "p", "div", "section", "article", "main", "blockquote", "pre",
                                       "ul", "ol", "li", "table", "thead", "tbody", "tfoot", "tr", "th", "td",
                                       "figure", "figcaption", "caption", "aside", "footer",
                                       "h1", "h2", "h3", "h4", "h5", "h6"]

    static func read(_ document: NativeConversionMarkup.Document) throws -> (parts: [Part], anchors: [String: Int])? {
        let reader = NativePDFMarkup()
        reader.images = Dictionary(uniqueKeysWithValues: document.assets.map { ($0.path, $0.data) })
        let parser = XMLParser(data: Data("<body xmlns:epub=\"http://www.idpf.org/2007/ops\">\(document.body)</body>".utf8))
        parser.shouldResolveExternalEntities = false
        parser.delegate = reader
        let valid = parser.parse()
        try Task.checkCancellation()
        guard valid, reader.semantic, !reader.parts.isEmpty else { return nil }
        return (reader.parts, reader.anchors)
    }

    private func flush() {
        guard !runs.isEmpty else { return }
        defer { runs.removeAll(keepingCapacity: true) }
        let length = runs.reduce(0) { $0 + $1.0.count }
        guard runs.contains(where: { $0.0.contains(where: { !$0.isWhitespace }) }) else { return }
        let headings = ["h1": 1, "h2": 2, "h3": 3, "h4": 4, "h5": 5, "h6": 6]
        let heading = stack.reversed().compactMap { headings[$0.element] }.first ?? 0
        parts.append(Part(offset: offset, heading: heading, text: runs,
                          path: stack.flatMap(\.roles).joined(separator: "/"),
                          language: stack.reversed().compactMap(\.language).first))
        offset += length + 1
    }

    func parser(_ parser: XMLParser, didStartElement name: String, namespaceURI: String?,
                qualifiedName: String?, attributes: [String: String]) {
        if Task.isCancelled { parser.abortParsing(); return }
        if blocks.contains(name) { flush() }
        if let id = attributes["id"], anchors[id] == nil { anchors[id] = offset }
        let layoutRoles: [String: [String]] = [
            "ul": ["L"], "ol": ["L"], "li": ["LI", "LBody"], "table": ["Table"],
            "thead": ["THead"], "tbody": ["TBody"], "tfoot": ["TFoot"],
            "tr": ["TR"], "th": ["TH"], "td": ["TD"], "figure": ["Div"],
            "figcaption": ["Caption"], "caption": ["Caption"]
        ]
        let isNote = ["doc-footnote", "doc-endnote"].contains(attributes["role"] ?? "")
        let roles = isNote ? ["Note"] : layoutRoles[name] ?? []
        let unique = roles.map { role in
            identifier += 1
            let key = role + ":" + String(identifier)
            guard role == "TH" || role == "TD" else { return key }
            let rowSpan = min(65534, max(1, Int(attributes["rowspan"] ?? "") ?? 1))
            let colSpan = min(1000, max(1, Int(attributes["colspan"] ?? "") ?? 1))
            let scopes = ["row": 1, "col": 2]
            let scope = role == "TH" ? scopes[attributes["scope"] ?? ""] ?? 0 : 0
            return "\(key):\(rowSpan):\(colSpan):\(scope)"
        }
        if !roles.isEmpty { semantic = true }
        stack.append(Frame(element: name, roles: unique, language: attributes["xml:lang"] ?? attributes["lang"]))
        if name == "a" { link = attributes["href"] }
        if name == "br" { flush() }
        if name == "img" {
            let alternative = attributes["alt"]
            if let source = attributes["src"], let image = images[source] {
                flush()
                semantic = true
                parts.append(Part(offset: offset, heading: 0, text: [("\u{FFFC}", link)],
                    path: stack.flatMap(\.roles).joined(separator: "/"),
                    language: stack.reversed().compactMap(\.language).first,
                    image: image, alternative: alternative))
                offset += 2
            } else if let alternative, !alternative.isEmpty {
                append(alternative)
            }
        }
    }

    func parser(_ parser: XMLParser, didEndElement name: String, namespaceURI: String?, qualifiedName: String?) {
        if blocks.contains(name) { flush() }
        if name == "a" { link = nil }
        _ = stack.popLast()
    }

    private func append(_ text: String) {
        if runs.last?.1 == link, !runs.isEmpty {
            runs[runs.count - 1].0 += text
        } else { runs.append((text, link)) }
    }

    func parser(_ parser: XMLParser, foundCharacters string: String) { append(string) }
}
