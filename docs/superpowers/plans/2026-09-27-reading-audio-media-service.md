# Leer con TifloAcosta — Android Audio and Media Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add first-class local audiobooks to the existing reading library with exact track/time resume, accessible controls, playback speed, sleep timer, background playback and Android media controls, without creating a separate library or route.

**Architecture:** Keep `TifloReading` as the library/import bridge and add a focused native audio playback bridge backed by AndroidX Media3. Audio books use the same `books`, marks and per-book settings concepts as text, but schema v3 adds exact media position and track metadata. The existing `reading-book` route dispatches to an audio subview while retaining one library, one state model and one deletion path.

**Tech Stack:** Capacitor 8.5.2; Android Java; SQLiteOpenHelper; AndroidX Media3 ExoPlayer + MediaSessionService; Node 22 `node:test`; ES modules/esbuild; Android minSdk 24 / compileSdk 36 / targetSdk 36.

**Spec:** `docs/superpowers/specs/2026-09-26-leer-con-tifloacosta-android-design.md`

## Global Constraints

- Audio remains local to the device; TifloAcosta does not upload content, playback history, marks or searches.
- Import copies selected/shared files into app-private storage and deleting a library item never deletes the external original.
- Supported first-version audio types: MP3, M4A, M4B, AAC, OGG, Opus, FLAC and WAV.
- Opening an audio book never starts playback automatically.
- After audio-focus loss, calls or headphone disconnection, playback pauses and position is saved; it never resumes automatically.
- A format is not considered supported until pause/resume, exact position, speed, background playback and recovery are verified.
- Real chapters/tracks are exposed when available; chapters are never invented.
- General settings are defaults; a change made inside one book is a per-book override.
- No broad storage permission.
- Reading-library files and `tiflo_reading.db` stay excluded from Android automatic/cloud backup.

## Review Focus

- A process death or service recreation must restore the last persisted track/time without auto-playing.
- Headphone disconnect and audio-focus loss must pause once, save once and never auto-resume.
- Unsupported/corrupt media must roll back import without leaving a database row or private orphan.
- Very long books must store time in `long` milliseconds without truncation.
- Timer expiry must pause and persist the current position even while the app UI is not foregrounded.

---

### Task 1: SQLite v3 exact audio positions and audio marks

**Files:**
- Modify `mobile/android/app/src/main/java/com/tifloacosta/app/reading/ReadingLibraryDatabase.java`
- Modify `mobile/android/app/src/main/java/com/tifloacosta/app/reading/ReadingBookRecord.java`
- Modify `mobile/android/app/src/main/java/com/tifloacosta/app/reading/ReadingBookRepository.java`
- Modify `mobile/android/app/src/main/java/com/tifloacosta/app/reading/ReadingMarkRecord.java`
- Modify `mobile/android/app/src/androidTest/java/com/tifloacosta/app/reading/ReadingLibraryDatabaseTest.java`
- Modify `mobile/src/core/reading-library-client.mjs`
- Modify `mobile/test/reading-library-client.test.mjs`

**Interfaces:**
- Database version becomes `3` with explicit migration `2 -> 3`; existing v1/v2 data is never dropped.
- `books` adds `media_track_index INTEGER NOT NULL DEFAULT 0` and `media_position_ms INTEGER NOT NULL DEFAULT 0`.
- `marks` adds the same two fields so an audio mark can jump to an exact track/time; text marks keep zeros.
- Book/client shape adds `mediaTrackIndex` and `mediaPositionMs` as non-negative integers.
- Progress saving accepts text position and media position together; each format uses the fields relevant to it.

- [ ] Write failing migration/client tests proving v2 books/marks survive, audio millisecond values round-trip as `long`, and text records keep zero media fields.
- [ ] Run focused Android instrumentation compile/tests and reading client tests; expect FAIL before schema v3 exists.
- [ ] Implement v3 columns, records, repository mapping and client normalization without changing v1/v2 migration behavior.
- [ ] Run focused tests plus full mobile tests; expect PASS.
- [ ] Commit: `feat: add exact audio positions to reading library`.

### Task 2: Single-file audio import and private storage

