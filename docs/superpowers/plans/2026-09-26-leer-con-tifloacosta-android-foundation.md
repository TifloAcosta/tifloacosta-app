# Leer con TifloAcosta — Android Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first end-to-end Android vertical slice for “Leer con TifloAcosta”: import plain-text files into app-private storage, persist them in a local SQLite library, list them 10 per page, open and resume paragraph-level reading, and delete only TifloAcosta’s private copy.

**Architecture:** Add a native Capacitor plugin named `TifloReading` that owns Android document picking, shared-file intake, private file copies, SHA-256 duplicate detection, SQLite persistence, and cleanup. The shared JavaScript layer consumes a stable plugin contract and renders dedicated `reading-library` and `reading-book` routes, leaving the existing remote-resource `library` and web/article `reader` untouched. This first plan intentionally supports TXT only so the architecture can be verified end to end before later plans add the complete text engine, TTS, audio, DAISY, EPUB, DOCX, PDF, ZIP, backup/restore, and the rest of the approved design.

**Tech Stack:** Capacitor 8.5.2; Android Java with `SQLiteOpenHelper`; Android minSdk 24 / compileSdk 36 / targetSdk 36; browser-side ES modules bundled by esbuild; Node 22 `node:test`; Android JUnit 4 / AndroidX Test / Espresso.

**Spec:** `docs/superpowers/specs/2026-09-26-leer-con-tifloacosta-android-design.md`

## Global Constraints

- Android remains minSdk 24, compileSdk 36, targetSdk 36.
- Do not request broad `READ_*`, `WRITE_EXTERNAL_STORAGE`, or all-files storage permissions.
- The reading library is local-only: no account, server, synchronization, or upload of book content, searches, progress, or marks.
- Import means copying bytes into app-private storage; deleting from TifloAcosta must never delete the external original.
- Phase 1 accepts file streams representing `.txt` / `text/plain` only. Existing shared textual messages without a file stream must continue through the current `TifloShare` flow unchanged.
- Final item storage for this phase is `filesDir/reading-library/items/<book-id>/source.txt`; temporary work is under `filesDir/reading-library/tmp/`.
- Content identity is SHA-256 of the imported bytes. A different filename with identical bytes is the same book.
- Library pagination is 10 items per page by default.
- Opening a book never starts speech or audio automatically.
- The existing `library` route remains the current remote/resources library. The existing `reader` route remains the current accessible web/article reader.
- Reading-library files and its SQLite database must be excluded from Android automatic/cloud backup; explicit portable backup will be implemented in a later plan.
- This phase is an internal architectural foundation, not the beta-ready completion of the full spec.

## Planned follow-on phases

The approved specification is too large for one safe implementation plan. After this vertical slice is working and reviewed, create separate plans for:

1. full semantic text engine, TTS, search, marks, document-specific visual/voice settings, and HTML;
2. audio/audiobooks, background playback, media controls, headphone handling, speed, marks, and sleep timer;
3. EPUB, DOCX, PDF, DAISY, M4B chapter metadata, ZIP and multi-file format adapters;
4. queue, full settings, portable backup/restore/conflicts, recovery/migrations, performance hardening, and final accessibility/beta acceptance.

## Review Focus

- **Text message versus shared TXT file:** `ACTION_SEND` with only `EXTRA_TEXT` must continue to open the existing share flow; `ACTION_SEND`/`ACTION_SEND_MULTIPLE` carrying `EXTRA_STREAM` must be handled by `TifloReading` and not misclassified as a text message. Task 4 pins this with source-contract tests.
- **Duplicate bytes under different names:** importing identical content twice must create one library record and return the existing book ID as a duplicate. Task 3 pins this with a unit test.
- **Interrupted or failed import:** no partial book may become visible, and temporary files must be removable on the next plugin load. Tasks 3 and 8 pin this with failure/cleanup tests.
- **Unsupported, empty, or space-constrained input:** reject that item with a concrete result while leaving prior valid library contents unchanged; a multi-item batch must be able to continue with other items. Task 3 pins these cases.
- **Corrupt/out-of-range saved paragraph index:** reopening must clamp to a valid paragraph rather than crash or return an invalid position. Tasks 5 and 7 pin this behavior.

