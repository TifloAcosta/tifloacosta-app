package com.tifloacosta.nativeprototype

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.MediaPlayer
import android.media.session.MediaSession
import android.media.session.PlaybackState
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.os.SystemClock
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import androidx.core.content.ContextCompat
import kotlinx.coroutines.flow.MutableStateFlow
import java.io.File
import java.util.Locale
import java.util.UUID

data class NativePlaybackSnapshot(
    val bookId: String = "",
    val title: String = "",
    val kind: String = "",
    val playing: Boolean = false,
    val segment: Int = 0,
    val segmentCount: Int = 0,
    val positionMs: Int = 0,
    val durationMs: Int = 0,
    val textOffset: Int = 0,
    val textLength: Int = 0,
    val error: String = "",
    val sleepMinutes: Int = 0,
    val audioMarks: List<ReaderAudioMark> = emptyList(),
    val textMarks: List<Int> = emptyList(),
    val synchronizedText: String = ""
)

/** Single audio owner independent of Compose. Keeps DAISY and TTS alive on lock screen. */
class NativeReaderPlaybackService : Service(), TextToSpeech.OnInitListener {
    companion object {
        const val ACTION_START_AUDIO = "reader.START_AUDIO"
        const val ACTION_START_TEXT = "reader.START_TEXT"
        const val ACTION_PLAY = "reader.PLAY"
        const val ACTION_PAUSE = "reader.PAUSE"
        const val ACTION_STOP = "reader.STOP"
        const val ACTION_TOGGLE = "reader.TOGGLE"
        const val ACTION_PREVIOUS = "reader.PREVIOUS"
        const val ACTION_NEXT = "reader.NEXT"
        const val ACTION_SKIP_BACK = "reader.SKIP_BACK"
        const val ACTION_SKIP_FORWARD = "reader.SKIP_FORWARD"
        const val ACTION_SEEK = "reader.SEEK"
        const val ACTION_SPEED = "reader.SPEED"
        const val ACTION_SLEEP = "reader.SLEEP"
        const val ACTION_BOOKMARK = "reader.BOOKMARK"
        const val ACTION_SEGMENT = "reader.SEGMENT"
        const val ACTION_UNIT = "reader.UNIT"
        const val EXTRA_SPEED = "speedPercent"
        const val EXTRA_SLEEP = "sleepMinutes"
        const val EXTRA_START_SEGMENT = "startSegment"
        const val EXTRA_START_POSITION = "startPosition"
        const val EXTRA_BOOK = "bookId"
        const val EXTRA_VALUE = "value"
        val snapshot = MutableStateFlow(NativePlaybackSnapshot())

        fun start(context: Context, bookId: String, audio: Boolean, speedPercent: Int = 100,
            sleepMinutes: Int = 0, segmentIndex: Int = -1, positionMs: Int = -1) {
            ContextCompat.startForegroundService(context,
                Intent(context, NativeReaderPlaybackService::class.java).apply {
                    action = if (audio) ACTION_START_AUDIO else ACTION_START_TEXT
                    putExtra(EXTRA_BOOK, bookId)
                    putExtra(EXTRA_SPEED, speedPercent)
                    putExtra(EXTRA_SLEEP, sleepMinutes)
                    putExtra(EXTRA_START_SEGMENT, segmentIndex)
                    putExtra(EXTRA_START_POSITION, positionMs)
                })
        }

        fun send(context: Context, action: String, bookId: String = "", value: Int = 0) {
            val command = Intent(context, NativeReaderPlaybackService::class.java).apply {
                this.action = action
                putExtra(EXTRA_BOOK, bookId)
                putExtra(EXTRA_VALUE, value)
            }
            // Only a user-started playback may create a new foreground service.
            if (action == ACTION_START_AUDIO || action == ACTION_START_TEXT) {
                ContextCompat.startForegroundService(context, command)
            } else if (snapshot.value.bookId.isNotBlank()) {
                context.startService(command)
            }
        }
    }

