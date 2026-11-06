package com.tifloacosta.nativeprototype

import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class Phase6IntegralRegressionTest {
    private fun source(name: String) =
        File("src/main/java/com/tifloacosta/nativeprototype/$name").readText()

    @Test fun readerKeepsNavigationAndSpeechEngines() {
        val reader = source("NativeTifloLector.kt")
        assertTrue(reader.contains("ReaderNavigation"))
        assertTrue(reader.contains("NativePhonon"))
        assertTrue(reader.contains("NativeGemini"))
        assertTrue(reader.contains("bookmark"))
    }

    @Test fun podcastLibraryKeepsFavoritesOpmlAndNewEpisodes() {
        val library = source("NativePodcastLibrary.kt")
        val screen = source("NativeMediaAndDownloads.kt")
        assertTrue(library.contains("fun savedEpisodes()"))
        assertTrue(library.contains("fun importOPML("))
        assertTrue(library.contains("fun recordFeedCheck("))
        assertTrue(screen.contains("Reproducir favorito"))
        assertTrue(screen.contains("Consultar episodios"))
    }

    @Test fun youtubeAccountKeepsOptionalSignInAndSubscriptionPages() {
        val account = source("NativeYouTubeAccount.kt")
        assertTrue(account.contains("fun signOut()"))
        assertTrue(account.contains("suspend fun loadSubscriptions("))
        assertTrue(account.contains("subscriptionsNextPageToken"))
        assertTrue(account.contains("AndroidKeyStore"))
    }
}
