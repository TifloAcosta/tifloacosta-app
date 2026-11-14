import Foundation

/// Resolves the EPUB reading order from package metadata, not archive filenames.
/// Both EPUB 2 and EPUB 3 use the OPF manifest and spine.
enum NativeEpubSpine {
    static func readingOrder(in directory: URL, availableFiles: Set<String>) throws -> [String] {
        let opfPath = try packagePath(in: directory, availableFiles: availableFiles)
        let opfData = try Data(contentsOf: directory.appendingPathComponent(opfPath))
        let reader = NativeEpubPackageParser()
        let parser = XMLParser(data: opfData)
        parser.delegate = reader
        guard parser.parse(), !reader.spine.isEmpty else {
            throw NativeReaderFormatError.invalidArchive
        }

        let parent = (opfPath as NSString).deletingLastPathComponent
        var ordered: [String] = []
        for idref in reader.spine {
            guard let item = reader.manifest[idref] else {
                throw NativeReaderFormatError.invalidArchive
            }
            let href = item.href.components(separatedBy: "#")[0]
                .removingPercentEncoding ?? item.href
            let combined = (parent == "." ? "" : parent + "/") + href
            let path = (combined as NSString).standardizingPath
            guard !path.hasPrefix("/"), !path.split(separator: "/").contains(".."),
                  availableFiles.contains(path) else {
                throw NativeReaderFormatError.invalidArchive
            }
            if ["xhtml", "html", "htm"].contains(URL(fileURLWithPath: path).pathExtension.lowercased()) {
                ordered.append(path)
            }
        }
        guard !ordered.isEmpty else { throw NativeReaderFormatError.invalidArchive }
        return ordered
    }

    private static func packagePath(in directory: URL, availableFiles: Set<String>) throws -> String {
        if availableFiles.contains("META-INF/container.xml") {
            let contents = try Data(contentsOf: directory.appendingPathComponent("META-INF/container.xml"))
            let reader = NativeEpubContainerParser()
            let parser = XMLParser(data: contents)
            parser.delegate = reader
            guard parser.parse(), let path = reader.packagePath,
                  availableFiles.contains(path) else { throw NativeReaderFormatError.invalidArchive }
            return path
        }
        // EPUB archives without container.xml are invalid; never guess which OPF to use.
        throw NativeReaderFormatError.invalidArchive
    }
}

private final class NativeEpubContainerParser: NSObject, XMLParserDelegate {
    var packagePath: String?

    func parser(_ parser: XMLParser, didStartElement elementName: String,
                namespaceURI: String?, qualifiedName qName: String?,
                attributes attributeDict: [String: String]) {
        if elementName.split(separator: ":").last == "rootfile",
           attributeDict["media-type"] == "application/oebps-package+xml" {
            packagePath = attributeDict["full-path"]
        }
    }
}

private final class NativeEpubPackageParser: NSObject, XMLParserDelegate {
    struct Item { let href: String }
    var manifest: [String: Item] = [:]
    var spine: [String] = []

    func parser(_ parser: XMLParser, didStartElement elementName: String,
                namespaceURI: String?, qualifiedName qName: String?,
                attributes attributeDict: [String: String]) {
        switch elementName.split(separator: ":").last {
        case "item":
            if let id = attributeDict["id"], let href = attributeDict["href"] {
                manifest[id] = Item(href: href)
            }
        case "itemref":
            if let idref = attributeDict["idref"] { spine.append(idref) }
        default: break
        }
    }
}
