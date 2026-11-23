/// Keep the next sentences queued inside AVSpeechSynthesizer so the app
/// does not have to wake from a suspended background state to speak again.
enum NativeReaderSpeechQueueWindow {
    static func pending(current: Int, alreadyQueued: Int, total: Int,
                        lookahead: Int = 3) -> Range<Int> {
        let endOfQueue = max(0, total)
        let start = min(endOfQueue, max(0, alreadyQueued))
        let desiredEnd = min(endOfQueue, max(0, current) + max(2, lookahead))
        return start..<max(start, desiredEnd)
    }
}
