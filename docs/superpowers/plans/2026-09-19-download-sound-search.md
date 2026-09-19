# Download Sound Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir «Descargas» en un centro con dos herramientas: la descarga desde enlace ya existente y una búsqueda accesible de sonidos con Freesound como proveedor interno y Mixkit/Pixabay como bancos externos organizados.

**Architecture:** Mantener la descarga por enlace aislada, añadir un centro de navegación `#downloads`, y crear módulos separados para la búsqueda de sonidos. Reutilizar el Worker de `download.tifloacosta.com` con `POST /sounds/search`; la clave de Freesound vive únicamente como secreto del Worker.

**Tech Stack:** HTML semántico, CSS, JavaScript sin framework, Node.js `node:test`, Cloudflare Workers/Wrangler, Freesound API v2.

**Spec:** `docs/superpowers/specs/2026-09-19-download-sound-search-design.md`

## Global Constraints

- «Descargar desde un enlace» debe seguir funcionando sin regresiones.
- Español e inglés desde la primera versión.
- Sin almacenamiento de sonidos de terceros en TifloAcosta.
- Sin claves API ni credenciales en el frontend.
- Sin OAuth2 de Freesound en esta primera versión.
- Sin reproducción automática.
- Un único audio de preescucha sonando a la vez.
- Los cambios de filtro no moverán el foco.
- Siempre habrá regreso explícito a Descargas.
- Enlaces externos con `target="_blank"` y `rel="noopener noreferrer"`.
- Texto, categoría o ambos son válidos; ambos vacíos no lo son.
- Los fallos de Freesound no eliminan los accesos a Mixkit/Pixabay.
- Web primero; Android después.

## Review Focus

- Búsqueda vacía: no hace petición y anuncia qué falta.
- Metadatos incompletos: no inventa tamaño, formato, licencia, duración ni preview.
- Audio sucesivo: iniciar B detiene A.
- Secreto ausente/429/500: error recuperable sin filtrar secretos.
- Hash profundo: `#downloads-link` y `#downloads-sounds` funcionan directamente y permiten volver.

---

## File Structure

**Create**
- `downloads-hub.js`
- `sound-search-core.js`
- `sound-search-config.js`
- `sound-search.js`
- `test/downloads-hub.test.mjs`
- `test/sound-search-core.test.mjs`
- `test/sound-search-ui.test.mjs`
- `test/sound-search-integration.test.mjs`
- `download-worker/src/sounds.js`
- `download-worker/test/sounds.test.mjs`

**Modify**
- `index.html`
- `downloads.js`
- `downloads.css`
- `test/downloads-ui.test.mjs`
- `download-worker/src/index.js`
- `download-worker/wrangler.toml`
- `.github/workflows/deploy-download-worker.yml`
- `sw.js`
- `app.js`

---

### Task 1: Centro de Descargas y rutas hijas

**Files:**
- Create: `downloads-hub.js`
- Create: `test/downloads-hub.test.mjs`
- Modify: `downloads.js`
- Modify: `index.html`
- Modify: `downloads.css`
- Modify: `test/downloads-ui.test.mjs`

**Interfaces:**
- Produces hashes `#downloads`, `#downloads-link`, `#downloads-sounds`.
- Produces buttons `#downloads-open-link` and `#downloads-open-sounds`.

- [ ] **Step 1: Write failing route tests**

```js
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
const read = f => readFile(new URL(`../${f}`, import.meta.url), 'utf8');

test('Downloads has hub and child routes', async () => {
  const hub = await read('downloads-hub.js').catch(() => '');
  const tool = await read('downloads.js');
  assert.match(hub, /downloads-open-link/);
  assert.match(hub, /downloads-open-sounds/);
  assert.match(hub, /#downloads-link/);
  assert.match(hub, /#downloads-sounds/);
  assert.match(tool, /downloads-link/);
});

test('download assets are explicitly loaded once', async () => {
  const html = await read('index.html');
  for (const asset of ['downloads.css','downloads-core.js','download-config.js','downloads-hub.js','downloads.js']) {
    assert.equal((html.match(new RegExp(asset.replace('.', '\\.'), 'g')) || []).length, 1, asset);
  }
});
```

- [ ] **Step 2: Verify red**

