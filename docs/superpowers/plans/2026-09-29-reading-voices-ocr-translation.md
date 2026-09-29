# TifloLector Voices, OCR, and Translation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add voice acquisition, OCR for image-only PDFs, and local document translation while preserving originals, semantic positions, marks, privacy, and accessibility.

**Architecture:** Keep semantic reading in the shared JavaScript layer and use focused native Android services for platform capabilities. Voice acquisition extends the existing TTS plugin. OCR exposes page-at-a-time native recognition so large PDFs are processed incrementally. Translation exposes language identification and bounded text-batch translation through ML Kit; the shared layer keeps source/translation block identity and persists derived documents through a native derived-content store.

**Tech Stack:** Capacitor 8.5.2; Android Java; SQLiteOpenHelper schema v6; PDFBox Android; Google Play Services ML Kit Text Recognition v2; ML Kit Translation 17.0.3; Play-services Language ID 17.0.0; Node 22 `node:test`.

**Spec:** `docs/superpowers/specs/2026-09-29-tiflolector-1.3.4-reading-upgrade-design.md`

## Global Constraints

- Original imported files are never modified or replaced.
- OCR and translation results are derived local content associated with the original book.
- Derived content is included in TifloLector explicit backup; downloadable ML models are not.
- OCR and translation must be cancellable and resumable from persisted partial work.
- Translation is for reading/comprehension, not guaranteed professional/literary translation.
- TifloAcosta never uploads book content to its own servers.
- Unsupported scripts/languages fail recoverably without blocking original reading.
- Marks and the primary saved position remain anchored to source semantic positions.
- New UI uses the visual/accessibility primitives from the Android visual-refresh plan.

## Pinned Android dependencies

- `com.google.android.gms:play-services-mlkit-text-recognition:19.0.1`
- `com.google.android.gms:play-services-mlkit-text-recognition-chinese:16.0.1`
- `com.google.android.gms:play-services-mlkit-text-recognition-devanagari:16.0.1`
- `com.google.android.gms:play-services-mlkit-text-recognition-japanese:16.0.1`
- `com.google.android.gms:play-services-mlkit-text-recognition-korean:16.0.1`
- `com.google.android.gms:play-services-mlkit-language-id:17.0.0`
- `com.google.mlkit:translate:17.0.3`

These versions were checked against current official Android documentation before writing this plan. Re-check only if implementation happens after a dependency/toolchain change.

## Review Focus

- A 500+ page scanned PDF must not render all pages into memory at once.
- Partial OCR/translation surviving cancellation or process interruption must never masquerade as complete.
- A regenerated translation must not orphan marks or change the primary source position.
- Missing Google Play Services/model download must produce a useful recoverable state, not a blank document.
- Mixed-language or undetermined-language documents must allow manual source-language selection before translation.

---

### Task 1: Add derived-content persistence schema v6

**Files:**
- Create: `mobile/android/app/src/main/java/com/tifloacosta/app/reading/ReadingDerivedRecord.java`
- Create: `mobile/android/app/src/main/java/com/tifloacosta/app/reading/ReadingDerivedStore.java`
- Modify: `mobile/android/app/src/main/java/com/tifloacosta/app/reading/ReadingLibraryDatabase.java`
- Modify: `mobile/android/app/src/androidTest/java/com/tifloacosta/app/reading/ReadingLibraryDatabaseTest.java`
- Modify: `mobile/android/app/src/main/java/com/tifloacosta/app/reading/ReadingBackupService.java`
- Modify: `mobile/android/app/src/test/java/com/tifloacosta/app/reading/ReadingBackupServiceTest.java`

**Interfaces:**
- Database becomes version `6` with migration `5 -> 6` only; no destructive fallback.
- New table `reading_derived` fields: `book_id`, `kind`, `variant_key`, `relative_path`, `source_sha256`, `source_language`, `target_language`, `engine`, `engine_version`, `status`, `completed_units`, `total_units`, `updated_at`.
- `kind` exactly `ocr|translation`; `status` exactly `partial|complete|error`.
- Derived JSON files live under `reading-library/items/<bookId>/derived/...` and are private.

- [ ] Write failing migration tests proving v5 data survives and derived rows round-trip.
- [ ] Write failing backup tests proving completed/partial derived files and metadata export/restore while ML models are absent from the archive.
- [ ] Run Android focused tests; expect FAIL.
- [ ] Implement v6 table/indexes, file store, cleanup on book delete, and backup/restore integration.
- [ ] Run instrumentation/unit tests; expect PASS.
- [ ] Commit: `feat: persist derived reading content`.

