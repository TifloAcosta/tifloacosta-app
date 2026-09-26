# Leer con TifloAcosta — Android Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first end-to-end Android vertical slice for “Leer con TifloAcosta”: import plain-text files into app-private storage, persist them in a local SQLite library, list them 10 per page, open and resume paragraph-level reading, and delete only TifloAcosta’s private copy.

**Architecture:** Add a native Capacitor plugin named `TifloReading` that owns Android document picking, shared-file intake, private file copies, SHA-256 duplicate detection, SQLite persistence, and cleanup. The shared JavaScript layer consumes a stable plugin contract and renders dedicated `reading-library` and `reading-book` routes, leaving the existing remote-resource `library` and web/article `reader` untouched. This first plan intentionally supports TXT only so the architecture can be verified end to end before later plans add the complete text engine, TTS, audio, DAISY, EPUB, DOCX, PDF, ZIP, backup/restore, and the rest of the approved design.

**Tech Stack:** Capacitor 8.5.2; Android Java with `SQLiteOpenHelper`; Android minSdk 24 / compileSdk 36 / targetSdk 36; ES modules bundled by esbuild; Node 22 `node:test`; Android JUnit 4 / AndroidX Test / Espresso.

**Spec:** `docs/superpowers/specs/2026-09-26-leer-con-tifloacosta-android-design.md`

## Global Constraints

- No broad `READ_*`, `WRITE_EXTERNAL_STORAGE`, or all-files storage permissions.
- Local-only library: no account, server, synchronization, or upload of content, searches, progress, or marks.
- Import always copies bytes into app-private storage; delete never touches the external original.
- Phase 1 accepts `.txt` / `text/plain` file streams only. Existing shared text messages without a file stream continue through `TifloShare` unchanged.
- Final item storage: `filesDir/reading-library/items/<book-id>/source.txt`; temporary work: `filesDir/reading-library/tmp/`.
- SHA-256 of imported bytes is the duplicate identity. Filename is not identity.
- Default library page size is 10.
- Opening a book never starts speech/audio automatically.
- Existing `library` and `reader` routes remain unchanged in purpose and behavior.
- Reading-library files and its SQLite DB are excluded from Android automatic/cloud backup. Portable backup comes later.
- This phase proves the architecture; it is not the beta-ready completion of the full feature.

## Follow-on plans

After this vertical slice is working and reviewed, create separate implementation plans for:

1. semantic text engine, TTS, search, marks, document-specific visual/voice settings, and HTML;
2. audio/audiobooks, background playback, media controls, headphones, speed and sleep timer;
3. EPUB, DOCX, PDF, DAISY, M4B chapter metadata, ZIP and multi-file adapters;
4. queue, full settings, portable backup/restore/conflicts, migrations/recovery, performance hardening and final beta acceptance.

## Review Focus

- `ACTION_SEND` text message vs TXT stream: `EXTRA_TEXT` alone stays in the old share flow; `EXTRA_STREAM`/`SEND_MULTIPLE` goes to `TifloReading`.
- Same bytes under another filename: no duplicate row; return the existing ID.
- Failed/interrupted import: no visible partial item; stale temp content is cleaned later.
- Empty/unsupported/space-constrained item: reject only that item with a concrete result; existing library remains valid.
- Bad saved paragraph index: clamp safely to a valid paragraph and never crash.

---

### Task 1: Stable JavaScript native-client contract

**Files:**
- Create `mobile/src/native/reading-library-plugin.mjs`
- Create `mobile/src/core/reading-library-client.mjs`
- Create `mobile/test/reading-library-client.test.mjs`

**Interfaces**

```js
createReadingLibraryPlugin(plugin = NativeTifloReading)
createReadingLibraryClient(plugin)
```

Native-facing methods:

```text
pickDocuments()
consumeInitialSharedDocuments()
listBooks(options)
openBook(id)
saveProgress(progress)
deleteBook(id)
getLatestInProgress()
addListener(eventName, listener)
```

Normalized book:

```js
{ id, title, format, state, percent, blockIndex, importedAt, lastReadAt, sizeBytes }
```

Normalized import batch:

```js
{ cancelled, imported: [], duplicates: [], rejected: [] }
```

Normalized list:

```js
{ items, total, page, pageSize, pages }
```

Default query:

```js
{ page: 1, pageSize: 10, query: '', status: 'all', sort: 'lastRead' }
```