Run: `node --test test/downloads-hub.test.mjs test/downloads-ui.test.mjs`

Expected: FAIL because the hub does not exist and the current tool owns `#downloads`.

- [ ] **Step 3: Implement `downloads-hub.js`**

```js
(() => {
  'use strict';
  const copy = {
    es:{ launcher:'Descargas', heading:'Descargas', intro:'Elige qué quieres hacer.', link:'Descargar desde un enlace', sounds:'Buscar sonidos', back:'Volver al inicio' },
    en:{ launcher:'Downloads', heading:'Downloads', intro:'Choose what you want to do.', link:'Download from a link', sounds:'Search sounds', back:'Back to home' }
  };
  const lang = () => document.documentElement.lang === 'en' ? 'en' : 'es';
  let section, launcher;

  function localize() {
    const t = copy[lang()];
    launcher.textContent = t.launcher;
    section.querySelector('h2').textContent = t.heading;
    section.querySelector('[data-downloads-intro]').textContent = t.intro;
    section.querySelector('#downloads-open-link').textContent = t.link;
    section.querySelector('#downloads-open-sounds').textContent = t.sounds;
    section.querySelector('[data-downloads-home]').textContent = t.back;
  }

  function applyVisibility() {
    const active = location.hash.replace(/^#/, '') === 'downloads';
    section.hidden = !active;
    if (!active) return;
    ['home-hero','home-blocks','resources-view','news-view','book-section','contact-section','privacy-section','config-section','downloads-section','sound-search-section']
      .forEach(id => { const node = document.getElementById(id); if (node) node.hidden = true; });
    document.querySelectorAll('.site-header,.site-footer,.skip-link').forEach(node => { node.hidden = true; });
    section.hidden = false;
    section.focus();
  }

  function build() {
    const nav = document.querySelector('#home-blocks .resource-actions');
    const main = document.getElementById('main');
    if (!nav || !main || document.getElementById('downloads-hub')) return;
    launcher = document.createElement('button');
    launcher.id = 'home-open-downloads';
    launcher.type = 'button';
    launcher.className = 'button-link';
    launcher.addEventListener('click', () => { location.hash = '#downloads'; });
    nav.insertBefore(launcher, document.getElementById('home-open-videos'));

    section = document.createElement('section');
    section.id = 'downloads-hub';
    section.hidden = true;
    section.tabIndex = -1;
    section.innerHTML = '<p><button type="button" class="button-link back-link" data-downloads-home></button></p><h2></h2><p data-downloads-intro></p><div class="resource-actions"><button type="button" class="button-link" id="downloads-open-link"></button><button type="button" class="button-link" id="downloads-open-sounds"></button></div>';
    main.append(section);
    section.querySelector('[data-downloads-home]').addEventListener('click', () => { location.hash = '#home'; });
    section.querySelector('#downloads-open-link').addEventListener('click', () => { location.hash = '#downloads-link'; });
    section.querySelector('#downloads-open-sounds').addEventListener('click', () => { location.hash = '#downloads-sounds'; });
    localize();
    applyVisibility();
  }

  build();
  window.addEventListener('hashchange', applyVisibility);
  document.getElementById('lang-es')?.addEventListener('click', () => setTimeout(localize, 0));
  document.getElementById('lang-en')?.addEventListener('click', () => setTimeout(localize, 0));
})();
```

- [ ] **Step 4: Move current link tool to `#downloads-link`**

In `downloads.js`:

```js
const active = window.location.hash.replace(/^#/, '') === 'downloads-link';
```

Change both download-tool back actions to:

```js
button.addEventListener('click', () => { window.location.hash = '#downloads'; });
```

Delete creation of `#home-open-downloads` from `downloads.js`; the hub owns that launcher.

- [ ] **Step 5: Load assets explicitly**

Add to `<head>`:

```html
<link rel="stylesheet" href="downloads.css?v=1.1">
```

Add after `app.js`:

```html
<script src="downloads-core.js?v=1.1"></script>
<script src="download-config.js?v=1.1"></script>
<script src="downloads-hub.js?v=1.0"></script>
<script src="downloads.js?v=1.1"></script>
```

- [ ] **Step 6: Verify green and full regression**

