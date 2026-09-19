# Android Downloads Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reconcile the existing Capacitor Android application with current `main`, add accessible native-mobile Downloads screens for link analysis and sound search, and produce a signed release AAB ready for Play Console validation.

**Architecture:** Preserve the existing `mobile/**` architecture and router, merge current `main` into a dedicated Android integration branch, then add mobile-specific pure clients and screens instead of embedding the web UI. Reuse the existing Cloudflare Worker contracts and native `TifloSave` / Capacitor Browser actions, with all new UI in ES/EN and with TalkBack-first focus/navigation behavior.

**Tech Stack:** Node.js 22, native ES modules, Node test runner, esbuild, Capacitor 8.5.2, Android/Gradle, Java 21, Cloudflare Worker endpoints, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-19-android-downloads-reconciliation-design.md`

## Global Constraints

- Preserve the existing Android application and its Capacitor architecture; do not replace screens with the public web app or a WebView substitute.
- Reconcile the mobile branch with the current `main` before adding Downloads.
- Work in a dedicated integration branch; do not resolve conflicts directly on `main`.
- Keep the mobile router, native back-button behavior, focus restoration, preferences, favorites, content store, and `TifloSave` behavior intact.
- Use `https://download.tifloacosta.com/analyze` for advanced URL analysis.
- Use `https://download.tifloacosta.com/sounds/search` for internal sound search when the provider is configured.
- Do not embed `FREESOUND_API_KEY` or any other provider secret in the Android bundle.
- Direct-file saving must continue through `nativeActions.saveFile()` / `TifloSave`.
- External providers must open through `nativeActions.openExternal()` rather than being scraped or proxied through the app.
- All new visible copy must exist in Spanish and English from the first implementation.
- No autoplay; starting one sound preview must stop the previous preview.
- Every interior screen must have an explicit `Volver` / `Back` control and remain compatible with the Android system Back button.
- Unknown metadata stays unknown; never convert missing size/duration into zero.
- Release signing must continue to use `TIFLOACOSTA_KEYSTORE_BASE64` and `TIFLOACOSTA_KEYSTORE_PASSWORD` without changing the existing keystore or password.

## Review Focus

- A user enters an `ftp:`, `javascript:`, blank, or malformed URL: the app must reject it locally without calling the Worker.
- The Worker returns HTML, malformed JSON, a slow response, 401-equivalent authentication state, or 403-equivalent automated blocking: the app must remain usable and expose the correct fallback rather than crashing or hanging.
- A result omits `size`, `type`, `duration`, preview URL, author, or license: the UI must omit or label the missing value without fabricating `0`.
- The user starts one preview and then another, navigates Back, or changes screen: only one preview may play and audio must not continue unexpectedly after leaving the screen.
- Android is offline or a remote request fails after a user action: TalkBack must receive a concise state/error message while focus remains in a predictable place and external-bank buttons remain available where applicable.

---

### Task 1: Reconcile the Android branch with current `main` and make mobile CI branch-safe

**Files:**
- Modify after merge as required: `README.txt`
- Modify: `.github/workflows/bootstrap-mobile-android.yml`
- Create: `mobile/test/workflow-branching.test.mjs`
- Verify unchanged behavior: `mobile/src/**`, `mobile/android/**`

**Interfaces:**
- Consumes: existing `feature/mobile-capacitor-foundation` at commit lineage containing `mobile/**`; current `main` containing Downloads Worker and current content/infrastructure.
- Produces: `feature/android-downloads-reconciliation` containing both histories, plus a validation workflow that builds the checked-out ref instead of hardcoding the legacy mobile branch.

- [ ] **Step 1: Create the integration branch from the current mobile branch**

```bash
git checkout feature/mobile-capacitor-foundation
git pull --ff-only
git checkout -b feature/android-downloads-reconciliation
```

Expected: the new branch starts with all current Android/Capacitor files intact.

- [ ] **Step 2: Merge current `main` before feature work**

```bash
git fetch origin main
git merge --no-ff origin/main
```

