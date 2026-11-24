import Foundation

/// Maps the main WordprocessingML story into the shared XHTML representation.
final class NativeDOCXConversionMarkup: NSObject, XMLParserDelegate {
    private static let word = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
    private var body = ""
    private var paragraph: String?
    private var heading: Int?
    private var run = ""
    private var bold = false
    private var italic = false
    private var language: String?
    private var textDepth = 0
    private var ignoredDepth = 0
    private var inBody = false
    private var rows: [Bool] = []
    private var cells: [String] = []
    private let escape = NativeDocumentConversion.xml

    static func xhtml(content: Data, title: String) -> Data? {
        guard let source = String(data: content, encoding: .utf8),
              !source.localizedCaseInsensitiveContains("<!DOCTYPE") else { return nil }
        let delegate = NativeDOCXConversionMarkup()
        let parser = XMLParser(data: content)
        parser.shouldProcessNamespaces = true
        parser.shouldResolveExternalEntities = false
        parser.delegate = delegate
        guard parser.parse(), !delegate.body.isEmpty else { return nil }
        return Data("<html><head><title>\(delegate.escape(title))</title></head><body>\(delegate.body)</body></html>".utf8)
    }

    func parser(_ parser: XMLParser, didStartElement name: String,
                namespaceURI: String?, qualifiedName: String?, attributes: [String: String]) {
        if Task.isCancelled { parser.abortParsing(); return }
        if ignoredDepth > 0 || (namespaceURI == Self.word && ["del", "moveFrom", "txbxContent"].contains(name)) {
            ignoredDepth += 1
            return
        }
        guard namespaceURI == Self.word else { return }
        if name == "body" { inBody = true }
        guard inBody else { return }
        switch name {
        case "p": paragraph = ""; heading = nil
        case "pStyle":
            if let value = attributes["w:val"], value.lowercased().hasPrefix("heading"),
               let depth = Int(value.dropFirst("heading".count)), (1...6).contains(depth) { heading = depth }
        case "outlineLvl":
            if let raw = attributes["w:val"], let value = Int(raw), (0...5).contains(value) { heading = value + 1 }
        case "r": run = ""; bold = false; italic = false; language = nil
        case "b": bold = !["0", "false", "off"].contains(attributes["w:val"] ?? "")
        case "i": italic = !["0", "false", "off"].contains(attributes["w:val"] ?? "")
        case "lang": language = attributes["w:val"]
        case "t": textDepth += 1
        case "tab": run += "&#9;"
        case "br": run += "<br/>"
        case "tbl": body += "<table>"
        case "tr": rows.append(false); body += "<tr>"
        case "tblHeader":
            if !rows.isEmpty { rows[rows.count - 1] = !["0", "false", "off"].contains(attributes["w:val"] ?? "") }
        case "tc":
            let cellTag = rows.last == true ? "th" : "td"
            cells.append(cellTag)
            body += "<\(cellTag)>"
        case "bookmarkStart":
            if let id = attributes["w:name"] { paragraph? += "<span id=\"\(escape(id))\"></span>" }
        case "hyperlink":
            if let target = attributes["w:anchor"] {
                paragraph? += "<a href=\"#\(escape(target))\">"
                openLink = true
            }
        default: break
        }
    }

    private var openLink = false
    func parser(_ parser: XMLParser, didEndElement name: String,
                namespaceURI: String?, qualifiedName: String?) {
        if ignoredDepth > 0 { ignoredDepth -= 1; return }
        guard namespaceURI == Self.word, inBody else { return }
        switch name {
        case "body": inBody = false
        case "t": textDepth -= 1
        case "r":
            if bold { run = "<strong>\(run)</strong>" }
            if italic { run = "<em>\(run)</em>" }
            if let language { run = "<span xml:lang=\"\(escape(language))\">\(run)</span>" }
            paragraph? += run
        case "hyperlink":
            if openLink { paragraph? += "</a>"; openLink = false }
        case "p":
            if let paragraph {
                let tag = heading.map { "h\($0)" } ?? "p"
                body += "<\(tag)>\(paragraph)</\(tag)>"
            }
            paragraph = nil
        case "tc": if let tag = cells.popLast() { body += "</\(tag)>" }
        case "tr": _ = rows.popLast(); body += "</tr>"
        case "tbl": body += "</table>"
        default: break
        }
    }

    func parser(_ parser: XMLParser, foundCharacters string: String) {
        if textDepth > 0 && ignoredDepth == 0 { run += escape(string) }
    }
}
