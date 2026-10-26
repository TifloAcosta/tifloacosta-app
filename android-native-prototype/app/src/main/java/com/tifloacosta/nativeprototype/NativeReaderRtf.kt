package com.tifloacosta.nativeprototype

import java.nio.charset.Charset

/** Conservative plain-text RTF extractor: paragraphs, tabs, Unicode and Windows-1252 escapes. */
object NativeReaderRtf {
    private val ignored = setOf("fonttbl", "colortbl", "stylesheet", "info", "pict", "object",
        "header", "footer", "headerl", "headerr", "footerl", "footerr")

    fun extract(source: String): String {
        if (!source.trimStart().startsWith("{\\rtf")) {
            throw java.io.IOException("El archivo RTF no tiene una cabecera válida.")
        }
        val output = StringBuilder()
        val hidden = ArrayDeque<Boolean>()
        var skip = false
        var unicodeFallback = 1
        var i = 0
        while (i < source.length) {
            val ch = source[i++]
            when (ch) {
                '{' -> hidden.addLast(skip)
                '}' -> skip = if (hidden.isNotEmpty()) hidden.removeLast() else false
                '\\' -> {
                    if (i >= source.length) break
                    val next = source[i]
                    if (next == '\\' || next == '{' || next == '}') {
                        if (!skip) output.append(next)
                        i++
                        continue
                    }
                    if (next == '\'' && i + 2 < source.length) {
                        val hex = source.substring(i + 1, i + 3).toIntOrNull(16)
                        if (hex != null && !skip) {
                            output.append(byteArrayOf(hex.toByte()).toString(Charset.forName("windows-1252")))
                        }
                        i += 3
                        continue
                    }
                    if (!next.isLetter()) {
                        if (next == '*' || next == '~') {
                            if (next == '*') skip = true
                            else if (!skip) output.append(' ')
                        }
                        i++
                        continue
                    }
                    val wordStart = i
                    while (i < source.length && source[i].isLetter()) i++
                    val word = source.substring(wordStart, i)
                    val numberStart = i
                    if (i < source.length && source[i] == '-') i++
                    while (i < source.length && source[i].isDigit()) i++
                    val numeric = source.substring(numberStart, i).toIntOrNull()
                    if (i < source.length && source[i] == ' ') i++
                    if (word in ignored) skip = true
                    if (!skip) when (word) {
                        "par", "line", "row" -> output.append('\n')
                        "tab", "cell" -> output.append('\t')
                        "uc" -> unicodeFallback = (numeric ?: 1).coerceIn(0, 10)
                        "u" -> {
                            numeric?.let { value ->
                                val codepoint = if (value < 0) value + 65536 else value
                                if (codepoint in 0..65535) output.append(codepoint.toChar())
                            }
                            var remaining = unicodeFallback
                            while (remaining > 0 && i < source.length && source[i] !in "{}") {
                                if (source[i] == '\\' && i + 3 < source.length &&
                                    source[i + 1] == '\'') i += 4
                                else i++
                                remaining--
                            }
                        }
                    }
                }
                else -> if (!skip) output.append(ch)
            }
            if (output.length >= 6 * 1024 * 1024) break
        }
        return output.toString().replace(Regex("[\\t ]+\\n"), "\n")
            .replace(Regex("\\n{4,}"), "\n\n").trim()
    }
}
