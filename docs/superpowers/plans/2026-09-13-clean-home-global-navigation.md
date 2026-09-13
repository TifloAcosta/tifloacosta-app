# Clean Home and Global Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the long public homepage with the approved clean and silent distributor, while preserving all existing functions in dedicated accessible pages and introducing one global search and one global favorites model.

**Architecture:** `index.html` becomes a compact navigation hub. Existing expanded content is moved into focused pages that reuse shared data and styling. Search/favorites operate on normalized records from resources, Actualidad and videos so the user does not need separate search engines.

**Tech Stack:** Vanilla HTML/CSS/JavaScript, existing `data.js`, `videos.json`, `actualidad.json`, Node test runner, GitHub Pages/PWA.

**Spec:** `docs/superpowers/specs/2026-09-13-actualidad-web-shared-design.md`

## Global Constraints

- Home order: Actualidad, Buscar, Biblioteca, Favoritos, Vídeos, Libro, Podcast, Contacto y redes, Configuración.
- Home exposes no internal Podcast platforms, social links or settings controls.
- Actualidad may show a small preview; every other main area is one entry.
- No autofocus, automatic carousel or unexpected focus movement.
- Every secondary page has an explicit accessible return to Inicio at the beginning and end when the page is long.
- Existing document opening/downloading/sharing behavior remains available.
- Existing PWA install/update and OneSignal behavior remain functional, but their controls live inside Configuración rather than Home.
- One global search searches resources, Actualidad and videos without a mandatory category choice.
- Global favorites use `{ kind, id }` records and tolerate legacy resource-only favorites during migration.

---

### Task 1: Create a shared content index for search and favorites

**Files:**
- Create: `content-index.js`
- Create: `test/content-index.test.mjs`

**Interfaces:**
- `normalizeSearchText(value)`.
- `buildContentIndex({ resources, news, videos, lang })` -> records shaped `{ kind, id, title, description, url, lang, categories }`.
- `searchContent(records, query)` -> accent/case-insensitive deterministic results.
- Videos remain searchable regardless of interface language unless a video declares its own language restriction.

- [ ] **Step 1: Write failing tests using one resource, one news item and one video**
- [ ] **Step 2: Run `npm test` and verify the module is missing**
- [ ] **Step 3: Implement normalization and search without DOM dependencies**
- [ ] **Step 4: Run all tests**
- [ ] **Step 5: Commit with `feat: add shared content index`**

---

### Task 2: Migrate favorites to global typed references safely

**Files:**
- Create: `favorites-core.js`
- Create: `test/global-favorites.test.mjs`

**Interfaces:**
- New storage key: `tifloGlobalFavoritesV1`.
- Record: `{ kind: 'resource' | 'news' | 'video', id: 'stable-id' }`.
- `readFavorites(storage)` ignores corrupt records.
- `migrateLegacyFavorites(storage, resources)` converts existing `tifloFavorites` resource IDs exactly once and never deletes the legacy key during the first migration release.
- `toggleFavorite(list, ref)` is idempotent by `(kind,id)`.

- [ ] **Step 1: Write failing migration and toggle tests**
- [ ] **Step 2: Verify red**
- [ ] **Step 3: Implement safe storage helpers and migration**
- [ ] **Step 4: Run tests**
- [ ] **Step 5: Commit with `feat: add global favorites model`**

---

### Task 3: Build the dedicated global Search page

**Files:**
- Create: `buscar.html`
- Create: `buscar.js`
- Create: `test/global-search-page.test.mjs`
- Modify: `styles.css`

**Interfaces:**
- Loads resources from `data.js`, news from `actualidad.json`, and videos from `videos.json`.
- One search field and one submit button; no required category selector.
- Results grouped under real `<h2>`/`<h3>` headings by type.
- Status uses one polite live region to announce result count but does not move focus.
- Opening and returning to a result preserves the browser’s normal focus/position as far as static-page navigation permits; no forced autofocus on return.

- [ ] **Step 1: Write failing source tests for one search form, no category prerequisite, bilingual labels and grouped headings**
- [ ] **Step 2: Implement page shell and content loading**
- [ ] **Step 3: Implement search rendering using `content-index.js`**
- [ ] **Step 4: Run tests**
- [ ] **Step 5: Commit with `feat: add global search page`**

---

### Task 4: Build dedicated Biblioteca and Favoritos pages without losing current document actions

