# Bilingual Actualidad and Five-Day Featured Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate Actualidad to one logical bilingual content model while preserving the working web, and enforce a strict five-day eligibility window for Featured content without deleting older items from the 90-day general feed.

**Architecture:** Keep discovery in source language, then merge optional editorial variants into one logical content object with `locales.es` and `locales.en`. Browser code resolves the requested locale at render time and temporarily accepts legacy `lang/title/summary/body` records during migration. Featured selection is a pure core rule driven by the original `publishedAt`, so neither synchronization date nor editorial priority can make a six-day-old item Featured.

**Tech Stack:** Node.js 22 built-in test runner, vanilla JavaScript/HTML, existing `actualidad-core.js`, `scripts/actualidad-feed.mjs`, `scripts/actualidad-editorial.mjs`, `scripts/sync-actualidad.mjs`, GitHub Actions, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-09-14-actualidad-bilingual-multimedia-hub-design.md`

## Global Constraints

- Accessibility over decorative behavior.
- No autoplay, automatic focus movement, carousel behavior, or background reordering while a person is reading.
- The original source language does not decide whether an important story appears in Spanish or English.
- Important selected content becomes public as bilingual only when both natural-language variants are present.
- Adaptations are original TifloAcosta summaries/texts, not copied third-party articles.
- `publishedAt` is always the source publication date.
- Featured accepts content no older than five days; on day six it is ineligible regardless of `featuredRank`.
- General retention remains 90 days in this phase.
- Existing `source-only` discovery remains usable during migration.
- The native mobile integration branch remains isolated and unmerged.
- Every production behavior change starts with a failing automated test.

---

### Task 1: Introduce the logical bilingual content contract with legacy compatibility

**Files:**
- Modify: `actualidad-core.js`
- Modify: `test/actualidad-core.test.mjs`

**Interfaces:**
- `normalizeContent(raw)` -> normalized logical item or `null`.
- `localizedStory(raw, lang)` -> flat renderable story for `es` or `en`, or `null` when that locale is unavailable.
- `normalizeStory(raw)` remains exported as a compatibility alias for legacy callers during this phase.
- New logical shape:

```js
{
  id: 'applevis-blog-abc123',
  type: 'news',
  sourceId: 'applevis-blog',
  sourceName: 'AppleVis Blog',
  sourceUrl: 'https://www.applevis.com/blog',
  originalUrl: 'https://www.applevis.com/blog/example',
  originalLanguage: 'en',
  publishedAt: '2026-09-14T10:00:00.000Z',
  categories: ['apple', 'tecnologia-accesibilidad'],
  editorialState: 'adapted',
  featuredRank: null,
  locales: {
    es: { title: 'Título natural', summary: 'Resumen propio', body: 'Texto propio.' },
    en: { title: 'Natural title', summary: 'Own summary', body: 'Own text.' }
  },
  media: null
}
```

Legacy input continues to be accepted:

```js
{
  id: 'legacy',
  lang: 'es',
  title: 'Título',
  summary: 'Resumen',
  body: '',
  sourceId: 'source',
  sourceName: 'Fuente',
  sourceUrl: 'https://example.com/',
  originalUrl: 'https://example.com/story',
  publishedAt: '2026-09-14T10:00:00Z',
  categories: ['apple'],
  editorialState: 'source-only',
  featuredRank: null
}
```

- [ ] **Step 1: Add failing tests for bilingual normalization and legacy fallback**

```js
const bilingual = overrides => ({
  id: 'bilingual-1',
  type: 'news',
  sourceId: 'applevis-blog',
  sourceName: 'AppleVis Blog',
  sourceUrl: 'https://www.applevis.com/blog',
  originalUrl: 'https://www.applevis.com/blog/story',
  originalLanguage: 'en',
  publishedAt: '2026-09-14T10:00:00Z',
  categories: ['apple'],
  editorialState: 'adapted',
  featuredRank: null,
  locales: {
    es: { title: 'Historia en español', summary: 'Resumen', body: 'Texto.' },
    en: { title: 'English story', summary: 'Summary', body: 'Text.' }
  },
  media: null,
  ...overrides
});

test('a bilingual logical item resolves naturally in both interface languages', () => {
  assert.equal(core.localizedStory(bilingual(), 'es').title, 'Historia en español');
  assert.equal(core.localizedStory(bilingual(), 'en').title, 'English story');
});

