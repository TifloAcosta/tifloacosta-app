# TifloAcosta Official Mobile Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first working foundation of the official TifloAcosta iOS/Android app: Capacitor shell, clean accessible navigation, remote content with last-valid cache, global search, global favorites, compact hub screens, and bilingual preferences without changing the current public PWA behavior.

**Architecture:** Keep the existing PWA at the repository root stable. Add a separate `mobile/` Capacitor application using accessible vanilla HTML/CSS/ES modules and a static content feed generated from the existing resource and YouTube data. The mobile app reads `https://tifloacosta.com/mobile-content.json`, caches the last valid payload locally, and exposes stable interfaces that the later Actualidad and native-integration plans can extend.

**Tech Stack:** Node.js 20, native Node test runner, HTML5, CSS, ES modules, Capacitor, existing GitHub Pages/Jekyll deployment.

**Spec:** `docs/superpowers/specs/2026-09-13-tifloacosta-mobile-apps-design.md`

## Global Constraints

- Public app name: `TifloAcosta`.
- Application identifier: `com.tifloacosta.app`.
- Accessibility has priority over decorative or convenience behavior.
- Home order: Actualidad, Buscar, Biblioteca, Favoritos, Vídeos, Libro, Podcast, Contacto y redes, Configuración.
- Navigation must be clean and silent: no automatic carousel, no focus stealing, no automatic search-field focus, no repetitive sync announcements.
- Every secondary screen must expose a clearly named back control and move focus to its main heading when opened.
- Returning from a result must restore focus to the originating result when it still exists.
- Spanish and English UI are first-class; translations are natural, not literal.
- Favorites and preferences are local to the device in version 1.
- Current PWA files and behavior remain available at `https://tifloacosta.com/` while the mobile app is developed.
- This plan creates the `news` data interface and Actualidad screen state, but the automated news ingestion/editorial pipeline belongs to the next implementation plan.
- Native notifications, deep links, sharing, file saving and intelligent external-app opening belong to the native-integration plan after this foundation.

---

## File Structure Locked by This Plan

- `scripts/build-mobile-content.mjs` — generate the public mobile content feed from existing repository data.
- `mobile-content.json` — generated deployment artifact; not manually edited.
- `.github/workflows/jekyll-gh-pages.yml` — generate `mobile-content.json` before Pages packaging.
- `mobile/package.json` — Capacitor dependencies and mobile test/sync scripts.
- `mobile/capacitor.config.json` — official app identity and web directory.
- `mobile/src/index.html` — minimal accessible app document and mounting point.
- `mobile/src/styles.css` — mobile app layout and preference classes.
- `mobile/src/app.mjs` — composition root only; wires stores, router and screens.
- `mobile/src/core/router.mjs` — route stack, origin tracking and back behavior.
- `mobile/src/core/focus.mjs` — heading focus and origin-focus restoration.
- `mobile/src/core/content-store.mjs` — remote feed validation, fetch and last-valid cache.
- `mobile/src/core/search.mjs` — one global search across all supported content kinds.
- `mobile/src/core/favorites.mjs` — persistent global favorite references.
- `mobile/src/core/preferences.mjs` — language and visual preferences.
- `mobile/src/core/i18n.mjs` — Spanish/English interface copy.
- `mobile/src/screens/home.mjs` — compact home distributor.
- `mobile/src/screens/actualidad.mjs` — Actualidad list/empty state consuming `news`.
- `mobile/src/screens/search.mjs` — global search UI.
- `mobile/src/screens/library.mjs` — resource browser.
- `mobile/src/screens/favorites.mjs` — global favorites UI.
- `mobile/src/screens/videos.mjs` — video browser.
- `mobile/src/screens/book.mjs` — book information and action entry points.
- `mobile/src/screens/podcast.mjs` — podcast platform hub.
- `mobile/src/screens/contact.mjs` — contact/social hub.
- `mobile/src/screens/settings.mjs` — language and visual settings.
- `mobile/test/*.test.mjs` — focused unit/regression tests for each core module and the accessible shell.

---

### Task 1: Generate a Stable Mobile Content Feed