### Task 2: Expose derived-content bridge to the shared layer

**Files:**
- Modify: `mobile/android/app/src/main/java/com/tifloacosta/app/TifloReadingPlugin.java`
- Modify: `mobile/src/native/reading-library-plugin.mjs`
- Modify: `mobile/src/core/reading-library-client.mjs`
- Modify: `mobile/test/reading-library-client.test.mjs`
- Modify: `mobile/test/reading-android-native-contract.test.mjs`

**Interfaces:**
- Native methods: `getDerivedContent({bookId,kind,variantKey})`, `saveDerivedContent({bookId,kind,variantKey,metadata,content})`, `deleteDerivedContent(...)`, `listDerivedContent({bookId})`.
- Shared client normalizes status/progress and parses semantic JSON only after validation.

- [ ] Write failing client/native-contract tests for all four operations, malformed JSON, stale source SHA, and missing records.
- [ ] Run focused Node tests; expect FAIL.
- [ ] Implement native bridge and shared client methods.
- [ ] Run focused tests plus Android unit tests; expect PASS.
- [ ] Commit: `feat: bridge derived reading content`.

### Task 3: Add “Conseguir más voces” to the TTS bridge

**Files:**
- Modify: `mobile/android/app/src/main/java/com/tifloacosta/app/reading/ReadingTtsController.java`
- Modify: `mobile/android/app/src/main/java/com/tifloacosta/app/TifloReadingTtsPlugin.java`
- Modify: `mobile/src/native/reading-library-plugin.mjs`
- Modify: `mobile/src/core/reading-library-client.mjs`
- Modify: `mobile/src/screens/reading-settings.mjs`
- Modify: `mobile/src/core/i18n.mjs`
- Modify: `mobile/test/reading-settings-screen.test.mjs`
- Modify: `mobile/test/reading-android-native-contract.test.mjs`

**Interfaces:**
- Native `openTtsVoiceInstaller()` first resolves `TextToSpeech.Engine.ACTION_INSTALL_TTS_DATA` for the active/default engine.
- If unavailable, it may open the engine app/package details only when a safe resolvable intent exists.
- Result reports `{opened:boolean, destination:'installer'|'engine'|'none'}`.
- App shows an explicit external-navigation notice before calling it.
- On Capacitor `resume`, settings refreshes `listTtsVoices()` and preserves current selection when still available.

- [ ] Write failing Android contract tests for resolvable installer, fallback engine destination, and no-destination behavior.
- [ ] Write failing UI tests for ES/EN label, notice, focus restoration, and refresh-on-resume.
- [ ] Implement native intent resolution and settings UI.
- [ ] Run focused tests and full mobile suite; expect PASS.
- [ ] Commit: `feat: help users install more tts voices`.

### Task 4: Add ML Kit OCR dependencies and page renderer

**Files:**
- Modify: `mobile/android/app/build.gradle`
- Modify: `mobile/android/app/src/main/AndroidManifest.xml`
- Create: `mobile/android/app/src/main/java/com/tifloacosta/app/reading/ReadingPdfPageRenderer.java`
- Create: `mobile/android/app/src/test/java/com/tifloacosta/app/reading/ReadingPdfPageRendererTest.java`

**Interfaces:**
- Add the five unbundled Play Services OCR artifacts pinned above.
- Manifest may request install-time modules via ML Kit dependency metadata only if that does not force all script models; otherwise use on-demand first-use behavior.
- `renderPage(relativePath,password,pageIndex,maxDimension)` returns one bounded bitmap/page result and releases PDF resources immediately after the requested unit of work.

- [ ] Write failing tests/source contracts proving only one page is rendered per call and page indexes are validated.
- [ ] Add Gradle dependencies and page renderer using existing private-path validation patterns.
- [ ] Run `./gradlew testDebugUnitTest` and debug build; expect PASS.
- [ ] Commit: `feat: prepare pdf pages for ocr`.

### Task 5: Implement native page-at-a-time OCR

**Files:**
- Create: `mobile/android/app/src/main/java/com/tifloacosta/app/reading/ReadingOcrService.java`
- Create: `mobile/android/app/src/main/java/com/tifloacosta/app/TifloReadingOcrPlugin.java`
- Modify: `mobile/android/app/src/main/java/com/tifloacosta/app/MainActivity.java`
- Create: `mobile/android/app/src/test/java/com/tifloacosta/app/reading/ReadingOcrServiceTest.java`
- Modify: `mobile/test/reading-android-native-contract.test.mjs`

