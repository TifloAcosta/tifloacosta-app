# Direct Readers Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish every TifloAcosta HTML resource as a clean direct reader with an explicit return control, while keeping Google Drive as the download source.

**Architecture:** Keep each resource's existing Drive `url` for download and add an `openUrl` pointing to a static reader under `docs/es` or `docs/en`. A migration script reads `data.js`, downloads only public HTML resources missing `openUrl`, injects a first-control return button, writes the reader, and updates only that resource's catalog entry. Existing direct readers are preserved.

**Tech Stack:** Node.js 20, static HTML, GitHub Pages, Google Drive public download URLs, Node test runner.

**Spec:** Conversation decision: every internal TifloAcosta destination must provide an explicit accessible return point; direct reading must bypass the Google Drive preview UI.

## Global Constraints

- Google Drive remains the source used by `Descargar documento` / `Download document`.
- `Abrir documento` / `Open document` uses `openUrl` when available.
- The return control is the first interactive control in every generated reader.
- Spanish readers return with `Volver a la pantalla principal de TifloAcosta App`; English readers use the equivalent English label.
- Existing direct readers are not overwritten automatically.
- A failed or non-HTML Drive download must not modify `data.js`.

---

### Task 1: Reader transformation tests

**Files:**
- Create: `test/reader-migration.test.mjs`
- Create: `scripts/migrate-readers.mjs`

**Interfaces:**
- Produces: `addReturnControl(html, lang)`, `readerUrl(lang, driveId)`, `addOpenUrlToCatalog(source, resourceId, openUrl)`.

- [ ] Write tests for the first-control return element, Spanish/English labels, reader URL construction, and targeted catalog update.
- [ ] Run `npm test` and verify the new tests fail before implementation.
- [ ] Implement the smallest pure helpers required by the tests.
- [ ] Run `npm test` and verify all tests pass.

### Task 2: Safe migration runner

**Files:**
- Modify: `scripts/migrate-readers.mjs`

**Interfaces:**
- Consumes: `data.js` resource objects with `id`, `lang`, `url`, optional `openUrl`.
- Produces: `docs/<lang>/reader-<driveId>.html` and corresponding `openUrl` entries.

- [ ] Read and parse the resource array without changing the trailing compatibility code in `data.js`.
- [ ] Select only resources in the requested language that lack `openUrl`.
- [ ] Fetch the public Drive file and reject responses that are not usable HTML.
- [ ] Inject the return control and write each reader atomically.
- [ ] Add the matching `openUrl` only after the reader write succeeds.
- [ ] Support `--lang=es|en` and `--limit=N` for staged runs.

### Task 3: Spanish staged migration

**Files:**
- Create: remaining `docs/es/reader-*.html`
- Modify: `data.js`

- [ ] Run a small Spanish batch first and verify generated HTML contains the return control.
- [ ] Run tests.
- [ ] Continue Spanish batches until no Spanish catalog entry lacks `openUrl`.
- [ ] Verify every Spanish `openUrl` target exists in the repository.

### Task 4: English staged migration

**Files:**
- Create: `docs/en/reader-*.html`
- Modify: `data.js`

- [ ] Repeat the staged process for English resources.
- [ ] Verify every English `openUrl` target exists and contains the English return label.
- [ ] Run the full test suite.

### Task 5: Final catalog guard

**Files:**
- Modify: `test/reader-migration.test.mjs`

- [ ] Add a final regression test requiring every HTML resource in both languages to have an `openUrl` once migration is complete.
- [ ] Run `npm test` and confirm zero failures.
- [ ] Verify GitHub Pages deployment succeeds on the final commit.
