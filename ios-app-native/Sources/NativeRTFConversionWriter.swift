import Foundation

/// Serializes the shared XHTML representation without executing markup or loading resources.
final class NativeRTFConversionWriter: NSObject, XMLParserDelegate {
    private var output = ""
    private var endings: [String] = []
    private var tableDepth = 0
    private var rowStart: Int?
    private struct Merge {
        let width: Int
        let remaining: Int
    }
    private var cellProperties: [String] = []
    private var activeMerges: [Int: Merge] = [:]
    private var followingMerges: [Int: Merge] = [:]
    private struct ListState {
        var id: Int
        let format: Int
        let level: Int
        var next: Int?
    }
    private var listStates: [ListState] = []
    private var lists: [String] = []
    private var overrides: [String] = []
    private var notes: [String: String] = [:]
    private var emittedNotes: Set<String> = []
    private var suppressedDepth = 0
    private let assets: [String: NativeConversionMarkup.Asset]

    init(assets: [NativeConversionMarkup.Asset]) {
        self.assets = Dictionary(uniqueKeysWithValues: assets.map { ($0.path, $0) })
    }

    func write(_ markup: NativeConversionMarkup.Document, fragment: Bool = false) throws -> String {
        output = "{\\rtf1\\ansi\\uc1{\\fonttbl{\\f0 Arial;}}{\\info{\\title \(Self.escape(markup.title))}"
        if let author = markup.metadata["author"] { output += "{\\author \(Self.escape(author))}" }
        output += "}\\f0\\fs24 "
        if fragment { output = "" }
        let headerEnd = output.utf8.count
        let data = Data("<body>\(markup.body)</body>".utf8)
        let collector = NativeConversionNoteCollector()
        let scan = XMLParser(data: data)
        scan.shouldResolveExternalEntities = false
        scan.delegate = collector
        guard scan.parse() else {
            try Task.checkCancellation()
            throw NativeDocumentConversion.Failure.invalidOutput
        }
        for id in collector.references where notes[id] == nil {
            guard let body = collector.richNotes[id] else { continue }
            let note = NativeConversionMarkup.Document(body: body, title: "", language: nil,
                metadata: [:], assets: [], headings: [])
            notes[id] = try NativeRTFConversionWriter(assets: []).write(note, fragment: true)
        }
        let parser = XMLParser(data: data)
        parser.shouldResolveExternalEntities = false
        parser.delegate = self
        guard parser.parse() else {
            try Task.checkCancellation()
            throw NativeDocumentConversion.Failure.invalidOutput
        }
        if !lists.isEmpty {
            let index = output.utf8.index(output.utf8.startIndex, offsetBy: headerEnd)
            let tables = "{\\*\\listtable" + lists.joined() + "}{\\*\\listoverridetable" + overrides.joined() + "}"
            output.insert(contentsOf: tables, at: index)
        }
        try Task.checkCancellation()
        return fragment ? output : output + "}"
    }

    static func escape(_ text: String) -> String {
        var result = ""
        for code in text.utf16 {
            switch code {
            case 9: result += "\\tab "
            case 92, 123, 125: result += "\\" + String(UnicodeScalar(code)!)
            case 32...126: result += String(UnicodeScalar(code)!)
            case 0...31: continue
            default: result += "\\u\(Int16(bitPattern: code))?"
            }
        }
        return result
    }