Conflict policy:

```text
mobile/**                    -> preserve mobile implementation unless main intentionally owns the same file
web / Worker / root tests    -> preserve current main
README.txt                   -> combine both sets of useful notes
workflows                    -> preserve both web/Worker workflows and mobile validation workflow
```

Expected: no unresolved conflict markers remain.

- [ ] **Step 3: Run the reconciled baseline before changing behavior**

```bash
npm test
cd mobile
npm install
npm test
npm run build
npx cap sync android
cd android
chmod +x gradlew
./gradlew --no-daemon assembleDebug bundleRelease
```

Expected: repository tests PASS, mobile tests PASS, bundle builds, Capacitor sync succeeds, and Gradle produces debug APK + release AAB validation build.

If a baseline test fails because of the merge, fix only the reconciliation regression before continuing; do not mix Downloads feature work into this step.

- [ ] **Step 4: Write a failing workflow regression test**

Create `mobile/test/workflow-branching.test.mjs`:

```js
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const workflow = await readFile(new URL('../../.github/workflows/bootstrap-mobile-android.yml', import.meta.url), 'utf8');

test('mobile workflow does not hardcode the retired foundation branch', () => {
  assert.doesNotMatch(workflow, /ref:\s*feature\/mobile-capacitor-foundation/);
  assert.doesNotMatch(workflow, /git push origin HEAD:feature\/mobile-capacitor-foundation/);
});

test('mobile workflow validates the ref that triggered the run without mutating the repository', () => {
  assert.match(workflow, /actions\/checkout@v5/);
  assert.doesNotMatch(workflow, /git commit -m/);
  assert.doesNotMatch(workflow, /git push origin/);
});
```

- [ ] **Step 5: Run the workflow test and verify red**

```bash
cd mobile
node --test test/workflow-branching.test.mjs
```

Expected: FAIL because the current workflow hardcodes `feature/mobile-capacitor-foundation` and pushes generated files back to it.

- [ ] **Step 6: Make the workflow validation-only and branch-safe**

Update `.github/workflows/bootstrap-mobile-android.yml` so the relevant parts become equivalent to:

```yaml
on:
  push:
    branches:
      - main
      - feature/android-downloads-reconciliation
    paths:
      - 'mobile/**'
      - '.github/workflows/bootstrap-mobile-android.yml'
  workflow_dispatch:

permissions:
  contents: read

jobs:
  bootstrap:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout current ref
        uses: actions/checkout@v5
        with:
          fetch-depth: 0
```

Keep the existing Node 22, Java 21, root tests, mobile tests, build, Capacitor sync, signing preparation, Gradle build, and artifact upload steps. Remove the final step that commits/pushes generated Android files.

- [ ] **Step 7: Run reconciled tests again**

```bash
npm test
cd mobile
npm test
npm run build
```

Expected: all PASS.

- [ ] **Step 8: Commit the reconciled baseline**

```bash
git add .github/workflows/bootstrap-mobile-android.yml mobile/test/workflow-branching.test.mjs README.txt
git commit -m "chore: reconcile Android branch with main"
```

---

### Task 2: Add Downloads to mobile navigation and bilingual screen structure

**Files:**
- Modify: `mobile/src/screens/home.mjs`
- Modify: `mobile/src/app.mjs`
- Modify: `mobile/src/core/i18n.mjs`
- Create: `mobile/src/screens/downloads.mjs`
- Create: `mobile/test/downloads-navigation.test.mjs`
- Modify: `mobile/test/home.test.mjs`

**Interfaces:**
- Consumes: `router.navigate(route, { originId })`, `router.back()`, `addScreenHeader(root, { router, title, backLabel })`.
- Produces: routes `downloads`, `downloads-link`, and `downloads-sounds`; `renderDownloads(context)`; stable home control id `home-downloads`.

- [ ] **Step 1: Write failing navigation/i18n tests**

Create `mobile/test/downloads-navigation.test.mjs`:

