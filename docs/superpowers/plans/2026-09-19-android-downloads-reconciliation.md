# Android Downloads Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reconcile the existing Capacitor Android application with current `main`, add accessible mobile-native Downloads screens for link analysis and sound search, and produce a signed release AAB ready for Play Console validation.

**Architecture:** Preserve the existing `mobile/**` router, screens, preferences, favorites, content store and native actions. Reconcile the long-lived Android branch with current `main`, extend the Worker so the Capacitor local origin is accepted, then add mobile-specific pure clients and screens that reuse Worker contracts plus `TifloSave` / Capacitor Browser instead of embedding the web UI.

**Tech Stack:** Node.js 22, native ES modules, Node test runner, esbuild, Capacitor 8.5.2, Android/Gradle, Java 21, Cloudflare Worker endpoints, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-19-android-downloads-reconciliation-design.md`

## Global Constraints

- Preserve the existing Android application and its Capacitor architecture; do not replace screens with the public web app or a WebView substitute.
- Reconcile the mobile branch with the current `main` before adding Downloads.
- Work in a dedicated integration branch; do not resolve conflicts directly on `main`.
- Keep the mobile router, native back-button behavior, focus restoration, preferences, favorites, content store and `TifloSave` behavior intact.
- Use `https://download.tifloacosta.com/analyze` for advanced URL analysis.
- Use `https://download.tifloacosta.com/sounds/search` for internal sound search.
- Do not embed `FREESOUND_API_KEY` or any provider secret in the Android bundle.
- Direct-file saving must continue through `nativeActions.saveFile()` / `TifloSave`.
- External providers must open through `nativeActions.openExternal()` rather than being scraped or proxied through the app.
- All new visible copy must exist in Spanish and English from the first implementation.
- No autoplay; starting one sound preview must stop the previous preview.
- Leaving the sound-search screen must stop any active preview.
- Every interior screen must have an explicit `Volver` / `Back` control and remain compatible with the Android system Back button.
- Unknown metadata stays unknown; never convert missing size/duration into zero.
- Release signing must continue to use `TIFLOACOSTA_KEYSTORE_BASE64` and `TIFLOACOSTA_KEYSTORE_PASSWORD` without changing the existing keystore or password.

## Review Focus

- Blank, malformed, `ftp:` or `javascript:` URLs must be rejected locally without calling the Worker.
- Malformed JSON, slow Worker responses, authentication-required responses and automated-block responses must produce distinct usable states instead of crashes.
- Missing `size`, `type`, `duration`, preview URL, author or license must remain missing/unknown rather than becoming `0` or fabricated text.
- Starting a second preview, navigating Back, or switching screens must stop the previous audio.
- Offline/remote failure must leave TalkBack with a concise status and keep Mixkit/Pixabay available when internal sound search is unavailable.

---

### Task 1: Reconcile Android with current `main` and make mobile CI branch-safe

**Files:**
- Modify as merge requires: `README.txt`
- Modify: `.github/workflows/bootstrap-mobile-android.yml`
- Create: `mobile/test/workflow-branching.test.mjs`

**Interfaces:**
- Consumes: `feature/mobile-capacitor-foundation` and current `main`.
- Produces: `feature/android-downloads-reconciliation` containing both histories plus validation-only mobile CI.

- [ ] **Step 1: Create the integration branch and merge `main`**

```bash
git checkout feature/mobile-capacitor-foundation
git pull --ff-only
git checkout -b feature/android-downloads-reconciliation
git fetch origin main
git merge --no-ff origin/main
```

Conflict policy:

```text
mobile/**                 keep the existing mobile architecture
web / Worker / root tests keep current main
README.txt                combine both useful sections
workflows                 retain web/Worker workflows and mobile validation
```

Expected: no unresolved conflict markers.

- [ ] **Step 2: Verify the reconciled baseline before feature work**

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

Expected: root tests PASS, mobile tests PASS, bundle builds, Capacitor sync succeeds, APK/AAB validation builds succeed.

