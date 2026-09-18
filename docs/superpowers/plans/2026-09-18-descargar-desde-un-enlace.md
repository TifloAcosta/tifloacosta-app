# Descargar desde un enlace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir a TifloAcosta una sección accesible de primer nivel capaz de analizar enlaces públicos, resolver descargas directas cuando sea posible y listar todos los archivos detectados sin almacenar ni retransmitir los archivos.

**Architecture:** La app tendrá una capa local en JavaScript para validar URLs, reconocer proveedores conocidos, resolver enlaces directos y filtrar resultados. Cuando la capa local no sea suficiente, llamará por `POST` a un analizador serverless en Cloudflare Workers que seguirá redirecciones de forma controlada, detectará respuestas de archivo y extraerá enlaces descargables de HTML sin ejecutar JavaScript remoto. La descarga final siempre saldrá desde el servidor original.

**Tech Stack:** HTML, CSS, JavaScript sin dependencias en la app, Node `node:test`, Cloudflare Workers para la capa externa, HTTPS.

**Spec:** `docs/superpowers/specs/2026-09-18-descargar-desde-un-enlace-design.md`

## Global Constraints
- La nueva sección se llamará **Descargar desde un enlace** / **Download from a link**.
- Debe funcionar en español e inglés desde la primera versión.
- TifloAcosta no pedirá ni almacenará credenciales.
- TifloAcosta no almacenará ni retransmitirá archivos descargados.
- La URL solo se enviará al analizador cuando la persona pulse **Analizar enlace**.
- El analizador no ejecutará JavaScript remoto ni intentará eludir autenticación, paywalls o protecciones anticopia.
- Los resultados mostrarán todos los archivos detectados; la app no elegirá uno automáticamente.
- La app seguirá resolviendo enlaces directos y reglas locales aunque el analizador externo esté fuera de servicio.
- La versión Android 2 (1.0.1) no se tocará si la funcionalidad puede servirse desde el contenido web remoto.
- Cloudflare Workers solo se desplegará si puede utilizarse sin contratar un plan de pago.

---

### Task 1: Crear y probar el núcleo local de descargas

**Files:**
- Create: `downloads-core.js`
- Create: `test/downloads-core.test.mjs`

**Interfaces:**
- Consumes: cadenas URL introducidas por la persona usuaria.
- Produces: `window.TIFLO_DOWNLOAD_CORE` y `module.exports` con `normalizeUrl(value)`, `classifyUrl(value)`, `resolveLocal(value)`, `filterResults(items, query, type)`, `formatBytes(bytes)`.

- [ ] **Step 1: Write the failing tests**

Crear `test/downloads-core.test.mjs` con casos concretos:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import core from '../downloads-core.js';

test('rejects non-http URLs', () => {
  assert.equal(core.normalizeUrl('javascript:alert(1)'), null);
  assert.equal(core.normalizeUrl('file:///tmp/test.pdf'), null);
});

test('classifies supported providers', () => {
  assert.equal(core.classifyUrl('https://drive.google.com/file/d/abc123/view').provider, 'google-drive');
  assert.equal(core.classifyUrl('https://www.dropbox.com/scl/fi/abc/file.pdf?rlkey=x&dl=0').provider, 'dropbox');
  assert.equal(core.classifyUrl('https://1drv.ms/u/s!abc').provider, 'onedrive');
  assert.equal(core.classifyUrl('https://www.icloud.com/iclouddrive/abc').provider, 'icloud-drive');
  assert.equal(core.classifyUrl('https://app.box.com/s/abc').provider, 'box');
  assert.equal(core.classifyUrl('https://mega.nz/file/abc#key').provider, 'mega');
  assert.equal(core.classifyUrl('https://we.tl/t-abc').provider, 'wetransfer');
  assert.equal(core.classifyUrl('https://www.mediafire.com/file/abc/test.zip/file').provider, 'mediafire');
  assert.equal(core.classifyUrl('https://u.pcloud.link/publink/show?code=abc').provider, 'pcloud');
});

