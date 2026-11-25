import Foundation

/// Serializes the shared XHTML representation without executing markup or loading resources.
final class NativeRTFConversionWriter: NSObject, XMLParserDelegate {
    private var output = ""
    private var endings: [String] = []
    private var tableDepth = 0
    private var rowStart: Int?
    private var cells = 0
    private struct ListState {
        let id: Int
        var next: Int?
    }
    private var listStates: [ListState] = []
    private var lists: [String] = []
    private var overrides: [String] = []
    private let assets: [String: NativeConversionMarkup.Asset]

    init(assets: [NativeConversionMarkup.Asset]) {
        self.assets = Dictionary(uniqueKeysWithValues: assets.map { ($0.path, $0) })
    }

    func write(_ markup: NativeConversionMarkup.Document) throws -> String {
        output = "{\\rtf1\\ansi\\uc1{\\fonttbl{\\f0 Arial;}}{\\info{\\title \(Self.escape(markup.title))}"
        if let author = markup.metadata["author"] { output += "{\\author \(Self.escape(author))}" }
        output += "}\\f0\\fs24 "
        let headerEnd = output.utf8.count
        let parser = XMLParser(data: Data("<body>\(markup.body)</body>".utf8))
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
        return output + "}"
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
            let id = lists.count + 1
            let numberFormat = start == nil ? 23 : 0
            let levelText = start == nil ? "{\\leveltext\\'01\\u8226?;}{\\levelnumbers;}" : "{\\leveltext\\'02\\'00.;}{\\levelnumbers\\'01;}"
            lists.append("{\\list\\listtemplateid\(id)\\listsimple1{\\listlevel\\levelnfc\(numberFormat)\\leveljc0\\levelfollow0\\levelstartat\(start ?? 1)\(levelText)}\\listid\(id)}")
            overrides.append("{\\listoverride\\listid\(id)\\listoverridecount0\\ls\(id)}")
            listStates.append(ListState(id: id, next: start))
        case "li":
            let indentation = min(listStates.count, 12) * 360
            output += "{\\pard" + (rowStart == nil ? "" : "\\intbl") + "\\li\(indentation) "
            if let list = listStates.last {
                output += "\\ls\(list.id)\\ilvl0 "
                if let counter = list.next {
                    let value = min(attributes["value"].flatMap(Int.init) ?? counter, Int.max - 1)
                    output += "{\\listtext \(value).\\tab}"
                    listStates[listStates.count - 1].next = value + 1
                } else { output += "{\\listtext\\bullet\\tab}" }
            }
            close = "\\par}\n"
        case "table":
            tableDepth += 1
        case "tr":
            if tableDepth == 1 {
                rowStart = output.utf8.count
                cells = 0
            } else { close = "\\line " }
        case "td", "th":
            if tableDepth == 1, rowStart != nil {
                cells += 1
                output += "\\pard\\intbl "
                close = "\\cell "
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
                for byte in image.data {
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

    private static func bookmark(_ id: String) -> String {
        "t" + id.utf8.map { String(format: "%02x", $0) }.joined()
    }

    func parser(_ parser: XMLParser, didEndElement tag: String, namespaceURI: String?, qualifiedName: String?) {
        output += endings.popLast() ?? ""
        if tag == "ol" || tag == "ul" { _ = listStates.popLast() }
        if tag == "tr", tableDepth == 1, let start = rowStart {
            if cells > 0 {
                let width = max(1, 9000 / cells)
                let positions = (1...cells).map { "\\cellx\($0 * width)" }.joined()
                let insertion = output.utf8.index(output.utf8.startIndex, offsetBy: start)
                output.insert(contentsOf: "{\\trowd\\trgaph108" + positions + " ", at: insertion)
                output += "\\row}\\pard\n"
            }
            rowStart = nil
        }
        if tag == "table" { tableDepth -= 1 }
    }

    func parser(_ parser: XMLParser, foundCharacters string: String) {
        output += Self.escape(string)
    }
}
