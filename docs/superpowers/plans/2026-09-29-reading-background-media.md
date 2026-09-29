# TifloLector Background Reading and Media Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make TifloLector text-to-speech continue reliably with the screen locked and expose one predictable play/pause behavior across TTS, audiobooks/audio, and the in-app YouTube player.

**Architecture:** Keep the existing Capacitor UI and semantic reading model, but move ownership of the active TTS queue to a native Android foreground service. Audio keeps its existing Media3 service. A small cross-source coordinator guarantees only one TifloAcosta playback source is active at a time, while each active source exposes Android media play/pause semantics. Video gets a transient native media-session bridge only while its WebView player is open and usable.

**Tech Stack:** Capacitor 8.5.2; Android Java; `android.speech.tts.TextToSpeech`; platform `android.media.session.MediaSession`; existing AndroidX Media3 1.11.1; SQLiteOpenHelper; Node 22 `node:test`; Android unit/instrumentation tests.

**Spec:** `docs/superpowers/specs/2026-09-29-tiflolector-1.3.4-reading-upgrade-design.md`

## Global Constraints

- Text reading must continue across screen lock without keeping the display awake.
- JavaScript/WebView must not be required to advance from one spoken semantic unit to the next.
- Opening a document never auto-starts speech.
- Audio focus loss, calls, and headphone disconnect pause and persist; focus recovery never auto-resumes.
- Only one TifloAcosta source may be active: `tts`, `audio`, `video`, or `none`.
- Existing audiobook position, tracks, speed, timer, marks, and background playback must not regress.
- YouTube playback with the screen locked is explicitly out of scope.
- Existing semantic `blockIndex` + `unitIndex` remains the single text position model.
- `main` is not modified during implementation; work stays on `feature/tiflolector-1.3.4-reading-upgrade` until verification.

## Review Focus

- Very large books must not require one oversized Capacitor bridge payload; queue transfer is chunked.
- Process/service recreation must restore state without auto-playing.
- A stale WebView callback must never overwrite a newer native reading position.
- Switching source while paused must not leave two media sessions able to restart different content.
- Repeated play/pause media-key events must be idempotent and must not skip semantic units.

---

### Task 1: Define the native background-TTS session contract

**Files:**
- Create: `mobile/android/app/src/main/java/com/tifloacosta/app/reading/ReadingTtsUnit.java`
- Create: `mobile/android/app/src/main/java/com/tifloacosta/app/reading/ReadingTtsSessionStore.java`
- Create: `mobile/android/app/src/test/java/com/tifloacosta/app/reading/ReadingTtsSessionStoreTest.java`
- Modify: `mobile/test/reading-android-native-contract.test.mjs`

**Interfaces:**
- `ReadingTtsUnit(blockIndex:int, unitIndex:int, text:String)`.
- `ReadingTtsSessionStore.begin(sessionId, bookId, title, voiceId, rate, blockIndex, unitIndex)`.
- `append(sessionId, List<ReadingTtsUnit>)` supports bounded chunks.
- `commit(sessionId)` atomically makes the queue readable by the service.
- `load(sessionId)` returns metadata + ordered units after process recreation.
- `delete(sessionId)` removes the private session file.

- [ ] Write failing JVM tests for ordered chunk append, invalid/duplicate session IDs, atomic commit, large unit counts, and reload after a new store instance.
- [ ] Extend the native contract test to require new background-TTS bridge method names without removing current voice enumeration support.
- [ ] Run `cd mobile/android && ./gradlew --no-daemon testDebugUnitTest --stacktrace` and the focused Node contract test; expect FAIL.
- [ ] Implement the private JSON/session-file store under app-private `filesDir/reading-tts-sessions`, using temp + atomic rename for commit.
- [ ] Run focused JVM and Node tests; expect PASS.
- [ ] Commit: `feat: add persistent background tts sessions`.

### Task 2: Implement the foreground TTS service

**Files:**
- Create: `mobile/android/app/src/main/java/com/tifloacosta/app/reading/ReadingBackgroundTtsService.java`
- Create: `mobile/android/app/src/test/java/com/tifloacosta/app/reading/ReadingBackgroundTtsServiceStateTest.java`
- Modify: `mobile/android/app/src/main/AndroidManifest.xml`
- Modify: `mobile/android/app/src/main/java/com/tifloacosta/app/reading/ReadingTtsController.java`

**Interfaces:**
- Service actions: `PREPARE`, `PLAY`, `PAUSE`, `SEEK`, `STOP`, `QUERY_STATE`.
- State fields: `sessionId`, `bookId`, `blockIndex`, `unitIndex`, `playing`, `prepared`, `ended`, `voiceId`, `rate`.
- Broadcast events: `TTS_STATE`, `TTS_POSITION`, `TTS_INTERRUPTED`, `TTS_ENDED`, `TTS_ERROR`.
- Service owns the `UtteranceProgressListener` completion chain while playing.
- Service persists progress directly through `ReadingLibraryDatabase.updateProgress(...)`.

