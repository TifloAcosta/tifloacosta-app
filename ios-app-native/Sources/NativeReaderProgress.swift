import Foundation

/// Text progress is 100% only when the final character has been reached.
enum NativeReaderProgress {
    static func textPercent(length: Int, offset: Int) -> Int {
        guard length > 0 else { return 0 }
        let clamped = max(0, min(length, offset))
        if clamped == length { return 100 }
        return max(0, min(99, Int(Double(clamped) * 100.0 / Double(length))))
    }
}


/// UIKit selections use UTF-16 while the library stores grapheme offsets.
/// Index checkpoints keep panning cost independent of distance from the start.
struct NativeReaderTextOffsets {
    private struct Checkpoint {
        let index: String.Index
        let utf16: Int
    }

    private let text: String
    private let checkpoints: [Checkpoint]
    private static let stride = 256
    let length: Int
    let utf16Length: Int

    init(_ text: String) {
        self.text = text
        var index = text.startIndex
        var utf16 = 0
        var count = 0
        var checkpoints = [Checkpoint(index: index, utf16: 0)]
        while index < text.endIndex {
            let next = text.index(after: index)
            utf16 += text[index..<next].utf16.count
            count += 1
            index = next
            if count.isMultiple(of: Self.stride) {
                checkpoints.append(Checkpoint(index: index, utf16: utf16))
            }
        }
        self.checkpoints = checkpoints
        length = count
        utf16Length = utf16
    }

    func utf16Offset(for characterOffset: Int) -> Int {
        let offset = max(0, min(length, characterOffset))
        let checkpoint = checkpoints[offset / Self.stride]
        let end = text.index(checkpoint.index, offsetBy: offset % Self.stride)
        return checkpoint.utf16 + text[checkpoint.index..<end].utf16.count
    }

    func characterOffset(forUTF16 location: Int) -> Int {
        let target = max(0, location)
        var lower = 0
        var upper = checkpoints.count
        while lower + 1 < upper {
            let middle = (lower + upper) / 2
            if checkpoints[middle].utf16 <= target { lower = middle }
            else { upper = middle }
        }
        let checkpoint = checkpoints[lower]
        var index = checkpoint.index
        var utf16 = checkpoint.utf16
        var offset = lower * Self.stride
        while index < text.endIndex {
            let next = text.index(after: index)
            let width = text[index..<next].utf16.count
            guard width <= target - utf16 else { break }
            utf16 += width
            offset += 1
            index = next
        }
        return offset
    }
}