---

### Task 1: Stable JavaScript client contract for the native reading library

**Files:**
- Create: `mobile/src/native/reading-library-plugin.mjs`
- Create: `mobile/src/core/reading-library-client.mjs`
- Create: `mobile/test/reading-library-client.test.mjs`

**Interfaces:**
- Consumes: Capacitor `registerPlugin('TifloReading')`.
- Produces: `createReadingLibraryPlugin(plugin = NativeTifloReading)` and `createReadingLibraryClient(plugin)`.
- Native-facing methods: `pickDocuments()`, `consumeInitialSharedDocuments()`, `listBooks(options)`, `openBook(id)`, `saveProgress(progress)`, `deleteBook(id)`, `getLatestInProgress()`, `addListener(eventName, listener)`.
- Normalized book shape: `{ id, title, format, state, percent, blockIndex, importedAt, lastReadAt, sizeBytes }`.
- Normalized import batch: `{ cancelled, imported, duplicates, rejected }` where each array contains normalized result objects.
- Normalized list result: `{ items, total, page, pageSize, pages }`.
- Default list options: `{ page: 1, pageSize: 10, query: '', status: 'all', sort: 'lastRead' }`.

- [ ] **Step 1: Write the failing client-contract tests**

In `mobile/test/reading-library-client.test.mjs`, add tests asserting that:

```js
const result = await client.listBooks();
assert.deepEqual(fakePlugin.lastListOptions, {
  page: 1, pageSize: 10, query: '', status: 'all', sort: 'lastRead'
});
assert.equal(result.pageSize, 10);
```

Also assert normalization of numeric/string fields, safe empty results when optional plugin functions are absent, and an `addListener()` fallback whose returned object exposes `remove()`.

- [ ] **Step 2: Run the test and verify it fails**

Run from `mobile/`:

```bash
npm test -- --test-name-pattern="reading library client"
```

Expected: FAIL because `reading-library-client.mjs` and the native wrapper do not yet exist.

- [ ] **Step 3: Implement the native wrapper and normalized client**

Implement these signatures:

```js
export function createReadingLibraryPlugin(plugin = NativeTifloReading)
export function createReadingLibraryClient(plugin)
```

The wrapper catches unavailable-plugin failures and returns predictable empty/cancelled shapes; the client owns input defaults and output normalization. Do not put UI wording in this layer.

- [ ] **Step 4: Run focused tests and the mobile test suite**

```bash
npm test -- --test-name-pattern="reading library client"
npm test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/native/reading-library-plugin.mjs mobile/src/core/reading-library-client.mjs mobile/test/reading-library-client.test.mjs
git commit -m "feat: add reading library client contract"
```

### Task 2: SQLite library repository and paged queries

**Files:**
- Create: `mobile/android/app/src/main/java/com/tifloacosta/app/reading/ReadingBookRecord.java`
- Create: `mobile/android/app/src/main/java/com/tifloacosta/app/reading/ReadingBookQuery.java`
- Create: `mobile/android/app/src/main/java/com/tifloacosta/app/reading/ReadingBookRepository.java`
- Create: `mobile/android/app/src/main/java/com/tifloacosta/app/reading/ReadingLibraryDatabase.java`
- Create: `mobile/android/app/src/androidTest/java/com/tifloacosta/app/reading/ReadingLibraryDatabaseTest.java`

