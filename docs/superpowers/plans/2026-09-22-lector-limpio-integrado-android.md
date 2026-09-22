# Lector limpio integrado en Android Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir la lectura limpia ya implementada para Compartir con TifloAcosta en un servicio común de la app Android, conectarlo a Actualidad y Buscar, y consolidar en una sola entrega las correcciones de apertura exacta de resultados.

**Architecture:** Mantener `readable-page.mjs` como extractor puro y seguro, extraer de `share.mjs` la carga/reclasificación de URL a un servicio común y extraer también el renderizado semántico a una vista reutilizable. Actualidad y Buscar abrirán una ruta normal `reader`, mientras Compartir seguirá usando su sesión efímera pero reutilizará el mismo cargador y la misma vista. Vídeos y Descargas conservarán sus adaptadores existentes; el buscador delegará cada resultado exacto a una acción tipada en lugar de navegar solo a una sección.

**Tech Stack:** Android Java, Capacitor 8.5.2, JavaScript ESM, Node.js 22 `node:test`, Gradle/Android SDK, YouTube IFrame API existente.

**Spec:** `docs/superpowers/specs/2026-09-21-compartir-con-tifloacosta-design.md`

## Global Constraints

- Un solo motor de lectura limpia para Actualidad, Buscar y Compartir.
- El HTML remoto nunca se inyecta directamente mediante `innerHTML` ni ejecuta JavaScript remoto.
- `TifloWebFetchPlugin` conserva sus límites actuales: HTTP/HTTPS, máximo 5 redirecciones, 15 segundos totales, 5 MiB y tipos textuales admitidos.
- La clasificación de enlaces sigue siendo determinista: YouTube → reproductor; descarga conocida → Descargas; web → lector limpio.
- Actualidad abre la noticia limpia como acción principal; “Abrir fuente original” solo se ofrece como alternativa o salida cuando corresponda.
- Buscar abre exactamente el resultado seleccionado y no reduce el resultado a una ruta genérica.
- Los enlaces útiles conservados dentro del lector vuelven a pasar por el clasificador común.
- Compartir conserva su sesión efímera, su historial propio y `moveTaskToBack(true)` al finalizar.
- Actualidad y Buscar usan la navegación normal de la app; al salir del lector vuelven al elemento que lo abrió y restauran foco cuando sea posible.
- No hay reproducción automática ni descargas automáticas.
- La interfaz y mensajes del lector se mantienen en español e inglés.
- Las pruebas de accesibilidad no se limitan a TalkBack; deben funcionar con el lector de pantalla que usen los probadores.
- Este plan no decide todavía `versionName`/`versionCode`; no modificar esos valores hasta que Tony elija el número final de la entrega conjunta.
- No integrar el PR #67 completo tal cual, porque contiene un bump provisional de versión. Portar solo las correcciones funcionales necesarias.

## Review Focus

- Noticia con URL que redirige a YouTube o descarga: reclasificar el destino final y abrir la función correcta sin mostrar una lectura falsa.
- Noticia o página con poco texto pero varios enlaces editoriales útiles: conservarla como índice fiable.
- Resultado de Buscar cuyo tipo futuro no sea uno de los tres actuales: no navegar silenciosamente a una sección equivocada; si no existe una acción segura, no abrir nada y conservar el contexto.
- Dos aperturas de lector casi simultáneas: la respuesta antigua no puede sustituir a la más reciente.
- Volver desde un enlace interno del lector: primero retroceder dentro del historial limpio y después regresar al elemento de Actualidad/Buscar que originó la lectura.

---

## File Structure

### Nuevos archivos

- `mobile/src/core/readable-loader.mjs` — clasificación, fetch, redirección y conversión a página limpia.
- `mobile/src/core/reader-session.mjs` — sesión normal del lector para Actualidad/Buscar, con historial y guardas de petición.
- `mobile/src/screens/reader.mjs` — vista semántica común del lector, sin dependencia de Compartir.
- `mobile/test/readable-loader.test.mjs`
- `mobile/test/reader-session.test.mjs`
- `mobile/test/reader-screen.test.mjs`
- `mobile/test/integrated-reader-navigation.test.mjs`

### Archivos modificados

