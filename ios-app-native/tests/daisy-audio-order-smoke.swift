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
          <audio src="../audio/z-first.mp3" clipBegin="npt=0:00:00.000" clipEnd="npt=0:00:12.500"/>
          <audio src="../audio/z-first.mp3" clipBegin="npt=0:01:00.000" clipEnd="npt=0:01:10.000"/>
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

        // SMIL is a clip sequence, not just a list of physical audio files.
        // A repeated file can play two disjoint intervals in reading order.
        let clips = NativeDaisyAudioOrder.orderedClips(
            in: root, packagePaths: files, audioPaths: actual)
        precondition(clips.count == 3, "SMIL clips lost or deduplicated")
        precondition(clips[0].track == 0 && clips[0].begin == 0 &&
                     clips[0].end == 12.5, "First clip boundaries incorrect")
        precondition(clips[1].track == 0 && clips[1].begin == 60 &&
                     clips[1].end == 70, "Repeated file clip boundaries lost")
        precondition(clips[2].track == 1 && clips[2].begin == 0 &&
                     clips[2].end == nil, "Chapter following repeated clip incorrect")

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

        // One SMIL file may contain several subsections. The NCC can order
        // those subsections differently from their XML source positions.
        try write("inside/ncc.html", """
        <html><body>
          <h1><a href="book.smil#second">Segundo</a></h1>
          <h1><a href="book.smil#first">Primero</a></h1>
        </body></html>
        """)
        try write("inside/book.smil", """
        <smil><body>
          <seq id="first">
            <par id="first-a"><audio src="one.mp3" clipBegin="0s" clipEnd="3s"/></par>
            <par id="first-b"><audio src="one.mp3" clipBegin="3s" clipEnd="5s"/></par>
          </seq>
          <seq id="second">
            <par id="second-a"><audio src="two.mp3" clipBegin="7s" clipEnd="9s"/></par>
          </seq>
        </body></smil>
        """)
        let insidePaths = ["ncc.html", "book.smil", "one.mp3", "two.mp3"]
        let insideRoot = root.appendingPathComponent("inside")
        let insideAudio = NativeDaisyAudioOrder.orderedAudioFiles(
            in: insideRoot, packagePaths: insidePaths,
            audioPaths: ["one.mp3", "two.mp3"])
        precondition(insideAudio == ["two.mp3", "one.mp3"],
                     "NCC fragment order within a SMIL was ignored: \(insideAudio)")
        let insideClips = NativeDaisyAudioOrder.orderedClips(
            in: insideRoot, packagePaths: insidePaths, audioPaths: insideAudio)
        precondition(insideClips.count == 3, "Repeated SMIL intervals were lost")
        precondition(insideClips[0].track == 0 && insideClips[0].begin == 7
                     && insideClips[0].end == 9, "Second NCC section must play first")
        precondition(insideClips[1].track == 1 && insideClips[1].begin == 0
                     && insideClips[1].end == 3, "First NCC section was skipped")
        precondition(insideClips[2].track == 1 && insideClips[2].begin == 3
                     && insideClips[2].end == 5, "Nested seq/par order was not preserved")

        // DAISY 3 NCX has the same within-file requirement.
        try write("inside3/book.ncx", """
        <ncx><navMap>
          <navPoint id="second"><navLabel><text>Segundo</text></navLabel>
            <content src="book.smil#second"/></navPoint>
          <navPoint id="first"><navLabel><text>Primero</text></navLabel>
            <content src="book.smil#first"/></navPoint>
        </navMap></ncx>
        """)
        try write("inside3/book.smil", """
        <smil><body>
          <par id="first"><audio src="one.mp3" clipBegin="0s" clipEnd="3s"/></par>
          <par id="second"><audio src="two.mp3" clipBegin="7s" clipEnd="9s"/></par>
        </body></smil>
        """)
        let inside3Root = root.appendingPathComponent("inside3")
        let inside3Paths = ["book.ncx", "book.smil", "one.mp3", "two.mp3"]
        let inside3Audio = NativeDaisyAudioOrder.orderedAudioFiles(
            in: inside3Root, packagePaths: inside3Paths,
            audioPaths: ["one.mp3", "two.mp3"])
        precondition(inside3Audio == ["two.mp3", "one.mp3"],
                     "NCX section order within a SMIL was ignored")
        let inside3Clips = NativeDaisyAudioOrder.orderedClips(
            in: inside3Root, packagePaths: inside3Paths, audioPaths: inside3Audio)
        precondition(inside3Clips.count == 2 && inside3Clips[0].track == 0
                     && inside3Clips[1].track == 1,
                     "NCX chapter navigation within one SMIL is incorrect")

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

        // Distinct books can contain tracks with the same basename.
        // Chapter navigation must stay inside the referenced directory.
        let duplicatePaths = [
            "setA/chapters/first.smil", "setB/chapters/second.smil",
            "setA/audio/track001.mp3", "setB/audio/track001.mp3"
        ]
        let firstSMIL = NativeDaisyAudioOrder.resolvedMember(
            "setA/chapters/first.smil#start", relativeTo: "ncc.html",
            available: duplicatePaths)
        let secondSMIL = NativeDaisyAudioOrder.resolvedMember(
            "setB/chapters/second.smil#start", relativeTo: "ncc.html",
            available: duplicatePaths)
        precondition(firstSMIL == "setA/chapters/first.smil")
        precondition(secondSMIL == "setB/chapters/second.smil")
        let audioPaths = duplicatePaths.filter { $0.hasSuffix(".mp3") }
        let firstTrack = NativeDaisyAudioOrder.resolvedMember(
            "../audio/track001.mp3", relativeTo: firstSMIL!, available: audioPaths)
        let secondTrack = NativeDaisyAudioOrder.resolvedMember(
            "../audio/track001.mp3", relativeTo: secondSMIL!, available: audioPaths)
        precondition(firstTrack == "setA/audio/track001.mp3")
        precondition(secondTrack == "setB/audio/track001.mp3")
        precondition(NativeDaisyAudioOrder.resolvedMember(
            "track001.mp3", relativeTo: "other/book.smil",
            available: audioPaths) == nil,
            "Ambiguous basename must never select an arbitrary recording")

        print("DAISY NCC/NCX/SMIL and duplicate-basename routing: eight Swift checks passed.")
    }
}