**Interfaces:**
- Consumes: Android application context.
- Produces: database `tiflo_reading.db`, schema version `1`.
- Table `books` columns:
  - `id TEXT PRIMARY KEY`
  - `sha256 TEXT NOT NULL UNIQUE`
  - `title TEXT NOT NULL`
  - `format TEXT NOT NULL`
  - `mime_type TEXT NOT NULL`
  - `relative_path TEXT NOT NULL`
  - `size_bytes INTEGER NOT NULL`
  - `imported_at INTEGER NOT NULL`
  - `last_read_at INTEGER`
  - `state TEXT NOT NULL DEFAULT 'not-read'`
  - `block_index INTEGER NOT NULL DEFAULT 0`
  - `percent REAL NOT NULL DEFAULT 0`
- State values are exactly `not-read`, `in-reading`, `read`.
- `ReadingBookRepository` methods:

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

- `ReadingBookQuery` supports case-insensitive title query, statuses `all|not-read|in-reading|read`, sorts `title|imported|lastRead`, and explicit `limit`/`offset`.

- [ ] **Step 1: Write the failing Android database tests**

Cover: insert/find, SHA-256 uniqueness, 10-item paging, case-insensitive title search, status filter, `lastRead` ordering, progress update, latest in-progress, and delete.

Example assertion:

```java
ReadingBookQuery query = new ReadingBookQuery("", "all", "lastRead", 10, 10);
assertEquals(10, database.list(query).size());
```

- [ ] **Step 2: Run instrumentation tests and verify they fail**

From `mobile/android/` with an emulator/device available:

```bash
./gradlew connectedDebugAndroidTest
```

Expected: FAIL because the reading database classes do not exist.

- [ ] **Step 3: Implement the repository with `SQLiteOpenHelper`**

`ReadingLibraryDatabase` implements `ReadingBookRepository`. Use parameterized SQL selection arguments. Do not use destructive fallback on schema upgrades; `onUpgrade` must fail clearly until an explicit migration is added in a later schema version.

- [ ] **Step 4: Run Android tests**

```bash
./gradlew connectedDebugAndroidTest
./gradlew testDebugUnitTest
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile/android/app/src/main/java/com/tifloacosta/app/reading mobile/android/app/src/androidTest/java/com/tifloacosta/app/reading
git commit -m "feat: add local reading library database"
```

### Task 3: Transactional TXT import, hashing, private storage, and duplicate detection

**Files:**
- Create: `mobile/android/app/src/main/java/com/tifloacosta/app/reading/ReadingImportSource.java`
- Create: `mobile/android/app/src/main/java/com/tifloacosta/app/reading/ReadingImportResult.java`
- Create: `mobile/android/app/src/main/java/com/tifloacosta/app/reading/ReadingFileStore.java`
- Create: `mobile/android/app/src/main/java/com/tifloacosta/app/reading/ReadingImportService.java`
- Create: `mobile/android/app/src/test/java/com/tifloacosta/app/reading/ReadingImportServiceTest.java`

**Interfaces:**
- Consumes: `ReadingBookRepository`, `ReadingFileStore`, an import source and `InputStream`.
- Produces:

```java
ReadingImportResult importOne(ReadingImportSource source, InputStream input);
void cleanupStaleTemps();
String readUtf8(String relativePath);
void deleteItemDirectory(String id);
```

- `ReadingImportSource` contains `displayName`, `mimeType`, and nullable `declaredSizeBytes`.
- Phase-1 acceptance: filename ends in `.txt` OR MIME is exactly `text/plain`; content must be non-empty after optional UTF-8 BOM removal and whitespace check.
- Copy and SHA-256 calculation happen in one streaming pass into `reading-library/tmp/`.
- A known-size import requires free space of at least `declaredSizeBytes + 16 MiB` before copying. Actual bytes are counted while copying; there is no user-visible fixed maximum size.
- Duplicate SHA-256 deletes the temp file and returns the existing book ID without inserting another row.
- Final path is `reading-library/items/<uuid>/source.txt`.
- Only after a successful final copy/move and database insert is the book considered imported. Database failure removes the final item directory.

- [ ] **Step 1: Write failing pure-Java import tests**