**Files:**
- Create: `scripts/build-mobile-content.mjs`
- Create: `test/mobile-content.test.mjs`
- Modify: `.github/workflows/jekyll-gh-pages.yml`

**Interfaces:**
- Consumes: `data.js` (`window.TIFLO_RESOURCES`) and `videos.json` (`videos`).
- Produces: `buildMobileContent({ resources, videos, generatedAt }) -> MobileContentV1` and deployment file `/mobile-content.json`.
- `MobileContentV1` shape:

```js
{
  schemaVersion: 1,
  generatedAt: 'ISO-8601',
  resources: [{ kind: 'resource', id, lang, category, title, url, openUrl, isNew }],
  videos: [{ kind: 'video', id, title, publishedAt, description, excerpt, thumbnail, url }],
  news: []
}
```

- [ ] **Step 1: Write the failing feed-shape test**

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMobileContent } from '../scripts/build-mobile-content.mjs';

test('mobile content feed normalizes resources and videos and exposes news', () => {
  const feed = buildMobileContent({
    resources: [{ id: 'r1', lang: 'es', category: 'iPhone', title: 'Guía', url: 'https://download', openUrl: 'https://read', new: true }],
    videos: [{ id: 'v1', title: 'Vídeo', publishedAt: '2026-09-13T09:00:00Z', url: 'https://youtube' }],
    generatedAt: '2026-09-13T18:00:00.000Z'
  });

  assert.equal(feed.schemaVersion, 1);
  assert.equal(feed.resources[0].kind, 'resource');
  assert.equal(feed.resources[0].isNew, true);
  assert.equal(feed.videos[0].kind, 'video');
  assert.deepEqual(feed.news, []);
});
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `node --test test/mobile-content.test.mjs`

Expected: FAIL because `scripts/build-mobile-content.mjs` does not exist.

- [ ] **Step 3: Implement feed normalization and CLI generation**

Use `node:vm` to evaluate `data.js` in an isolated `{ window: {} }` context, parse `videos.json`, call the exported pure `buildMobileContent`, and write pretty JSON to `mobile-content.json` when the module is executed directly.

Core implementation must normalize resource `new` to `isNew` and must never mutate source objects:

```js
export function buildMobileContent({ resources, videos, generatedAt = new Date().toISOString() }) {
  return {
    schemaVersion: 1,
    generatedAt,
    resources: resources.map(item => ({
      kind: 'resource',
      id: item.id,
      lang: item.lang,
      category: item.category,
      title: item.title,
      url: item.url,
      openUrl: item.openUrl || item.url,
      isNew: Boolean(item.new)
    })),
    videos: videos.map(item => ({
      kind: 'video',
      id: item.id,
      title: item.title || '',
      publishedAt: item.publishedAt || '',
      description: item.description || '',
      excerpt: item.excerpt || '',
      thumbnail: item.thumbnail || '',
      url: item.url || ''
    })),
    news: []
  };
}
```

- [ ] **Step 4: Run tests and generate the local artifact**

Run:

```bash
node --test test/mobile-content.test.mjs
node scripts/build-mobile-content.mjs
node -e "const x=require('./mobile-content.json'); if(x.schemaVersion!==1) process.exit(1); console.log(x.resources.length, x.videos.length)"
```

Expected: test PASS; command prints non-zero resource and video counts.

- [ ] **Step 5: Add feed generation to Pages build**

Insert this step after Node setup and before the video-search-index step:

```yaml
      - name: Build mobile content feed
        run: node scripts/build-mobile-content.mjs
```

- [ ] **Step 6: Run the full root test suite**

Run: `npm test`

Expected: all existing and new tests PASS.

- [ ] **Step 7: Commit**

```bash
git add scripts/build-mobile-content.mjs test/mobile-content.test.mjs .github/workflows/jekyll-gh-pages.yml
git commit -m "feat: publish mobile content feed"
```

Do not add generated `mobile-content.json` to the commit; Pages creates it during deployment.

---

### Task 2: Create the Capacitor Mobile Project Without Disturbing the PWA

