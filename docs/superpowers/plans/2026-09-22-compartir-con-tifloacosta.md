# Compartir con TifloAcosta Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir a la app Android de TifloAcosta un flujo nativo de Compartir para texto y enlaces que clasifique el contenido, reutilice vídeo/Descargas/búsqueda y permita leer páginas externas en modo limpio y accesible.

**Architecture:** Android recibe `ACTION_SEND` mediante un plugin Capacitor propio y obtiene páginas externas mediante un segundo plugin nativo limitado y sin cookies del navegador. La capa JavaScript mantiene una sesión efímera separada de la navegación normal, clasifica enlaces de forma determinista, renderiza una lectura segura a partir de un modelo propio y reutiliza las funciones existentes mediante adaptadores explícitos.

**Tech Stack:** Android Java, Capacitor 8.5.2, JavaScript ESM, Node.js 22 `node:test`, Gradle/Android SDK, YouTube IFrame API existente.

**Spec:** `docs/superpowers/specs/2026-09-21-compartir-con-tifloacosta-design.md`

## Global Constraints

- Android nativo en esta primera versión; no iOS ni Web Share Target.
- Solo `ACTION_SEND` con texto/enlaces; no archivos binarios ni `ACTION_SEND_MULTIPLE`.
- `TifloSharePlugin` recibe Intents y finaliza la sesión; no clasifica ni descarga páginas.
- `TifloWebFetchPlugin` solo acepta HTTP/HTTPS, máximo 5 redirecciones, 15 segundos totales, 5 MiB y tipos `text/html`, `application/xhtml+xml` o `text/plain`.
- El HTML remoto nunca se inyecta directamente con `innerHTML`; se transforma primero a un modelo seguro y luego a nodos creados por TifloAcosta.
- No se ejecuta JavaScript remoto, no se reutilizan cookies/sesiones de navegador y no se envían las URLs compartidas al backend de TifloAcosta para lectura limpia.
- No hay reproducción automática, descargas automáticas, locuciones propias ni sonidos de confirmación.
- La lectura normal no muestra “Abrir página original”; si el reproductor de YouTube falla, sí puede ofrecer “Abrir en YouTube” como salida de emergencia.
- La interfaz debe estar en español e inglés y conservar foco, semántica, regiones de estado y nombres de controles comprensibles con lector de pantalla.
- Un nuevo `ACTION_SEND` reemplaza por completo cualquier sesión de Compartir anterior.
- Al finalizar, la sesión se destruye y Android ejecuta `moveTaskToBack(true)`; la app normal conserva su estado previo.

## Review Focus

- Texto de WhatsApp con puntuación alrededor de una URL o dos URLs en una sola línea: extraer URLs limpias, no tragarse comas/paréntesis y no procesar ambas a la vez.
- URL de YouTube con parámetros adicionales, `youtu.be`, Shorts o redirección corta: terminar en el mismo identificador de vídeo y nunca reproducir automáticamente.
- Página índice cuyo contenido principal son enlaces útiles: conservar esos enlaces aunque no tenga muchos párrafos y volver a clasificar cada destino al activarlo.
- Página hostil o enorme: detener por tipo, tamaño, timeout o exceso de redirecciones sin bloquear la interfaz ni inyectar HTML remoto.
- Nuevo contenido compartido mientras TifloAcosta ya tiene una sesión activa: cancelar estado/reproductor/solicitud anterior y empezar una sesión limpia.

---

## File Structure

### Nuevos archivos

- `mobile/src/core/share-classifier.mjs` — extracción de URLs y clasificación determinista.
- `mobile/src/core/share-session.mjs` — estado efímero, selección de enlaces e historial de lectura.
- `mobile/src/core/readable-page.mjs` — HTML no fiable → modelo seguro de lectura.
- `mobile/src/native/share-plugin.mjs` — wrapper JS de `TifloSharePlugin`.
- `mobile/src/native/web-fetch-plugin.mjs` — wrapper JS de `TifloWebFetchPlugin`.
- `mobile/src/screens/share.mjs` — pantalla accesible de recepción, clasificación, lectura y errores.
- `mobile/src/screens/video-player.mjs` — reproductor accesible reutilizable, extraído de `videos.mjs`.
- `mobile/android/app/src/main/java/com/tifloacosta/app/TifloSharePlugin.java` — recepción de Intents y salida de la sesión.
- `mobile/android/app/src/main/java/com/tifloacosta/app/TifloWebFetchPlugin.java` — obtención HTTP limitada y segura.
- `mobile/test/share-classifier.test.mjs`
- `mobile/test/share-session.test.mjs`
- `mobile/test/readable-page.test.mjs`
- `mobile/test/share-native-bootstrap.test.mjs`
- `mobile/test/share-screen.test.mjs`
- `mobile/test/share-integration.test.mjs`

### Archivos modificados

