package com.tifloacosta.nativeprototype

/** TalkBack action announcements shared across reader screens. */
internal object NativeReaderAccessibilityStrings {
    private val keys = listOf("nextValue", "previousOption", "nextOption", "of", "nextUnit", "previous", "next", "previousPosition", "nextPosition")
    private val translations = mapOf(
        "es" to listOf("Elegir el siguiente valor", "Opción anterior", "Opción siguiente", "de", "Siguiente unidad de lectura", "Anterior", "Siguiente", "Posición anterior", "Posición siguiente"),
        "en" to listOf("Choose next value", "Previous option", "Next option", "of", "Next reading unit", "Previous", "Next", "Previous position", "Next position"),
        "pt" to listOf("Escolher o valor seguinte", "Opção anterior", "Opção seguinte", "de", "Unidade de leitura seguinte", "Anterior", "Seguinte", "Posição anterior", "Posição seguinte"),
        "fr" to listOf("Choisir la valeur suivante", "Option précédente", "Option suivante", "sur", "Unité de lecture suivante", "Précédent", "Suivant", "Position précédente", "Position suivante"),
        "it" to listOf("Scegli il valore successivo", "Opzione precedente", "Opzione successiva", "di", "Unità di lettura successiva", "Precedente", "Successivo", "Posizione precedente", "Posizione successiva"),
        "de" to listOf("Nächsten Wert wählen", "Vorherige Option", "Nächste Option", "von", "Nächste Leseeinheit", "Zurück", "Weiter", "Vorherige Position", "Nächste Position")
    )
    fun get(language: String, key: String): String {
        val index = keys.indexOf(key)
        if (index < 0) return key
        return (translations[language] ?: translations.getValue("es"))[index]
    }
}
