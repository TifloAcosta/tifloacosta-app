import Foundation

/// Converts the shared safe XHTML subset into the main WordprocessingML story.
final class NativeDOCXConversionWriter: NSObject, XMLParserDelegate {
    struct Result {
        let body: String
        let relationships: String
        let assets: [NativeConversionMarkup.Asset]
        let footnotes: String?
        let numbering: String?
    }

    private struct List {
        var id: Int
        let level: Int
        let format: String
        var next: Int
    }
    private var lists: [List] = []
    private var numbering: [(level: Int, format: String, start: Int)] = []
    private var pendingList: String?

    private let escape = NativeDocumentConversion.xml
    private var body = ""
    private var closing: [String] = []
    private var paragraph = false
    private var runProperties: [String] = []
    private var languages: [String?] = []
    private var relationships = ""
    private var relationshipCount = 0
    private var bookmarkCount = 0
    private struct VerticalMerge {
        let span: Int
        var remaining: Int
    }
    private struct TableGrid {
        var active: [Int: VerticalMerge] = [:]
        var next: [Int: VerticalMerge] = [:]
        var column = 0
        var rowOpen = false
    }
    private var grids: [TableGrid] = []
    private var noteIDs: [String: Int] = [:]
    private var noteBodies: [String: String] = [:]
    private var noteDepth = 0
    private var referenceDepth = 0
    private var imageCount = 0
    private var images: [String: NativeConversionMarkup.Asset] = [:]

    func write(_ markup: NativeConversionMarkup.Document) throws -> Result {
        images = Dictionary(uniqueKeysWithValues: markup.assets.map { ($0.path, $0) })
        let data = Data("<body>\(markup.body)</body>".utf8)
        let collector = NativeConversionNoteCollector()
        let scan = XMLParser(data: data)
        scan.shouldResolveExternalEntities = false
        scan.delegate = collector
        guard scan.parse() else {
            try Task.checkCancellation()
            throw NativeDocumentConversion.Failure.invalidOutput
        }
        noteBodies = collector.notes
        for key in collector.references where noteBodies[key] != nil && noteIDs[key] == nil {
            noteIDs[key] = noteIDs.count + 1
        }
        let parser = XMLParser(data: data)
        parser.delegate = self
        parser.shouldResolveExternalEntities = false
        guard parser.parse() else {
            try Task.checkCancellation()
            throw NativeDocumentConversion.Failure.invalidOutput
        }
        let notes = noteIDs.sorted { $0.value < $1.value }.map { key, id in
            let paragraphs = (noteBodies[key] ?? "").components(separatedBy: "\n")
            let content = paragraphs.enumerated().map { index, text in
                let marker = index == 0 ? "<w:r><w:rPr><w:vertAlign w:val=\"superscript\"/></w:rPr><w:footnoteRef/></w:r>" : ""
                return "<w:p>\(marker)<w:r><w:t xml:space=\"preserve\">\(escape(text))</w:t></w:r></w:p>"
            }.joined()
            return "<w:footnote w:id=\"\(id)\">\(content)</w:footnote>"
        }.joined()
        let footnotes = notes.isEmpty ? nil : "<w:footnotes xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\"><w:footnote w:type=\"separator\" w:id=\"-1\"><w:p><w:r><w:separator/></w:r></w:p></w:footnote><w:footnote w:type=\"continuationSeparator\" w:id=\"0\"><w:p><w:r><w:continuationSeparator/></w:r></w:p></w:footnote>\(notes)</w:footnotes>"
        let abstracts = numbering.enumerated().map { index, list in
            let marker = list.format == "bullet" ? "•" : "%\(list.level + 1)."
            return "<w:abstractNum w:abstractNumId=\"\(index)\"><w:multiLevelType w:val=\"multilevel\"/><w:lvl w:ilvl=\"\(list.level)\"><w:start w:val=\"\(list.start)\"/><w:numFmt w:val=\"\(list.format)\"/><w:lvlText w:val=\"\(marker)\"/><w:pPr><w:ind w:left=\"\((list.level + 1) * 360)\" w:hanging=\"240\"/></w:pPr></w:lvl></w:abstractNum>"
        }.joined()
        let instances = numbering.indices.map { "<w:num w:numId=\"\($0 + 1)\"><w:abstractNumId w:val=\"\($0)\"/></w:num>" }.joined()
        let numberingXML = numbering.isEmpty ? nil : "<w:numbering xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\">\(abstracts)\(instances)</w:numbering>"
        return Result(body: body, relationships: relationships, assets: images.values.sorted { $0.path < $1.path }, footnotes: footnotes, numbering: numberingXML)
    }

