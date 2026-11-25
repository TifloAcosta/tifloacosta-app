import Foundation

/// Writes the supported subset of the shared, sanitized XHTML document as ODF.
final class NativeODTConversionWriter: NSObject, XMLParserDelegate {
    private static let numberStyles = ["1": "Numbered", "I": "RomanUpper", "i": "RomanLower",
                                       "A": "AlphabeticUpper", "a": "AlphabeticLower"]
    static let listStyles: String = {
        let levels = 1...10
        let bullets = levels.map { "<text:list-level-style-bullet text:level=\"\($0)\" text:bullet-char=\"•\"/>" }
        let styles = numberStyles.sorted(by: { $0.key < $1.key }).map { format, name in
            let numbering = levels.map {
                "<text:list-level-style-number text:level=\"\($0)\" style:num-format=\"\(format)\" style:num-suffix=\".\"/>"
            }
            return "<text:list-style style:name=\"\(name)\">\(numbering.joined())</text:list-style>"
        }
        return "<text:list-style style:name=\"Bullets\">\(bullets.joined())</text:list-style>" + styles.joined()
    }()

    private let assets: [String: NativeConversionMarkup.Asset]
    private var output = ""
    private var frames: [(element: String, wrapsInline: Bool, languageSpan: Bool)] = []
    private var passageStyles: [String: (name: String, language: String, country: String)] = [:]

    var languageStyles: String {
        passageStyles.values.sorted { $0.name < $1.name }.map {
            "<style:style style:name=\"\($0.name)\" style:family=\"text\"><style:text-properties fo:language=\"\($0.language)\" fo:country=\"\($0.country)\"/></style:style>"
        }.joined()
    }

    private func languageSpan(_ value: String?) -> String? {
        guard let value else { return nil }
        let parts = value.split(separator: "-")
        guard let language = parts.first, (2...8).contains(language.count),
              language.utf8.allSatisfy({ (65...90).contains($0) || (97...122).contains($0) }),
              language.lowercased() != "und" else { return nil }
        let country = parts.dropFirst().first {
            $0.count == 2 && $0.utf8.allSatisfy { (65...90).contains($0) || (97...122).contains($0) }
        }?.uppercased() ?? "none"
        let code = language.lowercased()
        let key = code + "-" + country
        if passageStyles[key] == nil {
            passageStyles[key] = ("Passage\(passageStyles.count + 1)", code, country)
        }
        return passageStyles[key]?.name
    }
    private var nextImage = 0
    private struct Merge {
        let span: Int
        let remaining: Int
    }
    private struct Grid {
        var active: [Int: Merge] = [:]
        var next: [Int: Merge] = [:]
        var column = 0
    }
    private var grids: [Grid] = []
    private var horizontalSpans: [Int] = []
    private var listStarts: [Int?] = []
    private var paragraphDepth = 0
    private var notes: [String: String] = [:]
    private var emittedNotes: Set<String> = []
    private var ignoredNoteDepth = 0
    private var citationDepth = 0
    private var citationEnding = ""
    private var closeCitationParagraph = false
    private let escape = NativeDocumentConversion.xml

    init(assets: [NativeConversionMarkup.Asset]) {
        self.assets = Dictionary(uniqueKeysWithValues: assets.map { ($0.path, $0) })
    }

    func write(_ body: String) throws -> String {
        let parser = XMLParser(data: Data("<body>\(body)</body>".utf8))
        parser.shouldResolveExternalEntities = false
        let notesParser = XMLParser(data: Data("<body>\(body)</body>".utf8))
        let collector = NativeConversionNoteCollector()
        notesParser.shouldResolveExternalEntities = false
        notesParser.delegate = collector
        guard notesParser.parse() else {
            try Task.checkCancellation()
            throw NativeDocumentConversion.Failure.invalidOutput
        }
        for id in collector.references where notes[id] == nil {
            if let content = collector.richNotes[id] {
                let writer = NativeODTConversionWriter(assets: [])
                writer.passageStyles = passageStyles
                notes[id] = try writer.write(content)
                passageStyles = writer.passageStyles
            }
        }
        parser.delegate = self
        guard parser.parse() else {
            try Task.checkCancellation()
            throw NativeDocumentConversion.Failure.invalidOutput
        }
        return output
    }

