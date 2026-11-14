package com.tifloacosta.nativeprototype

import java.util.Calendar

object NativeReaderBookFilters {
    val formatFiltersEs = listOf(
        "Todos", "Textos", "PDF", "Libros electrónicos", "Office", "Audio y DAISY",
        "Con marcas", "Favoritos", "Importados hoy", "Últimos siete días", "Último mes",
        "Imágenes con OCR", "Cola de lectura", "En curso", "Terminados"
    )
    val formatFiltersEn = listOf(
        "All", "Text", "PDF", "Ebooks", "Office", "Audio and DAISY",
        "With bookmarks", "Favorites", "Imported today", "Last seven days", "Last month",
        "OCR images", "Reading queue", "In progress", "Finished"
    )
    val sortEs = listOf("Más recientes", "Más antiguos", "Título A a Z", "Título Z a A", "Formato", "Última lectura", "Último abierto")
    val sortEn = listOf("Newest", "Oldest", "Title A to Z", "Title Z to A", "Format", "Last read", "Last opened")

    private val localizedFilters = mapOf(
        "pt" to listOf("Todos", "Textos", "PDF", "Livros eletrónicos", "Office", "Áudio e DAISY", "Com marcadores", "Favoritos", "Importados hoje", "Últimos sete dias", "Último mês", "Imagens com OCR", "Fila de leitura", "Em curso", "Concluídos"),
        "fr" to listOf("Tous", "Textes", "PDF", "Livres numériques", "Office", "Audio et DAISY", "Avec signets", "Favoris", "Importés aujourd’hui", "Sept derniers jours", "Dernier mois", "Images avec OCR", "Liste de lecture", "En cours", "Terminés"),
        "it" to listOf("Tutti", "Testi", "PDF", "Libri elettronici", "Office", "Audio e DAISY", "Con segnalibri", "Preferiti", "Importati oggi", "Ultimi sette giorni", "Ultimo mese", "Immagini con OCR", "Coda di lettura", "In corso", "Completati"),
        "de" to listOf("Alle", "Texte", "PDF", "E-Books", "Office", "Audio und DAISY", "Mit Lesezeichen", "Favoriten", "Heute importiert", "Letzte sieben Tage", "Letzter Monat", "Bilder mit OCR", "Lesewarteschlange", "In Bearbeitung", "Abgeschlossen")
    )
    private val localizedSort = mapOf(
        "pt" to listOf("Mais recentes", "Mais antigos", "Título A a Z", "Título Z a A", "Formato", "Última leitura", "Última abertura"),
        "fr" to listOf("Plus récents", "Plus anciens", "Titre A à Z", "Titre Z à A", "Format", "Dernière lecture", "Dernière ouverture"),
        "it" to listOf("Più recenti", "Più vecchi", "Titolo A-Z", "Titolo Z-A", "Formato", "Ultima lettura", "Ultima apertura"),
        "de" to listOf("Neueste zuerst", "Älteste zuerst", "Titel A bis Z", "Titel Z bis A", "Format", "Zuletzt gelesen", "Zuletzt geöffnet")
    )

    fun formatFilters(language: String): List<String> = when (language) {
        "es" -> formatFiltersEs
        "en" -> formatFiltersEn
        else -> localizedFilters[language] ?: formatFiltersEs
    }

    fun sortChoices(language: String): List<String> = when (language) {
        "es" -> sortEs
        "en" -> sortEn
        else -> localizedSort[language] ?: sortEs
    }

    fun apply(
        books: List<ReaderBook>, filter: Int = 0, order: Int = 0,
        folder: String = "", now: Long = System.currentTimeMillis(),
        queueIds: List<String> = emptyList()
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
            if (folder.isNotBlank() && folder != "__none__" &&
                !b.folder.equals(folder, ignoreCase = true)) return@filter false
            when (filter) {
                1 -> b.format in setOf("txt", "text", "md", "markdown",
                    "html", "htm", "rtf", "csv", "json", "xml", "log", "srt")
                2 -> b.format == "pdf"
                3 -> b.format in setOf("epub", "fb2", "mobi", "prc", "pdb", "azw", "azw3")
                4 -> b.format in setOf("docx", "pptx", "ppsx", "xlsx", "odt", "ods", "odp",
                    "doc", "xls", "ppt", "pps")
                5 -> b.tracks.isNotEmpty() || b.format == "daisy"
                6 -> b.marks.isNotEmpty() || b.audioMarks.isNotEmpty()
                7 -> b.favorite
                8 -> b.createdAt >= startDay
                9 -> b.createdAt >= now - 7L * 24 * 60 * 60 * 1000
                10 -> b.createdAt >= now - 31L * 24 * 60 * 60 * 1000
                11 -> b.format in setOf("jpg", "jpeg", "png", "webp", "bmp", "heic", "heif")
                12 -> b.id in queueIds
                13 -> b.lastReadAt > 0 && !b.finished
                14 -> b.finished
                else -> true
            }
        }
        if (filter == 12) return filtered.sortedBy { queueIds.indexOf(it.id) }
        return when (order) {
            1 -> filtered.sortedBy { it.createdAt }
            2 -> filtered.sortedBy { it.title.lowercase() }
            3 -> filtered.sortedByDescending { it.title.lowercase() }
            4 -> filtered.sortedWith(compareBy<ReaderBook> { it.format }.thenBy { it.title })
            5 -> filtered.sortedWith(compareByDescending<ReaderBook> { it.lastReadAt }.thenBy { it.title.lowercase() })
            6 -> filtered.sortedWith(compareByDescending<ReaderBook> { it.lastOpenedAt }.thenBy { it.title.lowercase() })
            else -> filtered.sortedByDescending { it.createdAt }
        }
    }
}

/** One TalkBack stop per title; additional details are opt-in, as on iOS. */
object NativeReaderRowPresentation {
    fun label(book: ReaderBook, progress: String, detail: Int, language: String): String {
        val basic = "${book.title}. $progress"
        if (detail <= 0) return basic
        val labels = when (language) {
            "en" -> listOf("Format", "Folder", "No folder")
            "pt" -> listOf("Formato", "Pasta", "Sem pasta")
            "fr" -> listOf("Format", "Dossier", "Sans dossier")
            "it" -> listOf("Formato", "Cartella", "Nessuna cartella")
            "de" -> listOf("Format", "Ordner", "Kein Ordner")
            else -> listOf("Formato", "Carpeta", "Sin carpeta")
        }
        val withFormat = "$basic. ${labels[0]}: ${book.format.uppercase()}"
        if (detail == 1) return withFormat
        return "$withFormat. ${labels[1]}: ${book.folder.ifBlank { labels[2] }}"
    }

    fun label(book: ReaderBook, progress: String, detail: Int, english: Boolean): String {
        return label(book, progress, detail, if (english) "en" else "es")
    }
}
