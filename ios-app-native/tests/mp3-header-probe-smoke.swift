import Foundation

@main
struct MP3HeaderProbeSmoke {
    static func probe(_ chunks: [Data]) -> Bool {
        var probe = NativeMP3HeaderProbe()
        for chunk in chunks { probe.consume(chunk) }
        return probe.hasMPEGFrame
    }
    static func main() {
        let frame = Data([0xFF, 0xFB, 0x90, 0x64])
        precondition(probe([frame + Data(repeating: 0, count: 120)]))
        precondition(!probe([Data("RIFF".utf8) + frame + Data(repeating: 0, count: 120)]))
        precondition(!probe([Data([0xFF, 0xE0, 0x90, 0x64]) + Data(repeating: 0, count: 120)]))
        precondition(!probe([Data([0xFF, 0xFB, 0x00, 0x64]) + Data(repeating: 0, count: 120)]))
        precondition(!probe([Data([0xFF, 0xFB, 0x9C, 0x64]) + Data(repeating: 0, count: 120)]))
        let tagSize = 300_000
        let synchsafe: [UInt8] = [UInt8((tagSize >> 21) & 0x7F), UInt8((tagSize >> 14) & 0x7F),
                                 UInt8((tagSize >> 7) & 0x7F), UInt8(tagSize & 0x7F)]
        let withArtwork = Data([0x49, 0x44, 0x33, 0x04, 0x00, 0x00] + synchsafe) +
                          Data(repeating: 0, count: tagSize) + frame + Data(repeating: 0, count: 150)
        var chunks: [Data] = []
        var offset = 0
        for size in [2, 3, 5, 13, 4, 90, 8_192, 262_144, 40_000] {
            let end = min(offset + size, withArtwork.count)
            chunks.append(withArtwork.subdata(in: offset..<end))
            offset = end
        }
        chunks.append(withArtwork.subdata(in: offset..<withArtwork.count))
        precondition(probe(chunks), "Large ID3 tags must not hide a valid MPEG frame")
        precondition(!probe([withArtwork.prefix(300_010)]), "ID3 metadata alone is not MP3")
        let invalidID3 = Data([0x49, 0x44, 0x33, 0x04, 0x00, 0x00, 0x80, 0, 0, 0]) + frame
        precondition(!probe([invalidID3]), "Invalid synchsafe tag accepted")
        print("MP3 frame header probe: regular audio, large ID3 and invalid cases passed.")
    }
}
