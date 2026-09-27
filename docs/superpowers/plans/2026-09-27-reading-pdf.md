# Leer con TifloAcosta — PDF Reading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the first Android PDF reading vertical slice for text-bearing PDFs, preserving real page references, transient password handling, the existing semantic reader/TTS/search/marks/settings stack, and the original private PDF source without adding OCR.

**Architecture:** Android owns PDF decoding through a small native extractor backed by PdfBox-Android. The extractor returns plain page/metadata data only; the shared ES-module layer maps that data into the existing `ReadingDocument` semantic model so TTS, search, marks and progress remain format-independent. PDF passwords live only in the active reader session and are never written to SQLite, settings or files. The first slice does not invent headings/tables when PDF structure is absent; tagged-PDF semantic enrichment and large-document streaming remain explicit PDF follow-up work and PDF must not be declared fully complete until those follow-ups are closed.

**Tech Stack:** Capacitor 8.5.2; Android Java; `com.tom-roush:pdfbox-android:2.0.27.0`; Node 22 `node:test`; ES modules bundled by esbuild; Android minSdk 24 / compileSdk 36 / targetSdk 36.

**Spec:** `docs/superpowers/specs/2026-09-26-leer-con-tifloacosta-android-design.md`

## Global Constraints

- PDF support in this phase is for PDFs with text accessible/extractable by the PDF engine; no automatic OCR.
- The original PDF is copied to app-private storage as `reading-library/items/<id>/source.pdf` and deleting the library item never deletes the external original.
- No broad `READ_*`, `WRITE_EXTERNAL_STORAGE` or all-files storage permission.
- A PDF password may be supplied only to the active open/read call; it must never be persisted in SQLite, settings, logs or private files.
- Opening a PDF never starts TTS automatically.
- Visual reading, TTS, search, marks and progress use the same logical `{ blockIndex, unitIndex }` position.
- PDF page numbers are real navigation references and must not be inferred from visual line wrapping.
- If the PDF has text but no reliable structural hierarchy, do not invent headings, chapters or tables.
- If no extractable text exists, report a clear scanned/no-text state; do not silently produce an empty reader.
- Existing TXT/HTML behavior and the existing remote `library` / web `reader` routes must remain unchanged.

## Review Focus

- Password-protected PDFs: empty password, wrong password and correct password must not leak or persist the password, and retries must leave the library item intact.
- Scanned/image-only PDFs: report no extractable text and never claim OCR or readable text.
- Malformed/non-PDF bytes named `.pdf`: reject or fail clearly without creating a usable library record from invalid content.
- PDFs with unreliable reading order: preserve available text/pages but surface a concise warning instead of fabricating hierarchy.
- Large/many-page PDFs: this first slice must avoid UI-thread extraction and its limitations must remain explicit until the later streaming/cache follow-up is implemented.

---

### Task 1: Shared PDF semantic adapter and real-page references

**Files:**
- Create `mobile/src/core/reading-pdf-adapter.mjs`
- Create `mobile/test/reading-pdf-adapter.test.mjs`
- Modify `mobile/src/core/reading-semantic-model.mjs`

**Interfaces:**
- Consumes native/plain extraction payload `{ title, author, language, pageCount, orderReliable, pages }`.
- Each page is `{ number, text }` with a 1-based real PDF page number.
- Produces the existing `ReadingDocument` shape plus optional `pages` metadata.
- Export `parsePdfDocument(payload) -> ReadingDocument`.
- Export `pageForPosition(document, position) -> number|null`.
- Export `positionForPage(document, pageNumber) -> { blockIndex, unitIndex }|null`.
- PDF-derived blocks keep the common block fields and add `pageNumber` only as optional metadata.

- [ ] **Step 1: Write failing PDF-adapter tests**
  - Two pages become semantic paragraph/sentence blocks in source order.
  - Every produced block keeps its real 1-based `pageNumber`.
  - Empty pages do not invent text but page metadata still preserves the page number.
  - `pageForPosition` and `positionForPage` clamp/reject invalid positions predictably.
  - No heading/table type is invented from plain extracted lines.
  - Existing TXT/HTML semantic tests remain unchanged.

- [ ] **Step 2: Run focused tests to verify RED**

Run from `mobile/`:
`node --test --test-name-pattern="reading pdf adapter|reading semantic model" test/*.test.mjs`