Use fake `ReadingBookRepository` and a temporary/fake `ReadingFileStore`. Test:

```java
assertEquals(ReadingImportResult.Status.IMPORTED, first.getStatus());
assertEquals(ReadingImportResult.Status.DUPLICATE, second.getStatus());
assertEquals(first.getBookId(), second.getBookId());
```

Also test unsupported extension/MIME, empty UTF-8 text, BOM stripping, insufficient free space, repository insert failure leaving no final file, stale temp cleanup, and that one rejected item does not mutate existing repository records.

- [ ] **Step 2: Run JVM tests and verify they fail**

```bash
./gradlew testDebugUnitTest
```

Expected: FAIL because import classes do not exist.

- [ ] **Step 3: Implement the minimal import service**

Keep Android `Uri` handling out of `ReadingImportService`; it receives streams and metadata so its transaction rules remain unit-testable. `ReadingFileStore` owns private-directory paths, free-space checks, atomic/replace-safe moves within the app private filesystem, UTF-8 reads, and cleanup.

- [ ] **Step 4: Run the JVM tests**

```bash
./gradlew testDebugUnitTest
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile/android/app/src/main/java/com/tifloacosta/app/reading mobile/android/app/src/test/java/com/tifloacosta/app/reading
git commit -m "feat: add transactional txt importer"
```

### Task 4: Capacitor bridge, Android picker, and shared-file intake

**Files:**
- Create: `mobile/android/app/src/main/java/com/tifloacosta/app/TifloReadingPlugin.java`
- Modify: `mobile/android/app/src/main/java/com/tifloacosta/app/MainActivity.java`
- Modify: `mobile/android/app/src/main/java/com/tifloacosta/app/TifloSharePlugin.java`
- Modify: `mobile/android/app/src/main/AndroidManifest.xml`
- Create: `mobile/test/reading-android-native-contract.test.mjs`

**Interfaces:**
- Consumes: `ReadingLibraryDatabase`, `ReadingFileStore`, `ReadingImportService`.
- Produces: `@CapacitorPlugin(name = "TifloReading")` with methods matching Task 1:

```text
pickDocuments
consumeInitialSharedDocuments
listBooks
openBook
saveProgress
deleteBook
getLatestInProgress
```

and event `documentsReceived`.

- `pickDocuments`: `ACTION_OPEN_DOCUMENT`, `CATEGORY_OPENABLE`, MIME `text/plain`, `EXTRA_ALLOW_MULTIPLE=true`; process both `data.getData()` and `ClipData`.
- Shared files: accept `ACTION_SEND` with `EXTRA_STREAM` and `ACTION_SEND_MULTIPLE` stream lists for `text/plain` in this phase.
- Existing `TifloSharePlugin.sharedText()` must return empty when the intent contains `EXTRA_STREAM`; ordinary `EXTRA_TEXT` sharing remains unchanged.
- `openBook({id})` resolves `{ book, content }`, where `content` is the private UTF-8 TXT source.
- `saveProgress` persists the exact state strings from Task 2.
- `deleteBook` removes the DB row and only that book’s private item directory; it never operates on the source `Uri`.
- File/query work runs via `getBridge().execute(...)`, not on the main UI thread.

- [ ] **Step 1: Write failing native-contract tests**

In `mobile/test/reading-android-native-contract.test.mjs`, read the Java/manifest files as text and assert:

```js
assert.match(mainActivity, /registerPlugin\(TifloReadingPlugin\.class\)/);
assert.match(sharePlugin, /EXTRA_STREAM/);
assert.match(manifest, /android\.intent\.action\.SEND_MULTIPLE/);
assert.doesNotMatch(manifest, /READ_EXTERNAL_STORAGE|WRITE_EXTERNAL_STORAGE|MANAGE_EXTERNAL_STORAGE/);
```

Also assert every bridge method name above is present.

- [ ] **Step 2: Run the contract test and verify it fails**

