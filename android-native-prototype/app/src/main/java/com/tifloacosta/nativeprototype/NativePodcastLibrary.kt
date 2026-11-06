package com.tifloacosta.nativeprototype

import android.content.Context
import android.net.Uri
import android.util.Xml
import org.json.JSONArray
import org.json.JSONObject
import org.xmlpull.v1.XmlPullParser

data class NativeFollowedPodcast(val title: String, val url: String)

/** Local podcast subscriptions and favorite episodes; no remote account required. */
internal class NativePodcastLibrary(context: Context) {
    private val app = context.applicationContext
    private val prefs = app.getSharedPreferences("native-podcast-library-v1", Context.MODE_PRIVATE)

    fun favorites(): Set<String> = prefs.getStringSet("favorites", emptySet()).orEmpty().toSet()
    fun isFavorite(url: String): Boolean = url in favorites()

    fun toggleFavorite(url: String): Boolean {
        val next = favorites().toMutableSet()
        if (!next.add(url)) next.remove(url)
        check(prefs.edit().putStringSet("favorites", next).commit()) { "No se guardaron los favoritos." }
        return url in next
    }

    fun subscriptions(): List<NativeFollowedPodcast> {
        val data = JSONArray(prefs.getString("followed", "[]"))
        return (0 until data.length()).mapNotNull { i ->
            val item = data.optJSONObject(i) ?: return@mapNotNull null
            val url = item.optString("url")
            if (!validFeed(url)) null else NativeFollowedPodcast(item.optString("title"), url)
        }
    }

    private fun validFeed(url: String): Boolean {
        val uri = Uri.parse(url)
        return uri.scheme in setOf("https", "http") && !uri.host.isNullOrBlank()
    }

    fun follow(title: String, url: String): Boolean {
        if (!validFeed(url)) return false
        val previous = subscriptions()
        if (previous.any { it.url == url }) return false
        save(previous + NativeFollowedPodcast(title.take(200), url))
        return true
    }

    fun unfollow(url: String) {
        save(subscriptions().filterNot { it.url == url })
    }

    private fun save(items: List<NativeFollowedPodcast>) {
        val array = JSONArray()
        items.forEach { array.put(JSONObject().put("title", it.title).put("url", it.url)) }
        check(prefs.edit().putString("followed", array.toString()).commit()) {
            "No se guardaron las suscripciones."
        }
    }

    fun importOPML(source: Uri): Int {
        val input = app.contentResolver.openInputStream(source) ?: error("No se puede abrir OPML.")
        val before = subscriptions().size
        input.use { stream ->
            val bounded = java.io.ByteArrayOutputStream()
            val buffer = ByteArray(8192)
            var total = 0
            while (true) {
                val n = stream.read(buffer)
                if (n < 0) break
                total += n
                require(total <= 2_000_000) { "El OPML supera 2 MB." }
                bounded.write(buffer, 0, n)
            }
            val parser = Xml.newPullParser()
            parser.setFeature(XmlPullParser.FEATURE_PROCESS_NAMESPACES, false)
            parser.setInput(bounded.toByteArray().inputStream(), "UTF-8")
            var event = parser.eventType
            var count = 0
            while (event != XmlPullParser.END_DOCUMENT && count < 500) {
                if (event == XmlPullParser.START_TAG && parser.name == "outline") {
                    val feed = parser.getAttributeValue(null, "xmlUrl")
                    val title = parser.getAttributeValue(null, "title")
                        ?: parser.getAttributeValue(null, "text") ?: "Pódcast"
                    if (!feed.isNullOrBlank()) {
                        follow(title, feed)
                        count++
                    }
                }
                event = parser.next()
            }
        }
        return subscriptions().size - before
    }
}
