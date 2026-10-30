package com.tifloacosta.nativeprototype

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.Locale

data class CatalogItem(
    val id: String,
    val title: String,
    val language: String,
    val category: String,
    val categories: List<String>,
    val summary: String,
    val url: String,
    val isNew: Boolean = false,
    val newsDate: String = ""
)

data class Catalog(val news: List<CatalogItem> = emptyList(), val resources: List<CatalogItem> = emptyList(), val videos: List<CatalogItem> = emptyList())

data class CatalogLoad(val catalog: Catalog, val status: String = "")

object CatalogLogic {
    fun newsCategories(items: List<CatalogItem>): List<String> =
        items.flatMap { it.categories }.filter { it.isNotBlank() }.distinct().sorted()
    fun resourceCategories(items: List<CatalogItem>): List<String> =
        items.map { it.category }.filter { it.isNotBlank() }.distinct().sorted()

    // News index 0 = choose; 1 = all; 2+ = one category.
    fun newsForCategory(items: List<CatalogItem>, categories: List<String>, selected: Int): List<CatalogItem> {
        if (selected == 0) return emptyList()
        val filtered = if (selected == 1) items
            else categories.getOrNull(selected - 2)?.let { key -> items.filter { key in it.categories } }.orEmpty()
        return filtered.sortedByDescending { it.id }
    }

    // Resources index 0 = choose; 1+ = a chosen category.
    fun resourcesForCategory(items: List<CatalogItem>, categories: List<String>, selected: Int): List<CatalogItem> {
        val key = categories.getOrNull(selected - 1) ?: return emptyList()
        return items.filter { it.category == key }
    }

    fun categoryLabel(key: String): String = when(key) {
        "apple" -> "Apple"
        "android" -> "Android"
        "windows" -> "Windows"
        "jaws" -> "JAWS"
        "nvda" -> "NVDA"
        "apps-accesibles" -> "Apps accesibles"
        "programas-accesibles" -> "Programas accesibles"
        "gafas-inteligentes" -> "Gafas inteligentes"
        "productos-disponibles" -> "Productos disponibles"
        "proyectos-prototipos" -> "Proyectos y prototipos"
        "tecnologia-accesibilidad" -> "Tecnología y accesibilidad"
        "ia-accesibilidad" -> "Inteligencia artificial y accesibilidad"
        "braille" -> "Braille y comunicación accesible"
        "movilidad" -> "Movilidad, orientación y autonomía"
        "sordoceguera" -> "Tecnología para personas sordociegas"
        "tecnologia-general" -> "Tecnología general"
        else -> key.replace("-", " ").replaceFirstChar { it.titlecase(Locale.getDefault()) }
    }
}

object CatalogRepository {
    private const val CATALOG_URL = "https://tifloacosta.com/mobile-content.json"
    private const val CACHE_FILE = "native-prototype-catalog.json"

    private fun parse(jsonText: String): Catalog {
        val root = JSONObject(jsonText)
        require(root.optInt("schemaVersion") == 1) { "Versión de catálogo desconocida" }

        fun records(key: String): List<CatalogItem> {
            val data = root.optJSONArray(key) ?: return emptyList()
            return (0 until data.length()).mapNotNull { i ->
                val o = data.optJSONObject(i) ?: return@mapNotNull null
                val categories = o.optJSONArray("categories")?.let { a ->
                    (0 until a.length()).map { index -> a.optString(index) }
                } ?: listOfNotNull(o.optString("category").takeIf { it.isNotBlank() })
                CatalogItem(
                    id = o.optString("id"), title = o.optString("title"),
                    language = o.optString("lang", "es"),
                    category = o.optString("category"), categories = categories,
                    summary = listOf("summary", "excerpt", "description", "body")
                        .firstNotNullOfOrNull { field -> o.optString(field).takeIf { it.isNotBlank() } }.orEmpty(),
                    url = listOf("originalUrl", "openUrl", "url")
                        .firstNotNullOfOrNull { field -> o.optString(field).takeIf { it.isNotBlank() } }.orEmpty(),
                    isNew = o.optBoolean("isNew", false),
                    newsDate = o.optString("newsDate", "")
                )
            }
        }
        return Catalog(records("news"), records("resources"), records("videos"))
    }

    suspend fun load(context: Context): CatalogLoad = withContext(Dispatchers.IO) {
        val cache = context.getFileStreamPath(CACHE_FILE)
        try {
            val connection = URL(CATALOG_URL).openConnection() as HttpURLConnection
            connection.connectTimeout = 15000
            connection.readTimeout = 15000
            connection.setRequestProperty("Accept", "application/json")
            val bytes = try {
                check(connection.responseCode == 200) { "Catálogo no disponible" }
                connection.inputStream.use { it.readBytes() }
            } finally { connection.disconnect() }
            val json = bytes.toString(Charsets.UTF_8)
            val catalog = parse(json)
            // Cache only after successful schema validation.
            context.openFileOutput(CACHE_FILE, Context.MODE_PRIVATE).use { it.write(bytes) }
            CatalogLoad(catalog)
        } catch (error: Exception) {
            if (cache.isFile) {
                try {
                    CatalogLoad(parse(cache.readText()), "Sin conexión. Se muestra el catálogo guardado.")
                } catch (_: Exception) {
                    CatalogLoad(Catalog(), "No se pudo cargar el catálogo.")
                }
            } else {
                CatalogLoad(Catalog(), "No se pudo cargar el catálogo. Comprueba la conexión.")
            }
        }
    }
}
