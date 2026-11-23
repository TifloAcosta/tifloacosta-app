import Foundation

/// Produces the NCC and SMIL 1.0 documents of a DAISY 2.02 audioNCC book.
/// Each recorded MP3 clip is its own <par> so chapter navigation points to
/// an unambiguous start, even in readers that do not support nested <seq>.
enum NativeDaisy202AudioLayout {
    struct Clip {
        let file: String
        let duration: TimeInterval
    }
    struct Chapter {
        let title: String
        let clips: [Clip]
    }
    struct Documents {
        let ncc: String
        let smil: String
        let files: [String]
    }

    private static func xml(_ value: String) -> String {
        value.replacingOccurrences(of: "&", with: "&amp;")
            .replacingOccurrences(of: "<", with: "&lt;")
            .replacingOccurrences(of: ">", with: "&gt;")
            .replacingOccurrences(of: "\"", with: "&quot;")
            .replacingOccurrences(of: "'", with: "&apos;")
    }

    static func render(title: String, identifier: String, language: String,
                       chapters: [Chapter], date: String) -> Documents? {
        let chapters = chapters.filter { !$0.clips.isEmpty }
        let clips = chapters.flatMap(\.clips)
        guard !chapters.isEmpty, !clips.isEmpty,
              clips.allSatisfy({ $0.duration.isFinite && $0.duration > 0 &&
                  !$0.file.isEmpty && !$0.file.contains("/") &&
                  !$0.file.contains("\\") && !$0.file.contains("..") }),
              Set(clips.map(\.file)).count == clips.count else { return nil }
        let supported: Set<String> = ["es", "en", "pt", "fr", "de", "it"]
        let lang = supported.contains(language) ? language : "es"
        let totalSeconds = clips.reduce(0.0) { $0 + $1.duration }
        guard totalSeconds.isFinite, totalSeconds > 0,
              totalSeconds < Double(Int.max / 2) else { return nil }
        let fixedLocale = Locale(identifier: "en_US_POSIX")
        func duration(_ seconds: Double) -> String {
            String(format: "%.3fs", locale: fixedLocale, seconds)
        }
        let rounded = Int(ceil(totalSeconds))
        let whole = String(format: "%02d:%02d:%02d",
                           rounded / 3600, (rounded / 60) % 60, rounded % 60)
        let titleXML = xml(title)
        let nav = chapters.enumerated().map { chapter, item in
            let tag = chapter == 0 ? "h1" : "h2"
            return "<\(tag) id=\"nav\(chapter + 1)\"><a href=\"audio.smil#section\(chapter + 1)\">\(xml(item.title))</a></\(tag)>"
        }.joined(separator: "\n")
        let ncc = """
        <?xml version="1.0" encoding="utf-8"?>
        <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
        <html xmlns="http://www.w3.org/1999/xhtml" xml:lang="\(lang)" lang="\(lang)">
          <head>
            <title>\(titleXML)</title>
            <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
            <meta name="dc:identifier" content="\(xml(identifier))" />
            <meta name="dc:title" content="\(titleXML)" />
            <meta name="dc:date" content="\(xml(date))" />
            <meta name="dc:language" content="\(lang)" />
            <meta name="dc:format" content="Daisy 2.02" />
            <meta name="ncc:charset" content="utf-8" />
            <meta name="ncc:generator" content="TifloLector" />
            <meta name="ncc:multimediaType" content="audioNCC" />
            <meta name="ncc:depth" content="\(chapters.count == 1 ? 1 : 2)" />
            <meta name="ncc:tocItems" content="\(chapters.count)" />
            <meta name="ncc:pageNormal" content="0" />
            <meta name="ncc:pageFront" content="0" />
            <meta name="ncc:pageSpecial" content="0" />
            <meta name="ncc:totalTime" content="\(whole)" scheme="hh:mm:ss" />
            <meta name="ncc:files" content="\(2 + clips.count)" />
          </head>
          <body>
            \(nav)
          </body>
        </html>
        """

        var counter = 0
        var units: [String] = []
        for (chapter, item) in chapters.enumerated() {
            for (index, clip) in item.clips.enumerated() {
                counter += 1
                let id = index == 0 ? "section\(chapter + 1)" : "clip\(counter)"
                // DAISY 2.02 SMIL 1.0: one text and one audio per <par>,
                // with each <par> a direct child of the main <seq>.
                units.append("""
                    <par id="\(id)" endsync="last">
                      <text id="text\(counter)" src="ncc.html#nav\(chapter + 1)" />
                      <audio id="audio\(counter)" src="\(xml(clip.file))" clip-begin="npt=0.000s" clip-end="npt=\(duration(clip.duration))" />
                    </par>
                    """)
            }
        }
        let smil = """
        <?xml version="1.0" encoding="utf-8"?>
        <!DOCTYPE smil PUBLIC "-//W3C//DTD SMIL 1.0//EN" "http://www.w3.org/TR/REC-SMIL/SMIL10.dtd">
        <smil>
          <head>
            <meta name="dc:identifier" content="\(xml(identifier))" />
            <meta name="dc:format" content="Daisy 2.02" />
            <meta name="ncc:timeInThisSmil" content="\(whole)" />
          </head>
          <body>
            <seq id="narration" dur="\(duration(totalSeconds))">
              \(units.joined(separator: "\n"))
            </seq>
          </body>
        </smil>
        """
        return Documents(ncc: ncc, smil: smil, files: clips.map(\.file))
    }
}
