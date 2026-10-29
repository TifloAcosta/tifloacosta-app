package com.tifloacosta.nativeprototype

import org.junit.Assert.assertEquals
import org.junit.Test

class ReaderGestureStepsTest {
    @Test fun talkBackLargeProgressChangeMovesExactlyOneReadingUnit() {
        assertEquals(6, NativeReaderGestureSteps.next(5, 99f, 1000))
        assertEquals(4, NativeReaderGestureSteps.next(5, 0f, 1000))
    }

    @Test fun gesturesNeverCrossBookBoundaries() {
        assertEquals(0, NativeReaderGestureSteps.next(0, -50f, 20))
        assertEquals(20, NativeReaderGestureSteps.next(20, 500f, 20))
    }

    @Test fun equalProgressDoesNotMoveOrRestartSpeech() {
        assertEquals(4, NativeReaderGestureSteps.next(4, 4f, 100))
    }

    @Test fun invalidProgressIsIgnoredSafely() {
        assertEquals(2, NativeReaderGestureSteps.next(2, Float.NaN, 5))
        assertEquals(2, NativeReaderGestureSteps.next(2, Float.POSITIVE_INFINITY, 5))
    }

    @Test fun compactChoiceCyclesAndSkipsNothing() {
        assertEquals(1, NativeReaderGestureSteps.wrapNext(0, 3))
        assertEquals(2, NativeReaderGestureSteps.wrapNext(1, 3))
        assertEquals(0, NativeReaderGestureSteps.wrapNext(2, 3))
        assertEquals(0, NativeReaderGestureSteps.wrapNext(0, 1))
    }
}
