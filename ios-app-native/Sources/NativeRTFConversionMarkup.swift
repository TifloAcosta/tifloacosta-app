import Foundation
#if canImport(UIKit)
import UIKit
#elseif canImport(AppKit)
import AppKit
#endif

enum NativeRTFConversionMarkup {
    private struct ListLevel {
        let list: NSTextList
        let tag: String
        var next: Int
    }

    private struct ListKind {
        let tag: String
        let type: String?
    }

    private static func listKind(_ list: NSTextList) -> ListKind? {
        let first = list.marker(forItemNumber: 1)
        let second = list.marker(forItemNumber: 2)
        if first == second, !first.isEmpty { return ListKind(tag: "ul", type: nil) }
        func token(_ marker: String) -> String {
            marker.trimmingCharacters(in: CharacterSet(charactersIn: " .()\t"))
        }
        switch (token(first), token(second)) {
        case ("1", "2"): return ListKind(tag: "ol", type: nil)
        case ("I", "II"): return ListKind(tag: "ol", type: "I")
        case ("i", "ii"): return ListKind(tag: "ol", type: "i")
        case ("A", "B"): return ListKind(tag: "ol", type: "A")
        case ("a", "b"): return ListKind(tag: "ol", type: "a")
        default: return nil
        }
    }

    static func xhtml(_ data: Data, title: String) throws -> Data? {
        try Task.checkCancellation()
        // RTFD has external attachments. This reader accepts only the plain RTF stream.
        guard data.starts(with: Data("{\\rtf".utf8)) else { return nil }
        let original = try NSAttributedString(data: data, options: [.documentType: NSAttributedString.DocumentType.rtf],
                                              documentAttributes: nil)
        let escape = NativeDocumentConversion.xml
        let text = original.string as NSString
        var body = ""
        var offset = 0
        var levels: [ListLevel] = []
        while offset < text.length {
            try Task.checkCancellation()
            let paragraph = text.paragraphRange(for: NSRange(location: offset, length: 0))
            let style = original.attribute(.paragraphStyle, at: paragraph.location, effectiveRange: nil) as? NSParagraphStyle
            let nativeLists = style?.textLists ?? []
            let kinds = nativeLists.compactMap(listKind)
            let supportedLists = kinds.count == nativeLists.count ? nativeLists : []
            let shared = zip(levels, supportedLists).prefix { $0.0.list === $0.1 }.count
            while levels.count > shared {
                body += "</li></\(levels.removeLast().tag)>"
            }
            if shared > 0 && shared == supportedLists.count {
                body += "</li><li>"
            }
            for index in shared..<supportedLists.count {
                let list = supportedLists[index]
                let kind = kinds[index]
                let tag = kind.tag
                let start = max(1, list.startingItemNumber)
                let attribute = tag == "ol" && start != 1 ? " start=\"\(start)\"" : ""
                let type = kind.type.map { " type=\"\($0)\"" } ?? ""
                body += "<\(tag)\(attribute)\(type)><li>"
                levels.append(ListLevel(list: list, tag: tag, next: start))
            }
            var content = paragraph
            if let list = levels.last {
                let marker = list.list.marker(forItemNumber: list.next)
                let source = text.substring(with: paragraph)
                for prefix in ["\t" + marker + "\t", marker + "\t"] where source.hasPrefix(prefix) && !marker.isEmpty {
                    let length = prefix.utf16.count
                    content = NSRange(location: paragraph.location + length, length: paragraph.length - length)
                    break
                }
                levels[levels.count - 1].next = min(list.next, Int.max - 1) + 1
            }
            body += "<p>"
            original.enumerateAttributes(in: content) { attributes, range, stop in
                if Task.isCancelled { stop.pointee = true; return }
                let value = text.substring(with: range).trimmingCharacters(in: .newlines)
                var rendered = escape(value)
                #if canImport(UIKit)
                if let font = attributes[.font] as? UIFont {
                    let traits = font.fontDescriptor.symbolicTraits
                    if traits.contains(.traitBold) { rendered = "<strong>\(rendered)</strong>" }
                    if traits.contains(.traitItalic) { rendered = "<em>\(rendered)</em>" }
                }
                #elseif canImport(AppKit)
                if let font = attributes[.font] as? NSFont {
                    let traits = font.fontDescriptor.symbolicTraits
                    if traits.contains(.bold) { rendered = "<strong>\(rendered)</strong>" }
                    if traits.contains(.italic) { rendered = "<em>\(rendered)</em>" }
                }
                #endif
                if let style = attributes[.underlineStyle] as? NSNumber, style.intValue != 0 {
                    rendered = "<u>\(rendered)</u>"
                }
                let link = (attributes[.link] as? URL)?.absoluteString ?? attributes[.link] as? String
                if let link { rendered = "<a href=\"\(escape(link))\">\(rendered)</a>" }
                body += rendered
            }
            body += "</p>"
            offset = NSMaxRange(paragraph)
        }
        while let level = levels.popLast() { body += "</li></\(level.tag)>" }
        try Task.checkCancellation()
        return Data("<html><head><title>\(escape(title))</title></head><body>\(body)</body></html>".utf8)
    }
}
