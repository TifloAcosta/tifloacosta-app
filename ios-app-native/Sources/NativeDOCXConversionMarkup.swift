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

    private var links: [String: String] = [:]
    private var images: [String: String] = [:]
    private var drawing = false
    private var embeddedSource: String?
    private var imageDescription = ""

    static func xhtml(content: Data, relationships: Data?, title: String) -> Data? {
        guard let source = String(data: content, encoding: .utf8),
              !source.localizedCaseInsensitiveContains("<!DOCTYPE") else { return nil }
        let delegate = NativeDOCXConversionMarkup()
        if let relationships, let xml = String(data: relationships, encoding: .utf8),
           !xml.localizedCaseInsensitiveContains("<!DOCTYPE") {
            let relationParser = XMLParser(data: relationships)
            let relationDelegate = Relationships()
            relationParser.delegate = relationDelegate
            if relationParser.parse() {
                delegate.links = relationDelegate.links
                delegate.images = relationDelegate.images
            }
        }
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
        if drawing {
            if name == "docPr", namespaceURI == "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" {
                imageDescription = attributes["descr"] ?? attributes["title"] ?? ""
            } else if name == "blip", namespaceURI == "http://schemas.openxmlformats.org/drawingml/2006/main",
                      let id = attributes["r:embed"] {
                embeddedSource = images[id]
            }
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
        case "drawing":
            drawing = true
            embeddedSource = nil
            imageDescription = ""
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
            let target = attributes["w:anchor"].map { "#" + $0 } ?? attributes["r:id"].flatMap { links[$0] }
            if let target {
                paragraph? += "<a href=\"\(escape(target))\">"
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
        case "drawing":
            drawing = false
            if let embeddedSource {
                run += "<img src=\"\(escape(embeddedSource))\" alt=\"\(escape(imageDescription))\"/>"
            } else {
                run += escape(imageDescription)
            }
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

    private final class Relationships: NSObject, XMLParserDelegate {
        var links: [String: String] = [:]
        var images: [String: String] = [:]

        func parser(_ parser: XMLParser, didStartElement name: String,
                    namespaceURI: String?, qualifiedName: String?, attributes: [String: String]) {
            if Task.isCancelled { parser.abortParsing(); return }
            guard name == "Relationship", let id = attributes["Id"], let target = attributes["Target"],
                  let type = attributes["Type"] else { return }
            let prefix = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/"
            if type == prefix + "hyperlink", attributes["TargetMode"] == "External" {
                links[id] = target
            } else if type == prefix + "image", attributes["TargetMode"] != "External" {
                images[id] = target
            }
        }
    }
}