    func parser(_ parser: XMLParser, didStartElement tag: String, namespaceURI: String?,
                qualifiedName: String?, attributes: [String: String]) {
        if Task.isCancelled { parser.abortParsing(); return }
        if suppressedDepth > 0 { suppressedDepth += 1; return }
        if attributes["role"] == "doc-footnote", let id = attributes["id"], notes[id] != nil {
            suppressedDepth = 1
            return
        }
        if tag == "a", attributes["role"] == "doc-noteref", let href = attributes["href"], href.hasPrefix("#") {
            let id = String(href.dropFirst())
            if let note = notes[id], emittedNotes.insert(id).inserted {
                let name = Self.bookmark(id)
                let content = note
                output += "{\\super\\chftn}{\\footnote\\pard\\plain\\fs20{\\*\\bkmkstart \(name)}{\\*\\bkmkend \(name)}{\\super\\chftn} \(content)}"
                suppressedDepth = 1
                return
            }
        }
        var close = ""
        if let id = attributes["id"] {
            let safe = Self.bookmark(id)
            output += "{\\*\\bkmkstart \(safe)}{\\*\\bkmkend \(safe)}"
        }
        switch tag {
        case "p", "blockquote", "pre", "figcaption", "caption": close = "\\par\n"
        case "h1", "h2", "h3", "h4", "h5", "h6":
            let level = (tag.last?.wholeNumberValue ?? 1) - 1
            output += "{\\pard" + (rowStart == nil ? "" : "\\intbl") + "\\outlinelevel\(level)\\b "
            close = "\\par}\n"
        case "strong", "b": output += "{\\b "; close = "}"
        case "em", "i": output += "{\\i "; close = "}"
        case "u": output += "{\\ul "; close = "}"
        case "sub": output += "{\\sub "; close = "}"
        case "sup": output += "{\\super "; close = "}"
        case "br": output += "\\line "
        case "ol", "ul":
            let start = tag == "ol" ? max(1, min(32767, attributes["start"].flatMap(Int.init) ?? 1)) : nil
            let format = tag == "ul" ? 23 : (["I": 1, "i": 2, "A": 3, "a": 4][attributes["type"] ?? ""] ?? 0)
            let level = min(8, listStates.count)
            let id = registerList(format: format, start: start ?? 1, level: level)
            listStates.append(ListState(id: id, format: format, level: level, next: start))
        case "li":
            let indentation = min(listStates.count, 12) * 360
            output += "{\\pard" + (rowStart == nil ? "" : "\\intbl") + "\\li\(indentation) "
            if var list = listStates.last {
                if let counter = list.next {
                    let value = max(1, min(32767, attributes["value"].flatMap(Int.init) ?? counter))
                    if value != counter { list.id = registerList(format: list.format, start: value, level: list.level) }
                    output += "\\ls\(list.id)\\ilvl\(list.level) {\\listtext \(Self.listMarker(value, format: list.format)).\\tab}"
                    list.next = min(32767, value + 1)
                    listStates[listStates.count - 1] = list
                } else {
                    output += "\\ls\(list.id)\\ilvl\(list.level) {\\listtext\\bullet\\tab}"
                }
            }
            close = "\\par}\n"
        case "table":
            tableDepth += 1
        case "tr":
            if tableDepth == 1 {
                rowStart = output.utf8.count
                cellProperties.removeAll(keepingCapacity: true)
                followingMerges.removeAll(keepingCapacity: true)
            } else { close = "\\line " }
        case "td", "th":
            if tableDepth == 1, rowStart != nil {
                appendCoveredCells()
                let width = min(100, max(1, attributes["colspan"].flatMap(Int.init) ?? 1))
                let rows = min(1000, max(1, attributes["rowspan"].flatMap(Int.init) ?? 1))
                if rows > 1 { followingMerges[cellProperties.count] = Merge(width: width, remaining: rows - 1) }
                appendCellProperties(width: width, vertical: rows > 1 ? "\\clvmgf" : "")
                output += "\\pard\\intbl "
                close = String(repeating: "\\cell ", count: width)
            } else { close = "\\tab " }
        case "a":
            if let href = attributes["href"] {
                let field: String
                if href.hasPrefix("#") { field = "\\\\l \"\(Self.bookmark(String(href.dropFirst())))\"" }
                else { field = "\"\(Self.escape(href.replacingOccurrences(of: "\"", with: "%22")))\"" }
                output += "{\\field{\\*\\fldinst HYPERLINK \(field)}{\\fldrslt "
                close = "}}"
            }
        case "img":
            if let path = attributes["src"], let image = assets[path],
               ["image/png", "image/jpeg"].contains(image.mediaType) {
                let kind = image.mediaType == "image/png" ? "pngblip" : "jpegblip"
                let digits = Array("0123456789abcdef".utf8)
                var bytes: [UInt8] = []
                bytes.reserveCapacity(image.data.count * 2)
                for (index, byte) in image.data.enumerated() {
                    if index % 16384 == 0, Task.isCancelled { parser.abortParsing(); return }
                    bytes.append(digits[Int(byte >> 4)])
                    bytes.append(digits[Int(byte & 15)])
                }
                output += "{\\pict\\\(kind) " + String(decoding: bytes, as: UTF8.self) + "}"
            }
            if let alt = attributes["alt"], !alt.isEmpty { output += Self.escape(alt) }
        default: break
        }
        endings.append(close)
    }

    private func appendCellProperties(width: Int, vertical: String) {
        for index in 0..<width {
            let horizontal = width == 1 ? "" : index == 0 ? "\\clmgf" : "\\clmrg"
            cellProperties.append(vertical + horizontal)
        }
    }

    private func appendCoveredCells() {
        while let merge = activeMerges[cellProperties.count] {
            if merge.remaining > 1 {
                followingMerges[cellProperties.count] = Merge(width: merge.width, remaining: merge.remaining - 1)
            }
            appendCellProperties(width: merge.width, vertical: "\\clvmrg")
            output += "\\pard\\intbl " + String(repeating: "\\cell ", count: merge.width)
        }
    }

    private func registerList(format: Int, start: Int, level: Int) -> Int {
        let id = lists.count + 1
        let levels = (0...level).map { index in
            let marker = format == 23 ? "{\\leveltext\\'01\\u8226?;}{\\levelnumbers;}" :
                "{\\leveltext\\'02\\'0\(index).;}{\\levelnumbers\\'01;}"
            let first = index == level ? start : 1
            return "{\\listlevel\\levelnfc\(format)\\leveljc0\\levelfollow0\\levelstartat\(first)\(marker)}"
        }.joined()
        let kind = level == 0 ? "\\listsimple1" : "\\listhybrid"
        lists.append("{\\list\\listtemplateid\(id)\(kind)\(levels)\\listid\(id)}")
        overrides.append("{\\listoverride\\listid\(id)\\listoverridecount0\\ls\(id)}")
        return id
    }

    private static func listMarker(_ value: Int, format: Int) -> String {
        if format == 3 || format == 4 {
            let a = format == 3 ? 65 : 97
            return String(repeating: String(UnicodeScalar(a + (value - 1) % 26)!), count: (value - 1) / 26 + 1)
        }
        if (format == 1 || format == 2) && value < 4000 {
            var remainder = value
            var result = ""
            for (unit, symbol) in [(1000, "M"), (900, "CM"), (500, "D"), (400, "CD"), (100, "C"),
                                   (90, "XC"), (50, "L"), (40, "XL"), (10, "X"), (9, "IX"),
                                   (5, "V"), (4, "IV"), (1, "I")] {
                result += String(repeating: symbol, count: remainder / unit)
                remainder %= unit
            }
            return format == 2 ? result.lowercased() : result
        }
        return String(value)
    }

    private static func bookmark(_ id: String) -> String {
        "t" + id.utf8.map { String(format: "%02x", $0) }.joined()
    }

    func parser(_ parser: XMLParser, didEndElement tag: String, namespaceURI: String?, qualifiedName: String?) {
        if suppressedDepth > 0 { suppressedDepth -= 1; return }
        output += endings.popLast() ?? ""
        if tag == "ol" || tag == "ul" { _ = listStates.popLast() }
        if tag == "tr", tableDepth == 1, let start = rowStart {
            appendCoveredCells()
            if !cellProperties.isEmpty {
                let positions = cellProperties.enumerated().map { index, properties in
                    properties + "\\cellx\((index + 1) * 1200)"
                }.joined()
                let insertion = output.utf8.index(output.utf8.startIndex, offsetBy: start)
                output.insert(contentsOf: "{\\trowd\\trgaph108" + positions + " ", at: insertion)
                output += "\\row}\\pard\n"
            }
            activeMerges = followingMerges
            rowStart = nil
        }
        if tag == "table" {
            tableDepth -= 1
            if tableDepth == 0 { activeMerges.removeAll(keepingCapacity: true) }
        }
    }

    func parser(_ parser: XMLParser, foundCharacters string: String) {
        if suppressedDepth == 0 { output += Self.escape(string) }
    }
}