**Files:**
- Create: `mobile/package.json`
- Create: `mobile/capacitor.config.json`
- Create: `mobile/src/index.html`
- Create: `mobile/src/styles.css`
- Create: `mobile/src/app.mjs`
- Create: `mobile/test/config.test.mjs`
- Modify: `.gitignore` if the repository already has one; otherwise create `.gitignore` with mobile dependency/native build exclusions.

**Interfaces:**
- Produces Capacitor config with `appId=com.tifloacosta.app`, `appName=TifloAcosta`, `webDir=src`.
- `mobile/src/app.mjs` initially mounts only a heading and imports no native plugin yet.

- [ ] **Step 1: Write the failing configuration test**

```js
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('Capacitor config uses the official TifloAcosta identity', async () => {
  const config = JSON.parse(await readFile(new URL('../capacitor.config.json', import.meta.url), 'utf8'));
  assert.equal(config.appId, 'com.tifloacosta.app');
  assert.equal(config.appName, 'TifloAcosta');
  assert.equal(config.webDir, 'src');
});
```

- [ ] **Step 2: Run the test and verify failure**

Run: `node --test mobile/test/config.test.mjs`

Expected: FAIL because the config does not exist.

- [ ] **Step 3: Create mobile package and Capacitor config**

`mobile/package.json`:

```json
{
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test test/*.test.mjs",
    "sync:android": "npx cap sync android",
    "sync:ios": "npx cap sync ios"
  }
}
```

`mobile/capacitor.config.json`:

```json
{
  "appId": "com.tifloacosta.app",
  "appName": "TifloAcosta",
  "webDir": "src",
  "server": {
    "androidScheme": "https"
  }
}
```

- [ ] **Step 4: Install Capacitor packages inside `mobile/`**

Run:

```bash
cd mobile
npm install @capacitor/core @capacitor/app
npm install --save-dev @capacitor/cli @capacitor/android @capacitor/ios
cd ..
```

Expected: `mobile/package-lock.json` is created and install exits 0.

- [ ] **Step 5: Create minimal accessible shell**

`mobile/src/index.html` must contain exactly one `<main id="app" tabindex="-1">`, a skip link targeting `#app`, `<html lang="es">`, viewport metadata, and `<script type="module" src="./app.mjs"></script>`. Do not add ARIA roles that duplicate native HTML semantics.

Initial `app.mjs`:

```js
const root = document.querySelector('#app');
root.innerHTML = '<h1 data-screen-heading tabindex="-1">TifloAcosta</h1>';
```

- [ ] **Step 6: Add a shell regression test**

Append to `mobile/test/config.test.mjs` a test that reads `src/index.html` and asserts the skip link, single main element, module script, `lang="es"`, and absence of `autofocus`.

- [ ] **Step 7: Run mobile tests**

Run: `cd mobile && npm test`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add mobile .gitignore
git commit -m "feat: scaffold Capacitor mobile app"
```

---

### Task 3: Implement Silent Navigation and Focus Restoration

**Files:**
- Create: `mobile/src/core/router.mjs`
- Create: `mobile/src/core/focus.mjs`
- Create: `mobile/test/navigation.test.mjs`
- Modify: `mobile/src/app.mjs`

**Interfaces:**
- Produces `createRouter({ render, focusScreenHeading, restoreOriginFocus })`.
- Router methods: `start(route='home')`, `navigate(route, { originId = null } = {})`, `back()` and `current()`.
- Route record: `{ name: string, originId: string|null }`.
- Focus helpers: `focusScreenHeading(root)` and `restoreOriginFocus(root, originId)` return booleans.

- [ ] **Step 1: Write failing stack/back tests**

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRouter } from '../src/core/router.mjs';

test('back returns to previous route and preserves origin id', () => {
  const renders = [];
  const router = createRouter({
    render: route => renders.push(route),
    focusScreenHeading: () => {},
    restoreOriginFocus: () => {}
  });
  router.start('home');
  router.navigate('search');
  router.navigate('library', { originId: 'result-resource-r1' });
  router.back();
  assert.equal(router.current().name, 'search');
  assert.equal(renders.at(-1).name, 'search');
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `cd mobile && node --test test/navigation.test.mjs`

Expected: FAIL because router module is missing.

- [ ] **Step 3: Implement minimal route stack**

Rules:

```js
// start replaces stack with one route.
// navigate pushes a route and renders it, then focuses its heading.
// back with stack length > 1 pops current, renders previous, then restores the popped route's originId.
// back at home returns false and performs no rendering.
```

Do not use timers for focus. Render synchronously, then call the focus helper.

- [ ] **Step 4: Implement focus helpers with native focus only**

```js
export function focusScreenHeading(root) {
  const heading = root.querySelector('[data-screen-heading]');
  if (!heading || typeof heading.focus !== 'function') return false;
  heading.focus();
  return true;
}