- [ ] Write failing state-machine tests for prepare-without-play, sentence-to-sentence advance, pause at current unit, end-of-document, stale utterance callback rejection, and restoration in paused state.
- [ ] Add source/manifest contract assertions for a foreground service and required foreground-service permissions already used by media playback.
- [ ] Run focused tests; expect FAIL.
- [ ] Implement service lifecycle, notification channel, foreground notification, audio focus/noisy handling, TTS engine ownership, semantic advancement, and direct DB persistence.
- [ ] Ensure `onDestroy()` persists once and never auto-resumes on recreation.
- [ ] Run JVM tests plus `./gradlew --no-daemon assembleDebugAndroidTest --stacktrace`; expect PASS.
- [ ] Commit: `feat: keep reading tts alive in background`.

### Task 3: Add platform media-session controls for TTS

**Files:**
- Modify: `mobile/android/app/src/main/java/com/tifloacosta/app/reading/ReadingBackgroundTtsService.java`
- Create: `mobile/android/app/src/test/java/com/tifloacosta/app/reading/ReadingTtsMediaSessionTest.java`

**Interfaces:**
- Platform `MediaSession` callback maps `onPlay()` -> service play and `onPause()` -> service pause.
- PlaybackState exposes only actions that are valid for the current TTS session.
- Session metadata contains TifloAcosta + current document title.
- Session is inactive after explicit stop/end and active while a prepared TTS session should receive media commands.

- [ ] Write failing tests for media play/pause mapping, inactive state after stop, repeated pause idempotence, and no action with no prepared session.
- [ ] Run focused JVM tests; expect FAIL.
- [ ] Implement `MediaSession`, playback state, metadata, and notification MediaStyle token integration.
- [ ] Run focused tests and Android debug build; expect PASS.
- [ ] Commit: `feat: expose tts media controls`.

### Task 4: Replace sentence-by-sentence Capacitor calls with a session bridge

**Files:**
- Modify: `mobile/android/app/src/main/java/com/tifloacosta/app/TifloReadingTtsPlugin.java`
- Modify: `mobile/src/native/reading-library-plugin.mjs`
- Modify: `mobile/src/core/reading-library-client.mjs`
- Modify: `mobile/src/core/reading-speech.mjs`
- Modify: `mobile/test/reading-speech.test.mjs`
- Modify: `mobile/test/reading-library-client.test.mjs`

**Interfaces:**
- Native methods: `beginTtsSession`, `appendTtsUnits`, `commitTtsSession`, `playTts`, `pauseTts`, `seekTts`, `getTtsState`, `stopTts`, `listTtsVoices`.
- Shared controller prepares chunks of at most 100 semantic units.
- `play()` never needs a `ttsDone` callback to enqueue the next sentence.
- Native position events update shared UI state; shared UI never saves an older position over a newer native snapshot.

- [ ] Rewrite failing JS tests so one `play()` prepares a native session and native `ttsPosition` drives progress without per-sentence `startTts` calls.
- [ ] Add client tests for chunking, normalized state, stale session rejection, pause/resume, and native snapshot precedence.
- [ ] Run focused Node tests; expect FAIL.
- [ ] Implement plugin/service command transport and update the shared speech controller.
- [ ] Keep a temporary compatibility shim only if required by another existing test; remove it before the final acceptance gate.
- [ ] Run all reading speech/client tests and Android unit tests; expect PASS.
- [ ] Commit: `refactor: move reading speech queue to android`.

### Task 5: Add a single active-source coordinator

**Files:**
- Create: `mobile/src/core/media-coordinator.mjs`
- Create: `mobile/test/media-coordinator.test.mjs`
- Modify: `mobile/src/screens/reading-book.mjs`
- Modify: `mobile/src/screens/reading-audio.mjs`
- Modify: `mobile/src/screens/video-player.mjs`

**Interfaces:**
- `createMediaCoordinator({tts,audio,video})` exposes `activate(source)`, `deactivate(source)`, `snapshot()`, `destroy()`.
- Sources are exactly `none|tts|audio|video`.
- Activating a new source pauses/deactivates the previous source before starting the new one.
- Closing/destroying a source clears it only if it is currently active.

- [ ] Write failing pure tests for `tts -> audio`, `audio -> video`, `video -> tts`, repeated activation, and stale deactivation.
- [ ] Run focused test; expect FAIL.
- [ ] Implement coordinator and wire TTS/audio/video screens through it without changing their visible controls.
- [ ] Run focused screen tests plus full `npm test`; expect PASS.
- [ ] Commit: `feat: coordinate tifloacosta media sources`.