**Interfaces:**
- Scripts exactly `latin|chinese|devanagari|japanese|korean`.
- Native method `recognizePdfPage({bookId,password,pageIndex,script})` returns `{pageIndex,text,blocks,status}`.
- `status` exactly `ok|empty|model-unavailable|unsupported-script|error`.
- Recognition happens off the UI thread and closes recognizer/page bitmap resources.

- [ ] Write failing service tests using injectable recognizer/page-renderer fakes for success, empty page, model unavailable, bad script, cancellation/error cleanup.
- [ ] Add plugin registration/native contract test.
- [ ] Implement recognizer factory for each script and plugin bridge.
- [ ] Run JVM tests, instrumentation compile, and debug build; expect PASS.
- [ ] Commit: `feat: recognize scanned pdf pages`.

### Task 6: Add resumable OCR orchestration and reader UI

**Files:**
- Create: `mobile/src/core/reading-ocr.mjs`
- Create: `mobile/test/reading-ocr.test.mjs`
- Modify: `mobile/src/native/reading-library-plugin.mjs`
- Modify: `mobile/src/core/reading-library-client.mjs`
- Modify: `mobile/src/screens/reading-book.mjs`
- Modify: `mobile/src/core/i18n.mjs`
- Modify: `mobile/test/reading-pdf-screen.test.mjs`

**Interfaces:**
- `createReadingOcrJob({client,book,pdfInfo,script,onProgress})` processes one page at a time.
- Persists partial derived content after each completed page.
- `cancel()` stops before the next page; completed pages remain.
- Resume starts at first incomplete page.
- Completed OCR is adapted to the existing semantic document model with page references; no invented headings/tables.

- [ ] Write failing pure tests for page sequence, partial save, cancel, resume, one-page failure with continuation, and final complete status.
- [ ] Add UI tests: `pdfNoText` offers `Reconocer texto con OCR`; progress is polite; completion does not auto-play TTS.
- [ ] Implement orchestrator and reader integration using shared visual action groups.
- [ ] Run focused tests and full `npm test`; expect PASS.
- [ ] Commit: `feat: add resumable ocr reading flow`.

### Task 7: Add Language ID and translation native bridge

**Files:**
- Modify: `mobile/android/app/build.gradle`
- Create: `mobile/android/app/src/main/java/com/tifloacosta/app/reading/ReadingTranslationService.java`
- Create: `mobile/android/app/src/main/java/com/tifloacosta/app/TifloReadingLanguagePlugin.java`
- Modify: `mobile/android/app/src/main/java/com/tifloacosta/app/MainActivity.java`
- Create: `mobile/android/app/src/test/java/com/tifloacosta/app/reading/ReadingTranslationServiceTest.java`
- Modify: `mobile/test/reading-android-native-contract.test.mjs`

**Interfaces:**
- Dependencies: `play-services-mlkit-language-id:17.0.0`, `com.google.mlkit:translate:17.0.3`.
- Native `identifyLanguage({text}) -> {language,confidenceKnown}` with `und` preserved.
- Native `listTranslationLanguages()` returns ML Kit supported language codes.
- Native `downloadTranslationModel({language})`.
- Native `translateBatch({sourceLanguage,targetLanguage,texts}) -> {translations}` with bounded batch size enforced by plugin.
- Native `deleteTranslationModel({language})` may be exposed for storage management but is not required in first UI.

- [ ] Write failing service tests with injectable language-ID/translator adapters for `und`, supported/unsupported pairs, model missing, ordered batch output, and partial task failure.
- [ ] Add Gradle dependencies and plugin registration/source contract.
- [ ] Implement bridge and explicit model-download flow.
- [ ] Run JVM tests and debug build; expect PASS.
- [ ] Commit: `feat: add local reading translation bridge`.

### Task 8: Build source-aligned translation model and cache

**Files:**
- Create: `mobile/src/core/reading-translation.mjs`
- Create: `mobile/test/reading-translation.test.mjs`
- Modify: `mobile/src/core/reading-structured-adapter.mjs`
- Modify: `mobile/src/core/reading-semantic-model.mjs` only if source-reference metadata cannot be represented without change.