export function restoreOriginFocus(root, originId) {
  if (!originId) return false;
  const target = root.querySelector(`#${CSS.escape(originId)}`);
  if (!target || typeof target.focus !== 'function') return false;
  target.focus();
  return true;
}
```

- [ ] **Step 5: Add focus-helper tests using tiny fake root objects**

Test success and missing-target cases without introducing a DOM-test dependency.

- [ ] **Step 6: Wire router creation in `app.mjs`**

Keep `app.mjs` as composition only. It must not contain route-specific HTML strings after Task 5.

- [ ] **Step 7: Run mobile tests**

Run: `cd mobile && npm test`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add mobile/src/core/router.mjs mobile/src/core/focus.mjs mobile/src/app.mjs mobile/test/navigation.test.mjs
git commit -m "feat: add accessible mobile navigation core"
```

---

### Task 4: Fetch Remote Content With Last-Valid Cache

**Files:**
- Create: `mobile/src/core/content-store.mjs`
- Create: `mobile/test/content-store.test.mjs`
- Modify: `mobile/src/app.mjs`

**Interfaces:**
- Produces `createContentStore({ fetchFn, storage, url })`.
- Methods: `load() -> Promise<{ status: 'fresh'|'cached'|'empty', content: MobileContentV1|null }>` and `getCurrent()`.
- Cache key: `tiflo-mobile-content-v1`.
- Default URL: `https://tifloacosta.com/mobile-content.json`.

- [ ] **Step 1: Write failing fresh/cache/error tests**

Cover all three states:

```js
assert.equal((await freshStore.load()).status, 'fresh');
assert.equal((await failingStoreWithCache.load()).status, 'cached');
assert.equal((await failingStoreWithoutCache.load()).status, 'empty');
```

Also verify that an invalid `schemaVersion` is rejected and does not overwrite a valid cache.

- [ ] **Step 2: Run and verify failure**

Run: `cd mobile && node --test test/content-store.test.mjs`

Expected: FAIL because the module is missing.

- [ ] **Step 3: Implement strict feed validation**

Validation requirements:

```js
content &&
content.schemaVersion === 1 &&
Array.isArray(content.resources) &&
Array.isArray(content.videos) &&
Array.isArray(content.news)
```

A failed fetch or invalid payload must fall back to the stored valid payload. Storage exceptions must be caught without crashing the app.

- [ ] **Step 4: Ensure loading is silent unless there is no usable content**

`content-store.mjs` returns state only. It must not manipulate DOM, move focus, speak via live regions or log routine sync messages to the user interface.

- [ ] **Step 5: Wire store into app startup**

`app.mjs` starts the router immediately with local shell UI, loads remote content in the background, updates the in-memory content reference, and re-renders only when the user is not in the middle of an active text-input interaction. Do not move focus after the refresh.

- [ ] **Step 6: Run mobile tests**

