package com.tifloacosta.nativeprototype

/**
 * TalkBack's setProgress receives a requested absolute progress value whose
 * size depends on the screen reader. For reading navigation it must move
 * exactly one paragraph, sentence, block, section or 30-second interval.
 */
internal object NativeReaderGestureSteps {
    fun next(current: Int, requested: Float, lastIndex: Int): Int {
        val maximum = lastIndex.coerceAtLeast(0)
        val index = current.coerceIn(0, maximum)
        if (!requested.isFinite()) return index
        return when {
            requested > index.toFloat() -> (index + 1).coerceAtMost(maximum)
            requested < index.toFloat() -> (index - 1).coerceAtLeast(0)
            else -> index
        }
    }

    fun wrapNext(current: Int, count: Int): Int {
        if (count <= 1) return 0
        return (current.coerceIn(0, count - 1) + 1) % count
    }
}