```js
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { text } from '../src/core/i18n.mjs';
import { HOME_ITEMS } from '../src/screens/home.mjs';

const read = file => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

test('Downloads is a stable home entry beside Library', () => {
  const libraryIndex = HOME_ITEMS.indexOf('library');
  assert.equal(HOME_ITEMS[libraryIndex + 1], 'downloads');
});

test('Downloads route labels exist in Spanish and English', () => {
  for (const lang of ['es', 'en']) {
    for (const key of ['home.downloads', 'screen.downloads', 'downloads.link', 'downloads.sounds']) {
      assert.notEqual(text(lang, key), key);
    }
  }
});

test('app registers Downloads hub and both child routes', async () => {
  const source = await read('src/app.mjs');
  assert.match(source, /case 'downloads':/);
  assert.match(source, /case 'downloads-link':/);
  assert.match(source, /case 'downloads-sounds':/);
});

test('Downloads hub uses shared accessible header and explicit child origin ids', async () => {
  const source = await read('src/screens/downloads.mjs');
  assert.match(source, /addScreenHeader\(/);
  assert.match(source, /downloads-link/);
  assert.match(source, /downloads-sounds/);
  assert.doesNotMatch(source, /autofocus/i);
});
```

Update `mobile/test/home.test.mjs` expected order to:

```js
[
  'actualidad', 'search', 'library', 'downloads', 'favorites',
  'videos', 'book', 'podcast', 'contact', 'settings'
]
```

- [ ] **Step 2: Run tests and verify red**

```bash
cd mobile
node --test test/home.test.mjs test/downloads-navigation.test.mjs
```

Expected: FAIL because `downloads` and routes do not yet exist.

- [ ] **Step 3: Add bilingual dictionary entries**

In `mobile/src/core/i18n.mjs`, add at minimum:

```js
// es
home: { /* existing */, downloads: 'Descargas' },
screen: { /* existing */, downloads: 'Descargas' },
downloads: {
  intro: 'Elige qué quieres hacer.',
  link: 'Descargar desde un enlace',
  sounds: 'Buscar sonidos'
}

// en
home: { /* existing */, downloads: 'Downloads' },
screen: { /* existing */, downloads: 'Downloads' },
downloads: {
  intro: 'Choose what you want to do.',
  link: 'Download from a link',
  sounds: 'Search sounds'
}
```

- [ ] **Step 4: Add home entry and Downloads hub**

Update `HOME_ITEMS` in `mobile/src/screens/home.mjs` with `downloads` immediately after `library`.

Create `mobile/src/screens/downloads.mjs` with this shape:

```js
import { addParagraph, addScreenHeader, clearScreen } from './shared.mjs';

export function renderDownloads({ root, router, t }) {
  clearScreen(root);
  addScreenHeader(root, {
    router,
    title: t('screen.downloads'),
    backLabel: t('nav.back')
  });
  addParagraph(root, t('downloads.intro'));

  for (const [route, id, labelKey] of [
    ['downloads-link', 'downloads-open-link', 'downloads.link'],
    ['downloads-sounds', 'downloads-open-sounds', 'downloads.sounds']
  ]) {
    const button = document.createElement('button');
    button.type = 'button';
    button.id = id;
    button.textContent = t(labelKey);
    button.addEventListener('click', () => router.navigate(route, { originId: id }));
    root.append(button);
  }
}
```

- [ ] **Step 5: Register hub and temporary child routes**

In `mobile/src/app.mjs` import `renderDownloads` and register:

```js
case 'downloads': renderDownloads(context); break;
case 'downloads-link': renderDownloadLink(context); break;
case 'downloads-sounds': renderSoundSearch(context); break;
```

Create minimal child screen files if needed for compilation, each using `addScreenHeader` and no feature logic yet. These placeholders exist only inside this task and are replaced in Tasks 4 and 6.

- [ ] **Step 6: Run navigation tests green**

```bash
cd mobile
npm test
npm run build
```

Expected: all mobile tests PASS and bundle builds.

- [ ] **Step 7: Commit**

