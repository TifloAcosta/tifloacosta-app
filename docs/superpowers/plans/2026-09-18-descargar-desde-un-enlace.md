# Descargar desde un enlace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir a TifloAcosta una sección accesible de primer nivel capaz de analizar enlaces públicos, resolver descargas directas cuando sea posible y listar todos los archivos detectados sin almacenar ni retransmitir los archivos.

**Architecture:** La app tendrá una capa local en JavaScript para validar URLs, reconocer proveedores, resolver enlaces directos y filtrar resultados. Cuando esa capa no baste, llamará por `POST` a un Cloudflare Worker que seguirá redirecciones de forma controlada, detectará respuestas de archivo y extraerá enlaces descargables de HTML sin ejecutar JavaScript remoto. La descarga final siempre saldrá del servidor original.

**Tech Stack:** HTML, CSS, JavaScript sin dependencias en la app, Node `node:test`, Cloudflare Workers, HTTPS.

**Spec:** `docs/superpowers/specs/2026-09-18-descargar-desde-un-enlace-design.md`

## Global Constraints
- Sección: **Descargar desde un enlace** / **Download from a link**.
- Español e inglés desde la primera versión.
- TifloAcosta nunca pedirá, recibirá ni almacenará credenciales.
- TifloAcosta nunca almacenará ni retransmitirá los archivos descargados.
- La URL solo se enviará al analizador cuando la persona pulse **Analizar enlace**.
- El analizador no ejecutará JavaScript remoto ni eludirá autenticación, paywalls o protecciones anticopia.
- Se mostrarán todos los archivos detectados; la app no elegirá uno automáticamente.
- La capa local seguirá funcionando si el analizador externo falla.
- La versión Android 2 (1.0.1) no se modifica si todo puede servirse desde el contenido web remoto.
- El Worker solo se desplegará si Cloudflare permite hacerlo sin contratar un plan de pago.
- Endpoint objetivo: `https://download.tifloacosta.com/analyze`.

---

### Task 1: Núcleo local de resolución

**Files:**
- Create: `downloads-core.js`
- Create: `test/downloads-core.test.mjs`

**Interfaces:**
- Produces: `normalizeUrl(value)`, `classifyUrl(value)`, `resolveLocal(value)`, `filterResults(items, query, type)`, `formatBytes(bytes)` mediante `window.TIFLO_DOWNLOAD_CORE` y `module.exports`.

- [ ] **Step 1: Write failing tests**

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import core from '../downloads-core.js';

test('rejects unsafe schemes', () => {
  assert.equal(core.normalizeUrl('javascript:alert(1)'), null);
  assert.equal(core.normalizeUrl('file:///tmp/a.pdf'), null);
});

test('classifies supported providers', () => {
  const cases = [
    ['https://drive.google.com/file/d/abc123/view', 'google-drive'],
    ['https://www.dropbox.com/scl/fi/abc/file.pdf?rlkey=x&dl=0', 'dropbox'],
    ['https://1drv.ms/u/s!abc', 'onedrive'],
    ['https://www.icloud.com/iclouddrive/abc', 'icloud-drive'],
    ['https://app.box.com/s/abc', 'box'],
    ['https://mega.nz/file/abc#key', 'mega'],
    ['https://we.tl/t-abc', 'wetransfer'],
    ['https://www.mediafire.com/file/abc/test.zip/file', 'mediafire'],
    ['https://u.pcloud.link/publink/show?code=abc', 'pcloud']
  ];
  for (const [url, expected] of cases) assert.equal(core.classifyUrl(url).provider, expected);
});

test('resolves Drive, Dropbox and direct files locally', () => {
  const drive = core.resolveLocal('https://drive.google.com/file/d/abc123/view');
  assert.match(drive.items[0].url, /drive\.google\.com\/uc\?export=download&id=abc123/);
  const dropbox = core.resolveLocal('https://www.dropbox.com/scl/fi/abc/file.pdf?rlkey=x&dl=0');
  assert.equal(new URL(dropbox.items[0].url).searchParams.get('dl'), '1');
  assert.equal(core.resolveLocal('https://example.org/manual.pdf').items[0].type, 'pdf');
});

