import Foundation

/// Parses the DAISY 3 NCX hierarchy without flattening headings to level one.
struct NativeDaisyNCXLink {
    let title: String
    let level: Int
    let href: String
}

private final class NativeDaisyNCXDelegate: NSObject, XMLParserDelegate {
    private struct Item {
        var title = ""
        var href = ""
        var level: Int
    }

    private var stack: [Item] = []
    private var insideLabel = false
    private var insideText = false
    private(set) var links: [NativeDaisyNCXLink] = []

    func parser(_ parser: XMLParser, didStartElement elementName: String,
                namespaceURI: String?, qualifiedName qName: String?,
                attributes attributeDict: [String: String] = [:]) {
        let tag = elementName.split(separator: ":").last?.lowercased() ?? elementName.lowercased()
        switch tag {
        case "navpoint":
            stack.append(Item(level: stack.count + 1))
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
        case "navpoint":
            guard let item = stack.popLast() else { return }
            let title = item.title.trimmingCharacters(in: .whitespacesAndNewlines)
            if !title.isEmpty, !item.href.isEmpty {
                links.append(.init(title: title, level: item.level, href: item.href))
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