- [ ] **Step 3: Write the failing CI regression test**

Create `mobile/test/workflow-branching.test.mjs`:

```js
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const workflow = await readFile(new URL('../../.github/workflows/bootstrap-mobile-android.yml', import.meta.url), 'utf8');

test('mobile workflow is not tied to the old foundation branch', () => {
  assert.doesNotMatch(workflow, /ref:\s*feature\/mobile-capacitor-foundation/);
  assert.doesNotMatch(workflow, /HEAD:feature\/mobile-capacitor-foundation/);
});

test('mobile workflow validates without committing back to the repository', () => {
  assert.match(workflow, /actions\/checkout@v5/);
  assert.doesNotMatch(workflow, /git commit -m/);
  assert.doesNotMatch(workflow, /git push origin/);
});
```

- [ ] **Step 4: Run red**

```bash
cd mobile
node --test test/workflow-branching.test.mjs
```

Expected: FAIL against the legacy workflow.

- [ ] **Step 5: Make CI branch-safe and validation-only**

Update `.github/workflows/bootstrap-mobile-android.yml` so it triggers for `main` and `feature/android-downloads-reconciliation`, checks out the triggering ref without a hardcoded `ref:`, keeps Node 22 / Java 21 / tests / build / `cap sync` / signing / Gradle / artifact upload, changes permissions to `contents: read`, and removes the final repository commit/push step.

Required YAML shape:

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

steps:
  - name: Checkout current ref
    uses: actions/checkout@v5
    with:
      fetch-depth: 0
```

- [ ] **Step 6: Run green and commit**

```bash
npm test
cd mobile
npm test
npm run build
cd ..
git add .github/workflows/bootstrap-mobile-android.yml mobile/test/workflow-branching.test.mjs README.txt
git commit -m "chore: reconcile Android branch with main"
```

---

### Task 2: Allow the Capacitor Android origin through the Downloads Worker

**Files:**
- Modify: `download-worker/src/index.js`
- Modify: `download-worker/test/index-source.test.mjs`

**Interfaces:**
- Consumes: Capacitor config with `androidScheme: "https"` and default localhost host.
- Produces: Worker CORS support for `https://localhost` while preserving `https://tifloacosta.com` and `https://tifloacosta.github.io`.

- [ ] **Step 1: Write a failing Worker-origin test**

Add a runtime test equivalent to:

```js
import worker from '../src/index.js';

test('Capacitor HTTPS localhost origin is allowed', async () => {
  const request = new Request('https://download.tifloacosta.com/unknown', {
    method: 'OPTIONS',
    headers: { Origin: 'https://localhost' }
  });
  const response = await worker.fetch(request, {});
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('access-control-allow-origin'), 'https://localhost');
});
```

Keep an existing/non-allowed origin test proving `https://evil.example` does not receive an allow-origin header.

- [ ] **Step 2: Run red**

```bash
cd download-worker
npm test
```

Expected: FAIL because `https://localhost` is not in `ALLOWED_ORIGINS`.

- [ ] **Step 3: Add the Android origin only**

Change:

```js
const ALLOWED_ORIGINS = new Set([
  'https://tifloacosta.com',
  'https://tifloacosta.github.io',
  'https://localhost'
]);
```

Do not add wildcard CORS.

- [ ] **Step 4: Run Worker + root tests and commit**

```bash
cd download-worker
npm test
cd ..
npm test
git add download-worker/src/index.js download-worker/test/index-source.test.mjs
git commit -m "feat: allow Android app origin in downloads Worker"
```

---

### Task 3: Add Downloads to mobile navigation and bilingual screen structure

**Files:**
- Modify: `mobile/src/screens/home.mjs`
- Modify: `mobile/src/app.mjs`
- Modify: `mobile/src/core/i18n.mjs`
- Create: `mobile/src/screens/downloads.mjs`
- Create: `mobile/src/screens/download-link.mjs`
- Create: `mobile/src/screens/sound-search.mjs`
- Create: `mobile/test/downloads-navigation.test.mjs`
- Modify: `mobile/test/home.test.mjs`