Expected: FAIL because `reading-pdf-adapter.mjs` does not exist.

- [ ] **Step 3: Implement the adapter minimally**
  - Reuse `parseTextDocument` per page rather than duplicating sentence/paragraph segmentation.
  - Prefix/rebuild stable block ids with the page number so equal text on different pages remains distinct.
  - Add `pages: [{ number, firstBlockIndex, lastBlockIndex }]` to the document; use `null` indices for textless pages.
  - Preserve `orderReliable` as document metadata only; do not manufacture structure from it.

- [ ] **Step 4: Run focused tests and full mobile tests**

Run:
`node --test --test-name-pattern="reading pdf adapter|reading semantic model" test/*.test.mjs`
`npm test`

Expected: PASS.

- [ ] **Step 5: Commit**

Commit: `feat: add pdf semantic page adapter`

---

### Task 2: Native PDF extraction seam and PdfBox-Android backend

**Files:**
- Modify `mobile/android/app/build.gradle`
- Create `mobile/android/app/src/main/java/com/tifloacosta/app/reading/ReadingPdfExtractor.java`
- Create `mobile/android/app/src/main/java/com/tifloacosta/app/reading/ReadingPdfResult.java`
- Create `mobile/android/app/src/main/java/com/tifloacosta/app/reading/PdfBoxReadingPdfBackend.java`
- Create `mobile/android/app/src/test/java/com/tifloacosta/app/reading/ReadingPdfExtractorTest.java`

**Interfaces:**
- `ReadingPdfExtractor.inspect(InputStream input, String password) -> ReadingPdfResult`.
- `ReadingPdfResult` status is exactly `readable|password-required|no-text|invalid`.
- Readable result includes title/author/language when available, `pageCount`, `orderReliable`, and ordered pages `{number,text}`.
- The extractor owns no persistent password field and returns no password value.
- Production backend uses `PdfBox-Android 2.0.27.0`; tests inject a fake backend so JVM tests do not depend on Android PDF resources.

- [ ] **Step 1: Write failing extractor tests**
  - Readable PDF backend result maps ordered pages and metadata.
  - Password exception maps to `password-required` without echoing the password.
  - Valid PDF with zero extractable non-whitespace text maps to `no-text`.
  - Parse/format failure maps to `invalid`.
  - Page extraction preserves page numbers and does not infer headings/tables.

- [ ] **Step 2: Run JVM tests to verify RED**

Run from `mobile/android/`:
`./gradlew testDebugUnitTest --tests '*ReadingPdfExtractorTest'`

Expected: FAIL because PDF classes do not exist.

- [ ] **Step 3: Add PdfBox-Android and implement the native seam**
  - Add `implementation 'com.tom-roush:pdfbox-android:2.0.27.0'`.
  - Initialize PDFBox resources once from application context before production extraction.
  - Use `PDFTextStripper` page-by-page and keep real page numbers.
  - Read metadata only when actually present.
  - Do not perform OCR, network calls, JavaScript execution or external resource loading.
  - Treat encryption requiring a password as a state, not a generic storage failure.

- [ ] **Step 4: Verify JVM tests and Android compilation**

Run:
`./gradlew testDebugUnitTest`
`./gradlew assembleDebugAndroidTest`

Expected: PASS.

- [ ] **Step 5: Commit**

Commit: `feat: add android pdf text extractor`

---

### Task 3: PDF import, private source storage, picker and share intake

**Files:**
- Modify `mobile/android/app/src/main/java/com/tifloacosta/app/reading/ReadingFileStore.java`
- Modify `mobile/android/app/src/main/java/com/tifloacosta/app/reading/ReadingImportService.java`
- Modify `mobile/android/app/src/main/java/com/tifloacosta/app/TifloReadingPlugin.java`
- Modify `mobile/android/app/src/main/AndroidManifest.xml`
- Modify `mobile/android/app/src/test/java/com/tifloacosta/app/reading/ReadingImportServiceTest.java`
- Modify `mobile/test/reading-android-native-contract.test.mjs`

**Interfaces:**
- Import accepts `.pdf` and MIME `application/pdf` in addition to existing TXT/HTML.
- Final PDF source path is `reading-library/items/<id>/source.pdf`.
- The same SHA-256 duplicate identity continues to use original bytes.
- PDF validation delegates to `ReadingPdfExtractor` after the private temp copy is complete.
- `readable` PDFs import normally; `password-required` PDFs may import while retaining the encrypted original; `no-text` rejects with `pdf-no-text`; `invalid` rejects with `invalid-pdf`.