- `mobile/src/screens/share.mjs`
- `mobile/src/screens/actualidad.mjs`
- `mobile/src/screens/search.mjs`
- `mobile/src/screens/videos.mjs`
- `mobile/src/core/search.mjs`
- `mobile/src/core/i18n.mjs`
- `mobile/src/app.mjs`
- `mobile/test/search.test.mjs`
- `mobile/test/share-screen.test.mjs`
- `mobile/test/share-integration.test.mjs`
- `mobile/test/videos-player.test.mjs`

---

### Task 1: Portar la apertura exacta de resultados sin el bump provisional de versión

**Files:**
- Modify: `mobile/src/core/search.mjs`
- Modify: `mobile/src/screens/search.mjs`
- Modify: `mobile/src/screens/videos.mjs`
- Modify: `mobile/test/search.test.mjs`
- Modify: `mobile/test/videos-player.test.mjs`

**Interfaces:**
- `searchResultAction(result): {type:'video',id:string}|{type:'resource',url:string}|{type:'news',url:string}|null`
- `renderSearch(..., onOpenResult)` delegates the exact result and origin id.
- `renderVideos(..., initialVideoId = '')` opens the matching catalog video without autoplay.

- [ ] **Step 1: Write failing tests for exact result identity**

```js
import { searchResultAction } from '../src/core/search.mjs';

assert.deepEqual(
  searchResultAction({ kind: 'video', id: 'dQw4w9WgXcQ' }),
  { type: 'video', id: 'dQw4w9WgXcQ' }
);
assert.deepEqual(
  searchResultAction({ kind: 'news', source: { originalUrl: 'https://example.test/news' } }),
  { type: 'news', url: 'https://example.test/news' }
);
assert.deepEqual(
  searchResultAction({ kind: 'resource', source: { openUrl: 'https://example.test/doc' } }),
  { type: 'resource', url: 'https://example.test/doc' }
);
assert.equal(searchResultAction({ kind: 'future-kind' }), null);
```

Update the source-contract assertion for Search so it expects `onOpenResult(result, button.id)` and no direct `router.navigate(result.route, ...)`.

Add a video test asserting `initialVideoId` selects the matching video by queueing `openPlayer` without calling `playVideo()` automatically.

- [ ] **Step 2: Run focused tests and verify failure**

Run:

```bash
cd mobile
node --test test/search.test.mjs test/videos-player.test.mjs
```

Expected: FAIL because the share branch still contains generic route navigation and no `initialVideoId` path.

- [ ] **Step 3: Implement only the functional PR #67 behavior**

Add `searchResultAction()` to `core/search.mjs`, but return distinct `news` and `resource` types instead of a generic `external` action so `app.mjs` can send news to the reader and resources to their exact destination.

Change Search click handling to:

```js
button.addEventListener('click', () => {
  if (typeof onOpenResult === 'function') onOpenResult(result, button.id);
});
```

Add `initialVideoId` to `renderVideos` and queue `openPlayer(item, playButton)` only for the matching result. Do not copy the provisional Android 1.0.4 version change from PR #67.

- [ ] **Step 4: Run focused and full tests**

Run:

```bash
cd mobile
node --test test/search.test.mjs test/videos-player.test.mjs
npm test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/core/search.mjs mobile/src/screens/search.mjs mobile/src/screens/videos.mjs mobile/test/search.test.mjs mobile/test/videos-player.test.mjs
git commit -m "fix: preserve exact mobile search results"
```

---

### Task 2: Extraer un cargador común de lectura limpia

**Files:**
- Create: `mobile/src/core/readable-loader.mjs`
- Create: `mobile/test/readable-loader.test.mjs`
- Modify: `mobile/src/screens/share.mjs`

**Interfaces:**
- `loadReadableTarget({ url, resolveDownload, webFetch }): Promise<{kind:'readable'|'youtube'|'download'|'unreliable', classification, page?, payload?}>`

- [ ] **Step 1: Write failing tests for redirection and reclassification**

```js
import { loadReadableTarget } from '../src/core/readable-loader.mjs';

const resolveDownload = url => ({ provider: url.includes('.pdf') ? 'direct' : 'web' });

test('redirected web target is reclassified before reading', async () => {
  const result = await loadReadableTarget({
    url: 'https://short.example/x',
    resolveDownload,
    webFetch: async () => ({
      finalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      contentType: 'text/html',
      body: '<html></html>'
    })
  });
  assert.equal(result.kind, 'youtube');
});

test('normal article returns the safe readable model', async () => {
  const result = await loadReadableTarget({
    url: 'https://example.test/article',
    resolveDownload,
    webFetch: async () => ({
      finalUrl: 'https://example.test/article',
      contentType: 'text/html',
      body: '<article><h1>Título</h1><p>Primer párrafo suficientemente largo para una lectura fiable.</p><p>Segundo párrafo suficientemente largo para completar la lectura fiable.</p></article>'
    })
  });
  assert.equal(result.kind, 'readable');
  assert.equal(result.page.title, 'Título');
});
```

