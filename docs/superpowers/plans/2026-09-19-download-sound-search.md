# Download Sound Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir «Descargas» en un centro con dos herramientas —descarga desde enlace y búsqueda accesible de sonidos— empezando por búsqueda interna de Freesound y accesos organizados a Mixkit y Pixabay.

**Architecture:** Mantener la herramienta de enlaces aislada y estable, añadir un centro de navegación de Descargas y crear un módulo independiente de búsqueda de sonidos. Reutilizar el Worker existente de `download.tifloacosta.com` con una ruta nueva `/sounds/search`; la clave de Freesound vive solo como secreto del Worker y el frontend recibe resultados ya normalizados.

**Tech Stack:** HTML semántico, CSS existente de TifloAcosta, JavaScript sin framework, Node.js `node:test`, Cloudflare Workers/Wrangler, Freesound API v2.

**Spec:** `docs/superpowers/specs/2026-09-19-download-sound-search-design.md`

## Global Constraints

- La herramienta actual «Descargar desde un enlace» debe seguir funcionando sin regresiones.
- La interfaz será bilingüe español/inglés desde la primera versión.
- No se almacenarán sonidos de terceros en servidores de TifloAcosta.
- No se expondrán claves API ni credenciales en el frontend.
- No se implementará OAuth2 de Freesound en esta primera versión.
- Las preescuchas nunca se reproducirán automáticamente.
- Los cambios de filtros no moverán el foco inesperadamente.
- Siempre habrá un camino explícito de regreso al centro de Descargas.
- Los enlaces externos web usarán `target="_blank"` y `rel="noopener noreferrer"`.
- La búsqueda debe funcionar por texto, por categoría o combinando ambos; al menos uno de los dos es obligatorio.
- Los fallos parciales de un proveedor no deben ocultar resultados válidos de otros proveedores.
- La primera entrega se valida en web antes de trasladarla a Android.

## Review Focus

- Búsqueda vacía: si no hay término ni categoría, no se llama al backend y se anuncia una instrucción clara.
- Datos incompletos del proveedor: un resultado sin tamaño, formato, licencia o preview no debe romper el render ni inventar información.
- Audio sucesivo: reproducir un segundo sonido debe detener el anterior; nunca deben sonar dos preescuchas a la vez.
- Secreto ausente o proveedor caído: Freesound debe devolver un error recuperable y la vista debe conservar los accesos a otros bancos.
- Navegación profunda: entrar directamente en `#downloads-link` o `#downloads-sounds` debe mostrar la vista correcta y conservar un regreso predecible.

---

## File Structure

**Create**
- `downloads-hub.js` — navegación entre el centro, descarga por enlace y búsqueda de sonidos.
- `sound-search-core.js` — categorías, validación, normalización y utilidades puras de resultados.
- `sound-search.js` — interfaz accesible, búsqueda, filtros, preescucha y enlaces externos.
- `sound-search-config.js` — endpoint público del backend y catálogo de bancos externos.
- `test/downloads-hub.test.mjs` — estructura, hashes y regresión de navegación.
- `test/sound-search-core.test.mjs` — lógica pura y casos límite.
- `test/sound-search-ui.test.mjs` — estructura accesible y gestión de audio.
- `download-worker/src/sounds.js` — consulta de Freesound y normalización de su respuesta.
- `download-worker/test/sounds.test.mjs` — pruebas del adaptador y errores.

**Modify**
- `index.html` — carga explícita de los assets de Descargas y de sonidos.
- `downloads.js` — deja de ser la vista raíz `#downloads` y pasa a `#downloads-link`; regreso al centro.
- `downloads.css` — estilos reutilizables para centro, filtros y resultados de sonido.
- `download-config.js` — conserva `/analyze`; no mezclará configuración de sonido.
- `download-worker/src/index.js` — enruta `/analyze` y `/sounds/search`.
- `download-worker/wrangler.toml` — declara el binding secreto solo por nombre/documentación, nunca valor.
- `.github/workflows/deploy-download-worker.yml` — instala/actualiza el secreto desde GitHub Actions y añade smoke test de la ruta de sonidos cuando exista el secreto.
- `sw.js` — cachea los nuevos assets estáticos y sube la versión del cache.
- `test/downloads-ui.test.mjs` — actualiza expectativa del hash/regreso sin perder pruebas del analizador.

