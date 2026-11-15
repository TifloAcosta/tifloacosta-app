package com.tifloacosta.nativeprototype

import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/** Static safeguards for the native Android library workflow.
 * Device-level TalkBack and file import tests remain in the final release pass.
 */
class ReaderPhaseThreeLibraryContractTest {
    private fun source(file: String): String {
        // This module is run from android-native-prototype/app in Gradle.
        val candidates = listOf(
            File("src/main/java/com/tifloacosta/nativeprototype/$file"),
            File("app/src/main/java/com/tifloacosta/nativeprototype/$file")
        )
        val found = candidates.firstOrNull { it.exists() }
            ?: error("Source file not found: $file")
        return found.readText()
    }

    @Test fun multiSelectRequiresConfirmationBeforeDeletion() {
        val s = source("NativeTifloLector.kt")
        assertTrue(s.contains("NativeReaderLibraryStrings.get(uiLanguage, if (selectionMode) \"done\" else \"select\")"))
        assertTrue(s.contains("selectedBookIds"))
        assertTrue(s.contains("confirmMultipleDeletion"))
        assertTrue(s.contains("NativeReaderBookDialogStrings.get(uiLanguage, \"deleteMultipleBody\""))
        assertTrue(source("NativeReaderBookDialogStrings.kt").contains("¿Eliminar los libros seleccionados?"))
        assertTrue(s.contains("store.delete(book)"))
    }

    @Test fun openedTextAndAudioBooksOfferDeletion() {
        assertTrue(source("NativeTifloLector.kt").contains("NativeReaderInlineStrings.get(uiLanguage, \"delete\")"))
        assertTrue(source("NativeReaderAudio.kt").contains("NativeReaderAudioStrings.get(uiLanguage, \"delete\")"))
        assertTrue(source("NativeTifloLector.kt").contains("onDeleteRequest"))
    }

    @Test fun importKeepsAccessibleResultAfterReturningToLibrary() {
        val s = source("NativeTifloLector.kt")
        assertTrue(s.contains("importResult"))
        assertTrue(s.contains("imported++"))
        assertTrue(s.contains("liveRegion = LiveRegionMode.Polite"))
    }
}
