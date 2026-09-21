# Compartir con TifloAcosta Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir a la app Android de TifloAcosta un flujo nativo de Compartir para texto y enlaces que clasifique el contenido, reutilice vídeo/Descargas/búsqueda y permita leer páginas externas en modo limpio y accesible.

**Architecture:** Android recibe `ACTION_SEND` mediante un plugin Capacitor propio y obtiene páginas externas mediante un segundo plugin nativo limitado. JavaScript mantiene una sesión efímera separada de la navegación normal, clasifica enlaces de forma determinista y renderiza solo un modelo seguro construido por TifloAcosta. Las funciones ya existentes se reutilizan mediante adaptadores, sin duplicar reproductor, Descargas ni búsqueda.

**Tech Stack:** Android Java, Capacitor 8.5.2, JavaScript ESM, Node.js 22 `node:test`, Gradle/Android SDK, YouTube IFrame API existente.

**Spec:** `docs/superpowers/specs/2026-09-21-compartir-con-tifloacosta-design.md`

## Global Constraints

- Android nativo en esta primera versión; no iOS ni Web Share Target.
- Solo `ACTION_SEND` con texto/enlaces; no archivos binarios ni `ACTION_SEND_MULTIPLE`.
- `TifloSharePlugin` recibe Intents y finaliza la sesión; no clasifica ni descarga páginas.
- `TifloWebFetchPlugin` solo acepta HTTP/HTTPS, máximo 5 redirecciones, 15 segundos totales, 5 MiB y tipos `text/html`, `application/xhtml+xml` o `text/plain`.
- El HTML remoto nunca se inyecta directamente en el DOM mediante `innerHTML`.
- No se ejecuta JavaScript remoto, no se reutilizan cookies/sesiones del navegador y no se envían las URLs compartidas al backend de TifloAcosta para la lectura limpia.
- No hay reproducción automática, descargas automáticas, locuciones propias ni sonidos de confirmación.
- La lectura normal no muestra “Abrir página original”; el fallback “Abrir en YouTube” solo aparece si falla el reproductor interno.
- La interfaz debe estar en español e inglés y conservar foco, semántica, regiones de estado y nombres de controles comprensibles con lector de pantalla.
- Un nuevo `ACTION_SEND` sustituye por completo cualquier sesión de Compartir anterior, incluso si el texto es idéntico al anterior.
- Al finalizar, la sesión se destruye y Android ejecuta `moveTaskToBack(true)`; la navegación normal de TifloAcosta queda restaurada.

## Review Focus

- Texto con puntuación alrededor de una URL o varias URLs en una línea: extraer direcciones limpias y no elegir una silenciosamente.
- URL de YouTube con parámetros, `youtu.be`, Shorts o URL corta que redirige a YouTube: terminar en el mismo reproductor accesible y nunca reproducir automáticamente.
- Página índice cuyo contenido principal son enlaces útiles: conservar esos enlaces aunque tenga poco texto.
- Página hostil, enorme o con redirecciones abusivas: detenerse con error controlado sin bloquear la interfaz ni renderizar HTML remoto.
- Nuevo contenido compartido mientras otra sesión está activa: invalidar resultados asíncronos antiguos, cerrar reproductor/operación anterior y empezar limpio.

---

## File Structure

### Nuevos archivos

- `mobile/src/core/share-classifier.mjs` — extracción y clasificación determinista de texto/URLs.
- `mobile/src/core/share-session.mjs` — estado efímero, selección e historial.
- `mobile/src/core/readable-page.mjs` — HTML no fiable → modelo seguro de lectura.
- `mobile/src/native/share-plugin.mjs` — wrapper JS de `TifloSharePlugin`.
- `mobile/src/native/web-fetch-plugin.mjs` — wrapper JS de `TifloWebFetchPlugin`.
- `mobile/src/screens/share.mjs` — pantalla accesible del flujo Compartir.
- `mobile/src/screens/video-player.mjs` — reproductor accesible reutilizable.
- `mobile/android/app/src/main/java/com/tifloacosta/app/TifloSharePlugin.java`.
- `mobile/android/app/src/main/java/com/tifloacosta/app/TifloWebFetchPlugin.java`.
- Tests: `share-classifier.test.mjs`, `share-session.test.mjs`, `readable-page.test.mjs`, `share-native-bootstrap.test.mjs`, `share-screen.test.mjs`, `share-integration.test.mjs`.

