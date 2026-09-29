# Leer con TifloAcosta — Formats, Queue, Backup and Beta Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the approved Android v1 scope of “Leer con TifloAcosta” so the feature is beta-ready only when EPUB, DOCX, DAISY 2.02/3, ZIP containers, reading queue, full library filtering/sorting, portable backup/restore and the remaining TalkBack requirements work alongside the already-built TXT/HTML/PDF/TTS/audio foundation.

**Architecture:** Extend the existing SQLite/private-storage foundation rather than creating format-specific readers. EPUB, DOCX and textual DAISY adapters parse safe package/XML structures into the shared semantic reading model; audio DAISY maps to the existing media service; ZIP remains an import container only. Queue, metadata, restore state and document settings remain format-independent and are exposed through the existing `TifloReading` bridge and shared JavaScript client.

**Tech Stack:** Capacitor 8.5.2; Android Java; SQLiteOpenHelper; Android platform XML/ZIP/JSON APIs; Media3 1.11.1; PDFBox Android 2.0.27.0; ES modules/esbuild; Node 22 `node:test`; Android JUnit/AndroidX tests.

**Spec:** `docs/superpowers/specs/2026-09-26-leer-con-tifloacosta-android-design.md`

## Global Constraints

- PR #82 remains draft until the complete block is verified; this plan must not merge or publish it.
- No broad storage permission. Imports use explicit Android document/share access and private app copies.
- Library content, searches, marks and reading history stay local.
- EPUB support is reflowable, DRM-free content only; no scripts or automatic external-resource loading.
- DOCX is reading-only; no DOC, macros, OLE execution or editing.
- DAISY 2.02 and DAISY 3 support text-only, audio-only and synchronized text/audio when synchronization actually exists.
- ZIP is a container, never a library book; reject traversal, recursive ZIP, disproportionate expansion and ambiguous mixed packages.
- PDF scanned-image OCR remains out of v1 scope.
- Queue membership is independent of read state; reaching the real end marks Read and removes the item from queue but never auto-opens the next book.
- Portable restore merges into the current library; it never silently replaces existing content.
- TalkBack accessibility is part of each task's completion contract, not a final cosmetic pass.

## Review Focus

- Package security: malformed ZIP/EPUB/DOCX/DAISY must fail without directory traversal, partial visible books or excessive expansion.
- Position integrity: importing/updating/restoring must not regress an existing precise position to the beginning or to a weaker position silently.
- Mixed DAISY/audio content: expose only structure and synchronization actually present; never invent chapters, pages or sync.
- Restore conflicts: duplicate content, differing marks, states and positions must merge according to the spec and leave unresolved position conflicts explicit.
- TalkBack: dynamic Previous/Next names, dialog focus return, search/mark result context and “Back to reading” must remain correct for every textual format.

---

### Task 1: Library metadata, queue and format-aware queries

**Files:**
- Modify `mobile/android/app/src/main/java/com/tifloacosta/app/reading/ReadingBookRecord.java`
- Modify `mobile/android/app/src/main/java/com/tifloacosta/app/reading/ReadingBookQuery.java`
- Modify `mobile/android/app/src/main/java/com/tifloacosta/app/reading/ReadingBookRepository.java`
- Modify `mobile/android/app/src/main/java/com/tifloacosta/app/reading/ReadingLibraryDatabase.java`
- Create `mobile/android/app/src/main/java/com/tifloacosta/app/reading/ReadingQueueRecord.java`
- Modify `mobile/android/app/src/androidTest/java/com/tifloacosta/app/reading/ReadingLibraryDatabaseTest.java`
- Modify `mobile/src/core/reading-library-client.mjs`
- Modify `mobile/test/reading-library-client.test.mjs`

**Interfaces:**
- `ReadingBookRecord` adds nullable `author` and `language` without changing content identity.
- Query adds `format` filter and `author` sort while preserving 10-item default paging.
- Repository adds `listQueue()`, `addToQueue(bookId)`, `removeFromQueue(bookId)`, `moveQueueItem(bookId, targetIndex)`, `isQueued(bookId)`, `updateBookMetadata(id, title, author, language, state)`.
- JS client exposes normalized author/language/queued plus queue methods.