**Interfaces:**
- Produces routes `downloads`, `downloads-link`, `downloads-sounds` and stable child origin ids `downloads-open-link`, `downloads-open-sounds`.

- [ ] **Step 1: Write failing navigation/i18n tests**

Create `mobile/test/downloads-navigation.test.mjs` with:

```js
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { text } from '../src/core/i18n.mjs';
import { HOME_ITEMS } from '../src/screens/home.mjs';

const read = file => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

test('Downloads follows Library on the mobile home screen', () => {
  const index = HOME_ITEMS.indexOf('library');
  assert.equal(HOME_ITEMS[index + 1], 'downloads');
});

test('Downloads core labels exist in Spanish and English', () => {
  for (const lang of ['es', 'en']) {
    for (const key of ['home.downloads', 'screen.downloads', 'downloads.link', 'downloads.sounds']) {
      assert.notEqual(text(lang, key), key);
    }
  }
});

test('app registers all Downloads routes', async () => {
  const source = await read('src/app.mjs');
  assert.match(source, /case 'downloads':/);
  assert.match(source, /case 'downloads-link':/);
  assert.match(source, /case 'downloads-sounds':/);
});
```

Update `mobile/test/home.test.mjs` expected order to:

```js
['actualidad','search','library','downloads','favorites','videos','book','podcast','contact','settings']
```

- [ ] **Step 2: Run red**

```bash
cd mobile
node --test test/home.test.mjs test/downloads-navigation.test.mjs
```

- [ ] **Step 3: Add bilingual core labels and home item**

Add `home.downloads`, `screen.downloads`, and:

```js
// es
downloads: { intro:'Elige qué quieres hacer.', link:'Descargar desde un enlace', sounds:'Buscar sonidos' }
// en
downloads: { intro:'Choose what you want to do.', link:'Download from a link', sounds:'Search sounds' }
```

Insert `downloads` after `library` in `HOME_ITEMS`.

- [ ] **Step 4: Implement the Downloads hub**

Create `mobile/src/screens/downloads.mjs`:

```js
import { addParagraph, addScreenHeader, clearScreen } from './shared.mjs';

export function renderDownloads({ root, router, t }) {
  clearScreen(root);
  addScreenHeader(root, { router, title: t('screen.downloads'), backLabel: t('nav.back') });
  addParagraph(root, t('downloads.intro'));
  for (const [route, id, label] of [
    ['downloads-link', 'downloads-open-link', t('downloads.link')],
    ['downloads-sounds', 'downloads-open-sounds', t('downloads.sounds')]
  ]) {
    const button = document.createElement('button');
    button.type = 'button';
    button.id = id;
    button.textContent = label;
    button.addEventListener('click', () => router.navigate(route, { originId: id }));
    root.append(button);
  }
}
```

- [ ] **Step 5: Create exact compile-safe child screens and register routes**

Create `mobile/src/screens/download-link.mjs`:

```js
import { addScreenHeader, clearScreen } from './shared.mjs';
export function renderDownloadLink({ root, router, t }) {
  clearScreen(root);
  addScreenHeader(root, { router, title: t('downloads.link'), backLabel: t('nav.back') });
}
```

Create `mobile/src/screens/sound-search.mjs`:

```js
import { addScreenHeader, clearScreen } from './shared.mjs';
export function renderSoundSearch({ root, router, t }) {
  clearScreen(root);
  addScreenHeader(root, { router, title: t('downloads.sounds'), backLabel: t('nav.back') });
}
```

Import all three screen renderers in `mobile/src/app.mjs` and add the three switch cases.

- [ ] **Step 6: Run green and commit**

```bash
cd mobile
npm test
npm run build
cd ..
git add mobile/src mobile/test
git commit -m "feat: add Downloads navigation to Android app"
```

---

