import Foundation
import ZIPFoundation

/// Checks DAISY ZIP files before exposing them to the share sheet.
/// Not a substitute for a DAISY Pipeline validation or external player test.
enum NativeDaisyPackageVerifier {
    enum Failure: LocalizedError {
        case invalid
        var errorDescription: String? { "El DAISY generado tiene enlaces o archivos incompletos." }
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
}
