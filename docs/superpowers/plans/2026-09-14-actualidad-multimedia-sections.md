# Actualidad Multimedia Sections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir a Actualidad una sección «Escuchar y ver» accesible y automatizada, con separación inequívoca entre «Accesibilidad y tiflotecnología» y «Actualidad tecnológica», sin mezclar vídeos propios de TifloAcosta ni notificaciones push.

**Architecture:** El sistema tendrá un registro de fuentes multimedia independiente, un sincronizador que normaliza audio/vídeo a `actualidad-media.json`, y una superficie pública integrada en `actualidad.html`/`actualidad.js`. Las fuentes externas se clasifican en `accessibility` o `technology`; el navegador nunca decide esa pertenencia. El catálogo multimedia se genera antes de ambos despliegues de Pages y el service worker lo trata como contenido vivo mediante network-first.

**Tech Stack:** Node.js 22, JavaScript ES modules, GitHub Actions, GitHub Pages/Jekyll, HTML semántico, JSON, fetch, YouTube Data API ya usada por el proyecto.

**Spec:** `docs/superpowers/specs/2026-09-14-actualidad-multimedia-sections-design.md`

## Global Constraints

- Mantener separados `actualidad.json`, `actualidad-apps.json`, `actualidad-media.json` y `videos.json`.
- No tocar ni fusionar la rama `feature/mobile-native-integrations-work`.
- No enviar notificaciones push en esta fase.
- No incluir autoplay.
- Toda pieza debe ofrecer una forma accesible de abrir su fuente original.
- `section` se decide en configuración editorial/técnica de fuente: `accessibility` o `technology`; no se infiere en el navegador.
- La Manzana Mordida, si se activa, solo puede producir elementos `technology`.
- Actualidad Accesible puede evaluarse como fuente multimedia sin reactivarse como fuente automática del feed escrito.
- Mostrar siempre el idioma original del audio/vídeo cuando se conozca.
- No afirmar traducción, doblaje ni subtítulos si la fuente no los ofrece.
- Audio directo solo se integra si existe URL oficial y estable; en caso contrario se abre la fuente.
- YouTube utiliza embed oficial y enlace alternativo a la fuente.
- Una fuente fallida no puede vaciar el catálogo completo.
- Un fallo total no puede publicar un catálogo vacío accidental.
- Retención inicial: 90 días por fecha original real.
- Destacadas mantiene su regla separada de 5 días y nunca usa fecha de ingestión como fecha editorial.
- Las adaptaciones ES/EN de título/resumen deben ser naturales, no literales.
- El catálogo de vídeos propios de TifloAcosta permanece en `videos.json` y no entra como fuente externa.

---

### Task 1: Contrato multimedia y registro de fuentes

**Files:**
- Create: `actualidad-media-sources.json`
- Create: `scripts/actualidad-media-core.mjs`
- Create: `test/actualidad-media-core.test.mjs`

**Interfaces:**
- Produces: `normalizeMediaItem(raw, source)` → objeto normalizado o `null`.
- Produces: `dedupeMediaItems(items)` → array sin duplicados por URL canónica/ID estable.
- Produces: `retainRecentMedia(items, now, maxAgeDays = 90)` → array retenido.
- Produces source fields: `id`, `name`, `homepage`, `section`, `type`, `lang`, `adapter`, `enabled`, `maxItems`.

- [ ] **Step 1: Write failing tests for the normalized media contract**

Create `test/actualidad-media-core.test.mjs` with cases that require:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeMediaItem,
  dedupeMediaItems,
  retainRecentMedia
} from '../scripts/actualidad-media-core.mjs';

const source = {
  id: 'applevis-podcast',
  name: 'AppleVis Podcast',
  homepage: 'https://www.applevis.com/podcasts',
  section: 'accessibility',
  type: 'audio',
  lang: 'en'
};

test('source section is authoritative and survives normalization', () => {
  const item = normalizeMediaItem({
    id: 'a1',
    title: 'Accessible app demo',
    originalUrl: 'https://example.com/episode',
    publishedAt: '2026-09-10T10:00:00Z',
    mediaUrl: 'https://example.com/episode.mp3'
  }, source);
  assert.equal(item.section, 'accessibility');
  assert.equal(item.originalLanguage, 'en');
  assert.equal(item.type, 'audio');
});