- [ ] Add failing Node/source-contract and Android DB tests for author/language normalization, format filter, author sort, queue add/remove/reorder, duplicate queue prevention and automatic queue removal when a book is completed.
- [ ] Run focused Node tests and verify RED for missing interfaces.
- [ ] Upgrade DB with an explicit migration, add queue table with unique book reference/order, metadata columns and indexes; implement repository/client methods.
- [ ] Run focused tests, full `npm test`, Android unit tests and available instrumentation tests; expect PASS.
- [ ] Commit `feat: add reading queue and library metadata`.

### Task 2: Queue, filters and complete library actions

**Files:**
- Modify `mobile/src/screens/reading-library.mjs`
- Create `mobile/src/screens/reading-queue.mjs`
- Modify `mobile/src/app.mjs`
- Modify `mobile/src/core/i18n.mjs`
- Modify `mobile/src/styles.css`
- Modify `mobile/test/reading-library-screen.test.mjs`
- Create `mobile/test/reading-queue-screen.test.mjs`

**Interfaces:**
- Library order remains Search → Continue → Queue → Import → Filters → Settings → My library.
- Filters: All / In reading / Not read / Read / Format; sort: title / author / recent import / recent reading.
- Item options: queue toggle, state change, information, display-title rename, delete.
- Queue allows open, remove and deterministic reorder; next-book suggestion never auto-opens.

- [ ] Add failing screen tests for focus order, filters, sort, contextual option names, queue operations and end-of-book next suggestion.
- [ ] Verify RED, implement minimum UI/router/i18n behavior, then run focused and full Node suites to GREEN.
- [ ] Commit `feat: complete reading library and queue UI`.

### Task 3: Safe packaged-document foundation

**Files:**
- Create `mobile/android/app/src/main/java/com/tifloacosta/app/reading/ReadingPackageLimits.java`
- Create `mobile/android/app/src/main/java/com/tifloacosta/app/reading/ReadingPackageExtractor.java`
- Create `mobile/android/app/src/main/java/com/tifloacosta/app/reading/ReadingXml.java`
- Create `mobile/android/app/src/main/java/com/tifloacosta/app/reading/ReadingStructuredDocument.java`
- Create `mobile/android/app/src/test/java/com/tifloacosta/app/reading/ReadingPackageExtractorTest.java`

**Interfaces:**
- Safe extraction is rooted under a caller-provided private temp directory.
- Reject absolute/parent paths, nested archives, excessive entry count/depth/expanded bytes and invalid required package structure.
- `ReadingStructuredDocument` carries metadata plus semantic blocks/navigation/page references/media-sync references without Android UI dependencies.

- [ ] Write failing JVM tests for traversal, duplicate paths, oversized expansion, nested ZIP and cleanup-on-failure.
- [ ] Verify RED; implement streaming extraction/XML helpers and immutable structured-document types.
- [ ] Run Android JVM tests to GREEN.
- [ ] Commit `feat: add safe reading package foundation`.

### Task 4: EPUB adapter

**Files:**
- Create `mobile/android/app/src/main/java/com/tifloacosta/app/reading/ReadingEpubAdapter.java`
- Create `mobile/android/app/src/test/java/com/tifloacosta/app/reading/ReadingEpubAdapterTest.java`
- Modify `mobile/android/app/src/main/java/com/tifloacosta/app/reading/ReadingImportService.java`
- Modify `mobile/android/app/src/main/java/com/tifloacosta/app/TifloReadingPlugin.java`

**Interfaces:**
- Accept DRM-free EPUB package only; resolve `META-INF/container.xml`, OPF manifest/spine/navigation and XHTML in spine order.
- Preserve headings, paragraphs, lists, tables, links, notes, alt text, page references and Media Overlay links when present.
- Never execute scripts or fetch external resources.

- [ ] Add failing fixture-driven JVM tests for spine order, metadata, internal/external links, missing alt, navigation, invalid package and DRM/protection rejection.
- [ ] Verify RED; implement adapter/import/open bridge using common semantic model.
- [ ] Run focused Android tests, Node bridge contract tests and full suites to GREEN.
- [ ] Commit `feat: add accessible epub reading`.