Run: `cd mobile && npm test`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add mobile/src/core/content-store.mjs mobile/src/app.mjs mobile/test/content-store.test.mjs
git commit -m "feat: cache last valid mobile content"
```

---

### Task 5: Build the Compact Bilingual Home and Hub Screens

**Files:**
- Create: `mobile/src/core/i18n.mjs`
- Create: `mobile/src/core/preferences.mjs`
- Create: `mobile/src/screens/home.mjs`
- Create: `mobile/src/screens/actualidad.mjs`
- Create: `mobile/src/screens/library.mjs`
- Create: `mobile/src/screens/videos.mjs`
- Create: `mobile/src/screens/book.mjs`
- Create: `mobile/src/screens/podcast.mjs`
- Create: `mobile/src/screens/contact.mjs`
- Create: `mobile/src/screens/settings.mjs`
- Create: `mobile/test/home.test.mjs`
- Create: `mobile/test/preferences.test.mjs`
- Modify: `mobile/src/app.mjs`
- Modify: `mobile/src/styles.css`

**Interfaces:**
- `HOME_ITEMS` exact order: `actualidad`, `search`, `library`, `favorites`, `videos`, `book`, `podcast`, `contact`, `settings`.
- Each screen renderer receives `{ root, router, content, preferences, t }`.
- `preferences` shape: `{ lang:'es'|'en', textSize:'normal'|'large'|'xlarge'|'max', theme:'auto'|'light'|'dark', spacing:'normal'|'comfortable'|'wide', bold:boolean }`.
- Storage key: `tiflo-mobile-preferences-v1`.

- [ ] **Step 1: Write failing home-order and translation tests**

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { HOME_ITEMS } from '../src/screens/home.mjs';
import { text } from '../src/core/i18n.mjs';

test('home uses the approved compact order', () => {
  assert.deepEqual(HOME_ITEMS, ['actualidad','search','library','favorites','videos','book','podcast','contact','settings']);
});

test('home labels exist in Spanish and English', () => {
  for (const lang of ['es', 'en']) {
    for (const key of HOME_ITEMS) assert.ok(text(lang, `home.${key}`));
  }
});
```

- [ ] **Step 2: Run focused tests and verify failure**

Run: `cd mobile && node --test test/home.test.mjs test/preferences.test.mjs`

Expected: FAIL because modules are missing.

- [ ] **Step 3: Implement i18n and preferences core**

Use explicit dictionaries, not machine translation at runtime. Preferences read/write must tolerate corrupt or blocked storage and fall back to defaults. Apply visual preferences with classes on `<html>` such as `text-large`, `theme-dark`, `spacing-wide`, `text-bold`.

- [ ] **Step 4: Implement home as links/buttons only, except Actualidad preview**

Home must render one heading and the nine entries in approved order. Do not expose podcast platforms, social networks or setting controls on Home. The Actualidad block may show up to five `news` items when available; when `news` is empty it shows only the Actualidad entry, not a fake news item.

- [ ] **Step 5: Implement secondary hub screens**

Requirements:

- `actualidad.mjs`: stable snapshot of `content.news`; empty state text when none; no automatic refresh while reading.
- `library.mjs`: resource list filtered by current language; resource titles are the primary controls.
- `videos.mjs`: video list; no second search field.
- `book.mjs`: title, subtitle/description and purchase entry points using the current TifloAcosta book information.
- `podcast.mjs`: one screen containing Spotify, Apple Podcasts, iVoox, Podimo and radio.es links.
- `contact.mjs`: WhatsApp, email, Instagram and Facebook links only after entering the screen.
- `settings.mjs`: language and visual settings; no “install app” or manual app-update controls.
- Every secondary screen begins with a `Volver`/`Back` button and an `<h1 data-screen-heading tabindex="-1">`.

- [ ] **Step 6: Add structural regression assertions**

Test generated strings or exported screen metadata to confirm:

- Home has no podcast-platform URLs.
- Home has no social URLs.
- Home has no visual-setting form controls.
- Secondary-screen labels exist in both languages.
- No screen markup contains `autofocus`.

- [ ] **Step 7: Run mobile tests**

