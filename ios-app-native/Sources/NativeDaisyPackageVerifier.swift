import Foundation
import ZIPFoundation

/// Checks DAISY ZIP files before exposing them to the share sheet.
/// Not a substitute for a DAISY Pipeline validation or external player test.
enum NativeDaisyPackageVerifier {
    enum Failure: LocalizedError {
        case invalid
        case invalidMP3Zip
        var errorDescription: String? {
            switch self {
            case .invalid: return "El DAISY generado tiene enlaces o archivos incompletos."
            case .invalidMP3Zip: return NSLocalizedString(
                "El ZIP de MP3 está incompleto o contiene pistas no válidas.", comment: "")
            }
        }
    }

    static func validateVoiceDreamMP3Zip(_ url: URL) throws {
        guard let archive = Archive(url: url, accessMode: .read) else {
            throw Failure.invalidMP3Zip
        }
        var filenames = Set<String>()
        var totalBytes: UInt64 = 0
        // The reader importer also caps expanded archives at 750 MB and 4,000 entries.
        // Validate each ZIP entry using bounded memory, including its compressed data.
        for entry in archive {
            try Task.checkCancellation()
            guard filenames.count < 4_000,
                  entry.type == .file,
                  entry.path.range(of: #"^[0-9]{4}\.mp3$"#, options: .regularExpression) != nil,
                  filenames.insert(entry.path).inserted,
                  entry.uncompressedSize > 100,
                  entry.uncompressedSize <= 750_000_000,
                  UInt64(entry.uncompressedSize) <= 750_000_000 - totalBytes else {
                throw Failure.invalidMP3Zip
            }
            totalBytes += UInt64(entry.uncompressedSize)
            var prefix = Data()
            _ = try archive.extract(entry) { part in
                let remaining = max(0, 262_144 - prefix.count)
                if remaining > 0 { prefix.append(contentsOf: part.prefix(remaining)) }
            }
            let header = Array(prefix)
            // A renamed WAV or an ID3-only file is not a playable MP3.
            // MPEG sync is a structural check; playback still needs a real device.
            guard !header.starts(with: Array("RIFF".utf8)),
                  zip(header, header.dropFirst()).contains(where: {
                      $0.0 == 0xff && ($0.1 & 0xe0) == 0xe0
                  }) else { throw Failure.invalidMP3Zip }
        }
        // ZIP entries need not be stored in lexical order. The numbered filenames,
        // not the ZIP's directory order, define Voice Dream's chapter sequence.
        let ordered = filenames.sorted()
        guard !ordered.isEmpty,
              ordered.enumerated().allSatisfy({
                  $0.element == String(format: "%04d.mp3", $0.offset + 1)
              }) else { throw Failure.invalidMP3Zip }
    }

    static func validate(_ url: URL) throws {
        guard let archive = Archive(url: url, accessMode: .read) else {
            throw Failure.invalid
        }
        var files: [String: Data] = [:]
        var entries: Set<String> = []
        var audioHeaders: [String: Data] = [:]
        var audioSizes: [String: UInt64] = [:]
        var totalSize: UInt64 = 0
        for entry in archive {
            let name = entry.path
            guard entry.type == .file,
                  !name.contains(".."), !name.hasPrefix("/"),
                  !entries.contains(name), entries.count < 2048,
                  entry.uncompressedSize < 512 * 1024 * 1024 else {
                throw Failure.invalid
            }
            totalSize += UInt64(entry.uncompressedSize)
            guard totalSize < 512 * 1024 * 1024 else { throw Failure.invalid }
            entries.insert(name)
            let isAudio = name.lowercased().hasSuffix(".mp3")
            // Las pistas se comprueban por cabecera; no se cargan enteras en RAM.
            var bytes = Data()
            _ = try archive.extract(entry) { part in
                if isAudio {
                    let remaining = max(0, 65_536 - bytes.count)
                    if remaining > 0 { bytes.append(contentsOf: part.prefix(remaining)) }
                } else {
                    bytes.append(part)
                }
            }
            if isAudio {
                audioHeaders[name] = bytes
                audioSizes[name] = UInt64(entry.uncompressedSize)
            } else {
                // Los archivos de metadatos nunca deberían ser enormes.
                guard bytes.count <= 8 * 1024 * 1024 else { throw Failure.invalid }
                files[name] = bytes
            }
        }

        let names = ["book.opf", "book.xml", "book.ncx", "sync.smil"]
        for filename in names {
            guard let data = files[filename], let xml = String(data: data, encoding: .utf8) else {
                throw Failure.invalid
            }
            let clean = xml.replacingOccurrences(
                of: #"(?is)<!DOCTYPE[^>]*>"#, with: "", options: .regularExpression)
            let parser = XMLParser(data: Data(clean.utf8))
            parser.shouldResolveExternalEntities = false
            guard parser.parse() else { throw Failure.invalid }
        }

        func attributes(_ file: String, element: String, attribute: String) -> [String] {
            guard let data = files[file], let xml = String(data: data, encoding: .utf8),
                  let expression = try? NSRegularExpression(
                    pattern: "<" + NSRegularExpression.escapedPattern(for: element) +
                    #"\b[^>]*\b"# + NSRegularExpression.escapedPattern(for: attribute) +
                    #"="([^"]+)""#) else { return [] }
            let range = NSRange(xml.startIndex..., in: xml)
            return expression.matches(in: xml, range: range).compactMap { match in
                guard let part = Range(match.range(at: 1), in: xml) else { return nil }
                return String(xml[part])
            }
        }

        let manifest = attributes("book.opf", element: "item", attribute: "href")
        guard !manifest.isEmpty && manifest.allSatisfy({ entries.contains($0) }) else {
            throw Failure.invalid
        }
        let smil = String(decoding: files["sync.smil"]!, as: UTF8.self)
        let book = String(decoding: files["book.xml"]!, as: UTF8.self)
        let ncxLinks = attributes("book.ncx", element: "content", attribute: "src")
        let textRefs = attributes("sync.smil", element: "text", attribute: "src")
        let audioRefs = attributes("sync.smil", element: "audio", attribute: "src")
        let clipEnds = attributes("sync.smil", element: "audio", attribute: "clipEnd")
        let clipBegins = attributes("sync.smil", element: "audio", attribute: "clipBegin")
        guard !ncxLinks.isEmpty, !textRefs.isEmpty,
              textRefs.count == audioRefs.count,
              audioRefs.count == clipEnds.count,
              audioRefs.count == clipBegins.count,
              Set(audioRefs).count == audioRefs.count,
              Set(textRefs).count == textRefs.count,
              audioRefs.allSatisfy({ manifest.contains($0) }) else {
            throw Failure.invalid
        }
        for link in ncxLinks {
            let parts = link.split(separator: "#")
            guard parts.count == 2, parts[0] == "sync.smil",
                  smil.contains("id=\"\(parts[1])\"") else { throw Failure.invalid }
        }
        for link in textRefs {
            let parts = link.split(separator: "#")
            guard parts.count == 2, parts[0] == "book.xml",
                  book.contains("id=\"\(parts[1])\"") else { throw Failure.invalid }
        }
        for file in audioRefs {
            guard file.lowercased().hasSuffix(".mp3"),
                  let bytes = audioHeaders[file], let size = audioSizes[file],
                  size > 100 else { throw Failure.invalid }
            // Reject WAV renamed to MP3; look for actual MPEG frame sync.
            let header = Array(bytes)
            guard !header.starts(with: Array("RIFF".utf8)),
                  zip(header, header.dropFirst()).contains(where: {
                      $0.0 == 0xff && ($0.1 & 0xe0) == 0xe0
                  }) else { throw Failure.invalid }
        }
        // Tiempos por pista: inicio en cero y final estrictamente positivo.
        // Evita elementos sincronizados sin duración o con marcas inválidas.
        let clockPattern = try NSRegularExpression(pattern: #"^\d{2}:\d{2}:\d{2}\.\d{3}$"#)
        func seconds(_ value: String) -> Double? {
            let range = NSRange(value.startIndex..., in: value)
            guard clockPattern.firstMatch(in: value, range: range) != nil else { return nil }
            let parts = value.split(separator: ":")
            guard parts.count == 3,
                  let hours = Double(parts[0]),
                  let minutes = Double(parts[1]),
                  let remainder = Double(parts[2]),
                  minutes < 60, remainder < 60 else { return nil }
            return hours * 3600 + minutes * 60 + remainder
        }
        for (start, end) in zip(clipBegins, clipEnds) {
            guard let beginning = seconds(start), let finish = seconds(end),
                  beginning >= 0, finish > beginning else {
                throw Failure.invalid
            }
        }
    }

    /// Validate the audio-only DAISY 2.02 profile independently of DAISY 3.
    /// Both the NCC and every SMIL audio reference must resolve within the ZIP.
    static func validateAudioOnly202(_ url: URL) throws {
        guard let archive = Archive(url: url, accessMode: .read) else {
            throw Failure.invalid
        }
        var files: [String: Data] = [:]
        var audioHeaders: [String: Data] = [:]
        var audioSizes: [String: UInt64] = [:]
        var entries: Set<String> = []
        var totalSize: UInt64 = 0
        for entry in archive {
            let name = entry.path
            guard entry.type == .file, !name.contains(".."), !name.contains("/"),
                  !entries.contains(name), entries.count < 2048,
                  entry.uncompressedSize < 512 * 1024 * 1024 else {
                throw Failure.invalid
            }
            entries.insert(name)
            totalSize += UInt64(entry.uncompressedSize)
            guard totalSize < 512 * 1024 * 1024 else { throw Failure.invalid }
            let isAudio = name.lowercased().hasSuffix(".mp3")
            guard isAudio || ["ncc.html", "audio.smil"].contains(name) else {
                throw Failure.invalid
            }
            var bytes = Data()
            _ = try archive.extract(entry) { part in
                if isAudio {
                    let remaining = max(0, 65_536 - bytes.count)
                    if remaining > 0 { bytes.append(contentsOf: part.prefix(remaining)) }
                } else {
                    bytes.append(part)
                }
            }
            if isAudio {
                audioHeaders[name] = bytes
                audioSizes[name] = UInt64(entry.uncompressedSize)
            } else {
                guard bytes.count < 8 * 1024 * 1024 else { throw Failure.invalid }
                files[name] = bytes
            }
        }
        guard let nccData = files["ncc.html"], let smilData = files["audio.smil"],
              let ncc = String(data: nccData, encoding: .utf8),
              let smil = String(data: smilData, encoding: .utf8),
              !audioHeaders.isEmpty, !entries.contains("book.xml"),
              ncc.contains("name=\"dc:format\" content=\"Daisy 2.02\""),
              ncc.contains("name=\"ncc:multimediaType\" content=\"audioNCC\""),
              smil.contains("name=\"dc:format\" content=\"Daisy 2.02\"") else {
            throw Failure.invalid
        }

        for xml in [ncc, smil] {
            let clean = xml.replacingOccurrences(
                of: #"(?is)<!DOCTYPE[^>]*>"#, with: "", options: .regularExpression)
            let parser = XMLParser(data: Data(clean.utf8))
            parser.shouldResolveExternalEntities = false
            guard parser.parse() else { throw Failure.invalid }
        }

        func captures(_ source: String, pattern: String) -> [String] {
            guard let regex = try? NSRegularExpression(pattern: pattern) else { return [] }
            let range = NSRange(source.startIndex..., in: source)
            return regex.matches(in: source, range: range).compactMap { match in
                guard let captured = Range(match.range(at: 1), in: source) else { return nil }
                return String(source[captured])
            }
        }
        let chapterIDs = captures(ncc, pattern: #"<a\b[^>]*href="audio\.smil#([^"]+)""#)
        let navigationIDs = captures(ncc, pattern: #"<(?:h1|h2)\b[^>]*id="([^"]+)""#)
        let parBlocks = captures(smil, pattern: #"(?s)(<par\b[^>]*>.*?</par>)"#)
        let parIDs = captures(smil, pattern: #"<par\b[^>]*id="([^"]+)""#)
        let smilTextIDs = captures(smil, pattern: #"<text\b[^>]*src="ncc\.html#([^"]+)""#)
        let audioRefs = captures(smil, pattern: #"<audio\b[^>]*src="([^"]+)""#)
        let audioBegins = captures(smil, pattern: #"<audio\b[^>]*clip-begin="npt=([0-9]+(?:\.[0-9]+)?)s""#)
        let audioEnds = captures(smil, pattern: #"<audio\b[^>]*clip-end="npt=([0-9]+(?:\.[0-9]+)?)s""#)
        let nccFileCount = captures(ncc, pattern:
            #"<meta\b[^>]*name="ncc:files"[^>]*content="([0-9]+)""#)
        let nccChapterCount = captures(ncc, pattern:
            #"<meta\b[^>]*name="ncc:tocItems"[^>]*content="([0-9]+)""#)
        let chapterStarts = chapterIDs.compactMap { parIDs.firstIndex(of: $0) }
        guard !chapterIDs.isEmpty,
              chapterIDs.count == navigationIDs.count,
              Set(chapterIDs).count == chapterIDs.count,
              Set(navigationIDs).count == navigationIDs.count,
              chapterStarts.count == chapterIDs.count,
              chapterStarts.first == 0,
              chapterStarts == chapterStarts.sorted(),
              !audioRefs.isEmpty,
              parBlocks.count == audioRefs.count,
              parIDs.count == audioRefs.count,
              Set(parIDs).count == parIDs.count,
              smilTextIDs.count == audioRefs.count,
              audioRefs.count == audioBegins.count,
              audioRefs.count == audioEnds.count,
              Set(audioRefs).count == audioRefs.count,
              Set(audioRefs) == Set(audioHeaders.keys),
              nccFileCount.first.flatMap(Int.init) == entries.count,
              nccChapterCount.first.flatMap(Int.init) == chapterIDs.count,
              chapterIDs.allSatisfy({ smil.contains("id=\"\($0)\"") }),
              smilTextIDs.allSatisfy({ navigationIDs.contains($0) }),
              audioBegins.allSatisfy({ (Double($0) ?? -1) == 0 }),
              audioEnds.allSatisfy({ (Double($0) ?? 0) > 0 }) else {
            throw Failure.invalid
        }
        // Every SMIL <par> must point to exactly one NCC heading and one
        // recorded MP3, and its heading must match the enclosing chapter.
        // A manifest with plausible counts but incorrect links is rejected.
        for index in parBlocks.indices {
            let block = parBlocks[index]
            let section = chapterStarts.lastIndex(where: { $0 <= index })
            guard let section,
                  captures(block, pattern:
                    #"<text\b[^>]*src="ncc\.html#([^"]+)""#) == [navigationIDs[section]],
                  captures(block, pattern: #"<audio\b[^>]*src="([^"]+)""#).count == 1,
                  block.contains("endsync=\"last\"") else {
                throw Failure.invalid
            }
        }
        for filename in audioRefs {
            guard let header = audioHeaders[filename], let size = audioSizes[filename],
                  filename.lowercased().hasSuffix(".mp3"), size > 100 else {
                throw Failure.invalid
            }
            let bytes = Array(header)
            guard !bytes.starts(with: Array("RIFF".utf8)),
                  zip(bytes, bytes.dropFirst()).contains(where: {
                      $0.0 == 0xff && ($0.1 & 0xe0) == 0xe0
                  }) else { throw Failure.invalid }
        }
    }
}