### Task 5: DOCX adapter

**Files:**
- Create `mobile/android/app/src/main/java/com/tifloacosta/app/reading/ReadingDocxAdapter.java`
- Create `mobile/android/app/src/test/java/com/tifloacosta/app/reading/ReadingDocxAdapterTest.java`
- Modify `mobile/android/app/src/main/java/com/tifloacosta/app/reading/ReadingImportService.java`
- Modify `mobile/android/app/src/main/java/com/tifloacosta/app/TifloReadingPlugin.java`

**Interfaces:**
- Parse OOXML relationships/document/styles/numbering/footnotes/endnotes/core properties without executing macros or active objects.
- Preserve real heading styles, paragraphs, lists, tables, links, notes, images with alt text and language when available.
- Final text includes insertions and omits deleted revision text.

- [ ] Add failing fixtures/tests for headings, lists, table cells, hyperlinks, notes, alt text, tracked changes, malformed package and macro-enabled content safety.
- [ ] Verify RED; implement adapter and import/open bridge.
- [ ] Run focused and full tests to GREEN.
- [ ] Commit `feat: add accessible docx reading`.

### Task 6: DAISY 2.02 and DAISY 3 adapters

**Files:**
- Create `mobile/android/app/src/main/java/com/tifloacosta/app/reading/ReadingDaisyAdapter.java`
- Create `mobile/android/app/src/main/java/com/tifloacosta/app/reading/ReadingDaisyBook.java`
- Create `mobile/android/app/src/test/java/com/tifloacosta/app/reading/ReadingDaisyAdapterTest.java`
- Modify existing audio-track persistence/import code as required.

**Interfaces:**
- DAISY 2.02: NCC/SMIL/content resources; DAISY 3: OPF/NCX/SMIL/content resources.
- Expose title/author, hierarchy, pages, text, audio and text/audio synchronization only when source provides it.
- Text-only routes through common text reading; audio-only through media service; synchronized books share one logical position.

- [ ] Add failing fixtures for 2.02 text/audio/sync, DAISY 3 text/audio/sync, page navigation, missing resources and protected unsupported content.
- [ ] Verify RED; implement adapter/persistence/open behavior.
- [ ] Run Android and shared-model suites to GREEN.
- [ ] Commit `feat: add daisy reading`.

### Task 7: ZIP and multi-file import routing

**Files:**
- Modify `mobile/android/app/src/main/java/com/tifloacosta/app/reading/ReadingImportService.java`
- Modify `mobile/android/app/src/main/java/com/tifloacosta/app/TifloReadingPlugin.java`
- Modify `mobile/android/app/src/main/AndroidManifest.xml`
- Modify `mobile/test/reading-android-native-contract.test.mjs`
- Create `mobile/android/app/src/test/java/com/tifloacosta/app/reading/ReadingPackageImportTest.java`

**Interfaces:**
- ZIP recognized only as coherent DAISY or coherent multi-track audio container.
- Multi-selection can form one DAISY package or ask grouped-vs-independent for audio; unrelated normal documents remain independent imports.
- Picker/share MIME/extension acceptance covers approved v1 formats without broad permissions.

- [ ] Add failing tests for ZIP DAISY, ZIP audio, mixed ambiguous ZIP, recursive ZIP, multiple independent documents and shared-file intents.
- [ ] Verify RED; implement routing and manifest/picker types.
- [ ] Run full Node/Android tests to GREEN.
- [ ] Commit `feat: complete reading package imports`.

### Task 8: Portable backup, merge restore and library maintenance

**Files:**
- Create `mobile/android/app/src/main/java/com/tifloacosta/app/reading/ReadingBackupService.java`
- Create `mobile/android/app/src/main/java/com/tifloacosta/app/reading/ReadingRestorePlan.java`
- Create `mobile/android/app/src/test/java/com/tifloacosta/app/reading/ReadingBackupServiceTest.java`
- Modify `mobile/android/app/src/main/java/com/tifloacosta/app/TifloReadingPlugin.java`
- Modify `mobile/src/core/reading-library-client.mjs`
- Modify `mobile/src/screens/reading-settings.mjs`
- Add/modify corresponding Node tests.

