import Foundation

/// Extracción lineal y hablable de documentos Office Open XML.
/// Evita leer XML sin procesar y mantiene el orden lógico de las celdas.
enum NativeOfficeText {
    static func number(in path: String, prefix: String) -> Int {
        let filename = URL(fileURLWithPath: path).deletingPathExtension().lastPathComponent
        return Int(filename.replacingOccurrences(of: prefix, with: "")) ?? 0
    }

    static func slides(_ paths: [String], text: (String) -> String) -> String {
        let slides = paths.filter {
            $0.range(of: #"^ppt/slides/slide[0-9]+\.xml$"#,
                     options: .regularExpression) != nil
        }.sorted { number(in: $0, prefix: "slide") < number(in: $1, prefix: "slide") }
        return slides.compactMap { path -> String? in
            let content = text(path).trimmingCharacters(in: .whitespacesAndNewlines)
            guard !content.isEmpty else { return nil }
            return "Diapositiva \(number(in: path, prefix: "slide"))\n\n\(content)"
        }.joined(separator: "\n\n")
    }

    static func spreadsheet(_ paths: [String], data: (String) -> Data?) -> String {
        let shared: [String]
        if let payload = data("xl/sharedStrings.xml") {
            let parserDelegate = SharedStringsReader()
            let parser = XMLParser(data: payload)
            parser.delegate = parserDelegate
            shared = parser.parse() ? parserDelegate.values : []
        } else {
            shared = []
        }
        let sheets = paths.filter {
            $0.range(of: #"^xl/worksheets/sheet[0-9]+\.xml$"#,
                     options: .regularExpression) != nil
        }.sorted { number(in: $0, prefix: "sheet") < number(in: $1, prefix: "sheet") }
        return sheets.compactMap { path -> String? in
            guard let payload = data(path) else { return nil }
            let reader = WorksheetReader(shared: shared)
            let parser = XMLParser(data: payload)
            parser.delegate = reader
            guard parser.parse(), !reader.rows.isEmpty else { return nil }
            return "Hoja \(number(in: path, prefix: "sheet"))\n\n\(reader.rows.joined(separator: "\n"))"
        }.joined(separator: "\n\n")
    }
}

private final class SharedStringsReader: NSObject, XMLParserDelegate {
    var values: [String] = []
    private var entry = ""
    private var inEntry = false
    private var inText = false

    func parser(_ parser: XMLParser, didStartElement name: String,
                namespaceURI: String?, qualifiedName qName: String?,
                attributes attributeDict: [String: String]) {
        if name == "si" { inEntry = true; entry = "" }
        if name == "t" && inEntry { inText = true }
    }

    func parser(_ parser: XMLParser, foundCharacters string: String) {
        if inText { entry += string }
    }

    func parser(_ parser: XMLParser, didEndElement name: String,
                namespaceURI: String?, qualifiedName qName: String?) {
        if name == "t" { inText = false }
        if name == "si" {
            values.append(entry)
            inEntry = false
        }
    }
}

private final class WorksheetReader: NSObject, XMLParserDelegate {
    let shared: [String]
    var rows: [String] = []
    private var rowNumber = ""
    private var parts: [String] = []
    private var cellReference = ""
    private var cellType = ""
    private var value = ""
    private var readingValue = false
    private var readingInline = false

    init(shared: [String]) { self.shared = shared }

    func parser(_ parser: XMLParser, didStartElement name: String,
                namespaceURI: String?, qualifiedName qName: String?,
                attributes attributeDict: [String: String]) {
        switch name {
        case "row":
            rowNumber = attributeDict["r"] ?? String(rows.count + 1)
            parts = []
        case "c":
            cellReference = attributeDict["r"] ?? ""
            cellType = attributeDict["t"] ?? ""
            value = ""
        case "v":
            readingValue = true
        case "t" where cellType == "inlineStr":
            readingInline = true
        default: break
        }
    }

    func parser(_ parser: XMLParser, foundCharacters string: String) {
        if readingValue || readingInline { value += string }
    }

    func parser(_ parser: XMLParser, didEndElement name: String,
                namespaceURI: String?, qualifiedName qName: String?) {
        switch name {
        case "v": readingValue = false
        case "t": readingInline = false
        case "c":
            var content = value.trimmingCharacters(in: .whitespacesAndNewlines)
            if cellType == "s", let index = Int(content), shared.indices.contains(index) {
                content = shared[index]
            } else if cellType == "b" {
                content = content == "1" ? "Verdadero" : "Falso"
            }
            if !content.isEmpty {
                let column = String(cellReference.prefix(while: { $0.isLetter }))
                parts.append("\(column.isEmpty ? "Celda" : "Columna " + column): \(content)")
            }
            cellReference = ""
            cellType = ""
            value = ""
        case "row":
            if !parts.isEmpty {
                rows.append("Fila \(rowNumber). \(parts.joined(separator: ". "))")
            }
        default: break
        }
    }
}
