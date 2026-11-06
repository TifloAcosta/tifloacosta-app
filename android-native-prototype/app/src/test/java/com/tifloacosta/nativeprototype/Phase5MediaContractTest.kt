package com.tifloacosta.nativeprototype

import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/** Phase 5 regression checks for native podcast and Google subscriptions. */
class Phase5MediaContractTest {
    private fun source(name: String) =
        File("src/main/java/com/tifloacosta/nativeprototype/$name").readText()

    @Test fun opmlImportAndRssLookupAreOffMainThread() {
        val screen = source("NativeMediaAndDownloads.kt")
        val library = source("NativePodcastLibrary.kt")
        assertTrue(screen.contains("withContext(Dispatchers.IO) { library.importOPML(uri) }"))
        assertTrue(screen.contains("episodesFromRss(limitedResponse(podcast.url))"))
        assertTrue(library.contains("importOPML(source: Uri)"))
        assertTrue(library.contains("total <= 2_000_000"))
    }

    @Test fun podcastFavoritesAndNewEpisodesSurviveRestart() {
        val library = source("NativePodcastLibrary.kt")
        assertTrue(library.contains("getSharedPreferences"))
        assertTrue(library.contains("fun toggleFavorite("))
        assertTrue(library.contains("fun recordFeedCheck("))
        assertTrue(library.contains("putStringSet("))
    }

    @Test fun youtubeSubscriptionsUseExistingProtectedSessionAndPagination() {
        val account = source("NativeYouTubeAccount.kt")
        val discovery = source("NativeYouTubeSearch.kt")
        assertTrue(account.contains("suspend fun loadSubscriptions("))
        assertTrue(account.contains("val response = api(route)"))
        assertTrue(account.contains("subscriptionsNextPageToken"))
        assertTrue(discovery.contains("account.loadSubscriptions(more = true)"))
        assertTrue(discovery.contains("account.authenticated"))
    }
}
