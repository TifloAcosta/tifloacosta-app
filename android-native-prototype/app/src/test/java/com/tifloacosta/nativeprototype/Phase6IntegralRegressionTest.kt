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

    @Test fun sleepTimerUsesMonotonicDeadlineAndCanBeCancelled() {
        val service = source("NativeReaderPlaybackService.kt")
        assertTrue(service.contains("SystemClock.elapsedRealtime() + minutes.coerceIn(0, 120) * 60_000L"))
        assertTrue(service.contains("handler.postDelayed(sleepExpiration"))
        assertTrue(service.contains("handler.removeCallbacks(sleepExpiration)"))
        assertTrue(service.contains("sleepDeadlineMs = 0L"))
        assertTrue(service.contains("pauseReading()"))
        // Regression: countdown must not depend exclusively on playing ticks.
        assertTrue(!service.contains("remainingSleepMs -= "))
    }

    @Test fun bookmarkActionsHaveAccessibleFeedback() {
        val reader = source("NativeTifloLector.kt")
        assertTrue(reader.contains("bookmarkMessage"))
        assertTrue(reader.contains("Marca solicitada en la posición actual."))
        assertTrue(reader.contains("Ya existe una marca en esta posición."))
        assertTrue(reader.contains("liveRegion = LiveRegionMode.Polite"))
    }

    @Test fun navigationSelectorStaysNextToPlaybackControl() {
        val reader = source("NativeTifloLector.kt")
        val play = reader.indexOf("Text(if (english) \"Play\" else \"Reproducir\")")
        val navigation = reader.indexOf("if (english) \"Move by\" else \"Avanzar y retroceder por\"")
        val engine = reader.indexOf("if (english) \"Engine\" else \"Motor\"")
        assertTrue("Playback button must precede the navigation selector", play >= 0 && navigation > play)
        assertTrue("Navigation must precede voice configuration", engine > navigation)
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
