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
                result += "<aside id=\"rtf-note-\(index)\" role=\"doc-footnote\">\(body)</aside>"
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
            bodies.append(try render(text))
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
        let source = notes?.document ?? data
        let tables: (document: Data, prefix: String, html: [String])?
        do { tables = try extractTables(source) }
        catch is CancellationError { throw CancellationError() }
        catch { tables = nil }
        let original = try NSAttributedString(data: tables?.document ?? source, options: [.documentType: NSAttributedString.DocumentType.rtf],
                                              documentAttributes: nil)
        var body = try render(original)
        if let tables {
            for (index, table) in tables.html.enumerated() {
                let marker = "<p>\(tables.prefix)\(index)X</p>"
                guard body.contains(marker) else {
                    let fallback = try NSAttributedString(data: source,
                        options: [.documentType: NSAttributedString.DocumentType.rtf], documentAttributes: nil)
                    body = try render(fallback)
                    break
                }
                body = body.replacingOccurrences(of: marker, with: table)
            }
        }
        let escape = NativeDocumentConversion.xml
        return Data("<html><head><title>\(escape(title))</title></head><body>\(notes?.insertLinks(in: body) ?? body)</body></html>".utf8)
    }

    private struct TableCell {
        var text: Range<Int> = 0..<0
        var horizontal = 0
        var vertical = 0
    }

    private struct TableRow {
        var cells: [TableCell] = []
        var start: Int
        var contentStart: Int?
        var finished = 0
        var header = false
    }

    /// Read explicitly defined RTF cells. Native text decoding is used only
    /// for their contents, so the same table structure is available on iOS and macOS.
    private static func extractTables(_ data: Data) throws -> (document: Data, prefix: String, html: [String])? {
        let bytes = Array(data)
        var i = 0
        var groups: [Int] = []
        var ignoredDepth: Int?
        var row: TableRow?
        var definition = TableCell()
        var rows: [(range: Range<Int>, row: TableRow)] = []
        var fontTable: Range<Int>?
        var fontStart: (start: Int, depth: Int)?
        var codePage = ""
        func isLetter(_ b: UInt8) -> Bool { (65...90).contains(b) || (97...122).contains(b) }
        while i < bytes.count {
            if i % 2048 == 0 { try Task.checkCancellation() }
            let start = i
            let byte = bytes[i]
            i += 1
            if byte == 123 { groups.append(start); continue }
            if byte == 125 {
                if let pendingFont = fontStart, pendingFont.depth == groups.count {
                    fontTable = pendingFont.start..<i
                    fontStart = nil
                }
                if ignoredDepth == groups.count { ignoredDepth = nil }
                _ = groups.popLast()
                continue
            }
            guard byte == 92, i < bytes.count else { continue }
            if bytes[i] == 39 { i = min(i + 3, bytes.count); continue }
            if bytes[i] == 42 {
                if ignoredDepth == nil { ignoredDepth = groups.count }
                i += 1
                continue
            }
            guard isLetter(bytes[i]) else { i += 1; continue }
            let wordStart = i
            while i < bytes.count && isLetter(bytes[i]) { i += 1 }
            let word = String(decoding: bytes[wordStart..<i], as: UTF8.self)
            let paramStart = i
            if i < bytes.count && bytes[i] == 45 { i += 1 }
            while i < bytes.count && (48...57).contains(bytes[i]) { i += 1 }
            let paramEnd = i
            if i < bytes.count && bytes[i] == 32 { i += 1 }
            if word == "bin" {
                guard let count = Int(String(decoding: bytes[paramStart..<paramEnd], as: UTF8.self)),
                      count >= 0, count <= bytes.count - i else { return nil }
                i += count
                continue
            }
            if ignoredDepth != nil { continue }
            switch word {
            case "fonttbl", "pict", "object", "footnote", "stylesheet", "colortbl":
                if word == "fonttbl", let boundary = groups.last {
                    fontStart = (boundary, groups.count)
                }
                ignoredDepth = groups.count
            case "ansicpg":
                if groups.count == 1, Int(String(decoding: bytes[paramStart..<paramEnd], as: UTF8.self)) != nil {
                    codePage = "\\ansicpg" + String(decoding: bytes[paramStart..<paramEnd], as: UTF8.self)
                }
            case "trowd":
                let boundary = groups.last.map { $0 == start - 1 && groups.count > 1 ? $0 : start } ?? start
                row = TableRow(start: boundary)
                definition = TableCell()
            case "trhdr": row?.header = true
            case "clmgf": definition.horizontal = 1
            case "clmrg": definition.horizontal = 2
            case "clvmgf": definition.vertical = 1
            case "clvmrg": definition.vertical = 2
            case "cellx":
                if var current = row, current.finished == 0, current.cells.count < 512 {
                    current.cells.append(definition)
                    current.contentStart = i
                    row = current
                }
                definition = TableCell()
            case "cell":
                if var current = row, let contentStart = current.contentStart, current.finished < current.cells.count {
                    current.cells[current.finished].text = contentStart..<start
                    current.contentStart = i
                    current.finished += 1
                    row = current
                }
            case "row":
                if let current = row, !current.cells.isEmpty, current.finished == current.cells.count {
                    let grouped = groups.last == current.start
                    var end = i
                    while end < bytes.count && [9, 10, 13, 32].contains(bytes[end]) { end += 1 }
                    if grouped && (end >= bytes.count || bytes[end] != 125) { row = nil; continue }
                    if let previous = rows.last, previous.range.upperBound > current.start { return nil }
                    rows.append((current.start..<(grouped ? end + 1 : i), current))
                }
                row = nil
            default: break
            }
        }
        guard !rows.isEmpty else { return nil }
        let prefix = "TifloTable" + UUID().uuidString.replacingOccurrences(of: "-", with: "") + "X"
        var document = Data()
        var html: [String] = []
        var end = 0
        var first = 0
        func isRowSeparator(_ bytes: ArraySlice<UInt8>) -> Bool {
            let controls = String(decoding: bytes, as: UTF8.self)
            return controls.replacingOccurrences(of: "\\pard", with: "")
                .trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        }
        while first < rows.count {
            var last = first + 1
            while last < rows.count, rows[last - 1].range.upperBound <= rows[last].range.lowerBound,
                  isRowSeparator(bytes[rows[last - 1].range.upperBound..<rows[last].range.lowerBound]) {
                last += 1
            }
            document.append(contentsOf: bytes[end..<rows[first].range.lowerBound])
            document.append(contentsOf: "\\par {\\pard\\plain \(prefix)\(html.count)X\\par} ".utf8)
            var table = "<table>"
            for pos in first..<last {
                try Task.checkCancellation()
                table += "<tr>"
                let row = rows[pos].row
                var column = 0
                while column < row.cells.count {
                    let cell = row.cells[column]
                    var width = 1
                    if cell.horizontal == 1 {
                        while column + width < row.cells.count && row.cells[column + width].horizontal == 2 { width += 1 }
                    }
                    defer { column += width }
                    if cell.vertical == 2 || cell.horizontal == 2 { continue }
                    var height = 1
                    if cell.vertical == 1 {
                        while pos + height < last, column < rows[pos + height].row.cells.count,
                              rows[pos + height].row.cells[column].vertical == 2 { height += 1 }
                    }
                    var content = Data("{\\rtf1\\ansi\(codePage) ".utf8)
                    if let fontTable { content.append(contentsOf: bytes[fontTable]) }
                    content.append(contentsOf: bytes[cell.text])
                    content.append(125)
                    let styled = try NSAttributedString(data: content,
                        options: [.documentType: NSAttributedString.DocumentType.rtf], documentAttributes: nil)
                    let tag = row.header ? "th" : "td"
                    table += "<\(tag)\(width > 1 ? " colspan=\"\(width)\"" : "")\(height > 1 ? " rowspan=\"\(height)\"" : "")>"
                    table += try render(styled)
                    table += "</\(tag)>"
                }
                table += "</tr>"
            }
            html.append(table + "</table>")
            end = rows[last - 1].range.upperBound
            first = last
        }
        document.append(contentsOf: bytes[end...])
        return (document, prefix, html)
    }

    private static func render(_ original: NSAttributedString) throws -> String {
        let escape = NativeDocumentConversion.xml
        let text = original.string as NSString
        var body = ""
        var offset = 0
        var levels: [ListLevel] = []
        func closeLists() {
            while let level = levels.popLast() { body += "</li></\(level.tag)>" }
        }
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
        closeLists()
        try Task.checkCancellation()
        return body
    }
}