### Archivos modificados

- `mobile/android/app/src/main/AndroidManifest.xml`
- `mobile/android/app/src/main/java/com/tifloacosta/app/MainActivity.java`
- `mobile/src/core/router.mjs`
- `mobile/src/core/native-actions.mjs`
- `mobile/src/core/i18n.mjs`
- `mobile/src/screens/videos.mjs`
- `mobile/src/screens/download-link.mjs`
- `mobile/src/screens/search.mjs`
- `mobile/src/app.mjs`
- Tests existentes de navegación, app shell, native actions y Descargas.

---

### Task 1: Clasificador de contenido compartido

**Files:**
- Create: `mobile/src/core/share-classifier.mjs`
- Create: `mobile/test/share-classifier.test.mjs`

**Interfaces:**
- `extractHttpUrls(text: string): string[]`
- `youtubeVideoId(url: string): string`
- `classifySharedUrl(url: string, { resolveDownload }): { kind:'youtube'|'download'|'web'|'invalid', url:string, videoId?:string }`
- `classifySharedText(text: string, options): { kind:'text'|'single-url'|'multi-url', text:string, urls:string[], classification?:object }`

- [ ] **Step 1: Write failing tests**

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { extractHttpUrls, youtubeVideoId, classifySharedText, classifySharedUrl } from '../src/core/share-classifier.mjs';

test('trims surrounding punctuation but keeps query strings', () => {
  assert.deepEqual(
    extractHttpUrls('Mira (https://example.com/a?x=1&y=2), y luego https://example.org/b.'),
    ['https://example.com/a?x=1&y=2', 'https://example.org/b']
  );
});

