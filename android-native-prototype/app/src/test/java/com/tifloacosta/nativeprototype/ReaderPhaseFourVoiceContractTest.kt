package com.tifloacosta.nativeprototype

import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class ReaderPhaseFourVoiceContractTest {
    private fun file(name: String): String {
        val path = "src/main/java/com/tifloacosta/nativeprototype/$name"
        return File(path).readText()
    }

    @Test fun selectionClosesVoiceListAndConfirmationRemainsVisible() {
        val picker = file("NativeReaderVoicePicker.kt")
        assertTrue(picker.contains("showing = false"))
        assertTrue(picker.contains("restoreSettingsFocus = true"))
        assertTrue(picker.indexOf("if (status.isNotBlank())") <
            picker.indexOf("if (!showing) return"))
    }

    @Test fun changingVoiceRefreshesActiveTextPlayback() {
        val service = file("NativeReaderPlaybackService.kt")
        val reader = file("NativeTifloLector.kt")
        assertTrue(service.contains("ACTION_VOICE"))
        assertTrue(service.contains("if (playing) speakCurrent()"))
        assertTrue(reader.contains("send(NativeReaderPlaybackService.ACTION_VOICE)"))
    }
}
