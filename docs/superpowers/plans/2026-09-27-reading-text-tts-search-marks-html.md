# Leer con TifloAcosta — Semantic Text, TTS, Search, Marks and HTML Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the proven Android TXT vertical slice into a semantic text reader that supports TXT and safe HTML, Android TTS, in-document search, marks, and inherited global/per-book reading settings while preserving reliable resume semantics and accessibility.

**Architecture:** Keep `TifloReading` as the Android bridge and delegate native responsibilities to focused Java helpers. The shared ES-module layer owns semantic content, search, speech queue state, settings inheritance, and the accessible reader UI. SQLite moves from schema v1 to v2 with explicit migrations for finer reading position, marks and settings; no destructive fallback is allowed.

**Tech Stack:** Capacitor 8.5.2; Android Java / `SQLiteOpenHelper` / `android.speech.tts.TextToSpeech`; Node 22 `node:test`; ES modules bundled by esbuild; Android minSdk 24 / compileSdk 36 / targetSdk 36.

**Spec:** `docs/superpowers/specs/2026-09-26-leer-con-tifloacosta-android-design.md`

## Global Constraints

- Local-only reading data: content, searches, marks, progress and settings must not be uploaded by TifloAcosta.
- No broad `READ_*`, `WRITE_EXTERNAL_STORAGE` or all-files storage permission.
- Import copies content into app-private storage; deletion never touches the external original.
- Opening a book never starts TTS automatically.
- Visual and spoken reading use the same logical position.
- TTS uses only Android voices exposed to applications; never claim to use the TalkBack voice unless Android exposes that voice through TTS.
- Losing relevant audio focus or disconnecting headphones pauses/stops speech and saves position; speech does not resume automatically.
- Global settings are defaults. Changes inside one book create per-book overrides only; resetting an override restores inheritance.
- Search is temporary until the user explicitly continues reading from a result.
- HTML is parsed as data. Source scripts, event handlers, embedded active content and remote execution are never inserted into the live app DOM.
- Existing remote `library` and web/article `reader` routes keep their current purpose.
- Reading-library files and `tiflo_reading.db` remain excluded from Android automatic/cloud backup.

## Review Focus

- Malformed or hostile HTML must remain inert and still yield readable text where possible.
- A v1 library with saved TXT progress must migrate to v2 without losing books or block position.
- TTS completion/error/interruption callbacks arriving late must not move a different book or a newer speech session.
- Searching a large document must not replace the main saved position until the user chooses to continue from a result.
- Removing a voice from the device must fall back safely without losing the per-book setting or preventing visual reading.

---

### Task 1: Semantic text model, sentence units and safe HTML adapter

**Files:**
- Create `mobile/src/core/reading-semantic-model.mjs`
- Create `mobile/src/core/reading-html-adapter.mjs`
- Modify `mobile/src/core/reading-text-model.mjs`
- Create `mobile/test/reading-semantic-model.test.mjs`
- Create `mobile/test/reading-html-adapter.test.mjs`

**Interfaces:**
- Produces `parseTextDocument(text, { title, language }) -> ReadingDocument`.
- Produces `parseHtmlDocument(html, { title, language, parseDocument }) -> ReadingDocument`.
- Produces `segmentSentences(text, locale) -> string[]`.
- Produces `normalizeSemanticPosition({ blockIndex, unitIndex }, document) -> { blockIndex, unitIndex }`.
- `ReadingDocument = { title, language, blocks }`.
- Block minimum shape: `{ id, type, text, level?, sentences }`, with types `paragraph|heading|list-item|quote|table-cell`.

- [ ] Write failing semantic-model tests for CRLF/BOM, paragraph IDs, heading/list/quote/table-cell shapes, sentence segmentation fallback, empty documents, negative/oversized block and sentence indices, and stable TXT behavior from the foundation phase.
- [ ] Run `node --test --test-name-pattern="reading semantic model|reading html adapter" test/*.test.mjs` from `mobile/`; expect FAIL because the new modules do not exist.
- [ ] Implement `reading-semantic-model.mjs` and refactor `reading-text-model.mjs` to delegate TXT parsing while preserving the existing exports used by foundation tests.
- [ ] Implement `reading-html-adapter.mjs` with a detached parser adapter. Traverse only readable structural elements; ignore `script`, `style`, `template`, `object`, `embed`, `iframe`, form controls and event-handler attributes. Never render source `innerHTML`; only return plain semantic data. For images retain only non-empty `alt` text as readable text.
- [ ] Add a source-contract test proving hostile HTML is never assigned to live `innerHTML`, and behavior tests proving headings, paragraphs, lists and alt text survive extraction.
- [ ] Run focused tests and `npm test`; expect PASS.
- [ ] Commit: `feat: add semantic text and html model`.