test('filters without mutating all results', () => {
  const items = [{name:'manual.pdf',type:'pdf'},{name:'audio.mp3',type:'audio'}];
  assert.deepEqual(core.filterResults(items, 'man', 'all').map(x => x.name), ['manual.pdf']);
  assert.equal(items.length, 2);
});
```

- [ ] **Step 2: Run and confirm red**
Run: `node --test test/downloads-core.test.mjs`
Expected: FAIL because `downloads-core.js` does not exist.

- [ ] **Step 3: Implement minimal core**

Use the same UMD pattern as `app-core.js`. `normalizeUrl` accepts only `http:`/`https:`. `classifyUrl` recognizes Google Drive, Dropbox, OneDrive, iCloud Drive, Box, MEGA, WeTransfer, MediaFire and pCloud. Direct-file detection covers at least `pdf zip rar 7z txt doc docx xls xlsx ppt pptx epub mp3 m4a wav ogg mp4 m4v mov webm apk csv json`.

`resolveLocal` must:
- convert Google Drive `/file/d/<id>/...` into `https://drive.google.com/uc?export=download&id=<id>`;
- set Dropbox query parameter `dl=1`;
- return a result immediately for recognized direct-file URLs;
- return `{ kind:'needs-analyzer', provider, url }` for the remaining providers/pages.

- [ ] **Step 4: Run green and commit**
Run: `node --test test/downloads-core.test.mjs`
Expected: PASS.

```bash
git add downloads-core.js test/downloads-core.test.mjs
git commit -m "feat: add local download resolver"
```

---

### Task 2: Sección accesible y navegación

**Files:**
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `actualidad-core.js`
- Modify: `test/clean-home.test.mjs`
- Create: `test/downloads-surface.test.mjs`

**Interfaces:**
- Produces: ruta `#downloads`, launcher `#home-open-downloads`, sección `#downloads-section` y retorno al Inicio.

- [ ] **Step 1: Write failing surface tests**

```js
assert.match(html, /id="home-open-downloads"[^>]*href="#downloads"/);
assert.match(html, /<section id="downloads-section"[^>]*hidden[^>]*aria-labelledby="downloads-heading"/);
assert.match(html, /<label for="download-url">Pega aquí el enlace<\/label>/);
assert.match(html, /id="download-status"[^>]*aria-live="polite"[^>]*aria-atomic="true"/);
assert.match(html, /id="download-results-heading"/);
```

Update `test/clean-home.test.mjs` to require `home-open-downloads`.

- [ ] **Step 2: Run and confirm red**
Run: `npm test`
Expected: FAIL because the section does not exist.

- [ ] **Step 3: Add the view**

Add to `index.html`:

```html
<a class="button-link" id="home-open-downloads" href="#downloads">Descargar desde un enlace</a>
```

and a hidden section containing: top/bottom `data-home-back`, `h2#downloads-heading`, `form#download-form`, `input#download-url type="url"`, `button#download-analyze`, `p#download-status aria-live="polite" aria-atomic="true"`, hidden `#download-results-section`, `#download-result-search`, `#download-type-filter`, `#download-result-count`, `#download-results`, and hidden `#download-external-panel`.

- [ ] **Step 4: Wire isolated navigation**

In `actualidad-core.js`, add `downloads: 'downloads-section'` to home routes and `downloads-section` to `viewIds` inside `applyHomeIsolation`.

- [ ] **Step 5: Extend styles without creating a parallel design system**

Change the existing form-control selector to include `input[type="url"]`:

```css
input[type="search"],input[type="url"],select { ... }
```

Add only `.download-results`, `.download-result-card`, `.download-result-meta`, reusing existing colors, borders and focus styling.

- [ ] **Step 6: Run green and commit**
Run: `npm test`
Expected: PASS.

```bash
git add index.html styles.css actualidad-core.js test/clean-home.test.mjs test/downloads-surface.test.mjs
git commit -m "feat: add accessible download section"
```

---

### Task 3: Interacción local, filtros y salida externa

**Files:**
- Create: `downloads.js`
- Modify: `index.html`
- Create: `test/downloads-ui.test.mjs`

**Interfaces:**
- Consumes: `window.TIFLO_DOWNLOAD_CORE`, DOM de la sección, `localStorage`.
- Produces: análisis local, resultados ES/EN, filtros y contexto persistente `tifloDownloadPendingV1`.

- [ ] **Step 1: Write failing source/integration tests**

```js
assert.match(source, /const PENDING_KEY = 'tifloDownloadPendingV1'/);
assert.match(source, /core\.resolveLocal/);
assert.match(source, /core\.filterResults/);
assert.match(source, /resultsHeading\.focus\(\)/);
assert.match(source, /localStorage\.setItem\(PENDING_KEY/);
assert.match(source, /Reintentar análisis|Retry analysis/);
```

- [ ] **Step 2: Run and confirm red**
Run: `node --test test/downloads-ui.test.mjs`
Expected: FAIL because `downloads.js` does not exist.

- [ ] **Step 3: Implement `downloads.js`**

Create `copyByLanguage.es` and `.en`, plus `currentLanguage()`, `renderResults(items)`, `renderExternalNotice(provider,url)`, `applyFilters()`, `analyze(value)` and `restorePending()`.

Focus rules:
- invalid/error status: focus status only when orientation would otherwise be lost;
- successful analysis: focus `#download-results-heading`;
- external-auth notice: focus its heading;
- changing filters: never move focus.

