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
        assertTrue(s.contains("NativeReaderGeminiStrings.get(uiLanguage, \"paste\")"))
        assertTrue(s.contains("NativeReaderGeminiStrings.get(uiLanguage, \"check\")"))
        assertTrue(s.contains("NativeReaderGeminiStrings.get(uiLanguage, if (present) \"keySaved\" else \"noKey\")"))
        val labels = source("NativeReaderGeminiStrings.kt")
        assertTrue(labels.contains("Pegar clave"))
        assertTrue(labels.contains("Comprobar"))
        assertTrue(labels.contains("Clave guardada"))
    }

    @Test fun externalEnginesAreDiscoverableWithoutClaimingActiveTts() {
        val settings = source("NativeReaderSettings.kt")
        assertTrue(settings.contains("NativeReaderExternalVoiceKeysScreen"))
        val keys = source("NativeReaderExternalVoiceKeys.kt")
        assertTrue(keys.contains("Phonon"))
        assertTrue(keys.contains("NativeReaderGeminiStrings.get(uiLanguage, \"quota\")"))
        assertTrue(source("NativeReaderGeminiStrings.kt").contains("puede consumir cuota"))
    }
}
