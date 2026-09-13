# Actualidad Shared Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first publishable Actualidad TifloAcosta foundation shared by the public web and future iOS/Android apps: a stable JSON contract, automated source synchronization, accessible Actualidad page, optional TifloAcosta adaptations, and safe source-only fallback.

**Architecture:** GitHub Actions produces `actualidad.json` from a controlled source configuration and an editorial overlay. Browser code only consumes the generated JSON; it never fetches third-party feeds directly. A story exists once, can carry multiple categories, and only exposes “Leer en TifloAcosta” when an adaptation exists.

**Tech Stack:** Node.js built-in test runner and fetch, vanilla HTML/CSS/JavaScript, GitHub Actions, existing GitHub Pages deployment.

**Spec:** `docs/superpowers/specs/2026-09-13-actualidad-web-shared-design.md`

## Global Constraints

- Accessibility has priority over decorative behavior.
- No carousel or automatic focus movement.
- Spanish and English are separate editorial outputs, not literal translations.
- `source-only` items show the original source but never pretend to be a TifloAcosta adaptation.
- `withheld` items never appear publicly.
- One story may have multiple categories but only one stable ID.
- The web loads one stable snapshot; background source updates do not reorder a page already being read.
- Initial sync cadence is once per hour and is controlled only by the workflow.
- Existing public resources, videos, notifications and PWA behavior stay untouched until their dedicated migration task.

---

### Task 1: Lock the Actualidad data contract and selection policy

**Files:**
- Create: `actualidad-core.js`
- Create: `test/actualidad-core.test.mjs`
- Create: `actualidad.json`
- Create: `actualidad-editorial.json`

**Interfaces:**
- `TIFLO_ACTUALIDAD_CORE.normalizeStory(raw)` -> normalized public story or `null`.
- `TIFLO_ACTUALIDAD_CORE.sortStories(items)` -> priority first, then newest date, then stable ID.
- `TIFLO_ACTUALIDAD_CORE.publicStories(items, lang)` -> excludes `withheld`, filters by language.
- `TIFLO_ACTUALIDAD_CORE.homePreview(items, lang, limit = 5)` -> at most five public stories.
- Public story shape:

```js
{
  id: 'applevis-apps-<stable-hash>',
  lang: 'es' | 'en',
  title: '...',
  sourceId: 'applevis-apps',
  sourceName: 'AppleVis',
  sourceUrl: 'https://www.applevis.com/',
  originalUrl: 'https://...',
  publishedAt: '2026-09-13T12:00:00.000Z',
  categories: ['apple', 'apps-accesibles'],
  editorialState: 'source-only' | 'adapted' | 'withheld',
  summary: '',
  body: '',
  featuredRank: null
}
```

- [ ] **Step 1: Write failing tests for normalization, filtering and preview ordering**

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const core = require('../actualidad-core.js');

test('withheld stories never become public', () => {
  const items = [
    { id:'a', lang:'es', title:'A', sourceId:'x', sourceName:'X', sourceUrl:'https://x.test', originalUrl:'https://x.test/a', publishedAt:'2026-09-13T10:00:00Z', categories:['apple'], editorialState:'withheld' }
  ];
  assert.deepEqual(core.publicStories(items, 'es'), []);
});