---

### Task 1: Convertir Descargas en un centro sin romper la herramienta actual

**Files:**
- Create: `downloads-hub.js`
- Create: `test/downloads-hub.test.mjs`
- Modify: `downloads.js`
- Modify: `index.html`
- Modify: `downloads.css`
- Modify: `test/downloads-ui.test.mjs`

**Interfaces:**
- Consumes: hashes actuales y `window.location.hash`.
- Produces: rutas `#downloads`, `#downloads-link`, `#downloads-sounds` y botones con ids `downloads-open-link` y `downloads-open-sounds`.

- [ ] **Step 1: Write the failing navigation test**

```js
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = file => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

test('Downloads exposes a hub and two stable child routes', async () => {
  const hub = await read('downloads-hub.js').catch(() => '');
  const downloads = await read('downloads.js');
  assert.match(hub, /#downloads-link/);
  assert.match(hub, /#downloads-sounds/);
  assert.match(hub, /downloads-open-link/);
  assert.match(hub, /downloads-open-sounds/);
  assert.match(downloads, /downloads-link/);
});

test('index explicitly loads all download assets once', async () => {
  const html = await read('index.html');
  for (const asset of ['downloads.css','downloads-core.js','download-config.js','downloads-hub.js','downloads.js']) {
    assert.equal((html.match(new RegExp(asset.replace('.', '\\.'), 'g')) || []).length, 1, asset);
  }
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `node --test test/downloads-hub.test.mjs test/downloads-ui.test.mjs`

Expected: FAIL because `downloads-hub.js` does not exist and `downloads.js` still treats `#downloads` as the tool itself.

- [ ] **Step 3: Implement the minimal hub**

`downloads-hub.js` must build one semantic section and no duplicate launcher:

```js
(() => {
  'use strict';
  const copy = {
    es: { launcher:'Descargas', heading:'Descargas', intro:'Elige qué quieres hacer.', link:'Descargar desde un enlace', sounds:'Buscar sonidos', back:'Volver al inicio' },
    en: { launcher:'Downloads', heading:'Downloads', intro:'Choose what you want to do.', link:'Download from a link', sounds:'Search sounds', back:'Back to home' }
  };
  const lang = () => document.documentElement.lang === 'en' ? 'en' : 'es';
  const text = () => copy[lang()];

  function route(target) { window.location.hash = target; }

  function build() {
    const nav = document.querySelector('#home-blocks .resource-actions');
    const main = document.getElementById('main');
    if (!nav || !main || document.getElementById('downloads-hub')) return;

    const launcher = document.createElement('button');
    launcher.id = 'home-open-downloads';
    launcher.type = 'button';
    launcher.className = 'button-link';
    launcher.textContent = text().launcher;
    launcher.addEventListener('click', () => route('#downloads'));
    nav.insertBefore(launcher, document.getElementById('home-open-videos'));

    const section = document.createElement('section');
    section.id = 'downloads-hub';
    section.hidden = true;
    section.tabIndex = -1;
    section.innerHTML = `<p><button type="button" class="button-link back-link" data-downloads-home></button></p><h2 id="downloads-hub-heading"></h2><p id="downloads-hub-intro"></p><div class="resource-actions"><button type="button" class="button-link" id="downloads-open-link"></button><button type="button" class="button-link" id="downloads-open-sounds"></button></div>`;
    main.append(section);
    section.querySelector('[data-downloads-home]').addEventListener('click', () => route('#home'));
    section.querySelector('#downloads-open-link').addEventListener('click', () => route('#downloads-link'));
    section.querySelector('#downloads-open-sounds').addEventListener('click', () => route('#downloads-sounds'));
  }
})();
```

Complete the module with `localize()` and `applyVisibility()` following the existing `downloads.js` pattern; `#downloads` shows the hub, child routes hide it, and each child view owns its own focus.

In `downloads.js`:
- change its active route from `downloads` to `downloads-link`;
- change both interior back buttons to route to `#downloads`;
- remove creation of the `home-open-downloads` launcher because the hub owns it.

In `index.html`, add once:

```html
<link rel="stylesheet" href="downloads.css?v=1.1">
<script src="downloads-core.js?v=1.1"></script>
<script src="download-config.js?v=1.1"></script>
<script src="downloads-hub.js?v=1.0"></script>
<script src="downloads.js?v=1.1"></script>
```

Place scripts after `app.js` and before analytics so `#main` and the language controls already exist.

- [ ] **Step 4: Run navigation and full app tests**

Run: `node --test test/downloads-hub.test.mjs test/downloads-ui.test.mjs && npm test`

Expected: all tests PASS and the previous 403/tamaño tests remain green.

- [ ] **Step 5: Commit**

```bash
git add index.html downloads-hub.js downloads.js downloads.css test/downloads-hub.test.mjs test/downloads-ui.test.mjs
git commit -m "feat: convertir Descargas en centro de herramientas"
```

---

### Task 2: Crear el núcleo común de búsqueda de sonidos

**Files:**
- Create: `sound-search-core.js`
- Create: `test/sound-search-core.test.mjs`

**Interfaces:**
- Produces: `window.TIFLO_SOUND_CORE` with `categories`, `validateSearch`, `buildProviderQuery`, `normalizeResult`, `mergeResults`, `formatDuration`.
- Consumed by: Task 4 UI and Task 3 provider contract tests.

- [ ] **Step 1: Write failing core tests**

```js
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function loadCore() {
  const source = await readFile(new URL('../sound-search-core.js', import.meta.url), 'utf8');
  const context = { window:{} };
  vm.createContext(context);
  vm.runInContext(source, context);
  return context.window.TIFLO_SOUND_CORE;
}

test('requires a term or category but allows either one', async () => {
  const core = await loadCore();
  assert.equal(core.validateSearch('', '').ok, false);
  assert.equal(core.validateSearch('campana', '').ok, true);
  assert.equal(core.validateSearch('', 'notifications').ok, true);
});

test('combines term and category for Freesound', async () => {
  const core = await loadCore();
  assert.equal(core.buildProviderQuery('campana', 'notifications'), 'campana notification alert');
});

test('normalization never invents missing metadata', async () => {
  const core = await loadCore();
  const item = core.normalizeResult({ id:1, name:'Bell' }, 'freesound');
  assert.equal(item.size, null);
  assert.equal(item.format, null);
  assert.equal(item.license, null);
  assert.equal(item.previewUrl, null);
});
```

Add Review Focus coverage in the same file for duplicate provider/id pairs and malformed/non-array result lists.

- [ ] **Step 2: Run and verify failure**

Run: `node --test test/sound-search-core.test.mjs`

Expected: FAIL because `sound-search-core.js` does not exist.

- [ ] **Step 3: Implement the pure core**

Use this exact category map as the v1 contract:

```js
const categories = Object.freeze({
  ringtones: { es:'Tonos de llamada', en:'Ringtones', query:'ringtone phone ring' },
  notifications: { es:'Notificaciones', en:'Notifications', query:'notification alert' },
  alarms: { es:'Alarmas', en:'Alarms', query:'alarm warning' },
  phones: { es:'Teléfonos', en:'Phones', query:'telephone phone' },
  technology: { es:'Tecnología', en:'Technology', query:'technology computer digital' },
  nature: { es:'Naturaleza', en:'Nature', query:'nature ambient' },
  animals: { es:'Animales', en:'Animals', query:'animal' },
  ambience: { es:'Ambiente', en:'Ambience', query:'ambience atmosphere' },
  funny: { es:'Divertidos', en:'Funny', query:'funny cartoon' },
  games: { es:'Juegos', en:'Games', query:'game arcade' }
});

function validateSearch(term, category) {
  const q = String(term || '').trim();
  const c = String(category || '').trim();
  return { ok: Boolean(q || categories[c]), term:q, category:categories[c] ? c : '' };
}

function buildProviderQuery(term, category) {
  const valid = validateSearch(term, category);
  if (!valid.ok) return '';
  return [valid.term, valid.category ? categories[valid.category].query : ''].filter(Boolean).join(' ');
}
```

`normalizeResult(raw, provider)` returns exactly:

```js
{
  id: raw.id == null ? '' : String(raw.id),
  name: String(raw.name || '').trim() || 'Sound',
  provider,
  pageUrl: raw.pageUrl || null,
  previewUrl: raw.previewUrl || null,
  downloadUrl: raw.downloadUrl || null,
  duration: Number.isFinite(Number(raw.duration)) ? Number(raw.duration) : null,
  format: raw.format || null,
  size: Number.isFinite(Number(raw.size)) ? Number(raw.size) : null,
  license: raw.license || null,
  author: raw.author || null,
  tags: Array.isArray(raw.tags) ? raw.tags.map(String) : []
}
```

`mergeResults(groups, limit = 20)` flattens successful arrays, removes duplicates by `${provider}:${id}`, preserves provider order, and returns at most 20.

- [ ] **Step 4: Run tests**

Run: `node --test test/sound-search-core.test.mjs && npm test`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add sound-search-core.js test/sound-search-core.test.mjs
git commit -m "feat: añadir núcleo de búsqueda de sonidos"
```

---

### Task 3: Añadir búsqueda Freesound al Worker existente

**Files:**
- Create: `download-worker/src/sounds.js`
- Create: `download-worker/test/sounds.test.mjs`
- Modify: `download-worker/src/index.js`
- Modify: `.github/workflows/deploy-download-worker.yml`
- Modify: `download-worker/wrangler.toml`

**Interfaces:**
- Consumes: `env.FREESOUND_API_KEY`.
- HTTP input: `POST /sounds/search` body `{ "query": string, "category": string, "page": number }`.
- HTTP output success: `{ "status":"ok", "provider":"freesound", "items": SoundResult[], "count": number }`.
- HTTP output recoverable error: `{ "status":"error", "code":"provider_unavailable"|"invalid_search", "message": string }`.

- [ ] **Step 1: Write failing Worker tests**

Create `download-worker/test/sounds.test.mjs` with a fake upstream fetch:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { searchFreesound } from '../src/sounds.js';

test('maps Freesound fields to the public sound contract', async () => {
  const fakeFetch = async () => new Response(JSON.stringify({ count:1, results:[{
    id:42, name:'Bell.wav', username:'ana', license:'Creative Commons 0',
    duration:1.25, type:'wav', filesize:123456, tags:['bell'],
    previews:{ 'preview-hq-mp3':'https://cdn.example/bell.mp3' }
  }] }), { status:200, headers:{'content-type':'application/json'} });

  const result = await searchFreesound({ query:'bell', category:'notifications', page:1 }, { FREESOUND_API_KEY:'secret' }, fakeFetch);
  assert.equal(result.status, 'ok');
  assert.equal(result.items[0].previewUrl, 'https://cdn.example/bell.mp3');
  assert.equal(result.items[0].size, 123456);
  assert.equal(result.items[0].pageUrl, 'https://freesound.org/s/42/');
  assert.equal(result.items[0].downloadUrl, null);
});

test('missing API key is recoverable and never leaked', async () => {
  const result = await searchFreesound({ query:'bell', category:'', page:1 }, {}, async () => { throw new Error('must not fetch'); });
  assert.equal(result.code, 'provider_unavailable');
  assert.doesNotMatch(JSON.stringify(result), /FREESOUND_API_KEY|secret/i);
});
```

Add tests for upstream 401/429/500, timeout, empty query+category, `page` clamped to a positive integer, and malformed JSON.

- [ ] **Step 2: Run Worker tests and verify failure**

Run: `cd download-worker && npm test`

Expected: FAIL because `src/sounds.js` does not exist.

- [ ] **Step 3: Implement Freesound adapter**

`download-worker/src/sounds.js` uses the current API v2 endpoint and requests all metadata in one call:

```js
const FIELDS = 'id,name,username,license,duration,type,filesize,tags,previews';

export async function searchFreesound(input, env, fetchImpl = fetch) {
  const term = String(input?.query || '').trim();
  const category = String(input?.category || '').trim();
  if (!term && !category) return { status:'error', code:'invalid_search', message:'A term or category is required.' };
  if (!env?.FREESOUND_API_KEY) return { status:'error', code:'provider_unavailable', message:'Sound search is temporarily unavailable.' };

  const page = Math.max(1, Math.min(50, Number.parseInt(input.page, 10) || 1));
  const url = new URL('https://freesound.org/apiv2/search/');
  url.searchParams.set('query', term || category);
  url.searchParams.set('fields', FIELDS);
  url.searchParams.set('page_size', '20');
  url.searchParams.set('page', String(page));

  const response = await fetchImpl(url, {
    headers: { Authorization:`Token ${env.FREESOUND_API_KEY}`, Accept:'application/json' }
  });
  if (!response.ok) return { status:'error', code:'provider_unavailable', message:'Freesound is temporarily unavailable.' };
  const payload = await response.json();
  const items = (Array.isArray(payload.results) ? payload.results : []).map(sound => ({
    id:String(sound.id), name:sound.name || 'Sound', provider:'freesound',
    pageUrl:`https://freesound.org/s/${sound.id}/`,
    previewUrl:sound.previews?.['preview-hq-mp3'] || sound.previews?.['preview-lq-mp3'] || null,
    downloadUrl:null,
    duration:Number.isFinite(Number(sound.duration)) ? Number(sound.duration) : null,
    format:sound.type || null,
    size:Number.isFinite(Number(sound.filesize)) ? Number(sound.filesize) : null,
    license:sound.license || null,
    author:sound.username || null,
    tags:Array.isArray(sound.tags) ? sound.tags : []
  }));
  return { status:'ok', provider:'freesound', items, count:Number(payload.count) || items.length };
}
```

Before calling it, the route layer must combine the selected TifloAcosta category with the free-text query using the same category mapping contract from Task 2; duplicate that small server-side map deliberately rather than importing browser code into the Worker.

- [ ] **Step 4: Route `/sounds/search` without changing `/analyze`**

In `download-worker/src/index.js`, route by pathname before analyzer body parsing:

```js
const requestUrl = new URL(request.url);
if (requestUrl.pathname === '/sounds/search') {
  const body = await request.json().catch(() => null);
  const result = await searchFreesound(body, env);
  return json(result, result.status === 'ok' ? 200 : 422, origin);
}
if (requestUrl.pathname !== '/analyze') {
  return json(errorPayload('not_found', 'Unknown endpoint.'), 404, origin);
}
```

Change Worker signature to `async fetch(request, env)` and keep the existing CORS/origin protections for both routes.

- [ ] **Step 5: Wire the runtime secret safely**

Add a comment-only declaration to `wrangler.toml`:

```toml
# Runtime secret required for /sounds/search: FREESOUND_API_KEY
```

In `.github/workflows/deploy-download-worker.yml`, before `wrangler-action`, add:

```yaml
- name: Configure Freesound API secret
  if: ${{ secrets.FREESOUND_API_KEY != '' }}
  working-directory: download-worker
  env:
    CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
    CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
    FREESOUND_API_KEY: ${{ secrets.FREESOUND_API_KEY }}
  run: printf '%s' "$FREESOUND_API_KEY" | npx wrangler secret put FREESOUND_API_KEY
