import Foundation

/// Runs the actual DAISY 2.02 XML layout from the app, not a copied template.
@main
struct Daisy202LayoutSmoke {
    static func main() throws {
        let chapters = [
            NativeDaisy202AudioLayout.Chapter(
                title: "Capítulo & Prólogo",
                clips: [.init(file: "audio0001.mp3", duration: 9.25),
                        .init(file: "audio0002.mp3", duration: 2.5)]),
            NativeDaisy202AudioLayout.Chapter(
                title: "Capítulo 2: Final",
                clips: [.init(file: "audio0003.mp3", duration: 5.125)])
        ]
        guard let package = NativeDaisy202AudioLayout.render(
            title: "Novela <Íntegra>\u{0}", identifier: "urn:uuid:123",
            language: "es", chapters: chapters, date: "2026-11-23")
        else { fatalError("Layout returned no DAISY documents") }
        precondition(package.files == [
            "audio0001.mp3", "audio0002.mp3", "audio0003.mp3"
        ], "DAISY 2.02 MP3 sequence changed")

        for xml in [package.ncc, package.smil] {
            let clean = xml.replacingOccurrences(
                of: #"(?is)<!DOCTYPE[^>]*>"#, with: "", options: .regularExpression)
            let parser = XMLParser(data: Data(clean.utf8))
            parser.shouldResolveExternalEntities = false
            precondition(parser.parse(), "DAISY 2.02 XML malformed: " +
                         (parser.parserError?.localizedDescription ?? "unknown"))
        }
        precondition(!package.ncc.contains("\u{0}"), "Invalid XML control character preserved")
        precondition(package.ncc.contains("Novela &lt;Íntegra&gt;"),
                     "XML-escaped title lost")
        precondition(package.ncc.contains("Capítulo &amp; Prólogo"),
                     "Real chapter title lost")
        precondition(package.ncc.contains("audio.smil#section1") &&
                     package.ncc.contains("audio.smil#section2"),
                     "NCC does not point to SMIL section starts")
        precondition(package.ncc.contains("name=\"ncc:multimediaType\" content=\"audioNCC\""),
                     "The package is not audio-only")
        precondition(package.ncc.contains("name=\"ncc:tocItems\" content=\"2\""),
                     "Incorrect chapter count")
        precondition(package.ncc.contains("name=\"ncc:files\" content=\"5\""),
                     "Incorrect ZIP member count")
        precondition(package.ncc.contains("name=\"ncc:totalTime\" content=\"00:00:17\""),
                     "Incorrect rounded reading duration")
        precondition(package.smil.contains("<seq id=\"narration\" dur=\"16.875s\">"),
                     "Incorrect sum of real clip durations")

        func captures(_ text: String, _ pattern: String) -> [String] {
            let ns = text as NSString
            let regex = try! NSRegularExpression(pattern: pattern)
            return regex.matches(in: text, range: NSRange(location: 0, length: ns.length))
                .map { ns.substring(with: $0.range(at: 1)) }
        }
        let blocks = captures(package.smil, #"(?s)(<par\b[^>]*>.*?</par>)"#)
        precondition(blocks.count == 3, "DAISY 2.02 must use one par per MP3 clip")
        let ids = captures(package.smil, #"<par\b[^>]*id="([^"]+)""#)
        precondition(ids == ["section1", "clip2", "section2"],
                     "SMIL chapter starting points were not preserved: \(ids)")
        for (index, block) in blocks.enumerated() {
            let ref = index < 2 ? "ncc.html#nav1" : "ncc.html#nav2"
            precondition(block.contains(ref), "A clip is attached to the wrong chapter")
            precondition(block.contains("endsync=\"last\""), "Missing SMIL par synchronization")
            precondition(captures(block, #"<audio\b[^>]*src="([^"]+)""#).count == 1,
                         "A par must contain exactly one recorded audio clip")
            precondition(captures(block, #"<text\b[^>]*src="([^"]+)""#).count == 1,
                         "A par must contain exactly one NCC text anchor")
        }

        let single = NativeDaisy202AudioLayout.render(
            title: "Una pista", identifier: "urn:uuid:single", language: "en",
            chapters: [.init(title: "Sección única",
                clips: [.init(file: "audio0001.mp3", duration: 1.25)])],
            date: "2026-11-23")
        precondition(single?.smil.contains("id=\"section1\"") == true &&
                     single?.smil.contains("ncc.html#nav1") == true &&
                     single?.ncc.contains("name=\"ncc:files\" content=\"3\"") == true,
                     "Single-track DAISY has missing navigation")

        let unsafe = NativeDaisy202AudioLayout.render(
            title: "No válido", identifier: "urn:uuid:unsafe", language: "es",
            chapters: [.init(title: "Capítulo", clips: [
                .init(file: "../audio.mp3", duration: 2)])], date: "2026-11-23")
        precondition(unsafe == nil, "The layout accepted an unsafe file path")
        let duplicate = NativeDaisy202AudioLayout.render(
            title: "Duplicado", identifier: "urn:uuid:dup", language: "es",
            chapters: [.init(title: "Capítulo", clips: [
                .init(file: "audio.mp3", duration: 2),
                .init(file: "audio.mp3", duration: 3)])], date: "2026-11-23")
        precondition(duplicate == nil, "Duplicate ZIP member paths accepted")
        print("DAISY 2.02 XML layout: multi-chapter, single-track and unsafe cases passed.")
    }
}
