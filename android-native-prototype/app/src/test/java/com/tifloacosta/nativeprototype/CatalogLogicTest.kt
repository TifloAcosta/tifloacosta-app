package com.tifloacosta.nativeprototype

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class CatalogLogicTest {
    private val android = CatalogItem("1", "Noticia Android", "es", "", listOf("android"), "", "")
    private val apple = CatalogItem("2", "Noticia Apple", "es", "", listOf("apple"), "", "")

    @Test fun backNavigationFromEitherSectionReturnsToHome() {
        assertEquals(-1, PrototypeNavigation.HOME)
        assertEquals(
            PrototypeNavigation.HOME,
            PrototypeNavigation.parentOf(PrototypeNavigation.NEWS)
        )
        assertEquals(
            PrototypeNavigation.HOME,
            PrototypeNavigation.parentOf(PrototypeNavigation.RESOURCES)
        )
        assertEquals(
            PrototypeNavigation.HOME,
            PrototypeNavigation.parentOf(PrototypeNavigation.VIDEOS)
        )
    }

    @Test fun newsHasNoResultsUntilAFilterIsChosen() {
        val items = listOf(android, apple)
        assertTrue(CatalogLogic.newsForCategory(items, listOf("android", "apple"), 0).isEmpty())
        assertEquals(2, CatalogLogic.newsForCategory(items, listOf("android", "apple"), 1).size)
        assertEquals(listOf(android), CatalogLogic.newsForCategory(items, listOf("android", "apple"), 2))
    }

    @Test fun newsSortsByPublicationDateInsteadOfIdentifier() {
        val oldest = android.copy(id = "z-story", newsDate = "2026-10-21T10:00:00.000Z")
        val newest = apple.copy(id = "a-story", newsDate = "2026-10-30T09:00:00.000Z")
        val middle = android.copy(id = "m-story", newsDate = "2026-10-28T09:00:00.000Z")
        val sorted = CatalogLogic.newsForCategory(listOf(oldest, newest, middle), emptyList(), 1)
        assertEquals(listOf("a-story", "m-story", "z-story"), sorted.map { it.id })
    }

    @Test fun switchingResourceCategoryReplacesResultsWithoutDuplicating() {
        val items = listOf(
            android.copy(category = "Android"),
            apple.copy(category = "Apple")
        )
        val groups = CatalogLogic.resourceCategories(items)
        assertEquals(listOf("Android", "Apple"), groups)
        assertEquals("Noticia Android", CatalogLogic.resourcesForCategory(items, groups, 1).single().title)
        assertEquals("Noticia Apple", CatalogLogic.resourcesForCategory(items, groups, 2).single().title)
        assertTrue(CatalogLogic.resourcesForCategory(items, groups, 0).isEmpty())
    }
}