test('resolves public Drive and Dropbox share URLs locally', () => {
  const drive = core.resolveLocal('https://drive.google.com/file/d/abc123/view');
  assert.equal(drive.kind, 'result');
  assert.match(drive.items[0].url, /drive\.google\.com\/uc\?export=download&id=abc123/);

  const dropbox = core.resolveLocal('https://www.dropbox.com/scl/fi/abc/file.pdf?rlkey=x&dl=0');
  assert.equal(dropbox.kind, 'result');
  assert.equal(new URL(dropbox.items[0].url).searchParams.get('dl'), '1');
});

test('recognizes a direct file URL', () => {
  const result = core.resolveLocal('https://example.org/files/manual.pdf');
  assert.equal(result.kind, 'result');
  assert.equal(result.items[0].type, 'pdf');
});

test('filters without losing the original result set', () => {
  const items = [
    { name: 'manual.pdf', type: 'pdf' },
    { name: 'audio.mp3', type: 'audio' },
    { name: 'guide.docx', type: 'document' }
  ];
  assert.deepEqual(core.filterResults(items, 'man', 'all').map(x => x.name), ['manual.pdf']);
  assert.deepEqual(core.filterResults(items, '', 'audio').map(x => x.name), ['audio.mp3']);
  assert.equal(items.length, 3);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/downloads-core.test.mjs`

Expected: FAIL porque `downloads-core.js` no existe.

- [ ] **Step 3: Implement the minimal core**

Crear `downloads-core.js` con patrón UMD igual al resto del proyecto:

```js
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.TIFLO_DOWNLOAD_CORE = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const directExtensions = new Set([
    'pdf','zip','rar','7z','txt','doc','docx','xls','xlsx','ppt','pptx',
    'epub','mp3','m4a','wav','ogg','mp4','m4v','mov','webm','apk','csv','json'
  ]);

  function normalizeUrl(value) {
    try {
      const url = new URL(String(value || '').trim());
      return ['http:', 'https:'].includes(url.protocol) ? url : null;
    } catch { return null; }
  }

  function classifyUrl(value) {
    const url = normalizeUrl(value);
    if (!url) return { provider: 'invalid', url: null };
    const host = url.hostname.toLowerCase();
    const providers = [
      [/drive\.google\.com$/, 'google-drive'], [/dropbox\.com$/, 'dropbox'],
      [/(^|\.)1drv\.ms$|onedrive\.live\.com$/, 'onedrive'], [/icloud\.com$/, 'icloud-drive'],
      [/box\.com$/, 'box'], [/mega\.nz$/, 'mega'], [/(^|\.)we\.tl$|wetransfer\.com$/, 'wetransfer'],
      [/mediafire\.com$/, 'mediafire'], [/pcloud\.link$|pcloud\.com$/, 'pcloud']
    ];
    for (const [pattern, provider] of providers) if (pattern.test(host)) return { provider, url };
    const ext = url.pathname.split('.').pop().toLowerCase();
    return { provider: directExtensions.has(ext) ? 'direct' : 'web', url };
  }

  // resolveLocal, filterResults y formatBytes se implementan sin mutar entradas.
  return { normalizeUrl, classifyUrl, resolveLocal, filterResults, formatBytes };
}));
```

`resolveLocal` debe transformar Google Drive `/file/d/<id>/...` a `https://drive.google.com/uc?export=download&id=<id>`, cambiar `dl=0` a `dl=1` en Dropbox y devolver `{ kind:'needs-analyzer', provider, url }` para proveedores que no puedan resolverse localmente.

- [ ] **Step 4: Run tests**

Run: `node --test test/downloads-core.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add downloads-core.js test/downloads-core.test.mjs
git commit -m "feat: add local download resolver"
```

---

### Task 2: Añadir la sección accesible a Inicio

**Files:**
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `actualidad-core.js`
- Modify: `test/clean-home.test.mjs`
- Create: `test/downloads-surface.test.mjs`

**Interfaces:**
- Consumes: `#home-blocks`, navegación por hash y estilos existentes.
- Produces: ruta `#downloads`, sección `#downloads-section`, controles semánticos y retorno a Inicio.

- [ ] **Step 1: Write failing surface tests**

Añadir verificaciones como:

```js
assert.match(html, /id="home-open-downloads"[^>]*href="#downloads"/);
assert.match(html, /<section id="downloads-section"[^>]*hidden[^>]*aria-labelledby="downloads-heading"/);
assert.match(html, /<label for="download-url">Pega aquí el enlace<\/label>/);
assert.match(html, /id="download-status"[^>]*aria-live="polite"[^>]*aria-atomic="true"/);
assert.match(html, /id="download-results-heading"/);
assert.match(html, /data-home-back/);
```

Y en `test/clean-home.test.mjs` exigir `home-open-downloads`.

- [ ] **Step 2: Run tests**

Run: `npm test`

Expected: FAIL por ausencia de la nueva sección.

- [ ] **Step 3: Add the HTML view**

En `index.html`, añadir un botón de navegación al mismo nivel que Recursos y Vídeos y una sección con esta estructura mínima:

```html
<section id="downloads-section" hidden tabindex="-1" aria-labelledby="downloads-heading">
  <p><a class="button-link back-link" href="#home" data-home-back>Volver al inicio</a></p>
  <h2 id="downloads-heading">Descargar desde un enlace</h2>
  <p id="downloads-intro">Pega un enlace público o compartido y TifloAcosta intentará localizar los archivos descargables disponibles.</p>
  <form id="download-form">
    <label for="download-url">Pega aquí el enlace</label>
    <div class="search-row">
      <input id="download-url" type="url" inputmode="url" autocomplete="off">
      <button id="download-analyze" type="submit">Analizar enlace</button>
    </div>
  </form>
  <p id="download-status" class="muted" aria-live="polite" aria-atomic="true"></p>
  <section id="download-results-section" hidden aria-labelledby="download-results-heading">
    <h3 id="download-results-heading" tabindex="-1">Archivos encontrados</h3>
    <label for="download-result-search">Buscar entre los archivos encontrados</label>
    <input id="download-result-search" type="search" autocomplete="off">
    <label for="download-type-filter">Tipo de archivo</label>
    <select id="download-type-filter"><option value="all">Todos</option></select>
    <p id="download-result-count" class="muted"></p>
    <div id="download-results" class="download-results"></div>
  </section>
  <div id="download-external-panel" class="panel" hidden></div>
  <p><a class="button-link back-link" href="#home" data-home-back>Volver al inicio</a></p>
</section>
```

- [ ] **Step 4: Wire navigation**

En `actualidad-core.js`, añadir `downloads: 'downloads-section'` a `resolveIsolatedView('home', ...)` y `downloads-section` a `viewIds` dentro de `applyHomeIsolation`.

- [ ] **Step 5: Add focused styles**

En `styles.css`, añadir únicamente estilos para `.download-results`, `.download-result-card`, `.download-result-meta` y el panel externo, reutilizando variables de color y el patrón de tarjetas existente.

- [ ] **Step 6: Run tests and commit**

Run: `npm test`

Expected: PASS.

```bash
git add index.html styles.css actualidad-core.js test/clean-home.test.mjs test/downloads-surface.test.mjs
git commit -m "feat: add accessible download section"
```

---

### Task 3: Implementar la interacción local, resultados, filtros y retorno externo

**Files:**
- Create: `downloads.js`
- Modify: `index.html`
- Create: `test/downloads-ui.test.mjs`

**Interfaces:**
- Consumes: `window.TIFLO_DOWNLOAD_CORE`, DOM de `#downloads-section`, `localStorage`.
- Produces: análisis local, render de resultados, filtros, mensajes ES/EN, persistencia `tifloDownloadPendingV1`.

- [ ] **Step 1: Write failing integration/source tests**

Probar que `downloads.js` contenga y utilice:

```js
assert.match(source, /const PENDING_KEY = 'tifloDownloadPendingV1'/);
assert.match(source, /status\.setAttribute\('aria-live',\s*'polite'\)/);
assert.match(source, /resultsHeading\.focus\(\)/);
assert.match(source, /core\.resolveLocal/);
assert.match(source, /core\.filterResults/);
assert.match(source, /localStorage\.setItem\(PENDING_KEY/);
assert.match(source, /Reintentar análisis|Retry analysis/);
```