Every result card must show name, type, size when known, provider/source and a real `<a class="button-link">` to the original/download URL. No automatic selection.

The external notice must say that the user is leaving TifloAcosta, destination accessibility/functionality belongs to that provider, and TifloAcosta does not receive/store credentials. Before opening the provider, save `{url, provider, timestamp}` in `localStorage`; on return offer **Reintentar análisis**.

- [ ] **Step 4: Load scripts**

```html
<script src="downloads-core.js?v=1.0"></script>
<script src="downloads.js?v=1.0"></script>
```

Place them before `app.js`.

- [ ] **Step 5: Run green and commit**
Run: `npm test`
Expected: PASS.

```bash
git add downloads.js index.html test/downloads-ui.test.mjs
git commit -m "feat: add download analysis interface"
```

---

### Task 4: Analizador Cloudflare Worker seguro

**Files:**
- Create: `download-worker/wrangler.toml`
- Create: `download-worker/package.json`
- Create: `download-worker/src/security.js`
- Create: `download-worker/src/providers.js`
- Create: `download-worker/src/index.js`
- Create: `download-worker/test/security.test.mjs`
- Create: `download-worker/test/providers.test.mjs`

**Interfaces:**
- Consumes: `POST /analyze` JSON `{ "url": "https://..." }`.
- Produces: `{status:'ok',provider,items:[{name,url,type,size,source}]}` or `{status:'error',code,message}`.

- [ ] **Step 1: Create exact Worker project config**

`download-worker/wrangler.toml`:

```toml
name = "tifloacosta-download-analyzer"
main = "src/index.js"
compatibility_date = "2026-09-18"
workers_dev = false
routes = [
  { pattern = "download.tifloacosta.com", custom_domain = true }
]
```

`download-worker/package.json`:

```json
{
  "private": true,
  "type": "module",
  "scripts": { "test": "node --test", "deploy": "wrangler deploy" },
  "devDependencies": { "wrangler": "latest" }
}
```

- [ ] **Step 2: Write failing security tests**

Test rejection of: `localhost`, `127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`, `::1`, `.local`, cloud metadata hostnames, and schemes other than HTTP/HTTPS.

- [ ] **Step 3: Write failing provider tests**

Test all nine named providers plus `nameFromHeaders`, `fileTypeFrom` and deduplication inputs.

- [ ] **Step 4: Implement security boundary**

`security.js` exports `validatePublicUrl(value)` and `safeRedirectTarget(value)`. `index.js` must use `redirect:'manual'`, validate every `Location`, follow at most 5 redirects and apply an 8-second `AbortController`.

- [ ] **Step 5: Implement provider/file helpers**

`providers.js` exports `detectProvider(url)`, `fileTypeFrom(name,contentType)`, `nameFromHeaders(url,headers)`, `isLikelyDownloadLink(url,attrs)`.

- [ ] **Step 6: Implement `/analyze`**

Requirements:
- accept only `POST` and `OPTIONS`;
- CORS allowlist exactly `https://tifloacosta.com` and `https://tifloacosta.github.io`;
- reject missing/invalid JSON URL;
- never append the analyzed URL to the Worker endpoint URL;
- detect direct file response from `content-disposition` or non-HTML content type;
- for HTML, use `HTMLRewriter` on `a[href]`, resolve relative links against final URL, deduplicate and return max 200 candidates;
- process at most 1 MB of HTML;
- never execute remote JavaScript;
- never proxy/download complete files;
- do not log the full analyzed URL.

- [ ] **Step 7: Run Worker tests and commit**

```bash
cd download-worker
npm test
```
Expected: PASS.

```bash
git add download-worker
git commit -m "feat: add secure download analyzer worker"
```

---

### Task 5: Conectar app y Worker con fallback

**Files:**
- Create: `download-config.js`
- Modify: `downloads.js`
- Modify: `index.html`
- Create: `test/downloads-analyzer.test.mjs`

**Interfaces:**
- Consumes: `window.TIFLO_DOWNLOAD_CONFIG.endpoint`.
- Produces: `POST` al Worker, errores accesibles y fallback local.

- [ ] **Step 1: Write failing tests**

Verify that the source uses `POST`, JSON body `{url:...}`, never query-string transport for the analyzed URL, and keeps local results when `fetch` fails.

- [ ] **Step 2: Create exact config**

```js
window.TIFLO_DOWNLOAD_CONFIG = Object.freeze({
  endpoint: 'https://download.tifloacosta.com/analyze'
});
```

- [ ] **Step 3: Implement analyzer call**

```js
const response = await fetch(config.endpoint, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ url: normalized.href })
});
```

