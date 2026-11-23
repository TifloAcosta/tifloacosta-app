import Foundation

/// Executable integration smoke test for the same Swift ordering code built
/// into the iOS app. It runs on the macOS GitHub Actions host, without an iPhone.
@main
struct DaisyAudioOrderSmoke {
    static func main() throws {
        let fileManager = FileManager.default
        let root = fileManager.temporaryDirectory
            .appendingPathComponent("DaisyOrderTest-" + UUID().uuidString, isDirectory: true)
        try fileManager.createDirectory(at: root, withIntermediateDirectories: true)
        defer { try? fileManager.removeItem(at: root) }

        func write(_ relative: String, _ content: String) throws {
            let url = root.appendingPathComponent(relative)
            try fileManager.createDirectory(at: url.deletingLastPathComponent(),
                                            withIntermediateDirectories: true)
            try Data(content.utf8).write(to: url)
        }

        // These names sort alphabetically in the OPPOSITE order to the NCC.
        // Each file must be copied once, even if SMIL references it twice.
        try write("ncc.html", """
        <html><body>
          <h1><a href="chapters/first.smil#p1">Primero</a></h1>
          <h1><a href="chapters/second.smil#p2">Segundo</a></h1>
        </body></html>
        """)
        try write("chapters/first.smil", """
        <smil><body><seq><par id="p1">
          <audio src="../audio/z-first.mp3" clipBegin="npt=0:00:00.000"/>
          <audio src="../audio/z-first.mp3" clipBegin="npt=0:01:00.000"/>
        </par></seq></body></smil>
        """)
        try write("chapters/second.smil", """
        <smil><body><seq><par id="p2">
          <audio src="../audio/a-second.mp3"/>
        </par></seq></body></smil>
        """)
        let files = ["ncc.html", "chapters/second.smil", "chapters/first.smil",
                     "audio/a-second.mp3", "audio/unused.mp3", "audio/z-first.mp3"]
        let audio = ["audio/a-second.mp3", "audio/unused.mp3", "audio/z-first.mp3"]
        let actual = NativeDaisyAudioOrder.orderedAudioFiles(
            in: root, packagePaths: files, audioPaths: audio)
        precondition(actual == ["audio/z-first.mp3", "audio/a-second.mp3",
                                "audio/unused.mp3"], "NCC+SMIL order incorrect: \(actual)")

        // NCX navigation in DAISY 3 takes precedence when there is no NCC.
        let ncxRoot = root.appendingPathComponent("daisy3", isDirectory: true)
        try fileManager.createDirectory(at: ncxRoot, withIntermediateDirectories: true)
        try write("daisy3/book.ncx", """
        <ncx><navMap>
          <navPoint id="a"><navLabel><text>Primero</text></navLabel>
             <content src="segments/z-first.smil#one"/></navPoint>
          <navPoint id="b"><navLabel><text>Segundo</text></navLabel>
             <content src="segments/a-second.smil#two"/></navPoint>
        </navMap></ncx>
        """)
        try write("daisy3/segments/z-first.smil",
                  "<smil><body><par id='one'><audio src='../tracks/z.mp3'/></par></body></smil>")
        try write("daisy3/segments/a-second.smil",
                  "<smil><body><par id='two'><audio src='../tracks/a.mp3'/></par></body></smil>")
        let d3 = NativeDaisyAudioOrder.orderedAudioFiles(
            in: ncxRoot,
            packagePaths: ["book.ncx", "segments/a-second.smil", "segments/z-first.smil",
                           "tracks/a.mp3", "tracks/z.mp3"],
            audioPaths: ["tracks/a.mp3", "tracks/z.mp3"])
        precondition(d3 == ["tracks/z.mp3", "tracks/a.mp3"],
                     "NCX order incorrect: \(d3)")

        // An ordinary archive without SMIL retains its original natural order.
        let plain = NativeDaisyAudioOrder.orderedAudioFiles(
            in: root, packagePaths: audio, audioPaths: audio)
        precondition(plain == audio, "Non-DAISY audio order changed")

        // Ambiguous basenames may never silently select one of two tracks.
        try write("chapters/ambiguous.smil",
                  "<smil><audio src='same.mp3'/></smil>")
        let ambiguousAudio = ["left/same.mp3", "right/same.mp3"]
        let ambiguous = NativeDaisyAudioOrder.orderedAudioFiles(
            in: root, packagePaths: ["chapters/ambiguous.smil"] + ambiguousAudio,
            audioPaths: ambiguousAudio)
        precondition(ambiguous == ambiguousAudio,
                     "Ambiguous audio filename was incorrectly resolved")

        print("DAISY NCC/NCX/SMIL audio order: four end-to-end Swift checks passed.")
    }
}