### Task 2: Android HTML import and private-source compatibility

**Files:**
- Modify `mobile/android/app/src/main/java/com/tifloacosta/app/reading/ReadingImportService.java`
- Modify `mobile/android/app/src/main/java/com/tifloacosta/app/reading/ReadingImportSource.java`
- Modify `mobile/android/app/src/main/java/com/tifloacosta/app/reading/ReadingFileStore.java`
- Modify `mobile/android/app/src/main/java/com/tifloacosta/app/reading/AndroidReadingFileStore.java`
- Modify `mobile/android/app/src/main/java/com/tifloacosta/app/TifloReadingPlugin.java`
- Modify `mobile/android/app/src/main/AndroidManifest.xml`
- Modify `mobile/android/app/src/test/java/com/tifloacosta/app/reading/ReadingImportServiceTest.java`
- Modify `mobile/test/reading-android-native-contract.test.mjs`

**Interfaces:**
- Import accepts TXT (`.txt` / `text/plain`) and HTML (`.html`, `.htm` / `text/html`).
- Final source path becomes `reading-library/items/<id>/source.<txt|html>`.
- `openBook({id})` continues returning `{ book, content }`; `book.format` decides the shared adapter.

- [ ] Extend failing JVM tests for HTML acceptance, extension normalization, empty HTML rejection after readable-text validation, duplicate bytes, rollback and no regression for TXT.
- [ ] Extend native contract test for picker/share MIME coverage (`text/plain`, `text/html`) without broad storage permissions.
- [ ] Run `./gradlew testDebugUnitTest` plus the focused Node contract test; expect FAIL on missing HTML behavior.
- [ ] Implement format-aware file naming and validation. Keep SHA-256 identity over original bytes. Validate HTML as non-empty source here; semantic sanitization remains Task 1.
- [ ] Update picker/share intake so both single and multiple TXT/HTML streams reach the same transactional importer.
- [ ] Run JVM tests, `npm test`, `npm run build`, `npm run sync:android`, and `./gradlew assembleDebug`; expect PASS.
- [ ] Commit: `feat: import html reading documents on android`.

### Task 3: SQLite v2 migration for precise positions, marks and inherited settings

**Files:**
- Modify `mobile/android/app/src/main/java/com/tifloacosta/app/reading/ReadingBookRecord.java`
- Modify `mobile/android/app/src/main/java/com/tifloacosta/app/reading/ReadingBookRepository.java`
- Modify `mobile/android/app/src/main/java/com/tifloacosta/app/reading/ReadingLibraryDatabase.java`
- Create `mobile/android/app/src/main/java/com/tifloacosta/app/reading/ReadingMarkRecord.java`
- Create `mobile/android/app/src/main/java/com/tifloacosta/app/reading/ReadingSettingsRecord.java`
- Modify `mobile/android/app/src/androidTest/java/com/tifloacosta/app/reading/ReadingLibraryDatabaseTest.java`

**Interfaces:**
- Database schema version becomes `2` with explicit `onUpgrade(1,2)`.
- Add `books.unit_index INTEGER NOT NULL DEFAULT 0` and `books.anchor_text TEXT`.
- Add `marks(id TEXT PRIMARY KEY, book_id TEXT NOT NULL, type TEXT NOT NULL, block_index INTEGER NOT NULL, unit_index INTEGER NOT NULL, excerpt TEXT, reference TEXT, created_at INTEGER NOT NULL)` with book/order indexes.
- Add `reading_settings(scope TEXT NOT NULL, book_id TEXT NOT NULL DEFAULT '', key TEXT NOT NULL, value TEXT NOT NULL, updated_at INTEGER NOT NULL, PRIMARY KEY(scope, book_id, key))`; scope is exactly `global|book`.
- Mark types are exactly `bookmark|important|review|quote`.
- Repository adds precise progress, marks CRUD/list, and settings get/set/reset methods.

- [ ] Write failing instrumentation tests that create a v1 database fixture, upgrade it to v2, prove existing book/progress survive, and exercise precise progress, mark ordering/filtering, cascade-style cleanup on book delete, global settings, book overrides and reset-to-inheritance.
- [ ] Run `assembleDebugAndroidTest`; expect FAIL before migration/schema methods exist.
- [ ] Implement v2 migration with `ALTER TABLE` plus table/index creation. Never drop `books` in upgrade.
- [ ] Implement parameterized repository methods and delete related marks/settings transactionally with the book row.
- [ ] Run `testDebugUnitTest` and `assembleDebugAndroidTest`; expect PASS.
- [ ] Commit: `feat: add reading marks settings and precise positions`.

### Task 4: Search engine with temporary result positions

