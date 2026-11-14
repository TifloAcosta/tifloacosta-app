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
}
