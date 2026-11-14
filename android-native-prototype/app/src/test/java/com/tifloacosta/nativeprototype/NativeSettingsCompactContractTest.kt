package com.tifloacosta.nativeprototype

import java.io.File
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** Static safeguards for minimal TalkBack navigation. Device testing remains mandatory. */
class NativeSettingsCompactContractTest {
    private fun source(name: String) = File("src/main/java/com/tifloacosta/nativeprototype/$name").readText()

    @Test fun languageAndAppearanceEachUseOneAdjustableControl() {
        val settings = source("NativeSecondaryScreens.kt")
        assertTrue(settings.contains("ReaderCompactChoice("))
        assertFalse(settings.contains("NativeUiText.choices.forEach"))
        assertFalse(settings.contains("\"dark\" to NativeUiText.get(uiLanguage, \"dark\")).forEach"))
        assertTrue(settings.contains("prefs.edit().putString(\"language\", code).apply()"))
        assertTrue(settings.contains("prefs.edit().putString(\"theme\", code).apply()"))
    }

    @Test fun largerTextIsOneLabeledControl() {
        val settings = source("NativeSecondaryScreens.kt")
        assertTrue(settings.contains("toggleable(\n"))
        assertFalse(settings.contains("Checkbox(checked = enlarged"))
    }

    @Test fun readerCategoriesOpenDedicatedPagesNotAccordions() {
        val settings = source("NativeReaderSettings.kt")
        assertTrue(settings.contains("selectedGroup"))
        assertFalse(settings.contains("if (expanded == i)"))
        assertFalse(settings.contains("if (expanded == i) \"expanded\" else \"collapsed\""))
    }

    @Test fun providerVoiceAndLanguageSelectionsAvoidPopups() {
        val providers = source("NativeReaderExternalVoiceKeys.kt")
        assertFalse(providers.contains("DropdownMenu("))
        assertTrue(providers.contains("ReaderCompactChoice("))
        assertFalse(providers.contains("Checkbox(\n"))
    }

    @Test fun libraryFiltersOpenTheirOwnScreen() {
        val library = source("NativeTifloLector.kt")
        assertTrue(library.contains("if (screen == \"filters\")"))
        assertTrue(library.contains("screen = \"filters\""))
        assertFalse(library.contains("if (filtersExpanded)"))
    }

    @Test fun allDiscreteReaderSettingsShareOneAccessibleChoice() {
        val readerSettings = source("NativeReaderSettings.kt")
        assertTrue(readerSettings.contains("ReaderCompactChoice(label, choices, selected, onSelected = onSelected)"))
        assertFalse(readerSettings.contains("contentDescription = label + \": \" + choices[index]"))
    }

    @Test fun documentDetailPanelsDoNotOverlayReadingControls() {
        val screen = source("NativeTifloLector.kt")
        assertTrue(screen.contains("val detailOpen = showAudio || showVisual || jumping"))
        assertTrue(screen.contains("if (!detailOpen) {"))
        assertFalse(screen.contains("if (showAudio) \"expanded\" else \"collapsed\""))
        assertFalse(screen.contains("if (showVisual) \"expanded\" else \"collapsed\""))
        assertFalse(screen.contains("if (jumping) \"expanded\" else \"collapsed\""))
    }

    @Test fun audiobookBookmarksHaveTheirOwnScreen() {
        val audio = source("NativeReaderAudio.kt")
        assertTrue(audio.contains("if (!expandedMore) {"))
        assertTrue(audio.contains("if (expandedMore) {"))
        assertFalse(audio.contains("if (expandedMore) \"expanded\" else \"collapsed\""))
    }

    @Test fun exportAndOtherToolsAreIndependentPages() {
        val actions = source("NativeReaderDocumentActions.kt")
        assertTrue(actions.contains("if (!showAudioExport && !showOtherActions)"))
        assertFalse(actions.contains("if (showAudioExport) \"expanded\" else \"collapsed\""))
        assertFalse(actions.contains("if (showOtherActions) \"expanded\" else \"collapsed\""))
    }

    @Test fun previousLibraryOpensDedicatedScreen() {
        val screen = source("NativeTifloLector.kt")
        assertTrue(screen.contains("if (screen == \"legacy\")"))
        assertFalse(screen.contains("if (showPreviousLibrary)"))
    }
}