**Files:**
- Create `mobile/src/core/reading-search.mjs`
- Create `mobile/test/reading-search.test.mjs`

**Interfaces:**
- `createReadingSearchIndex(document, { yieldEvery = 100 } = {})`.
- `search(query, { limit = 100 } = {}) -> { total, results }`.
- Result shape: `{ blockIndex, unitIndex, excerpt, heading, matchStart, matchEnd }`.
- `build(onProgress)` is incremental/yielding and may be called while visual reading remains available.

- [ ] Write failing tests for case-insensitive word/phrase matching, accents preserved, surrounding context, nearest prior heading, previous/next ordering, empty query, result limits and large-document yielding.
- [ ] Run focused search tests; expect FAIL because module does not exist.
- [ ] Implement a normalized searchable text index without changing source block text. Build in batches and yield with an injectable scheduler so tests are deterministic.
- [ ] Add a test proving searching and jumping through results does not mutate a reading session until an explicit `continueFromResult(result)` action is called by the UI layer later.
- [ ] Run focused tests and `npm test`; expect PASS.
- [ ] Commit: `feat: add incremental in-document search`.

### Task 5: Native Android TTS controller and Capacitor bridge

**Files:**
- Create `mobile/android/app/src/main/java/com/tifloacosta/app/reading/ReadingTtsController.java`
- Modify `mobile/android/app/src/main/java/com/tifloacosta/app/TifloReadingPlugin.java`
- Modify `mobile/android/app/src/main/java/com/tifloacosta/app/MainActivity.java`
- Create `mobile/android/app/src/test/java/com/tifloacosta/app/reading/ReadingTtsControllerTest.java`
- Modify `mobile/test/reading-android-native-contract.test.mjs`

**Interfaces:**
- Bridge methods: `listTtsVoices()`, `startTts({sessionId, utteranceId, text, voiceId, rate})`, `stopTts()`.
- Events: `ttsStarted`, `ttsDone`, `ttsError`, `ttsInterrupted`; every event includes `sessionId`, and utterance events include `utteranceId`.
- Voice shape: `{ id, name, language, locale, networkRequired }`.
- Rate accepted by shared layer is clamped to `0.5..2.0` before reaching Android.

- [ ] Write failing controller/contract tests for voice enumeration mapping, stale-session identifiers, stop semantics, rate propagation, audio-focus loss and `ACTION_AUDIO_BECOMING_NOISY` interruption.
- [ ] Run `testDebugUnitTest` and focused Node native-contract tests; expect FAIL.
- [ ] Implement `ReadingTtsController` around Android `TextToSpeech` with `UtteranceProgressListener`, `AudioManager` focus and noisy-audio receiver. Native code speaks one supplied semantic unit at a time; queue ownership remains shared-layer state.
- [ ] Ensure loss of focus/headphone disconnect calls stop and emits `ttsInterrupted`; never auto-resume.
- [ ] Initialize/shutdown the controller with plugin lifecycle and execute TTS setup/work off the UI thread where Android permits.
- [ ] Run unit tests, `assembleDebugAndroidTest`, `assembleDebug`, and Node contract tests; expect PASS.
- [ ] Commit: `feat: add android reading tts bridge`.

### Task 6: Shared speech coordinator and settings inheritance

**Files:**
- Modify `mobile/src/native/reading-library-plugin.mjs`
- Modify `mobile/src/core/reading-library-client.mjs`
- Create `mobile/src/core/reading-speech.mjs`
- Create `mobile/src/core/reading-settings.mjs`
- Modify `mobile/test/reading-library-client.test.mjs`
- Create `mobile/test/reading-speech.test.mjs`
- Create `mobile/test/reading-settings.test.mjs`

**Interfaces:**
- Client adds `listTtsVoices`, `startTts`, `stopTts`, `listMarks`, `addMark`, `deleteMark`, `getReadingSettings`, `setReadingSetting`, `resetBookReadingSettings`.
- `createReadingSpeechController({ client, document, initialPosition, settings })` owns `play`, `pause`, `moveTo`, `setVoice`, `setRate`, `snapshot`, `destroy`.
- `resolveReadingSettings(globalSettings, bookOverrides)` returns effective settings plus inheritance metadata.
- Default speech rate `1.0`; visual defaults inherit system theme/text scale unless a global setting overrides them.

- [ ] Write failing client normalization/listener tests, speech tests for sentence-to-sentence advance, pause/resume from same logical position, stale callback rejection, end-of-document behavior, voice change without position loss and interruption without auto-resume.
- [ ] Write failing settings tests for global defaults, book override precedence, reset to inheritance, missing-device-voice fallback and numeric clamping.
- [ ] Implement the client extensions and pure shared controllers. Speech persistence callback exposes `{ blockIndex, unitIndex, percent, state }` but does not directly write DB, keeping it testable.
- [ ] Run focused tests and `npm test`; expect PASS.
- [ ] Commit: `feat: coordinate speech and reading settings`.