- `mobile/android/app/src/main/AndroidManifest.xml` — `ACTION_SEND` `text/plain`.
- `mobile/android/app/src/main/java/com/tifloacosta/app/MainActivity.java` — registrar ambos plugins.
- `mobile/src/core/router.mjs` — snapshot/restore de la pila normal.
- `mobile/src/core/native-actions.mjs` — acciones `finishSharedFlow` y helpers nativos de Compartir.
- `mobile/src/core/i18n.mjs` — copias ES/EN del flujo.
- `mobile/src/screens/videos.mjs` — usar el reproductor reutilizable.
- `mobile/src/screens/download-link.mjs` — aceptar URL inicial y ejecución controlada desde Compartir.
- `mobile/src/screens/search.mjs` — aceptar consulta inicial sin buscar automáticamente.
- `mobile/src/app.mjs` — composición, eventos nativos, rutas del flujo y back handler.
- `mobile/test/navigation.test.mjs`, `mobile/test/native-actions.test.mjs`, `mobile/test/download-link-screen.test.mjs`, `mobile/test/app-shell.test.mjs` — regresiones y nuevas interfaces.

---

### Task 1: Clasificador de contenido compartido

**Files:**
- Create: `mobile/src/core/share-classifier.mjs`
- Create: `mobile/test/share-classifier.test.mjs`

**Interfaces:**
- Consumes: `resolveLocal(url)` desde `mobile/src/core/downloads.mjs` mediante inyección para no acoplar el clasificador al analizador.
- Produces:
  - `extractHttpUrls(text: string): string[]`
  - `youtubeVideoId(url: string): string`
  - `classifySharedUrl(url: string, { resolveDownload }): { kind: 'youtube'|'download'|'web'|'invalid', url: string, videoId?: string }`
  - `classifySharedText(text: string, options): { kind: 'text'|'single-url'|'multi-url', text: string, urls: string[], classification?: object }`

- [ ] **Step 1: Write the failing tests for extraction and classification**

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { extractHttpUrls, youtubeVideoId, classifySharedText, classifySharedUrl } from '../src/core/share-classifier.mjs';

test('extractHttpUrls trims punctuation without damaging query strings', () => {
  assert.deepEqual(
    extractHttpUrls('Mira (https://example.com/a?x=1&y=2), y luego https://example.org/b.'),
    ['https://example.com/a?x=1&y=2', 'https://example.org/b']
  );
});

test('youtubeVideoId accepts watch, youtu.be and shorts URLs', () => {
  assert.equal(youtubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30'), 'dQw4w9WgXcQ');
  assert.equal(youtubeVideoId('https://youtu.be/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(youtubeVideoId('https://www.youtube.com/shorts/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
});

test('classifySharedText never chooses silently when there are several URLs', () => {
  const result = classifySharedText('Uno https://a.example y dos https://b.example', { resolveDownload: () => ({ provider: 'web' }) });
  assert.equal(result.kind, 'multi-url');
  assert.deepEqual(result.urls, ['https://a.example/', 'https://b.example/']);
});

test('classifySharedUrl prefers YouTube, then known downloads, then normal web', () => {
  const resolveDownload = url => url.includes('dropbox.com') ? { provider: 'dropbox', kind: 'provider' } : { provider: 'web', kind: 'web' };
  assert.equal(classifySharedUrl('https://youtu.be/dQw4w9WgXcQ', { resolveDownload }).kind, 'youtube');
  assert.equal(classifySharedUrl('https://www.dropbox.com/s/test/file.pdf', { resolveDownload }).kind, 'download');
  assert.equal(classifySharedUrl('https://example.com/article', { resolveDownload }).kind, 'web');
  assert.equal(classifySharedUrl('javascript:alert(1)', { resolveDownload }).kind, 'invalid');
});
```

- [ ] **Step 2: Run the focused test and verify it fails because the module does not exist**

Run: `cd mobile && node --test test/share-classifier.test.mjs`

Expected: FAIL with module-not-found for `share-classifier.mjs`.

- [ ] **Step 3: Implement the minimal pure classifier**

Use a URL token regex followed by `new URL()` validation, trim terminal `.,;:!?)]}` only when they are outside balanced URL content, normalize to `http:`/`https:` only, recognize YouTube hosts `youtube.com`, `www.youtube.com`, `m.youtube.com`, `music.youtube.com`, `youtu.be`, and support `/watch?v=`, `/shorts/`, `/embed/` and `/live/` 11-character IDs.

```js
export function classifySharedUrl(value, { resolveDownload = () => ({ provider: 'web' }) } = {}) {
  const url = normalizeHttpUrl(value);
  if (!url) return { kind: 'invalid', url: '' };
  const videoId = youtubeVideoId(url);
  if (videoId) return { kind: 'youtube', url, videoId };
  const local = resolveDownload(url);
  if (local?.provider && local.provider !== 'web') return { kind: 'download', url };
  if (local?.kind === 'result' && Array.isArray(local.items) && local.items.length) return { kind: 'download', url };
  return { kind: 'web', url };
}
```

`classifySharedText` must return text untouched except `.trim()`, de-duplicate identical normalized URLs while preserving order, and never auto-select when more than one URL remains.

- [ ] **Step 4: Run classifier tests**

Run: `cd mobile && node --test test/share-classifier.test.mjs`

Expected: PASS.

- [ ] **Step 5: Run the whole mobile suite**

Run: `cd mobile && npm test`

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add mobile/src/core/share-classifier.mjs mobile/test/share-classifier.test.mjs
git commit -m "feat: add shared content classifier"
```

