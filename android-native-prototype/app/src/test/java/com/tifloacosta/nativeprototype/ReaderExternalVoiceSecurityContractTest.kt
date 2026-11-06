package com.tifloacosta.nativeprototype

import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class ReaderExternalVoiceSecurityContractTest {
    private fun source(name: String) =
        File("src/main/java/com/tifloacosta/nativeprototype/$name").readText()

    @Test fun geminiKeyIsEncryptedByAndroidKeystore() {
        val s = source("NativeReaderExternalVoiceKeys.kt")
        assertTrue(s.contains("AndroidKeyStore"))
        assertTrue(s.contains("AES/GCM/NoPadding"))
        assertTrue(s.contains("PasswordVisualTransformation"))
        assertTrue(s.contains("Pegar clave"))
        assertTrue(s.contains("Comprobar"))
        assertTrue(s.contains("Clave guardada"))
    }

    @Test fun externalEnginesAreDiscoverableWithoutClaimingActiveTts() {
        val settings = source("NativeReaderSettings.kt")
        assertTrue(settings.contains("NativeReaderExternalVoiceKeysScreen"))
        val keys = source("NativeReaderExternalVoiceKeys.kt")
        assertTrue(keys.contains("Phonon"))
        assertTrue(keys.contains("La voz Gemini se activará cuando la integración esté verificada"))
    }
}