Run: `node --test test/downloads-hub.test.mjs test/downloads-ui.test.mjs && npm test`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add index.html downloads-hub.js downloads.js downloads.css test/downloads-hub.test.mjs test/downloads-ui.test.mjs
git commit -m "feat: convertir Descargas en centro de herramientas"
```

---

### Task 2: Núcleo de búsqueda de sonidos

**Files:**
- Create: `sound-search-core.js`
- Create: `test/sound-search-core.test.mjs`

**Interfaces:**
- Produces `window.TIFLO_SOUND_CORE` with `categories`, `validateSearch`, `buildProviderQuery`, `normalizeResult`, `mergeResults`, `formatDuration`.

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

test('term or category is required', async () => {
  const core = await loadCore();
  assert.equal(core.validateSearch('', '').ok, false);
  assert.equal(core.validateSearch('campana', '').ok, true);
  assert.equal(core.validateSearch('', 'notifications').ok, true);
});

test('term and category combine', async () => {
  const core = await loadCore();
  assert.equal(core.buildProviderQuery('campana', 'notifications'), 'campana notification alert');
});

test('missing metadata stays null', async () => {
  const core = await loadCore();
  const item = core.normalizeResult({ id:1, name:'Bell' }, 'freesound');
  assert.equal(item.size, null);
  assert.equal(item.format, null);
  assert.equal(item.license, null);
  assert.equal(item.previewUrl, null);
});

test('merge deduplicates provider/id and ignores malformed groups', async () => {
  const core = await loadCore();
  const a = core.normalizeResult({ id:1, name:'A' }, 'freesound');
  const b = core.normalizeResult({ id:2, name:'B' }, 'freesound');
  assert.deepEqual(core.mergeResults([[a,a], null, [b]], 20).map(x => x.id), ['1','2']);
});
```

- [ ] **Step 2: Verify red**

Run: `node --test test/sound-search-core.test.mjs`

Expected: FAIL because the file does not exist.

- [ ] **Step 3: Implement category contract and pure functions**

```js
const categories = Object.freeze({
  ringtones:{ es:'Tonos de llamada', en:'Ringtones', query:'ringtone phone ring' },
  notifications:{ es:'Notificaciones', en:'Notifications', query:'notification alert' },
  alarms:{ es:'Alarmas', en:'Alarms', query:'alarm warning' },
  phones:{ es:'Teléfonos', en:'Phones', query:'telephone phone' },
  technology:{ es:'Tecnología', en:'Technology', query:'technology computer digital' },
  nature:{ es:'Naturaleza', en:'Nature', query:'nature ambient' },
  animals:{ es:'Animales', en:'Animals', query:'animal' },
  ambience:{ es:'Ambiente', en:'Ambience', query:'ambience atmosphere' },
  funny:{ es:'Divertidos', en:'Funny', query:'funny cartoon' },
  games:{ es:'Juegos', en:'Games', query:'game arcade' }
});

function validateSearch(term, category) {
  const q = String(term || '').trim();
  const c = String(category || '').trim();
  return { ok:Boolean(q || categories[c]), term:q, category:categories[c] ? c : '' };
}

function buildProviderQuery(term, category) {
  const v = validateSearch(term, category);
  if (!v.ok) return '';
  return [v.term, v.category ? categories[v.category].query : ''].filter(Boolean).join(' ');
}
```

`normalizeResult` returns fields `id,name,provider,pageUrl,previewUrl,downloadUrl,duration,format,size,license,author,tags`; missing values are `null` except `tags:[]`.

`mergeResults(groups, limit=20)` uses:

```js
const seen = new Set();
return groups.filter(Array.isArray).flat().filter(item => {
  const key = `${item.provider}:${item.id}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
}).slice(0, limit);
```

`formatDuration(61.2)` returns `1:01`.

- [ ] **Step 4: Verify green**

Run: `node --test test/sound-search-core.test.mjs && npm test`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add sound-search-core.js test/sound-search-core.test.mjs
git commit -m "feat: añadir núcleo de búsqueda de sonidos"
```

---

### Task 3: Endpoint Freesound en el Worker

**Files:**
- Create: `download-worker/src/sounds.js`
- Create: `download-worker/test/sounds.test.mjs`
- Modify: `download-worker/src/index.js`
- Modify: `download-worker/wrangler.toml`
- Modify: `.github/workflows/deploy-download-worker.yml`