### Task 6: Make audio relinquish control cleanly

**Files:**
- Modify: `mobile/android/app/src/main/java/com/tifloacosta/app/reading/ReadingAudioService.java`
- Modify: `mobile/android/app/src/main/java/com/tifloacosta/app/TifloReadingAudioPlugin.java`
- Modify: `mobile/src/core/reading-audio.mjs`
- Modify: `mobile/test/reading-audio.test.mjs`
- Modify: `mobile/test/reading-android-native-contract.test.mjs`

**Interfaces:**
- Add native `deactivateAudio()` that pauses, persists, cancels timers, clears the active media item/session state needed to avoid stale media-key routing, but preserves library progress.
- Preparing audio after deactivation restores from requested track/time exactly as before.

- [ ] Add failing tests that deactivation saves position, never marks the book read, and does not auto-resume.
- [ ] Run focused tests; expect FAIL.
- [ ] Implement deactivation in service/plugin/shared controller.
- [ ] Run existing audiobook regression suite plus Android unit tests; expect PASS.
- [ ] Commit: `fix: relinquish audiobook media control cleanly`.

### Task 7: Add media-key bridge for the in-app YouTube player

**Files:**
- Create: `mobile/android/app/src/main/java/com/tifloacosta/app/TifloMediaControlPlugin.java`
- Modify: `mobile/android/app/src/main/java/com/tifloacosta/app/MainActivity.java`
- Modify: `mobile/src/core/native-actions.mjs`
- Modify: `mobile/src/screens/video-player.mjs`
- Modify: `mobile/test/share-native-bootstrap.test.mjs`
- Modify: `mobile/test/reading-android-native-contract.test.mjs`
- Modify: `mobile/test/video-player.test.mjs` if present; otherwise create it.

**Interfaces:**
- `activateVideoMediaControls({title})`, `deactivateVideoMediaControls()`.
- Events: `mediaPlay`, `mediaPause`, `mediaPlayPause`.
- The native platform MediaSession is active only while the in-app video player is open and usable.
- Events call `playVideo()`/`pauseVideo()` only when the YouTube IFrame API player is ready.

- [ ] Write failing native/source tests for plugin registration, media-session activation/deactivation, and safe no-op without a ready player.
- [ ] Add JS tests proving a media command toggles the same player state as the visible play/pause button.
- [ ] Run focused tests; expect FAIL.
- [ ] Implement native session bridge and player integration.
- [ ] Ensure app/background transition deactivates video media control rather than promising background YouTube playback.
- [ ] Run focused tests and full mobile suite; expect PASS.
- [ ] Commit: `feat: control in-app video with android media keys`.

### Task 8: Add lock-screen and lifecycle acceptance coverage

**Files:**
- Create: `mobile/android/app/src/androidTest/java/com/tifloacosta/app/reading/ReadingBackgroundTtsInstrumentationTest.java`
- Modify: `mobile/test/reading-beta-acceptance.test.mjs`
- Modify: `.github/workflows/bootstrap-mobile-android.yml`
- Modify: `.github/workflows/test-mobile-release.yml`

**Interfaces:**
- Acceptance gate must fail if the background service, session bridge, media coordinator, or required manifest declarations disappear.
- Instrumentation test simulates activity stop/background while native TTS queue advances; real screen-lock behavior remains a mandatory physical-device beta check.

- [ ] Add failing acceptance assertions before touching workflows.
- [ ] Add instrumentation coverage for service survival across activity stop/recreate and paused restoration.
- [ ] Run `npm run test:reading-beta`, full `npm test`, `./gradlew testDebugUnitTest`, `./gradlew assembleDebugAndroidTest`, and `./gradlew assembleDebug`; expect PASS.
- [ ] Update CI to execute the strengthened gate before packaging.
- [ ] Commit: `test: gate background reading and media controls`.

### Task 9: Manual Android verification before the next feature block

**Files:**
- Modify: `docs/superpowers/plans/2026-09-29-reading-background-media.md` only to tick verified items when evidence exists.

- [ ] Install the debug/beta build on a physical Android device with TalkBack.
- [ ] Start a multi-sentence text book, lock the screen, confirm multiple sentences continue for several minutes.
- [ ] Pause/resume from a standard media control and with TalkBack double-tap with two fingers.
- [ ] Unlock and verify UI/native/database position agreement.
- [ ] Repeat with an audiobook/audio item.
- [ ] Open an in-app YouTube video and verify the same gesture controls play/pause while the player is active.
- [ ] Verify call/audio-focus/headphone interruption pauses and never auto-resumes.
- [ ] Record device, Android version, TalkBack version, and result in the PR description or test notes.