```

No secret value is committed. The GitHub repository secret must be named exactly `FREESOUND_API_KEY`.

- [ ] **Step 6: Add deployment smoke tests**

Keep the `/analyze` smoke test and add a non-secret structural test:

```bash
status=$(curl -sS -o sounds-response.json -w "%{http_code}" \
  -X POST -H 'Origin: https://tifloacosta.com' -H 'Content-Type: application/json' \
  --data '{"query":"","category":"","page":1}' \
  https://download.tifloacosta.com/sounds/search)
cat sounds-response.json
test "$status" = "422"
grep -q '"code":"invalid_search"' sounds-response.json
```

When `FREESOUND_API_KEY` exists, add a second smoke call with `{"query":"bell","category":"","page":1}` and require `"provider":"freesound"`.

- [ ] **Step 7: Run all Worker and app tests**

Run: `cd download-worker && npm test && cd .. && npm test`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add download-worker/src/sounds.js download-worker/src/index.js download-worker/test/sounds.test.mjs download-worker/wrangler.toml .github/workflows/deploy-download-worker.yml
git commit -m "feat: añadir búsqueda Freesound al Worker"
```

---

### Task 4: Construir la interfaz accesible «Buscar sonidos»

**Files:**
- Create: `sound-search.js`
- Create: `sound-search-config.js`
- Create: `test/sound-search-ui.test.mjs`
- Modify: `index.html`
- Modify: `downloads.css`

**Interfaces:**
- Consumes: `window.TIFLO_SOUND_CORE` and `window.TIFLO_SOUND_CONFIG.endpoint`.
- Produces: view `#downloads-sounds`, form ids `sound-search-form`, `sound-query`, `sound-category`, `sound-provider`, result region `sound-results`, status `sound-status`.

- [ ] **Step 1: Write failing UI structure tests**

```js
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = f => readFile(new URL(`../${f}`, import.meta.url), 'utf8');

test('sound UI exposes labelled search, category, provider and live status', async () => {
  const source = await read('sound-search.js').catch(() => '');
  assert.match(source, /sound-search-form/);
  assert.match(source, /sound-query/);
  assert.match(source, /sound-category/);
  assert.match(source, /sound-provider/);
  assert.match(source, /aria-live/);
  assert.match(source, /#downloads/);
});

test('preview links do not autoplay and only one audio element can play', async () => {
  const source = await read('sound-search.js').catch(() => '');
  assert.doesNotMatch(source, /autoplay\s*=\s*true/);
  assert.match(source, /activeAudio/);
  assert.match(source, /activeAudio\.pause\(\)/);
});
```

Add tests asserting result action labels include the sound name and external links use `noopener noreferrer`.

- [ ] **Step 2: Run and verify failure**

Run: `node --test test/sound-search-ui.test.mjs`

Expected: FAIL because the files do not exist.

- [ ] **Step 3: Add public config and scripts**

`sound-search-config.js`:

```js
window.TIFLO_SOUND_CONFIG = Object.freeze({
  endpoint: 'https://download.tifloacosta.com/sounds/search',
  providers: ['freesound']
});
```

Add to `index.html` after the Downloads assets:

```html
<script src="sound-search-core.js?v=1.0"></script>
<script src="sound-search-config.js?v=1.0"></script>
<script src="sound-search.js?v=1.0"></script>
```

- [ ] **Step 4: Build the form and accessible states**

The visible order is:

```text
Volver a Descargas
Buscar sonidos
Texto introductorio
Buscar por palabra o frase
Categoría
Banco de sonidos
Buscar sonidos
Estado
Resultados
Explorar otros bancos
Volver a Descargas
```

`provider` starts with `all` but v1 maps `all` to the enabled internal providers (`freesound`). Submit logic:

```js
const valid = core.validateSearch(queryInput.value, categorySelect.value);
if (!valid.ok) {
  setStatus(t().needTermOrCategory, true);
  return;
}
setStatus(t().searching);
const response = await fetch(config.endpoint, {
  method:'POST',
  headers:{ 'Content-Type':'application/json' },
  body:JSON.stringify({ query:valid.term, category:valid.category, page:1 })
});
```

On success, normalize every item again through `core.normalizeResult` before rendering. On provider failure, show a recoverable message and keep external bank links visible.

- [ ] **Step 5: Render result cards with optional metadata only**

Each `article` uses one `h3` for the sound name. Append metadata only when non-null:

```js
if (item.duration !== null) appendMeta(card, `${t().duration}: ${core.formatDuration(item.duration)}`);
if (item.format) appendMeta(card, `${t().format}: ${String(item.format).toUpperCase()}`);
if (item.size !== null) appendMeta(card, `${t().size}: ${downloadCore.formatBytes(item.size)}`);
appendMeta(card, `${t().provider}: Freesound`);
if (item.license) appendMeta(card, `${t().license}: ${item.license}`);
if (item.author) appendMeta(card, `${t().author}: ${item.author}`);
```

Do not render “unknown” paragraphs for every missing field; omission is cleaner for screen readers.

- [ ] **Step 6: Implement one-at-a-time preview playback**

Use a module-level variable:

```js
let activeAudio = null;

function previewButton(item) {
  if (!item.previewUrl) return null;
  const button = element('button', { text:`${t().listen}: ${item.name}` });
  button.type = 'button';
  const audio = new Audio(item.previewUrl);
  audio.preload = 'none';
  button.addEventListener('click', async () => {
    if (activeAudio && activeAudio !== audio) activeAudio.pause();
    if (!audio.paused) { audio.pause(); button.textContent = `${t().listen}: ${item.name}`; return; }
    activeAudio = audio;
    await audio.play();
    button.textContent = `${t().pause}: ${item.name}`;
  });
  audio.addEventListener('ended', () => { button.textContent = `${t().listen}: ${item.name}`; if (activeAudio === audio) activeAudio = null; });
  return button;
}
```

A new search pauses and clears `activeAudio` before replacing results.

- [ ] **Step 7: Implement download/open action**

For v1 Freesound `downloadUrl` is null, so render:

```js
const open = element('a', { className:'button-link', text:`${t().openToDownload}: ${item.name}` });
open.href = item.pageUrl;
open.target = '_blank';
open.rel = 'noopener noreferrer';
```

If a future provider supplies `downloadUrl`, render `${t().download}: ${item.name}` against that URL instead.

- [ ] **Step 8: Run UI, core and full tests**

Run: `node --test test/sound-search-ui.test.mjs test/sound-search-core.test.mjs test/downloads-hub.test.mjs && npm test`

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add sound-search.js sound-search-config.js index.html downloads.css test/sound-search-ui.test.mjs
git commit -m "feat: añadir interfaz accesible para buscar sonidos"
```

---

### Task 5: Añadir exploración organizada de Mixkit y Pixabay

**Files:**
- Modify: `sound-search-config.js`
- Modify: `sound-search.js`
- Modify: `test/sound-search-ui.test.mjs`

**Interfaces:**
- Produces external catalog entries `{ id, nameEs, nameEn, baseUrl, categories }`.
- No scraping and no API assumptions.

- [ ] **Step 1: Write failing tests for external banks**

```js
test('Mixkit and Pixabay stay visible as external exploration options', async () => {
  const config = await read('sound-search-config.js');
  const ui = await read('sound-search.js');
  assert.match(config, /mixkit/i);
  assert.match(config, /pixabay/i);
  assert.match(ui, /externalBanks/);
  assert.match(ui, /noopener noreferrer/);
});
```

- [ ] **Step 2: Run and verify failure**

Run: `node --test test/sound-search-ui.test.mjs`

Expected: FAIL until banks are declared.

- [ ] **Step 3: Add stable provider catalog**

```js
window.TIFLO_SOUND_CONFIG = Object.freeze({
  endpoint:'https://download.tifloacosta.com/sounds/search',
  providers:['freesound'],
  externalBanks:[
    { id:'mixkit', name:'Mixkit', url:'https://mixkit.co/free-sound-effects/' },
    { id:'pixabay', name:'Pixabay', url:'https://pixabay.com/sound-effects/' }
  ]
});
```

Do not synthesize undocumented search URLs. The category/term remains visible in TifloAcosta so the user can copy it if the external bank requires another search.

- [ ] **Step 4: Render external bank section after internal results/status**

Use heading `h3` «Explorar otros bancos» / «Explore other sound banks». Each bank gets explanatory text that it opens an external site and one link with bank name. Keep it visible even if Freesound is unavailable.

- [ ] **Step 5: Run tests and commit**

Run: `node --test test/sound-search-ui.test.mjs && npm test`

```bash
git add sound-search-config.js sound-search.js test/sound-search-ui.test.mjs
git commit -m "feat: añadir bancos externos de sonidos"
```

---

### Task 6: Cache, privacidad, regresión y validación de producción

**Files:**
- Modify: `sw.js`
- Modify: `index.html` privacy copy or `app.js` privacy copy, whichever is the single source actually used by runtime localization.
- Create: `test/sound-search-integration.test.mjs`
- Modify: `.github/workflows/deploy-download-worker.yml`

**Interfaces:**
- Produces a deployable web build and Worker with explicit regression coverage.

- [ ] **Step 1: Write integration tests before cache/privacy changes**

```js
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = f => readFile(new URL(`../${f}`, import.meta.url), 'utf8');

test('service worker caches every sound-search asset', async () => {
  const sw = await read('sw.js');
  for (const asset of ['sound-search-core.js','sound-search-config.js','sound-search.js']) assert.match(sw, new RegExp(asset.replace('.', '\\.')));
});

test('privacy copy discloses that sound searches may be sent to external providers', async () => {
  const app = await read('app.js');
  assert.match(app, /búsquedas de sonidos/i);
  assert.match(app, /sound searches/i);
});

test('public source never contains the Freesound secret value binding assignment', async () => {
  const files = await Promise.all(['sound-search-config.js','sound-search.js','download-config.js'].map(read));
  assert.doesNotMatch(files.join('\n'), /Authorization:\s*Token|FREESOUND_API_KEY/);
});
```

- [ ] **Step 2: Run and verify failure**

Run: `node --test test/sound-search-integration.test.mjs`

Expected: FAIL until cache/privacy copy is updated.

- [ ] **Step 3: Update service worker cache**

Bump the cache key by one version and add:

```js
'./downloads-hub.js',
'./sound-search-core.js',
'./sound-search-config.js',
'./sound-search.js',
'./downloads.css'
```

Keep network requests to `download.tifloacosta.com` outside static cache; sound results are live and are not persisted.

- [ ] **Step 4: Update bilingual privacy copy**

Spanish sentence to add to the existing privacy paragraph:

```text
Cuando utilizas Buscar sonidos, el término y la categoría elegidos pueden enviarse al servicio externo necesario para localizar resultados; TifloAcosta no guarda un historial personal de esas búsquedas.
```

English equivalent:

```text
When you use Search sounds, the term and category you choose may be sent to the external service needed to find results; TifloAcosta does not keep a personal history of those searches.
```

- [ ] **Step 5: Run the complete suite**

Run: `npm test && (cd download-worker && npm test)`

Expected: all tests PASS; no regression in Download-by-link tests.

- [ ] **Step 6: Manual accessibility verification before merge**

Verify on the deployed branch/preview where possible:

```text
VoiceOver/iPhone or VoiceOver/macOS:
1. Home → Descargas.
2. Confirm heading «Descargas» and two choices.
3. Enter «Buscar sonidos».
4. Search only by text.
5. Search only by category.
6. Search by text + category.
7. Confirm focus reaches the results heading once, not every result.
8. Play sound A, then sound B; A must stop.
9. Open a Freesound result and return to TifloAcosta.
10. Open Mixkit/Pixabay and return.
11. Switch ES ↔ EN and confirm labels change without losing structural accessibility.
12. Re-open «Descargar desde un enlace» and repeat one known 7-Zip/VLC test.
```

Repeat keyboard navigation with JAWS or NVDA on Windows for form fields, result headings, preview buttons, and external links.

- [ ] **Step 7: Production smoke verification**

After merge and successful GitHub Pages + Worker workflows:

```bash
curl -sS -X POST \
  -H 'Origin: https://tifloacosta.com' \
  -H 'Content-Type: application/json' \
  --data '{"query":"bell","category":"notifications","page":1}' \
  https://download.tifloacosta.com/sounds/search
```

Expected when the secret is configured: JSON with `"status":"ok"`, `"provider":"freesound"`, and an `items` array. If the secret is not configured yet, expected safe fallback is `"code":"provider_unavailable"`; the web UI must still expose Mixkit and Pixabay.

Open `https://tifloacosta.com/#downloads` and confirm the hub is visible from a fresh/private browser session, preventing a false positive from old cached assets.

- [ ] **Step 8: Commit final integration changes**

```bash
git add sw.js app.js index.html test/sound-search-integration.test.mjs .github/workflows/deploy-download-worker.yml
git commit -m "test: cerrar integración del buscador de sonidos"
```

---

## Deployment / Credential Prerequisite

Before Freesound internal search can return real results in production, create one Freesound APIv2 application credential and save its API key in the GitHub repository secret named exactly `FREESOUND_API_KEY`. Do not paste the key into source files, chat output, `sound-search-config.js`, or `wrangler.toml`.

The code is deliberately designed so that the rest of «Buscar sonidos» remains usable if this secret has not yet been configured: the UI reports Freesound as temporarily unavailable and still provides the external Mixkit/Pixabay options.

## Final Acceptance Gate

Merge only after all of these are true:

1. `npm test` passes.
2. `cd download-worker && npm test` passes.
3. Existing link analyzer production smoke still passes.
4. Sound endpoint returns either valid Freesound results or the explicit safe `provider_unavailable` fallback.
5. Fresh browser session shows `Descargas → Descargar desde un enlace / Buscar sonidos`.
6. A known link download test still works.
7. A sound search can be completed using keyboard/screen reader without a focus trap.
8. Starting a second preview stops the first.
9. No API secret appears in public source or browser configuration.
10. GitHub Pages and Worker deployment workflows complete successfully.
