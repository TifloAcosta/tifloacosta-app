package com.tifloacosta.nativeprototype

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class CatalogLogicTest {
    private val android = CatalogItem("1", "Noticia Android", "es", "", listOf("android"), "", "")
    private val apple = CatalogItem("2", "Noticia Apple", "es", "", listOf("apple"), "", "")

    @Test fun newsHasNoResultsUntilAFilterIsChosen() {
        val items = listOf(android, apple)
        assertTrue(CatalogLogic.newsForCategory(items, listOf("android", "apple"), 0).isEmpty())
        assertEquals(2, CatalogLogic.newsForCategory(items, listOf("android", "apple"), 1).size)
        assertEquals(listOf(android), CatalogLogic.newsForCategory(items, listOf("android", "apple"), 2))
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