- [ ] Write failing tests for defaults, type normalization, safe unavailable-plugin results, and listener fallback exposing `remove()`.
- [ ] Run from `mobile/`:

```bash
node --test --test-name-pattern="reading library client" test/*.test.mjs
```

Expected: FAIL because modules do not exist.

- [ ] Implement the wrapper and client. Keep UI strings out of this layer.
- [ ] Run:

```bash
node --test --test-name-pattern="reading library client" test/*.test.mjs
npm test
```

Expected: PASS.

- [ ] Commit:

```bash
git add mobile/src/native/reading-library-plugin.mjs mobile/src/core/reading-library-client.mjs mobile/test/reading-library-client.test.mjs
git commit -m "feat: add reading library client contract"
```

### Task 2: SQLite library repository and paged queries

**Files:**
- Create `mobile/android/app/src/main/java/com/tifloacosta/app/reading/ReadingBookRecord.java`
- Create `mobile/android/app/src/main/java/com/tifloacosta/app/reading/ReadingBookQuery.java`
- Create `mobile/android/app/src/main/java/com/tifloacosta/app/reading/ReadingBookRepository.java`
- Create `mobile/android/app/src/main/java/com/tifloacosta/app/reading/ReadingLibraryDatabase.java`
- Create `mobile/android/app/src/androidTest/java/com/tifloacosta/app/reading/ReadingLibraryDatabaseTest.java`

Database: `tiflo_reading.db`, schema version 1.

`books` columns:

```text
id TEXT PRIMARY KEY
sha256 TEXT NOT NULL UNIQUE
title TEXT NOT NULL
format TEXT NOT NULL
mime_type TEXT NOT NULL
relative_path TEXT NOT NULL
size_bytes INTEGER NOT NULL
imported_at INTEGER NOT NULL
last_read_at INTEGER
state TEXT NOT NULL DEFAULT 'not-read'
block_index INTEGER NOT NULL DEFAULT 0
percent REAL NOT NULL DEFAULT 0
```

State values are exactly `not-read`, `in-reading`, `read`.

Repository contract:

```java
ReadingBookRecord findById(String id);
ReadingBookRecord findBySha256(String sha256);
List<ReadingBookRecord> list(ReadingBookQuery query);
int count(ReadingBookQuery query);
ReadingBookRecord latestInProgress();
void insert(ReadingBookRecord record);
void updateProgress(String id, int blockIndex, double percent, String state, long lastReadAt);
void delete(String id);
```

`ReadingBookQuery` supports case-insensitive title search, statuses `all|not-read|in-reading|read`, sorts `title|imported|lastRead`, and `limit`/`offset`.

- [ ] Write failing instrumentation tests for insert/find, SHA uniqueness, 10-item paging, title search, status filter, last-read sort, progress update, latest in-progress and delete.
- [ ] From `mobile/android/`, with emulator/device available, run:

```bash
./gradlew connectedDebugAndroidTest
```

Expected: FAIL because classes do not exist.

- [ ] Implement `ReadingLibraryDatabase extends SQLiteOpenHelper implements ReadingBookRepository`, using parameterized selection arguments. No destructive schema fallback; future versions require explicit migrations.
- [ ] Run:

```bash
./gradlew connectedDebugAndroidTest
./gradlew testDebugUnitTest
```

Expected: PASS where the connected test environment is available.

- [ ] Commit:

```bash
git add mobile/android/app/src/main/java/com/tifloacosta/app/reading mobile/android/app/src/androidTest/java/com/tifloacosta/app/reading
git commit -m "feat: add local reading library database"
```

### Task 3: Transactional TXT import and private file store

**Files:**
- Create `mobile/android/app/src/main/java/com/tifloacosta/app/reading/ReadingImportSource.java`
- Create `mobile/android/app/src/main/java/com/tifloacosta/app/reading/ReadingImportResult.java`
- Create `mobile/android/app/src/main/java/com/tifloacosta/app/reading/ReadingFileStore.java`
- Create `mobile/android/app/src/main/java/com/tifloacosta/app/reading/ReadingImportService.java`
- Create `mobile/android/app/src/test/java/com/tifloacosta/app/reading/ReadingImportServiceTest.java`

**Interfaces**

```java
ReadingImportResult importOne(ReadingImportSource source, InputStream input);
void cleanupStaleTemps();
String readUtf8(String relativePath);
void deleteItemDirectory(String id);
```

`ReadingImportSource` contains `displayName`, `mimeType`, nullable `declaredSizeBytes`.

