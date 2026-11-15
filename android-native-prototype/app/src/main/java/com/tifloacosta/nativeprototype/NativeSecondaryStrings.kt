package com.tifloacosta.nativeprototype

/** Secondary native screen chrome; original catalog text remains unchanged. */
internal object NativeSecondaryStrings {
    private val keys = listOf("favorite","noDescription","remove","add","openSource","close","searchLabel","empty","result","backDownloads","sounds","youtubeResults","searchVideos")
    private val catalog = mapOf(
        "es" to listOf("Favorito","Sin descripción adicional","Quitar favorito","Añadir a favoritos","Abrir origen","Cerrar","Buscar noticias, recursos y vídeos","Sin resultados","resultados","Volver a Descargas","Buscar efectos de sonido","Resultados públicos de YouTube","Buscar vídeos"),
        "en" to listOf("Favorite","No additional description","Remove favorite","Add favorite","Open source","Close","Search news, resources and videos","No results","results","Back to Downloads","Search sound effects","Public YouTube results","Search videos"),
        "pt" to listOf("Favorito","Sem descrição adicional","Remover favorito","Adicionar aos favoritos","Abrir origem","Fechar","Pesquisar notícias, recursos e vídeos","Sem resultados","resultados","Voltar a Transferências","Pesquisar efeitos sonoros","Resultados públicos do YouTube","Pesquisar vídeos"),
        "fr" to listOf("Favori","Aucune description supplémentaire","Retirer des favoris","Ajouter aux favoris","Ouvrir la source","Fermer","Rechercher actualités, ressources et vidéos","Aucun résultat","résultats","Retour aux téléchargements","Rechercher des effets sonores","Résultats publics YouTube","Rechercher des vidéos"),
        "it" to listOf("Preferito","Nessuna descrizione aggiuntiva","Rimuovi dai preferiti","Aggiungi ai preferiti","Apri fonte","Chiudi","Cerca notizie, risorse e video","Nessun risultato","risultati","Torna ai download","Cerca effetti sonori","Risultati pubblici YouTube","Cerca video"),
        "de" to listOf("Favorit","Keine weitere Beschreibung","Favorit entfernen","Zu Favoriten hinzufügen","Quelle öffnen","Schließen","Nachrichten, Ressourcen und Videos suchen","Keine Ergebnisse","Ergebnisse","Zurück zu Downloads","Soundeffekte suchen","Öffentliche YouTube-Ergebnisse","Videos suchen")
    )
    fun get(language: String, key: String): String {
        val index = keys.indexOf(key)
        if (index < 0) return key
        return (catalog[language] ?: catalog.getValue("es"))[index]
    }
}