### Task 4: Port link-resolution rules and analyzer client to mobile

**Files:**
- Create: `mobile/src/core/downloads.mjs`
- Create: `mobile/test/downloads-core.test.mjs`

**Interfaces:**
- Produces `normalizeUrl`, `classifyUrl`, `resolveLocal`, `formatBytes`, `createAnalyzerClient`.
- `createAnalyzerClient({ fetchFn, endpoint, timeoutMs })` returns `{ analyze(url) }`.

- [ ] **Step 1: Write failing pure-core tests**

Cover:

```js
assert.equal(normalizeUrl('ftp://example.com/a.zip'), null);
assert.equal(normalizeUrl('javascript:alert(1)'), null);
assert.equal(normalizeUrl('not a url'), null);
assert.equal(normalizeUrl('https://example.com/a.zip').href, 'https://example.com/a.zip');

const drive = resolveLocal('https://drive.google.com/file/d/ABC123/view');
assert.equal(drive.kind, 'result');
assert.match(drive.items[0].url, /export=download/);
assert.match(drive.items[0].url, /id=ABC123/);

const dropbox = resolveLocal('https://www.dropbox.com/s/demo/file.zip?dl=0');
assert.equal(new URL(dropbox.items[0].url).searchParams.get('dl'), '1');

const direct = resolveLocal('https://example.com/file.pdf');
assert.equal(direct.items[0].type, 'pdf');
assert.equal(direct.items[0].size, null);

assert.equal(formatBytes(null), '');
assert.equal(formatBytes(undefined), '');
assert.equal(formatBytes(-1), '');
assert.equal(formatBytes(1024), '1.00 KB');
```

- [ ] **Step 2: Write failing analyzer-client tests**

Assert the client POSTs only:

```js
{ url: 'https://example.com/page' }
```

and normalizes:

```text
AbortError / timeout -> error.code = timeout
invalid JSON         -> bad_response
non-OK without code  -> service_unavailable
Worker code payload  -> returned intact for screen-level handling
```

- [ ] **Step 3: Run red**

```bash
cd mobile
node --test test/downloads-core.test.mjs
```

- [ ] **Step 4: Implement ESM behavior matching `downloads-core.js`**

Keep provider ids stable:

```text
google-drive, dropbox, onedrive, icloud-drive, box, mega,
wetransfer, mediafire, pcloud, direct, web
```

Use default analyzer endpoint `https://download.tifloacosta.com/analyze`, `AbortController`, POST JSON and 10-second client timeout.

Guard missing numbers before numeric conversion:

```js
if (bytes === null || bytes === undefined || bytes === '') return '';
```

- [ ] **Step 5: Run green and commit**

```bash
cd mobile
node --test test/downloads-core.test.mjs
npm test
cd ..
git add mobile/src/core/downloads.mjs mobile/test/downloads-core.test.mjs
git commit -m "feat: add mobile download analysis core"
```

---

### Task 5: Implement the accessible Download-from-link screen and native save

**Files:**
- Replace: `mobile/src/screens/download-link.mjs`
- Extend: `mobile/src/core/i18n.mjs`
- Create: `mobile/test/download-link-screen.test.mjs`

**Interfaces:**
- Consumes Task 4 core plus `nativeActions.saveFile()` and `nativeActions.openExternal()`.
- Produces a URL form, live status, result list, native Save action, external fallback and retry.

- [ ] **Step 1: Write failing structural and dictionary tests**

Require:

```text
addScreenHeader()
input type=url
label bound to input
aria-live=polite status
nativeActions.saveFile
nativeActions.openExternal
no autofocus
```

Require ES/EN keys for invalid URL, analyzing, files found, save, unknown size/type, authentication required, automated block, open external, retry, timeout, unreachable, no files and save failure.

- [ ] **Step 2: Run red**

```bash
cd mobile
node --test test/download-link-screen.test.mjs
```

- [ ] **Step 3: Implement submit flow**

Use:

