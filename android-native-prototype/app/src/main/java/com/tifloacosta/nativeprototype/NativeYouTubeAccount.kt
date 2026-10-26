package com.tifloacosta.nativeprototype

import android.content.Context
import android.net.Uri
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.security.KeyStore
import java.security.MessageDigest
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

data class AccountVideoState(
    val subscribed: Boolean? = null,
    val rating: String? = null
)

/**
 * Uses TifloAcosta's existing YouTube Worker; OAuth happens in the external
 * browser, never in an embedded WebView. Google password and refresh token
 * remain outside this app. Only a short-lived encrypted service ticket is stored.
 */
class NativeYouTubeAccount(private val context: Context) {
    companion object {
        const val BASE = "https://youtube-auth.tifloacosta.com"
        private const val CALLBACK_SCHEME = "tifloacosta"
        private const val KEY_ALIAS = "tifloacosta-native-youtube"
        private const val PREFS = "youtube-native-private"
        private const val TOKEN_KEY = "encrypted-ticket"
        private const val EXPIRY_KEY = "expiry"
        private const val VERIFIER_KEY = "pending-verifier"
    }

    private val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    private var ticket: String? = restore()
    private var expiry: Long = prefs.getLong(EXPIRY_KEY, 0L)
    var authenticated by mutableStateOf(ticket != null && expiry > System.currentTimeMillis())
        private set
    var busy by mutableStateOf(false)
        private set
    var message by mutableStateOf("")
        private set
    var videoState by mutableStateOf(AccountVideoState())
        private set

    private fun aesKey(): SecretKey {
        val keystore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (keystore.getKey(KEY_ALIAS, null) as? SecretKey)?.let { return it }
        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        generator.init(
            KeyGenParameterSpec.Builder(
                KEY_ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build()
        )
        return generator.generateKey()
    }

    private fun b64(bytes: ByteArray): String =
        Base64.encodeToString(bytes, Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING)

    private fun un64(value: String): ByteArray =
        Base64.decode(value, Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING)

    private fun persist(raw: String, expires: Long) {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, aesKey())
        val encoded = b64(cipher.iv) + "." + b64(cipher.doFinal(raw.toByteArray(Charsets.UTF_8)))
        prefs.edit().putString(TOKEN_KEY, encoded).putLong(EXPIRY_KEY, expires).apply()
        ticket = raw
        expiry = expires
        authenticated = true
    }

    private fun restore(): String? {
        return try {
            val expires = prefs.getLong(EXPIRY_KEY, 0L)
            if (expires <= System.currentTimeMillis()) return null
            val parts = prefs.getString(TOKEN_KEY, null)?.split('.') ?: return null
            if (parts.size != 2) return null
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(Cipher.DECRYPT_MODE, aesKey(), GCMParameterSpec(128, un64(parts[0])))
            String(cipher.doFinal(un64(parts[1])), Charsets.UTF_8)
        } catch (_: Exception) { null }
    }

    fun startAuthorization(): Uri {
        val random = ByteArray(32).also { SecureRandom().nextBytes(it) }
        val verifier = b64(random)
        val challenge = b64(MessageDigest.getInstance("SHA-256").digest(verifier.toByteArray()))
        prefs.edit().putString(VERIFIER_KEY, verifier).apply()
        message = "Abriendo identificación segura de Google."
        return Uri.parse(BASE).buildUpon()
            .appendPath("auth").appendPath("native").appendPath("start")
            .appendQueryParameter("challenge", challenge)
            .build()
    }

    private fun expire() {
        prefs.edit().remove(TOKEN_KEY).remove(EXPIRY_KEY).apply()
        ticket = null
        expiry = 0
        authenticated = false
        videoState = AccountVideoState()
    }

    fun signOut() {
        expire()
        message = "Sesión de YouTube cerrada en TifloAcosta."
    }

    private fun errorText(error: String): String = when (error) {
        "COMMENTS_DISABLED" -> "Los comentarios están desactivados en este vídeo."
        "SESSION_EXPIRED", "NATIVE_AUTH_INVALID" ->
            "La sesión ha caducado o la autorización no es válida. Conecta Google de nuevo."
        "QUOTA_EXCEEDED", "RATE_LIMITED" -> "Se ha alcanzado temporalmente el límite de YouTube."
        "INSUFFICIENT_PERMISSIONS" -> "Google no concedió los permisos necesarios."
        "INELIGIBLE_ACCOUNT" -> "La cuenta de YouTube no permite esta acción."
        "NETWORK" -> "No se pudo conectar con el servicio de YouTube."
        else -> "No se pudo completar la operación con YouTube."
    }