test('technology sources can never be relabeled by item text', () => {
  const tech = { ...source, id: 'lamanzanamordida', name: 'La Manzana Mordida', section: 'technology', type: 'video', lang: 'es' };
  const item = normalizeMediaItem({
    id: 'v1',
    title: 'Accesibilidad del nuevo iPhone',
    originalUrl: 'https://www.youtube.com/watch?v=abcdefghijk',
    publishedAt: '2026-09-12T10:00:00Z'
  }, tech);
  assert.equal(item.section, 'technology');
});

test('canonical duplicate URLs collapse to one media item', () => {
  const items = [
    { id: '1', originalUrl: 'https://example.com/watch?v=1&utm_source=x' },
    { id: '2', originalUrl: 'https://example.com/watch?v=1' }
  ];
  assert.equal(dedupeMediaItems(items).length, 1);
});

test('media older than ninety days is excluded', () => {
  const now = new Date('2026-09-14T12:00:00Z');
  const items = [
    { id: 'new', publishedAt: '2026-09-13T12:00:00Z' },
    { id: 'old', publishedAt: '2026-06-01T12:00:00Z' }
  ];
  assert.deepEqual(retainRecentMedia(items, now).map(x => x.id), ['new']);
});
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `node --test test/actualidad-media-core.test.mjs`

Expected: FAIL because `scripts/actualidad-media-core.mjs` does not exist.

- [ ] **Step 3: Implement the minimal core**

Create `scripts/actualidad-media-core.mjs` with:

```js
const TRACKING_KEYS = new Set(['utm_source','utm_medium','utm_campaign','utm_term','utm_content','fbclid','gclid']);

export function canonicalUrl(value = '') {
  try {
    const url = new URL(value);
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) {
      if (TRACKING_KEYS.has(key.toLowerCase())) url.searchParams.delete(key);
    }
    return url.toString();
  } catch {
    return String(value || '').trim();
  }
}

export function normalizeMediaItem(raw, source) {
  const originalUrl = canonicalUrl(raw?.originalUrl || raw?.url || '');
  const title = String(raw?.title || '').trim();
  const published = new Date(raw?.publishedAt || '');
  if (!source?.id || !title || !originalUrl || Number.isNaN(published.getTime())) return null;
  return {
    id: String(raw.id || `${source.id}:${originalUrl}`),
    type: source.type === 'video' ? 'video' : 'audio',
    section: source.section === 'technology' ? 'technology' : 'accessibility',
    sourceId: source.id,
    sourceName: source.name,
    sourceUrl: source.homepage,
    originalUrl,
    originalLanguage: source.lang || 'es',
    publishedAt: published.toISOString(),
    title,
    summary: String(raw.summary || '').trim(),
    mediaUrl: String(raw.mediaUrl || '').trim() || null,
    embedUrl: String(raw.embedUrl || '').trim() || null,
    platform: String(raw.platform || source.platform || (source.type === 'video' ? 'youtube' : 'podcast')),
    categories: Array.isArray(raw.categories) ? [...new Set(raw.categories.map(String).filter(Boolean))] : []
  };
}

export function dedupeMediaItems(items = []) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = canonicalUrl(item.originalUrl || '') || String(item.id || '');
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export function retainRecentMedia(items = [], now = new Date(), maxAgeDays = 90) {
  const maxAge = maxAgeDays * 24 * 60 * 60 * 1000;
  return items.filter(item => {
    const date = new Date(item.publishedAt);
    const age = now - date;
    return !Number.isNaN(date.getTime()) && age >= 0 && age <= maxAge;
  });
}
```

- [ ] **Step 4: Add the initial source registry**

Create `actualidad-media-sources.json` with this first verified/explicit set:

```json
[
  {
    "id": "applevis-podcast",
    "name": "AppleVis Podcast",
    "homepage": "https://www.applevis.com/podcasts",
    "section": "accessibility",
    "type": "audio",
    "lang": "en",
    "adapter": "applevis-podcast-html",
    "enabled": true,
    "maxItems": 8
  },
  {
    "id": "tifloaudio",
    "name": "Tiflo Audio",
    "homepage": "https://www.tifloaudio.com/",
    "section": "accessibility",
    "type": "audio",
    "lang": "es",
    "adapter": "tifloaudio-html",
    "enabled": true,
    "maxItems": 8
  },
  {
    "id": "arroba-sonora",
    "name": "Arroba Sonora",
    "homepage": "https://cti.once.es/el-rincon-del-conocimiento/arroba-sonora",
    "section": "accessibility",
    "type": "audio",
    "lang": "es",
    "adapter": "arroba-sonora-html",
    "enabled": true,
    "maxItems": 6
  },
  {
    "id": "double-tap",
    "name": "Double Tap",
    "homepage": "https://doubletaponair.com/",
    "section": "accessibility",
    "type": "audio",
    "lang": "en",
    "adapter": "doubletap-html",
    "enabled": true,
    "maxItems": 8
  },
  {
    "id": "la-manzana-mordida",
    "name": "La Manzana Mordida",
    "homepage": "https://www.youtube.com/@LaManzanaMordida",
    "section": "technology",
    "type": "video",
    "lang": "es",
    "adapter": "youtube-handle",
    "youtubeHandle": "@LaManzanaMordida",
    "enabled": true,
    "maxItems": 8
  }
]
```

Note: the YouTube adapter must fail validation if the handle cannot be resolved by `channels.list(forHandle=...)`; do not silently substitute another channel.

- [ ] **Step 5: Run focused tests and full suite**

Run:

```bash
node --test test/actualidad-media-core.test.mjs
npm test
```

Expected: all focused tests pass and the existing suite remains green.

- [ ] **Step 6: Commit**

```bash
git add actualidad-media-sources.json scripts/actualidad-media-core.mjs test/actualidad-media-core.test.mjs
git commit -m "feat: define multimedia source contract"
```

---

### Task 2: Source adapters and resilient multimedia synchronization

**Files:**
- Create: `scripts/actualidad-media-adapters.mjs`
- Create: `scripts/sync-actualidad-media.mjs`
- Create: `test/actualidad-media-sync.test.mjs`
- Modify: `actualidad-media-sources.json`

**Interfaces:**
- Consumes: `normalizeMediaItem`, `dedupeMediaItems`, `retainRecentMedia`.
- Produces: `fetchMediaSource(source, fetchImpl = fetch, env = process.env)` → raw source entries.
- Produces: `buildMediaCatalog({ sources, fetchImpl, env, now })` → `{ items, failures }`.
- CLI writes `actualidad-media.json` only after at least one enabled source succeeds.

- [ ] **Step 1: Write failing sync tests**

Create tests for:

```js
test('one failed source does not discard valid media from another source', async () => {
  // first adapter throws; second returns one valid episode
  // expect one item and one recorded failure
});

test('all enabled sources failing rejects instead of writing an empty catalog', async () => {
  // every adapter throws
  // expect buildMediaCatalog to reject
});

test('source maxItems prevents one provider from flooding multimedia', async () => {
  // source returns 20; maxItems=3
  // expect 3 normalized items
});

test('La Manzana Mordida is always normalized as technology', async () => {
  // mocked YouTube result mentions accessibility in title
  // expect section === 'technology'
});

test('YouTube handle adapter builds official embed and source URLs', async () => {
  // mock channels.list + playlistItems.list style responses
  // expect originalUrl https://www.youtube.com/watch?v=<id>
  // expect embedUrl https://www.youtube.com/embed/<id>
});
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `node --test test/actualidad-media-sync.test.mjs`

Expected: FAIL because adapters/synchronizer are absent.

- [ ] **Step 3: Implement HTML adapters for the four accessibility sources**

Implement in `scripts/actualidad-media-adapters.mjs` named parsers:

```js
export function parseAppleVisPodcastHtml(html) { /* title, page URL, date, MP3 URL when present */ }
export function parseTifloAudioHtml(html) { /* episode title, permalink, published date, official player/download URL when present */ }
export function parseArrobaSonoraHtml(html) { /* issue title, issue/page URL, original published date */ }
export function parseDoubleTapHtml(html) { /* episode title, permalink, date; direct MP3 only when exposed by source */ }
```

Each parser must return only entries that have a title, source URL/permalink and genuine source publication date. Do not invent `mediaUrl` if the HTML does not expose one.

- [ ] **Step 4: Implement the YouTube handle adapter using the existing API secret**

The adapter must:

1. resolve `youtubeHandle` with YouTube Data API `channels.list(part=contentDetails,forHandle=...)`;
2. read the uploads playlist ID;
3. call `playlistItems.list(part=snippet,contentDetails,maxResults=<source.maxItems>)`;
4. skip private/deleted entries;
5. emit `originalUrl`, `embedUrl`, title and original publication date.

Use `YOUTUBE_API_KEY`; if it is absent for an enabled YouTube source, record a source failure and let the all-sources rule decide whether synchronization can continue.

- [ ] **Step 5: Implement resilient catalog generation**

Create `scripts/sync-actualidad-media.mjs` so that it:

```js
const sourceResults = await Promise.allSettled(enabledSources.map(source => fetchMediaSource(source, fetchImpl, env)));
```

Then:

- apply each source `maxItems` before normalization;
- normalize with the source authoritative section;
- dedupe by canonical original URL;
- apply 90-day retention;
- order newest first, then stable ID;
- collect source failures;
- throw when every enabled source fails;
- write `actualidad-media.json` only when serialized content differs from the existing file;
- log `Actualidad media: <N>. Changed: yes/no.`;
- log failed source IDs without throwing if at least one source succeeded.

- [ ] **Step 6: Run tests and real-source validation on the branch**

Run:

```bash
node --test test/actualidad-media-sync.test.mjs
YOUTUBE_API_KEY="$YOUTUBE_API_KEY" node scripts/sync-actualidad-media.mjs
npm test
```

Expected: focused tests pass; at least one real source yields valid items; full suite remains green. If the YouTube handle cannot be resolved, keep the source disabled until the exact handle is corrected—never auto-match a similarly named channel.

- [ ] **Step 7: Commit**

```bash
git add scripts/actualidad-media-adapters.mjs scripts/sync-actualidad-media.mjs test/actualidad-media-sync.test.mjs actualidad-media-sources.json
git commit -m "feat: synchronize multimedia sources"
```

---

### Task 3: Accessible «Escuchar y ver» interface with two explicit sections

**Files:**
- Modify: `actualidad.html`
- Modify: `actualidad.js`
- Create: `test/actualidad-multimedia-surface.test.mjs`

**Interfaces:**
- Consumes: `actualidad-media.json`.
- Browser render groups strictly by `item.section`.
- `accessibility` → «Accesibilidad y tiflotecnología» / «Accessibility and assistive technology».
- `technology` → «Actualidad tecnológica» / «Technology news».

- [ ] **Step 1: Write failing semantic/accessibility tests**

Tests must require:

```js
assert.match(html, /href="#media-browser"/);
assert.match(html, /<section[^>]*id="media-browser"/);
assert.match(html, /id="media-heading"/);
assert.match(html, /id="media-accessibility-heading"/);
assert.match(html, /id="media-technology-heading"/);
assert.match(html, /id="media-accessibility-list"/);
assert.match(html, /id="media-technology-list"/);
assert.match(html, /id="media-status"[^>]*aria-live="polite"/);
assert.match(js, /fetch\(['"]actualidad-media\.json['"]/);
assert.doesNotMatch(js, /autoplay/);
```

Also test that the Spanish copy for the technology section explicitly says the channels are not specialized in accessibility, and that English has an equivalent warning.

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test test/actualidad-multimedia-surface.test.mjs`

Expected: FAIL because the section is absent.

- [ ] **Step 3: Add semantic navigation and containers**

In `actualidad.html`:

- extend the existing section navigation with a direct link to `#media-browser`;
- add H2 «Escuchar y ver»;
- add H3 `#media-accessibility-heading`;
- add H3 `#media-technology-heading`;
- add the explanatory paragraph under technology general;
- add separate lists and a quiet `aria-live="polite"` status region;
- preserve existing Noticias/Apps reader return controls.

- [ ] **Step 4: Render multimedia without inferring section from title**

In `actualidad.js` add:

```js
let mediaItems = [];

function mediaForSection(section) {
  return mediaItems.filter(item => item.section === section);
}
```

Render each item with:

- heading containing title;
- source name;
- formatted original date;
- explicit original-language label;
- short summary only when available;
- «Reproducir» only if `mediaUrl` or safe `embedUrl` exists;
- «Abrir en la fuente» always when `originalUrl` exists.

Do not translate the media-language label into a claim that the media itself is translated.

- [ ] **Step 5: Implement accessible playback behavior**

For direct audio:

```html
<audio controls preload="none"></audio>
```

Set `src` only after the user activates «Reproducir»; never autoplay.

For YouTube, reuse the same accessibility pattern already proven in `videos.js`:

- official embed URL;
- explicit close/return button;
- hide unrelated browsing areas while the internal player is open;
- restore focus to the triggering control on close;
- keep «Abrir en YouTube / fuente» available.

- [ ] **Step 6: Run focused and full tests**

Run:

```bash
node --test test/actualidad-multimedia-surface.test.mjs
npm test
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add actualidad.html actualidad.js test/actualidad-multimedia-surface.test.mjs
git commit -m "feat: add accessible multimedia sections"
```

---

### Task 4: Bilingual editorial overlay and source diversity

**Files:**
- Create: `actualidad-media-editorial.json`
- Modify: `scripts/sync-actualidad-media.mjs`
- Modify: `test/actualidad-media-sync.test.mjs`

**Interfaces:**
- Editorial records match by stable `id` or canonical `originalUrl`.
- Overlay may provide `locales.es.title/summary`, `locales.en.title/summary`, `featuredRank`, `withheld`.
- Overlay may not change `section`, `sourceId`, `originalUrl`, `publishedAt`, or `originalLanguage`.

- [ ] **Step 1: Add failing tests for editorial safety**

Tests must prove:

```js
test('editorial adaptation cannot move a technology source into accessibility', ...);
test('editorial adaptation cannot replace original publication date', ...);
test('a bilingual overlay exposes natural localized title and summary without changing media language', ...);
test('withheld media is excluded', ...);
test('source diversity prevents one provider from filling the whole visible set when alternatives exist', ...);
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `node --test test/actualidad-media-sync.test.mjs`

Expected: FAIL on new editorial behaviors.

- [ ] **Step 3: Implement editorial overlay**

Create `actualidad-media-editorial.json` initially as `[]` and implement `mergeMediaEditorial(items, records)` with immutable source metadata.

A localized render object may expose:

```js
{
  ...item,
  displayTitle,
  displaySummary,
  displayLanguage: 'es' | 'en'
}
```

but must retain `originalLanguage` unchanged.

- [ ] **Step 4: Add source-diversity ordering**

When presenting the default visible multimedia list, cap consecutive items from the same source at 2 when alternatives are available. Preserve overall recency as much as possible.

- [ ] **Step 5: Run focused and full tests**

Run:

```bash
node --test test/actualidad-media-sync.test.mjs
npm test
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add actualidad-media-editorial.json scripts/sync-actualidad-media.mjs test/actualidad-media-sync.test.mjs
git commit -m "feat: add multimedia editorial controls"
```

---

### Task 5: Deployment, cache strategy and branch validation

**Files:**
- Modify: `.github/workflows/sync-actualidad.yml`
- Modify: `.github/workflows/jekyll-gh-pages.yml`
- Modify: `sw.js`
- Modify: `test/actualidad-deployment.test.mjs`
- Modify: `test/actualidad-home-preview.test.mjs` if its service-worker assertions cover the live asset list.

**Interfaces:**
- Both deploy paths run `node scripts/sync-actualidad-media.mjs` before packaging/deploying.
- `actualidad-media.json` is detected and committed by the dedicated Actualidad workflow together with the other generated catalogs.
- Feature branches validate enabled multimedia sources and run the full suite.

- [ ] **Step 1: Write failing deployment tests**

Require both workflows to contain:

```text
node scripts/sync-actualidad-media.mjs
```

Require the dedicated workflow change detection and `git add` to include `actualidad-media.json`.

Require `sw.js` to list `actualidad-media.json` among live/network-first resources.

Require changes to `actualidad-media-sources.json`, `actualidad-media-editorial.json`, `scripts/actualidad-media-*.mjs`, and `scripts/sync-actualidad-media.mjs` to trigger the validation workflow.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
node --test test/actualidad-deployment.test.mjs test/actualidad-home-preview.test.mjs
```

Expected: FAIL on missing media sync/cache wiring.

- [ ] **Step 3: Update the dedicated Actualidad workflow**

On feature branches:

1. sync written Actualidad;
2. validate discovery sources;
3. sync Apps;
4. sync Multimedia;
5. run tests.

On `main`:

1. sync written Actualidad;
2. sync Apps;
3. sync Multimedia;
4. run tests;
5. detect all three generated JSON files;
6. commit changed generated files;
7. deploy when changed.

Preserve `concurrency: group: pages` and `cancel-in-progress: false`.

- [ ] **Step 4: Update general Pages workflow**

Keep the race-prevention order:

```text
Synchronize Actualidad
Synchronize Accessible apps
Synchronize Multimedia
Build video search index
Build with Jekyll
Deploy Pages
```

Do not move synchronization after Jekyll build.

- [ ] **Step 5: Update service worker**

Add `actualidad-media.json` to the same live-content/network-first path as `actualidad.json` and `actualidad-apps.json`. Bump the relevant cache version so deployed clients do not keep the previous JS/HTML shell indefinitely.

- [ ] **Step 6: Run deployment tests and full suite**

Run:

```bash
node --test test/actualidad-deployment.test.mjs test/actualidad-home-preview.test.mjs
npm test
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add .github/workflows/sync-actualidad.yml .github/workflows/jekyll-gh-pages.yml sw.js test/actualidad-deployment.test.mjs test/actualidad-home-preview.test.mjs
git commit -m "ci: deploy multimedia catalog safely"
```

---

### Task 6: Candidate-source validation without polluting production

**Files:**
- Create: `docs/actualidad-multimedia-candidates.md`
- Create: `scripts/validate-actualidad-media-candidate.mjs`
- Create: `test/actualidad-media-candidates.test.mjs`

**Interfaces:**
- CLI: `node scripts/validate-actualidad-media-candidate.mjs <candidate-id>`.
- Candidate validation reports: activity evidence, endpoint/feed/handle, latest dated item, parser strategy, automation status.
- It must not modify `actualidad-media-sources.json` automatically.

- [ ] **Step 1: Write failing tests for candidate validation**

Require the candidate inventory to contain the user-requested names:

```text
Actualidad Accesible
Comunidad Tiflotec
ACCYTEC
Android a Ciegas
JAWS con Windows
Juan Roca Suárez
Juanjo Montiel
La Manzana Azteca
Mi Android Accesible
Sin Ver Cómo
TifloDigitales
AliBlueBox
```

Also require La Manzana Azteca to be marked as `program-within-source` until a standalone stable feed/channel is verified.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `node --test test/actualidad-media-candidates.test.mjs`

Expected: FAIL because inventory/validator do not exist.

- [ ] **Step 3: Create the candidate inventory**

Document each candidate with fields:

```text
name
intendedSection
knownHomepageOrChannel
status: candidate | verified | rejected
reason
lastChecked
notes
```

Do not invent URLs. If a stable URL has not been verified, write `knownHomepageOrChannel: not verified` and keep `status: candidate`.

For La Manzana Azteca record that current evidence places it as a recurring capsule within Podcast Ilumina, therefore it is not activated as an independent source unless a standalone stable source is later found.

- [ ] **Step 4: Implement a non-mutating validator**

The script reads the candidate inventory and validates only candidates with a verified URL/handle. It prints a structured report but never edits production source configuration.

- [ ] **Step 5: Run tests and full suite**

Run:

```bash
node --test test/actualidad-media-candidates.test.mjs
npm test
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add docs/actualidad-multimedia-candidates.md scripts/validate-actualidad-media-candidate.mjs test/actualidad-media-candidates.test.mjs
git commit -m "docs: track multimedia source candidates"
```

---

## Final Verification

Before opening a PR:

- [ ] Run `node scripts/sync-actualidad.mjs` and confirm written Actualidad still synchronizes.
- [ ] Run `node scripts/sync-actualidad-apps.mjs` and confirm Apps still synchronizes.
- [ ] Run `YOUTUBE_API_KEY="$YOUTUBE_API_KEY" node scripts/sync-actualidad-media.mjs` and record item count plus source failures.
- [ ] Run `npm test` and require 0 failures.
- [ ] Compare branch vs `main` and confirm no Android/iOS native files changed.
- [ ] Confirm `videos.json` was not changed by Multimedia synchronization.
- [ ] Confirm no OneSignal/API push code changed in this branch.
- [ ] Confirm `actualidad-media.json` contains both `accessibility` and `technology` items before production merge; if technology source validation fails, do not pretend success—keep the source disabled, report it, and do not merge until the section behavior is tested with a verified technology fixture plus a real source path.
- [ ] Open a PR to `main`; do not merge until GitHub marks it mergeable and all validation workflows are green.

## Follow-on task kept separate

After this Multimedia PR is integrated, create a separate bounded task for automatic notifications of new TifloAcosta videos. That task will compare newly discovered YouTube IDs against the prior catalog, send one OneSignal push only for genuinely new videos, avoid notifying historical/backfilled items, deep-link to the matching video, and require the OneSignal REST API key to live only in GitHub Secrets.