Run: `cd mobile && npm test`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add mobile/src mobile/test/home.test.mjs mobile/test/preferences.test.mjs
git commit -m "feat: add clean bilingual mobile hubs"
```

---

### Task 6: Implement One Global Search

**Files:**
- Create: `mobile/src/core/search.mjs`
- Create: `mobile/src/screens/search.mjs`
- Create: `mobile/test/search.test.mjs`
- Modify: `mobile/src/app.mjs`

**Interfaces:**
- Produces `searchContent(content, query, lang) -> SearchResult[]`.
- `SearchResult`: `{ kind:'news'|'resource'|'video', id, title, subtitle, route, source }`.
- Result DOM id format: `result-${kind}-${id}`.

- [ ] **Step 1: Write failing normalization/group tests**

Tests must prove that search:

- ignores accents and case;
- searches resources and videos from day one;
- accepts `news` without changing the API;
- filters language-specific resources/news to selected UI language;
- does not require a category/filter before searching.

Example:

```js
const results = searchContent(content, 'camara', 'es');
assert.ok(results.some(item => item.title.includes('Cámara')));
```

- [ ] **Step 2: Run and verify failure**

Run: `cd mobile && node --test test/search.test.mjs`

Expected: FAIL because search module is missing.

- [ ] **Step 3: Implement deterministic search**

Use Unicode NFD diacritic stripping and lowercase normalization. Search title first, then category/description/excerpt. Sort by exact-title-start match, then title locale compare, then id for deterministic ordering.

- [ ] **Step 4: Build accessible Search screen**

Requirements:

- one labeled `<input type="search">`;
- no `autofocus`;
- one Search button;
- one polite `aria-live` result-count paragraph;
- results grouped under real headings by content kind;
- result title is the primary control;
- opening a result passes its DOM id as `originId` to the router.

- [ ] **Step 5: Verify focus restoration behavior with router test**

Extend navigation test so opening `result-resource-r1`, navigating to Library/detail and calling back requests restoration of `result-resource-r1`.

- [ ] **Step 6: Run mobile tests**

Run: `cd mobile && npm test`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add mobile/src/core/search.mjs mobile/src/screens/search.mjs mobile/src/app.mjs mobile/test/search.test.mjs mobile/test/navigation.test.mjs
git commit -m "feat: add global mobile search"
```

---

### Task 7: Implement Global Favorites Across Content Types

**Files:**
- Create: `mobile/src/core/favorites.mjs`
- Create: `mobile/src/screens/favorites.mjs`
- Create: `mobile/test/favorites.test.mjs`
- Modify: `mobile/src/screens/library.mjs`
- Modify: `mobile/src/screens/videos.mjs`
- Modify: `mobile/src/screens/actualidad.mjs`
- Modify: `mobile/src/app.mjs`

**Interfaces:**
- Favorite reference: `{ kind:'news'|'resource'|'video', id:string }`.
- Storage key: `tiflo-mobile-favorites-v1`.
- Produces `createFavoritesStore(storage)` with `list()`, `has(ref)`, `toggle(ref)`, `remove(ref)`.

- [ ] **Step 1: Write failing persistence/idempotency tests**

Cover resource, video and future news references; corrupt storage; duplicate toggles; removing missing item.

- [ ] **Step 2: Run and verify failure**

Run: `cd mobile && node --test test/favorites.test.mjs`

Expected: FAIL because favorites module is missing.

- [ ] **Step 3: Implement stable reference storage**

Store only `{kind,id}` references, never whole content objects. Resolve current titles/URLs against the latest content feed so content updates do not duplicate favorites.

- [ ] **Step 4: Add favorite action to content screens**

Use explicit text labels in both languages: `Añadir a favoritos` / `Quitar de favoritos`, `Add to favorites` / `Remove from favorites`. Do not rely on an icon alone.

- [ ] **Step 5: Build Favorites screen grouped by kind**

Use real headings for groups. Missing content references are silently removed from storage during resolution; do not show broken favorite rows.

- [ ] **Step 6: Run mobile tests**

