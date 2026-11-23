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
        print("Reader progress: 100% requires actual document end.")
    }
}