```bash
npm test -- --test-name-pattern="reading android native contract"
```

Expected: FAIL.

- [ ] **Step 3: Implement plugin registration, picker, stream sharing, and manifest filters**

Add `TifloReadingPlugin` registration in `MainActivity`. Add stream-aware intent filters without removing the existing launcher or text-message share behavior. Make `TifloSharePlugin` explicitly ignore stream-bearing intents.

- [ ] **Step 4: Run JS tests and Android compilation**

```bash
npm test
cd android
./gradlew testDebugUnitTest assembleDebug
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile/android/app/src/main/java/com/tifloacosta/app/TifloReadingPlugin.java mobile/android/app/src/main/java/com/tifloacosta/app/MainActivity.java mobile/android/app/src/main/java/com/tifloacosta/app/TifloSharePlugin.java mobile/android/app/src/main/AndroidManifest.xml mobile/test/reading-android-native-contract.test.mjs
git commit -m "feat: receive reading documents on android"
```

### Task 5: Plain-text document model and safe paragraph positions

**Files:**
- Create: `mobile/src/core/reading-text-model.mjs`
- Create: `mobile/test/reading-text-model.test.mjs`

**Interfaces:**
- Produces:

```js
parsePlainText(text, { title = '' } = {}) -> { title, blocks }
normalizeReadingPosition({ blockIndex } = {}, blockCount) -> number
percentForBlock(blockIndex, blockCount) -> number
```

- Each paragraph block is `{ id: 'p-<1-based>', type: 'paragraph', text }`.
- Normalize CRLF/CR to LF and remove one leading UTF-8 BOM.
- Paragraphs are separated by one or more blank lines. Single newlines inside a paragraph become spaces. Empty paragraphs are discarded.
- `normalizeReadingPosition` clamps to `0..blockCount-1`; it returns `0` when no blocks exist.
- `percentForBlock` returns `0` for an empty document; otherwise `(clampedIndex + 1) / blockCount * 100`, capped at `100`.

- [ ] **Step 1: Write failing model tests**

Cover BOM/CRLF, multi-line paragraphs, empty text, stable `p-1` IDs, percentage, negative index, and an index larger than the document.

- [ ] **Step 2: Run and verify failure**

```bash
npm test -- --test-name-pattern="reading text model"
```

Expected: FAIL.

- [ ] **Step 3: Implement the exact parsing and clamping contract**

Do not add sentence/chapter detection in this phase; later text-engine work will replace/extend this adapter without changing the persisted paragraph-index contract.

- [ ] **Step 4: Run tests**

```bash
npm test -- --test-name-pattern="reading text model"
npm test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/core/reading-text-model.mjs mobile/test/reading-text-model.test.mjs
git commit -m "feat: add plain text reading model"
```

### Task 6: Dedicated “Leer con TifloAcosta” library screen and app route

**Files:**
- Create: `mobile/src/screens/reading-library.mjs`
- Modify: `mobile/src/screens/home.mjs`
- Modify: `mobile/src/app.mjs`
- Modify: `mobile/src/core/i18n.mjs`
- Modify: `mobile/src/styles.css`
- Modify: `mobile/test/app-shell.test.mjs`
- Create: `mobile/test/reading-library-screen.test.mjs`

**Interfaces:**
- Consumes: `readingLibraryClient` from Task 1.
- Produces: `renderReadingLibrary({ root, router, client, t, onOpenBook })` and route `reading-library`.
- Home label: Spanish `Leer con TifloAcosta`; English `Read with TifloAcosta`.
- Search uses an explicit submit button; do not announce results on every keystroke.
- “Continuar leyendo” shows only `getLatestInProgress()` when available.
- Import button invokes `client.pickDocuments()` and refreshes the library.
- Heading `Mi biblioteca` precedes the page items.
- Page size is 10. Controls say `Página anterior`, `Página N de X`, `Página siguiente` (and English equivalents).
- Book title is the primary open button. Metadata beneath it contains short state/progress text.
- Exactly one secondary `Opciones de <título>` control is exposed per book. In this phase its only destructive action is delete, with a second explicit confirmation step before calling `client.deleteBook(id)`.
- After import, use a polite status message for imported/duplicate/rejected counts. Do not move focus merely to announce success.
- If exactly one book is newly imported, offer `Abrir ahora`; queue actions wait for the later queue plan.

