package com.tifloacosta.nativeprototype

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class MediaLogicTest {
    private val podcast = MediaItem(
        id = "p1", type = "audio", title = "Episodio en español",
        sourceName = "Radio", sourceUrl = "https://radio.example.com",
        originalUrl = "https://radio.example.com/episode", directMediaUrl = "https://radio.example.com/p1.mp3",
        language = "es", publishedAt = "2026-10-25T12:00:00Z", summary = ""
    )
    private val video = MediaItem(
        id = "v1", type = "video", title = "Canal accesible",
        sourceName = "Canal A", sourceUrl = "https://youtube.com/@a",
        originalUrl = "https://youtube.com/watch?v=1234", directMediaUrl = "",
        language = "en", publishedAt = "2026-10-26T12:00:00Z", summary = ""
    )

    @Test fun podcastAndVideoDoNotMix() {
        val items = listOf(podcast, video)
        assertTrue(MediaLogic.select(items, 0).isEmpty())
        assertEquals(listOf(podcast), MediaLogic.select(items, 1))
        assertEquals(listOf(video), MediaLogic.select(items, 2))
        assertEquals(listOf(video, podcast), MediaLogic.select(items, 3))
    }

    @Test fun sourceAndLanguageFilterWorkTogether() {
        val items = listOf(podcast, video)
        assertEquals(listOf("Canal A", "Radio"), MediaLogic.sources(items, 3))
        assertEquals(listOf("Radio"), MediaLogic.sources(items, 1))
        assertEquals(listOf(video), MediaLogic.select(items, 3, "Canal A", 2))
        assertTrue(MediaLogic.select(items, 3, "Canal A", 1).isEmpty())
    }

    @Test fun originalLinkIsUsedWhenDirectMediaUnavailable() {
        assertEquals("https://radio.example.com/p1.mp3", podcast.openUrl)
        assertEquals("https://youtube.com/watch?v=1234", video.openUrl)
        assertEquals(
            "https://radio.example.com/episode",
            podcast.copy(directMediaUrl = "content://untrusted").openUrl
        )
    }

    @Test fun javascriptAndHttpAreNotOpenableLinks() {
        assertTrue(!MediaLogic.validWebUrl("javascript:alert(1)"))
        assertTrue(!MediaLogic.validWebUrl("http://site.example.com"))
        assertEquals("", podcast.copy(sourceUrl = "", originalUrl = "javascript:bad", directMediaUrl = "").openUrl)
    }
}