Run: `cd mobile && npm test`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add mobile/src/core/favorites.mjs mobile/src/screens mobile/src/app.mjs mobile/test/favorites.test.mjs
git commit -m "feat: add global mobile favorites"
```

---

### Task 8: Integrate the Foundation, Add Platform Projects and Verify Accessibility Baseline

**Files:**
- Modify: `mobile/src/app.mjs`
- Modify: `mobile/src/styles.css`
- Create during Capacitor commands: `mobile/android/**`
- Create on macOS during Capacitor command: `mobile/ios/**`
- Create: `mobile/test/app-shell.test.mjs`
- Modify: `README.txt` with a clearly separated “Aplicaciones oficiales en desarrollo” section that does not replace PWA maintenance instructions.

**Interfaces:**
- Composition root maps each route name to exactly one screen renderer.
- Startup sequence: apply preferences -> render Home immediately -> begin background content load -> update data without moving focus.

- [ ] **Step 1: Write the failing integration regression test**

The test reads `mobile/src/app.mjs` and `mobile/src/index.html` and asserts:

```js
for (const route of ['home','actualidad','search','library','favorites','videos','book','podcast','contact','settings']) {
  assert.ok(source.includes(`'${route}'`));
}
assert.doesNotMatch(html, /autofocus/i);
assert.doesNotMatch(html, /aria-role|role="main"/i);
```

Also assert only one `<main` occurs in `index.html`.

- [ ] **Step 2: Run and verify failure before final wiring**

Run: `cd mobile && node --test test/app-shell.test.mjs`

Expected: FAIL until all route renderers are registered.

- [ ] **Step 3: Finish composition root**

`app.mjs` must own wiring only: create preferences/content/favorites/router stores, map routes to screen renderers, start Home, and update the content reference after background load. Move all screen-specific markup into screen modules.

- [ ] **Step 4: Add Android Capacitor platform**

Run inside `mobile/`:

```bash
npx cap add android
npx cap sync android
```

Expected: Android project exists and sync exits 0.

- [ ] **Step 5: Add iOS Capacitor platform on macOS**

Run inside `mobile/` on the Mac development environment:

```bash
npx cap add ios
npx cap sync ios
```

Expected: iOS project exists and sync exits 0.

Do not fake or hand-create the Xcode project on Windows/Linux; Capacitor must generate it on macOS.

- [ ] **Step 6: Run all automated tests**

Run from repository root:

```bash
npm test
cd mobile && npm test
```

Expected: all root and mobile tests PASS.

- [ ] **Step 7: Perform manual keyboard/screen-reader smoke test before calling the foundation complete**

On the browser/mobile shell, verify these exact flows:

1. Open app -> focus can reach the TifloAcosta heading; no search field steals focus.
2. Move through Home -> only compact top-level entries are encountered.
3. Enter Podcast -> platforms appear only inside Podcast -> Back returns to Home.
4. Enter Contact -> networks appear only inside Contact -> Back returns to Home.
5. Enter Settings -> controls appear only inside Settings -> Back returns to Home.
6. Search for a known resource -> result count is announced politely -> open a result -> Back restores result focus.
7. Add one resource and one video to Favorites -> both appear in the same Favorites area under separate headings.
8. Simulate failed content fetch after one successful load -> cached content remains usable and no focus jump occurs.
9. Switch Spanish/English -> interface labels change and preference survives restart.

Record any VoiceOver/TalkBack barrier as a release blocker for this foundation, not as optional polish.

- [ ] **Step 8: Update README development section**

Document only commands that now exist:

```text
cd mobile
npm install
npm test
npm run sync:android
npm run sync:ios   (macOS)
```

State clearly that the public PWA remains maintained separately while the official mobile apps are in development.

- [ ] **Step 9: Commit**

```bash
git add mobile README.txt
git commit -m "feat: complete official mobile foundation"
```

---

## Self-Review Against the Approved Spec

This foundation plan covers the parts of the design that must exist before the larger subsystems can be added safely: separate Capacitor app identity, accessible/silent navigation, exact Home hierarchy, remote mutable content with last-valid cache, bilingual settings, global search, global favorites, Podcast/Contact/Settings compaction and focus restoration.

The following approved areas are intentionally separated into later implementation plans because each is independently reviewable and testable software:

1. **Actualidad pipeline and editorial system:** feed discovery, source trust model, deduplication, categories, Apple/Android/Windows/JAWS/NVDA/gafas/tecnología, AppleVis/Accessible Android/BuscaApps ingestion, Tony-style editorial generation, bilingual adaptation, confidence filters and `Leer en TifloAcosta` articles.
2. **Native integrations:** OneSignal native notifications, Universal Links/App Links, native share sheet, native file saving, intelligent external-app opening and native Android Back handling.
3. **Store/release layer:** icons and signing, App Store/Play Console metadata, privacy declarations, TestFlight/closed Android testing, device accessibility matrix and production readiness.

No requirement from those later areas should be silently implemented inside this foundation plan; their stable extension points are `content.news`, router routes, content kinds and Capacitor project structure.