Map `invalid_url`, `authentication_required`, `timeout`, `unreachable`, `no_files`, `unsupported`, `bad_response`, `service_unavailable` to distinct ES/EN messages. If the Worker is unreachable, direct files/Drive/Dropbox must still work.

- [ ] **Step 4: Load config in order**

```html
<script src="downloads-core.js?v=1.0"></script>
<script src="download-config.js?v=1.0"></script>
<script src="downloads.js?v=1.0"></script>
```

- [ ] **Step 5: Run green and commit**
Run: `npm test`
Expected: PASS.

```bash
git add download-config.js downloads.js index.html test/downloads-analyzer.test.mjs
git commit -m "feat: connect download analyzer with fallback"
```

---

### Task 6: PWA y privacidad

**Files:**
- Modify: `sw.js`
- Modify: `privacidad/index.html`
- Create: `test/downloads-privacy.test.mjs`

**Interfaces:**
- Produces: caché actualizado y política coherente con el tratamiento temporal de URLs.

- [ ] **Step 1: Write failing tests**

Require `sw.js` to cache `downloads-core.js`, `download-config.js`, `downloads.js`. Require privacy text to state: URL sent only on Analyze; transient processing/no history DB; no credentials; no file storage/proxy; final download from original server.

- [ ] **Step 2: Update Service Worker**

Bump `CACHE` to a new unique name and add the three scripts to `SHELL`.

- [ ] **Step 3: Update privacy in ES and EN**

Add a dedicated **Descargar desde un enlace** section and equivalent English summary. Use the real publication date shown on the page.

- [ ] **Step 4: Review Google Play Data Safety before changing Console**

Determine whether transient URL processing changes any declaration. Do not alter Play Console during closed testing unless the new behavior actually requires a material declaration change; if it does, prepare the exact declaration changes first.

- [ ] **Step 5: Run green and commit**
Run: `npm test`
Expected: PASS.

```bash
git add sw.js privacidad/index.html test/downloads-privacy.test.mjs
git commit -m "docs: disclose download analyzer privacy behavior"
```

---

### Task 7: Despliegue gratuito del Worker

**Files:**
- No app code changes unless deployment reveals an endpoint/configuration defect.

**Interfaces:**
- Produces: `https://download.tifloacosta.com/analyze` reachable over HTTPS.

- [ ] **Step 1: Confirm no-cost path**

Before deployment, verify Cloudflare Workers allows this Worker/custom domain on the free tier without buying a plan or adding a paid feature. If not, stop deployment and keep local-only mode until a free alternative is chosen.

- [ ] **Step 2: Deploy**

From `download-worker` run:

```bash
npm install
npm run deploy
```

Authorize Cloudflare only through its official login flow. Never paste Cloudflare credentials into TifloAcosta or repo files.

- [ ] **Step 3: Smoke-test exact endpoint**

POST to `https://download.tifloacosta.com/analyze` with body:

```json
{"url":"https://example.com/manual.pdf"}
```

Expected: structured JSON (`ok` or a defined error), never an unstructured HTML error page.

- [ ] **Step 4: Verify CORS from production origin**

Open TifloAcosta and analyze one generic public page; browser request from `https://tifloacosta.com` must succeed.

---

### Task 8: Acceptance before the workshop

**Files:**
- Create regression tests only for defects actually found.

**Interfaces:**
- Consumes: deployed app and Worker.
- Produces: a demonstrable first release plus an honest list of provider limits.

- [ ] **Step 1: Automated suite**
Run: `npm test`
Expected: 0 failures.

- [ ] **Step 2: Provider matrix**

Test direct public file, Google Drive, Dropbox, OneDrive, iCloud Drive, Box, MEGA, WeTransfer, MediaFire and pCloud. If a provider requires its own site/authentication/JavaScript, report exactly that; do not label it direct-download capable unless it actually works.

- [ ] **Step 3: Generic-page matrix**

Test one-file page, multiple-file page, many-file page, page with no files, broken URL and Worker timeout. Confirm all found files remain available and filters/search only change the visible subset.

- [ ] **Step 4: External-auth flow**

Confirm accessible warning before leaving, no credential fields inside TifloAcosta, pending URL preserved locally, and **Reintentar análisis** available after return.

- [ ] **Step 5: Accessibility**

Verify keyboard navigation and JAWS/NVDA on Windows; VoiceOver on iPhone; TalkBack on Android. Confirm status announcements, heading navigation, form labels, focus on result heading after success, and no focus jump when filtering.

- [ ] **Step 6: Spanish/English**

Switch language while the section is open and verify title, labels, states, errors, filters, buttons and external warning.

- [ ] **Step 7: Production deployment**

Confirm GitHub Pages build/deploy success and verify `https://tifloacosta.com/#downloads` after Service Worker refresh. Do not claim completion until the live page, tests and Worker endpoint have all been checked.
