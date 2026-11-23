import Foundation

/// Inspects the first MPEG frame of an MP3 while a ZIP member is being extracted.
/// Skips an ID3v2 tag without keeping artwork or the complete recording in memory.
/// Frame-header validation is not a substitute for decoding/listening to the file.
struct NativeMP3HeaderProbe {
    private var bytesRead = 0
    private var firstTen = Data()
    private var frameOffset: Int?
    private var frameHeader = Data()
    private var malformedTag = false

    mutating func consume(_ chunk: Data) {
        guard !chunk.isEmpty else { return }
        let start = bytesRead
        let end = start + chunk.count
        if firstTen.count < 10 {
            firstTen.append(chunk.prefix(10 - firstTen.count))
            if firstTen.count == 10 {
                let header = [UInt8](firstTen)
                if header.starts(with: [0x49, 0x44, 0x33]) { // ID3v2
                    guard (2...4).contains(Int(header[3])),
                          header[6...9].allSatisfy({ $0 & 0x80 == 0 }) else {
                        malformedTag = true
                        bytesRead = end
                        return
                    }
                    let size = (Int(header[6]) << 21) | (Int(header[7]) << 14) |
                               (Int(header[8]) << 7) | Int(header[9])
                    let footer = header[3] == 4 && (header[5] & 0x10) != 0 ? 10 : 0
                    frameOffset = 10 + size + footer
                } else {
                    frameOffset = 0
                    frameHeader.append(firstTen.prefix(4))
                }
            }
        }
        if let frameOffset, frameHeader.count < 4 {
            let firstNeeded = frameOffset + frameHeader.count
            let lower = max(start, firstNeeded)
            let upper = min(end, frameOffset + 4)
            if lower < upper {
                frameHeader.append(chunk.subdata(in: (lower - start)..<(upper - start)))
            }
        }
        bytesRead = end
    }

    var hasMPEGFrame: Bool {
        guard !malformedTag, frameHeader.count == 4 else { return false }
        let b = [UInt8](frameHeader)
        return b[0] == 0xFF && (b[1] & 0xE0) == 0xE0 &&
               (b[1] & 0x18) != 0x08 && // MPEG version must not be reserved
               (b[1] & 0x06) != 0x00 && // MPEG layer must not be reserved
               (b[2] & 0xF0) != 0x00 && (b[2] & 0xF0) != 0xF0 &&
               (b[2] & 0x0C) != 0x0C // MPEG sample rate must not be reserved
    }
}
