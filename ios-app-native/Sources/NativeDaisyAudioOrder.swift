import Foundation

/// DAISY audio track order is defined by its navigation documents and SMIL,
/// never by the ZIP directory listing or alphabetical MP3 filenames.
/// Tracks are kept intact (not re-encoded); repeated SMIL clips referencing
/// the same physical file do not create duplicate copies in the library.
private final class NativeDaisySMILAudioDelegate: NSObject, XMLParserDelegate {
    private(set) var sources: [String] = []

    func parser(_ parser: XMLParser, didStartElement elementName: String,
                namespaceURI: String?, qualifiedName qName: String?,
                attributes attributeDict: [String: String] = [:]) {
        let tag = elementName.split(separator: ":").last?.lowercased()
        guard tag == "audio", let src = attributeDict.first(where: {
            $0.key.split(separator: ":").last?.lowercased() == "src"
        })?.value else { return }
        sources.append(src)
    }
}

enum NativeDaisyAudioOrder {
    /// Resolve an archive-relative SMIL/audio reference only to an existing
    /// member. A basename fallback is allowed only if unambiguous; otherwise
    /// audio from two folders with the same filename could silently be swapped.
    private static func member(_ reference: String, relativeTo base: String,
                               in available: [String]) -> String? {
        let path = String(reference.split(separator: "#", maxSplits: 1,
                                          omittingEmptySubsequences: false).first ?? "")
            .split(separator: "?", maxSplits: 1, omittingEmptySubsequences: false)
            .first.map(String.init) ?? ""
        let decoded = (path.removingPercentEncoding ?? path)
            .replacingOccurrences(of: "\\", with: "/")
        guard !decoded.isEmpty, !decoded.hasPrefix("/"),
              !decoded.contains("://") else { return nil }

        let parent = (base as NSString).deletingLastPathComponent
        let absolute = URL(fileURLWithPath: "/" + parent, isDirectory: true)
            .appendingPathComponent(decoded).standardizedFileURL.path
        guard absolute.hasPrefix("/") else { return nil }
        let relative = String(absolute.dropFirst())
        if let exact = available.first(where: {
            $0.caseInsensitiveCompare(relative) == .orderedSame
        }) { return exact }

        // Some older DAISY archives refer to files in a sibling directory.
        // This compatibility fallback must never guess between duplicates.
        let basename = URL(fileURLWithPath: decoded).lastPathComponent
        let matches = available.filter {
            URL(fileURLWithPath: $0).lastPathComponent
                .caseInsensitiveCompare(basename) == .orderedSame
        }
        return matches.count == 1 ? matches[0] : nil
    }

    private static func nccReferences(_ text: String) -> [String] {
        let pattern = #"(?i)\bhref\s*=\s*["']([^"']+\.smil(?:#[^"']*)?)["']"#
        guard let regex = try? NSRegularExpression(pattern: pattern) else { return [] }
        let ns = text as NSString
        return regex.matches(in: text, range: NSRange(location: 0, length: ns.length))
            .map { ns.substring(with: $0.range(at: 1)) }
    }

    private static func smilSources(_ data: Data) -> [String] {
        let delegate = NativeDaisySMILAudioDelegate()
        let parser = XMLParser(data: data)
        parser.delegate = delegate
        if parser.parse() { return delegate.sources }

        // A few older SMIL files contain imperfect XML. Read their audio
        // elements in source order instead of falling back to filename order.
        guard let text = String(data: data, encoding: .utf8),
              let tags = try? NSRegularExpression(pattern: #"(?is)<audio\b[^>]*>"#)
        else { return [] }
        let ns = text as NSString
        let range = NSRange(location: 0, length: ns.length)
        let source = try? NSRegularExpression(
            pattern: #"(?i)\bsrc\s*=\s*["']([^"']+)["']"#)
        return tags.matches(in: text, range: range).compactMap { match in
            let tag = ns.substring(with: match.range) as NSString
            guard let value = source?.firstMatch(in: tag as String,
                range: NSRange(location: 0, length: tag.length)) else { return nil }
            return tag.substring(with: value.range(at: 1))
        }
    }

    static func orderedAudioFiles(in directory: URL, packagePaths: [String],
                                  audioPaths: [String]) -> [String] {
        guard !audioPaths.isEmpty else { return [] }
        let smilFiles = packagePaths.filter { $0.lowercased().hasSuffix(".smil") }
        guard !smilFiles.isEmpty else { return audioPaths }

        var orderedSMIL: [String] = []
        var seenSMIL: Set<String> = []
        func addSMIL(_ reference: String, relativeTo base: String) {
            guard let path = member(reference, relativeTo: base, in: smilFiles),
                  seenSMIL.insert(path.lowercased()).inserted else { return }
            orderedSMIL.append(path)
        }

        // DAISY 2.02: the NCC's links define the reading sequence.
        for ncc in packagePaths.filter({ $0.lowercased().hasSuffix("ncc.html") }) {
            guard let text = try? String(contentsOf: directory.appendingPathComponent(ncc),
                                         encoding: .utf8) else { continue }
            for reference in nccReferences(text) {
                addSMIL(reference, relativeTo: ncc)
            }
        }

        // DAISY 3: NCX navPoint order defines the spine when NCC is absent.
        for ncx in packagePaths.filter({ $0.lowercased().hasSuffix(".ncx") }) {
            guard let data = try? Data(contentsOf: directory.appendingPathComponent(ncx))
            else { continue }
            for link in NativeDaisyNCX.parse(data) {
                addSMIL(link.href, relativeTo: ncx)
            }
        }

        // Preserve audio from unindexed chapters, too: no tracks may be lost.
        for smil in smilFiles { addSMIL(smil, relativeTo: smil) }

        var orderedAudio: [String] = []
        var seenAudio: Set<String> = []
        for smil in orderedSMIL {
            guard let data = try? Data(contentsOf: directory.appendingPathComponent(smil))
            else { continue }
            for source in smilSources(data) {
                guard let path = member(source, relativeTo: smil, in: audioPaths),
                      seenAudio.insert(path.lowercased()).inserted else { continue }
                orderedAudio.append(path)
            }
        }

        // A DAISY package may include extra unreferenced tracks. Export each
        // exactly once, after all tracks with a known navigation order.
        for path in audioPaths where seenAudio.insert(path.lowercased()).inserted {
            orderedAudio.append(path)
        }
        return orderedAudio
    }
}