```js
const normalized = normalizeUrl(input.value);
if (!normalized) {
  setStatus(t('downloadsLink.invalid'));
  return;
}
const local = resolveLocal(normalized.href);
if (local.kind === 'result') return renderResults(local.items);
const payload = await analyzer.analyze(normalized.href);
```

Map Worker codes distinctly:

```text
authentication_required -> external sign-in fallback
access_denied           -> automated-block fallback
no_files                -> no-files state
invalid_url             -> invalid state
timeout                 -> timeout state
unreachable             -> unreachable state
unsupported             -> unsupported state
service_unavailable     -> unavailable state
```

- [ ] **Step 4: Implement native Save**

For a valid result URL call:

```js
const saved = await nativeActions.saveFile({
  url: item.url,
  filename: item.name || t('downloadsLink.defaultFilename'),
  mimeType: mimeFromType(item.type)
});
if (!saved) setStatus(t('downloadsLink.saveFailed'));
```

Do not generate a Save button when `item.url` is absent.

- [ ] **Step 5: Implement external fallback and Retry**

For auth/block/provider fallback use:

```js
await nativeActions.openExternal(normalized.href);
```

Retry reuses the current input URL and the same submit function.

- [ ] **Step 6: Run full mobile tests/build and commit**

```bash
cd mobile
npm test
npm run build
cd ..
git add mobile/src mobile/test/download-link-screen.test.mjs
git commit -m "feat: add Android download-from-link screen"
```

---

### Task 6: Add the pure mobile sound-search contract

**Files:**
- Create: `mobile/src/core/sound-search.mjs`
- Create: `mobile/test/sound-search-core.test.mjs`

**Interfaces:**
- Produces `SOUND_CATEGORIES`, `validateSearch`, `buildProviderQuery`, `normalizeSound`, `formatDuration`, `createSoundSearchClient`.
- Search client sends POST JSON to `/sounds/search`.

- [ ] **Step 1: Write failing category and query tests**

Pin exact ids to the Worker/web contract:

```js
assert.deepEqual(Object.keys(SOUND_CATEGORIES), [
  'ringtones','notifications','alarms','phones','technology',
  'nature','animals','ambience','funny','games'
]);
```

Pin combined search:

```js
assert.equal(buildProviderQuery('bell', 'notifications'), 'bell notification alert');
assert.equal(buildProviderQuery('', 'animals'), 'animal');
```

- [ ] **Step 2: Write failing normalization/request tests**

Require:

```js
const sound = normalizeSound({ name:'Bell', duration:null, size:undefined });
assert.equal(sound.duration, null);
assert.equal(sound.size, null);
```

The client must POST:

```js
{
  query: 'bell notification alert',
  category: 'notifications',
  page: 1
}
```

to `https://download.tifloacosta.com/sounds/search`.

Pin:

```text
provider_unavailable -> typed unavailable result/error state
valid items          -> normalized list
empty items          -> []
invalid JSON         -> bad_response
network failure      -> service_unavailable
AbortError           -> timeout
```

- [ ] **Step 3: Run red**

```bash
cd mobile
node --test test/sound-search-core.test.mjs
```

- [ ] **Step 4: Implement the ESM core matching web category/query behavior**

Do not reference Freesound credentials. Preserve Worker result fields:

```text
id, name, provider, pageUrl, previewUrl, downloadUrl,
duration, format, size, license, author, tags
```

- [ ] **Step 5: Run green and commit**

```bash
cd mobile
node --test test/sound-search-core.test.mjs
npm test
cd ..
git add mobile/src/core/sound-search.mjs mobile/test/sound-search-core.test.mjs
git commit -m "feat: add mobile sound search core"
```

---

### Task 7: Implement accessible sound search and a real screen-cleanup lifecycle

**Files:**
- Modify: `mobile/src/app.mjs`
- Replace: `mobile/src/screens/sound-search.mjs`
- Extend: `mobile/src/core/i18n.mjs`
- Create: `mobile/test/sound-search-screen.test.mjs`
- Create: `mobile/test/screen-cleanup.test.mjs`