    private val handler = Handler(Looper.getMainLooper())
    private val store by lazy { NativeReaderStore(applicationContext) }
    private var session: MediaSession? = null
    private var manager: AudioManager? = null
    private var focusRequest: AudioFocusRequest? = null
    private var focused = false
    private var foreground = false
    private var playbackWakeLock: PowerManager.WakeLock? = null
    private var lastWakeRefreshMs = 0L
    private var player: MediaPlayer? = null
    private var tts: TextToSpeech? = null
    private var ttsReady = false
    private var pendingUtterance = ""
    private var book: ReaderBook? = null
    private var kind = ""
    private var segments = emptyList<ReaderAudioSegment>()
    private var audioPaths = emptyList<File>()
    private var segmentIndex = 0
    private var positionMs = 0
    private var durationMs = 0
    private var text = ""
    private var units = emptyList<ReadingUnit>()
    private var textOffset = 0
    private var textUnit = 1
    private var speed = 1f
    private var voiceId = ""
    private var playing = false
    private val focusRecovery = NativeReaderAudioFocusRecovery()
    private var remainingSleepMs = 0L
    private var lastTick = 0L

    private val audioAttributes = AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_MEDIA)
        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build()
    private val focusListener = AudioManager.OnAudioFocusChangeListener { change ->
        handler.post {
            when (change) {
                AudioManager.AUDIOFOCUS_LOSS -> {
                    focusRecovery.cancel()
                    pauseReading()
                }
                AudioManager.AUDIOFOCUS_LOSS_TRANSIENT,
                AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK -> {
                    // TalkBack speech can cause multiple transient focus losses.
                    // Do not erase the pending resume when already paused.
                    focusRecovery.transientLoss(playing)
                    if (playing) pauseReading(releaseFocus = false)
                }
                AudioManager.AUDIOFOCUS_GAIN -> {
                    if (focusRecovery.gained()) playReading()
                }
            }
        }
    }
    private val becomingNoisy = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action == AudioManager.ACTION_AUDIO_BECOMING_NOISY) {
                focusRecovery.cancel()
                pauseReading()
            }
        }
    }
    private var lastProgressWriteMs = 0L
    private val ticker = object : Runnable {
        override fun run() {
            if (playing) {
                val now = android.os.SystemClock.elapsedRealtime()
                if (remainingSleepMs > 0 && lastTick > 0) {
                    remainingSleepMs -= (now - lastTick).coerceAtLeast(0)
                    if (remainingSleepMs <= 0) {
                        pauseReading()
                        return
                    }
                }
                lastTick = now
                holdPlaybackWakeLock()
                if (kind == "audio") {
                    val observed = try { player?.currentPosition ?: positionMs }
                        catch (_: Exception) { positionMs }
                    positionMs = observed
                    val segment = segments.getOrNull(segmentIndex)
                    if (segment != null && segment.endMs > 0 &&
                        observed >= segment.endMs - 80) {
                        nextSegment()
                    } else {
                        publish()
                        // Notify UI every second but avoid a full metadata fsync
                        // every second on a long audiobook.
                        if (now - lastProgressWriteMs >= 10_000L) persist()
                    }
                }
                handler.postDelayed(this, 1000)
            }
        }
    }

    override fun onCreate() {
        super.onCreate()
        manager = getSystemService(AUDIO_SERVICE) as AudioManager
        // Foreground playback needs CPU uptime between short TTS utterances.
        // This does not keep the display on.
        playbackWakeLock = (getSystemService(POWER_SERVICE) as PowerManager)
            .newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "TifloAcosta:TifloLectorPlayback")
            .apply { setReferenceCounted(false) }
        (getSystemService(NOTIFICATION_SERVICE) as NotificationManager).createNotificationChannel(
            NotificationChannel("tiflolector-playback", "TifloLector: reproducción",
                NotificationManager.IMPORTANCE_LOW)
        )
        session = MediaSession(this, "TifloLector").apply {
            setCallback(object : MediaSession.Callback() {
                override fun onPlay() { resumeReading() }
                override fun onPause() { pauseReading() }
                override fun onStop() { stopReading() }
                override fun onSkipToNext() { nextSegment() }
                override fun onSkipToPrevious() { previousSegment() }
                override fun onSeekTo(pos: Long) { seekTo(pos.toInt()) }
                override fun onFastForward() { if (kind == "text") nextSegment() else seekTo(positionMs + 30000) }
                override fun onRewind() { if (kind == "text") previousSegment() else seekTo(positionMs - 30000) }
            })
            isActive = true
        }
        val filter = IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY)
        if (Build.VERSION.SDK_INT >= 33) registerReceiver(
            becomingNoisy, filter, Context.RECEIVER_NOT_EXPORTED
        ) else @Suppress("DEPRECATION") registerReceiver(becomingNoisy, filter)
        tts = TextToSpeech(applicationContext, this)
    }

    override fun onInit(status: Int) {
        handler.post {
            ttsReady = status == TextToSpeech.SUCCESS
            if (ttsReady) {
                tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                    override fun onStart(utteranceId: String?) {}
                    override fun onDone(utteranceId: String?) {
                        handler.post {
                            if (utteranceId == pendingUtterance && playing && kind == "text") {
                                val unitsNow = units
                                val currentIndex = ReaderUnits.indexForOffset(unitsNow, textOffset)
                                val next = unitsNow.getOrNull(currentIndex + 1)?.start ?: text.length
                                textOffset = next
                                persist()
                                if (next >= text.length) pauseReading()
                                else speakCurrent()
                            }
                        }
                    }
                    override fun onError(utteranceId: String?) {
                        handler.post {
                            if (utteranceId == pendingUtterance) {
                                publish("La síntesis de voz no pudo continuar.")
                                pauseReading()
                            }
                        }
                    }
                })
                tts?.language = Locale.getDefault()
                if (playing && kind == "text") speakCurrent()
            } else if (kind == "text") {
                publish("No se pudo inicializar el motor de voz de Android.")
                pauseReading()
            }
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START_AUDIO, ACTION_START_TEXT -> {
                val id = intent.getStringExtra(EXTRA_BOOK).orEmpty()
                // Begin the foreground service immediately, before large book IO.
                showNotification(startForegroundNow = true)
                openBook(id, if (intent.action == ACTION_START_AUDIO) "audio" else "text")
                val desiredSegment = intent.getIntExtra(EXTRA_START_SEGMENT, -1)
                if (kind == "audio" && desiredSegment in segments.indices) {
                    openSegment(desiredSegment,
                        intent.getIntExtra(EXTRA_START_POSITION, -1).coerceAtLeast(0))
                }
                val requestedSpeed = intent.getIntExtra(EXTRA_SPEED, 0)
                if (requestedSpeed != 0) {
                    speed = (requestedSpeed / 100f).coerceIn(.6f, 2f)
                    try { player?.playbackParams = player!!.playbackParams.setSpeed(speed) }
                    catch (_: Exception) {}
                }
                remainingSleepMs = intent.getIntExtra(EXTRA_SLEEP, 0).coerceIn(0, 120) * 60_000L
                lastTick = android.os.SystemClock.elapsedRealtime()
                publish()
            }
            ACTION_PLAY -> resumeReading()
            ACTION_PAUSE -> pauseReading()
            ACTION_TOGGLE -> if (playing) pauseReading() else resumeReading()
            ACTION_STOP -> stopReading()
            ACTION_PREVIOUS -> previousSegment()
            ACTION_NEXT -> nextSegment()
            ACTION_SKIP_BACK -> seekTo(positionMs - 30000)
            ACTION_SKIP_FORWARD -> seekTo(positionMs + 30000)
            ACTION_SEEK -> seekTo(intent.getIntExtra(EXTRA_VALUE, 0))
            ACTION_SPEED -> {
                val n = intent.getIntExtra(EXTRA_VALUE, 100)
                speed = (n / 100f).coerceIn(.6f, 2f)
                try { player?.playbackParams = player!!.playbackParams.setSpeed(speed) }
                catch (_: Exception) {}
                if (kind == "text" && playing) speakCurrent()
                publish()
            }
            ACTION_SLEEP -> {
                val minutes = intent.getIntExtra(EXTRA_VALUE, 0).coerceIn(0, 120)
                remainingSleepMs = minutes * 60_000L
                lastTick = android.os.SystemClock.elapsedRealtime()
                publish()
            }
            ACTION_BOOKMARK -> bookmark()
            ACTION_SEGMENT -> if (kind == "audio") openSegment(
                intent.getIntExtra(EXTRA_VALUE, segmentIndex).coerceIn(
                    0, segments.lastIndex.coerceAtLeast(0)
                )
            )
            ACTION_UNIT -> if (kind == "text") {
                textUnit = intent.getIntExtra(EXTRA_VALUE, textUnit).coerceIn(0, 2)
                units = ReaderUnits.split(text, textUnit)
                if (playing) speakCurrent()
                persist()
            }
        }
        return START_NOT_STICKY
    }

    private fun openBook(id: String, target: String) {
        val found = store.list().firstOrNull { it.id == id }
        if (found == null) {
            publish("No se encontró el libro en Mi biblioteca.")
            stopReading()
            return
        }
        if (book?.id == id && kind == target) { playReading(); return }
        pauseReading()
        player?.release()
        player = null
        tts?.stop()
        pendingUtterance = ""
        book = found
        kind = target
        speed = 1f
        remainingSleepMs = 0L
        val prefs = getSharedPreferences("native-reader-preferences", 0)
        if (target == "audio") {
            audioPaths = store.audioFiles(found)
            segments = found.audioSegments.ifEmpty {
                audioPaths.indices.map { ReaderAudioSegment(it) }
            }.filter { it.fileIndex in audioPaths.indices }
            segmentIndex = found.trackIndex.coerceIn(0, (segments.size - 1).coerceAtLeast(0))
            positionMs = found.audioPositionMs
            if (segments.isEmpty()) {
                publish("El audiolibro no contiene pistas reproducibles.")
                stopReading()
                return
            }
        } else {
            text = store.read(found)
            textUnit = prefs.getInt("unit." + id, prefs.getInt("unit", 1)).coerceIn(0, 2)
            units = ReaderUnits.split(text, textUnit)
            textOffset = found.offset.coerceIn(0, text.length)
            speed = prefs.getFloat("speed." + id, prefs.getFloat("rate", 1f))
            voiceId = prefs.getString("voice." + id, prefs.getString("voice", "")).orEmpty()
            if (units.isEmpty()) {
                publish("Este documento no contiene texto para reproducir.")
                stopReading()
                return
            }
        }
        playReading()
    }

    private fun focusAudio(): Boolean {
        if (focused) return true
        val mgr = manager ?: return false
        val request = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
            .setAudioAttributes(audioAttributes)
            .setAcceptsDelayedFocusGain(false)
            .setWillPauseWhenDucked(true)
            .setOnAudioFocusChangeListener(focusListener, handler).build()
        val response = mgr.requestAudioFocus(request)
        if (response == AudioManager.AUDIOFOCUS_REQUEST_GRANTED) {
            focusRequest = request
            focused = true
            return true
        }
        publish("No se ha podido obtener el control del audio.")
        return false
    }

    private fun resumeReading() {
        if (book == null) {
            val last = snapshot.value
            if (last.bookId.isNotBlank() && last.kind in setOf("text", "audio")) {
                showNotification(startForegroundNow = true)
                openBook(last.bookId, last.kind)
            }
        } else playReading()
    }

    private fun holdPlaybackWakeLock() {
        val now = SystemClock.elapsedRealtime()
        if (lastWakeRefreshMs == 0L || now - lastWakeRefreshMs >= 4 * 60_000L ||
            playbackWakeLock?.isHeld != true) {
            // Bounded lease renewed during active playback to avoid leaks.
            try {
                playbackWakeLock?.acquire(10 * 60_000L)
                lastWakeRefreshMs = now
            } catch (_: SecurityException) { }
        }
    }

    private fun releasePlaybackWakeLock() {
        try {
            if (playbackWakeLock?.isHeld == true) playbackWakeLock?.release()
        } catch (_: RuntimeException) { }
        lastWakeRefreshMs = 0L
    }

    private fun playReading() {
        if (book == null || playing) return
        // A foreground service must be active before acquiring focus on API 35+.
        showNotification(startForegroundNow = true)
        if (!focusAudio()) {
            stopForegroundIfIdle()
            return
        }
        playing = true
        holdPlaybackWakeLock()
        lastTick = android.os.SystemClock.elapsedRealtime()
        if (kind == "audio") {
            if (player == null) openSegment(segmentIndex, positionMs)
            else try { player?.start() } catch (_: Exception) { openSegment(segmentIndex, positionMs) }
        } else if (ttsReady) speakCurrent()
        handler.removeCallbacks(ticker)
        handler.postDelayed(ticker, 1000)
        publish()
    }

    private fun openSegment(index: Int, position: Int = 0) {
        val segment = segments.getOrNull(index) ?: return
        val file = audioPaths.getOrNull(segment.fileIndex) ?: return
        try {
            player?.release()
            val media = MediaPlayer()
            media.setAudioAttributes(audioAttributes)
            media.setDataSource(file.absolutePath)
            media.prepare()
            media.setOnCompletionListener {
                if (index < segments.lastIndex) nextSegment()
                else pauseReading()
            }
            durationMs = media.duration
            segmentIndex = index
            val minimum = segment.startMs.coerceAtLeast(0)
            val maximum = segment.endMs.takeIf { it > minimum }
                ?.coerceAtMost(durationMs) ?: durationMs
            positionMs = (if (position > 0) position else minimum).coerceIn(minimum, maximum)
            media.seekTo(positionMs)
            media.playbackParams = media.playbackParams.setSpeed(speed)
            player = media
            if (playing) media.start()
            persist()
        } catch (e: Exception) {
            publish("No se pudo reproducir la pista de audio.")
            pauseReading()
        }
    }

    private fun speakCurrent() {
        if (!playing || !ttsReady) return
        val currentIndex = ReaderUnits.indexForOffset(units, textOffset)
        val fragment = units.getOrNull(currentIndex) ?: run { pauseReading(); return }
        val output = NativePronunciation.apply(fragment.text,
            NativePronunciationStore(applicationContext).read())
        val utteranceId = UUID.randomUUID().toString()
        pendingUtterance = utteranceId
        tts?.setSpeechRate(speed)
        tts?.voices?.firstOrNull { it.name == voiceId }?.let { tts?.voice = it }
        if (tts?.speak(output, TextToSpeech.QUEUE_FLUSH, null, utteranceId) != TextToSpeech.SUCCESS) {
            publish("La síntesis de voz no pudo comenzar.")
            pauseReading()
        }
        publish()
    }

    private fun pauseReading(releaseFocus: Boolean = true) {
        if (releaseFocus) focusRecovery.cancel()
        if (playing) {
            if (kind == "audio") {
                positionMs = try { player?.currentPosition ?: positionMs }
                    catch (_: Exception) { positionMs }
                try { player?.pause() } catch (_: Exception) {}
            } else {
                pendingUtterance = ""
                tts?.stop()
            }
        }
        playing = false
        releasePlaybackWakeLock()
        handler.removeCallbacks(ticker)
        persist()
        publish()
        stopForegroundIfIdle()
        if (releaseFocus && focused) {
            focusRequest?.let { manager?.abandonAudioFocusRequest(it) }
            focused = false
            focusRequest = null
        }
    }

    private fun stopReading() {
        focusRecovery.cancel()
        pauseReading()
        player?.release()
        player = null
        tts?.stop()
        book = null
        kind = ""
        snapshot.value = NativePlaybackSnapshot()
        session?.setPlaybackState(PlaybackState.Builder()
            .setState(PlaybackState.STATE_STOPPED, 0, 0f).build())
        stopForegroundIfIdle()
        stopSelf()
    }

    private fun seekTo(requested: Int) {
        if (kind == "audio") {
            val segment = segments.getOrNull(segmentIndex)
            val minTime = segment?.startMs?.coerceAtLeast(0) ?: 0
            val maxTime = segment?.endMs?.takeIf { it > minTime }
                ?.coerceAtMost(durationMs) ?: durationMs
            positionMs = requested.coerceIn(minTime, maxTime)
            player?.seekTo(positionMs)
        } else if (kind == "text") {
            val max = text.length
            textOffset = requested.coerceIn(0, max)
            if (playing) speakCurrent()
        }
        persist()
        publish()
    }

    private fun nextSegment() {
        if (kind == "audio" && segmentIndex < segments.lastIndex) {
            openSegment(segmentIndex + 1)
        } else if (kind == "text") {
            val index = ReaderUnits.indexForOffset(units, textOffset)
            textOffset = units.getOrNull(index + 1)?.start ?: text.length
            if (playing) speakCurrent()
            persist()
        } else pauseReading()
    }

    private fun previousSegment() {
        if (kind == "audio" && segmentIndex > 0) {
            openSegment(segmentIndex - 1)
        } else if (kind == "text") {
            val index = ReaderUnits.indexForOffset(units, textOffset)
            textOffset = units.getOrNull(index - 1)?.start ?: 0
            if (playing) speakCurrent()
            persist()
        }
    }

    private fun bookmark() {
        val current = book ?: return
        try {
            book = store.changeBook(current.id) { latest ->
                if (kind == "audio") {
                    val old = latest.audioMarks.ifEmpty {
                        latest.marks.map { ReaderAudioMark(latest.trackIndex, it) }
                    }
                    latest.copy(audioMarks =
                        (old + ReaderAudioMark(segmentIndex, positionMs)).distinct())
                } else latest.copy(marks = (latest.marks + textOffset).distinct())
            } ?: current
            publish()
        } catch (e: Exception) {
            publish("No se pudo guardar la marca: " + e.message.orEmpty())
        }
    }

    private fun persist() {
        val current = book ?: return
        try {
            // Fetch + modify + save under one metadata lock. Do not replace
            // a recently renamed title, queue status, folder or favorite.
            book = store.changeBook(current.id) { latest ->
                val now = if (playing) System.currentTimeMillis() else latest.lastReadAt
                if (kind == "audio") latest.copy(
                    trackIndex = segmentIndex, audioPositionMs = positionMs,
                    lastReadAt = now
                ) else latest.copy(offset = textOffset, lastReadAt = now)
            } ?: current
            lastProgressWriteMs = android.os.SystemClock.elapsedRealtime()
        } catch (e: Exception) {
            publish("No se pudo guardar la posición: " + e.message.orEmpty())
        }
    }

    private fun publish(error: String = "") {
        val current = book ?: return
        snapshot.value = NativePlaybackSnapshot(
            bookId = current.id, title = current.title, kind = kind, playing = playing,
            segment = segmentIndex, segmentCount = segments.size,
            positionMs = positionMs, durationMs = durationMs,
            textOffset = textOffset, textLength = text.length, error = error,
            sleepMinutes = if (remainingSleepMs <= 0L) 0
                else ((remainingSleepMs + 59999L) / 60000L).toInt(),
            audioMarks = current.audioMarks.ifEmpty {
                current.marks.map { ReaderAudioMark(current.trackIndex, it) }
            },
            textMarks = current.marks,
            synchronizedText = if (kind == "audio") {
                segments.getOrNull(segmentIndex)?.synchronizedText.orEmpty()
            } else ""
        )
        session?.setMetadata(android.media.MediaMetadata.Builder()
            .putString(android.media.MediaMetadata.METADATA_KEY_TITLE, current.title)
            .putString(android.media.MediaMetadata.METADATA_KEY_ARTIST, "TifloLector")
            .build())
        val state = if (playing) PlaybackState.STATE_PLAYING else PlaybackState.STATE_PAUSED
        val supported = PlaybackState.ACTION_PLAY or PlaybackState.ACTION_PAUSE or
            PlaybackState.ACTION_PLAY_PAUSE or PlaybackState.ACTION_STOP or
            PlaybackState.ACTION_SKIP_TO_NEXT or PlaybackState.ACTION_SKIP_TO_PREVIOUS or
            PlaybackState.ACTION_SEEK_TO or PlaybackState.ACTION_FAST_FORWARD or PlaybackState.ACTION_REWIND
        session?.setPlaybackState(PlaybackState.Builder()
            .setActions(supported).setState(state,
                (if (kind == "audio") positionMs else textOffset).toLong(),
                if (playing) speed else 0f).build())
        if (foreground || playing) showNotification(startForegroundNow = false)
    }

    private fun intentFor(action: String, request: Int): PendingIntent =
        PendingIntent.getService(this, request,
            Intent(this, NativeReaderPlaybackService::class.java).setAction(action),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

    private fun showNotification(startForegroundNow: Boolean) {
        val launch = PendingIntent.getActivity(this, 90,
            Intent(this, NativePrototypeActivity::class.java)
                .putExtra("tiflolector-open-book", book?.id.orEmpty())
                .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val details = (book?.title ?: "TifloLector")
        val prev = Notification.Action.Builder(
            android.R.drawable.ic_media_previous, "Anterior", intentFor(ACTION_PREVIOUS, 1)).build()
        val toggle = Notification.Action.Builder(
            if (playing) android.R.drawable.ic_media_pause else android.R.drawable.ic_media_play,
            if (playing) "Pausar" else "Reproducir",
            intentFor(ACTION_TOGGLE, 2)).build()
        val next = Notification.Action.Builder(
            android.R.drawable.ic_media_next, "Siguiente", intentFor(ACTION_NEXT, 3)).build()
        val note = Notification.Builder(this, "tiflolector-playback")
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setContentTitle(details).setContentText(
                if (playing) "Reproduciendo" else "Pausado"
            ).setContentIntent(launch)
            .setVisibility(Notification.VISIBILITY_PUBLIC)
            .setOnlyAlertOnce(true)
            .setCategory(Notification.CATEGORY_TRANSPORT)
            .setStyle(Notification.MediaStyle()
                .setMediaSession(session?.sessionToken).setShowActionsInCompactView(0, 1, 2))
            .addAction(prev).addAction(toggle).addAction(next)
            .setOngoing(playing)
            .build()
        if (startForegroundNow || playing) {
            if (Build.VERSION.SDK_INT >= 29)
                startForeground(4707, note, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
            else startForeground(4707, note)
            foreground = true
        } else (getSystemService(NOTIFICATION_SERVICE) as NotificationManager)
            .notify(4707, note)
    }

    private fun stopForegroundIfIdle() {
        if (!playing && foreground && !focusRecovery.resumeOnGain) {
            stopForeground(STOP_FOREGROUND_DETACH)
            foreground = false
        }
        if (book == null) (getSystemService(NOTIFICATION_SERVICE) as NotificationManager)
            .cancel(4707)
    }

    override fun onDestroy() {
        handler.removeCallbacks(ticker)
        releasePlaybackWakeLock()
        persist()
        player?.release()
        tts?.stop()
        tts?.shutdown()
        if (focused) focusRequest?.let { manager?.abandonAudioFocusRequest(it) }
        try { unregisterReceiver(becomingNoisy) } catch (_: Exception) {}
        session?.release()
        session = null
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
