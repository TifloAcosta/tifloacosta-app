package com.tifloacosta.nativeprototype

import java.util.Calendar

object NativeReaderBookFilters {
    val formatFiltersEs = listOf(
        "Todos", "Textos", "PDF", "EPUB", "Office", "Audio y DAISY",
        "Con marcas", "Favoritos", "Importados hoy", "Últimos siete días", "Último mes",
        "Imágenes con OCR"
    )
    val formatFiltersEn = listOf(
        "All", "Text", "PDF", "EPUB", "Office", "Audio and DAISY",
        "With bookmarks", "Favorites", "Imported today", "Last seven days", "Last month",
        "OCR images"
    )
    val sortEs = listOf("Más recientes", "Más antiguos", "Título A a Z", "Título Z a A", "Formato")
    val sortEn = listOf("Newest", "Oldest", "Title A to Z", "Title Z to A", "Format")

    fun apply(
        books: List<ReaderBook>, filter: Int = 0, order: Int = 0,
        folder: String = "", now: Long = System.currentTimeMillis()
    ): List<ReaderBook> {
        val calendar = Calendar.getInstance()
        calendar.timeInMillis = now
        val startDay = calendar.run {
            set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0)
            timeInMillis
        }
        val filtered = books.filter { b ->
            if (folder == "__none__" && b.folder.isNotBlank()) return@filter false
            if (folder.isNotBlank() && folder != "__none__" && b.folder != folder) return@filter false
            when (filter) {
                1 -> b.format in setOf("txt", "text", "md", "markdown",
                    "html", "htm", "rtf", "csv", "json", "xml", "log", "srt")
                2 -> b.format == "pdf"
                3 -> b.format == "epub"
                4 -> b.format in setOf("docx", "pptx", "ppsx", "xlsx", "odt", "ods", "odp")
                5 -> b.tracks.isNotEmpty() || b.format == "daisy"
                6 -> b.marks.isNotEmpty()
                7 -> b.favorite
                8 -> b.createdAt >= startDay
                9 -> b.createdAt >= now - 7L * 24 * 60 * 60 * 1000
                10 -> b.createdAt >= now - 31L * 24 * 60 * 60 * 1000
                11 -> b.format in setOf("jpg", "jpeg", "png", "webp", "bmp", "heic", "heif")
                else -> true
            }
        }
        return when (order) {
            1 -> filtered.sortedBy { it.createdAt }
            2 -> filtered.sortedBy { it.title.lowercase() }
            3 -> filtered.sortedByDescending { it.title.lowercase() }
            4 -> filtered.sortedWith(compareBy<ReaderBook> { it.format }.thenBy { it.title })
            else -> filtered.sortedByDescending { it.createdAt }
        }
    }
}