test('recognizes common YouTube forms', () => {
  assert.equal(youtubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30'), 'dQw4w9WgXcQ');
  assert.equal(youtubeVideoId('https://youtu.be/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(youtubeVideoId('https://www.youtube.com/shorts/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
});

test('does not silently choose when several URLs are shared', () => {
  const result = classifySharedText('https://a.example y https://b.example', { resolveDownload: () => ({ provider: 'web' }) });
  assert.equal(result.kind, 'multi-url');
  assert.deepEqual(result.urls, ['https://a.example/', 'https://b.example/']);
});

test('orders classification youtube, known download, web, invalid', () => {
  const resolveDownload = url => url.includes('dropbox.com') ? { provider: 'dropbox' } : { provider: 'web' };
  assert.equal(classifySharedUrl('https://youtu.be/dQw4w9WgXcQ', { resolveDownload }).kind, 'youtube');
  assert.equal(classifySharedUrl('https://www.dropbox.com/s/test/file.pdf', { resolveDownload }).kind, 'download');
  assert.equal(classifySharedUrl('https://example.com/article', { resolveDownload }).kind, 'web');
  assert.equal(classifySharedUrl('javascript:alert(1)', { resolveDownload }).kind, 'invalid');
});
```

- [ ] **Step 2: Verify failure**

Run: `cd mobile && node --test test/share-classifier.test.mjs`

Expected: FAIL because `share-classifier.mjs` does not exist.

- [ ] **Step 3: Implement the pure classifier**

Normalize only HTTP/HTTPS. De-duplicate URLs preserving order. Recognize YouTube hosts `youtube.com`, `www.youtube.com`, `m.youtube.com`, `music.youtube.com`, `youtu.be` and routes `/watch?v=`, `/shorts/`, `/embed/`, `/live/` with IDs de 11 caracteres. Use `resolveLocal` by injection to identify providers/downloads already understood by TifloAcosta.

- [ ] **Step 4: Run focused and full tests**

Run: `cd mobile && node --test test/share-classifier.test.mjs && npm test`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/core/share-classifier.mjs mobile/test/share-classifier.test.mjs
git commit -m "feat: add shared content classifier"
```

---

### Task 2: Sesión efímera y snapshot de navegación normal

**Files:**
- Create: `mobile/src/core/share-session.mjs`
- Create: `mobile/test/share-session.test.mjs`
- Modify: `mobile/src/core/router.mjs`
- Modify: `mobile/test/navigation.test.mjs`

**Interfaces:**
- `createShareSession()` con `begin`, `selectUrl`, `setClassification`, `setView`, `pushReadable`, `popReadable`, `snapshot`, `clear`.
- `router.snapshot(): Array<{name:string,originId:string|null}>`
- `router.restore(records, { renderCurrent = true, focus = false } = {})`

- [ ] **Step 1: Write failing tests for replacement, history and generation guards**

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { createShareSession } from '../src/core/share-session.mjs';

test('begin replaces an older session and increments generation', () => {
  const session = createShareSession();
  const first = session.begin({ text: 'same', urls: ['https://one.example/'] });
  session.pushReadable({ url: 'https://one.example/', title: 'One', blocks: [] });
  const second = session.begin({ text: 'same', urls: ['https://two.example/'] });
  assert.equal(second.generation, first.generation + 1);
  assert.deepEqual(second.readableHistory, []);
  assert.deepEqual(second.urls, ['https://two.example/']);
});

test('popReadable moves back one page', () => {
  const session = createShareSession();
  session.begin({ text: 'x', urls: [] });
  session.pushReadable({ url: 'https://one.example/', title: 'One', blocks: [] });
  session.pushReadable({ url: 'https://two.example/', title: 'Two', blocks: [] });
  assert.equal(session.popReadable().url, 'https://one.example/');
});
```

Add router tests that preserve a multi-route stack and origin IDs through `snapshot()` / `restore()`.

- [ ] **Step 2: Run tests and verify failure**

Run: `cd mobile && node --test test/share-session.test.mjs test/navigation.test.mjs`

Expected: FAIL for missing module/methods.

- [ ] **Step 3: Implement session and router extensions**

Keep session state only in memory. `snapshot()` returns clones. `begin()` and `clear()` increment `generation`. `restore()` validates every route with existing `routeRecord`, replaces the stack and optionally renders/focuses the current route.

- [ ] **Step 4: Run all tests**

Run: `cd mobile && node --test test/share-session.test.mjs test/navigation.test.mjs && npm test`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/core/share-session.mjs mobile/src/core/router.mjs mobile/test/share-session.test.mjs mobile/test/navigation.test.mjs
git commit -m "feat: add ephemeral share session"
```

---

### Task 3: Recepción nativa de ACTION_SEND

**Files:**
- Create: `mobile/android/app/src/main/java/com/tifloacosta/app/TifloSharePlugin.java`
- Create: `mobile/src/native/share-plugin.mjs`
- Create: `mobile/test/share-native-bootstrap.test.mjs`
- Modify: `mobile/android/app/src/main/AndroidManifest.xml`
- Modify: `mobile/android/app/src/main/java/com/tifloacosta/app/MainActivity.java`

**Interfaces:**
- Native `TifloShare.getInitialShare()` → `{shared:boolean,text:string}`.
- Native event `shareReceived` → `{text:string}`.
- Native `finishShare()` → `{finished:boolean}`.

- [ ] **Step 1: Write failing source-contract tests**

```js
assert.match(manifest, /android\.intent\.action\.SEND/);
assert.match(manifest, /android:mimeType="text\/plain"/);
assert.doesNotMatch(manifest, /SEND_MULTIPLE/);
assert.match(mainActivity, /registerPlugin\(TifloSharePlugin\.class\)/);
assert.match(plugin, /Intent\.EXTRA_TEXT/);
assert.match(plugin, /handleOnNewIntent/);
assert.match(plugin, /notifyListeners\("shareReceived"/);
assert.match(plugin, /moveTaskToBack\(true\)/);
```

- [ ] **Step 2: Run focused test and verify failure**

Run: `cd mobile && node --test test/share-native-bootstrap.test.mjs`

Expected: FAIL because the plugin/manifest changes do not exist.

- [ ] **Step 3: Add share target to the manifest**

```xml
<intent-filter>
    <action android:name="android.intent.action.SEND" />
    <category android:name="android.intent.category.DEFAULT" />
    <data android:mimeType="text/plain" />
</intent-filter>
```

- [ ] **Step 4: Implement `TifloSharePlugin`**

Use `@CapacitorPlugin(name = "TifloShare")`. `getInitialShare()` may consume the Activity's launch Intent once per Activity launch. `handleOnNewIntent(Intent intent)` must emit every valid new SEND Intent, even when `EXTRA_TEXT` is identical to the previous one. Ignore `EXTRA_STREAM`. `finishShare()` runs on UI thread and calls `moveTaskToBack(true)`.

- [ ] **Step 5: Register plugin and add safe JS wrapper**

```java
registerPlugin(TifloSavePlugin.class);
registerPlugin(TifloSharePlugin.class);
super.onCreate(savedInstanceState);
```

The wrapper exposes neutral fallbacks in non-native contexts rather than throwing.

- [ ] **Step 6: Verify Node, mobile and Android build**

```bash
cd mobile
node --test test/share-native-bootstrap.test.mjs
npm test
npm run build
cd android
./gradlew --no-daemon assembleDebug
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add mobile/android/app/src/main/AndroidManifest.xml mobile/android/app/src/main/java/com/tifloacosta/app/MainActivity.java mobile/android/app/src/main/java/com/tifloacosta/app/TifloSharePlugin.java mobile/src/native/share-plugin.mjs mobile/test/share-native-bootstrap.test.mjs
git commit -m "feat: receive Android shared text"
```

---

### Task 4: Obtención nativa segura de páginas

**Files:**
- Create: `mobile/android/app/src/main/java/com/tifloacosta/app/TifloWebFetchPlugin.java`
- Create: `mobile/src/native/web-fetch-plugin.mjs`
- Modify: `mobile/android/app/src/main/java/com/tifloacosta/app/MainActivity.java`
- Modify: `mobile/test/share-native-bootstrap.test.mjs`

**Interfaces:**
- `TifloWebFetch.fetchPage({url})` → `{ok:true,finalUrl:string,status:number,contentType:string,body:string}`.
- Stable error codes: `invalid_url`, `too_many_redirects`, `timeout`, `too_large`, `unsupported_type`, `http_error`, `unreachable`.

- [ ] **Step 1: Extend failing contract tests with exact limits**

```js
assert.match(fetchPlugin, /MAX_REDIRECTS\s*=\s*5/);
assert.match(fetchPlugin, /MAX_BODY_BYTES\s*=\s*5\s*\*\s*1024\s*\*\s*1024/);
assert.match(fetchPlugin, /TOTAL_TIMEOUT_MS\s*=\s*15000/);
assert.match(fetchPlugin, /setInstanceFollowRedirects\(false\)/);
assert.match(fetchPlugin, /text\/html/);
assert.match(fetchPlugin, /application\/xhtml\+xml/);
assert.match(fetchPlugin, /text\/plain/);
```

- [ ] **Step 2: Verify failure**

Run: `cd mobile && node --test test/share-native-bootstrap.test.mjs`

Expected: FAIL for missing fetch plugin.

- [ ] **Step 3: Implement bounded HTTP fetch**

Use constants:

```java
private static final int MAX_REDIRECTS = 5;
private static final int TOTAL_TIMEOUT_MS = 15000;
private static final int MAX_BODY_BYTES = 5 * 1024 * 1024;
```

Use one monotonic deadline across redirects, `setInstanceFollowRedirects(false)`, only 301/302/303/307/308, resolve relative `Location`, reject any non-HTTP(S) destination, reject `Content-Length` above limit and count streamed bytes when length is absent. Decode declared charset or UTF-8. Do not send cookies; only a fixed `User-Agent: TifloAcosta/1.0`.

- [ ] **Step 4: Register plugin and add JS wrapper**

```java
registerPlugin(TifloSavePlugin.class);
registerPlugin(TifloSharePlugin.class);
registerPlugin(TifloWebFetchPlugin.class);
```

The wrapper validates the initial scheme and normalizes native errors to `.code`.

- [ ] **Step 5: Verify limits in automated and manual paths**

Run source-contract test plus Gradle build now. The actual network behaviors—large body, timeout and redirect loop—are exercised again in Task 9 on a test device because the current repo has no Android HTTP fixture harness.

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

### Task 5: Convertir HTML remoto en modelo seguro de lectura

**Files:**
- Create: `mobile/src/core/readable-page.mjs`
- Create: `mobile/test/readable-page.test.mjs`

**Interfaces:**
- `extractReadablePage({ html, url, contentType })` → `{ reliable:boolean, title:string, source:string, url:string, blocks:ReadableBlock[] }`.
- `ReadableBlock` is heading, paragraph or list-item; paragraph/list parts are text or validated HTTP(S) links.

- [ ] **Step 1: Write failing parser tests**

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { extractReadablePage } from '../src/core/readable-page.mjs';

test('removes executable/promotional noise but preserves editorial links', () => {
  const page = extractReadablePage({
    url: 'https://example.com/article',
    contentType: 'text/html',
    html: '<html><head><title>Guide</title><script>alert(1)</script></head><body><header>Menu</header><main><h1>Guide</h1><p>Useful introduction with enough real article text for reading. <a href="/chapter-2">Chapter 2</a> continues the guide with more detail.</p><p>Second substantive paragraph keeps the page above the reliability threshold.</p><aside class="promo"><a href="https://ads.example">Buy now</a></aside></main></body></html>'
  });
  const json = JSON.stringify(page.blocks);
  assert.equal(page.reliable, true);
  assert.match(json, /Chapter 2/);
  assert.doesNotMatch(json, /Menu|Buy now|alert\(1\)/);
});

test('keeps a useful link index even with little prose', () => {
  const page = extractReadablePage({
    url: 'https://example.com/courses',
    contentType: 'text/html',
    html: '<main><h1>Courses</h1><ul><li><a href="/voiceover">VoiceOver course</a></li><li><a href="/nvda">NVDA course</a></li></ul></main>'
  });
  const links = page.blocks.flatMap(block => block.parts || []).filter(part => part.type === 'link');
  assert.equal(page.reliable, true);
  assert.deepEqual(links.map(link => link.text), ['VoiceOver course', 'NVDA course']);
});

test('never exposes javascript or mailto as interactive links', () => {
  const page = extractReadablePage({ url: 'https://example.com/', contentType: 'text/html', html: '<main><h1>Safe</h1><p>Long enough safe paragraph for the parser to inspect. <a href="javascript:alert(1)">Bad</a> <a href="mailto:x@example.com">Mail</a></p><p>Another useful paragraph with enough text to make the page reliable.</p></main>' });
  assert.doesNotMatch(JSON.stringify(page.blocks), /javascript:|mailto:/);
});
```

Also test relative links, entities, repeated adjacent paragraphs, plain text and noisy/empty page → `reliable:false`.

- [ ] **Step 2: Verify failure**

Run: `cd mobile && node --test test/readable-page.test.mjs`

Expected: FAIL because module is absent.

- [ ] **Step 3: Implement conservative string parser**

Never inject the remote HTML. Strip whole noise containers (`script`, `style`, `template`, `noscript`, `nav`, `header`, `footer`, `aside`, `form`, `button`, `svg`, `iframe`), prefer `<article>`, then `<main>`, then `<body>`, and tokenize only `h1`-`h6`, `p`, `li`, `a`. Resolve relative URLs against `baseUrl` and keep only HTTP/HTTPS.

Noise class/id vocabulary includes `share`, `social`, `related`, `recommend`, `comment`, `newsletter`, `cookie`, `promo`, `advert`, `affiliate`, `breadcrumb`, `sidebar`, `subscribe`.

Reliability in v1:
- HTML: non-empty title plus either 2 substantive text blocks totaling ≥160 characters or 2 useful content links with labels ≥4 characters.
- Plain text: ≥80 non-whitespace characters; source is hostname, title is first non-empty line up to 120 characters, falling back to hostname.

- [ ] **Step 4: Run parser/full tests**

Run: `cd mobile && node --test test/readable-page.test.mjs && npm test`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/core/readable-page.mjs mobile/test/readable-page.test.mjs
git commit -m "feat: extract safe readable pages"
```

---

### Task 6: Reutilizar reproductor, Descargas y Búsqueda

**Files:**
- Create: `mobile/src/screens/video-player.mjs`
- Modify: `mobile/src/screens/videos.mjs`
- Modify: `mobile/src/screens/download-link.mjs`
- Modify: `mobile/src/screens/search.mjs`
- Modify: `mobile/test/download-link-screen.test.mjs`
- Create: `mobile/test/share-integration.test.mjs`

**Interfaces:**
- `createAccessibleVideoPlayer({ parent, item, t, nativeActions, onClose, focusTarget = null, allowYouTubeFallback = true })` → `{ open(), close(), destroy() }`.
- `createSharedVideoItem({ url, videoId, title })` → `{ id, url, title }`.
- `renderDownloadLink` accepts `initialUrl=''`, `analyzeOnOpen=false`.
- `renderSearch` accepts `initialQuery=''` and never searches it automatically.

- [ ] **Step 1: Write failing adapter tests**

```js
assert.match(downloadScreen, /initialUrl/);
assert.match(downloadScreen, /analyzeOnOpen/);
assert.match(searchScreen, /initialQuery/);
assert.match(videosScreen, /createAccessibleVideoPlayer/);
```

And:

```js
const item = createSharedVideoItem({ url: 'https://youtu.be/dQw4w9WgXcQ', videoId: 'dQw4w9WgXcQ', title: 'Shared video' });
assert.deepEqual(item, { id: 'dQw4w9WgXcQ', url: 'https://youtu.be/dQw4w9WgXcQ', title: 'Shared video' });
```

- [ ] **Step 2: Verify failure**

Run: `cd mobile && node --test test/share-integration.test.mjs test/download-link-screen.test.mjs`

Expected: FAIL for missing interfaces.

- [ ] **Step 3: Extract player without changing normal Videos behavior**

Move current YouTube API loader, ready/error state, ±60-second seek, play/pause, focus restoration and cleanup into `video-player.mjs`. Normal Videos consumes that module. Shared playback passes a synthesized item and `open()` cues the video but never calls `playVideo()` automatically.

- [ ] **Step 4: Add controlled prefill**

Descargas: place `initialUrl` in the input. If `analyzeOnOpen` is true, analyze exactly once after the user has explicitly chosen “Analizar descargas” in Compartir.

Búsqueda: use `initialQuery || lastQuery` in the field, but only form submission calls `renderResults` for a newly shared query.

- [ ] **Step 5: Run tests/build**

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
- `renderShare({ root, session, resolveDownload, webFetch, nativeActions, t, onOpenVideo, onOpenDownload, onOpenSearch, onFinish })`.
- Pure helpers `actionsForClassification(classification)` and `errorActions(code)` for testable decisions.

- [ ] **Step 1: Write failing decision/accessibility tests**

```js
assert.deepEqual(actionsForClassification({ kind: 'youtube' }).map(x => x.id), ['play']);
assert.deepEqual(errorActions('unreliable').map(x => x.id), ['downloads', 'cancel']);
assert.deepEqual(errorActions('timeout').map(x => x.id), ['retry', 'cancel']);
```

Source-contract assertions require a screen heading path, polite atomic status region, no `innerHTML`, and explicit translation keys instead of generic OK/Continue buttons.

- [ ] **Step 2: Verify failure**

Run: `cd mobile && node --test test/share-screen.test.mjs`

Expected: FAIL because screen/copy is absent.

- [ ] **Step 3: Add ES/EN copy**

Cover: heading, received YouTube/web/text messages, play/read/download/search actions, multi-link count, preparing/analyzing, retry, cancel/return, previous-page back, unreliable-read message, timeout/network/type/size errors and YouTube fallback error text.

- [ ] **Step 4: Implement states and focus rules**

Support `received`, `multi-url`, `loading`, `readable`, `error`. While loading, keep focus in place and update only the status region. When readable/error content replaces the loading state, move focus once to the new state heading. Disable only the initiating action; “Cancelar y volver” remains available.

Readable blocks are rendered with `createElement`, `textContent` and validated HTTP(S) `href`. Clicking a preserved content link prevents default and sends that URL back through `classifySharedUrl`.

- [ ] **Step 5: Reclassify after native redirects**

After `webFetch(url)` returns, compare/use `finalUrl` and call `classifySharedUrl(finalUrl, { resolveDownload })` again before parsing `body`.

Expected behavior:
- final classification `youtube` → open accessible player;
- `download` → offer/route to Descargas;
- `web` → parse `body` into readable model.

Add a test in `share-integration.test.mjs` proving a shared short URL whose fetch result has `finalUrl:'https://youtu.be/dQw4w9WgXcQ'` is routed to video rather than the reader.

- [ ] **Step 6: Implement internal Back semantics**

Readable history goes page-by-page. A selected item from a multi-link share returns to that link list before finishing. At the root of the first shared item, Back delegates to `onFinish()`.

- [ ] **Step 7: Run tests/build**

```bash
cd mobile
node --test test/share-screen.test.mjs test/share-integration.test.mjs test/readable-page.test.mjs test/share-classifier.test.mjs test/share-session.test.mjs
npm test
npm run build
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add mobile/src/screens/share.mjs mobile/src/core/i18n.mjs mobile/test/share-screen.test.mjs mobile/test/share-integration.test.mjs
git commit -m "feat: add accessible shared content screen"
```

---

### Task 8: Integración en app.mjs y botón Atrás

**Files:**
- Modify: `mobile/src/app.mjs`
- Modify: `mobile/src/core/native-actions.mjs`
- Modify: `mobile/test/native-actions.test.mjs`
- Modify: `mobile/test/app-shell.test.mjs`
- Modify: `mobile/test/share-integration.test.mjs`

**Interfaces:**
- `createNativeActions` additionally consumes `tifloSharePlugin` and produces `finishSharedFlow()`.
- App owns exactly one share session and one saved normal-router snapshot while share mode is active.

- [ ] **Step 1: Write failing integration tests**

```js
test('finishSharedFlow delegates to native finishShare', async () => {
  let called = 0;
  const actions = createNativeActions({ tifloSharePlugin: { finishShare: async () => { called += 1; return { finished: true }; } } });
  assert.equal(await actions.finishSharedFlow(), true);
  assert.equal(called, 1);
});
```

Source-test `app.mjs` for imports/registration of share session, native share listener, initial share lookup and absence of storage writes for shared payloads.

- [ ] **Step 2: Verify failure**

Run: `cd mobile && node --test test/native-actions.test.mjs test/app-shell.test.mjs test/share-integration.test.mjs`

Expected: FAIL for missing integration.

- [ ] **Step 3: Compose the flow after normal router startup**

After `router.start('home')`, call `getInitialShare()`. If shared, invoke one `beginSharedFlow(text)`. Register `shareReceived` and route every event—including identical repeated text—to the same function.

`beginSharedFlow`:
1. executes `activeScreenCleanup?.()`;
2. saves `router.snapshot()` only when entering share mode from normal mode;
3. calls `session.begin(...)`, which invalidates old async generations;
4. classifies content;
5. starts route `share`.

- [ ] **Step 4: Add share-only routes**

Add `share`, `share-video`, `share-download`, `share-search`. Their transient inputs come from `shareSession.snapshot()`, not loose globals. Back/close from these destinations returns to `share`, not Home.

- [ ] **Step 5: Finish share flow and restore normal navigation**

Order:
1. cleanup active screen;
2. clear session;
3. restore saved normal router snapshot with `{ renderCurrent:true, focus:false }`;
4. clear share-mode state/snapshot;
5. call native `finishShare()`.

Android Back checks share mode first. Only normal mode uses existing router-back / `App.exitApp()` behavior.

- [ ] **Step 6: Prevent remote content refresh from stealing share UI**

The existing `contentStore.load().then(...)` re-render must run only when not in share mode and no text input is active.

- [ ] **Step 7: Run all tests and Android sync/build**

```bash
cd mobile
npm test
npm run build
npm run sync:android
cd android
./gradlew --no-daemon testDebugUnitTest assembleDebug
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add mobile/src/app.mjs mobile/src/core/native-actions.mjs mobile/test/native-actions.test.mjs mobile/test/app-shell.test.mjs mobile/test/share-integration.test.mjs
git commit -m "feat: integrate Android share flow"
```

---

### Task 9: Verificación Android y accesibilidad real

**Files:**
- Modify only the owning file if a defect is found.
- No version bump, release notes or Play Console publication in this task.

- [ ] **Step 1: Install debug build**

Run from `mobile/android`:

```bash
./gradlew --no-daemon installDebug
```

Expected: app installs and still opens normally to Inicio.

- [ ] **Step 2: Verify cold and warm sharing**

Share one article with TifloAcosta while app is closed, then repeat while app is open on a non-home screen. Confirm initial focus reaches “Compartido con TifloAcosta”, finishing returns Android to the previous available task, and reopening TifloAcosta restores its prior normal route.

- [ ] **Step 3: Verify each classification path**

- YouTube watch, `youtu.be`, Shorts: internal player, no autoplay, accessible controls, fallback only if player fails.
- Known download/provider: existing Descargas, URL prefilled, analysis starts only after explicit share action.
- Plain text: search prefilled, no automatic search.
- Two URLs: announce count, choose one, back returns to list.
- Short URL redirecting to YouTube/download: reclassified after redirect.

- [ ] **Step 4: Verify clean-reader navigation**

Use a normal article, a link-index page and a noisy page. Confirm useful headings/lists/links remain, promotional/global navigation is absent, useful links stay inside TifloAcosta and are reclassified, and Back walks internal history correctly.

- [ ] **Step 5: Verify failure limits**

Exercise airplane mode, unreachable host, protected/auth page, non-text URL, redirect loop and a controlled response above 5 MiB. Confirm timeout/size/type/redirect errors are accessible, finite and recoverable.

- [ ] **Step 6: Verify replacement of an active session**

Start loading a slow page, then from another app share a second item before the first completes. Confirm only the second content remains visible, no result from the first later replaces it, and any prior player/audio is stopped.

- [ ] **Step 7: Verify with multiple screen readers**

Use TalkBack plus at least one other reader available to the test group (Jieshuo, AccessiMind or another). Check initial focus, control order, single polite announcements, no focus jumps during load, semantic heading/list/link navigation, Back/Cancel and absence of automatic TifloAcosta speech/audio. Treat reader-specific differences as defects to investigate.

- [ ] **Step 8: Final automated verification after fixes**

```bash
cd mobile
npm test
npm run build
npm run sync:android
cd android
./gradlew --no-daemon testDebugUnitTest assembleDebug
```

Expected: PASS with no uncommitted implementation fixes.

- [ ] **Step 9: Commit each verification fix separately if needed**

Example:

```bash
git commit -m "fix: preserve focus after shared page load"
```

Do not publish a new beta from this plan. Release/version work begins only after this implementation is accepted.