    private func coveredCells() {
        guard !grids.isEmpty else { return }
        let i = grids.count - 1
        while let merge = grids[i].active[grids[i].column] {
            let column = grids[i].column
            output += String(repeating: "<table:covered-table-cell/>", count: merge.span)
            if merge.remaining > 1 {
                grids[i].next[column] = Merge(span: merge.span, remaining: merge.remaining - 1)
            }
            grids[i].column += merge.span
        }
    }

    func parser(_ parser: XMLParser, didStartElement tag: String,
                namespaceURI: String?, qualifiedName: String?, attributes: [String: String]) {
        if Task.isCancelled { parser.abortParsing(); return }
        if ignoredNoteDepth > 0 { ignoredNoteDepth += 1; return }
        if citationDepth > 0 { citationDepth += 1; return }
        if attributes["role"] == "doc-footnote", let id = attributes["id"], notes[id] != nil {
            ignoredNoteDepth = 1
            return
        }
        if tag == "a", attributes["role"] == "doc-noteref",
           let href = attributes["href"], href.hasPrefix("#") {
            let id = String(href.dropFirst())
            if let note = notes[id] {
                closeCitationParagraph = paragraphDepth == 0
                if closeCitationParagraph { output += "<text:p>" }
                if emittedNotes.insert(id).inserted {
                    output += "<text:note text:id=\"\(escape(id))\" text:note-class=\"footnote\"><text:note-citation>"
                    let paragraphs = note.isEmpty ? "<text:p/>" : note
                    citationEnding = "</text:note-citation><text:note-body>\(paragraphs)</text:note-body></text:note>"
                } else {
                    output += "<text:note-ref text:ref-name=\"\(escape(id))\" text:note-class=\"footnote\" text:reference-format=\"text\">"
                    citationEnding = "</text:note-ref>"
                }
                citationDepth = 1
                return
            }
        }
        let mapping: (String, String)
        switch tag {
        case "p", "div", "blockquote", "pre", "figcaption", "caption":
            mapping = paragraphDepth == 0 && tag != "div" ? ("text:p", "") : ("", "")
        case "h1", "h2", "h3", "h4", "h5", "h6":
            mapping = ("text:h", " text:outline-level=\"\(tag.suffix(1))\"")
        case "ol", "ul":
            listStarts.append(tag == "ol" ? attributes["start"].flatMap(Int.init).flatMap { $0 > 0 ? $0 : nil } : nil)
            let type = Self.numberStyles[attributes["type"] ?? "1"] ?? "Numbered"
            mapping = ("text:list", " text:style-name=\"\(tag == "ol" ? type : "Bullets")\"")
        case "li":
            let start = attributes["value"].flatMap(Int.init).flatMap { $0 > 0 ? $0 : nil } ?? (listStarts.last ?? nil)
            if !listStarts.isEmpty { listStarts[listStarts.count - 1] = nil }
            mapping = ("text:list-item", start.map { " text:start-value=\"\($0)\"" } ?? "")
        case "table":
            grids.append(Grid())
            mapping = ("table:table", "")
        case "thead": mapping = ("table:table-header-rows", "")
        case "tbody": mapping = ("table:table-rows", "")
        case "tr":
            if !grids.isEmpty {
                let i = grids.count - 1
                grids[i].column = 0
                grids[i].next = [:]
            }
            mapping = ("table:table-row", "")
        case "th", "td":
            coveredCells()
            let span = attributes["colspan"].flatMap(Int.init).flatMap { (2...100).contains($0) ? $0 : nil } ?? 1
            let rows = attributes["rowspan"].flatMap(Int.init).flatMap { (2...1000).contains($0) ? $0 : nil } ?? 1
            horizontalSpans.append(span)
            var properties = span > 1 ? " table:number-columns-spanned=\"\(span)\"" : ""
            if rows > 1 { properties += " table:number-rows-spanned=\"\(rows)\"" }
            if !grids.isEmpty {
                let i = grids.count - 1
                if rows > 1 { grids[i].next[grids[i].column] = Merge(span: span, remaining: rows - 1) }
                grids[i].column += span
            }
            mapping = ("table:table-cell", properties)
        case "a":
            mapping = attributes["href"].map { ("text:a", " xlink:type=\"simple\" xlink:href=\"\(escape($0))\"") } ?? ("", "")
        case "strong", "b": mapping = ("text:span", " text:style-name=\"Bold\"")
        case "em", "i": mapping = ("text:span", " text:style-name=\"Italic\"")
        case "br":
            appendInline("<text:line-break/>")
            mapping = ("", "")
        case "img":
            if let path = attributes["src"], assets[path] != nil {
                nextImage += 1
                let alt = attributes["alt"].map { "<svg:desc>\(escape($0))</svg:desc>" } ?? ""
                appendInline("<draw:frame draw:name=\"Image\(nextImage)\" text:anchor-type=\"as-char\" svg:width=\"3cm\" svg:height=\"3cm\"><draw:image xlink:href=\"Pictures/\(escape(path))\" xlink:type=\"simple\" xlink:show=\"embed\" xlink:actuate=\"onLoad\"/>\(alt)</draw:frame>")
            } else if let alt = attributes["alt"] { appendInline(escape(alt)) }
            mapping = ("", "")
        default: mapping = ("", "")
        }

        let element = mapping.0
        let passage = languageSpan(attributes["xml:lang"] ?? attributes["lang"])
        let wrapsInline = paragraphDepth == 0 && (["text:a", "text:span"].contains(element) ||
            (element.isEmpty && passage != nil && tag == "span"))
        if wrapsInline { output += "<text:p>"; paragraphDepth += 1 }
        if !element.isEmpty { output += "<\(element)\(mapping.1)>" }
        if element == "text:p" || element == "text:h" { paragraphDepth += 1 }
        if let id = attributes["id"], paragraphDepth > 0 {
            output += "<text:bookmark text:name=\"\(escape(id))\"/>"
        }
        let appliesLanguage = paragraphDepth > 0 && passage != nil
        if let passage, appliesLanguage { output += "<text:span text:style-name=\"\(passage)\">" }
        frames.append((element, wrapsInline, appliesLanguage))
    }

