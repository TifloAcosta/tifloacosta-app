import Foundation

/// Converts the shared safe XHTML subset into the main WordprocessingML story.
final class NativeDOCXConversionWriter: NSObject, XMLParserDelegate {
    struct Result {
        let body: String
        let relationships: String
        let assets: [NativeConversionMarkup.Asset]
    }

    private let escape = NativeDocumentConversion.xml
    private var body = ""
    private var closing: [String] = []
    private var paragraph = false
    private var runProperties: [String] = []
    private var languages: [String?] = []
    private var relationships = ""
    private var relationshipCount = 0
    private var bookmarkCount = 0
    private var imageCount = 0
    private var images: [String: NativeConversionMarkup.Asset] = [:]

    func write(_ markup: NativeConversionMarkup.Document) throws -> Result {
        images = Dictionary(uniqueKeysWithValues: markup.assets.map { ($0.path, $0) })
        let parser = XMLParser(data: Data("<body>\(markup.body)</body>".utf8))
        parser.delegate = self
        parser.shouldResolveExternalEntities = false
        guard parser.parse() else {
            try Task.checkCancellation()
            throw NativeDocumentConversion.Failure.invalidOutput
        }
        return Result(body: body, relationships: relationships, assets: images.values.sorted { $0.path < $1.path })
    }

    private func openParagraph(_ properties: String = "") {
        guard !paragraph else { return }
        body += "<w:p>\(properties)"
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
        case "table":
            closeParagraph()
            body += "<w:tbl><w:tblPr><w:tblW w:w=\"0\" w:type=\"auto\"/></w:tblPr><w:tblGrid/>"
            end = "</w:tbl>"
        case "tr":
            closeParagraph()
            body += "<w:tr>"
            end = "</w:tr>"
        case "td", "th":
            closeParagraph()
            body += "<w:tc>"
            if let count = attributes["colspan"].flatMap(Int.init), (2...100).contains(count) {
                body += "<w:tcPr><w:gridSpan w:val=\"\(count)\"/></w:tcPr>"
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
        _ = languages.popLast()
        guard let end = closing.popLast() else { return }
        switch end {
        case "paragraph": closeParagraph()
        case "cell":
            if paragraph { closeParagraph() }
            else if !body.hasSuffix("</w:p>") { body += "<w:p/>" }
            body += "</w:tc>"
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

    func parser(_ parser: XMLParser, foundCharacters string: String) { append(string) }
}