    private suspend fun api(path: String, method: String = "GET",
                            body: JSONObject? = null, bearer: String? = ticket): JSONObject =
        withContext(Dispatchers.IO) {
            val url = URL(BASE + "/" + path.removePrefix("/"))
            require(url.protocol == "https" && url.host == "youtube-auth.tifloacosta.com")
            val connection = url.openConnection() as HttpURLConnection
            connection.connectTimeout = 15000
            connection.readTimeout = 20000
            connection.requestMethod = method
            connection.setRequestProperty("Accept", "application/json")
            if (!bearer.isNullOrBlank()) connection.setRequestProperty("Authorization", "Bearer $bearer")
            if (body != null) {
                connection.doOutput = true
                connection.setRequestProperty("Content-Type", "application/json")
                connection.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
            }
            try {
                val code = connection.responseCode
                val input = if (code in 200..299) connection.inputStream else connection.errorStream
                val content = input?.use { it.readBytes().take(128_000).toByteArray().toString(Charsets.UTF_8) }.orEmpty()
                val data = try { JSONObject(content) } catch (_: Exception) { JSONObject() }
                if (code !in 200..299) throw IllegalStateException(data.optString("error", "NETWORK"))
                data
            } finally {
                connection.disconnect()
            }
        }

    suspend fun acceptCallback(uri: Uri) {
        if (uri.scheme != CALLBACK_SCHEME || uri.host != "youtube-auth") return
        val verifier = prefs.getString(VERIFIER_KEY, null)
        prefs.edit().remove(VERIFIER_KEY).apply()
        val rejected = uri.getQueryParameter("error")
        if (rejected != null) {
            message = "Google no completó la autorización. Comprueba los permisos e inténtalo de nuevo."
            return
        }
        val ticketFromCallback = uri.getQueryParameter("ticket")
        if (ticketFromCallback.isNullOrBlank() || verifier.isNullOrBlank()) {
            message = "La autorización no devolvió un código válido."
            return
        }
        busy = true
        try {
            val exchange = api(
                "auth/native/exchange", "POST",
                JSONObject().put("ticket", ticketFromCallback).put("verifier", verifier),
                bearer = ""
            )
            val token = exchange.optString("token")
            val expires = exchange.optLong("expiresAt", 0)
            check(exchange.optBoolean("authenticated") && token.isNotBlank() &&
                expires > System.currentTimeMillis())
            persist(token, expires)
            message = "Sesión de YouTube iniciada."
        } catch (e: Exception) {
            message = errorText(e.message.orEmpty())
        } finally { busy = false }
    }

    suspend fun checkSession() {
        if (!authenticated) return
        if (expiry <= System.currentTimeMillis()) { expire(); return }
        try {
            val data = api("session")
            if (!data.optBoolean("authenticated")) expire()
        } catch (_: Exception) { /* A network failure should not discard the user's authorization. */ }
    }

    suspend fun loadVideoState(videoId: String) {
        videoState = AccountVideoState()
        if (!authenticated || MediaLogic.youTubeVideoId("https://youtu.be/$videoId") != videoId) return
        try {
            val state = api("state?videoId=" + Uri.encode(videoId))
            videoState = AccountVideoState(
                subscribed = if (state.has("subscribed")) state.optBoolean("subscribed") else null,
                rating = state.optString("rating")
            )
        } catch (e: Exception) { message = errorText(e.message.orEmpty()) }
    }

    suspend fun act(action: String, videoId: String, comment: String? = null): Boolean {
        if (!authenticated || busy ||
            action !in setOf("like", "subscribe", "comment") ||
            MediaLogic.youTubeVideoId("https://youtu.be/$videoId") != videoId) return false
        if (action == "comment" && comment.isNullOrBlank()) {
            message = "Escribe un comentario antes de publicarlo."
            return false
        }
        busy = true
        return try {
            val body = JSONObject().put("videoId", videoId)
            if (comment != null) body.put("text", comment.trim())
            val result = api(action, "POST", body)
            videoState = videoState.copy(
                rating = result.optString("rating").takeIf { it.isNotBlank() } ?: videoState.rating,
                subscribed = if (result.has("subscribed")) result.optBoolean("subscribed")
                    else videoState.subscribed
            )
            message = when (action) {
                "like" -> "Me gusta añadido."
                "subscribe" -> "Suscripción realizada."
                else -> "Comentario publicado en YouTube."
            }
            true
        } catch (e: Exception) {
            if (e.message == "SESSION_EXPIRED") expire()
            message = errorText(e.message.orEmpty())
            false
        } finally { busy = false }
    }
}