- [ ] **Step 2: Run test and confirm failure**

Run: `node --test test/downloads-ui.test.mjs`

Expected: FAIL porque `downloads.js` no existe.

- [ ] **Step 3: Implement bilingual UI controller**

`downloads.js` tendrá una tabla `copyByLanguage` con todos los textos, `currentLanguage()`, `renderResults(items)`, `renderExternalNotice(provider, url)`, `applyFilters()`, `analyze(value)` y `restorePending()`.

Reglas de foco:
- URL inválida: foco en `#download-status` solo si se convierte temporalmente en `tabindex="-1"`.
- Resultados encontrados: foco en `#download-results-heading`.
- Autenticación/salida externa: foco en el encabezado del panel externo.
- Cambio de filtro: no mover foco.

El aviso de salida debe incluir exactamente el significado acordado: la persona sale de TifloAcosta, la accesibilidad/funcionamiento del destino depende del proveedor y TifloAcosta no recibe ni guarda credenciales.

- [ ] **Step 4: Load scripts in the correct order**

En `index.html`, antes de `app.js`:

```html
<script src="downloads-core.js?v=1.0"></script>
<script src="downloads.js?v=1.0"></script>
```

- [ ] **Step 5: Run tests and commit**

Run: `npm test`

Expected: PASS.

```bash
git add downloads.js index.html test/downloads-ui.test.mjs
git commit -m "feat: add download analysis interface"
```

---

### Task 4: Construir el analizador de Cloudflare Workers con límites de seguridad

**Files:**
- Create: `download-worker/wrangler.toml`
- Create: `download-worker/package.json`
- Create: `download-worker/src/security.js`
- Create: `download-worker/src/providers.js`
- Create: `download-worker/src/index.js`
- Create: `download-worker/test/security.test.mjs`
- Create: `download-worker/test/providers.test.mjs`

**Interfaces:**
- Consumes: `POST` JSON `{ "url": "https://..." }`.
- Produces: JSON estable:

```json
{
  "status": "ok",
  "provider": "web",
  "items": [
    { "name": "manual.pdf", "url": "https://...", "type": "pdf", "size": null, "source": "example.org" }
  ]
}
```

Errores usan:

```json
{ "status": "error", "code": "invalid_url", "message": "..." }
```

- [ ] **Step 1: Write security tests**

`security.test.mjs` debe rechazar `localhost`, `127.0.0.1`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`, `::1`, esquemas no HTTP/HTTPS, hostnames `.local` y hostnames de metadatos cloud conocidos.

- [ ] **Step 2: Write provider tests**

Probar clasificación de Drive, Dropbox, OneDrive, iCloud Drive, Box, MEGA, WeTransfer, MediaFire y pCloud y extracción de nombre/tipo desde `content-disposition`, `content-type` y URL.

- [ ] **Step 3: Run worker tests to verify failure**

Run:

```bash
cd download-worker
npm test
```

Expected: FAIL porque aún no existen los módulos.

- [ ] **Step 4: Implement request validation**

`security.js` exportará `validatePublicUrl(value)` y `safeRedirectTarget(value)`. No se seguirá ninguna redirección automáticamente: `index.js` usará `redirect: 'manual'`, validará cada `Location` y limitará a 5 saltos.

- [ ] **Step 5: Implement provider helpers**

`providers.js` exportará `detectProvider(url)`, `fileTypeFrom(name, contentType)`, `nameFromHeaders(url, headers)` y `isLikelyDownloadLink(url, attrs)`.

- [ ] **Step 6: Implement worker endpoint**

`src/index.js` debe:
- aceptar solo `POST` y `OPTIONS`;
- permitir CORS únicamente desde `https://tifloacosta.com` y la URL GitHub Pages de TifloAcosta durante pruebas;
- limitar cuerpo JSON a una URL;
- aplicar un `AbortController` de 8 segundos;
- leer como máximo 1 MB de HTML;
- devolver inmediatamente un resultado cuando la respuesta sea un archivo por `content-disposition` o `content-type` no HTML;
- para HTML usar `HTMLRewriter` y recopilar `a[href]` sin ejecutar scripts;
- resolver enlaces relativos contra la URL final;
- eliminar duplicados por URL;
- devolver como máximo 200 resultados por análisis;
- no registrar la URL completa en logs de aplicación.