    func parser(_ parser: XMLParser, didEndElement tag: String,
                namespaceURI: String?, qualifiedName: String?) {
        if ignoredNoteDepth > 0 { ignoredNoteDepth -= 1; return }
        if citationDepth > 0 {
            citationDepth -= 1
            if citationDepth == 0 {
                output += citationEnding
                if closeCitationParagraph { output += "</text:p>" }
            }
            return
        }
        guard let frame = frames.popLast() else { return }
        if tag == "tr" { coveredCells() }
        if frame.languageSpan { output += "</text:span>" }
        if !frame.element.isEmpty { output += "</\(frame.element)>" }
        if tag == "td" || tag == "th" {
            let span = horizontalSpans.popLast() ?? 1
            if span > 1 { output += String(repeating: "<table:covered-table-cell/>", count: span - 1) }
        }
        if tag == "tr", !grids.isEmpty {
            let i = grids.count - 1
            grids[i].active = grids[i].next
        }
        if tag == "table" { _ = grids.popLast() }
        if tag == "ol" || tag == "ul" { _ = listStarts.popLast() }
        if frame.element == "text:p" || frame.element == "text:h" { paragraphDepth -= 1 }
        if frame.wrapsInline { output += "</text:p>"; paragraphDepth -= 1 }
    }

    func parser(_ parser: XMLParser, foundCharacters string: String) {
        if ignoredNoteDepth > 0 { return }
        if paragraphDepth > 0 || citationDepth > 0 {
            output += escape(string)
        } else if !string.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            appendInline(escape(string))
        }
    }

    private func appendInline(_ xml: String) {
        if paragraphDepth > 0 { output += xml }
        else { output += "<text:p>\(xml)</text:p>" }
    }
}