    private func appendMergeContinuations() {
        guard !grids.isEmpty else { return }
        let index = grids.count - 1
        while let merge = grids[index].active[grids[index].column] {
            let column = grids[index].column
            let span = merge.span > 1 ? "<w:gridSpan w:val=\"\(merge.span)\"/>" : ""
            body += "<w:tc><w:tcPr>\(span)<w:vMerge/></w:tcPr><w:p/></w:tc>"
            if merge.remaining > 1 {
                grids[index].next[column] = VerticalMerge(span: merge.span, remaining: merge.remaining - 1)
            }
            grids[index].column += merge.span
        }
    }

    private func openParagraph(_ properties: String = "") {
        guard !paragraph else { return }
        body += "<w:p>"
        if let pendingList {
            let style = properties.replacingOccurrences(of: "<w:pPr>", with: "").replacingOccurrences(of: "</w:pPr>", with: "")
            body += "<w:pPr>\(style)\(pendingList)</w:pPr>"
            self.pendingList = nil
        } else {
            body += properties
        }
        paragraph = true
    }

    private func closeParagraph() {
        guard paragraph else { return }
        body += "</w:p>"
        paragraph = false
    }

    func parser(_ parser: XMLParser, didStartElement tag: String, namespaceURI: String?,
                qualifiedName: String?, attributes: [String: String]) {
        if Task.isCancelled { parser.abortParsing(); return }
        if noteDepth > 0 { noteDepth += 1; return }
        if referenceDepth > 0 { referenceDepth += 1; return }
        if attributes["role"] == "doc-footnote", let id = attributes["id"], noteIDs[id] != nil {
            noteDepth = 1
            return
        }
        if tag == "a", attributes["role"] == "doc-noteref",
           let href = attributes["href"], href.hasPrefix("#"),
           noteBodies[String(href.dropFirst())] != nil {
            let key = String(href.dropFirst())
            // Word assigns the display number to the native reference.
            if noteIDs[key] == nil { noteIDs[key] = noteIDs.count + 1 }
            if let id = noteIDs[key] {
                openParagraph()
                body += "<w:r><w:rPr><w:vertAlign w:val=\"superscript\"/></w:rPr><w:footnoteReference w:id=\"\(id)\"/></w:r>"
                referenceDepth = 1
                return
            }
        }
        languages.append(attributes["xml:lang"] ?? attributes["lang"] ?? (languages.last ?? nil))
        var end = ""
        switch tag {
        case "p", "blockquote", "pre", "caption", "figcaption":
            closeParagraph()
            openParagraph()
            end = "paragraph"
        case "h1", "h2", "h3", "h4", "h5", "h6":
            closeParagraph()
            openParagraph("<w:pPr><w:pStyle w:val=\"Heading\(tag.suffix(1))\"/></w:pPr>")
            end = "paragraph"
        case "ol", "ul":
            if pendingList != nil { openParagraph() }
            closeParagraph()
            let level = min(lists.count, 8)
            let formats = ["I": "upperRoman", "i": "lowerRoman", "A": "upperLetter", "a": "lowerLetter"]
            let format = tag == "ul" ? "bullet" : formats[attributes["type"] ?? ""] ?? "decimal"
            let start = max(1, attributes["start"].flatMap(Int.init) ?? 1)
            numbering.append((level, format, start))
            lists.append(List(id: numbering.count, level: level, format: format, next: start))
            end = "list"
        case "li":
            closeParagraph()
            if var list = lists.last {
                let value = max(1, attributes["value"].flatMap(Int.init) ?? list.next)
                if list.format != "bullet", value != list.next {
                    numbering.append((list.level, list.format, value))
                    list.id = numbering.count
                }
                list.next = min(value, Int.max - 1) + 1
                lists[lists.count - 1] = list
                pendingList = "<w:numPr><w:ilvl w:val=\"\(list.level)\"/><w:numId w:val=\"\(list.id)\"/></w:numPr>"
            }
            end = "item"
        case "table":
            closeParagraph()
            body += "<w:tbl><w:tblPr><w:tblW w:w=\"0\" w:type=\"auto\"/></w:tblPr><w:tblGrid/>"
            grids.append(TableGrid())
            end = "table"
        case "tr":
            closeParagraph()
            body += "<w:tr>"
            if !grids.isEmpty {
                let index = grids.count - 1
                grids[index].column = 0
                grids[index].next = [:]
                grids[index].rowOpen = true
            }
            end = "row"
        case "td", "th":
            closeParagraph()
            appendMergeContinuations()
            body += "<w:tc>"
            let span = attributes["colspan"].flatMap(Int.init).flatMap { (2...100).contains($0) ? $0 : nil } ?? 1
            let rows = attributes["rowspan"].flatMap(Int.init).flatMap { (2...1000).contains($0) ? $0 : nil } ?? 1
            var properties = span > 1 ? "<w:gridSpan w:val=\"\(span)\"/>" : ""
            if rows > 1 { properties += "<w:vMerge w:val=\"restart\"/>" }
            if !properties.isEmpty { body += "<w:tcPr>\(properties)</w:tcPr>" }
            if !grids.isEmpty {
                let index = grids.count - 1
                let column = grids[index].column
                if rows > 1 { grids[index].next[column] = VerticalMerge(span: span, remaining: rows - 1) }
                grids[index].column += span
            }
            end = "cell"
        case "b", "strong", "i", "em", "u", "sub", "sup":
            let property: String
            switch tag {
            case "i", "em": property = "<w:i/>"
            case "u": property = "<w:u w:val=\"single\"/>"
            case "sub": property = "<w:vertAlign w:val=\"subscript\"/>"
            case "sup": property = "<w:vertAlign w:val=\"superscript\"/>"
            default: property = "<w:b/>"
            }
            runProperties.append(property)
            end = "style"
        case "br":
            openParagraph()
            body += "<w:r><w:br/></w:r>"
        case "a":
            if let href = attributes["href"] {
                openParagraph()
                if href.hasPrefix("#") {
                    body += "<w:hyperlink w:anchor=\"\(Self.bookmark(String(href.dropFirst())))\">"
                } else {
                    relationshipCount += 1
                    let identifier = "rich\(relationshipCount)"
                    relationships += "<Relationship Id=\"\(identifier)\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink\" Target=\"\(escape(href))\" TargetMode=\"External\"/>"
                    body += "<w:hyperlink r:id=\"\(identifier)\">"
                }
                end = "</w:hyperlink>"
            }
        case "img":
            if let path = attributes["src"], images[path] != nil {
                openParagraph()
                imageCount += 1
                let id = "image\(imageCount)"
                relationships += "<Relationship Id=\"\(id)\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/image\" Target=\"media/\(escape(path))\"/>"
                let alt = attributes["alt"].map { " descr=\"\(escape($0))\"" } ?? ""
                body += """
                <w:r><w:drawing><wp:inline><wp:extent cx="1080000" cy="1080000"/><wp:docPr id="\(imageCount)" name="\(id)"\(alt)/>
                <a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic>
                <pic:nvPicPr><pic:cNvPr id="0" name="\(id)"/><pic:cNvPicPr/></pic:nvPicPr>
                <pic:blipFill><a:blip r:embed="\(id)"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>
                <pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="1080000" cy="1080000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>
                </pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>
                """
            } else if let alt = attributes["alt"] { append(alt) }
        default: break
        }
        if let id = attributes["id"], !["table", "tr", "th", "td"].contains(tag) {
            openParagraph()
            bookmarkCount += 1
            body += "<w:bookmarkStart w:id=\"\(bookmarkCount)\" w:name=\"\(Self.bookmark(id))\"/><w:bookmarkEnd w:id=\"\(bookmarkCount)\"/>"
        }
        closing.append(end)
    }