---

### Task 2: Sesión efímera e historial de Compartir

**Files:**
- Create: `mobile/src/core/share-session.mjs`
- Create: `mobile/test/share-session.test.mjs`
- Modify: `mobile/src/core/router.mjs`
- Modify: `mobile/test/navigation.test.mjs`

**Interfaces:**
- Consumes: snapshots de rutas del router.
- Produces:
  - `createShareSession()` con `begin(payload)`, `selectUrl(url)`, `setClassification(value)`, `pushReadable(page)`, `popReadable()`, `setView(view)`, `snapshot()`, `clear()`.
  - `router.snapshot(): Array<{name:string,originId:string|null}>`
  - `router.restore(records, { renderCurrent = true, focus = false } = {}): object|null`

- [ ] **Step 1: Write failing session tests**

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { createShareSession } from '../src/core/share-session.mjs';

test('new begin replaces every field from an older shared session', () => {
  const session = createShareSession();
  session.begin({ text: 'https://first.example', urls: ['https://first.example/'] });
  session.pushReadable({ url: 'https://first.example/', title: 'First', blocks: [] });
  session.begin({ text: 'second', urls: [] });
  const state = session.snapshot();
  assert.equal(state.text, 'second');
  assert.deepEqual(state.urls, []);
  assert.deepEqual(state.readableHistory, []);
  assert.equal(state.view, 'received');
});

test('readable history backs up one page at a time', () => {
  const session = createShareSession();
  session.begin({ text: 'x', urls: ['https://one.example/'] });
  session.pushReadable({ url: 'https://one.example/', title: 'One', blocks: [] });
  session.pushReadable({ url: 'https://two.example/', title: 'Two', blocks: [] });
  assert.equal(session.popReadable().url, 'https://one.example/');
  assert.equal(session.snapshot().readableHistory.length, 1);
});
```

Add router tests that snapshot a multi-route stack, start a temporary route, restore the exact old stack without rendering when `renderCurrent:false`, and preserve origin IDs.

- [ ] **Step 2: Run session and navigation tests**

Run: `cd mobile && node --test test/share-session.test.mjs test/navigation.test.mjs`

Expected: FAIL because the session module and router methods are absent.

- [ ] **Step 3: Implement the share session as in-memory data only**

Keep state in one closure; clone arrays/objects on `snapshot()` so screen code cannot mutate internal state accidentally. `begin()` must increment a numeric `generation` and clear loading/error/readable history, which later lets async handlers ignore stale results from a previous share.

```js
export function createShareSession() {
  let state = emptyState(0);
  return {
    begin(payload = {}) {
      state = { ...emptyState(state.generation + 1), text: String(payload.text || '').trim(), urls: [...(payload.urls || [])] };
      return this.snapshot();
    },
    snapshot() { return structuredClone(state); },
    clear() { state = emptyState(state.generation + 1); return this.snapshot(); }
  };
}
```

Add the remaining setters as narrow operations; none may touch localStorage/sessionStorage.

- [ ] **Step 4: Extend the router with snapshot/restore**

`restore` must validate route records through the existing `routeRecord`, reject an empty/non-array snapshot with `TypeError`, replace the internal stack, optionally render only the current record, and optionally focus the screen heading.

- [ ] **Step 5: Run focused and full tests**

Run: `cd mobile && node --test test/share-session.test.mjs test/navigation.test.mjs && npm test`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add mobile/src/core/share-session.mjs mobile/src/core/router.mjs mobile/test/share-session.test.mjs mobile/test/navigation.test.mjs
git commit -m "feat: add ephemeral share session"
```

---

### Task 3: Recepción nativa de ACTION_SEND y salida al sistema

**Files:**
- Create: `mobile/android/app/src/main/java/com/tifloacosta/app/TifloSharePlugin.java`
- Create: `mobile/src/native/share-plugin.mjs`
- Create: `mobile/test/share-native-bootstrap.test.mjs`
- Modify: `mobile/android/app/src/main/AndroidManifest.xml`
- Modify: `mobile/android/app/src/main/java/com/tifloacosta/app/MainActivity.java`

**Interfaces:**
- Produces native plugin `TifloShare`:
  - `getInitialShare(): Promise<{shared:boolean,text:string}>`
  - event `shareReceived` with `{text:string}`
  - `finishShare(): Promise<{finished:boolean}>`
- JS wrapper:
  - `createSharePlugin(capacitorPlugin)` returning `getInitialShare`, `addListener`, `finishShare` with safe fallbacks.

- [ ] **Step 1: Write the failing bootstrap/source contract test**

`mobile/test/share-native-bootstrap.test.mjs` must read the manifest, MainActivity and plugin source and assert:

```js
assert.match(manifest, /android\.intent\.action\.SEND/);
assert.match(manifest, /android:mimeType="text\/plain"/);
assert.doesNotMatch(manifest, /SEND_MULTIPLE/);
assert.match(mainActivity, /registerPlugin\(TifloSharePlugin\.class\)/);
assert.match(plugin, /@CapacitorPlugin\(name = "TifloShare"\)/);
assert.match(plugin, /Intent\.EXTRA_TEXT/);
assert.match(plugin, /handleOnNewIntent/);
assert.match(plugin, /notifyListeners\("shareReceived"/);
assert.match(plugin, /moveTaskToBack\(true\)/);
```

- [ ] **Step 2: Run the bootstrap test**

Run: `cd mobile && node --test test/share-native-bootstrap.test.mjs`

Expected: FAIL because the plugin and manifest contract are absent.

- [ ] **Step 3: Add the Android share target**

Inside `MainActivity`'s existing intent filters add a separate filter:

```xml
<intent-filter>
    <action android:name="android.intent.action.SEND" />
    <category android:name="android.intent.category.DEFAULT" />
    <data android:mimeType="text/plain" />
</intent-filter>
```

Do not add file MIME types or `SEND_MULTIPLE`.

- [ ] **Step 4: Implement `TifloSharePlugin`**

Use `@CapacitorPlugin(name = "TifloShare")`. `getInitialShare` reads `getActivity().getIntent()` once per Intent identity/action+text combination and resolves `{shared:false,text:""}` for non-SEND Intents. Override `handleOnNewIntent(Intent intent)`, call `super.handleOnNewIntent(intent)`, parse only `ACTION_SEND` + `text/plain`, then `notifyListeners("shareReceived", payload, true)`. `finishShare` runs on the UI thread, calls `getActivity().moveTaskToBack(true)` and resolves `{finished:true}`.

The parser must ignore `EXTRA_STREAM`; files remain out of scope.

- [ ] **Step 5: Register the plugin before `super.onCreate`**

```java
registerPlugin(TifloSavePlugin.class);
registerPlugin(TifloSharePlugin.class);
super.onCreate(savedInstanceState);
```

- [ ] **Step 6: Add the JS wrapper**

Use `registerPlugin` from `@capacitor/core` in `mobile/src/native/share-plugin.mjs`, export a singleton `TifloShare`, and a tiny wrapper that returns neutral values rather than throwing when run in non-native tests/browser builds.

- [ ] **Step 7: Verify tests and Android compilation**

Run:

```bash
cd mobile
node --test test/share-native-bootstrap.test.mjs
npm test
npm run build
cd android
./gradlew --no-daemon assembleDebug
```

Expected: all Node tests PASS, build PASS, Gradle `assembleDebug` succeeds.

- [ ] **Step 8: Commit**

```bash
git add mobile/android/app/src/main/AndroidManifest.xml mobile/android/app/src/main/java/com/tifloacosta/app/MainActivity.java mobile/android/app/src/main/java/com/tifloacosta/app/TifloSharePlugin.java mobile/src/native/share-plugin.mjs mobile/test/share-native-bootstrap.test.mjs
git commit -m "feat: receive Android shared text"
```

---

### Task 4: Obtención nativa y limitada de páginas externas

**Files:**
- Create: `mobile/android/app/src/main/java/com/tifloacosta/app/TifloWebFetchPlugin.java`
- Create: `mobile/src/native/web-fetch-plugin.mjs`
- Modify: `mobile/android/app/src/main/java/com/tifloacosta/app/MainActivity.java`
- Modify: `mobile/test/share-native-bootstrap.test.mjs`

**Interfaces:**
- Native plugin `TifloWebFetch.fetchPage({url})` resolves:
  `{ ok:true, finalUrl:string, status:number, contentType:string, body:string }`
- Rejects with stable codes/messages mapped by JS wrapper to:
  `invalid_url`, `too_many_redirects`, `timeout`, `too_large`, `unsupported_type`, `http_error`, `unreachable`.
- JS `fetchSharedPage(url)` returns the native payload or throws an `Error` with `.code`.

- [ ] **Step 1: Extend the source contract test before implementation**

Assert the Java source contains exact limits and controls:

```js
assert.match(fetchPlugin, /MAX_REDIRECTS\s*=\s*5/);
assert.match(fetchPlugin, /MAX_BODY_BYTES\s*=\s*5\s*\*\s*1024\s*\*\s*1024/);
assert.match(fetchPlugin, /TOTAL_TIMEOUT_MS\s*=\s*15000/);
assert.match(fetchPlugin, /setInstanceFollowRedirects\(false\)/);
assert.match(fetchPlugin, /text\/html/);
assert.match(fetchPlugin, /application\/xhtml\+xml/);
assert.match(fetchPlugin, /text\/plain/);
```

- [ ] **Step 2: Run the focused test and see it fail**

Run: `cd mobile && node --test test/share-native-bootstrap.test.mjs`

Expected: FAIL for missing `TifloWebFetchPlugin`.

- [ ] **Step 3: Implement the plugin with explicit redirect and size accounting**