- [ ] **Step 2: Verify failure**

Run: `cd mobile && node --test test/readable-loader.test.mjs`

Expected: FAIL because `readable-loader.mjs` does not exist.

- [ ] **Step 3: Move URL resolution out of `share.mjs`**

`readable-loader.mjs` imports `classifySharedUrl` and `extractReadablePage`. It fetches only when the initial classification is `web`, reclassifies `finalUrl`, and returns `unreliable` when the page model is not reliable.

`share.mjs` must import `loadReadableTarget` and delete its private `resolveSharedUrl` implementation. Preserve all current share request-generation guards and focus behavior.

- [ ] **Step 4: Run focused and share tests**

Run:

```bash
cd mobile
node --test test/readable-loader.test.mjs test/share-screen.test.mjs test/share-integration.test.mjs
npm test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/core/readable-loader.mjs mobile/src/screens/share.mjs mobile/test/readable-loader.test.mjs
git commit -m "refactor: share the readable page loader"
```

---

### Task 3: Crear sesión normal del lector para Actualidad y Buscar

**Files:**
- Create: `mobile/src/core/reader-session.mjs`
- Create: `mobile/test/reader-session.test.mjs`

**Interfaces:**
- `createReaderSession()` → `begin({url,title,allowOriginalFallback})`, `beginRequest()`, `isCurrentRequest(token)`, `push(page)`, `pop()`, `setError(error)`, `snapshot()`, `clear()`.

- [ ] **Step 1: Write failing tests for history and stale responses**

```js
const session = createReaderSession();
const first = session.begin({ url: 'https://one.test', title: 'One', allowOriginalFallback: true });
const request = session.beginRequest();
session.push({ url: 'https://one.test', title: 'One', blocks: [] });
session.push({ url: 'https://two.test', title: 'Two', blocks: [] });
assert.equal(session.pop().url, 'https://one.test');

session.begin({ url: 'https://three.test', title: 'Three' });
assert.equal(session.isCurrentRequest(request), false);
assert.equal(session.snapshot().generation, first.generation + 1);
```

- [ ] **Step 2: Verify failure**

Run: `cd mobile && node --test test/reader-session.test.mjs`

Expected: FAIL for missing module.

- [ ] **Step 3: Implement memory-only reader state**

Use the same generation/request-id pattern already proven in `share-session.mjs`. Do not store reader state in localStorage. `pop()` never removes the first page; the app router owns exit from the reader root.

- [ ] **Step 4: Verify**