- [ ] **Step 1: Extend failing import tests**
  - `.pdf` extension and `application/pdf` MIME both select format `pdf`.
  - Valid PDF stores `source.pdf` and strips `.pdf` from display title.
  - Password-required PDF imports without storing a password.
  - No-text/scanned result rejects as `pdf-no-text` and rolls back temp/final state.
  - Invalid PDF rejects as `invalid-pdf` and rolls back.
  - Duplicate PDF bytes return the existing book.
  - Existing TXT/HTML import tests remain green.

- [ ] **Step 2: Extend native contract tests and verify RED**
  - Picker advertises `text/plain`, `text/html`, `application/pdf`.
  - Share intake accepts PDF streams without broad storage permissions.
  - Private filename mapping includes `source.pdf`.

Run:
`./gradlew testDebugUnitTest`
`node --test --test-name-pattern="reading android native contract" test/*.test.mjs`

Expected: FAIL on missing PDF support.

- [ ] **Step 3: Implement PDF-aware import/storage**
  - Add a private-temp input method to `ReadingFileStore` for the PDF extractor; do not expose external paths.
  - Keep TXT/HTML UTF-8 validation unchanged.
  - Add PDF format/title/MIME/extension mapping.
  - Extend Android picker MIME list and manifest send/send-multiple coverage.
  - Keep import work on the bridge/background executor.

- [ ] **Step 4: Run focused/full tests and Android build**

Run:
`./gradlew testDebugUnitTest`
`node --test --test-name-pattern="reading android native contract" test/*.test.mjs`
`npm test`
`npm run build`
`npm run sync:android`
`./gradlew assembleDebug`

Expected: PASS.

- [ ] **Step 5: Commit**

Commit: `feat: import pdf reading documents on android`

---

### Task 4: PDF open bridge with transient password and explicit no-text state

**Files:**
- Modify `mobile/android/app/src/main/java/com/tifloacosta/app/TifloReadingPlugin.java`
- Modify `mobile/src/native/reading-library-plugin.mjs`
- Modify `mobile/src/core/reading-library-client.mjs`
- Modify `mobile/test/reading-library-client.test.mjs`
- Modify `mobile/test/reading-android-native-contract.test.mjs`

**Interfaces:**
- Shared call becomes `openBook(id, { password = '' } = {})` while remaining backwards compatible for TXT/HTML callers.
- TXT/HTML result remains `{ book, content }`.
- PDF readable result is `{ book, pdf }` where `pdf` matches Task 1 payload.
- Password challenge result is `{ book, passwordRequired: true, passwordRejected: boolean }`.
- No-text result is `{ book, pdfNoText: true, pageCount }`.
- The password parameter is passed directly to extraction and is never copied into `book`, settings, database, logs or returned payloads.

- [ ] **Step 1: Write failing bridge/client tests**
  - TXT/HTML `openBook(id)` normalization is unchanged.
  - PDF payload is normalized without stringifying it.
  - Initial encrypted open yields `passwordRequired`.
  - Retry with a password forwards it once and no normalized result contains it.
  - No-text result remains distinguishable from generic open failure.
  - Missing native methods still degrade safely.

- [ ] **Step 2: Run focused tests to verify RED**

Run:
`node --test --test-name-pattern="reading library client|reading android native contract" test/*.test.mjs`

Expected: FAIL on missing PDF result/password handling.

- [ ] **Step 3: Implement native/shared bridge changes**
  - Branch `openBook` by `record.getFormat()`.
  - For PDF, reopen only the private `source.pdf` and invoke the extractor with the call-scoped password.
  - Never place PDF bytes or password text in the WebView payload.
  - Return explicit states rather than using a generic exception for password/no-text cases.

- [ ] **Step 4: Run client/native tests and Android compilation**

Run:
`npm test`
`./gradlew testDebugUnitTest`
`./gradlew assembleDebugAndroidTest`

Expected: PASS.

- [ ] **Step 5: Commit**

Commit: `feat: open pdf books with transient passwords`

---

### Task 5: Accessible PDF reader integration and page navigation

**Files:**
- Modify `mobile/src/screens/reading-book.mjs`
- Modify `mobile/src/core/i18n.mjs`
- Modify `mobile/src/styles.css`
- Modify `mobile/test/reading-book.test.mjs`
- Create `mobile/test/reading-pdf-screen.test.mjs`

