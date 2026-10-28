package com.tifloacosta.nativeprototype

/** Navigation that does not modify the saved book format or TTS segmentation. */
internal object ReaderNavigation {
    // These are genuine, recognizable section headings, not guessed "pages".
    private val heading = Regex(
        "(?ium)^[ \\t]*(?:cap[ií]tulo|chapter|secci[oó]n|section|parte|part|libro|book)\\s+" +
            "(?:[0-9]+|[IVXLCDM]+)(?:\\b|[.:])[^\\r\\n]{0,90}"
    )

    /** Include the introductory text before chapter one, if it exists. */
    fun chapterStarts(text: String): List<Int> {
        val offsets = heading.findAll(text).map { it.range.first }.toList()
        return if (offsets.isEmpty()) emptyList() else (listOf(0) + offsets).distinct()
    }

    fun nextWordStart(text: String, current: Int): Int {
        if (text.isBlank()) return 0
        var i = current.coerceIn(0, text.length)
        while (i < text.length && !text[i].isWhitespace()) i++
        while (i < text.length && text[i].isWhitespace()) i++
        return if (i < text.length) i else current.coerceIn(0, text.length)
    }

    fun previousWordStart(text: String, current: Int): Int {
        if (text.isBlank() || current <= 0) return 0
        var i = (current - 1).coerceAtMost(text.lastIndex)
        while (i > 0 && text[i].isWhitespace()) i--
        while (i > 0 && !text[i - 1].isWhitespace()) i--
        return i
    }

    fun wordAt(text: String, current: Int): String {
        if (text.isBlank()) return ""
        var start = current.coerceIn(0, text.lastIndex)
        while (start < text.lastIndex && text[start].isWhitespace()) start++
        while (start > 0 && !text[start - 1].isWhitespace()) start--
        var end = start
        while (end < text.length && !text[end].isWhitespace()) end++
        return text.substring(start, end).take(65)
    }

    /** Each action moves ten percentage POINTS relative to actual read progress. */
    fun percentageStep(offset: Int, length: Int, forward: Boolean): Int {
        if (length <= 0) return 0
        val here = offset.coerceIn(0, length)
        val currentPercent = ReaderUnits.percent(here, length)
        val target = (currentPercent + if (forward) 10 else -10).coerceIn(0, 100)
        val targetOffset = ((target.toLong() * length + 50) / 100L).toInt().coerceIn(0, length)
        return if (forward && targetOffset <= here && here < length) here + 1
        else if (!forward && targetOffset >= here && here > 0) here - 1
        else targetOffset
    }
}