test('home preview honors explicit priority before recency and caps at five', () => {
  const items = Array.from({ length: 7 }, (_, i) => ({ id:String(i), lang:'es', title:String(i), sourceId:'x', sourceName:'X', sourceUrl:'https://x.test', originalUrl:`https://x.test/${i}`, publishedAt:`2026-09-${String(13-i).padStart(2,'0')}T10:00:00Z`, categories:['apple'], editorialState:'source-only', featuredRank:i === 6 ? 1 : null }));
  const result = core.homePreview(items, 'es');
  assert.equal(result.length, 5);
  assert.equal(result[0].id, '6');
});
```

- [ ] **Step 2: Run `npm test` and confirm the new test fails because `actualidad-core.js` does not exist**
- [ ] **Step 3: Implement a UMD-style core module matching the existing `app-core.js` pattern**
- [ ] **Step 4: Seed `actualidad.json` with `[]` and `actualidad-editorial.json` with `[]`**
- [ ] **Step 5: Run `npm test` and confirm all tests pass**
- [ ] **Step 6: Commit with `feat: add Actualidad data contract`**

---

### Task 2: Build deterministic RSS/Atom ingestion and de-duplication

**Files:**
- Create: `scripts/actualidad-feed.mjs`
- Create: `test/actualidad-feed.test.mjs`
- Create: `actualidad-sources.json`

**Interfaces:**
- `parseFeedXml(xml, source)` -> array of raw feed entries supporting RSS `<item>` and Atom `<entry>`.
- `canonicalizeUrl(url)` -> strips fragments and common tracking parameters (`utm_*`, `fbclid`, `gclid`).
- `stableStoryId(sourceId, canonicalUrl)` -> deterministic lowercase SHA-256 prefix.
- `normalizeFeedEntry(entry, source)` -> public-contract candidate.
- Source shape:

```json
{
  "id": "applevis-apps",
  "name": "AppleVis",
  "homepage": "https://www.applevis.com/",
  "feedUrl": "https://www.applevis.com/feed/apps.xml",
  "lang": "en",
  "categories": ["apple", "apps-accesibles"],
  "enabled": true
}
```

- [ ] **Step 1: Write RSS and Atom fixture tests before implementation**
- [ ] **Step 2: Run `npm test` and verify failure because `scripts/actualidad-feed.mjs` is missing**
- [ ] **Step 3: Implement XML entity decoding, element extraction, canonical URLs and stable IDs with Node built-ins only**
- [ ] **Step 4: Add the first verified source configuration**

Use these current published feeds:

```json
[
  {
    "id": "applevis-apps",
    "name": "AppleVis",
    "homepage": "https://www.applevis.com/",
    "feedUrl": "https://www.applevis.com/feed/apps.xml",
    "lang": "en",
    "categories": ["apple", "apps-accesibles"],
    "enabled": true
  },
  {
    "id": "applevis-blog",
    "name": "AppleVis",
    "homepage": "https://www.applevis.com/blog",
    "feedUrl": "https://www.applevis.com/feed/blog.xml",
    "lang": "en",
    "categories": ["apple", "tecnologia-accesibilidad"],
    "enabled": true
  },
  {
    "id": "nvaccess-in-process",
    "name": "NV Access",
    "homepage": "https://www.nvaccess.org/category/in-process/",
    "feedUrl": "https://www.nvaccess.org/category/in-process/feed/",
    "lang": "en",
    "categories": ["windows", "nvda"],
    "enabled": true
  }
]
```

- [ ] **Step 5: Run `npm test` and confirm parser/canonicalization tests pass**
- [ ] **Step 6: Commit with `feat: ingest trusted Actualidad feeds`**

---

### Task 3: Merge editorial adaptations without fabricating them

**Files:**
- Create: `scripts/actualidad-editorial.mjs`
- Create: `test/actualidad-editorial.test.mjs`

**Interfaces:**
- `mergeEditorial(stories, editorialRecords)` matches by story `id` or canonical `originalUrl`.
- Editorial record may set `lang`, `title`, `summary`, `body`, `categories`, `featuredRank`, and `editorialState`.
- `adapted` is valid only when non-empty `body` exists.
- An attempted `adapted` record with empty body is downgraded to `source-only`.

- [ ] **Step 1: Write tests proving source-only stays source-only and empty adaptations cannot expose a TifloAcosta reader**
- [ ] **Step 2: Run `npm test` and confirm failure**
- [ ] **Step 3: Implement the minimal overlay merge and validation rules**
- [ ] **Step 4: Run all tests**
- [ ] **Step 5: Commit with `feat: add Actualidad editorial overlay`**

---

### Task 4: Produce `actualidad.json` automatically and safely

**Files:**
- Create: `scripts/sync-actualidad.mjs`
- Create: `test/actualidad-sync.test.mjs`
- Create: `.github/workflows/sync-actualidad.yml`

**Interfaces:**
- `syncActualidad({ sources, editorial, fetchFn })` returns normalized public stories sorted deterministically.
- One failing source does not erase previously valid output from other sources.
- If every enabled source fails, the script exits non-zero and leaves the existing `actualidad.json` untouched.
- The workflow runs hourly at minute 17, supports `workflow_dispatch`, commits only when `actualidad.json` changes, then deploys Pages in the same run using the repository’s existing deployment pattern.

- [ ] **Step 1: Write tests for one-source failure, all-source failure, de-duplication and deterministic output**
- [ ] **Step 2: Verify the focused tests fail**
- [ ] **Step 3: Implement `sync-actualidad.mjs` with dependency injection for tests and real `fetch` in CLI mode**
- [ ] **Step 4: Add workflow schedule**

```yaml
on:
  workflow_dispatch:
  schedule:
    - cron: '17 * * * *'