**Files:**
- Modify `mobile/android/app/src/main/java/com/tifloacosta/app/reading/ReadingImportService.java`
- Modify `mobile/android/app/src/main/java/com/tifloacosta/app/reading/ReadingImportSource.java`
- Modify `mobile/android/app/src/main/java/com/tifloacosta/app/reading/ReadingFileStore.java`
- Modify `mobile/android/app/src/main/java/com/tifloacosta/app/reading/AndroidReadingFileStore.java`
- Create `mobile/android/app/src/main/java/com/tifloacosta/app/reading/ReadingAudioProbe.java`
- Modify `mobile/android/app/src/main/java/com/tifloacosta/app/TifloReadingPlugin.java`
- Modify `mobile/android/app/src/main/AndroidManifest.xml`
- Modify `mobile/android/app/src/test/java/com/tifloacosta/app/reading/ReadingImportServiceTest.java`
- Modify `mobile/test/reading-android-native-contract.test.mjs`

**Interfaces:**
- Accept MIME/extensions for MP3, M4A, M4B, AAC, OGG, Opus, FLAC and WAV.
- Preserve the real extension in the private source filename; do not decode/re-encode media during import.
- `ReadingAudioProbe` verifies Android can read the media container and returns duration plus available title/artist/album metadata; absent metadata remains absent.
- Corrupt/unsupported media returns a distinct import rejection and leaves no final private item.

- [ ] Write failing import/native-contract tests for all approved extensions/MIME families, duplicate bytes, corrupt audio rollback, insufficient space and no broad storage permissions.
- [ ] Run focused tests; expect FAIL before audio is accepted.
- [ ] Implement transactional audio validation/copying and extend picker/share MIME coverage.
- [ ] Run Android unit tests, mobile tests and Android sync/build; expect PASS.
- [ ] Commit: `feat: import local audio reading items`.

### Task 3: Native Media3 playback service and Capacitor bridge

**Files:**
- Modify `mobile/android/app/build.gradle`
- Create `mobile/android/app/src/main/java/com/tifloacosta/app/reading/ReadingAudioService.java`
- Create `mobile/android/app/src/main/java/com/tifloacosta/app/TifloReadingAudioPlugin.java`
- Modify `mobile/android/app/src/main/java/com/tifloacosta/app/MainActivity.java`
- Modify `mobile/android/app/src/main/AndroidManifest.xml`
- Create `mobile/android/app/src/test/java/com/tifloacosta/app/reading/ReadingAudioControllerTest.java`
- Modify `mobile/test/reading-android-native-contract.test.mjs`

**Interfaces:**
- Native bridge: `prepareAudio({bookId, relativePath, trackIndex, positionMs})`, `playAudio()`, `pauseAudio()`, `seekAudio({positionMs})`, `skipAudio({deltaMs})`, `setAudioSpeed({speed})`, `getAudioState()`, `stopAudio()`.
- Events: `audioState`, `audioPosition`, `audioInterrupted`, `audioEnded`; include `bookId`, `trackIndex`, `positionMs`, `durationMs`, `playing`, `speed` where relevant.
- `prepareAudio` never auto-plays.
- MediaSessionService supplies background playback, lock-screen/notification play-pause and headset media-button behavior.
- Audio-focus loss/noisy-audio causes pause + interruption event; never automatic resume.

- [ ] Write failing native contract/controller tests for prepare-without-play, exact seek, speed, focus loss, noisy output, stale book/session callbacks and service declaration.
- [ ] Run focused tests; expect FAIL before the bridge/service exist.
- [ ] Add pinned Media3 dependencies and implement service/session/player ownership plus the Capacitor bridge.
- [ ] Run unit tests, instrumentation compile, debug/release builds and native contract tests; expect PASS.
- [ ] Commit: `feat: add Android background reading audio service`.

### Task 4: Shared audio coordinator, settings and sleep timer

**Files:**
- Modify `mobile/src/native/reading-library-plugin.mjs`
- Modify `mobile/src/core/reading-library-client.mjs`
- Create `mobile/src/core/reading-audio.mjs`
- Modify `mobile/src/core/reading-settings.mjs`
- Create `mobile/test/reading-audio.test.mjs`
- Modify `mobile/test/reading-settings.test.mjs`

