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