**Interfaces and behavior:**
- `reading-book` selects `parsePdfDocument` when `book.format === 'pdf'`.
- Password-required state renders a native labeled password input plus `Abrir PDF` / `Open PDF`; the value is cleared after each attempt and never persisted.
- `pdfNoText` renders a clear scanned/no-extractable-text message and no fake reading controls.
- PDF navigation exposes real `Página anterior`, `Página siguiente` and `Ir a página` / English equivalents.
- Page jumps resolve through `positionForPage` and then the existing shared `moveToPosition`; they never autoplay.
- Status/mark reference can report `Página {n}` from `pageForPosition`.
- `orderReliable === false` produces one concise polite warning and never creates fake headings.

- [ ] **Step 1: Write failing UI tests**
  - PDF reader chooses PDF adapter while TXT/HTML paths remain unchanged.
  - Opening encrypted PDF never autoplays and focus goes to the password field, then to Play after a successful retry.
  - Password input is cleared and no settings/progress call receives it.
  - Scanned/no-text PDF shows the explicit no-text message.
  - Previous/next/go-to-page use real page mapping and share the same logical position with TTS/search/marks.
  - Search preview remains non-destructive for PDF exactly as for TXT/HTML.
  - Unreliable-order warning is announced once, not on every sentence/page move.

- [ ] **Step 2: Run focused tests to verify RED**

Run:
`node --test --test-name-pattern="reading book|reading pdf screen" test/*.test.mjs`

Expected: FAIL on missing PDF UI behavior.

- [ ] **Step 3: Implement the PDF UI path**
  - Reuse existing speech/search/marks/settings controllers after `parsePdfDocument` produces the common model.
  - Keep the password only in the retry call stack/current screen variable and clear it immediately after extraction result.
  - Keep page controls in the existing reader/navigation surface rather than creating a separate PDF reader route.

- [ ] **Step 4: Run focused/full mobile tests**

Run:
`node --test --test-name-pattern="reading book|reading pdf screen" test/*.test.mjs`
`npm test`

Expected: PASS.

- [ ] **Step 5: Commit**

Commit: `feat: read pdf pages in the semantic reader`

---

### Task 6: PDF integration gate and explicit follow-up boundary

**Files:**
- Modify `mobile/test/reading-integration-contract.test.mjs`
- Modify `docs/superpowers/specs/2026-09-26-leer-con-tifloacosta-android-design.md` only if implementation discovers a contradiction requiring a recorded ruling; otherwise leave the approved spec unchanged.

**Interfaces/contract covered:**
- Import PDF → private `source.pdf` → open → semantic page blocks → resume → TTS/search/marks/settings → delete private copy.
- Password-required/no-text/invalid states remain separate and no password persistence exists.
- No OCR is present or claimed.
- Existing TXT/HTML integration contract stays green.

- [ ] **Step 1: Add the failing cross-layer PDF contract test**
  - PDF MIME/extension import and private path are wired.
  - `openBook` PDF path returns structured page data rather than UTF-8-decoding the PDF binary.
  - Shared adapter carries real page references.
  - Reader page jumps call the shared position path.
  - No password key appears in SQLite settings/schema or book JSON.
  - No OCR dependency/API appears in the PDF implementation.

- [ ] **Step 2: Run the full mobile suite and Android validation workflow locally where available**

Run:
`npm test`
`npm run build`
`npm run sync:android`
`./gradlew testDebugUnitTest assembleDebugAndroidTest assembleDebug bundleRelease`

Expected: PASS.

- [ ] **Step 3: Verify CI on the PDF head commit**
  - `Test mobile foundation`: success.
  - `Test Android release automation`: success.
  - `Bootstrap TifloAcosta Android`: success, including unit tests, instrumentation compilation, APK/AAB, signature and merged-manifest checks.

- [ ] **Step 4: Record the boundary before declaring PDF complete**
  - This vertical slice is only the baseline PDF reader.
  - Do **not** call PDF fully complete until a follow-up closes: tagged-PDF structural semantics (headings/lists/tables/alt where reliably present), conservative repeated header/footer handling, reading-order reliability analysis, and large-document page/semantic streaming/cache behavior.

- [ ] **Step 5: Commit**

Commit: `test: lock pdf reading vertical slice`