    private static func bookmark(_ id: String) -> String {
        "t" + id.utf8.map { String(format: "%02x", $0) }.joined()
    }

    func parser(_ parser: XMLParser, didEndElement tag: String, namespaceURI: String?, qualifiedName: String?) {
        if noteDepth > 0 { noteDepth -= 1; return }
        if referenceDepth > 0 { referenceDepth -= 1; return }
        _ = languages.popLast()
        guard let end = closing.popLast() else { return }
        switch end {
        case "paragraph": closeParagraph()
        case "item":
            if pendingList != nil { openParagraph() }
            closeParagraph()
        case "list": _ = lists.popLast()
        case "cell":
            if paragraph { closeParagraph() }
            else if !body.hasSuffix("</w:p>") { body += "<w:p/>" }
            body += "</w:tc>"
        case "row":
            closeParagraph()
            appendMergeContinuations()
            if !grids.isEmpty {
                let index = grids.count - 1
                grids[index].active = grids[index].next
                grids[index].rowOpen = false
            }
            body += "</w:tr>"
        case "table":
            _ = grids.popLast()
            body += "</w:tbl>"
        case "style": _ = runProperties.popLast()
        default: body += end
        }
        if tag == "body" { closeParagraph() }
    }

    private func append(_ text: String) {
        guard paragraph || !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        openParagraph()
        var props = runProperties.joined()
        if let language = languages.last ?? nil { props += "<w:lang w:val=\"\(escape(language))\"/>" }
        let style = props.isEmpty ? "" : "<w:rPr>\(props)</w:rPr>"
        body += "<w:r>\(style)<w:t xml:space=\"preserve\">\(escape(text))</w:t></w:r>"
    }