**Interfaces:**
- `app.mjs` adds `setScreenCleanup(fn)` to the screen context and invokes the previous cleanup before rendering the next route.
- `renderSoundSearch(context)` registers cleanup that stops active audio.

- [ ] **Step 1: Write failing cleanup-lifecycle test**

Source-level requirement for `mobile/src/app.mjs`:

```js
assert.match(source, /activeScreenCleanup/);
assert.match(source, /setScreenCleanup/);
assert.match(source, /activeScreenCleanup\?\.\(\)/);
```

- [ ] **Step 2: Write failing preview-controller test**

The screen exports:

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

Test that activating `b` pauses `a`, and `stop()` then pauses `b`.

- [ ] **Step 3: Write failing screen-structure tests**

Require:

```text
addScreenHeader()
input type=search
category select with label
aria-live=polite status
createElement('audio')
preload=none
no autoplay
nativeActions.openExternal
setScreenCleanup
```

Require ES/EN keys for query/category/search/searching/no-results/internal-unavailable/author/duration/format/size/license/source/open-original/external-banks.

- [ ] **Step 4: Run red**

```bash
cd mobile
node --test test/screen-cleanup.test.mjs test/sound-search-screen.test.mjs
```

- [ ] **Step 5: Add cleanup lifecycle to `app.mjs`**

Implement before `render(route)` switches screens:

```js
let activeScreenCleanup = null;

function render(route) {
  activeScreenCleanup?.();
  activeScreenCleanup = null;
  const context = {
    // existing context
    setScreenCleanup(cleanup) {
      activeScreenCleanup = typeof cleanup === 'function' ? cleanup : null;
    }
  };
  // existing switch
}
```

- [ ] **Step 6: Implement sound search**

Permit query-only, category-only or both. Reject only when both are empty.

Use `buildProviderQuery(term, category)` before calling the Worker client so query + category is truly combined.

Render metadata only when present. Add `<audio controls preload="none">` only when `previewUrl` exists. On `play`, call `previews.activate(audio)`.

Register:

```js
setScreenCleanup(() => previews.stop());
```

so Back/navigation cannot leave audio playing.

- [ ] **Step 7: Keep external banks always available**

Render:

```js
[
  { name:'Mixkit', url:'https://mixkit.co/free-sound-effects/' },
  { name:'Pixabay', url:'https://pixabay.com/sound-effects/' }
]
```

Each action uses `nativeActions.openExternal(url)`.

When Worker returns `provider_unavailable`, show a concise internal-unavailable message but keep both external actions usable.

- [ ] **Step 8: Run full mobile suite/build and commit**

```bash
cd mobile
npm test
npm run build
cd ..
git add mobile/src mobile/test
git commit -m "feat: add Android sound search screen"
```

---

### Task 8: Lock TalkBack structure, Back/focus behavior and release version

**Files:**
- Extend: `mobile/test/navigation.test.mjs`
- Extend: `mobile/test/home.test.mjs`
- Create: `mobile/test/downloads-accessibility.test.mjs`
- Modify: `mobile/android/app/build.gradle`
- Extend: `mobile/test/android-bootstrap.test.mjs`

**Interfaces:**
- Produces regression coverage plus release `versionCode 3`, `versionName "1.0.2"`.

- [ ] **Step 1: Add navigation stack tests**

Pin:

```text
home -> downloads -> downloads-link -> Back => downloads + restore downloads-open-link
downloads -> downloads-sounds -> Back => downloads + restore downloads-open-sounds
Android system Back delegates to router.back()
```

- [ ] **Step 2: Add accessibility invariants**

For all three new screens require:

```text
shared addScreenHeader()
no autofocus
critical fields have labels
async screens expose polite live status
no autoplay
no window.location navigation for external actions
no FREESOUND_API_KEY in mobile/src
```

- [ ] **Step 3: Add release-version test red**

