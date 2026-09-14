# Actualidad Multimedia Sections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir a Actualidad una sección «Escuchar y ver» accesible y automatizada, con separación inequívoca entre «Accesibilidad y tiflotecnología» y «Actualidad tecnológica», sin mezclar vídeos propios de TifloAcosta ni notificaciones push.

**Architecture:** Multimedia tendrá su propio registro de fuentes y su propio catálogo generado, `actualidad-media.json`. El sincronizador reutilizará el parser RSS/Atom existente cuando sea posible, tendrá adaptadores explícitos para HTML/YouTube cuando sea necesario y mantendrá la clasificación `accessibility`/`technology` como metadato autoritativo de la fuente. La interfaz solo renderiza esa clasificación; nunca la infiere a partir de títulos.

**Tech Stack:** Node.js 22, JavaScript ES modules, GitHub Actions, GitHub Pages/Jekyll, HTML semántico, JSON, fetch, YouTube Data API ya usada por el repositorio.

**Spec:** `docs/superpowers/specs/2026-09-14-actualidad-multimedia-sections-design.md`

## Global Constraints

- Mantener separados `actualidad.json`, `actualidad-apps.json`, `actualidad-media.json` y `videos.json`.
- No tocar ni fusionar `feature/mobile-native-integrations-work`.
- No enviar notificaciones push en esta fase.
- No autoplay.
- Toda pieza debe ofrecer una forma accesible de abrir la fuente original.
- `section` solo puede ser `accessibility` o `technology` y procede del registro de fuentes.
- La Manzana Mordida solo puede publicar en `technology`.
- Actualidad Accesible puede evaluarse como multimedia sin volver al feed escrito.
- Mostrar idioma original cuando se conozca.
- No afirmar traducción/doblaje/subtítulos si la fuente no lo ofrece.
- Audio directo solo si hay URL oficial estable; si no, abrir la fuente.
- YouTube usa embed oficial y enlace alternativo.
- Un fallo parcial no vacía Multimedia; un fallo total no publica un archivo vacío.
- Retención inicial: 90 días por fecha original real.
- Destacadas conserva su regla independiente de 5 días.
- `videos.json` no cambia en esta rama.

---

### Task 1: Contrato multimedia y registro inicial de fuentes

**Files:**
- Create: `actualidad-media-sources.json`
- Create: `scripts/actualidad-media-core.mjs`
- Create: `test/actualidad-media-core.test.mjs`

**Interfaces:**
- `normalizeMediaItem(raw, source)` → objeto normalizado o `null`.
- `dedupeMediaItems(items)` → array sin URLs canónicas duplicadas.
- `retainRecentMedia(items, now, maxAgeDays = 90)` → array retenido.

- [ ] **Step 1: Write failing core tests**

Create `test/actualidad-media-core.test.mjs`:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeMediaItem, dedupeMediaItems, retainRecentMedia } from '../scripts/actualidad-media-core.mjs';

const accessibility = {
  id: 'applevis-podcast',
  name: 'AppleVis Podcast',
  homepage: 'https://www.applevis.com/podcasts',
  section: 'accessibility',
  type: 'audio',
  lang: 'en'
};

test('normalization keeps the source section authoritative', () => {
  const item = normalizeMediaItem({
    id: 'a1',
    title: 'Accessible app demo',
    originalUrl: 'https://example.com/episode',
    publishedAt: '2026-09-10T10:00:00Z',
    mediaUrl: 'https://example.com/episode.mp3'
  }, accessibility);
  assert.equal(item.section, 'accessibility');
  assert.equal(item.type, 'audio');
  assert.equal(item.originalLanguage, 'en');
});

test('a technology source stays technology even when the title mentions accessibility', () => {
  const source = { ...accessibility, id: 'la-manzana-mordida', section: 'technology', type: 'video', lang: 'es' };
  const item = normalizeMediaItem({
    id: 'v1',
    title: 'Accesibilidad del nuevo iPhone',
    originalUrl: 'https://www.youtube.com/watch?v=abcdefghijk',
    publishedAt: '2026-09-12T10:00:00Z'
  }, source);
  assert.equal(item.section, 'technology');
});