- [ ] **Step 1: Write failing screen/composition tests**

Update `app-shell.test.mjs` to require route `reading-library` without replacing route `library`.

In `reading-library-screen.test.mjs`, assert exported pure helpers for page label/status text and source-contract requirements for search submit, 10-item request, options label, delete confirmation, and polite status behavior.

- [ ] **Step 2: Run and verify failure**

```bash
npm test -- --test-name-pattern="reading library|composition root"
```

Expected: FAIL.

- [ ] **Step 3: Implement the screen and composition wiring**

Add `reading-library` to `HOME_ITEMS` beside the existing library entry. Instantiate the reading client once in `app.mjs`, add it to the relevant screen context, and keep existing `library`/`reader` logic unchanged.

- [ ] **Step 4: Run tests and build**

```bash
npm test
npm run build
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/screens/reading-library.mjs mobile/src/screens/home.mjs mobile/src/app.mjs mobile/src/core/i18n.mjs mobile/src/styles.css mobile/test/app-shell.test.mjs mobile/test/reading-library-screen.test.mjs
git commit -m "feat: add reading library screen"
```

### Task 7: Basic TXT reader with paragraph navigation and resume

**Files:**
- Create: `mobile/src/core/reading-session.mjs`
- Create: `mobile/src/screens/reading-book.mjs`
- Create: `mobile/test/reading-session.test.mjs`
- Create: `mobile/test/reading-book.test.mjs`
- Modify: `mobile/src/app.mjs`
- Modify: `mobile/src/core/i18n.mjs`

**Interfaces:**
- Consumes: `client.openBook(id)`, `client.saveProgress(...)`, `parsePlainText(...)`.
- Produces:

```js
createReadingSession({ blocks, initialIndex = 0 })
```

with methods `current()`, `previous()`, `next()`, `snapshot()` and a clamped index.

- Produces: `renderReadingBook({ root, router, client, bookId, t })` and route `reading-book`.
- `app.mjs` stores only a transient `pendingReadingBookId` before navigating, following the project’s existing pending-ID pattern rather than expanding the router contract in this phase.
- Screen behavior:
  - show book title as H1;
  - if saved progress is greater than zero, expose a brief status such as `Continuando lectura. 38 % completado.`;
  - render the current paragraph as semantic `<p>`;
  - buttons are exactly `Párrafo anterior` and `Párrafo siguiente` (English equivalents in English mode);
  - opening valid content updates state to `in-reading` and `lastReadAt` while preserving the saved paragraph index;
  - navigation saves `{ id, blockIndex, percent, state: 'in-reading' }`;
  - no autoplay and no TTS in this phase;
  - back returns to the reading library, which then reflects updated latest/progress state;
  - empty/corrupt private content shows an accessible error and never crashes.

- [ ] **Step 1: Write failing session and reader tests**

Session tests assert clamping, previous/next boundaries, stable current paragraph, and progress after movement. Reader source-contract tests assert semantic paragraph output, exact accessible button labels, `saveProgress`, no speech/autoplay call, and safe empty-content branch.

- [ ] **Step 2: Run and verify failure**

```bash
npm test -- --test-name-pattern="reading session|reading book"
```

Expected: FAIL.

- [ ] **Step 3: Implement session, screen, route, and translations**

This one-paragraph-at-a-time screen is a deliberate foundation probe. A later plan replaces it with the full windowed semantic document reader while keeping the same persisted book ID and paragraph-position contract.