The implementation must:

```java
private static final int MAX_REDIRECTS = 5;
private static final int TOTAL_TIMEOUT_MS = 15000;
private static final int MAX_BODY_BYTES = 5 * 1024 * 1024;
```

Use a monotonic deadline (`System.nanoTime`) shared across redirects, `HttpURLConnection#setInstanceFollowRedirects(false)`, accept only 301/302/303/307/308 as redirects, resolve relative `Location` using `new URL(current, location)`, and reject any redirected protocol other than HTTP/HTTPS.

Before reading, reject `Content-Length` above 5 MiB. While streaming, count bytes and abort immediately once the limit is exceeded even when the header is absent or false. Decode charset from `Content-Type` when present, otherwise UTF-8. Do not set browser cookies; use only a fixed `User-Agent: TifloAcosta/1.0`.

- [ ] **Step 4: Register `TifloWebFetchPlugin` and add the JS wrapper**

MainActivity registration order:

```java
registerPlugin(TifloSavePlugin.class);
registerPlugin(TifloSharePlugin.class);
registerPlugin(TifloWebFetchPlugin.class);
```

The wrapper validates `http:`/`https:` before calling native and normalizes plugin rejection into stable `.code` values for the share screen.

- [ ] **Step 5: Build and test**

Run:

```bash
cd mobile
node --test test/share-native-bootstrap.test.mjs
npm test
npm run build
cd android
./gradlew --no-daemon assembleDebug
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add mobile/android/app/src/main/java/com/tifloacosta/app/TifloWebFetchPlugin.java mobile/android/app/src/main/java/com/tifloacosta/app/MainActivity.java mobile/src/native/web-fetch-plugin.mjs mobile/test/share-native-bootstrap.test.mjs
git commit -m "feat: fetch shared pages natively"
```

---

### Task 5: HTML remoto a modelo seguro de lectura

**Files:**
- Create: `mobile/src/core/readable-page.mjs`
- Create: `mobile/test/readable-page.test.mjs`

**Interfaces:**
- Consumes: `{ html:string, url:string, contentType:string }`.
- Produces `extractReadablePage({ html, url, contentType }): { reliable:boolean, title:string, source:string, url:string, blocks:Array<ReadableBlock> }`.
- `ReadableBlock` is one of:
  - `{ type:'heading', level:2|3|4, text:string }`
  - `{ type:'paragraph', parts:Array<{type:'text',text:string}|{type:'link',text:string,url:string}> }`
  - `{ type:'list-item', parts:Array<ReadablePart> }`
- Produces `isUsefulContentLink({ href, text, baseUrl, context }): boolean`.

- [ ] **Step 1: Write failing parser tests with hostile and index-style fixtures**

Include exact cases:

```js
test('removes executable and promotional noise but preserves editorial links', () => {
  const page = extractReadablePage({
    url: 'https://example.com/article',
    contentType: 'text/html',
    html: `<!doctype html><html><head><title>Guide</title><script>alert(1)</script></head><body>
      <header><a href="/subscribe">Subscribe</a></header>
      <main><h1>Guide</h1><p>Intro <a href="/chapter-2">Chapter 2</a>.</p>
      <aside class="advert promo"><a href="https://ads.example">Buy now</a></aside></main>
      <footer>Privacy</footer></body></html>`
  });
  assert.equal(page.reliable, true);
  assert.equal(page.title, 'Guide');
  const json = JSON.stringify(page.blocks);
  assert.match(json, /Chapter 2/);
  assert.doesNotMatch(json, /Subscribe|Buy now|alert\(1\)|Privacy/);
});

test('keeps a useful link index even when there are few paragraphs', () => {
  const page = extractReadablePage({
    url: 'https://example.com/courses',
    contentType: 'text/html',
    html: '<main><h1>Courses</h1><ul><li><a href="/voiceover">VoiceOver course</a></li><li><a href="/nvda">NVDA course</a></li></ul></main>'
  });
  assert.equal(page.reliable, true);
  assert.equal(page.blocks.filter(block => JSON.stringify(block).includes("type":"link")).length >= 0, true);
  assert.match(JSON.stringify(page.blocks), /VoiceOver course/);
  assert.match(JSON.stringify(page.blocks), /NVDA course/);
});

test('never returns javascript or mailto as interactive links', () => {
  const page = extractReadablePage({ url: 'https://example.com/', contentType: 'text/html', html: '<main><p><a href="javascript:alert(1)">Bad</a> <a href="mailto:x@example.com">Mail</a></p></main>' });
  assert.doesNotMatch(JSON.stringify(page.blocks), /javascript:|mailto:/);
});
```

Also test plain text, relative links, entity decoding, duplicate adjacent paragraphs, empty/noisy page → `reliable:false`, and generic “click here” text remains unchanged rather than inventing a label.

- [ ] **Step 2: Run the parser test and verify failure**

Run: `cd mobile && node --test test/readable-page.test.mjs`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement a conservative tokenizer/model builder**

