package com.tifloacosta.nativeprototype

/** Accessibility action names for adjustable home selectors. */
internal object NativeHomeAdjustableStrings {
    private val keys = listOf("previous", "next", "trial")
    private val catalog = mapOf(
        "es" to listOf("Opción anterior", "Opción siguiente", "TifloAcosta Nativa Pruebas"),
        "en" to listOf("Previous option", "Next option", "TifloAcosta Native Trial"),
        "pt" to listOf("Opção anterior", "Opção seguinte", "TifloAcosta Nativa de Testes"),
        "fr" to listOf("Option précédente", "Option suivante", "TifloAcosta Native – Essai"),
        "it" to listOf("Opzione precedente", "Opzione successiva", "TifloAcosta Nativa – Prova"),
        "de" to listOf("Vorherige Option", "Nächste Option", "TifloAcosta Native Testversion")
    )
    init { require(catalog.values.all { it.size == keys.size }) }
    fun get(language: String, key: String): String {
        val index = keys.indexOf(key)
        require(index >= 0) { "Unknown home accessibility label: $key" }
        return (catalog[language] ?: catalog.getValue("es"))[index]
    }
}