**Interfaces:**
- `createReadingAudioController({client, book, initialPosition, settings, onPosition})` owns explicit play/pause, seek, skip, speed, timer, state snapshot and destroy.
- Settings add `audio.speed` and `audio.skipSeconds`; skip accepts exactly `10|30|60`, default `30`.
- Sleep timer offers `15`, `30`, `60` minutes; chapter/track-end timer is enabled when a real chapter/track boundary exists.
- Position persistence is throttled during playback and forced on pause/interruption/timer/end/destroy.

- [ ] Write failing pure tests for no autoplay, resume from exact ms, skip clamping, speed inheritance/override, timer expiry, interruption without resume and stale callback rejection.
- [ ] Run focused tests; expect FAIL before coordinator exists.
- [ ] Implement shared coordinator and extend native wrapper/client/settings allowlists.
- [ ] Run focused and full mobile tests; expect PASS.
- [ ] Commit: `feat: coordinate reading audio playback`.

### Task 5: Accessible audio view inside the common reading route

**Files:**
- Create `mobile/src/screens/reading-audio.mjs`
- Modify `mobile/src/screens/reading-book.mjs`
- Modify `mobile/src/core/i18n.mjs`
- Modify `mobile/src/styles.css`
- Create `mobile/test/reading-audio-screen.test.mjs`
- Modify `mobile/test/reading-book.test.mjs`

**Interfaces and behavior:**
- `reading-book` keeps the same route and dispatches `book.format === 'audio'` to the audio subview.
- Controls: Play/Pause, back/forward by configured seconds, previous/next real track/chapter when available, speed, state, marks, timer.
- Opening restores position, announces concise elapsed/remaining information, focuses Play and never starts audio.
- Marks store/jump to exact `mediaTrackIndex + mediaPositionMs` and never start playback merely by jumping.

- [ ] Write failing UI/source tests for accessible labels ES/EN, focus on Play, no autoplay, exact mark reference, timer choices and single route reuse.
- [ ] Run focused tests; expect FAIL.
- [ ] Implement the audio subview with native buttons/forms and polite status announcements.
- [ ] Run full mobile tests/build; expect PASS.
- [ ] Commit: `feat: add accessible audiobook controls`.

### Task 6: Direct multi-file audiobook grouping

**Files:**
- Create `mobile/android/app/src/main/java/com/tifloacosta/app/reading/ReadingAudioTrackRecord.java`
- Modify `mobile/android/app/src/main/java/com/tifloacosta/app/reading/ReadingLibraryDatabase.java`
- Modify `mobile/android/app/src/main/java/com/tifloacosta/app/reading/ReadingImportService.java`
- Modify `mobile/android/app/src/main/java/com/tifloacosta/app/TifloReadingPlugin.java`
- Modify `mobile/src/core/reading-library-client.mjs`
- Modify `mobile/src/screens/reading-library.mjs`
- Modify `mobile/src/screens/reading-audio.mjs`
- Add/modify Android and Node tests for grouping/order/playback.

**Interfaces:**
- Selecting multiple audio files asks exactly: one audiobook / independent files / cancel.
- Grouped audiobook is one library item with ordered track records and private files.
- Automatic order: embedded track number first, filename second; unresolved ambiguity is surfaced for review rather than silently guessed.
- Transition between tracks is automatic inside the same audiobook and persists global percentage plus exact track/time.

- [ ] Write failing tests for all three choices, metadata ordering, filename fallback, ambiguity, rollback and end-of-track transition.
- [ ] Run focused tests; expect FAIL.
- [ ] Implement `audio_tracks` storage and grouped import without changing independent-file import.
- [ ] Run full Android/mobile verification; expect PASS.
- [ ] Commit: `feat: support multipack audio book imports`.

### Task 7: Audio vertical-slice verification

**Files:**
- Modify `mobile/test/reading-integration-contract.test.mjs`
- Modify Android integration/instrumentation tests as needed.

- [ ] Add one vertical-slice test covering import -> private storage -> library -> prepare -> explicit play -> persisted track/time -> reopen paused at saved position.
- [ ] Add interruption/headphone/timer assertions proving save + no auto-resume.
- [ ] Add deletion assertion proving only private audio and related rows are removed.
- [ ] Run full mobile tests, Android unit tests, instrumentation compile, debug APK and signed release AAB validation workflows.
- [ ] Record that instrumentation tests are compiled by CI unless a real device/emulator execution is explicitly available; never claim runtime execution from compile-only evidence.
- [ ] Commit: `test: lock reading audio vertical slice`.