**Files:**
- Create: `biblioteca.html`
- Create: `biblioteca.js`
- Create: `favoritos.html`
- Create: `favoritos.js`
- Modify: `app-core.js` only if an existing pure helper must be shared rather than duplicated.
- Create: `test/library-favorites-pages.test.mjs`

**Interfaces:**
- Biblioteca preserves category browsing and the existing document options: open, download, share, favorite, cancel.
- Favoritos resolves typed references across resources, news and videos and groups them with headings by type.
- Both pages have Inicio return links at start and end.

- [ ] **Step 1: Write failing tests for document-action preservation and typed favorite grouping**
- [ ] **Step 2: Extract only the pure helpers required from current `app.js`; do not duplicate the whole homepage controller**
- [ ] **Step 3: Implement Biblioteca**
- [ ] **Step 4: Implement Favoritos**
- [ ] **Step 5: Run all tests**
- [ ] **Step 6: Commit with `feat: separate library and favorites`**

---

### Task 5: Build focused Libro, Podcast, Contacto and Configuración pages

**Files:**
- Create: `libro.html`
- Create: `podcast.html`
- Create: `contacto.html`
- Create: `configuracion.html`
- Create: `configuracion.js`
- Create: `test/secondary-pages.test.mjs`

**Interfaces:**
- Libro contains the current book description and Amazon actions.
- Podcast contains Spotify, Apple Podcasts, iVoox, Podimo and radio.es; none remain exposed on Home.
- Contacto contains WhatsApp, email, Instagram and Facebook links; none remain exposed on Home.
- Configuración owns visual preferences, install guidance, notification controls and PWA update controls currently on Home.
- All pages are bilingual through the same stored `tifloLang` convention.

- [ ] **Step 1: Write failing tests asserting Home details are absent and each dedicated page owns its controls**
- [ ] **Step 2: Implement the four semantic page shells with explicit Inicio links**
- [ ] **Step 3: Move settings behavior into `configuracion.js` while keeping existing storage keys and OneSignal element IDs expected by `notifications.js`**
- [ ] **Step 4: Run tests**
- [ ] **Step 5: Commit with `feat: separate home detail pages`**

---

### Task 6: Replace Home with the approved clean distributor

**Files:**
- Modify: `index.html`
- Replace/simplify: `app.js`
- Modify: `styles.css`
- Create: `test/clean-home.test.mjs`

**Interfaces:**
- Home keeps language switch, identity, short intro, Actualidad preview and nine ordered main entries.
- Link targets:
  - `actualidad.html`
  - `buscar.html`
  - `biblioteca.html`
  - `favoritos.html`
  - `videos.html`
  - `libro.html`
  - `podcast.html`
  - `contacto.html`
  - `configuracion.html`
- No search input, category select, social-platform list, podcast-platform list, book purchase controls or settings form remains on Home.

- [ ] **Step 1: Write failing DOM-source tests for exact order and forbidden detail controls**
- [ ] **Step 2: Reduce `index.html` to the compact distributor while retaining the Actualidad preview**
- [ ] **Step 3: Reduce `app.js` to language, preview and existing install analytics required by Home**
- [ ] **Step 4: Run all tests**
- [ ] **Step 5: Commit with `feat: simplify TifloAcosta home`**

---

### Task 7: PWA cache, navigation and regression gate

**Files:**
- Modify: `sw.js`
- Modify: `manifest.webmanifest` only if the existing start URL or scope needs no semantic change; otherwise leave it untouched.
- Modify: `README.txt`
- Create: `test/clean-navigation-regression.test.mjs`

**Interfaces:**
- Network-first policy covers all new HTML/JS/JSON pages.
- Offline fallback remains functional.
- Existing analytics, YouTube sync, OneSignal worker and direct document readers are not removed.
- Regression test confirms every Home destination exists and every secondary page has an Inicio return control.

- [ ] **Step 1: Write failing navigation/cache regression tests**
- [ ] **Step 2: Update service worker asset handling and bump cache version**
- [ ] **Step 3: Update maintenance documentation with the new page map and separation between `Novedades` resources and `Actualidad` news**
- [ ] **Step 4: Run `npm test` and inspect zero failures**
- [ ] **Step 5: Commit with `test: gate clean web navigation`**

---

## Self-Review

- Exact approved Home order is covered.
- Podcast, Contact and Configuración details leave Home.
- Search is global and category choice is optional.
- Favorites are global with backward-compatible migration.
- Existing resource actions, notifications and PWA behavior are explicitly preserved.
- Actualidad remains separate from the existing resource `Novedades` concept.
- No app-store/native code is required to publish this web improvement.
