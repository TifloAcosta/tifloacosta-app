import Foundation
import ZIPFoundation

/// DAISY 3 audio + full text with paragraph-level SMIL alignment.
/// Each audio clip is one actual generated segment, never a fabricated timestamp.
enum NativeGeminiDaisyExport {
    static func escape(_ value: String) -> String {
        value.replacingOccurrences(of: "&", with: "&amp;")
            .replacingOccurrences(of: "<", with: "&lt;")
            .replacingOccurrences(of: ">", with: "&gt;")
            .replacingOccurrences(of: "\"", with: "&quot;")
            .replacingOccurrences(of: "'", with: "&apos;")
    }

    static func clock(_ seconds: Double) -> String {
        let hours = Int(seconds) / 3600
        let minutes = (Int(seconds) / 60) % 60
        let remaining = seconds - Double(hours * 3600 + minutes * 60)
        return String(format: "%02d:%02d:%06.3f", hours, minutes, remaining)
    }


    struct TextUnit {
        let text: String
        let heading: String?
    }

    /// Only explicit heading lines qualify. Preserve every original character.
    /// Split headings into separate spoken units so NCX points to an exact SMIL par.
    static func units(_ text: String) throws -> [TextUnit] {
        _ = try NativeGeminiAudioExport.chunks(text) // Global length/empty checks
        let pattern = #"^(?:#{1,6}[ \t]+|(?i:capítulo|capitulo|sección|seccion)[ \t]+[0-9IVXLCDM]+(?:[.: -]|$))"#
        var result: [TextUnit] = []
        let lines = text.components(separatedBy: "\n")
        for (index, line) in lines.enumerated() {
            let suffix = index == lines.count - 1 ? "" : "\n"
            let unit = line + suffix
            let recognized = line.trimmingCharacters(in: .whitespaces)
                .range(of: pattern, options: .regularExpression) != nil
            if recognized && !line.trimmingCharacters(in: .whitespaces).isEmpty &&
                unit.count <= NativeGeminiAudioExport.chunkSize {
                result.append(TextUnit(text: unit,
                           heading: line.trimmingCharacters(in: .whitespaces)))
            } else if !unit.isEmpty {
                // Group ordinary lines into <=1,200-character text units.
                if !result.isEmpty && result[result.count - 1].heading == nil &&
                    result[result.count - 1].text.count + unit.count <= NativeGeminiAudioExport.chunkSize {
                    let previous = result.removeLast()
                    result.append(TextUnit(text: previous.text + unit, heading: nil))
                } else if unit.count <= NativeGeminiAudioExport.chunkSize {
                    result.append(TextUnit(text: unit, heading: nil))
                } else {
                    for chunk in try NativeGeminiAudioExport.chunks(unit) {
                        result.append(TextUnit(text: chunk, heading: nil))
                    }
                }
            }
        }
        return result
    }

    static func generate(text: String, title: String, voice: String,
                         progress: @escaping @MainActor (Int, Int) -> Void) async throws -> URL {
        let segments = try units(text)
        let uuid = UUID().uuidString
        let working = FileManager.default.temporaryDirectory
            .appendingPathComponent("TifloDaisy-" + uuid, isDirectory: true)
        try FileManager.default.createDirectory(at: working, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: working) }
        let identifier = "urn:uuid:" + uuid
        var paragraphs: [String] = []
        var pars: [String] = []
        var manifest: [String] = []
        var totalSeconds = 0.0
        var headingPoints: [(title: String, par: String)] = []
        var firstPar = ""
        var sectionOpen = false

        for (index, segment) in segments.enumerated() {
            try Task.checkCancellation()
            let number = index + 1
            let id = "t\(number)"
            let par = "par\(number)"
            let file = "audio\(String(format: "%04d", number)).wav"
            let spoken = segment.text.trimmingCharacters(in: .whitespacesAndNewlines)
            // Every text unit must have its own corresponding spoken clip.
            if spoken.isEmpty {
                // Preserve non-spoken whitespace in the full-text DTBook.
                paragraphs.append("<p>\(escape(segment.text))</p>")
                await progress(number, segments.count)
                continue
            }
            if firstPar.isEmpty { firstPar = par }
            if let heading = segment.heading { headingPoints.append((heading, par)) }
            let bytes = try await NativeGeminiSpeech.generate(spoken, voice: voice)
            let pcm = try NativeGeminiAudioExport.pcm(bytes)
            let duration = Double(pcm.count) / 48000.0 // mono 16-bit PCM at 24 kHz
            guard duration > 0 else { throw NativeGeminiAudioExport.ExportError.empty }
            try bytes.write(to: working.appendingPathComponent(file), options: .atomic)
            if segment.heading != nil {
                if sectionOpen { paragraphs.append("</level2>") }
                paragraphs.append("<level2><h2 id=\"\(id)\" smilref=\"sync.smil#\(par)\">\(escape(segment.text))</h2>")
                sectionOpen = true
            } else {
                paragraphs.append("<p id=\"\(id)\" smilref=\"sync.smil#\(par)\">\(escape(segment.text))</p>")
            }
            pars.append("<par id=\"\(par)\"><text src=\"book.xml#\(id)\"/><audio src=\"\(file)\" clipBegin=\"00:00:00\" clipEnd=\"\(clock(duration))\"/></par>")
            manifest.append("<item id=\"audio\(number)\" href=\"\(file)\" media-type=\"audio/x-wav\"/>")
            totalSeconds += duration
            await progress(number, segments.count)
        }
        if sectionOpen { paragraphs.append("</level2>") }
        try Task.checkCancellation()
        guard !pars.isEmpty else { throw NativeGeminiAudioExport.ExportError.empty }