Rules:
- accept filename `.txt` OR MIME exactly `text/plain`;
- reject content empty after optional UTF-8 BOM removal and whitespace check;
- stream once into temp storage while calculating SHA-256 and actual byte count;
- if size is known, require at least `declaredSizeBytes + 16 MiB` free before starting; keep checking actual write failures rather than exposing a fixed user-visible maximum;
- duplicate SHA removes temp and returns the existing book ID;
- final path is `reading-library/items/<uuid>/source.txt`;
- if final move succeeds but DB insert fails, remove the final item directory;
- one failed item must not invalidate already-completed items in a multi-file batch.

- [ ] Write failing pure-Java tests with fake repository/file-store dependencies for: duplicate bytes with different name, unsupported input, empty/BOM text, insufficient space, repository insert failure, stale temp cleanup, and independent batch-item failure.
- [ ] Run:

```bash
./gradlew testDebugUnitTest
```

Expected: FAIL.

- [ ] Implement the minimal importer. Keep Android `Uri` parsing outside this service so transaction behavior remains JVM-testable.
- [ ] Run:

```bash
./gradlew testDebugUnitTest
```

Expected: PASS.

- [ ] Commit:

```bash
git add mobile/android/app/src/main/java/com/tifloacosta/app/reading mobile/android/app/src/test/java/com/tifloacosta/app/reading
git commit -m "feat: add transactional txt importer"
```

### Task 4: Capacitor bridge, Android picker and shared-file intake

**Files:**
- Create `mobile/android/app/src/main/java/com/tifloacosta/app/TifloReadingPlugin.java`
- Modify `mobile/android/app/src/main/java/com/tifloacosta/app/MainActivity.java`
- Modify `mobile/android/app/src/main/java/com/tifloacosta/app/TifloSharePlugin.java`
- Modify `mobile/android/app/src/main/AndroidManifest.xml`
- Create `mobile/test/reading-android-native-contract.test.mjs`

`@CapacitorPlugin(name = "TifloReading")` exposes the Task 1 methods and event `documentsReceived`.

Picker behavior:
- `ACTION_OPEN_DOCUMENT`;
- `CATEGORY_OPENABLE`;
- MIME `text/plain`;
- `EXTRA_ALLOW_MULTIPLE=true`;
- process both `data.getData()` and `ClipData`.

Shared-file behavior:
- `ACTION_SEND` with `EXTRA_STREAM` and `ACTION_SEND_MULTIPLE` stream lists are imported through `TifloReading`;
- phase 1 accepts `text/plain` stream items;
- `TifloSharePlugin.sharedText()` returns empty if the intent contains `EXTRA_STREAM`, preserving ordinary `EXTRA_TEXT` behavior for current text sharing.

Bridge behavior:
- `openBook({id})` resolves `{ book, content }` using only the private TXT copy;
- `saveProgress` persists exact state values from Task 2;
- `deleteBook` removes only the DB record/private item directory, never the source `Uri`;
- copy/query work runs through `getBridge().execute(...)`.

- [ ] Write failing source-contract tests asserting plugin registration, every bridge method, stream guard in `TifloSharePlugin`, `SEND_MULTIPLE`, and absence of broad storage permissions.

```bash
node --test --test-name-pattern="reading android native contract" test/*.test.mjs
```

Expected: FAIL.

- [ ] Implement plugin/manifest/share changes.
- [ ] Run:

```bash
npm test
cd android
./gradlew testDebugUnitTest assembleDebug
```

Expected: PASS.

- [ ] Commit:

```bash
git add mobile/android/app/src/main/java/com/tifloacosta/app/TifloReadingPlugin.java mobile/android/app/src/main/java/com/tifloacosta/app/MainActivity.java mobile/android/app/src/main/java/com/tifloacosta/app/TifloSharePlugin.java mobile/android/app/src/main/AndroidManifest.xml mobile/test/reading-android-native-contract.test.mjs
git commit -m "feat: receive reading documents on android"
```

### Task 5: Plain-text model and safe positions

**Files:**
- Create `mobile/src/core/reading-text-model.mjs`
- Create `mobile/test/reading-text-model.test.mjs`

**Interfaces**

```js
parsePlainText(text, { title = '' } = {}) -> { title, blocks }
normalizeReadingPosition({ blockIndex } = {}, blockCount) -> number
percentForBlock(blockIndex, blockCount) -> number
```

Each block is:

```js
{ id: 'p-<1-based>', type: 'paragraph', text }
```

