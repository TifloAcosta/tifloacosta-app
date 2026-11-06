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
        assertTrue(s.contains("Seleccionar varios libros"))
        assertTrue(s.contains("selectedBookIds"))
        assertTrue(s.contains("confirmMultipleDeletion"))
        assertTrue(s.contains("¿Eliminar los libros seleccionados?"))
        assertTrue(s.contains("store.delete(book)"))
    }

    @Test fun openedTextAndAudioBooksOfferDeletion() {
        assertTrue(source("NativeTifloLector.kt").contains("Eliminar esta obra"))
        assertTrue(source("NativeReaderAudio.kt").contains("Eliminar este audiolibro"))
        assertTrue(source("NativeTifloLector.kt").contains("onDeleteRequest"))
    }

    @Test fun importKeepsAccessibleResultAfterReturningToLibrary() {
        val s = source("NativeTifloLector.kt")
        assertTrue(s.contains("importResult"))
        assertTrue(s.contains("imported++"))
        assertTrue(s.contains("liveRegion = LiveRegionMode.Polite"))
    }
}