- [ ] **Step 7: Run tests**

Run: `cd download-worker && npm test`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add download-worker
git commit -m "feat: add secure download analyzer worker"
```

---

### Task 5: Conectar la app al analizador externo con fallback local

**Files:**
- Create: `download-config.js`
- Modify: `downloads.js`
- Modify: `index.html`
- Create: `test/downloads-analyzer.test.mjs`

**Interfaces:**
- Consumes: `window.TIFLO_DOWNLOAD_CONFIG.endpoint` y respuesta JSON del Worker.
- Produces: llamada `POST`, mezcla segura de resultados y errores accesibles diferenciados.

- [ ] **Step 1: Write failing tests**

Exigir que la app use `POST`, `Content-Type: application/json`, no incluya la URL analizada en el endpoint y tenga fallback cuando `fetch` falle.

- [ ] **Step 2: Implement endpoint config**

Crear:

```js
window.TIFLO_DOWNLOAD_CONFIG = Object.freeze({
  endpoint: ''
});
```

El endpoint quedará vacío hasta que el Worker gratuito esté desplegado. Con endpoint vacío, la sección seguirá resolviendo Drive, Dropbox y archivos directos y mostrará un mensaje específico cuando una página requiera el analizador externo.

- [ ] **Step 3: Implement analyzer call**

En `downloads.js`:

```js
const response = await fetch(config.endpoint, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ url: normalized.href })
});
```

Mapear códigos `invalid_url`, `authentication_required`, `timeout`, `unreachable`, `no_files`, `unsupported`, `bad_response` y `service_unavailable` a textos ES/EN distintos.

- [ ] **Step 4: Load config before UI controller**

Orden en `index.html`:

```html
<script src="downloads-core.js?v=1.0"></script>
<script src="download-config.js?v=1.0"></script>
<script src="downloads.js?v=1.0"></script>
```

- [ ] **Step 5: Run full suite and commit**

Run: `npm test`

Expected: PASS.

```bash
git add download-config.js downloads.js index.html test/downloads-analyzer.test.mjs
git commit -m "feat: connect download analyzer with fallback"
```

---

### Task 6: Actualizar caché PWA y privacidad

**Files:**
- Modify: `sw.js`
- Modify: `privacidad/index.html`
- Create: `test/downloads-privacy.test.mjs`

**Interfaces:**
- Consumes: nuevos scripts de descargas y comportamiento de privacidad aprobado.
- Produces: actualización visible y política coherente con el tratamiento temporal de URLs.

- [ ] **Step 1: Write failing tests**

Comprobar que `sw.js` incluye `downloads-core.js`, `download-config.js` y `downloads.js`, y que la política explica:
- la URL se envía al analizador solo al pulsar Analizar;
- el tratamiento es temporal y sin base de datos de historial;
- no se reciben credenciales;
- los archivos no se almacenan ni retransmiten;
- la descarga final procede del servidor original.

- [ ] **Step 2: Update service worker**

Cambiar el nombre de caché a una nueva versión y añadir los tres scripts nuevos a `SHELL`.

- [ ] **Step 3: Update privacy page**

Añadir un apartado `Descargar desde un enlace` en español y su resumen equivalente en inglés. Mantener la fecha de actualización en 18 de septiembre de 2026 si se publica hoy; si se publica otro día, usar la fecha real de publicación.

- [ ] **Step 4: Review Google Play Data Safety impact**

Documentar en el commit/plan de publicación si la URL enviada al Worker entra en una categoría declarable. No modificar Play Console automáticamente durante la prueba cerrada; si la declaración necesita cambio material, preparar el texto exacto antes de tocarla.

- [ ] **Step 5: Run tests and commit**

Run: `npm test`

Expected: PASS.

```bash
git add sw.js privacidad/index.html test/downloads-privacy.test.mjs
git commit -m "docs: disclose download analyzer privacy behavior"
```

---

### Task 7: Desplegar el Worker gratuito y conectar el endpoint

**Files:**
- Modify: `download-config.js`
- Optional modify after deployment: `download-worker/wrangler.toml` only if the real Worker name/domain differs.

**Interfaces:**
- Consumes: cuenta Cloudflare del dominio TifloAcosta.
- Produces: endpoint HTTPS público del analizador, sin plan de pago.

- [ ] **Step 1: Confirm free deployment path before creating anything**

En Cloudflare, comprobar que Workers permite desplegar este Worker en el nivel gratuito sin introducir método de pago ni contratar plan. Si Cloudflare exige coste, detener este task y mantener la app en modo local hasta elegir otra plataforma gratuita.

- [ ] **Step 2: Deploy the Worker**

Usar `wrangler deploy` o el editor de Workers de Cloudflare con el contenido de `download-worker/src`. El endpoint debe quedar en HTTPS.

- [ ] **Step 3: Smoke-test the endpoint**

Enviar manualmente:

```json
{"url":"https://example.com/manual.pdf"}
```

Expected: `status: "ok"` o una respuesta de error estructurada, nunca HTML de error sin formato.

- [ ] **Step 4: Put endpoint in config**

Actualizar `download-config.js` con la URL real, por ejemplo:

```js
window.TIFLO_DOWNLOAD_CONFIG = Object.freeze({
  endpoint: 'https://<worker-real>.workers.dev/analyze'
});
```

- [ ] **Step 5: Run tests and commit**

Run: `npm test`

Expected: PASS.

```bash
git add download-config.js
git commit -m "config: enable download analyzer endpoint"
```

---

### Task 8: Verificación funcional y accesible antes del taller

**Files:**
- No production changes unless a failing acceptance test reveals a defect.
- Create when useful: `test/downloads-regression.test.mjs` for any bug found during verification.

**Interfaces:**
- Consumes: app desplegada en `https://tifloacosta.com/` y endpoint del Worker.
- Produces: primera versión demostrable y lista de límites conocidos reales.

