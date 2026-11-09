import Foundation

/// Parses the DAISY 3 NCX hierarchy without flattening headings to level one.
struct NativeDaisyNCXLink {
    let title: String
    let level: Int
    let href: String
    let kind: String
}

private final class NativeDaisyNCXDelegate: NSObject, XMLParserDelegate {
    private struct Item {
        var title = ""
        var href = ""
        var level: Int
        var kind: String
        var order: Int
    }

    private var stack: [Item] = []
    private var nextOrder = 0
    private var sortedLinks: [(Int, NativeDaisyNCXLink)] = []
    private var insideLabel = false
    private var insideText = false
    var links: [NativeDaisyNCXLink] {
        sortedLinks.sorted { $0.0 < $1.0 }.map { $0.1 }
    }

    func parser(_ parser: XMLParser, didStartElement elementName: String,
                namespaceURI: String?, qualifiedName qName: String?,
                attributes attributeDict: [String: String] = [:]) {
        let tag = elementName.split(separator: ":").last?.lowercased() ?? elementName.lowercased()
        switch tag {
        case "navpoint", "pagetarget", "navtarget":
            let kind = tag == "pagetarget" ? "Página" : tag == "navtarget" ? "Referencia" : "Encabezado"
            let level = tag == "navpoint" ? stack.filter { $0.kind == "Encabezado" }.count + 1 : 1
            stack.append(Item(level: level, kind: kind, order: nextOrder))
            nextOrder += 1
        case "navlabel":
            insideLabel = !stack.isEmpty
        case "text":
            insideText = insideLabel
        case "content":
            if !stack.isEmpty { stack[stack.count - 1].href = attributeDict["src"] ?? "" }
        default:
            break
        }
    }

    func parser(_ parser: XMLParser, foundCharacters string: String) {
        if insideText, !stack.isEmpty {
            stack[stack.count - 1].title += string
        }
    }

    func parser(_ parser: XMLParser, didEndElement elementName: String,
                namespaceURI: String?, qualifiedName qName: String?) {
        let tag = elementName.split(separator: ":").last?.lowercased() ?? elementName.lowercased()
        switch tag {
        case "text":
            insideText = false
        case "navlabel":
            insideLabel = false
        case "navpoint", "pagetarget", "navtarget":
            guard let item = stack.popLast() else { return }
            let title = item.title.trimmingCharacters(in: .whitespacesAndNewlines)
            if !title.isEmpty, !item.href.isEmpty {
                sortedLinks.append((item.order, .init(title: title, level: item.level,
                                                     href: item.href, kind: item.kind)))
            }
        default:
            break
        }
    }
}

enum NativeDaisyNCX {
    static func parse(_ data: Data) -> [NativeDaisyNCXLink] {
        let delegate = NativeDaisyNCXDelegate()
        let parser = XMLParser(data: data)
        parser.delegate = delegate
        guard parser.parse() else { return [] }
        return delegate.links
    }
}
