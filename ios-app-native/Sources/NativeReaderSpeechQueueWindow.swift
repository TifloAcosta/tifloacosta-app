/// Keep the next sentences queued inside AVSpeechSynthesizer so the app
/// does not have to wake from a suspended background state to speak again.
enum NativeReaderSpeechQueueWindow {
    // Submitted AVSpeechUtterance instances are owned by the synthesizer.
    // Settings for a paused restart are applied when fresh utterances are built.
    static func editableStart(current: Int, alreadyQueued: Int, total: Int) -> Int {
        min(max(0, total), max(0, current + 1, alreadyQueued))
    }

    static func pending(current: Int, alreadyQueued: Int, total: Int,
                        lookahead: Int = 8) -> Range<Int> {
        let endOfQueue = max(0, total)
        let start = min(endOfQueue, max(0, alreadyQueued))
        let desiredEnd = min(endOfQueue, max(0, current) + max(2, lookahead))
        return start..<max(start, desiredEnd)
    }
}
