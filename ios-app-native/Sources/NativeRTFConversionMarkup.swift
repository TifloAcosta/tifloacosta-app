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

    private struct Footnotes {
        let document: Data
        let prefix: String
        let bodies: [String]

        func insertLinks(in html: String) -> String {
            var result = ""
            var cursor = html.startIndex
            for index in bodies.indices {
                let key = "\(prefix)\(index)X"
                guard let range = html.range(of: key, range: cursor..<html.endIndex) else { continue }
                result += html[cursor..<range.lowerBound]
                result += "<a href=\"#rtf-note-\(index)\" role=\"doc-noteref\">\(index + 1)</a>"
                cursor = range.upperBound
            }
            result += html[cursor...]
            for (index, body) in bodies.enumerated() {
                let paragraphs = body.components(separatedBy: .newlines).map {
                    "<p>\(NativeDocumentConversion.xml($0))</p>"
                }.joined()
                result += "<aside id=\"rtf-note-\(index)\" role=\"doc-footnote\">\(paragraphs)</aside>"
            }
            return result
        }
    }

    /// Finds RTF destinations using the same group and binary boundaries as the native reader.
    /// Only recognized footnotes are replaced, and their contents still use the native decoder.
    private static func footnotes(in input: Data) throws -> Footnotes? {
        let bytes = Array(input)
        let prefix = "TifloNote" + UUID().uuidString.replacingOccurrences(of: "-", with: "") + "X"
        struct Group {
            let start: Int
            var noteStart: Int?
        }
        var stack: [Group] = []
        var ranges: [(whole: Range<Int>, note: Range<Int>)] = []
        var codePage: Int?
        var cursor = 0
        func letter(_ value: UInt8) -> Bool { (65...90).contains(value) || (97...122).contains(value) }
        func digit(_ value: UInt8) -> Bool { (48...57).contains(value) }
        while cursor < bytes.count {
            if cursor % 2048 == 0 { try Task.checkCancellation() }
            switch bytes[cursor] {
            case 123:
                guard stack.count < 512 else { return nil }
                stack.append(Group(start: cursor))
                cursor += 1
            case 125:
                guard let group = stack.popLast() else { return nil }
                if let note = group.noteStart, ranges.count < 1024, !stack.contains(where: { $0.noteStart != nil }) {
                    ranges.append((group.start..<(cursor + 1), note..<cursor))
                }
                cursor += 1
            case 92:
                let backslash = cursor
                cursor += 1
                guard cursor < bytes.count else { return nil }
                if bytes[cursor] == 39 {
                    guard bytes.count - cursor >= 3 else { return nil }
                    cursor += 3
                } else if letter(bytes[cursor]) {
                    let nameStart = cursor
                    while cursor < bytes.count, letter(bytes[cursor]) { cursor += 1 }
                    let nameEnd = cursor
                    let numberStart = cursor
                    if cursor < bytes.count, bytes[cursor] == 45 { cursor += 1 }
                    while cursor < bytes.count, digit(bytes[cursor]) { cursor += 1 }
                    let numberEnd = cursor
                    if cursor < bytes.count, bytes[cursor] == 32 { cursor += 1 }
                    let name = bytes[nameStart..<nameEnd]
                    if name.elementsEqual("bin".utf8) {
                        guard let number = Int(String(decoding: bytes[numberStart..<numberEnd], as: UTF8.self)),
                              number >= 0, number <= bytes.count - cursor else { return nil }
                        cursor += number
                    } else if name.elementsEqual("footnote".utf8),
                              let group = stack.last, backslash == group.start + 1 {
                        stack[stack.count - 1].noteStart = cursor
                    } else if name.elementsEqual("ansicpg".utf8), stack.count == 1, codePage == nil {
                        codePage = Int(String(decoding: bytes[numberStart..<numberEnd], as: UTF8.self))
                    }
                } else { cursor += 1 }
            default: cursor += 1
            }
        }
        guard stack.isEmpty, !ranges.isEmpty else { return nil }
        var original = Data()
        var bodies: [String] = []
        var end = 0
        let header = "{\\rtf1\\ansi" + (codePage.map { "\\ansicpg\($0)" } ?? "") + " "
        for entry in ranges {
            try Task.checkCancellation()
            var note = Data(header.utf8)
            note.append(contentsOf: bytes[entry.note])
            note.append(125)
            guard let text = try? NSAttributedString(data: note,
                options: [.documentType: NSAttributedString.DocumentType.rtf], documentAttributes: nil) else { continue }
            original.append(contentsOf: bytes[end..<entry.whole.lowerBound])
            original.append(contentsOf: "{\(prefix)\(bodies.count)X}".utf8)
            end = entry.whole.upperBound
            bodies.append(text.string.trimmingCharacters(in: .whitespacesAndNewlines))
        }
        guard !bodies.isEmpty else { return nil }
        original.append(contentsOf: bytes[end...])
        return Footnotes(document: original, prefix: prefix, bodies: bodies)
    }

    static func xhtml(_ data: Data, title: String) throws -> Data? {
        try Task.checkCancellation()
        // RTFD has external attachments. This reader accepts only the plain RTF stream.
        guard data.starts(with: Data("{\\rtf".utf8)) else { return nil }
        let notes = try footnotes(in: data)
        let original = try NSAttributedString(data: notes?.document ?? data, options: [.documentType: NSAttributedString.DocumentType.rtf],
                                              documentAttributes: nil)
        let escape = NativeDocumentConversion.xml
        let text = original.string as NSString
        var body = ""
        var offset = 0
        var levels: [ListLevel] = []
        var tables: [NSTextTableBlock] = []
        func closeLists() {
            while let level = levels.popLast() { body += "</li></\(level.tag)>" }
        }
        func closeTables(from index: Int) {
            while tables.count > index {
                _ = tables.popLast()
                body += "</td></tr></table>"
            }
        }
        while offset < text.length {
            try Task.checkCancellation()
            let paragraph = text.paragraphRange(for: NSRange(location: offset, length: 0))
            let style = original.attribute(.paragraphStyle, at: paragraph.location, effectiveRange: nil) as? NSParagraphStyle
            let blocks = (style?.textBlocks ?? []).compactMap { $0 as? NSTextTableBlock }
            let sharedCells = zip(tables, blocks).prefix {
                $0.0.table === $0.1.table && $0.0.startingRow == $0.1.startingRow &&
                $0.0.startingColumn == $0.1.startingColumn
            }.count
            if sharedCells != tables.count || sharedCells != blocks.count {
                closeLists()
                let sharedTable = sharedCells < tables.count && sharedCells < blocks.count &&
                    tables[sharedCells].table === blocks[sharedCells].table
                closeTables(from: sharedCells + (sharedTable ? 1 : 0))
                for index in sharedCells..<blocks.count {
                    let block = blocks[index]
                    if sharedTable && index == sharedCells {
                        if tables[index].startingRow == block.startingRow { body += "</td>" }
                        else { body += "</td></tr><tr>" }
                        tables[index] = block
                    } else {
                        body += "<table><tr>"
                        tables.append(block)
                    }
                    let width = block.columnSpan > 1 ? " colspan=\"\(block.columnSpan)\"" : ""
                    let height = block.rowSpan > 1 ? " rowspan=\"\(block.rowSpan)\"" : ""
                    body += "<td\(width)\(height)>"
                }
            }
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
        closeLists()
        closeTables(from: 0)
        try Task.checkCancellation()
        return Data("<html><head><title>\(escape(title))</title></head><body>\(notes?.insertLinks(in: body) ?? body)</body></html>".utf8)
    }
}