### Task 7: Accessible semantic reader UI with search, marks, TTS and per-book settings

**Files:**
- Modify `mobile/src/screens/reading-book.mjs`
- Create `mobile/src/screens/reading-search.mjs`
- Create `mobile/src/screens/reading-marks.mjs`
- Create `mobile/src/screens/reading-settings.mjs`
- Modify `mobile/src/app.mjs`
- Modify `mobile/src/core/i18n.mjs`
- Modify `mobile/src/styles.css`
- Modify `mobile/test/reading-book.test.mjs`
- Create `mobile/test/reading-search-screen.test.mjs`
- Create `mobile/test/reading-marks-screen.test.mjs`
- Create `mobile/test/reading-settings-screen.test.mjs`

**Interfaces and behavior:**
- `reading-book` selects TXT or HTML adapter from `book.format` and renders a window of semantic blocks around the logical position; it never inserts source HTML.
- Primary controls: `Reproducir/Pausa`, previous/next with the active semantic unit in the accessible name, `Navegación`, `Buscar`, `Marcas`, `Estado de lectura`, `Voz y velocidad`, `Ajustes visuales`.
- Opening restores position, announces concise progress, then places focus on `Reproducir`; it never auto-plays.
- Search result preview is temporary; `Continuar leyendo desde aquí` is the only action that replaces/persists the primary position.
- Marks offer the four approved types, current-position creation, list/filter/jump and delete.
- Per-book voice/rate/visual changes write overrides immediately; `Restablecer ajustes de este documento` removes only overrides.
- Visual settings in this phase: text size, font family, weight, line spacing, paragraph spacing, reading width, foreground/background, high contrast and `system|light|dark` theme.

- [ ] Write failing source/behavior tests for safe semantic rendering, exact Spanish/English labels, focus on Play after restore, no autoplay, shared visual/speech position, temporary search, mark creation/jump, inherited settings and reset.
- [ ] Run `node --test --test-name-pattern="reading book|reading search screen|reading marks screen|reading settings screen" test/*.test.mjs`; expect FAIL.
- [ ] Implement the screens and route/state handoffs without changing existing `reader` or remote `library` routes.
- [ ] Use semantic DOM elements (`h1..h6`, `p`, `ul/ol/li`, `blockquote`, simple table text representation) and native buttons/forms. Status announcements are polite and never fire on each search keystroke.
- [ ] Apply visual settings through CSS custom properties on the reader container only; retain system text scaling and avoid fixed pixel heights.
- [ ] Run `npm test` and `npm run build`; expect PASS.
- [ ] Commit: `feat: add semantic accessible reading controls`.

### Task 8: Integration, recovery and Android verification

**Files:**
- Modify `.github/workflows/bootstrap-mobile-android.yml` only if a missing verification step is proven necessary.
- Modify existing tests only for defects found by integration verification.
- Add `mobile/test/reading-integration-contract.test.mjs` if cross-component behavior is not already pinned elsewhere.

- [ ] Add an integration contract proving: TXT/HTML import -> library -> semantic open -> resume; TTS never auto-starts; search preview does not move saved position; mark jump does; book settings override global settings; deletion removes private item/marks/settings but not external source semantics.
- [ ] Run from `mobile/`: `npm test`, `npm run build`, `npm run sync:android`.
- [ ] Run from `mobile/android/`: `./gradlew testDebugUnitTest`, `./gradlew assembleDebugAndroidTest`, `./gradlew assembleDebug`.
- [ ] Run the repository Android workflow and require the same signing, merged-manifest, notification and artifact checks that are currently green.
- [ ] With an Android device/emulator when available, smoke test TalkBack: open/resume TXT and HTML; navigate by paragraph/heading; play/pause TTS; change voice/rate; unplug headphones while speaking; search and return; create/jump/delete each mark type; change/reset book visual settings; confirm ordinary shared text still uses the old share flow.
- [ ] Record any device-only limitation explicitly; do not call device-only behavior verified from compilation alone.
- [ ] Commit: `test: verify semantic reading and tts phase`.

## Completion boundary

This phase is complete when TXT and HTML share one semantic reader, precise resume survives migration, TTS is controllable and interruption-safe, search remains non-destructive until explicitly adopted, marks persist, and global/per-book voice and visual settings inherit correctly. Audio/audiobooks, DAISY, EPUB, DOCX, PDF, ZIP, queue, portable backup/restore and full beta acceptance remain separate follow-on plans.