    func parser(_ parser: XMLParser, foundCharacters string: String) {
        if noteDepth == 0 && referenceDepth == 0 { append(string) }
    }

}

final class NativeConversionNoteCollector: NSObject, XMLParserDelegate {
    var notes: [String: String] = [:]
    var references: [String] = []
    private var key: String?
    private var depth = 0
    private var text = ""
    func parser(_ parser: XMLParser, didStartElement tag: String, namespaceURI: String?,
                qualifiedName: String?, attributes: [String: String]) {
        if Task.isCancelled { parser.abortParsing(); return }
        if depth > 0 { depth += 1; if tag == "br" { text += "\n" }; return }
        if tag == "a", attributes["role"] == "doc-noteref", let href = attributes["href"], href.hasPrefix("#") {
            references.append(String(href.dropFirst()))
        }
        if attributes["role"] == "doc-footnote", let id = attributes["id"] {
            key = id; depth = 1; text = ""
        }
    }
    func parser(_ parser: XMLParser, foundCharacters string: String) {
        if depth > 0 { text += string }
    }
    func parser(_ parser: XMLParser, didEndElement tag: String, namespaceURI: String?, qualifiedName: String?) {
        guard depth > 0 else { return }
        if tag == "p" { text += "\n" }
        depth -= 1
        if depth == 0, let key {
            notes[key] = text.trimmingCharacters(in: .whitespacesAndNewlines)
            self.key = nil
        }
    }
}
