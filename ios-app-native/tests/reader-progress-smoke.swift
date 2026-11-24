import Foundation

@main
struct ReaderProgressSmoke {
    static func main() {
        precondition(NativeReaderProgress.textPercent(length: 10_000, offset: 9_999) == 99)
        precondition(NativeReaderProgress.textPercent(length: 10_000, offset: 10_000) == 100)
        precondition(NativeReaderProgress.textPercent(length: 10_000, offset: 1) == 0)
        precondition(NativeReaderProgress.textPercent(length: 10, offset: 9) == 90)
        precondition(NativeReaderProgress.textPercent(length: 10, offset: -3) == 0)
        precondition(NativeReaderProgress.textPercent(length: 10, offset: 999) == 100)
        precondition(NativeReaderProgress.textPercent(length: 0, offset: 0) == 0)
        let text = String(repeating: "a", count: 255) + "e\u{301}👩‍🦯\r\nñ"
        let offsets = NativeReaderTextOffsets(text)
        precondition(offsets.length == 259 && offsets.utf16Length == text.utf16.count)
        for offset in 0...offsets.length {
            let expected = text.prefix(offset).utf16.count
            precondition(offsets.utf16Offset(for: offset) == expected)
            precondition(offsets.characterOffset(forUTF16: expected) == offset)
        }
        precondition(offsets.characterOffset(forUTF16: 256) == 255,
                     "A UTF-16 index inside a combined grapheme must stay on that grapheme.")
        precondition(offsets.characterOffset(forUTF16: Int.max) == offsets.length)
        print("Reader progress: 100% requires actual document end.")
    }
}
