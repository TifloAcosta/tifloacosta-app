package com.tifloacosta.nativeprototype

/**
 * Transient audio-focus losses (for example TalkBack speaking after the user
 * navigates away from Play or announces a screen lock) must not convert a
 * running book into a permanent pause. Android may deliver successive losses
 * before a single GAIN, so the first resume intent must remain latched.
 *
 * The caller explicitly clears this latch on user pause/stop or permanent loss.
 */
internal class NativeReaderAudioFocusRecovery {
    var resumeOnGain: Boolean = false
        private set

    fun transientLoss(wasPlaying: Boolean) {
        if (wasPlaying) resumeOnGain = true
    }

    fun gained(): Boolean {
        val shouldResume = resumeOnGain
        resumeOnGain = false
        return shouldResume
    }

    fun cancel() {
        resumeOnGain = false
    }
}