        let safeTitle = escape(title)
        let dtbook = """
        <?xml version="1.0" encoding="utf-8"?>
        <!DOCTYPE dtbook PUBLIC "-//NISO//DTD dtbook 2005-1//EN" "http://www.daisy.org/z3986/2005/dtbook-2005-1.dtd">
        <dtbook xmlns="http://www.daisy.org/z3986/2005/dtbook/" version="2005-1" xml:lang="es">
          <head><meta name="dc:Identifier" content="\(identifier)"/><meta name="dc:Title" content="\(safeTitle)"/></head>
          <book><frontmatter><doctitle>\(safeTitle)</doctitle></frontmatter>
          <bodymatter><level1><h1>\(safeTitle)</h1>
          \(paragraphs.joined(separator: "\n"))
          </level1></bodymatter></book>
        </dtbook>
        """
        let smil = """
        <?xml version="1.0" encoding="utf-8"?>
        <!DOCTYPE smil PUBLIC "-//NISO//DTD dtbsmil 2005-1//EN" "http://www.daisy.org/z3986/2005/dtbsmil-2005-1.dtd">
        <smil xmlns="http://www.w3.org/2001/SMIL20/" version="2005-1">
          <head><meta name="dc:format" content="ANSI/NISO Z39.86-2005"/></head>
          <body><seq id="seq1">\(pars.joined(separator: "\n"))</seq></body>
        </smil>
        """
        let headingNav = headingPoints.enumerated().map { index, point in
            """
            <navPoint id="chapter\(index + 1)" class="h2" playOrder="\(index + 2)">
              <navLabel><text>\(escape(point.title))</text></navLabel>
              <content src="sync.smil#\(point.par)"/>
            </navPoint>
            """
        }.joined(separator: "\n")
        let ncx = """
        <?xml version="1.0" encoding="utf-8"?>
        <!DOCTYPE ncx PUBLIC "-//NISO//DTD ncx 2005-1//EN" "http://www.daisy.org/z3986/2005/ncx-2005-1.dtd">
        <ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1" xml:lang="es">
        <head><meta name="dtb:uid" content="\(identifier)"/>
        <meta name="dtb:depth" content="\(headingPoints.isEmpty ? 1 : 2)"/>
        <meta name="dtb:totalPageCount" content="0"/>
        <meta name="dtb:maxPageNumber" content="0"/>
        <meta name="dtb:totalTime" content="\(clock(totalSeconds))"/></head>
        <docTitle><text>\(safeTitle)</text></docTitle>
        <navMap><navPoint id="nav1" class="h1" playOrder="1">
        <navLabel><text>\(safeTitle)</text></navLabel>
        <content src="sync.smil#\(firstPar)"/>
        \(headingNav)
        </navPoint></navMap></ncx>
        """
        let opf = """
        <?xml version="1.0" encoding="utf-8"?>
        <!DOCTYPE package PUBLIC "+//ISBN 0-9673008-1-9//DTD OEB 1.2 Package//EN" "http://openebook.org/dtds/oeb-1.2/oebpkg12.dtd">
        <package xmlns="http://openebook.org/namespaces/oeb-package/1.0/" unique-identifier="bookid">
          <metadata><dc-metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
          <dc:Identifier id="bookid">\(identifier)</dc:Identifier>
          <dc:Title>\(safeTitle)</dc:Title><dc:Language>es</dc:Language>
          <dc:Format>ANSI/NISO Z39.86-2005</dc:Format></dc-metadata>
          <x-metadata><meta name="dtb:multimediaType" content="audioFullText"/>
          <meta name="dtb:multimediaContent" content="audio,text"/>
          <meta name="dtb:totalTime" content="\(clock(totalSeconds))"/></x-metadata></metadata>
          <manifest>
          <item id="opf" href="book.opf" media-type="text/xml"/>
          <item id="ncx" href="book.ncx" media-type="application/x-dtbncx+xml"/>
          <item id="text" href="book.xml" media-type="application/x-dtbook+xml"/>
          <item id="sync" href="sync.smil" media-type="application/smil"/>
          \(manifest.joined(separator: "\n"))
          </manifest><spine toc="ncx"><itemref idref="sync"/></spine>
        </package>
        """
        let contents = ["book.xml": dtbook, "sync.smil": smil,
                        "book.ncx": ncx, "book.opf": opf]
        for (name, body) in contents {
            try body.write(to: working.appendingPathComponent(name),
                           atomically: true, encoding: .utf8)
        }
        let output = FileManager.default.temporaryDirectory
            .appendingPathComponent("TifloLector-\(uuid).zip")
        guard let archive = Archive(url: output, accessMode: .create) else {
            throw NativeGeminiAudioExport.ExportError.unsupportedFormat
        }
        for filename in contents.keys.sorted() {
            try archive.addEntry(with: filename, relativeTo: working, compressionMethod: .deflate)
        }
        for index in 1...segments.count {
            let filename = "audio\(String(format: "%04d", index)).wav"
            let source = working.appendingPathComponent(filename)
            if FileManager.default.fileExists(atPath: source.path) {
                try archive.addEntry(with: filename, relativeTo: working, compressionMethod: .deflate)
            }
        }
        return output
    }
}
