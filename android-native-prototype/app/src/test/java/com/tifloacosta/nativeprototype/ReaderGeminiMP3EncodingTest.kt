package com.tifloacosta.nativeprototype

import org.junit.Assert.assertTrue
import org.junit.Test

class ReaderGeminiMP3EncodingTest {
    @Test fun encodesRealMp3FramesFromPcmInsteadOfRenamingWave() {
        // 0.2 seconds of mono, 24 kHz PCM, amplitude kept quiet.
        val pcm = ByteArray(9600) { i ->
            val sample = if (i % 2 == 0) 0 else 12
            sample.toByte()
        }
        val mp3 = NativeGeminiAudioExport.encodeMP3(pcm)
        assertTrue("MP3 has no audio data", mp3.size > 100)
        // ID3 may precede frames. Look for a valid MPEG sync marker.
        assertTrue("Missing MPEG frame header", (0 until mp3.size - 1).any { i ->
            (mp3[i].toInt() and 255) == 255 &&
                (mp3[i + 1].toInt() and 0xE0) == 0xE0
        })
        assertTrue("Not a WAV file", !mp3.take(4).toByteArray().contentEquals("RIFF".toByteArray()))
    }
}
