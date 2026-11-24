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
    // IDs of the enclosing <seq>/<par>, and the <audio> itself. NCC/NCX
    // references can target any of these structural points.
    let ancestorIDs: [String]
}

private final class NativeDaisySMILAudioDelegate: NSObject, XMLParserDelegate {
    private(set) var sources: [NativeDaisySMILSource] = []
    private var elementIDs: [String?] = []

    func parser(_ parser: XMLParser, didStartElement elementName: String,
                namespaceURI: String?, qualifiedName qName: String?,
                attributes attributeDict: [String: String] = [:]) {
        let tag = elementName.split(separator: ":").last?.lowercased()
        func value(_ names: Set<String>) -> String? {
            attributeDict.first(where: {
                names.contains($0.key.split(separator: ":").last.map(String.init)?
                    .lowercased() ?? "")
            })?.value
        }
        elementIDs.append(value(["id"]))
        guard tag == "audio", let file = value(["src"]) else { return }
        sources.append(.init(file: file,
            begin: value(["clipbegin", "clip-begin"]),
            end: value(["clipend", "clip-end"]),
            ancestorIDs: elementIDs.compactMap { $0 }))
    }

    func parser(_ parser: XMLParser, didEndElement elementName: String,
                namespaceURI: String?, qualifiedName qName: String?) {
        if !elementIDs.isEmpty { elementIDs.removeLast() }
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

    /// Share the same archive-relative, ambiguity-safe member resolution
    /// with the reader's NCC/NCX navigation. Never select a track solely by
    /// basename when multiple chapters have identically named MP3 files.
    static func resolvedMember(_ reference: String, relativeTo base: String,
                               available: [String]) -> String? {
        member(reference, relativeTo: base, in: available)
    }

    /// Resolve NCC/NCX playback destinations using the same XML SMIL parser
    /// and path lookup as the ordered playback sequence. This also accepts
    /// anchors on <audio> (not only <seq> and <par>) and disambiguates files
    /// in sibling folders without relying on their common basename.
    static func navigationAudio(in directory: URL, smil: String,
                                fragment: String?, audioPaths: [String])
                                -> (track: Int, seconds: TimeInterval)? {
        guard let data = try? Data(contentsOf: directory.appendingPathComponent(smil))
        else { return nil }
        let items = smilSources(data)
        let requested = fragment?.removingPercentEncoding ?? fragment
        let source: NativeDaisySMILSource?
        if let requested, !requested.isEmpty {
            source = items.first(where: {
                $0.ancestorIDs.contains(where: {
                    $0.caseInsensitiveCompare(requested) == .orderedSame
                })
            })
        } else {
            source = items.first
        }
        guard let source,
              let audioPath = member(source.file, relativeTo: smil, in: audioPaths),
              let track = audioPaths.firstIndex(of: audioPath) else { return nil }
        return (track, seconds(source.begin) ?? 0)
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
                end: attribute("clipEnd", in: tag) ?? attribute("clip-end", in: tag),
                ancestorIDs: [])
        }
    }

    private static func seconds(_ clock: String?) -> TimeInterval? {
        guard let clock else { return nil }
        var value = clock.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if value.hasPrefix("npt=") { value.removeFirst(4) }
        if !value.contains(":") {
            for (suffix, multiplier) in [("min", 60.0), ("ms", 0.001), ("h", 3600.0), ("s", 1.0)] {
                if value.hasSuffix(suffix) {
                    guard let amount = Double(value.dropLast(suffix.count)), amount >= 0 else { return nil }
                    let seconds = amount * multiplier
                    return seconds.isFinite ? seconds : nil
                }
            }
        }
        let parts = value.split(separator: ":", omittingEmptySubsequences: false)
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

    private struct LocatedAudioSource {
        let smil: String
        let source: NativeDaisySMILSource
    }

    private struct NavigationAnchor {
        let smil: String
        let fragment: String?
    }

    /// NCC and NCX may point into DIFFERENT positions of the same SMIL file.
    /// Preserve the navigation document's link order, not the SMIL filename
    /// or the document's lexical order of <par> elements.
    private static func navigationAnchors(in directory: URL,
                                          packagePaths: [String]) -> [NavigationAnchor] {
        let smilFiles = packagePaths.filter { $0.lowercased().hasSuffix(".smil") }
        func resolve(_ href: String, base: String) -> NavigationAnchor? {
            guard let smil = member(href, relativeTo: base, in: smilFiles) else {
                return nil
            }
            let fragment = href.split(separator: "#", maxSplits: 1,
                                      omittingEmptySubsequences: false).dropFirst()
                .first.map(String.init)?.removingPercentEncoding
            return .init(smil: smil, fragment: fragment)
        }

        var ncc: [NavigationAnchor] = []
        for file in packagePaths.filter({ $0.lowercased().hasSuffix("ncc.html") }) {
            guard let text = try? String(contentsOf: directory.appendingPathComponent(file),
                                         encoding: .utf8) else { continue }
            for href in nccReferences(text) {
                if let anchor = resolve(href, base: file) { ncc.append(anchor) }
            }
        }
        // DAISY 2.02 uses NCC. DAISY 3 uses NCX; if both are present
        // prefer the book's NCC rather than play every chapter twice.
        if !ncc.isEmpty { return ncc }
        var ncx: [NavigationAnchor] = []
        for file in packagePaths.filter({ $0.lowercased().hasSuffix(".ncx") }) {
            guard let data = try? Data(contentsOf: directory.appendingPathComponent(file))
            else { continue }
            for link in NativeDaisyNCX.parse(data) {
                if let anchor = resolve(link.href, base: file) { ncx.append(anchor) }
            }
        }
        return ncx
    }

    /// Partition a SMIL into disjoint ranges at the referenced anchors.
    /// Reassemble those ranges in NCC/NCX order, then append unreferenced
    /// clips once. This handles links #chapter2, #chapter1 in one SMIL.
    /// A repeated physical file across two different intervals is preserved.
    private static func orderedSources(in directory: URL,
                                       packagePaths: [String],
                                       audioPaths: [String]) -> [LocatedAudioSource] {
        let smilFiles = orderedSMILFiles(in: directory, packagePaths: packagePaths)
        var sources: [String: [NativeDaisySMILSource]] = [:]
        for smil in smilFiles {
            guard let data = try? Data(contentsOf: directory.appendingPathComponent(smil))
            else { continue }
            sources[smil] = smilSources(data)
        }

        let anchors = navigationAnchors(in: directory, packagePaths: packagePaths)
        func startingIndex(for anchor: NavigationAnchor) -> Int? {
            guard let items = sources[anchor.smil], !items.isEmpty else { return nil }
            guard let fragment = anchor.fragment, !fragment.isEmpty else { return 0 }
            return items.firstIndex { item in
                item.ancestorIDs.contains {
                    $0.caseInsensitiveCompare(fragment) == .orderedSame
                }
            }
        }
        var boundaries: [String: Set<Int>] = [:]
        for anchor in anchors {
            guard let start = startingIndex(for: anchor) else { continue }
            boundaries[anchor.smil, default: []].insert(start)
        }

        var used: [String: Set<Int>] = [:]
        var ordered: [LocatedAudioSource] = []
        func append(_ smil: String, from start: Int, to end: Int) {
            guard let items = sources[smil], start >= 0,
                  end <= items.count, start < end else { return }
            for index in start..<end {
                guard used[smil, default: []].insert(index).inserted,
                      member(items[index].file, relativeTo: smil, in: audioPaths) != nil
                else { continue }
                ordered.append(.init(smil: smil, source: items[index]))
            }
        }
        for anchor in anchors {
            guard let start = startingIndex(for: anchor),
                  let items = sources[anchor.smil] else { continue }
            let finish = boundaries[anchor.smil]?
                .filter { $0 > start }.min() ?? items.count
            append(anchor.smil, from: start, to: finish)
        }

        // Do not discard navigation-free prologues or unindexed chapters.
        for smil in smilFiles {
            guard let items = sources[smil] else { continue }
            for index in items.indices {
                append(smil, from: index, to: index + 1)
            }
        }
        return ordered
    }

    /// Preserve every SMIL interval, even when several refer to the same MP3.
    /// The track index uses the stable list of physical audio files.
    static func orderedClips(in directory: URL, packagePaths: [String],
                             audioPaths: [String]) -> [NativeDaisyAudioClip] {
        var clips: [NativeDaisyAudioClip] = []
        for located in orderedSources(in: directory, packagePaths: packagePaths,
                                      audioPaths: audioPaths) {
            let source = located.source
            guard let path = member(source.file, relativeTo: located.smil, in: audioPaths),
                  let track = audioPaths.firstIndex(of: path) else { continue }
            let begin = seconds(source.begin) ?? 0
            let end = seconds(source.end)
            guard end == nil || end! > begin else { continue }
            clips.append(.init(track: track, begin: begin, end: end))
        }
        return clips
    }

    static func orderedAudioFiles(in directory: URL, packagePaths: [String],
                                  audioPaths: [String]) -> [String] {
        guard !audioPaths.isEmpty else { return [] }
        let smilFiles = packagePaths.filter { $0.lowercased().hasSuffix(".smil") }
        guard !smilFiles.isEmpty else { return audioPaths }

        var orderedAudio: [String] = []
        var seenAudio: Set<String> = []
        for located in orderedSources(in: directory, packagePaths: packagePaths,
                                      audioPaths: audioPaths) {
            guard let path = member(located.source.file, relativeTo: located.smil,
                                    in: audioPaths),
                  seenAudio.insert(path.lowercased()).inserted else { continue }
            orderedAudio.append(path)
        }
        // No physical track is thrown away, even if its SMIL is malformed.
        for path in audioPaths where seenAudio.insert(path.lowercased()).inserted {
            orderedAudio.append(path)
        }
        return orderedAudio
    }
}