Run: `cd mobile && node --test test/reader-session.test.mjs && npm test`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/core/reader-session.mjs mobile/test/reader-session.test.mjs
git commit -m "feat: add normal readable session"
```

---

### Task 4: Extraer una vista semántica común del lector

**Files:**
- Create: `mobile/src/screens/reader.mjs`
- Create: `mobile/test/reader-screen.test.mjs`
- Modify: `mobile/src/screens/share.mjs`
- Modify: `mobile/src/core/i18n.mjs`

**Interfaces:**
- `renderReadableContent({ parent, page, t, linkIdPrefix, onActivateLink }): { heading: HTMLElement }`
- `renderReader({ root, router, session, t, onActivateLink, onRetry, onOpenOriginal }): { back(): boolean }`

- [ ] **Step 1: Write failing structural tests**

Assert that the common renderer:

```js
assert.match(source, /document\.createElement\(`h\$\{level\}`\)/);
assert.match(source, /document\.createElement\('ul'\)/);
assert.match(source, /part\.type === 'link'/);
assert.doesNotMatch(source, /innerHTML\s*=/);
```

Add an integration fixture containing heading, paragraph, list item and useful link; verify the view creates semantic nodes and calls `onActivateLink(url, originId)` rather than opening the browser itself.

- [ ] **Step 2: Verify failure**

Run: `cd mobile && node --test test/reader-screen.test.mjs`

Expected: FAIL because the reader rendering is still embedded in `share.mjs`.

- [ ] **Step 3: Implement the common renderer and normal reader screen**

Move the safe block-to-DOM rendering logic from `share.mjs` into `renderReadableContent`. The normal `renderReader` adds:

- one screen heading;
- source/domain text;
- live status for loading/error;
- “Reintentar” on fetch errors;
- “Abrir fuente original” only when `allowOriginalFallback === true` and an original URL exists;
- Back that first pops clean history and otherwise delegates to `router.back()`.

Keep Share-specific wording and “Volver a la aplicación anterior” inside `share.mjs`; Share uses only `renderReadableContent`, not the normal reader shell.

Add bilingual reader copy under a `reader` dictionary in `i18n.mjs`.

- [ ] **Step 4: Replace duplicate Share rendering**

`share.mjs` calls `renderReadableContent({ parent: container, page, t, linkIdPrefix: 'share-readable', onActivateLink })` and retains only Share-specific buttons/history/error behavior.

- [ ] **Step 5: Verify**

Run:

```bash
cd mobile
node --test test/reader-screen.test.mjs test/share-screen.test.mjs test/share-integration.test.mjs
npm test
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add mobile/src/screens/reader.mjs mobile/src/screens/share.mjs mobile/src/core/i18n.mjs mobile/test/reader-screen.test.mjs mobile/test/share-screen.test.mjs mobile/test/share-integration.test.mjs
git commit -m "refactor: share the accessible reader view"
```

---

### Task 5: Conectar Actualidad al lector limpio

**Files:**
- Modify: `mobile/src/screens/actualidad.mjs`
- Modify: `mobile/src/app.mjs`
- Create/Modify: `mobile/test/integrated-reader-navigation.test.mjs`

**Interfaces:**
- `renderActualidad(..., onOpenNews)` calls `onOpenNews(item, originId)`.
- App helper `openReadableFromApp({url,title,originId,allowOriginalFallback:true})` starts `readerSession`, navigates to `reader`, and loads the first page.

- [ ] **Step 1: Write failing Actualidad tests**

Assert the news title is an actionable button with a stable id and delegates to `onOpenNews`:

```js
assert.match(actualidadSource, /onOpenNews\(item,\s*openButton\.id\)/);
assert.doesNotMatch(actualidadSource, /nativeActions\?\.openExternal\?\.\(item\.originalUrl\)/);
```

Add app-level source-contract assertions for a `reader` route and `openReadableFromApp`.

- [ ] **Step 2: Verify failure**

Run: `cd mobile && node --test test/integrated-reader-navigation.test.mjs`

Expected: FAIL because Actualidad still opens externally or is not actionable on the share branch.

- [ ] **Step 3: Implement Actualidad primary reading**

For each news item with `originalUrl`, create a button inside the `h2`, assign `id = news-open-${item.id}`, and call `onOpenNews(item, openButton.id)`.

Keep the existing explicit “Abrir fuente original” link in the card as an alternative. It must not be the action behind the title.

In `app.mjs`, create `readerSession`, `pendingReaderLoad` state and the `reader` route. The load path uses `loadReadableTarget`; if final classification becomes YouTube or download, route to the appropriate existing function instead of rendering a fake article.

- [ ] **Step 4: Verify Actualidad and full suite**

Run:

```bash
cd mobile
node --test test/integrated-reader-navigation.test.mjs
npm test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/screens/actualidad.mjs mobile/src/app.mjs mobile/test/integrated-reader-navigation.test.mjs
git commit -m "feat: read Actualidad inside TifloAcosta"
```

---

### Task 6: Conectar Buscar al destino exacto y al lector común

**Files:**
- Modify: `mobile/src/app.mjs`
- Modify: `mobile/test/search.test.mjs`
- Modify: `mobile/test/integrated-reader-navigation.test.mjs`

**Interfaces:**
- `openSearchResult(result, originId)` dispatches `video`, `resource`, `news`, or returns `false` for unsupported future kinds.

- [ ] **Step 1: Write failing dispatch tests**

Pin the intended behavior:

- video → set `pendingVideoId` and navigate to `videos`;
- news → `openReadableFromApp` with `allowOriginalFallback:true`;
- resource → open the exact `openUrl || url` rather than Library root;
- unsupported kind/action → return false and remain in Search.

- [ ] **Step 2: Verify failure**

Run: `cd mobile && node --test test/search.test.mjs test/integrated-reader-navigation.test.mjs`

Expected: FAIL until `app.mjs` performs typed dispatch.

- [ ] **Step 3: Implement typed dispatch**

Use `searchResultAction(result)` only. Do not branch on `result.route` in Search UI. A news result must enter the same `reader` route used by Actualidad; a video uses the accessible catalog player path; a resource opens its exact resource target.

- [ ] **Step 4: Verify**

Run:

```bash
cd mobile
node --test test/search.test.mjs test/integrated-reader-navigation.test.mjs test/videos-player.test.mjs
npm test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/app.mjs mobile/test/search.test.mjs mobile/test/integrated-reader-navigation.test.mjs
git commit -m "fix: open exact search results"
```

---

### Task 7: Clasificar enlaces conservados desde el lector normal

**Files:**
- Modify: `mobile/src/app.mjs`
- Modify: `mobile/test/integrated-reader-navigation.test.mjs`

**Interfaces:**
- `openReaderLink(url, originId)` classifies and either pushes another readable page, opens accessible video, or opens Downloads.

- [ ] **Step 1: Write failing navigation tests**

Cover:

```text
reader page -> web link -> second clean page -> Back -> first clean page
reader page -> YouTube -> accessible player -> Back -> same clean page/origin
reader page -> download link -> Downloads analyzer -> Back -> same clean page/origin
```

Also assert a stale fetch result cannot replace a newer requested page.

- [ ] **Step 2: Verify failure**

Run: `cd mobile && node --test test/integrated-reader-navigation.test.mjs`

Expected: FAIL for missing reader link dispatcher/history handling.

- [ ] **Step 3: Implement link dispatch and Back precedence**

Use `classifySharedUrl()` and `loadReadableTarget()`; do not duplicate provider/YouTube recognition. While route is `reader`, Android Back first asks the reader controller to pop internal history. Only when there is one clean page left does normal `router.back()` return to Actualidad or Buscar and restore the original control focus.

- [ ] **Step 4: Verify**

Run: `cd mobile && node --test test/integrated-reader-navigation.test.mjs && npm test`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/app.mjs mobile/test/integrated-reader-navigation.test.mjs
git commit -m "feat: navigate links inside the clean reader"
```

