package com.tifloacosta.nativeprototype

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ReaderAudioFocusRecoveryTest {
    @Test fun talkBackFocusMovementRetainsResumeAcrossSuccessiveInterruptions() {
        val recovery = NativeReaderAudioFocusRecovery()
        recovery.transientLoss(wasPlaying = true)
        assertTrue(recovery.resumeOnGain)
        recovery.transientLoss(wasPlaying = false)
        assertTrue(recovery.resumeOnGain)
        assertTrue(recovery.gained())
        assertFalse(recovery.resumeOnGain)
        assertFalse(recovery.gained())
    }

    @Test fun lockScreenAnnouncementCanRecoverPlayback() {
        val recovery = NativeReaderAudioFocusRecovery()
        recovery.transientLoss(wasPlaying = true)
        assertTrue(recovery.gained())
    }

    @Test fun manualPauseMustNotResumeAfterTalkBackStopsSpeaking() {
        val recovery = NativeReaderAudioFocusRecovery()
        recovery.transientLoss(wasPlaying = true)
        recovery.cancel()
        assertFalse(recovery.gained())
    }

    @Test fun alreadyPausedReaderDoesNotStartFromUnsolicitedFocusGain() {
        val recovery = NativeReaderAudioFocusRecovery()
        recovery.transientLoss(wasPlaying = false)
        assertFalse(recovery.resumeOnGain)
        assertFalse(recovery.gained())
    }

    @Test fun permanentLossCancelsTransientResume() {
        val recovery = NativeReaderAudioFocusRecovery()
        recovery.transientLoss(wasPlaying = true)
        recovery.transientLoss(wasPlaying = false)
        recovery.cancel()
        assertFalse(recovery.gained())
    }
}