Do not create DOM from the remote HTML. Work on strings: remove complete noise containers (`script`, `style`, `template`, `noscript`, `nav`, `header`, `footer`, `aside`, `form`, `button`, `svg`, `iframe`), prefer `<article>`, then `<main>`, then `<body>`, and tokenize only `h1`-`h6`, `p`, `li`, and `a` inside those blocks. Resolve links with `new URL(href, baseUrl)` and keep only HTTP/HTTPS.

Noise class/id terms must include at least: `share`, `social`, `related`, `recommend`, `comment`, `newsletter`, `cookie`, `promo`, `advert`, `affiliate`, `breadcrumb`, `sidebar`, `subscribe`.

Reliability rule for v1: true when there is a non-empty title plus either (a) at least 2 substantive text blocks totaling at least 160 characters, or (b) at least 2 useful content links with descriptive text of 4+ characters. Plain `text/plain` is reliable at 80+ non-whitespace characters.

- [ ] **Step 4: Run parser and full tests**

Run: `cd mobile && node --test test/readable-page.test.mjs && npm test`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/core/readable-page.mjs mobile/test/readable-page.test.mjs
git commit -m "feat: extract safe readable pages"
```

---

### Task 6: Reproductor reutilizable y adaptadores de Descargas/Búsqueda

**Files:**
- Create: `mobile/src/screens/video-player.mjs`
- Modify: `mobile/src/screens/videos.mjs`
- Modify: `mobile/src/screens/download-link.mjs`
- Modify: `mobile/src/screens/search.mjs`
- Modify: `mobile/test/download-link-screen.test.mjs`
- Create: `mobile/test/share-integration.test.mjs`

**Interfaces:**
- `createAccessibleVideoPlayer({ parent, item, t, nativeActions, onClose, focusTarget = null, allowYouTubeFallback = true })` returns `{ open(), close(), destroy() }`.
- `renderDownloadLink(context)` additionally consumes `initialUrl = ''`, `analyzeOnOpen = false`.
- `renderSearch(context)` additionally consumes `initialQuery = ''`; it fills the input but does not submit/search automatically.

- [ ] **Step 1: Write failing adapter tests**

Use source/API tests consistent with the repository to require:

```js
assert.match(downloadScreen, /initialUrl/);
assert.match(downloadScreen, /analyzeOnOpen/);
assert.match(searchScreen, /initialQuery/);
assert.doesNotMatch(searchScreen, /initialQuery[\s\S]{0,200}renderResults\(/);
assert.match(videosScreen, /createAccessibleVideoPlayer/);
```

Add a pure helper test exported from `video-player.mjs` (or `share-classifier.mjs`) proving a shared YouTube URL outside `currentContent.videos` can still produce a valid player item `{ id, url, title }`.

- [ ] **Step 2: Run focused tests and see them fail**

Run: `cd mobile && node --test test/share-integration.test.mjs test/download-link-screen.test.mjs`

Expected: FAIL for missing adapter parameters/module.

- [ ] **Step 3: Extract the existing player without changing normal Videos behavior**

Move the existing YouTube API loader, ready/error state, seek ±60 seconds, play/pause, focus restoration and `destroy()` cleanup into `video-player.mjs`. `videos.mjs` becomes a consumer; its visible copy and current controls remain unchanged.

For shared playback, pass an item synthesized from the classification `{ id: videoId, url, title: t('share.youtubeTitle') }`. `open()` must cue but not call `playVideo()`.

- [ ] **Step 4: Add controlled prefill to Descargas and Búsqueda**

In `renderDownloadLink`, set `input.value = initialUrl` before listeners. If `analyzeOnOpen === true` and URL is valid, call `analyzeCurrent()` exactly once after the screen has been fully appended; this execution is allowed because it follows the user's explicit “Analizar descargas” action in the share screen.

In `renderSearch`, choose the initial input value as `initialQuery || lastQuery`; do not call `renderResults` merely because `initialQuery` exists. Only a form submit searches.

- [ ] **Step 5: Run tests and mobile build**

Run: `cd mobile && node --test test/share-integration.test.mjs test/download-link-screen.test.mjs && npm test && npm run build`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add mobile/src/screens/video-player.mjs mobile/src/screens/videos.mjs mobile/src/screens/download-link.mjs mobile/src/screens/search.mjs mobile/test/download-link-screen.test.mjs mobile/test/share-integration.test.mjs
git commit -m "refactor: reuse accessible share destinations"
```

---

### Task 7: Pantalla accesible de Compartir y lectura interna

**Files:**
- Create: `mobile/src/screens/share.mjs`
- Create: `mobile/test/share-screen.test.mjs`
- Modify: `mobile/src/core/i18n.mjs`

**Interfaces:**
- `renderShare({ root, session, classifier, webFetch, nativeActions, t, onOpenVideo, onOpenDownload, onOpenSearch, onFinish })`.
- The screen never receives raw HTML for rendering; it receives only native fetch payloads and passes body to `extractReadablePage`.

- [ ] **Step 1: Write the failing screen contract test**

Because the project does not use a DOM test library, follow existing source-contract style and test pure decision helpers exported by `share.mjs`:

```js
import { actionsForClassification, errorActions } from '../src/screens/share.mjs';

test('YouTube has one primary TifloAcosta action before any failure', () => {
  assert.deepEqual(actionsForClassification({ kind: 'youtube' }).map(x => x.id), ['play']);
});

test('unknown/read failure exposes at most the agreed actions', () => {
  assert.deepEqual(errorActions('unreliable').map(x => x.id), ['downloads', 'cancel']);
});
```

Also source-assert:
- one `h1`/screen heading path;
- a status element with `role="status"` or `aria-live="polite"` and `aria-atomic="true"`;
- no `innerHTML` assignment;
- buttons with explicit translation keys rather than generic “OK/Continue”.

- [ ] **Step 2: Run and verify failure**

Run: `cd mobile && node --test test/share-screen.test.mjs`

Expected: FAIL because `share.mjs` and translations are absent.

- [ ] **Step 3: Add bilingual copy**

Add `screen.share` plus a `share` dictionary in ES/EN covering at least:

Spanish: `Compartido con TifloAcosta`, `Has compartido un vídeo de YouTube`, `Reproducir en TifloAcosta`, `Preparando lectura…`, `Leer en modo accesible`, `Analizar descargas`, `Buscar en TifloAcosta`, `Se han encontrado {count} enlaces`, `Reintentar`, `Cancelar y volver`, `Volver a la página anterior`, `No hemos podido preparar una versión fiable de esta página`, timeout/network/type/size errors.

English equivalents must be natural and complete, not machine-like literal fragments.

- [ ] **Step 4: Render all states from a single session snapshot**

The screen must support these `view` values: `received`, `multi-url`, `loading`, `readable`, `error`. At render start call `clearScreen(root)`, create the heading with `tabIndex=-1` and `data-screen-heading`, then create a polite atomic status region.

For readable blocks, use only `document.createElement`, `.textContent`, and `element.href` after URL validation. For each preserved link, prevent default and call back into the share classifier rather than `window.open`.

While loading, disable only the initiating action; keep “Cancelar y volver” available. Capture `generation` before async fetch; discard the result if `session.snapshot().generation` changed before completion.

- [ ] **Step 5: Implement internal readable Back semantics**

If readable history has more than one page, “Volver a la página anterior” calls `session.popReadable()` and re-renders. At the first shared page, the back action delegates to `onFinish()`; for a multi-link origin, back from a selected link returns to the URL list before finishing.

- [ ] **Step 6: Run screen/parser/classifier/full tests**

Run:

```bash
cd mobile
node --test test/share-screen.test.mjs test/readable-page.test.mjs test/share-classifier.test.mjs test/share-session.test.mjs
npm test
npm run build
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add mobile/src/screens/share.mjs mobile/src/core/i18n.mjs mobile/test/share-screen.test.mjs
git commit -m "feat: add accessible shared content screen"
```

---

### Task 8: Integración completa en app.mjs, navegación y botón Atrás

**Files:**
- Modify: `mobile/src/app.mjs`
- Modify: `mobile/src/core/native-actions.mjs`
- Modify: `mobile/test/native-actions.test.mjs`
- Modify: `mobile/test/app-shell.test.mjs`
- Modify: `mobile/test/share-integration.test.mjs`

**Interfaces:**
- `createNativeActions` additionally consumes `tifloSharePlugin` and produces `finishSharedFlow()`.
- App owns exactly one `shareSession`, one saved normal-router snapshot while share mode is active, and listener cleanup handles.

- [ ] **Step 1: Write failing integration tests**

Require composition root imports `createShareSession`, `classifySharedText`, `renderShare`, `TifloShare`, `TifloWebFetch`; registers a `shareReceived` listener; queries `getInitialShare()` after the router starts; and never writes the shared text to storage.

Extend native-actions test:

```js
test('finishSharedFlow delegates to native move-to-background action', async () => {
  let called = 0;
  const actions = createNativeActions({ tifloSharePlugin: { finishShare: async () => { called += 1; return { finished: true }; } } });
  assert.equal(await actions.finishSharedFlow(), true);
  assert.equal(called, 1);
});
```

- [ ] **Step 2: Run focused tests and verify failure**

Run: `cd mobile && node --test test/native-actions.test.mjs test/app-shell.test.mjs test/share-integration.test.mjs`

Expected: FAIL for missing integration.

- [ ] **Step 3: Compose share services in `app.mjs`**

After the normal router starts, call `getInitialShare()`. If `shared === true`, invoke one `beginSharedFlow(text)` function. Register `shareReceived` and route it to the same function.

`beginSharedFlow` must:
1. call `activeScreenCleanup?.()` to destroy any current player/subscription tied to the normal screen;
2. snapshot the normal router only when entering share mode from normal mode;
3. abort/replace the previous share session by calling `session.begin(...)` and relying on generation guards for in-flight page requests;
4. classify the text;
5. `router.start('share')` and render the share screen.

- [ ] **Step 4: Add share destination routes without leaking share state into normal navigation**

Add route cases `share`, `share-video`, `share-download`, `share-search`. Their contexts take transient values from `shareSession.snapshot()`, not globals like `lastSharedUrl`.

When opening video/download/search from Share, use `router.navigate(...)`. Their visible Back action returns to `share`; closing the standalone player also returns to `share`. Normal Videos/Downloads/Search paths keep their existing behavior.

- [ ] **Step 5: Finish the share flow correctly**

`finishSharedFlow()` in app must:
1. run `activeScreenCleanup?.()`;
2. `session.clear()`;
3. restore the saved normal router snapshot with `{ renderCurrent:true, focus:false }`;
4. clear the saved snapshot/share-mode flag;
5. call `nativeActions.finishSharedFlow()` to `moveTaskToBack(true)`.

The Android back handler must check share mode first. If share screen can step back internally, do that. If it is at the root, call the same finish function. Only normal non-share mode uses existing `router.back()`/`App.exitApp()` behavior.

- [ ] **Step 6: Prevent stale content refresh from stealing the share screen**

Update the existing `contentStore.load().then(...)` branch so it refreshes the normal router only when not in share mode and not editing text. Shared flow rendering must never be replaced by the remote-content refresh.

- [ ] **Step 7: Run all tests and builds**

Run:

```bash
cd mobile
npm test
npm run build
npm run sync:android
cd android
./gradlew --no-daemon testDebugUnitTest assembleDebug
```

Expected: all Node tests PASS; Capacitor sync PASS; Gradle unit/build PASS.

- [ ] **Step 8: Commit**

```bash
git add mobile/src/app.mjs mobile/src/core/native-actions.mjs mobile/test/native-actions.test.mjs mobile/test/app-shell.test.mjs mobile/test/share-integration.test.mjs
git commit -m "feat: integrate Android share flow"
```

---

### Task 9: Manual Android and accessibility verification

**Files:**
- Modify only if a defect is found: the owning file from Tasks 1–8.
- No version bump or Play release in this task.

**Interfaces:**
- Consumes the debug APK produced by Task 8.
- Produces a verified test matrix and fixes for any observed regression before release preparation.

- [ ] **Step 1: Install the debug build on an Android test device**

Run from `mobile/android`:

```bash
./gradlew --no-daemon installDebug
```

Expected: installation succeeds and the existing app can still open normally to Inicio.

- [ ] **Step 2: Verify cold-start and warm-start sharing**

From Chrome/another browser and WhatsApp/email:
- Share one ordinary article with TifloAcosta while the app is closed.
- Repeat while TifloAcosta is already open on a non-home screen.
- Confirm the heading “Compartido con TifloAcosta” receives focus and the prior normal app screen is restored after finishing the share flow and later reopening TifloAcosta.

- [ ] **Step 3: Verify every classification path**

Test:
- YouTube watch URL, `youtu.be`, Shorts URL: one primary “Reproducir en TifloAcosta” action, no autoplay, ±1 minute/play-pause controls, YouTube fallback only after player failure.
- Google Drive/Dropbox/direct file URL: routes to existing Descargas with URL already present and analysis begun only after the user chose “Analizar descargas”.
- Plain text: search field prefilled, no automatic search.
- Two URLs in one shared text: announce count, choose one, back returns to the list.

- [ ] **Step 4: Verify clean-reader behavior and internal navigation**

Use at least:
- a standard news/article page;
- a page whose main content is an index/list of useful links;
- a page with obvious header/footer/social/promo noise.

Confirm headings/lists/paragraphs remain semantic; useful content links remain; ads/promos/global navigation do not; activating a useful link stays in TifloAcosta and reclassifies the destination; Back walks page-by-page before leaving the shared flow.

- [ ] **Step 5: Verify failures and limits**

Test airplane mode, an unreachable hostname, an authentication-required page, a non-text URL, and a deliberately large/text endpoint if available in controlled testing. Confirm no infinite loading, no raw exception text, and the screen always offers a useful retry/cancel path.

- [ ] **Step 6: Verify screen-reader behavior**

With TalkBack and at least one other reader available to the test group (Jieshuo, AccessiMind or another):
- initial heading focus;
- order of controls;
- polite single announcements for loading/result/error;
- no focus jump during loading;
- link/heading/list navigation in clean reading;
- predictable Back/Cancel;
- no automatic speech/audio from TifloAcosta itself.

Record any difference between readers as a defect, not as an acceptable reader-specific quirk.

- [ ] **Step 7: Run final automated verification after any manual fixes**

Run:

```bash
cd mobile
npm test
npm run build
npm run sync:android
cd android
./gradlew --no-daemon testDebugUnitTest assembleDebug
```

Expected: PASS with no uncommitted fixes remaining.

- [ ] **Step 8: Commit any verification fixes separately**

If fixes were necessary, commit each owning defect with a focused message such as:

```bash
git commit -m "fix: preserve focus after shared page load"
```

Do not combine version bump, release notes or Play Console publication into this implementation plan; those are a separate release task after the feature is accepted.