- [ ] **Step 4: Run all mobile tests and build**

```bash
npm test
npm run build
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/core/reading-session.mjs mobile/src/screens/reading-book.mjs mobile/test/reading-session.test.mjs mobile/test/reading-book.test.mjs mobile/src/app.mjs mobile/src/core/i18n.mjs
git commit -m "feat: add resumable txt reading screen"
```

### Task 8: Backup exclusion, stale-temp recovery, and full foundation verification

**Files:**
- Create: `mobile/android/app/src/main/res/xml/backup_rules.xml`
- Create: `mobile/android/app/src/main/res/xml/data_extraction_rules.xml`
- Modify: `mobile/android/app/src/main/AndroidManifest.xml`
- Modify: `mobile/android/app/src/main/java/com/tifloacosta/app/TifloReadingPlugin.java`
- Modify: `mobile/test/reading-android-native-contract.test.mjs`

**Interfaces:**
- Consumes: private paths and DB name fixed in Tasks 2–3.
- Produces: Android backup rules that exclude `reading-library/` in the file domain and `tiflo_reading.db` in the database domain from cloud backup/device transfer where the platform rules apply.
- `TifloReadingPlugin.load()` schedules `cleanupStaleTemps()` off the UI thread before new import work.

- [ ] **Step 1: Extend the failing contract tests**

Assert that the manifest references both backup-rule resources and that the rule files exclude the reading-library file path and database. Assert cleanup is invoked from plugin initialization and that no broad storage permission has appeared.

- [ ] **Step 2: Run and verify failure**

```bash
npm test -- --test-name-pattern="reading android native contract"
```

Expected: FAIL until the rules and cleanup wiring exist.

- [ ] **Step 3: Add backup/data-extraction rules and startup cleanup**

Keep `android:allowBackup` behavior for unrelated app state if desired, but explicitly exclude the reading content/database required by the spec. Do not add export/restore code in this phase.

- [ ] **Step 4: Run complete automated verification**

From `mobile/`:

```bash
npm test
npm run build
npm run sync:android
```

From `mobile/android/`:

```bash
./gradlew testDebugUnitTest
./gradlew assembleDebug
```

With an emulator/device available:

```bash
./gradlew connectedDebugAndroidTest
```

Expected: all available checks PASS.

- [ ] **Step 5: Perform the TalkBack/manual foundation smoke test**

Verify on Android:

1. Home → `Leer con TifloAcosta`.
2. Import a TXT through Android’s file picker.
3. Confirm one title appears and opens.
4. Move to `Párrafo siguiente`, go back, reopen, and confirm the saved paragraph resumes.
5. Share a TXT from Android Files to TifloAcosta and confirm it reaches the reading library.
6. Import/share identical bytes under another filename and confirm no second library item appears.
7. Delete the TifloAcosta library item and confirm the original external file still exists.
8. Share ordinary text with `EXTRA_TEXT` and confirm the existing `Compartido con TifloAcosta` text flow still works.
9. Navigate the new screens with TalkBack and confirm headings, buttons, status messages, pagination and delete confirmation are understandable without vision.

- [ ] **Step 6: Commit**

```bash
git add mobile/android/app/src/main/res/xml/backup_rules.xml mobile/android/app/src/main/res/xml/data_extraction_rules.xml mobile/android/app/src/main/AndroidManifest.xml mobile/android/app/src/main/java/com/tifloacosta/app/TifloReadingPlugin.java mobile/test/reading-android-native-contract.test.mjs
git commit -m "test: harden android reading foundation"
```

## Completion boundary for this plan

This plan is complete when the TXT vertical slice works end to end and all available automated/manual checks above pass. Do **not** declare the overall “Leer con TifloAcosta” feature beta-ready at this point. The remaining approved formats, TTS, search, marks, audio, DAISY, queue, portable backup/restore, advanced recovery, and final acceptance criteria belong to the follow-on plans listed at the top.