---

### Task 8: Final integration, regression and Android build

**Files:**
- Modify only if tests reveal a specific defect.

**Interfaces:** none new.

- [ ] **Step 1: Run all repository and mobile tests**

```bash
npm test
cd mobile
npm test
npm run build
```

Expected: PASS with no skipped regression introduced by this work.

- [ ] **Step 2: Synchronize and build Android validation artifacts**

```bash
cd mobile
npx cap sync android
cd android
./gradlew --no-daemon assembleDebug bundleRelease
```

Expected: PASS; debug APK and release AAB are produced. Signing uses repository secrets only in CI; no secret values belong in source.

- [ ] **Step 3: Inspect branch diff against `main`**

Confirm the final delivery contains:

- existing Compartir feature;
- common clean reader;
- Actualidad title → clean reader;
- exact Search results;
- preserved-link navigation;
- no accidental provisional version bump from PR #67;
- no unrelated color/theme changes unless separately approved.

- [ ] **Step 4: Accessibility manual checklist for testers**

Ask Android beta testers to verify with the screen reader they use:

- Actualidad title announces as actionable and opens clean content;
- heading focus lands on the clean article;
- heading/list/link navigation is logical;
- preserved links open the correct destination and Back returns correctly;
- Search video/news/resource open the exact chosen item;
- Compartir still behaves as before and never autoplays;
- no duplicated live-region announcements or unexpected focus jumps.

Do not mark manual accessibility complete until real tester feedback is received.

- [ ] **Step 5: Commit only if verification required code changes**

If no code changes were needed, do not create an empty commit.

---

## Self-review result

- Spec coverage: common reader, Actualidad, Search, Share, preserved links, focus/back behavior, security and error fallback are all mapped to tasks.
- Placeholder scan: no implementation placeholder is left; version numbering is intentionally excluded as a product decision, not deferred implementation.
- Type consistency: `loadReadableTarget`, `createReaderSession`, `renderReadableContent`, `renderReader`, `searchResultAction`, `openReadableFromApp` and `openReaderLink` have one stable role each.
- Review Focus: redirect reclassification, link-index reliability, unknown future search kinds, stale async responses and Back/history are all covered by owning tasks.