**Interfaces:**
- Versioned single ZIP package with JSON manifest, relative paths, integrity hashes and selected/all content.
- Export excludes reconstructible indexes/cache.
- Restore validates first, then adds missing content, deduplicates identical items, merges marks, does not downgrade Read, preserves current per-book settings by default, appends missing queue items and exposes conflicting positions for user choice.
- Add `checkLibrary()` and confirmed `deleteAllReadingData()` maintenance actions.

- [ ] Add failing tests for complete/selected export, damaged manifest/content, no-space preflight, empty/current-library restore, mark merge, queue merge and explicit position conflict.
- [ ] Verify RED; implement service/bridge/settings UI and destination/document picker integration.
- [ ] Run focused/full suites to GREEN.
- [ ] Commit `feat: add portable reading backup and restore`.

### Task 9: Complete common reading semantics and TalkBack behavior

**Files:**
- Modify `mobile/src/core/reading-semantic-model.mjs`
- Modify `mobile/src/core/reading-session.mjs`
- Modify `mobile/src/screens/reading-book.mjs`
- Modify `mobile/src/screens/reading-search.mjs`
- Modify `mobile/src/screens/reading-marks.mjs`
- Modify `mobile/src/screens/reading-settings.mjs`
- Modify related tests.

**Interfaces:**
- Navigation unit names are dynamic and accessible (`Párrafo anterior`, `Encabezado siguiente`, etc.).
- Search results and marks include enough document context to be individually identifiable.
- Search/marks/settings provide explicit `Volver a la lectura`; return focus lands on the logical reading point/control that initiated the detour.
- Footnotes return exactly to source; unavailable format controls are hidden rather than cluttering the UI disabled.
- Large text/system scaling must not remove operations from keyboard/TalkBack reach.

- [ ] Add/retain failing tests for each accessibility behavior before production changes.
- [ ] Verify RED; implement common behavior, then run all Node tests to GREEN.
- [ ] Commit `fix: complete accessible reading navigation`.

### Task 10: Beta acceptance matrix and CI gate

**Files:**
- Create legal/synthetic fixtures under `mobile/test/fixtures/reading/` and Android test resources as appropriate.
- Create `mobile/test/reading-beta-acceptance.test.mjs`
- Modify `.github/workflows/test-mobile-foundation.yml`
- Modify `.github/workflows/bootstrap-mobile-android.yml` if required only to run the new deterministic checks.

**Interfaces:**
- Acceptance matrix covers TXT/HTML/EPUB/DOCX/PDF/DAISY/audio/ZIP/portable backup, queue, large-library paging and required TalkBack contracts.
- CI must fail if any approved v1 format is no longer wired through import/open or if required accessibility contracts regress.

- [ ] Add acceptance tests and prove they fail while any approved v1 capability remains absent.
- [ ] Complete any remaining wiring until focused and full Node/Android suites pass.
- [ ] Run release/bootstrap workflows and inspect every job, not only aggregate status.
- [ ] Perform final branch review against the spec and PR diff.
- [ ] Keep PR #82 draft; do not merge or publish until Tony explicitly authorizes it.
- [ ] Commit `test: gate complete reading beta scope`.

## Completion Contract

The block is not update-ready merely because each adapter opens a sample. Before requesting merge/publication approval, all of the following must be true:

1. Every format listed in spec section 4.1 is imported through explicit Android selection/share paths or its defined container path.
2. Textual formats share navigation, search, marks, TTS, visual settings and exact-position restore.
3. Audio/DAISY audio share background media behavior, speed, interruption safety, marks and exact-position restore.
4. Queue, filters/sorts, state transitions and end-of-book behavior match the spec.
5. Portable export/merge-restore passes conflict and failure tests without silent replacement.
6. TalkBack requirements in spec section 40 and acceptance list 48.7 have automated contracts plus the best available nonvisual/manual verification path.
7. Full mobile tests, Android unit/build checks and CI workflows are green.
8. PR #82 remains unmerged and unpublished until explicit approval.