Parsing rules:
- normalize CRLF/CR to LF;
- remove one leading BOM;
- split paragraphs on one or more blank lines;
- turn single newlines within one paragraph into spaces;
- discard empty blocks.

Position rules:
- clamp index to `0..blockCount-1`;
- empty document returns index 0 and percent 0;
- otherwise percent is `(clampedIndex + 1) / blockCount * 100`, capped at 100.

- [ ] Write failing tests for BOM/CRLF, multi-line paragraph, empty text, IDs, percentage, negative index and oversized index.
- [ ] Run:

```bash
node --test --test-name-pattern="reading text model" test/*.test.mjs
```

Expected: FAIL.

- [ ] Implement only this contract. Do not add sentence/chapter detection yet.
- [ ] Run focused tests and `npm test`; expect PASS.
- [ ] Commit:

```bash
git add mobile/src/core/reading-text-model.mjs mobile/test/reading-text-model.test.mjs
git commit -m "feat: add plain text reading model"
```

### Task 6: Dedicated reading-library route and external-share handoff

**Files:**
- Create `mobile/src/screens/reading-library.mjs`
- Modify `mobile/src/screens/home.mjs`
- Modify `mobile/src/app.mjs`
- Modify `mobile/src/core/i18n.mjs`
- Modify `mobile/src/styles.css`
- Modify `mobile/test/app-shell.test.mjs`
- Create `mobile/test/reading-library-screen.test.mjs`

**Interface**

```js
renderReadingLibrary({ root, router, client, t, onOpenBook, initialImportBatch })
```

Add route `reading-library`; keep existing `library` route.

UI contract:
- Home label ES `Leer con TifloAcosta`, EN `Read with TifloAcosta`;
- explicit search submit, never live announce on each keystroke;
- show only `getLatestInProgress()` as `Continuar leyendo`;
- Import calls `client.pickDocuments()` and refreshes;
- `Mi biblioteca`, 10 items/page;
- title is primary open button;
- brief state/progress below;
- one `Opciones de <título>` control per item;
- phase-1 options contain delete only, with a second explicit confirmation before `deleteBook`;
- page controls `Página anterior`, `Página N de X`, `Página siguiente`;
- polite import summary; do not steal focus;
- for exactly one newly imported item, offer `Abrir ahora`; queue action comes later.

External-share handoff must be explicit in `app.mjs`:

```js
async function installReadingDocumentReceiver() { ... }
```

It must:
1. call `client.consumeInitialSharedDocuments()` after `router.start('home')`;
2. when the returned batch contains imported/duplicate/rejected items, store it in `pendingReadingImportBatch` and open `reading-library`;
3. listen for `documentsReceived` and do the same for new intents while the app is alive;
4. if already on `reading-library`, rerender/refresh rather than stacking another copy of the route;
5. leave the old text-share receiver independent; stream intents are already excluded from it by Task 4.

- [ ] Write failing app-shell/screen tests for the new route while preserving `library`, 10-item requests, explicit search, options/delete confirmation, polite status, and both initial/live document receiver paths.
- [ ] Run:

```bash
node --test --test-name-pattern="reading library|composition root" test/*.test.mjs
```

Expected: FAIL.

- [ ] Implement screen, translations, styling, client creation, `pendingReadingImportBatch`, and `installReadingDocumentReceiver()`.
- [ ] Run:

```bash
npm test
npm run build
```

Expected: PASS.

- [ ] Commit:

```bash
git add mobile/src/screens/reading-library.mjs mobile/src/screens/home.mjs mobile/src/app.mjs mobile/src/core/i18n.mjs mobile/src/styles.css mobile/test/app-shell.test.mjs mobile/test/reading-library-screen.test.mjs
git commit -m "feat: add reading library screen"
```

### Task 7: Basic TXT reader with paragraph navigation and resume

**Files:**
- Create `mobile/src/core/reading-session.mjs`
- Create `mobile/src/screens/reading-book.mjs`
- Create `mobile/test/reading-session.test.mjs`
- Create `mobile/test/reading-book.test.mjs`
- Modify `mobile/src/app.mjs`
- Modify `mobile/src/core/i18n.mjs`

Session interface:

```js
createReadingSession({ blocks, initialIndex = 0 })
```

Methods: `current()`, `previous()`, `next()`, `snapshot()`; index is always clamped.

Screen interface:

```js
renderReadingBook({ root, router, client, bookId, t })
```

