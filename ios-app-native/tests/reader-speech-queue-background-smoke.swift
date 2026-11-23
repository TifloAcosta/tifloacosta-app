import Foundation

@main
struct ReaderBackgroundSpeechQueueSmoke {
    static func main() {
        func next(_ current: Int, _ queued: Int, _ total: Int,
                  lookahead: Int = 8) -> [Int] {
            Array(NativeReaderSpeechQueueWindow.pending(
                current: current, alreadyQueued: queued,
                total: total, lookahead: lookahead))
        }
        precondition(next(0, 0, 10) == Array(0..<8))
        precondition(next(1, 8, 10) == [8])
        precondition(next(2, 9, 10) == [9])
        precondition(next(8, 10, 10).isEmpty)
        precondition(next(0, 0, 1) == [0])
        precondition(next(0, 0, 0).isEmpty)
        precondition(next(2, 3, 10) == Array(3..<10))
        precondition(next(0, 0, 4, lookahead: 1) == [0, 1])
        precondition(next(0, 0, 4, lookahead: 4) == [0, 1, 2, 3])
        print("Background TTS queue lookahead: all checks passed.")
    }
}