**Interfaces:**
- Consumes `env.FREESOUND_API_KEY`.
- Input `POST /sounds/search`: `{query:string, category:string, page:number}`.
- Success: `{status:'ok', provider:'freesound', items:[], count:number}`.
- Error: `{status:'error', code:'invalid_search'|'provider_unavailable', message:string}`.

- [ ] **Step 1: Write failing provider tests**

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { searchFreesound } from '../src/sounds.js';

const goodFetch = async () => new Response(JSON.stringify({ count:1, results:[{
  id:42, name:'Bell.wav', username:'ana', license:'Creative Commons 0', duration:1.25,
  type:'wav', filesize:123456, tags:['bell'], previews:{'preview-hq-mp3':'https://cdn.example/bell.mp3'}
}] }), { status:200, headers:{'content-type':'application/json'} });

test('maps Freesound metadata without download OAuth', async () => {
  const r = await searchFreesound({query:'bell',category:'',page:1}, {FREESOUND_API_KEY:'secret'}, goodFetch);
  assert.equal(r.status, 'ok');
  assert.equal(r.items[0].pageUrl, 'https://freesound.org/s/42/');
  assert.equal(r.items[0].previewUrl, 'https://cdn.example/bell.mp3');
  assert.equal(r.items[0].downloadUrl, null);
  assert.equal(r.items[0].size, 123456);
});

test('missing key is recoverable and not leaked', async () => {
  const r = await searchFreesound({query:'bell',category:'',page:1}, {}, async () => { throw new Error('not called'); });
  assert.equal(r.code, 'provider_unavailable');
  assert.doesNotMatch(JSON.stringify(r), /FREESOUND_API_KEY|secret/i);
});

for (const status of [401,429,500]) {
  test(`upstream ${status} becomes provider_unavailable`, async () => {
    const fetchImpl = async () => new Response('{}', {status});
    const r = await searchFreesound({query:'bell',category:'',page:1}, {FREESOUND_API_KEY:'secret'}, fetchImpl);
    assert.equal(r.code, 'provider_unavailable');
  });
}

test('empty request is invalid_search', async () => {
  const r = await searchFreesound({query:'',category:'',page:1}, {FREESOUND_API_KEY:'secret'}, goodFetch);
  assert.equal(r.code, 'invalid_search');
});

test('page is clamped to positive integer', async () => {
  let requested;
  const fetchImpl = async url => { requested = new URL(url); return goodFetch(); };
  await searchFreesound({query:'bell',category:'',page:-8}, {FREESOUND_API_KEY:'secret'}, fetchImpl);
  assert.equal(requested.searchParams.get('page'), '1');
});
```

- [ ] **Step 2: Verify red**

Run: `cd download-worker && npm test`

Expected: FAIL because `src/sounds.js` does not exist.

- [ ] **Step 3: Implement `searchFreesound`**

Use Freesound API v2 `https://freesound.org/apiv2/search/` and fields:

```js
const FIELDS = 'id,name,username,license,duration,type,filesize,tags,previews';
```

Authenticate only server-side:

```js
headers: { Authorization:`Token ${env.FREESOUND_API_KEY}`, Accept:'application/json' }
```

Map each result to:

```js
{
  id:String(sound.id),
  name:sound.name || 'Sound',
  provider:'freesound',
  pageUrl:`https://freesound.org/s/${sound.id}/`,
  previewUrl:sound.previews?.['preview-hq-mp3'] || sound.previews?.['preview-lq-mp3'] || null,
  downloadUrl:null,
  duration:Number.isFinite(Number(sound.duration)) ? Number(sound.duration) : null,
  format:sound.type || null,
  size:Number.isFinite(Number(sound.filesize)) ? Number(sound.filesize) : null,
  license:sound.license || null,
  author:sound.username || null,
  tags:Array.isArray(sound.tags) ? sound.tags : []
}
```

Use 8-second `AbortController`; timeout and malformed JSON both return `provider_unavailable`.

- [ ] **Step 4: Route without changing `/analyze` behavior**

Change Worker entry signature to:

```js
async fetch(request, env) {
```

After CORS/method handling:

```js
const pathname = new URL(request.url).pathname;
const body = await request.json().catch(() => null);
if (pathname === '/sounds/search') {
  const result = await searchFreesound(body, env);
  return json(result, result.status === 'ok' ? 200 : 422, origin);
}
if (pathname !== '/analyze') return json(errorPayload('not_found','Unknown endpoint.'), 404, origin);
```

Then run the existing analyzer logic with `body.url` exactly as before.

- [ ] **Step 5: Configure runtime secret without committing its value**

Append to `download-worker/wrangler.toml`:

```toml
# Runtime secret required by /sounds/search: FREESOUND_API_KEY
```

Add before Worker deploy in `.github/workflows/deploy-download-worker.yml`:

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

- [ ] **Step 6: Add route smoke test**

```bash
status=$(curl -sS -o sounds-response.json -w "%{http_code}" \
  -X POST -H 'Origin: https://tifloacosta.com' -H 'Content-Type: application/json' \
  --data '{"query":"","category":"","page":1}' \
  https://download.tifloacosta.com/sounds/search)
test "$status" = "422"
grep -q '"code":"invalid_search"' sounds-response.json
```

If GitHub secret `FREESOUND_API_KEY` is non-empty, also run:

```bash
curl -fsS -X POST -H 'Origin: https://tifloacosta.com' -H 'Content-Type: application/json' \
  --data '{"query":"bell","category":"","page":1}' \
  https://download.tifloacosta.com/sounds/search | grep -q '"provider":"freesound"'
```

- [ ] **Step 7: Verify green**

Run: `cd download-worker && npm test && cd .. && npm test`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add download-worker/src/sounds.js download-worker/src/index.js download-worker/test/sounds.test.mjs download-worker/wrangler.toml .github/workflows/deploy-download-worker.yml
git commit -m "feat: añadir búsqueda Freesound al Worker"
```

---

### Task 4: Interfaz accesible de Buscar sonidos

**Files:**
- Create: `sound-search-config.js`
- Create: `sound-search.js`
- Create: `test/sound-search-ui.test.mjs`
- Modify: `index.html`
- Modify: `downloads.css`

**Interfaces:**
- Consumes `window.TIFLO_SOUND_CORE` and `window.TIFLO_SOUND_CONFIG.endpoint`.
- Produces section `#sound-search-section` active on `#downloads-sounds`.

- [ ] **Step 1: Write failing UI tests**

```js
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
const read = f => readFile(new URL(`../${f}`, import.meta.url), 'utf8');

test('sound search has labelled controls and live status', async () => {
  const s = await read('sound-search.js').catch(() => '');
  for (const id of ['sound-search-form','sound-query','sound-category','sound-provider','sound-status','sound-results']) assert.match(s, new RegExp(id));
  assert.match(s, /aria-live/);
  assert.match(s, /#downloads/);
});

test('preview never autoplays and stops previous audio', async () => {
  const s = await read('sound-search.js').catch(() => '');
  assert.doesNotMatch(s, /autoplay\s*=\s*true/);
  assert.match(s, /activeAudio/);
  assert.match(s, /activeAudio\.pause\(\)/);
});

test('sound actions include sound name and safe external rel', async () => {
  const s = await read('sound-search.js').catch(() => '');
  assert.match(s, /item\.name/);
  assert.match(s, /noopener noreferrer/);
});
```

- [ ] **Step 2: Verify red**

Run: `node --test test/sound-search-ui.test.mjs`

Expected: FAIL.

- [ ] **Step 3: Add config and load scripts**

`sound-search-config.js`:

```js
window.TIFLO_SOUND_CONFIG = Object.freeze({
  endpoint:'https://download.tifloacosta.com/sounds/search',
  providers:['freesound'],
  externalBanks:[
    {id:'mixkit',name:'Mixkit',url:'https://mixkit.co/free-sound-effects/'},
    {id:'pixabay',name:'Pixabay',url:'https://pixabay.com/sound-effects/'}
  ]
});
```

Add after Downloads scripts:

```html
<script src="sound-search-core.js?v=1.0"></script>
<script src="sound-search-config.js?v=1.0"></script>
<script src="sound-search.js?v=1.0"></script>
```

- [ ] **Step 4: Build semantic form and validation**

Order:

```text
Volver a Descargas
Buscar sonidos
Introducción
Buscar por palabra o frase
Categoría
Banco de sonidos
Buscar sonidos
Estado
Resultados
Explorar otros bancos
Volver a Descargas
```

Submit:

```js
const valid = core.validateSearch(queryInput.value, categorySelect.value);
if (!valid.ok) { setStatus(t().needTermOrCategory, true); return; }
setStatus(t().searching);
const response = await fetch(config.endpoint, {
  method:'POST', headers:{'Content-Type':'application/json'},
  body:JSON.stringify({query:core.buildProviderQuery(valid.term, valid.category), category:valid.category, page:1})
});
```

On success normalize every item with `core.normalizeResult`. On error announce recoverable failure and leave external banks visible.

- [ ] **Step 5: Render only available metadata**

```js
if (item.duration !== null) meta(`${t().duration}: ${core.formatDuration(item.duration)}`);
if (item.format) meta(`${t().format}: ${item.format.toUpperCase()}`);
if (item.size !== null) meta(`${t().size}: ${downloadCore.formatBytes(item.size)}`);
meta(`${t().provider}: Freesound`);
if (item.license) meta(`${t().license}: ${item.license}`);
if (item.author) meta(`${t().author}: ${item.author}`);
```

Do not render placeholder paragraphs for absent metadata.

- [ ] **Step 6: Implement single active preview**

```js
let activeAudio = null;
function play(item, button) {
  if (activeAudio && activeAudio.audio !== item.audio) activeAudio.audio.pause();
  if (!item.audio.paused) { item.audio.pause(); button.textContent = `${t().listen}: ${item.name}`; return; }
  activeAudio = { audio:item.audio, button };
  item.audio.play();
  button.textContent = `${t().pause}: ${item.name}`;
}
```

Create each `Audio` with `preload='none'`; a new search pauses `activeAudio.audio` before replacing results.

- [ ] **Step 7: Render Freesound download action and external banks**

Freesound v1:

```js
const link = element('a', {className:'button-link', text:`${t().openToDownload}: ${item.name}`});
link.href = item.pageUrl;
link.target = '_blank';
link.rel = 'noopener noreferrer';
```

External section always shows Mixkit and Pixabay from config with the same safe target/rel. Do not fabricate undocumented search URLs.

- [ ] **Step 8: Verify green and full suite**

Run: `node --test test/sound-search-ui.test.mjs test/sound-search-core.test.mjs test/downloads-hub.test.mjs && npm test`

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add sound-search-config.js sound-search.js index.html downloads.css test/sound-search-ui.test.mjs
git commit -m "feat: añadir buscador accesible de sonidos"
```

---

### Task 5: Cache y privacidad

**Files:**
- Create: `test/sound-search-integration.test.mjs`
- Modify: `sw.js`
- Modify: `app.js`
- Modify: `index.html`

**Interfaces:**
- Static assets cacheados; resultados de sonido nunca persistidos.

- [ ] **Step 1: Write failing integration tests**

```js
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
const read = f => readFile(new URL(`../${f}`, import.meta.url), 'utf8');

test('service worker caches sound static assets', async () => {
  const sw = await read('sw.js');
  for (const a of ['downloads-hub.js','sound-search-core.js','sound-search-config.js','sound-search.js']) assert.match(sw, new RegExp(a.replace('.', '\\.')));
});

test('privacy copy explains sound-search provider requests in both languages', async () => {
  const app = await read('app.js');
  assert.match(app, /búsquedas de sonidos/i);
  assert.match(app, /sound searches/i);
});

test('frontend contains no Freesound authorization secret', async () => {
  const publicSource = (await Promise.all(['sound-search-config.js','sound-search.js','index.html'].map(read))).join('\n');
  assert.doesNotMatch(publicSource, /FREESOUND_API_KEY|Authorization:\s*Token/i);
});
```

- [ ] **Step 2: Verify red**

Run: `node --test test/sound-search-integration.test.mjs`

Expected: FAIL until cache/privacy are changed.

- [ ] **Step 3: Cache new static assets**

Bump the existing `tifloacosta-app-*` cache version in `sw.js` and include:

```js
'./downloads-hub.js',
'./sound-search-core.js',
'./sound-search-config.js',
'./sound-search.js',
'./downloads.css'
```

Do not cache `https://download.tifloacosta.com/sounds/search` responses.

- [ ] **Step 4: Update privacy text in both runtime and fallback HTML**

Spanish sentence:

```text
Cuando utilizas Buscar sonidos, el término y la categoría elegidos pueden enviarse al servicio externo necesario para localizar resultados; TifloAcosta no guarda un historial personal de esas búsquedas.
```

English sentence:

```text
When you use Search sounds, the term and category you choose may be sent to the external service needed to find results; TifloAcosta does not keep a personal history of those searches.
```

Append them to `copy.es.privacy.text` and `copy.en.privacy.text` in `app.js`; append the Spanish sentence to `#privacy-text` in `index.html` for the no-JS/fallback source.

- [ ] **Step 5: Verify green**

Run: `node --test test/sound-search-integration.test.mjs && npm test && (cd download-worker && npm test)`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add sw.js app.js index.html test/sound-search-integration.test.mjs
git commit -m "feat: integrar privacidad y cache del buscador de sonidos"
```

---

### Task 6: Verificación manual, despliegue y aceptación

**Files:**
- Modify only if verification exposes a failing test or defect; every defect gets a failing automated regression test before its fix.

**Interfaces:**
- Production web: `https://tifloacosta.com/#downloads`.
- Production Worker: `https://download.tifloacosta.com/sounds/search`.

- [ ] **Step 1: Run complete automated verification**

Run:

```bash
npm test
(cd download-worker && npm test)
```

Expected: both commands exit 0.

- [ ] **Step 2: Verify sound endpoint locally/production-safe contract**

Without requiring a real key:

```bash
curl -sS -X POST \
  -H 'Origin: https://tifloacosta.com' \
  -H 'Content-Type: application/json' \
  --data '{"query":"","category":"","page":1}' \
  https://download.tifloacosta.com/sounds/search
```

Expected after Worker deploy: `status:error` and `code:invalid_search`.

With `FREESOUND_API_KEY` configured, send `{"query":"bell","category":"notifications","page":1}` and require `status:ok`, `provider:freesound`, and a non-empty `items` array.

- [ ] **Step 3: Screen-reader/keyboard checklist**

```text
1. Abrir Inicio → Descargas.
2. Confirmar encabezado «Descargas» y dos opciones.
3. Entrar en «Descargar desde un enlace» y volver a Descargas.
4. Entrar en «Buscar sonidos» y volver a Descargas.
5. Buscar solo por término.
6. Buscar solo por categoría.
7. Buscar término + categoría.
8. Confirmar que búsqueda vacía anuncia instrucción y no cambia el foco inesperadamente.
9. Reproducir sonido A y luego B; A debe detenerse.
10. Confirmar que cada botón Escuchar/Pausar incluye el nombre del sonido.
11. Abrir Freesound para descargar y regresar.
12. Abrir Mixkit y Pixabay y regresar.
13. Cambiar ES/EN y confirmar etiquetas completas.
14. Abrir directamente #downloads-link y #downloads-sounds desde la barra de direcciones.
15. Repetir una prueba conocida de 7-Zip o VLC para asegurar que la descarga por enlace sigue intacta.
```

Run this once with VoiceOver and once with JAWS or NVDA before merge.

- [ ] **Step 4: Fresh-session production verification**

After merge and successful Pages/Worker workflows, open a private/fresh browser session at:

```text
https://tifloacosta.com/#downloads
```

Expected: hub nuevo, not an old cached copy.

- [ ] **Step 5: Final acceptance gate**

Do not mark complete unless all are true:

```text
- App tests pass.
- Worker tests pass.
- Existing /analyze smoke passes.
- /sounds/search invalid-search smoke passes.
- With secret configured, Freesound real search passes.
- Hub appears in a fresh session.
- Download-by-link still works.
- Search by text/category/combined works.
- Second preview stops first.
- No API secret appears in public source.
- GitHub Pages deployment succeeds.
- Worker deployment succeeds.
```

---

## Credential Prerequisite

Before real Freesound results can appear in production, create one Freesound APIv2 application credential and save its API key as GitHub repository secret named exactly `FREESOUND_API_KEY`. Never put that value in source, `sound-search-config.js`, `wrangler.toml`, issue comments, logs, or chat output.

If the secret is absent, the UI must still work: it reports Freesound as temporarily unavailable and keeps Mixkit/Pixabay accessible.