test('legacy records remain renderable during migration', () => {
  const legacy = story({ id: 'legacy-es', lang: 'es', title: 'Legado' });
  assert.equal(core.localizedStory(legacy, 'es').title, 'Legado');
  assert.equal(core.localizedStory(legacy, 'en'), null);
});

test('adapted logical items require both locale variants', () => {
  const invalid = bilingual({ locales: { es: { title: 'Solo español', summary: '', body: 'Texto.' } } });
  assert.equal(core.normalizeContent(invalid), null);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
node --test test/actualidad-core.test.mjs
```

Expected: FAIL because `localizedStory` / `normalizeContent` do not exist.

- [ ] **Step 3: Implement the minimal compatibility layer**

Use these rules in `actualidad-core.js`:

```js
function normalizedLocale(value) {
  if (!value || typeof value !== 'object') return null;
  const title = cleanString(value.title);
  if (!title) return null;
  return {
    title,
    summary: cleanString(value.summary),
    body: cleanString(value.body)
  };
}

function legacyToLogical(raw) {
  const lang = cleanString(raw?.lang).toLowerCase();
  if (!['es', 'en'].includes(lang)) return null;
  return {
    ...raw,
    type: 'news',
    originalLanguage: lang,
    locales: {
      [lang]: {
        title: cleanString(raw.title),
        summary: cleanString(raw.summary),
        body: cleanString(raw.body)
      }
    },
    media: null
  };
}
```

`normalizeContent()` must validate URLs, date, categories, state and `originalLanguage`. For `adapted`, require valid `es` and `en` locales. For `source-only`, allow only the original locale. `localizedStory()` returns the existing flat render shape expected by `actualidad.js` and `app.js`.

- [ ] **Step 4: Keep old public helpers working through the new resolver**

`publicStories(items, lang)` must normalize each logical/legacy item and return only `localizedStory(item, lang)` values whose state is not `withheld`.

- [ ] **Step 5: Run the focused test and verify GREEN**

```bash
node --test test/actualidad-core.test.mjs
```

Expected: all tests in the file PASS.

- [ ] **Step 6: Run the full suite**

```bash
npm test
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add actualidad-core.js test/actualidad-core.test.mjs
git commit -m "feat: add bilingual Actualidad content model"
```

---

### Task 2: Make editorial overlays produce one bilingual logical item

**Files:**
- Modify: `scripts/actualidad-editorial.mjs`
- Modify: `test/actualidad-editorial.test.mjs`
- Modify: `actualidad-editorial.json` only if fixture records are needed for manual validation

**Interfaces:**
- `mergeEditorial(stories, editorialRecords)` continues matching by stable `id` or canonical `originalUrl`.
- Feed discoveries still arrive as flat source-language candidates.
- A bilingual editorial record uses:

```js
{
  id: 'story-id',
  editorialState: 'adapted',
  locales: {
    es: { title: '...', summary: '...', body: '...' },
    en: { title: '...', summary: '...', body: '...' }
  },
  categories: ['apple'],
  featuredRank: 1
}
```

- `selected` may carry incomplete locales internally but must not be emitted as `adapted` until both are complete.

- [ ] **Step 1: Replace the single-language adaptation test with bilingual RED tests**

```js
test('an adapted editorial record produces one logical item with both locales', () => {
  const [result] = mergeEditorial([sourceStory()], [{
    id: 'story-1',
    editorialState: 'adapted',
    locales: {
      es: { title: 'Título adaptado', summary: 'Resumen propio', body: 'Texto propio.' },
      en: { title: 'Adapted title', summary: 'Own summary', body: 'Own text.' }
    }
  }]);

  assert.equal(result.editorialState, 'adapted');
  assert.equal(result.originalLanguage, 'en');
  assert.equal(result.locales.es.title, 'Título adaptado');
  assert.equal(result.locales.en.title, 'Adapted title');
});

test('an incomplete bilingual adaptation is not published as adapted', () => {
  const [result] = mergeEditorial([sourceStory()], [{
    id: 'story-1',
    editorialState: 'adapted',
    locales: { es: { title: 'Solo español', body: 'Texto.' } }
  }]);
  assert.notEqual(result.editorialState, 'adapted');
});
```

- [ ] **Step 2: Run focused test and verify RED**

```bash
node --test test/actualidad-editorial.test.mjs
```

- [ ] **Step 3: Implement locale cleaning and state promotion**

Add helpers equivalent to:

```js
function cleanLocale(value) {
  if (!value || typeof value !== 'object') return null;
  const title = cleanString(value.title);
  if (!title) return null;
  return { title, summary: cleanString(value.summary), body: cleanString(value.body) };
}

function completeAdaptation(locales) {
  return Boolean(
    locales?.es?.title && locales?.es?.body &&
    locales?.en?.title && locales?.en?.body
  );
}
```

When no overlay exists, convert the source candidate into a logical `source-only` item whose `locales` contains only its source language. When the overlay requests `adapted`, promote only if `completeAdaptation(locales)` is true; otherwise leave it `selected` when editorial selection exists, or `source-only` when it does not.

- [ ] **Step 4: Preserve categories, ranking, source metadata and original publication date**

Editorial data may override `categories` and `featuredRank`, but must never replace `publishedAt`, `originalUrl`, `sourceId`, `sourceName`, `sourceUrl`, or `originalLanguage`.

- [ ] **Step 5: Run focused and full suites**

```bash
node --test test/actualidad-editorial.test.mjs
npm test
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add scripts/actualidad-editorial.mjs test/actualidad-editorial.test.mjs actualidad-editorial.json
git commit -m "feat: merge bilingual Actualidad adaptations"
```

---

### Task 3: Emit the logical model from synchronization without changing discovery behavior

**Files:**
- Modify: `scripts/sync-actualidad.mjs`
- Modify: `test/actualidad-sync.test.mjs`
- Keep: `scripts/actualidad-feed.mjs` source-language discovery contract unchanged in this phase

**Interfaces:**
- `syncActualidad({ sources, editorial, fetchFn, now })` returns `{ stories, failedSources }` where `stories` are logical content items.
- Discovery remains flat and source-language-specific until `mergeEditorial()`.
- URL dedupe happens before editorial merge.
- 90-day retention is applied by `publishedAt` after logical normalization.

- [ ] **Step 1: Update synchronization tests to assert logical output**

For an English source-only item:

```js
assert.equal(result.stories[0].originalLanguage, 'en');
assert.equal(result.stories[0].locales.en.title, 'Story');
assert.equal(result.stories[0].locales.es, undefined);
```

For a bilingual adaptation:

```js
assert.equal(adapted.stories[0].editorialState, 'adapted');
assert.equal(adapted.stories[0].locales.es.title, 'Historia adaptada');
assert.equal(adapted.stories[0].locales.en.title, 'Adapted story');
```

Keep existing tests for retries, one-source failure, all-source failure, canonical dedupe, CTI parsing, source limits, deterministic order and 90-day retention.

- [ ] **Step 2: Run focused test and verify RED**

```bash
node --test test/actualidad-sync.test.mjs
```

- [ ] **Step 3: Switch synchronization normalization to `core.normalizeContent()`**

Replace the final normalization stage conceptually with:

```js
const stories = core.sortStories(
  merged
    .map(item => core.normalizeContent(item))
    .filter(item => item && item.editorialState !== 'withheld')
    .filter(item => new Date(item.publishedAt).getTime() >= cutoff)
);
```

`sortStories()` must continue ordering by explicit editorial rank, publication date, then stable ID.

- [ ] **Step 4: Confirm CLI still writes only changed JSON**

Run:

```bash
node scripts/sync-actualidad.mjs
```

Expected: valid JSON output; failed sources are warned without erasing valid sources; all-source failure remains non-zero.

- [ ] **Step 5: Run tests**

```bash
node --test test/actualidad-sync.test.mjs
npm test
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add scripts/sync-actualidad.mjs test/actualidad-sync.test.mjs actualidad.json
git commit -m "feat: publish logical bilingual Actualidad feed"
```

---

### Task 4: Enforce the strict five-day Featured window in the shared core

**Files:**
- Modify: `actualidad-core.js`
- Modify: `test/actualidad-core.test.mjs`
- Modify: `test/actualidad-home-preview.test.mjs`

**Interfaces:**
- `isFeaturedEligible(item, now = new Date(), maxAgeDays = 5)` -> boolean.
- `homePreview(items, lang, limit = 5, now = new Date())` -> only eligible localized stories, diversity-aware, maximum `limit`.
- Eligibility is calculated from source `publishedAt` only.
- The exact boundary is inclusive through five 24-hour periods: `ageMs <= 5 * 24 * 60 * 60 * 1000`; anything older is excluded.

- [ ] **Step 1: Add boundary tests before implementation**

```js
test('home preview excludes a story older than five days even with top editorial rank', () => {
  const now = new Date('2026-09-14T12:00:00Z');
  const old = story({
    id: 'old-priority',
    publishedAt: '2026-09-08T11:59:59Z',
    featuredRank: 1
  });
  const recent = story({
    id: 'recent',
    publishedAt: '2026-09-14T10:00:00Z'
  });
  assert.deepEqual(core.homePreview([old, recent], 'es', 5, now).map(item => item.id), ['recent']);
});

test('a story exactly five days old remains eligible', () => {
  const now = new Date('2026-09-14T12:00:00Z');
  const boundary = story({ id: 'boundary', publishedAt: '2026-09-09T12:00:00Z' });
  assert.equal(core.homePreview([boundary], 'es', 5, now).length, 1);
});

test('Featured is not padded with older stories', () => {
  const now = new Date('2026-09-14T12:00:00Z');
  const items = [
    story({ id: 'fresh', publishedAt: '2026-09-14T10:00:00Z' }),
    story({ id: 'stale', publishedAt: '2026-09-01T10:00:00Z' })
  ];
  assert.deepEqual(core.homePreview(items, 'es', 5, now).map(item => item.id), ['fresh']);
});
```

- [ ] **Step 2: Run focused tests and verify RED**

```bash
node --test test/actualidad-core.test.mjs test/actualidad-home-preview.test.mjs
```

- [ ] **Step 3: Implement the pure eligibility helper**

```js
const FEATURED_MAX_AGE_MS = 5 * 24 * 60 * 60 * 1000;

function isFeaturedEligible(item, now = new Date(), maxAgeDays = 5) {
  const published = new Date(item?.publishedAt).getTime();
  const reference = now instanceof Date ? now.getTime() : new Date(now).getTime();
  if (Number.isNaN(published) || Number.isNaN(reference)) return false;
  const age = reference - published;
  return age >= 0 && age <= maxAgeDays * 24 * 60 * 60 * 1000;
}
```

Filter by eligibility before source-diversity selection. `featuredRank` may order eligible items but never bypass the date gate.

- [ ] **Step 4: Keep source diversity behavior after date filtering**

The existing maximum of two items from one source remains when alternatives exist. Do not fill with expired content.

- [ ] **Step 5: Run tests**

```bash
node --test test/actualidad-core.test.mjs test/actualidad-home-preview.test.mjs
npm test
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add actualidad-core.js test/actualidad-core.test.mjs test/actualidad-home-preview.test.mjs
git commit -m "feat: limit Featured Actualidad to five days"
```

---

### Task 5: Make the Actualidad page render localized logical items without regressing accessibility

**Files:**
- Modify: `actualidad.js`
- Modify: `test/actualidad-page.test.mjs`

**Interfaces:**
- `core.publicStories(stories, lang)` remains the only list source for the page.
- `availableActions(story, lang)` still receives a flat localized render story.
- Switching Spanish/English re-resolves the same logical items; it does not fetch another feed.
- Source-only items with no target-language locale do not appear in that target language.
- Adapted bilingual items appear in both languages.

- [ ] **Step 1: Add source-level regression tests**

Add assertions that page code continues to:

```js
assert.match(js, /core\.publicStories\(stories, lang\)/);
assert.equal((js.match(/fetch\(['"]actualidad\.json['"]/g) || []).length, 1);
assert.doesNotMatch(js, /setInterval|setTimeout/);
```

Add a view-level test using `core.localizedStory()` output to verify adapted ES and EN variants both expose reader actions.

- [ ] **Step 2: Run page tests and verify any required RED condition**

```bash
node --test test/actualidad-page.test.mjs
```

- [ ] **Step 3: Make the smallest UI changes necessary**

Do not add a language-of-source filter in this phase. The interface language selects the localized variant. Keep semantic headings, native category select, polite status region, explicit return buttons at top and bottom, and opener focus restoration.

- [ ] **Step 4: Run page and full tests**

```bash
node --test test/actualidad-page.test.mjs
npm test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add actualidad.js test/actualidad-page.test.mjs
git commit -m "feat: render bilingual Actualidad variants"
```

---

### Task 6: Verify deployment workflows cannot overwrite the new feed with stale format

**Files:**
- Modify only if tests prove necessary: `.github/workflows/sync-actualidad.yml`
- Modify only if tests prove necessary: `.github/workflows/jekyll-gh-pages.yml`
- Modify: `test/actualidad-pages-deploy.test.mjs`
- Modify: `test/actualidad-sync.test.mjs`

**Interfaces:**
- Both production deployment paths must run `node scripts/sync-actualidad.mjs` before publishing.
- The synchronized `actualidad.json` must therefore be in the logical bilingual format on every deployment path.
- Existing race protection remains intact.

- [ ] **Step 1: Strengthen deployment regression tests**

Assert both workflows still contain synchronization before deployment/build and that the general Pages workflow does not copy a pre-sync `actualidad.json` artifact.

- [ ] **Step 2: Run regression tests**

```bash
node --test test/actualidad-pages-deploy.test.mjs test/actualidad-sync.test.mjs
```

If they already pass, do not modify workflow YAML merely for churn.

- [ ] **Step 3: Run a real source validation on the feature branch**

```bash
node scripts/sync-actualidad.mjs
npm test
```

Expected: synchronization succeeds with at least one valid source, JSON parses, all tests PASS.

- [ ] **Step 4: Inspect generated output manually**

Confirm at least:

```js
const items = JSON.parse(await readFile('actualidad.json', 'utf8'));
for (const item of items) {
  if (!item.originalLanguage || !item.locales) throw new Error(item.id);
}
```

Also verify no item older than 90 days remains in the general feed; the five-day rule belongs only to `homePreview`, not to general feed generation.

- [ ] **Step 5: Commit only if a regression test or workflow file changed**

```bash
git add .github/workflows/sync-actualidad.yml .github/workflows/jekyll-gh-pages.yml test/actualidad-pages-deploy.test.mjs test/actualidad-sync.test.mjs
git commit -m "test: protect bilingual Actualidad deployment"
```

---

## Phase 1 Acceptance Checklist

- [ ] One logical adapted item contains both `locales.es` and `locales.en`.
- [ ] An English-origin adapted story is visible in Spanish and English without becoming two independent stories.
- [ ] A Spanish-origin adapted story is visible in English and Spanish under the same stable ID.
- [ ] Source-only discovery remains available in its original language during migration.
- [ ] A six-day-old item never appears in Featured, even with `featuredRank: 1`.
- [ ] An exactly five-day-old item remains eligible.
- [ ] Expired Featured items remain in the general feed until the 90-day retention cutoff.
- [ ] Featured does not pad itself with old material.
- [ ] Existing source diversity behavior still works among eligible items.
- [ ] Actualidad page performs one JSON fetch and does not refresh/reorder itself in the background.
- [ ] Reader return controls and focus restoration remain intact.
- [ ] One failed source does not discard other valid sources.
- [ ] All enabled sources failing still fails safely instead of publishing an empty replacement.
- [ ] Full `npm test` passes before opening a PR.

## Follow-on Plans

This plan intentionally stops after the bilingual/freshness foundation. The approved design requires separate implementation plans, each independently testable:

1. `2026-09-14-actualidad-source-expansion-and-buscaapps.md`: validate and add TecnoConocimientoAccesible, ACCYTEC, NVDA.es, BuscaApps and further high-value official/specialist sources; distinguish AppleVis Apps from AppleVis Blog; add parser state for non-RSS discovery.
2. `2026-09-14-actualidad-apps-section.md`: public Apps view, platform metadata, discovery cards and accessible filtering.
3. `2026-09-14-actualidad-multimedia.md`: audio/video model, AppleVis Podcast/Tiflo Audio/Arroba Sonora/other validated sources, accessible player, no autoplay, source fallback.
4. `2026-09-14-actualidad-editorial-selection.md`: explicit relevance/selection workflow so only strong discoveries are promoted to bilingual adaptations and Featured eligibility.

## Self-Review

- Spec coverage for this phase: logical bilingual model, source-language independence for adapted content, five-day Featured rule, 90-day general retention, compatibility migration, accessible rendering and deployment-race protection are all assigned to concrete tasks.
- Placeholder scan: no `TBD`, `TODO`, unspecified implementation step, credential dependency or invented external service is required.
- Type consistency: `normalizeContent`, `localizedStory`, `publicStories`, `homePreview`, `isFeaturedEligible` and `mergeEditorial` have one definition and consistent signatures throughout the plan.
- Scope check: source expansion, Apps UI, Multimedia and editorial-selection automation are deliberately separated into follow-on plans so this phase can ship and be tested independently.