- [ ] **Step 1: Run automated suite**

Run: `npm test`

Expected: 0 fallos.

- [ ] **Step 2: Verify direct and known-provider cases**

Probar al menos: archivo directo, Google Drive público, Dropbox público, OneDrive público, iCloud Drive público, Box público, MEGA público, WeTransfer público, MediaFire público y pCloud público. Registrar como “requiere servicio externo” cualquier proveedor cuya descarga pública no pueda resolverse sin autenticación o JavaScript remoto; no fingir soporte inexistente.

- [ ] **Step 3: Verify generic web-page analysis**

Probar una página con un archivo, una con varios, una sin archivos y una URL rota. Confirmar que la lista muestra todos los resultados detectados y que búsqueda/filtro no alteran el conjunto original.

- [ ] **Step 4: Verify external-auth flow**

Usar un enlace que exija identificación. Confirmar: aviso previo accesible, salida al proveedor, ninguna petición de contraseña dentro de TifloAcosta, URL original conservada y botón **Reintentar análisis** al volver.

- [ ] **Step 5: Verify keyboard and screen-reader behavior**

En escritorio: JAWS y NVDA con Tab, Shift+Tab, H y formularios. En iPhone: VoiceOver, rotor de encabezados y controles de formulario. En Android: TalkBack, exploración lineal y controles. Confirmar que cada análisis anuncia estado y que los resultados colocan el foco en el encabezado de resultados, no en un punto arbitrario.

- [ ] **Step 6: Verify ES/EN**

Cambiar de idioma con la sección abierta y comprobar título, etiquetas, estados, errores, botones, filtros y aviso externo.

- [ ] **Step 7: Verify GitHub Pages deployment**

Confirmar que el workflow de Pages termina en `success` y que `https://tifloacosta.com/#downloads` carga la sección nueva con los scripts actuales, no una copia antigua del Service Worker.

- [ ] **Step 8: Commit only fixes backed by a regression test**

Por cada fallo real encontrado, añadir primero una prueba que reproduzca el defecto, ejecutarla en rojo, aplicar la corrección mínima y volver a ejecutar `npm test` antes de integrar.