```bash
git add mobile/src mobile/test
git commit -m "feat: add Downloads navigation to Android app"
```

---

### Task 3: Port pure link-resolution rules and analyzer client to mobile

**Files:**
- Create: `mobile/src/core/downloads.mjs`
- Create: `mobile/test/downloads-core.test.mjs`

**Interfaces:**
- Produces: `normalizeUrl(value) -> URL|null`, `classifyUrl(value) -> { provider, url }`, `resolveLocal(value) -> { kind, provider, url, items }`, `formatBytes(bytes) -> string`, `createAnalyzerClient({ fetchFn, endpoint, timeoutMs }) -> { analyze(url) }`.
- Analyzer success result: payload object from Worker; network/client failures throw `Error` carrying `code` such as `timeout`, `bad_response`, or `service_unavailable`.

- [ ] **Step 1: Write failing pure-core tests**

Create `mobile/test/downloads-core.test.mjs` covering:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeUrl, classifyUrl, resolveLocal, formatBytes, createAnalyzerClient
} from '../src/core/downloads.mjs';

test('normalizeUrl accepts only http and https', () => {
  assert.equal(normalizeUrl('ftp://example.com/a.zip'), null);
  assert.equal(normalizeUrl('javascript:alert(1)'), null);
  assert.equal(normalizeUrl('not a url'), null);
  assert.equal(normalizeUrl('https://example.com/a.zip').href, 'https://example.com/a.zip');
});

test('Google Drive file links resolve locally', () => {
  const result = resolveLocal('https://drive.google.com/file/d/ABC123/view');
  assert.equal(result.kind, 'result');
  assert.match(result.items[0].url, /drive\.google\.com\/uc\?export=download&id=ABC123/);
});

test('Dropbox links force dl=1', () => {
  const result = resolveLocal('https://www.dropbox.com/s/demo/file.zip?dl=0');
  assert.equal(new URL(result.items[0].url).searchParams.get('dl'), '1');
});

test('direct file keeps unknown size null', () => {
  const result = resolveLocal('https://example.com/file.pdf');
  assert.equal(result.items[0].size, null);
  assert.equal(result.items[0].type, 'pdf');
});

test('formatBytes never turns missing values into zero', () => {
  assert.equal(formatBytes(null), '');
  assert.equal(formatBytes(undefined), '');
  assert.equal(formatBytes(-1), '');
  assert.equal(formatBytes(1024), '1.00 KB');
});
```

- [ ] **Step 2: Add failing analyzer-client tests**

Add cases equivalent to:

```js
test('analyzer sends only the URL as JSON', async () => {
  let request;
  const client = createAnalyzerClient({
    endpoint: 'https://download.tifloacosta.com/analyze',
    fetchFn: async (url, options) => {
      request = { url, options };
      return { ok: true, json: async () => ({ status: 'ok', items: [] }) };
    }
  });
  await client.analyze('https://example.com/page');
  assert.equal(request.url, 'https://download.tifloacosta.com/analyze');
  assert.deepEqual(JSON.parse(request.options.body), { url: 'https://example.com/page' });
  assert.equal('credentials' in JSON.parse(request.options.body), false);
});