```

The workflow checks out `main`, uses Node 22, runs `node scripts/sync-actualidad.mjs`, commits only a changed `actualidad.json`, and deploys Pages directly when a commit was made, mirroring the existing YouTube workflow behavior.

- [ ] **Step 5: Run `npm test`**
- [ ] **Step 6: Commit with `feat: sync Actualidad hourly`**

---

### Task 5: Add the accessible Actualidad browser and reader

**Files:**
- Create: `actualidad.html`
- Create: `actualidad.js`
- Modify: `styles.css`
- Create: `test/actualidad-page.test.mjs`

**Interfaces:**
- Page loads `actualidad.json` once on entry.
- Language follows the same stored `tifloLang` convention already used by the web app.
- Category filters are ordinary buttons or a native select; no carousel.
- Story list uses real headings.
- `source-only`: title, date/source, categories and `Abrir fuente original` / `Open original source`.
- `adapted`: the same plus `Leer en TifloAcosta` / `Read on TifloAcosta`; activating it reveals a clean reading view with a clear `Volver a Actualidad` / `Back to News` control at both beginning and end.
- Returning from the reader restores focus to the story title that opened it.

- [ ] **Step 1: Write source-level accessibility tests for headings, bilingual labels, no autofocus and conditional reader action**
- [ ] **Step 2: Run tests and confirm failure**
- [ ] **Step 3: Implement semantic page shell and one-snapshot rendering**
- [ ] **Step 4: Implement reader focus return without timers or automatic refresh**
- [ ] **Step 5: Add minimal styling by reusing existing classes before creating new visual rules**
- [ ] **Step 6: Run `npm test`**
- [ ] **Step 7: Commit with `feat: add accessible Actualidad page`**

---

### Task 6: Add a non-disruptive Actualidad preview to the existing home before full home migration

**Files:**
- Modify: `index.html`
- Modify: `app.js`
- Modify: `sw.js`
- Create: `test/actualidad-home-preview.test.mjs`

**Interfaces:**
- The first content block after the hero becomes `Actualidad` / `News`.
- It loads at most five items from the same `actualidad.json` using `homePreview`.
- It includes one explicit link to `actualidad.html`.
- It does not refresh itself while a user is reading the page.
- Existing `Novedades` resource functionality remains available until the clean-home migration; it is not renamed to Actualidad and must not be conflated with external/current news.

- [ ] **Step 1: Write a failing test asserting Actualidad precedes current search/resource sections and points to `actualidad.html`**
- [ ] **Step 2: Implement the preview with a separate DOM container and separate copy keys**
- [ ] **Step 3: Add `actualidad.json`, `actualidad-core.js`, `actualidad.html`, and `actualidad.js` to the service-worker network-first/cache policy without changing notification storage**
- [ ] **Step 4: Run all tests**
- [ ] **Step 5: Commit with `feat: preview Actualidad on home`**

---

## Self-Review

- Spec coverage: shared feed, stable IDs, multi-category stories, source-only/adapted/withheld states, hourly updates, stable reading, accessible reader, bilingual labels and homepage preview are covered.
- Deliberately excluded from this plan: automatic AI-written Tony adaptations, because no production editorial model credential/provider is yet part of the repository; the contract supports them without inventing a secret or falsely attributing copy. Source expansion for JAWS, Android, Windows, smart glasses and BuscaApps follows after the generic feed foundation is proven.
- No placeholders or invented production credentials are required.
- All production behavior is guarded by Node tests before implementation.