App integration:
- route `reading-book`;
- transient `pendingReadingBookId`, following the app’s existing pending-ID pattern instead of changing router semantics.

Behavior:
- H1 is the book title;
- saved progress > 0 produces a brief resume status;
- current paragraph is semantic `<p>`;
- exact navigation labels `Párrafo anterior` / `Párrafo siguiente` and English equivalents;
- opening valid content records `in-reading`/last-read without discarding saved block index;
- successful navigation saves `{ id, blockIndex, percent, state: 'in-reading' }`;
- no autoplay/TTS;
- back returns to reading library; the library refreshes latest/progress state;
- empty/corrupt private content shows an accessible error;
- out-of-range saved index is clamped.

This one-paragraph screen is intentionally temporary. The later semantic-text plan replaces it with a windowed document view without changing book identity/progress semantics.

- [ ] Write failing session tests for clamping/boundaries/current/progress and screen-contract tests for semantic paragraph, exact labels, `saveProgress`, no speech/autoplay and safe empty content.
- [ ] Run:

```bash
node --test --test-name-pattern="reading session|reading book" test/*.test.mjs
```

Expected: FAIL.

- [ ] Implement session, screen, route and translations.
- [ ] Run:

```bash
npm test
npm run build
```

Expected: PASS.

- [ ] Commit:

```bash
git add mobile/src/core/reading-session.mjs mobile/src/screens/reading-book.mjs mobile/test/reading-session.test.mjs mobile/test/reading-book.test.mjs mobile/src/app.mjs mobile/src/core/i18n.mjs
git commit -m "feat: add resumable txt reading screen"
```

### Task 8: Backup exclusion, stale-temp recovery and foundation verification

**Files:**
- Create `mobile/android/app/src/main/res/xml/backup_rules.xml`
- Create `mobile/android/app/src/main/res/xml/data_extraction_rules.xml`
- Modify `mobile/android/app/src/main/AndroidManifest.xml`
- Modify `mobile/android/app/src/main/java/com/tifloacosta/app/TifloReadingPlugin.java`
- Modify `mobile/test/reading-android-native-contract.test.mjs`

Requirements:
- manifest references both backup-rule resources;
- exclude file-domain `reading-library/` and database-domain `tiflo_reading.db` from system cloud/device-transfer backup where supported;
- `TifloReadingPlugin.load()` schedules `cleanupStaleTemps()` off the UI thread;
- no broad storage permission is introduced.

- [ ] Extend the failing native-contract test for both backup files and startup temp cleanup.
- [ ] Run:

```bash
node --test --test-name-pattern="reading android native contract" test/*.test.mjs
```

Expected: FAIL.

- [ ] Add backup/data-extraction rules and cleanup wiring. Do not implement portable export/restore yet.
- [ ] Run complete automated verification from `mobile/`:

```bash
npm test
npm run build
npm run sync:android
```

Then from `mobile/android/`:

```bash
./gradlew testDebugUnitTest
./gradlew assembleDebug
```

With emulator/device available:

```bash
./gradlew connectedDebugAndroidTest
```

Expected: all available checks PASS.

- [ ] Perform Android/TalkBack smoke test:
  1. Home → `Leer con TifloAcosta`.
  2. Import a TXT from Android’s picker.
  3. Confirm one title appears and opens.
  4. Move to next paragraph, go back, reopen, and confirm resume.
  5. Share a TXT from Android Files to TifloAcosta and confirm the reading library receives it.
  6. Import/share identical bytes under another filename and confirm no second item appears.
  7. Delete the TifloAcosta item and confirm the original external file remains.
  8. Share ordinary text and confirm the existing `Compartido con TifloAcosta` flow still works.
  9. Confirm headings, controls, status, pagination and delete confirmation are understandable with TalkBack.

- [ ] Commit:

```bash
git add mobile/android/app/src/main/res/xml/backup_rules.xml mobile/android/app/src/main/res/xml/data_extraction_rules.xml mobile/android/app/src/main/AndroidManifest.xml mobile/android/app/src/main/java/com/tifloacosta/app/TifloReadingPlugin.java mobile/test/reading-android-native-contract.test.mjs
git commit -m "test: harden android reading foundation"
```

## Completion boundary

This plan is complete only when the TXT vertical slice works end to end and all available checks above pass. Do **not** call the overall “Leer con TifloAcosta” feature beta-ready at this point. TTS, search, marks, audio, DAISY, remaining formats, queue, portable backup/restore, advanced recovery and final beta criteria remain in the follow-on plans.