test('canonical duplicate URLs collapse to one item', () => {
  const input = [
    { id: '1', originalUrl: 'https://example.com/watch?v=1&utm_source=x' },
    { id: '2', originalUrl: 'https://example.com/watch?v=1' }
  ];
  assert.equal(dedupeMediaItems(input).length, 1);
});

test('items older than ninety days are excluded', () => {
  const now = new Date('2026-09-14T12:00:00Z');
  const input = [
    { id: 'new', publishedAt: '2026-09-13T12:00:00Z' },
    { id: 'old', publishedAt: '2026-06-01T12:00:00Z' }
  ];
  assert.deepEqual(retainRecentMedia(input, now).map(item => item.id), ['new']);
});
```

- [ ] **Step 2: Verify RED**

Run: `node --test test/actualidad-media-core.test.mjs`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the core exactly**

Create `scripts/actualidad-media-core.mjs`:

```js
import { canonicalizeUrl } from './actualidad-feed.mjs';

export function normalizeMediaItem(raw, source) {
  const originalUrl = canonicalizeUrl(raw?.originalUrl || raw?.url || '');
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
  return items.filter(item => {
    const key = canonicalizeUrl(item.originalUrl || '') || String(item.id || '');
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function retainRecentMedia(items = [], now = new Date(), maxAgeDays = 90) {
  const maxAge = maxAgeDays * 86400000;
  return items.filter(item => {
    const published = new Date(item.publishedAt);
    const age = now - published;
    return !Number.isNaN(published.getTime()) && age >= 0 && age <= maxAge;
  });
}
```

- [ ] **Step 4: Create the initial production source registry**

Create `actualidad-media-sources.json`:

```json
[
  {
    "id": "applevis-podcast",
    "name": "AppleVis Podcast",
    "homepage": "https://www.applevis.com/podcasts",
    "endpoint": "https://www.applevis.com/feed/podcasts",
    "section": "accessibility",
    "type": "audio",
    "lang": "en",
    "adapter": "feed",
    "enabled": true,
    "maxItems": 8
  },
  {
    "id": "double-tap",
    "name": "Double Tap",
    "homepage": "https://doubletaponair.com/",
    "endpoint": "https://www.doubletaponair.com/podcast",
    "section": "accessibility",
    "type": "audio",
    "lang": "en",
    "adapter": "feed",
    "enabled": true,
    "maxItems": 8
  },
  {
    "id": "tifloaudio",
    "name": "Tiflo Audio",
    "homepage": "https://www.tifloaudio.com/",
    "endpoint": "https://www.tifloaudio.com/",
    "section": "accessibility",
    "type": "audio",
    "lang": "es",
    "adapter": "tifloaudio-html",
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

The YouTube adapter must reject the source if `channels.list(forHandle=@LaManzanaMordida)` returns no channel. It must never auto-select a similarly named channel.

- [ ] **Step 5: Run tests**

Run:

```bash
node --test test/actualidad-media-core.test.mjs
npm test
```

Expected: focused tests and full suite pass.

- [ ] **Step 6: Commit**

```bash
git add actualidad-media-sources.json scripts/actualidad-media-core.mjs test/actualidad-media-core.test.mjs
git commit -m "feat: define multimedia source contract"
```

---

### Task 2: Feed, Tiflo Audio and YouTube adapters plus resilient sync

**Files:**
- Create: `scripts/actualidad-media-adapters.mjs`
- Create: `scripts/sync-actualidad-media.mjs`
- Create: `test/actualidad-media-sync.test.mjs`

**Interfaces:**
- `fetchMediaSource(source, fetchImpl = fetch, env = process.env)` → raw entries.
- `buildMediaCatalog({ sources, fetchImpl, env, now })` → `{ items, failures }`.

- [ ] **Step 1: Write failing adapter/sync tests with concrete fixtures**

Create `test/actualidad-media-sync.test.mjs`:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { parseTifloAudioHtml, youtubeEntriesFromApi } from '../scripts/actualidad-media-adapters.mjs';
import { buildMediaCatalog } from '../scripts/sync-actualidad-media.mjs';

test('Tiflo Audio HTML yields dated episodes and an official MP3 when present', () => {
  const html = `<article>
    <h2><a href="https://www.tifloaudio.com/tiflo-audio-232/">Tiflo Audio 232</a></h2>
    <time datetime="2026-08-03T10:00:00+00:00">3 agosto 2026</time>
    <p>Resumen del episodio.</p>
    <a href="https://www.tifloaudio.com/audio/tiflo232.mp3">Descargar</a>
  </article>`;
  assert.deepEqual(parseTifloAudioHtml(html), [{
    title: 'Tiflo Audio 232',
    originalUrl: 'https://www.tifloaudio.com/tiflo-audio-232/',
    publishedAt: '2026-08-03T10:00:00+00:00',
    summary: 'Resumen del episodio.',
    mediaUrl: 'https://www.tifloaudio.com/audio/tiflo232.mp3'
  }]);
});

test('YouTube API conversion builds official source and embed URLs', () => {
  const page = { items: [{
    contentDetails: { videoId: 'abcdefghijk', videoPublishedAt: '2026-09-12T10:00:00Z' },
    snippet: { title: 'Noticias Apple', description: 'Resumen' }
  }] };
  assert.deepEqual(youtubeEntriesFromApi(page), [{
    title: 'Noticias Apple',
    summary: 'Resumen',
    publishedAt: '2026-09-12T10:00:00Z',
    originalUrl: 'https://www.youtube.com/watch?v=abcdefghijk',
    embedUrl: 'https://www.youtube.com/embed/abcdefghijk',
    platform: 'youtube'
  }]);
});

test('one failed source keeps valid media from another source', async () => {
  const sources = [
    { id: 'bad', name: 'Bad', homepage: 'https://bad.example/', endpoint: 'https://bad.example/feed', section: 'accessibility', type: 'audio', lang: 'es', adapter: 'feed', enabled: true, maxItems: 5 },
    { id: 'good', name: 'Good', homepage: 'https://good.example/', endpoint: 'https://good.example/feed', section: 'accessibility', type: 'audio', lang: 'es', adapter: 'feed', enabled: true, maxItems: 5 }
  ];
  const fetchImpl = async url => {
    if (String(url).includes('bad.example')) throw new Error('offline');
    return { ok: true, text: async () => `<?xml version="1.0"?><rss><channel><item><title>Episodio válido</title><link>https://good.example/e1</link><pubDate>Sat, 12 Sep 2026 10:00:00 GMT</pubDate><description>Resumen</description></item></channel></rss>` };
  };
  const result = await buildMediaCatalog({ sources, fetchImpl, env: {}, now: new Date('2026-09-14T12:00:00Z') });
  assert.equal(result.items.length, 1);
  assert.deepEqual(result.failures.map(item => item.sourceId), ['bad']);
});

test('all enabled sources failing rejects', async () => {
  const sources = [{ id: 'bad', name: 'Bad', homepage: 'https://bad.example/', endpoint: 'https://bad.example/feed', section: 'accessibility', type: 'audio', lang: 'es', adapter: 'feed', enabled: true, maxItems: 5 }];
  await assert.rejects(() => buildMediaCatalog({ sources, fetchImpl: async () => { throw new Error('offline'); }, env: {}, now: new Date('2026-09-14T12:00:00Z') }), /All multimedia sources failed/);
});
```

- [ ] **Step 2: Verify RED**

Run: `node --test test/actualidad-media-sync.test.mjs`

Expected: FAIL because adapters/synchronizer do not exist.

- [ ] **Step 3: Implement adapters using existing feed parser where possible**

Create `scripts/actualidad-media-adapters.mjs`:

```js
import { parseFeedXml } from './actualidad-feed.mjs';

const text = value => String(value || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

export function parseTifloAudioHtml(html) {
  const articles = [...String(html || '').matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/gi)].map(match => match[1]);
  return articles.map(article => {
    const heading = article.match(/<h[23]\b[^>]*>[\s\S]*?<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/h[23]>/i);
    const publishedAt = article.match(/<time\b[^>]*datetime=["']([^"']+)["']/i)?.[1] || '';
    const summary = text(article.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i)?.[1] || '');
    const mediaUrl = article.match(/href=["'](https?:\/\/[^"']+\.mp3(?:\?[^"']*)?)["']/i)?.[1] || '';
    if (!heading || !publishedAt) return null;
    return { title: text(heading[2]), originalUrl: heading[1], publishedAt, summary, mediaUrl };
  }).filter(Boolean);
}

export function youtubeEntriesFromApi(page) {
  return (page?.items || []).map(item => {
    const id = item?.contentDetails?.videoId;
    const title = String(item?.snippet?.title || '').trim();
    if (!id || !title || /^(deleted video|private video)$/i.test(title)) return null;
    return {
      title,
      summary: String(item?.snippet?.description || '').trim(),
      publishedAt: item?.contentDetails?.videoPublishedAt || item?.snippet?.publishedAt || '',
      originalUrl: `https://www.youtube.com/watch?v=${id}`,
      embedUrl: `https://www.youtube.com/embed/${id}`,
      platform: 'youtube'
    };
  }).filter(Boolean);
}

export function feedEntries(xml) {
  return parseFeedXml(xml).map(item => ({
    title: item.title,
    originalUrl: item.url,
    publishedAt: item.publishedAt,
    summary: item.summary,
    platform: 'podcast'
  }));
}
```

- [ ] **Step 4: Implement `fetchMediaSource` and `buildMediaCatalog`**

Create `scripts/sync-actualidad-media.mjs` with these rules in code:

```js
import fs from 'node:fs';
import { feedEntries, parseTifloAudioHtml, youtubeEntriesFromApi } from './actualidad-media-adapters.mjs';
import { normalizeMediaItem, dedupeMediaItems, retainRecentMedia } from './actualidad-media-core.mjs';

async function getText(url, fetchImpl) {
  const response = await fetchImpl(url);
  if (!response.ok) throw new Error(`HTTP ${response.status || 'error'} for ${url}`);
  return response.text();
}

export async function fetchMediaSource(source, fetchImpl = fetch, env = process.env) {
  if (source.adapter === 'feed') return feedEntries(await getText(source.endpoint, fetchImpl));
  if (source.adapter === 'tifloaudio-html') return parseTifloAudioHtml(await getText(source.endpoint, fetchImpl));
  if (source.adapter !== 'youtube-handle') throw new Error(`Unknown multimedia adapter: ${source.adapter}`);
  if (!env.YOUTUBE_API_KEY) throw new Error('YOUTUBE_API_KEY is required for YouTube multimedia sources');

  const channelUrl = new URL('https://www.googleapis.com/youtube/v3/channels');
  channelUrl.searchParams.set('part', 'contentDetails');
  channelUrl.searchParams.set('forHandle', source.youtubeHandle);
  channelUrl.searchParams.set('key', env.YOUTUBE_API_KEY);
  const channelResponse = await fetchImpl(channelUrl);
  if (!channelResponse.ok) throw new Error(`YouTube channels API ${channelResponse.status}`);
  const channel = await channelResponse.json();
  const uploads = channel.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploads) throw new Error(`No YouTube channel resolved for ${source.youtubeHandle}`);

  const playlistUrl = new URL('https://www.googleapis.com/youtube/v3/playlistItems');
  playlistUrl.searchParams.set('part', 'snippet,contentDetails');
  playlistUrl.searchParams.set('playlistId', uploads);
  playlistUrl.searchParams.set('maxResults', String(Math.min(source.maxItems || 8, 50)));
  playlistUrl.searchParams.set('key', env.YOUTUBE_API_KEY);
  const playlistResponse = await fetchImpl(playlistUrl);
  if (!playlistResponse.ok) throw new Error(`YouTube playlist API ${playlistResponse.status}`);
  return youtubeEntriesFromApi(await playlistResponse.json());
}

export async function buildMediaCatalog({ sources, fetchImpl = fetch, env = process.env, now = new Date() }) {
  const enabled = sources.filter(source => source.enabled);
  const settled = await Promise.allSettled(enabled.map(async source => ({ source, entries: await fetchMediaSource(source, fetchImpl, env) })));
  const failures = [];
  const normalized = [];
  settled.forEach((result, index) => {
    const source = enabled[index];
    if (result.status === 'rejected') {
      failures.push({ sourceId: source.id, error: String(result.reason?.message || result.reason) });
      return;
    }
    for (const raw of result.value.entries.slice(0, source.maxItems || 8)) {
      const item = normalizeMediaItem(raw, source);
      if (item) normalized.push(item);
    }
  });
  if (enabled.length && failures.length === enabled.length) throw new Error('All multimedia sources failed');
  const items = retainRecentMedia(dedupeMediaItems(normalized), now)
    .sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)) || String(a.id).localeCompare(String(b.id)));
  return { items, failures };
}
```

Add CLI code that reads `actualidad-media-sources.json`, calls `buildMediaCatalog`, compares serialized output to existing `actualidad-media.json`, writes only on change, logs `Actualidad media: N. Changed: yes/no.`, and prints individual failures to stderr without exiting nonzero when at least one source succeeded.

- [ ] **Step 5: Run tests and real synchronization**

Run:

```bash
node --test test/actualidad-media-sync.test.mjs
YOUTUBE_API_KEY="$YOUTUBE_API_KEY" node scripts/sync-actualidad-media.mjs
npm test
```

Expected: focused tests pass; real sync produces at least one accessibility item and one technology item; full suite has zero failures. If `@LaManzanaMordida` does not resolve, set only that source to `enabled: false`, record the failure in the branch summary, and do not merge until a real technology source is validated.

- [ ] **Step 6: Commit**

```bash
git add scripts/actualidad-media-adapters.mjs scripts/sync-actualidad-media.mjs test/actualidad-media-sync.test.mjs actualidad-media-sources.json
git commit -m "feat: synchronize multimedia sources"
```

---

### Task 3: Accessible «Escuchar y ver» surface

**Files:**
- Modify: `actualidad.html`
- Modify: `actualidad.js`
- Create: `test/actualidad-multimedia-surface.test.mjs`

- [ ] **Step 1: Write failing semantic tests**

Create tests requiring:

```js
const html = await read('actualidad.html');
const js = await read('actualidad.js');
assert.match(html, /href="#media-browser"/);
assert.match(html, /<section[^>]*id="media-browser"/);
assert.match(html, /id="media-heading"/);
assert.match(html, /id="media-accessibility-heading"/);
assert.match(html, /id="media-technology-heading"/);
assert.match(html, /id="media-accessibility-list"/);
assert.match(html, /id="media-technology-list"/);
assert.match(html, /id="media-status"[^>]*aria-live="polite"/);
assert.match(js, /fetch\(['"]actualidad-media\.json['"]/);
assert.match(js, /item\.section === ['"]accessibility['"]/);
assert.match(js, /item\.section === ['"]technology['"]/);
assert.doesNotMatch(js, /autoplay/);
```

Also assert Spanish/English explanatory copy says technology-general sources are not specialized in accessibility.

- [ ] **Step 2: Verify RED**

Run: `node --test test/actualidad-multimedia-surface.test.mjs`

Expected: FAIL because Multimedia surface is absent.

- [ ] **Step 3: Add semantic HTML**

Add to the existing section navigation a link to `#media-browser`. Add H2 `#media-heading`, H3 `#media-accessibility-heading`, H3 `#media-technology-heading`, two lists and `#media-status` with `aria-live="polite"`. Keep Noticias and Apps unchanged.

- [ ] **Step 4: Add bilingual rendering code**

In `actualidad.js` add:

```js
let mediaItems = [];
const mediaFor = section => mediaItems.filter(item => item.section === section);
```

Fetch `actualidad-media.json` once. Render title, source, date, explicit original-language label, summary when present and source link. Use localized labels only for interface chrome; do not claim the underlying media is translated.

- [ ] **Step 5: Add explicit playback behavior**

For audio, create `<audio controls preload="none">` only after the user activates the play control and set `src` from `mediaUrl`. For YouTube, create the iframe only after activation using `embedUrl`; provide a close button and restore focus to the triggering control. Always keep `originalUrl` available as «Abrir en la fuente» / «Open at source».

- [ ] **Step 6: Run tests**

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

### Task 4: Editorial localization without corrupting source metadata

**Files:**
- Create: `actualidad-media-editorial.json`
- Modify: `scripts/sync-actualidad-media.mjs`
- Modify: `test/actualidad-media-sync.test.mjs`

- [ ] **Step 1: Add failing tests**

Add concrete records showing that an editorial overlay may change localized title/summary and `featuredRank`, but may not change `section`, `sourceId`, `originalUrl`, `publishedAt` or `originalLanguage`. Add a withheld record test that removes the item from output.

Use this fixture shape:

```js
const editorial = [{
  id: 'source-1',
  state: 'adapted',
  locales: {
    es: { title: 'Título natural en español', summary: 'Resumen natural.' },
    en: { title: 'Natural English title', summary: 'Natural summary.' }
  },
  featuredRank: 2,
  section: 'accessibility',
  publishedAt: '2000-01-01T00:00:00Z'
}];
```

Expected after merge: localized fields/rank are applied, but the original source `section` and date remain unchanged.

- [ ] **Step 2: Verify RED**

Run: `node --test test/actualidad-media-sync.test.mjs`

Expected: FAIL on missing editorial merge.

- [ ] **Step 3: Implement `mergeMediaEditorial(items, records)`**

Match by stable `id` first, then canonical `originalUrl`. Copy only `state`, `locales`, `featuredRank` and `withheld`. Never copy source metadata fields from editorial records. Exclude `withheld` before writing the generated catalog.

Create `actualidad-media-editorial.json` as an empty JSON array.

- [ ] **Step 4: Add source diversity ordering**

When building default lists, do not emit more than two consecutive items from one source when an alternative source remains available. Preserve recency otherwise.

- [ ] **Step 5: Run tests and commit**

Run:

```bash
node --test test/actualidad-media-sync.test.mjs
npm test
```

Then:

```bash
git add actualidad-media-editorial.json scripts/sync-actualidad-media.mjs test/actualidad-media-sync.test.mjs
git commit -m "feat: add multimedia editorial controls"
```

---

### Task 5: Deployment and live-cache wiring

**Files:**
- Modify: `.github/workflows/sync-actualidad.yml`
- Modify: `.github/workflows/jekyll-gh-pages.yml`
- Modify: `sw.js`
- Modify: `test/actualidad-deployment.test.mjs`
- Modify: `test/actualidad-home-preview.test.mjs` if needed for existing service-worker assertions.

- [ ] **Step 1: Write failing deployment tests**

Require both workflows to contain `node scripts/sync-actualidad-media.mjs`. Require the dedicated workflow to detect/commit `actualidad-media.json`. Require these paths to trigger validation: `actualidad-media-sources.json`, `actualidad-media-editorial.json`, `scripts/actualidad-media-*.mjs`, `scripts/sync-actualidad-media.mjs`. Require `sw.js` to treat `actualidad-media.json` as live network-first content.

- [ ] **Step 2: Verify RED**

Run:

```bash
node --test test/actualidad-deployment.test.mjs test/actualidad-home-preview.test.mjs
```

Expected: FAIL on missing media wiring.

- [ ] **Step 3: Update dedicated Actualidad workflow**

Feature branches run, in order: written Actualidad sync → discovery validation → Apps sync → Multimedia sync → tests.

`main` runs: written Actualidad sync → Apps sync → Multimedia sync → tests → detect `actualidad.json actualidad-apps.json actualidad-media.json` → commit changed generated files → deploy.

- [ ] **Step 4: Update general Pages workflow**

Preserve this order before Jekyll build:

```text
Synchronize Actualidad
Synchronize Accessible apps
Synchronize Multimedia
Build video search index
Build with Jekyll
```

- [ ] **Step 5: Update service worker and cache version**

Add `actualidad-media.json` to the same live-content/network-first policy as the other Actualidad catalogs and bump the shell cache version so clients receive the new HTML/JS.

- [ ] **Step 6: Run tests and commit**

Run:

```bash
node --test test/actualidad-deployment.test.mjs test/actualidad-home-preview.test.mjs
npm test
```

Then:

```bash
git add .github/workflows/sync-actualidad.yml .github/workflows/jekyll-gh-pages.yml sw.js test/actualidad-deployment.test.mjs test/actualidad-home-preview.test.mjs
git commit -m "ci: deploy multimedia catalog safely"
```

---

### Task 6: Candidate inventory for the additional channels

**Files:**
- Create: `docs/actualidad-multimedia-candidates.md`
- Create: `test/actualidad-media-candidates.test.mjs`

- [ ] **Step 1: Write failing inventory test**

The test must read the candidate document and assert it contains these exact names:

```js
const names = [
  'Actualidad Accesible',
  'Comunidad Tiflotec',
  'ACCYTEC',
  'Android a Ciegas',
  'JAWS con Windows',
  'Juan Roca Suárez',
  'Juanjo Montiel',
  'La Manzana Azteca',
  'Mi Android Accesible',
  'Sin Ver Cómo',
  'TifloDigitales',
  'AliBlueBox'
];
for (const name of names) assert.match(text, new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
assert.match(text, /La Manzana Azteca[\s\S]*program-within-source/);
```

- [ ] **Step 2: Verify RED**

Run: `node --test test/actualidad-media-candidates.test.mjs`

Expected: FAIL because the inventory does not exist.

- [ ] **Step 3: Create the inventory with explicit status rules**

For every candidate use:

```text
Name:
Intended section: accessibility | technology
Known source: <verified URL> | not verified
Status: candidate | verified | rejected
Automation: feed | youtube-handle | html | manual-review | not verified
Last checked: 2026-09-14
Notes:
```

Do not invent a URL. `not verified` is the required value until a stable source is confirmed.

For La Manzana Azteca use:

```text
Name: La Manzana Azteca
Intended section: accessibility
Known source: Podcast Ilumina
Status: candidate
Automation: program-within-source
Last checked: 2026-09-14
Notes: Tratar como cápsula recurrente dentro de Podcast Ilumina; no activarla como fuente independiente mientras no exista un canal/feed propio estable.
```

- [ ] **Step 4: Run test and commit**

Run:

```bash
node --test test/actualidad-media-candidates.test.mjs
npm test
```

Then:

```bash
git add docs/actualidad-multimedia-candidates.md test/actualidad-media-candidates.test.mjs
git commit -m "docs: track multimedia source candidates"
```

---

## Final Verification

Before opening a PR:

- [ ] Run `node scripts/sync-actualidad.mjs`.
- [ ] Run `node scripts/sync-actualidad-apps.mjs`.
- [ ] Run `YOUTUBE_API_KEY="$YOUTUBE_API_KEY" node scripts/sync-actualidad-media.mjs`.
- [ ] Require real `actualidad-media.json` to contain at least one `accessibility` and one `technology` item.
- [ ] Run `npm test` and require zero failures.
- [ ] Compare branch vs `main`; require zero Android/iOS native-file changes.
- [ ] Confirm `videos.json` unchanged.
- [ ] Confirm no OneSignal/push files changed.
- [ ] Open a PR to `main`; do not merge until GitHub reports it mergeable and branch validation is green.

## Follow-on task kept separate

After Multimedia is integrated, create a separate bounded task for automatic notifications of genuinely new TifloAcosta videos. It will compare new YouTube IDs with the previous catalog, send one OneSignal push only for new uploads, avoid historical/backfill notifications, deep-link to the matching video, and keep the OneSignal REST API key only in GitHub Secrets.
