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
    private var underline = false
    private var verticalAlignment: String?
    private var language: String?
    private var textDepth = 0
    private var ignoredDepth = 0
    private var inBody = false
    private struct Cell {
        var tag: String
        var content: String
        var span: Int = 1
        var rows: Int = 1
        var merge: String? = nil
    }
    private struct Table {
        var rows: [[Cell]] = []
        var current: [Cell] = []
        var header = false
        var cellStart: Int? = nil
        var cellSpan = 1
        var cellMerge: String? = nil
    }
    private var tables: [Table] = []

    private static func renderTable(_ table: Table) -> String {
        var resolved: [[Cell]] = []
        // Active entries are indexed by grid column, not physical cell number.
        var active: [Int: (row: Int, cell: Int, span: Int)] = [:]
        for row in table.rows {
            var next: [Int: (row: Int, cell: Int, span: Int)] = [:]
            var result: [Cell] = []
            var column = 0
            for cell in row {
                if cell.merge == "continue", let owner = active[column], owner.span == cell.span {
                    resolved[owner.row][owner.cell].rows += 1
                    // Preserve nonempty continuation content instead of silently discarding it.
                    if !cell.content.isEmpty && cell.content != "<p></p>" {
                        resolved[owner.row][owner.cell].content += cell.content
                    }
                    next[column] = owner
                } else {
                    if cell.merge == "restart" {
                        next[column] = (resolved.count, result.count, cell.span)
                    }
                    result.append(cell)
                }
                column += cell.span
            }
            resolved.append(result)
            active = next
        }
        return "<table>" + resolved.map { row in
            "<tr>" + row.map { cell in
                let columns = cell.span > 1 ? " colspan=\"\(cell.span)\"" : ""
                let rows = cell.rows > 1 ? " rowspan=\"\(cell.rows)\"" : ""
                return "<\(cell.tag)\(columns)\(rows)>\(cell.content)</\(cell.tag)>"
            }.joined() + "</tr>"
        }.joined() + "</table>"
    }
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
        case "r": run = ""; bold = false; italic = false; underline = false; verticalAlignment = nil; language = nil
        case "b": bold = !["0", "false", "off"].contains(attributes["w:val"] ?? "")
        case "i": italic = !["0", "false", "off"].contains(attributes["w:val"] ?? "")
        case "u": underline = !["none", "0", "false", "off"].contains(attributes["w:val"] ?? "single")
        case "vertAlign":
            if let value = attributes["w:val"], ["subscript", "superscript"].contains(value) {
                verticalAlignment = value
            }
        case "lang": language = attributes["w:val"]
        case "drawing":
            drawing = true
            embeddedSource = nil
            imageDescription = ""
        case "t": textDepth += 1
        case "tab": run += "&#9;"
        case "br": run += "<br/>"
        case "tbl": tables.append(Table())
        case "tr":
            if !tables.isEmpty { tables[tables.count - 1].current = []; tables[tables.count - 1].header = false }
        case "tblHeader":
            if !tables.isEmpty { tables[tables.count - 1].header = !["0", "false", "off"].contains(attributes["w:val"] ?? "") }
        case "tc":
            if !tables.isEmpty {
                tables[tables.count - 1].cellStart = body.utf8.count
                tables[tables.count - 1].cellSpan = 1
                tables[tables.count - 1].cellMerge = nil
            }
        case "gridSpan":
            if !tables.isEmpty, let count = attributes["w:val"].flatMap(Int.init), (2...100).contains(count) {
                tables[tables.count - 1].cellSpan = count
            }
        case "vMerge":
            if !tables.isEmpty {
                let value = attributes["w:val"] ?? "continue"
                if ["restart", "continue"].contains(value) { tables[tables.count - 1].cellMerge = value }
            }
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
            if underline { run = "<u>\(run)</u>" }
            if let verticalAlignment {
                let tag = verticalAlignment == "subscript" ? "sub" : "sup"
                run = "<\(tag)>\(run)</\(tag)>"
            }
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
        case "tc":
            if !tables.isEmpty, let start = tables[tables.count - 1].cellStart {
                let position = body.utf8.index(body.utf8.startIndex, offsetBy: start)
                let content = String(body[position...])
                body.removeSubrange(position...)
                let index = tables.count - 1
                tables[index].current.append(Cell(tag: tables[index].header ? "th" : "td", content: content,
                                                  span: tables[index].cellSpan, merge: tables[index].cellMerge))
                tables[index].cellStart = nil
            }
        case "tr":
            if !tables.isEmpty {
                let index = tables.count - 1
                tables[index].rows.append(tables[index].current)
                tables[index].current = []
            }
        case "tbl":
            if let table = tables.popLast() { body += Self.renderTable(table) }
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
