import Foundation

/// DAISY audio track order is defined by its navigation documents and SMIL,
/// never by the ZIP directory listing or alphabetical MP3 filenames.
/// Tracks are kept intact (not re-encoded); repeated SMIL clips referencing
/// the same physical file do not create duplicate copies in the library.
/// A playable SMIL interval. Track indices point into the preserved original
/// audio files; repeated intervals are deliberately NOT deduplicated.
struct NativeDaisyAudioClip: Codable, Hashable {
    let track: Int
    let begin: TimeInterval
    let end: TimeInterval?
}

private struct NativeDaisySMILSource {
    let file: String
    let begin: String?
    let end: String?
}

private final class NativeDaisySMILAudioDelegate: NSObject, XMLParserDelegate {
    private(set) var sources: [NativeDaisySMILSource] = []

    func parser(_ parser: XMLParser, didStartElement elementName: String,
                namespaceURI: String?, qualifiedName qName: String?,
                attributes attributeDict: [String: String] = [:]) {
        let tag = elementName.split(separator: ":").last?.lowercased()
        guard tag == "audio" else { return }
        func value(_ names: Set<String>) -> String? {
            attributeDict.first(where: {
                names.contains($0.key.split(separator: ":").last.map(String.init)?
                    .lowercased() ?? "")
            })?.value
        }
        guard let file = value(["src"]) else { return }
        sources.append(.init(file: file,
            begin: value(["clipbegin", "clip-begin"]),
            end: value(["clipend", "clip-end"])))
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

    private static func smilSources(_ data: Data) -> [NativeDaisySMILSource] {
        let delegate = NativeDaisySMILAudioDelegate()
        let parser = XMLParser(data: data)
        parser.shouldResolveExternalEntities = false
        parser.delegate = delegate
        if parser.parse() { return delegate.sources }
        // Malformed older SMIL: retain encountered audio tags in source order.
        guard let text = String(data: data, encoding: .utf8),
              let tags = try? NSRegularExpression(pattern: #"(?is)<audio\\b[^>]*>"#)
        else { return [] }
        let ns = text as NSString
        let range = NSRange(location: 0, length: ns.length)
        func attribute(_ name: String, in tag: String) -> String? {
            let pattern = #"(?i)\\b"# + NSRegularExpression.escapedPattern(for: name)
                + #"\\s*=\\s*["']([^"']+)["']"#
            guard let regex = try? NSRegularExpression(pattern: pattern),
                  let match = regex.firstMatch(in: tag,
                    range: NSRange(location: 0, length: (tag as NSString).length))
            else { return nil }
            return (tag as NSString).substring(with: match.range(at: 1))
        }
        return tags.matches(in: text, range: range).compactMap { match in
            let tag = ns.substring(with: match.range)
            guard let file = attribute("src", in: tag) else { return nil }
            return NativeDaisySMILSource(file: file,
                begin: attribute("clipBegin", in: tag) ?? attribute("clip-begin", in: tag),
                end: attribute("clipEnd", in: tag) ?? attribute("clip-end", in: tag))
        }
    }

    private static func seconds(_ clock: String?) -> TimeInterval? {
        guard let clock else { return nil }
        let normalized = clock.trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: "npt=", with: "", options: .caseInsensitive)
        let value = normalized.lowercased().hasSuffix("s")
            ? String(normalized.dropLast()) : normalized
        let parts = value.split(separator: ":")
        guard !parts.isEmpty, parts.count <= 3 else { return nil }
        var result = 0.0
        for part in parts {
            guard let number = Double(part), number.isFinite, number >= 0 else { return nil }
            result = result * 60 + number
        }
        return result.isFinite ? result : nil
    }

    private static func orderedSMILFiles(in directory: URL,
                                         packagePaths: [String]) -> [String] {
        let smilFiles = packagePaths.filter { $0.lowercased().hasSuffix(".smil") }
        var orderedSMIL: [String] = []
        var seenSMIL: Set<String> = []
        func addSMIL(_ reference: String, relativeTo base: String) {
            guard let path = member(reference, relativeTo: base, in: smilFiles),
                  seenSMIL.insert(path.lowercased()).inserted else { return }
            orderedSMIL.append(path)
        }
        for ncc in packagePaths.filter({ $0.lowercased().hasSuffix("ncc.html") }) {
            guard let text = try? String(contentsOf: directory.appendingPathComponent(ncc),
                                         encoding: .utf8) else { continue }
            for reference in nccReferences(text) { addSMIL(reference, relativeTo: ncc) }
        }
        for ncx in packagePaths.filter({ $0.lowercased().hasSuffix(".ncx") }) {
            guard let data = try? Data(contentsOf: directory.appendingPathComponent(ncx))
            else { continue }
            for link in NativeDaisyNCX.parse(data) {
                addSMIL(link.href, relativeTo: ncx)
            }
        }
        for smil in smilFiles where seenSMIL.insert(smil.lowercased()).inserted {
            orderedSMIL.append(smil)
        }
        return orderedSMIL
    }

    /// Preserve every SMIL clip, even when two intervals reference the same
    /// physical MP3 or the order jumps backwards within it. Older books with
    /// no reliable SMIL metadata continue using ordinary track playback.
    static func orderedClips(in directory: URL, packagePaths: [String],
                             audioPaths: [String]) -> [NativeDaisyAudioClip] {
        var clips: [NativeDaisyAudioClip] = []
        for smil in orderedSMILFiles(in: directory, packagePaths: packagePaths) {
            guard let data = try? Data(contentsOf: directory.appendingPathComponent(smil))
            else { continue }
            for source in smilSources(data) {
                guard let path = member(source.file, relativeTo: smil, in: audioPaths),
                      let track = audioPaths.firstIndex(of: path) else { continue }
                let begin = seconds(source.begin) ?? 0
                let end = seconds(source.end)
                guard end == nil || end! > begin else { continue }
                clips.append(.init(track: track, begin: begin, end: end))
            }
        }
        return clips
    }

    static func orderedAudioFiles(in directory: URL, packagePaths: [String],
                                  audioPaths: [String]) -> [String] {
        guard !audioPaths.isEmpty else { return [] }
        let smilFiles = packagePaths.filter { $0.lowercased().hasSuffix(".smil") }
        guard !smilFiles.isEmpty else { return audioPaths }

        let orderedSMIL = orderedSMILFiles(in: directory, packagePaths: packagePaths)

        var orderedAudio: [String] = []
        var seenAudio: Set<String> = []
        for smil in orderedSMIL {
            guard let data = try? Data(contentsOf: directory.appendingPathComponent(smil))
            else { continue }
            for source in smilSources(data) {
                guard let path = member(source.file, relativeTo: smil, in: audioPaths),
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