Require:

```js
assert.match(gradle, /versionCode\s+3\b/);
assert.match(gradle, /versionName\s+"1\.0\.2"/);
```

- [ ] **Step 4: Bump Gradle version only**

```gradle
versionCode 3
versionName "1.0.2"
```

Do not change `applicationId`, package name, minSdk, targetSdk, signing config or keystore handling.

- [ ] **Step 5: Run root + mobile + Capacitor verification and commit**

```bash
npm test
cd mobile
npm test
npm run build
npx cap sync android
cd ..
git add mobile/test mobile/android/app/build.gradle
git commit -m "test: lock Android Downloads accessibility and release version"
```

---

### Task 9: Produce signed artifacts, review, and prepare the integration PR

**Files:**
- Verify: `.github/workflows/bootstrap-mobile-android.yml`
- Verify: `mobile/android/app/build.gradle`
- No production-code change unless verification exposes a reproducible defect.

**Interfaces:**
- Consumes GitHub secrets `TIFLOACOSTA_KEYSTORE_BASE64`, `TIFLOACOSTA_KEYSTORE_PASSWORD`.
- Produces green CI, debug APK, signed release AAB, reviewed PR to `main`.

- [ ] **Step 1: Run complete verification**

```bash
npm test
cd download-worker
npm test
cd ../mobile
npm test
npm run build
npx cap sync android
cd android
chmod +x gradlew
./gradlew --no-daemon clean assembleDebug bundleRelease
```

Expected: every command exits 0.

- [ ] **Step 2: Check the mobile bundle for forbidden secrets**

```bash
grep -R "FREESOUND_API_KEY\|TIFLOACOSTA_KEYSTORE_PASSWORD\|TIFLOACOSTA_KEYSTORE_BASE64" mobile/src mobile/dist || true
```

Expected: no client-side provider/signing secret reference in bundled app code.

- [ ] **Step 3: Push the integration branch and require GitHub Actions green**

```bash
git push -u origin feature/android-downloads-reconciliation
```

Required workflow stages:

```text
root regression tests success
mobile tests          success
mobile bundle         success
Capacitor sync        success
signing preparation   success
assembleDebug         success
bundleRelease         success
artifact upload       success
```

- [ ] **Step 4: Verify signed AAB artifact**

The workflow must decode `TIFLOACOSTA_KEYSTORE_BASE64`, use `TIFLOACOSTA_KEYSTORE_PASSWORD`, detect exactly one `PrivateKeyEntry`, and fail if either secret is missing while the other exists.

Expected artifact:

```text
mobile/android/app/build/outputs/bundle/release/app-release.aab
```

- [ ] **Step 5: Perform final code review against the spec**

Review these failure points explicitly:

```text
no WebView substitution
no second router
no second save system
Android Worker origin accepted without wildcard CORS
no provider secret in mobile bundle
no autoplay and audio stops on route change
Back/focus restoration preserved
authentication_required distinct from access_denied
Mixkit/Pixabay usable without Freesound
unknown metadata not fabricated
all pre-existing mobile screens still registered
```

If a defect is found, first add a test that reproduces it, then fix it and rerun Task 9 Step 1.

- [ ] **Step 6: Open PR to `main`**

Suggested title:

```text
Poner Descargas operativas en Android
```

PR body must state that it reconciles the Android branch with current `main`, adds mobile-native Downloads/link analysis/native save/sound search, keeps Freesound optional, includes ES/EN accessibility coverage, extends Worker CORS only to the Capacitor origin, and produces signed versionCode 3 / versionName 1.0.2 artifacts.

- [ ] **Step 7: Merge only the exact green commit**

Confirm the PR is mergeable and that the latest tested commit SHA matches the PR head before merge. After merge, run the mobile workflow from `main` once more and require another signed AAB from the merged commit.

- [ ] **Step 8: Keep Play Console upload separate**

Do not upload to production automatically. The resulting signed AAB is the handoff artifact for the next Play Console step.