**Interfaces:**
- Each translated block retains `sourceBlockIndex` and source semantic identity.
- Translation never changes URLs/internal IDs.
- `createReadingTranslationJob({client,document,sourceLanguage,targetLanguage,sourceSha256,onProgress})` batches translatable text, persists after bounded chunks, and resumes partial caches.
- Cache key includes source SHA + source language + target language + engine identifier.
- Primary reading position remains source `{blockIndex,unitIndex}`.

- [ ] Write failing tests for heading/list/quote/table-cell preservation, URL exclusion, source alignment, partial save/resume, source-SHA invalidation, and deterministic cache key.
- [ ] Implement pure translation orchestration and derived-content serialization.
- [ ] Run focused tests; expect PASS.
- [ ] Commit: `feat: preserve source positions in translations`.

### Task 9: Add translation UI and Original/Translation switching

**Files:**
- Modify: `mobile/src/screens/reading-book.mjs`
- Create: `mobile/src/screens/reading-translation-panel.mjs`
- Modify: `mobile/src/core/i18n.mjs`
- Modify: `mobile/src/screens/reading-settings.mjs` if destination voice selection needs a shared affordance.
- Create: `mobile/test/reading-translation-screen.test.mjs`
- Modify: `mobile/test/reading-book.test.mjs`

**Interfaces:**
- `Traducir` opens a panel with detected/manual source language and target language.
- Missing model requires explicit download action before translation starts.
- Reader exposes `Original / Traducción` only when translated content exists.
- Switching view keeps the same source semantic position and never auto-starts speech.
- Marks created while viewing translation are saved against source position.
- TTS chooses a compatible target-language voice when possible without overwriting the user’s saved source-language preference.

- [ ] Write failing UI tests for detected language, manual source override, target selection, download notice, cancel/resume, view toggle, position preservation, mark alignment, and no-autoplay.
- [ ] Implement panel and reader switching using the shared visual/action primitives.
- [ ] Run focused tests and full suite; expect PASS.
- [ ] Commit: `feat: translate books inside tiflolector`.

### Task 10: Extend backup/restore and maintenance UI for derived data

**Files:**
- Modify: `mobile/src/screens/reading-backup-panel.mjs`
- Modify: `mobile/src/core/reading-backup-client.mjs`
- Modify: `mobile/test/reading-backup-panel.test.mjs`
- Modify: `mobile/test/reading-backup-bridge.test.mjs`

**Interfaces:**
- Backup summary reports derived OCR/translation items included.
- Restore validates derived metadata against restored source book SHA.
- Library maintenance can identify orphan derived files and remove only those orphans.

- [ ] Add failing tests for backup summary, restored derived content, SHA mismatch rejection, and orphan cleanup.
- [ ] Implement client/panel presentation and native cleanup hook if not already exposed by Task 1.
- [ ] Run backup tests and full suite; expect PASS.
- [ ] Commit: `feat: preserve derived reading data in backups`.

### Task 11: Strengthen beta acceptance gate

**Files:**
- Modify: `mobile/test/reading-beta-acceptance.test.mjs`
- Modify: `.github/workflows/bootstrap-mobile-android.yml`
- Modify: `.github/workflows/test-mobile-release.yml`

**Interfaces:**
- Gate requires voice installer bridge, OCR plugin/dependencies, translation plugin/dependencies, v6 migration, derived backup, and UI entry points.

- [ ] Add failing gate assertions for all new capabilities.
- [ ] Run `npm run test:reading-beta`; expect FAIL before gate wiring is complete.
- [ ] Update gate/workflows and run `npm test`, `npm run build`, `npm run sync:android`, `./gradlew testDebugUnitTest`, `./gradlew assembleDebugAndroidTest`, and `./gradlew assembleDebug`; expect PASS.
- [ ] Commit: `test: gate voices ocr and translation`.

### Task 12: Manual Android acceptance before release

**Files:**
- Modify this plan only to record verified evidence.

- [ ] Install/acquire an additional TTS voice through the exposed flow where the test engine supports it; return and verify refresh.
- [ ] OCR a multi-page scanned PDF; cancel midway; resume; search and add a mark in OCR text.
- [ ] Translate a non-Spanish document to Spanish; pause/cancel and resume; switch Original/Translation without losing position.
- [ ] Translate OCR-derived text.
- [ ] Verify unsupported script/language and missing-model states remain recoverable.
- [ ] Export backup, clear/restore test data, and verify OCR/translation results return without redownloading models merely to read stored derived text.
- [ ] Run TalkBack through all new controls and verify focus/status announcements.