test('malformed JSON becomes bad_response without crashing caller', async () => {
  const client = createAnalyzerClient({
    endpoint: 'https://download.tifloacosta.com/analyze',
    fetchFn: async () => ({ ok: true, json: async () => { throw new SyntaxError('bad'); } })
  });
  await assert.rejects(() => client.analyze('https://example.com'), error => error.code === 'bad_response');
});
```

Also pin timeout and non-OK response without a Worker `code` to `timeout` / `service_unavailable`.

- [ ] **Step 3: Run and verify red**

```bash
cd mobile
node --test test/downloads-core.test.mjs
```

Expected: FAIL because `src/core/downloads.mjs` does not exist.

- [ ] **Step 4: Implement ESM core using the web rules as behavioral reference**

Port the pure classification/resolution rules from `downloads-core.js` into ESM. Keep provider names stable:

```js
'google-drive', 'dropbox', 'onedrive', 'icloud-drive', 'box',
'mega', 'wetransfer', 'mediafire', 'pcloud', 'direct', 'web'
```

Implement `createAnalyzerClient` with POST JSON, `AbortController`, default `timeoutMs = 10000`, and error-code normalization.

For `formatBytes`, explicitly guard null before numeric conversion:

```js
export function formatBytes(bytes) {
  if (bytes === null || bytes === undefined || bytes === '') return '';
  const value = Number(bytes);
  if (!Number.isFinite(value) || value < 0) return '';
  // same unit formatting behavior as web
}
```

- [ ] **Step 5: Run core tests green**

```bash
cd mobile
node --test test/downloads-core.test.mjs
npm test
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add mobile/src/core/downloads.mjs mobile/test/downloads-core.test.mjs
git commit -m "feat: add mobile download analysis core"
```

---

### Task 4: Implement the accessible Android Download-from-link screen and native save flow

**Files:**
- Replace/modify: `mobile/src/screens/download-link.mjs`
- Modify only if proven necessary: `mobile/src/core/native-actions.mjs`
- Create: `mobile/test/download-link-screen.test.mjs`
- Extend: `mobile/test/native-actions.test.mjs`
- Extend dictionary: `mobile/src/core/i18n.mjs`

**Interfaces:**
- Consumes: Task 3 core; `nativeActions.saveFile({ url, filename, mimeType })`; `nativeActions.openExternal(url)`; `addScreenHeader`.
- Produces: `renderDownloadLink(context)` with URL input, Analyze action, accessible status, result list, Save action, external fallback, and retry.

- [ ] **Step 1: Add failing structural/accessibility tests**

`mobile/test/download-link-screen.test.mjs` must assert source-level invariants:

```js
assert.match(source, /addScreenHeader\(/);
assert.match(source, /type\s*=\s*['"]url['"]/);
assert.match(source, /aria-live/);
assert.match(source, /nativeActions\.saveFile/);
assert.match(source, /nativeActions\.openExternal/);
assert.doesNotMatch(source, /autoplay/i);
assert.doesNotMatch(source, /window\.location\.href/);
```

Add dictionary-key tests for the ES/EN keys used for invalid URL, analyzing, files found, save, unknown size/type, auth required, blocked analysis, open external, retry, timeout, unavailable, and save failure.

- [ ] **Step 2: Add failing behavior tests for result mapping and fallback decisions**

Export small pure helpers from the screen module only where useful for testing, for example:

```js
export function resultPresentation(item) {
  return {
    name: String(item?.name || '').trim() || 'Archivo',
    type: String(item?.type || '').trim() || null,
    size: item?.size ?? null,
    url: String(item?.url || '').trim(),
    source: String(item?.source || '').trim() || null
  };
}
```

Test that `size: null` stays null and an absent URL cannot produce a Save button.

- [ ] **Step 3: Run targeted tests red**

```bash
cd mobile
node --test test/download-link-screen.test.mjs test/native-actions.test.mjs
```

Expected: FAIL until the real screen is implemented.

- [ ] **Step 4: Implement screen state without a second router or storage system**

The screen should:

```text
render header -> input/form -> polite live status -> results region -> optional external fallback
```

On submit:

```js
const normalized = normalizeUrl(input.value);
if (!normalized) {
  setStatus(t('downloadsLink.invalid'));
  return;
}
const local = resolveLocal(normalized.href);
if (local.kind === 'result') {
  renderResults(local.items);
  return;
}
const payload = await analyzer.analyze(normalized.href);
```

Interpret Worker codes exactly:

```text
authentication_required -> external fallback explaining sign-in is required
access_denied           -> external fallback explaining automated analysis was blocked
no_files                -> no-files state
invalid_url             -> invalid state
timeout                 -> timeout state
unreachable             -> unreachable state
unsupported             -> unsupported state
service_unavailable     -> unavailable state
```

- [ ] **Step 5: Save direct result through the native plugin**

For each valid result URL, Save must call:

```js
await nativeActions.saveFile({
  url: item.url,
  filename: item.name || 'archivo',
  mimeType: mimeFromType(item.type)
});
```

A false result must update the polite status region; it must not throw out of the click handler.

- [ ] **Step 6: Keep external fallback available after remote failures where useful**

For authentication/blocking and recognized provider fallbacks, call:

```js
await nativeActions.openExternal(normalized.href);
```

The screen retains a Retry button that re-runs the same URL through the current screen state.

- [ ] **Step 7: Run full mobile suite and build**

```bash
cd mobile
npm test
npm run build
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add mobile/src mobile/test
git commit -m "feat: add Android download-from-link screen"
```

---

### Task 5: Add the pure mobile sound-search client and normalized result contract

**Files:**
- Create: `mobile/src/core/sound-search.mjs`
- Create: `mobile/test/sound-search-core.test.mjs`

**Interfaces:**
- Produces: `SOUND_CATEGORIES`, `normalizeSound(item)`, `createSoundSearchClient({ fetchFn, endpoint, timeoutMs })` with `search({ query, category })`.
- Normalized sound fields: `{ id, name, author, provider, duration, format, size, license, previewUrl, originalUrl }`, with missing optional values represented as `null` rather than zero/empty inventions.

- [ ] **Step 1: Write failing contract tests**

Cover:

```js
assert.deepEqual(SOUND_CATEGORIES.map(item => item.id), [
  'ringtones', 'notifications', 'alarms', 'phone', 'technology',
  'nature', 'animals', 'ambience', 'fun', 'games'
]);
```

And normalization:

```js
const normalized = normalizeSound({ name: 'Bell', duration: null, size: undefined });
assert.equal(normalized.name, 'Bell');
assert.equal(normalized.duration, null);
assert.equal(normalized.size, null);
```

- [ ] **Step 2: Write failing request/error tests**

The client must send only supported search parameters:

```js
await client.search({ query: 'campana', category: 'notifications' });
```

Expected URL semantics:

```text
https://download.tifloacosta.com/sounds/search?q=campana&category=notifications
```

Pin these cases:

```text
provider not configured -> return a typed unavailable state, not an uncaught exception
valid results            -> normalized list
empty results            -> []
malformed JSON            -> bad_response
network failure           -> service_unavailable
timeout                   -> timeout
```

- [ ] **Step 3: Run red**

```bash
cd mobile
node --test test/sound-search-core.test.mjs
```

- [ ] **Step 4: Implement client with AbortController and no secrets**

Use the Worker endpoint only. No Freesound hostname or key belongs in this module.

`normalizeSound` must use null guards before numeric conversion:

```js
const duration = item?.duration === null || item?.duration === undefined
  ? null
  : Number(item.duration);
```

Apply the same pattern to `size`.

- [ ] **Step 5: Run green**

```bash
cd mobile
node --test test/sound-search-core.test.mjs
npm test
```

- [ ] **Step 6: Commit**

```bash
git add mobile/src/core/sound-search.mjs mobile/test/sound-search-core.test.mjs
git commit -m "feat: add mobile sound search core"
```

---

### Task 6: Implement accessible Android sound search, previews, and external banks

**Files:**
- Replace/modify: `mobile/src/screens/sound-search.mjs`
- Extend: `mobile/src/core/i18n.mjs`
- Create: `mobile/test/sound-search-screen.test.mjs`

**Interfaces:**
- Consumes: `SOUND_CATEGORIES`, sound client, `nativeActions.openExternal(url)`, mobile router/header helpers.
- Produces: `renderSoundSearch(context)` with query + category search, polite status, result list, one-at-a-time preview lifecycle, Mixkit/Pixabay external actions.

- [ ] **Step 1: Write failing structural tests**

Assert:

```js
assert.match(source, /addScreenHeader\(/);
assert.match(source, /type\s*=\s*['"]search['"]/);
assert.match(source, /<audio|createElement\(['"]audio['"]\)/);
assert.match(source, /aria-live/);
assert.match(source, /nativeActions\.openExternal/);
assert.doesNotMatch(source, /\.autoplay\s*=\s*true/);
```

Also verify dictionary coverage for heading, query label, category label, All categories, Search, searching, no results, unavailable internal search, preview, author, duration, format, size, license, source, open original, Mixkit, and Pixabay in ES/EN.

- [ ] **Step 2: Add a focused preview lifecycle test**

Extract a small controller:

```js
export function createPreviewController() {
  let active = null;
  return {
    activate(audio) {
      if (active && active !== audio) active.pause();
      active = audio;
    },
    stop() {
      if (active) active.pause();
      active = null;
    }
  };
}
```

Test:

```js
const paused = [];
const a = { pause: () => paused.push('a') };
const b = { pause: () => paused.push('b') };
const previews = createPreviewController();
previews.activate(a);
previews.activate(b);
assert.deepEqual(paused, ['a']);
previews.stop();
assert.deepEqual(paused, ['a', 'b']);
```

- [ ] **Step 3: Run red**

```bash
cd mobile
node --test test/sound-search-screen.test.mjs
```

- [ ] **Step 4: Implement search form and categories**

Permit:

```text
query only
category only
query + category
```

Reject only the state where both are empty, with a polite status message; do not send a pointless Worker request.

- [ ] **Step 5: Render normalized results without invented metadata**

Each result article has a heading with the sound name. Append metadata only when non-null/non-empty. Add an `<audio controls preload="none">` only when `previewUrl` exists; never set autoplay.

When `play` fires:

```js
previews.activate(audio);
```

Before rerendering results or leaving the screen, call:

```js
previews.stop();
```

- [ ] **Step 6: Keep external banks usable when internal provider is unavailable**

Always render external-bank actions after the internal section:

```js
const banks = [
  { name: 'Mixkit', url: 'https://mixkit.co/free-sound-effects/' },
  { name: 'Pixabay', url: 'https://pixabay.com/sound-effects/' }
];
```

Use `nativeActions.openExternal(bank.url)`; do not scrape these pages.

- [ ] **Step 7: Run full tests/build**

```bash
cd mobile
npm test
npm run build
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add mobile/src mobile/test
git commit -m "feat: add Android sound search screen"
```

---

### Task 7: Pin navigation, TalkBack structure, remote-failure behavior, and Android versioning

**Files:**
- Extend: `mobile/test/navigation.test.mjs`
- Extend: `mobile/test/home.test.mjs`
- Create: `mobile/test/downloads-accessibility.test.mjs`
- Modify: `mobile/android/app/build.gradle`
- Extend: `mobile/test/android-bootstrap.test.mjs`

**Interfaces:**
- Consumes: all Downloads routes/screens from Tasks 2–6.
- Produces: regression coverage for Back/focus semantics and release version `versionCode 3`, `versionName "1.0.2"`.

- [ ] **Step 1: Add navigation stack tests for Downloads children**

Use the existing router fake pattern to verify:

```text
home -> downloads -> downloads-link -> back returns downloads and restores downloads-open-link
downloads -> downloads-sounds -> back returns downloads and restores downloads-open-sounds
system back uses the same router.back() contract
```

- [ ] **Step 2: Add accessibility source invariants**

`mobile/test/downloads-accessibility.test.mjs` checks every new screen for:

```text
addScreenHeader()
no autofocus
a single screen-heading path via shared header
form labels bound to controls
polite live region on async screens
no autoplay
no direct window navigation for external actions
```

Also assert the two child screens include no hardcoded provider secret names such as `FREESOUND_API_KEY`.

- [ ] **Step 3: Add release-version test red**

Extend `mobile/test/android-bootstrap.test.mjs` to read `android/app/build.gradle` and require:

```js
assert.match(gradle, /versionCode\s+3\b/);
assert.match(gradle, /versionName\s+"1\.0\.2"/);
```

- [ ] **Step 4: Run tests red**

```bash
cd mobile
npm test
```

Expected: version test FAIL until Gradle is bumped; any missing accessibility invariant also fails here.

- [ ] **Step 5: Bump Android version**

In `mobile/android/app/build.gradle`:

```gradle
versionCode 3
versionName "1.0.2"
```

Do not change `applicationId`, keystore settings, alias detection, minSdk, targetSdk, or package name.

- [ ] **Step 6: Run root + mobile regression suites**

```bash
npm test
cd mobile
npm test
npm run build
npx cap sync android
```

Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add mobile/test mobile/android/app/build.gradle
git commit -m "test: lock Android Downloads accessibility and release version"
```

---

### Task 8: Build signed Android artifacts, review the branch, and prepare integration PR

**Files:**
- Verify: `.github/workflows/bootstrap-mobile-android.yml`
- Verify: `mobile/android/app/build.gradle`
- No new production code unless verification exposes a real defect.

**Interfaces:**
- Consumes: GitHub secrets `TIFLOACOSTA_KEYSTORE_BASE64`, `TIFLOACOSTA_KEYSTORE_PASSWORD` and all completed tasks.
- Produces: successful CI run, debug APK artifact, signed release AAB artifact, code-review-clean PR targeting `main`.

- [ ] **Step 1: Run the complete local/CI-equivalent verification**

```bash
npm test
cd mobile
npm test
npm run build
npx cap sync android
cd android
chmod +x gradlew
./gradlew --no-daemon clean assembleDebug bundleRelease
```

Expected: all commands exit 0.

- [ ] **Step 2: Verify no secret leaked into the built source**

```bash
grep -R "FREESOUND_API_KEY\|TIFLOACOSTA_KEYSTORE_PASSWORD\|TIFLOACOSTA_KEYSTORE_BASE64" mobile/src mobile/dist || true
```

Expected: no secret values and no client-side Freesound API credential reference. Build/signing workflow names may exist only in workflow/configuration contexts, not in bundled app JS.

- [ ] **Step 3: Push integration branch and require GitHub Actions green**

```bash
git push -u origin feature/android-downloads-reconciliation
```

Expected mobile workflow stages:

```text
root regression tests          success
mobile tests                   success
mobile bundle                  success
Capacitor sync                 success
signing preparation            success
assembleDebug                  success
bundleRelease                  success
artifact upload                success
```

- [ ] **Step 4: Verify the release AAB is actually signed**

In CI, keep the existing keystore decode + unique private-key alias detection. The run must fail if only one signing secret exists or if the PKCS12 does not contain exactly one `PrivateKeyEntry`.

Expected artifact path:

```text
mobile/android/app/build/outputs/bundle/release/app-release.aab
```

- [ ] **Step 5: Perform final code review against the spec**

Review especially:

```text
no WebView substitution
no second router
no second save system
no provider secrets in mobile bundle
no autoplay
Back/focus restoration preserved
401/auth vs 403/block distinction preserved
Mixkit/Pixabay available without Freesound
unknown metadata not fabricated
old mobile screens still registered
```

If review finds a defect, add a reproducing test first, then fix and rerun Task 8 Step 1.

- [ ] **Step 6: Open PR to `main`**

Suggested title:

```text
Poner Descargas operativas en Android
```

PR body must state:

```text
- reconciles the long-lived Android branch with current main
- adds mobile-native Downloads hub, link analyzer, native save, and sound search
- keeps Freesound optional while Mixkit/Pixabay remain available
- includes ES/EN accessibility and Back/focus tests
- produces signed versionCode 3 / versionName 1.0.2 AAB
```

- [ ] **Step 7: Do not merge until CI and review are green**

Before merge, confirm the PR is mergeable and the latest commit is exactly the commit that passed CI. After merge, run the mobile workflow from `main` once more and confirm a signed release AAB is produced from the merged commit.

- [ ] **Step 8: Final integration commit/merge record**

No additional feature commit is expected here. The merge itself is the final repository integration point; Play Console upload is deliberately a separate follow-up step.
