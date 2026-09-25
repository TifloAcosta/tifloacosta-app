# Android Release Automation and Update Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert Android releases into a repeatable, screen-reader-friendly workflow that versions, tests, signs, packages, publishes to Google Play, and notifies users about available updates with minimal manual work.

**Architecture:** Keep ordinary Android validation separate from release publishing. A small release-request file drives release intent; focused Node modules validate release metadata, talk to Google Play and OneSignal, and generate accessible artifacts. Android in-app updates are exposed through a project-owned Capacitor plugin and surfaced through the existing JS app/router/accessibility patterns.

**Tech Stack:** Node.js 22, node:test, GitHub Actions, Gradle/Android, Capacitor 8, Java, Google Play Android Publisher REST API, OneSignal REST API.

**Spec:** `docs/superpowers/specs/2026-09-25-android-release-automation-and-update-notifications-design.md`

## Global Constraints

- Existing Android notification, signing, APK/AAB, OneSignal-manifest, and regression checks must remain in force.
- `versionCode` must not require manual editing for publishable builds.
- Routine releases must not require editing Gradle, renaming artifacts, or retyping Play Store release notes.
- Production publication must require an explicit production destination; a beta request must never promote itself to production.
- No credential may be committed, printed in logs, or included in uploaded artifacts.
- Release failures must stop before publication and report a short actionable reason.
- Normal updates use a flexible, deferrable flow; only priority 5 may request an immediate flow.
- Update UI must remain operable with TalkBack: explicit heading, named buttons, no time limit, stable focus, no color-only meaning.
- Content changes already present on `main`, including the current Novedades rotation and video integration, are inherited automatically by the next Android build; this plan must not fork or replace that content pipeline.

## Review Focus

- Malformed or partial release requests must fail before any signing or publishing begins.
- A stale local version-code state or unexpectedly high Play Store code must still choose a strictly higher code.
- Missing Google Play or OneSignal secrets must fail only the release operation that needs them and must never leak secret values.
- An update notification received before the app is ready must be queued and routed after initialization, like other notification destinations.
- Repeated resume events during one app session must not produce an endless sequence of update dialogs.

---

### Task 1: Release request model and validation

**Files:**
- Create: `mobile/release/request.json`
- Create: `mobile/scripts/release-request.mjs`
- Create: `mobile/test/release-request.test.mjs`

**Interfaces:**
- Produces: `parseReleaseRequest(value) -> { versionName, track, status, priority, notifyUpdate, notes }`
- Produces: `readReleaseRequest(path) -> Promise<ReleaseRequest>`
- Produces: `artifactNames({ versionName, versionCode }) -> { aab, apk, zip }`
- Consumes: Node `fs/promises`; no external package.

- [ ] **Step 1: Write failing release-request tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseReleaseRequest, artifactNames } from '../scripts/release-request.mjs';

test('accepts a closed-test release request', () => {
  assert.deepEqual(parseReleaseRequest({
    versionName: '1.3.2',
    track: 'alpha',
    status: 'completed',
    priority: 2,
    notifyUpdate: true,
    notes: { es: 'Mejoras de accesibilidad.', en: 'Accessibility improvements.' }
  }), {
    versionName: '1.3.2', track: 'alpha', status: 'completed', priority: 2,
    notifyUpdate: true,
    notes: { es: 'Mejoras de accesibilidad.', en: 'Accessibility improvements.' }
  });
});

test('rejects malformed version, invalid priority and implicit production', () => {
  assert.throws(() => parseReleaseRequest({ versionName: 'v1', track: 'production', priority: 6 }), /release request/i);
});

test('creates screen-reader-friendly artifact names', () => {
  assert.deepEqual(artifactNames({ versionName: '1.3.2', versionCode: 11 }), {
    aab: 'TifloAcosta-Android-1.3.2-code11.aab',
    apk: 'TifloAcosta-Android-1.3.2-code11-debug.apk',
    zip: 'TifloAcosta-Android-1.3.2-code11.zip'
  });
});
```

- [ ] **Step 2: Run tests and verify failure**

Run: `cd mobile && node --test test/release-request.test.mjs`

Expected: FAIL because `scripts/release-request.mjs` does not exist.

- [ ] **Step 3: Implement strict request parsing**

```js
import { readFile } from 'node:fs/promises';

const TRACKS = new Set(['alpha', 'beta', 'production']);
const STATUSES = new Set(['draft', 'completed']);

function fail(message) { throw new Error(`Invalid release request: ${message}`); }

export function parseReleaseRequest(value = {}) {
  const versionName = String(value.versionName || '').trim();
  const track = String(value.track || '').trim();
  const status = String(value.status || 'draft').trim();
  const priority = Number(value.priority ?? 0);
  const notifyUpdate = value.notifyUpdate === true;
  const notes = {
    es: String(value.notes?.es || '').trim(),
    en: String(value.notes?.en || '').trim()
  };
  if (!/^\d+\.\d+\.\d+$/.test(versionName)) fail('versionName must use x.y.z');
  if (!TRACKS.has(track)) fail('unknown track');
  if (!STATUSES.has(status)) fail('unknown status');
  if (!Number.isInteger(priority) || priority < 0 || priority > 5) fail('priority must be 0-5');
  if (!notes.es || !notes.en) fail('Spanish and English notes are required');
  if (track === 'production' && value.confirmProduction !== true) fail('production requires confirmProduction=true');
  return { versionName, track, status, priority, notifyUpdate, notes };
}

export async function readReleaseRequest(path) {
  return parseReleaseRequest(JSON.parse(await readFile(path, 'utf8')));
}

export function artifactNames({ versionName, versionCode }) {
  const stem = `TifloAcosta-Android-${versionName}-code${versionCode}`;
  return { aab: `${stem}.aab`, apk: `${stem}-debug.apk`, zip: `${stem}.zip` };
}
```

- [ ] **Step 4: Add a safe default request for the next beta**

```json
{
  "versionName": "1.3.2",
  "track": "alpha",
  "status": "draft",
  "priority": 2,
  "notifyUpdate": true,
  "notes": {
    "es": "Mejoras de Novedades, accesibilidad y funcionamiento general.",
    "en": "Improvements to What's New, accessibility, and general operation."
  }
}
```

This is deliberately `draft`: building the machinery must not publish a release by itself.

- [ ] **Step 5: Run tests**

Run: `cd mobile && node --test test/release-request.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add mobile/release/request.json mobile/scripts/release-request.mjs mobile/test/release-request.test.mjs
git commit -m "feat: define Android release request"
```

---

### Task 2: Dynamic Android build identity

**Files:**
- Modify: `mobile/android/app/build.gradle`
- Create: `mobile/test/android-release-identity.test.mjs`

**Interfaces:**
- Consumes environment variables `TIFLO_ANDROID_VERSION_NAME`, `TIFLO_ANDROID_VERSION_CODE`.
- Produces Gradle `versionName` and `versionCode`; falls back to current development values when the variables are absent.

- [ ] **Step 1: Write failing source-level tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const gradle = await readFile(new URL('../android/app/build.gradle', import.meta.url), 'utf8');

test('Gradle accepts release version overrides', () => {
  assert.match(gradle, /TIFLO_ANDROID_VERSION_NAME/);
  assert.match(gradle, /TIFLO_ANDROID_VERSION_CODE/);
  assert.match(gradle, /Integer\.parseInt/);
});
```

- [ ] **Step 2: Verify the test fails**

Run: `cd mobile && node --test test/android-release-identity.test.mjs`

Expected: FAIL because Gradle currently contains fixed `versionCode 10` and `versionName "1.3.1"` only.

- [ ] **Step 3: Implement environment-backed Gradle identity**

Add before `android {`:

```groovy
def releaseVersionName = System.getenv('TIFLO_ANDROID_VERSION_NAME')
def releaseVersionCodeText = System.getenv('TIFLO_ANDROID_VERSION_CODE')
def effectiveVersionName = releaseVersionName?.trim() ? releaseVersionName.trim() : '1.3.1'
def effectiveVersionCode = releaseVersionCodeText?.trim() ? Integer.parseInt(releaseVersionCodeText.trim()) : 10
if (effectiveVersionCode < 1) {
    throw new GradleException('TIFLO_ANDROID_VERSION_CODE must be a positive integer')
}
```

Replace the fixed declarations with:

```groovy
versionCode effectiveVersionCode
versionName effectiveVersionName
```

- [ ] **Step 4: Run JS test and Gradle configuration smoke test**

Run:

```bash
cd mobile
node --test test/android-release-identity.test.mjs
cd android
TIFLO_ANDROID_VERSION_NAME=9.8.7 TIFLO_ANDROID_VERSION_CODE=123 ./gradlew --no-daemon tasks >/dev/null
```

Expected: PASS and Gradle exits 0.

- [ ] **Step 5: Commit**

```bash
git add mobile/android/app/build.gradle mobile/test/android-release-identity.test.mjs
git commit -m "feat: make Android release identity dynamic"
```

---

### Task 3: Google Play release client and automatic versionCode

**Files:**
- Create: `mobile/scripts/google-play-release.mjs`
- Create: `mobile/test/google-play-release.test.mjs`
- Create: `mobile/release/state.json`

**Interfaces:**
- Produces: `chooseNextVersionCode({ playCodes, localCode }) -> number`
- Produces: `createGoogleAccessToken(serviceAccount, fetchImpl) -> Promise<string>`
- Produces: `createPlayReleaseClient({ packageName, accessToken, fetchImpl })` with `createEdit`, `listTracks`, `listBundles`, `uploadBundle`, `updateTrack`, `validateEdit`, `commitEdit`.
- Uses REST only; no Google client dependency.

- [ ] **Step 1: Write failing pure-logic tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseNextVersionCode } from '../scripts/google-play-release.mjs';

test('chooses one above the highest Play or local code', () => {
  assert.equal(chooseNextVersionCode({ playCodes: [8, 10, 11], localCode: 9 }), 12);
  assert.equal(chooseNextVersionCode({ playCodes: [8, 10], localCode: 15 }), 16);
  assert.equal(chooseNextVersionCode({ playCodes: [], localCode: 0 }), 1);
});
```

Add mocked-fetch tests that assert requests use package `com.tifloacosta.app`, edit IDs, Bearer auth, and throw an error containing HTTP status but not response credentials.

- [ ] **Step 2: Verify failure**

Run: `cd mobile && node --test test/google-play-release.test.mjs`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement version selection and JWT OAuth**

Use Node `crypto.createSign('RSA-SHA256')` to sign a Google service-account JWT with claims:

```js
{
  iss: client_email,
  scope: 'https://www.googleapis.com/auth/androidpublisher',
  aud: 'https://oauth2.googleapis.com/token',
  iat: now,
  exp: now + 3600
}
```

POST `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer` and the assertion to `https://oauth2.googleapis.com/token`.

Implement:

```js
export function chooseNextVersionCode({ playCodes = [], localCode = 0 } = {}) {
  const codes = [...playCodes, Number(localCode) || 0].filter(Number.isFinite);
  return Math.max(0, ...codes) + 1;
}
```

- [ ] **Step 4: Implement Android Publisher edit methods**

Use base URL:

```js
const base = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(packageName)}/edits`;
```

`updateTrack` must send:

```js
{
  releases: [{
    name: versionName,
    status,
    versionCodes: [String(versionCode)],
    inAppUpdatePriority: priority,
    releaseNotes: [
      { language: 'es-ES', text: notes.es },
      { language: 'en-US', text: notes.en }
    ]
  }]
}
```

Use the upload host `https://androidpublisher.googleapis.com/upload/androidpublisher/v3/.../bundles?uploadType=media` for the AAB.

- [ ] **Step 5: Add release state file**

```json
{
  "lastSuccessfulVersionCode": 10,
  "lastSuccessfulVersionName": "1.3.1"
}
```

- [ ] **Step 6: Run tests**

Run: `cd mobile && node --test test/google-play-release.test.mjs`

Expected: PASS with mocked HTTP only; no real Play publication.

- [ ] **Step 7: Commit**

```bash
git add mobile/scripts/google-play-release.mjs mobile/test/google-play-release.test.mjs mobile/release/state.json
git commit -m "feat: add Google Play release client"
```

---

### Task 4: Accessible release package and summary generator

**Files:**
- Create: `mobile/scripts/release-report.mjs`
- Create: `mobile/test/release-report.test.mjs`

**Interfaces:**
- Produces: `buildReleaseInfo(data) -> string`
- Produces: `buildGithubSummary(data) -> string`
- Produces: `buildPlayNotes(request) -> string`

- [ ] **Step 1: Write failing tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReleaseInfo, buildGithubSummary } from '../scripts/release-report.mjs';

const data = {
  versionName: '1.3.2', versionCode: 11, track: 'alpha', status: 'draft',
  commit: 'abc123', checks: { tests: true, signing: true, aab: true, apk: true, oneSignal: true }
};

test('plain-text report is linear and explicit', () => {
  const text = buildReleaseInfo(data);
  assert.match(text, /Versión: 1\.3\.2/);
  assert.match(text, /Código: 11/);
  assert.match(text, /Firma: CORRECTA/);
  assert.doesNotMatch(text, /\|/);
});
```

- [ ] **Step 2: Verify failure**

Run: `cd mobile && node --test test/release-report.test.mjs`

Expected: FAIL because module does not exist.

- [ ] **Step 3: Implement report functions**

`buildReleaseInfo` returns plain UTF-8 text with one fact per line. `buildGithubSummary` uses short Markdown headings plus bullets, never wide tables. `buildPlayNotes` returns both store-language blocks in a deterministic order.

- [ ] **Step 4: Run tests**

Run: `cd mobile && node --test test/release-report.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile/scripts/release-report.mjs mobile/test/release-report.test.mjs
git commit -m "feat: generate accessible Android release reports"
```

---

### Task 5: OneSignal update notification client and version metadata

**Files:**
- Create: `mobile/scripts/onesignal-release-notification.mjs`
- Create: `mobile/test/onesignal-release-notification.test.mjs`
- Modify: `mobile/src/native/onesignal-notifications.mjs`
- Modify: `mobile/src/app.mjs`
- Modify: `mobile/test/onesignal-notifications.test.mjs` if present; otherwise create it.

**Interfaces:**
- Produces: `buildUpdateNotification({ versionName }) -> OneSignal payload`
- Produces: `sendUpdateNotification({ appId, apiKey, versionName, fetchImpl })`
- Extends `createOneSignalNotifications` options with `appVersion` and stores only useful Android/version metadata.

- [ ] **Step 1: Write failing REST payload tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildUpdateNotification } from '../scripts/onesignal-release-notification.mjs';

test('update push targets Android and routes as update', () => {
  const body = buildUpdateNotification({ versionName: '1.3.2' });
  assert.equal(body.isAndroid, true);
  assert.equal(body.data.tiflo_type, 'update');
  assert.equal(body.data.tiflo_version, '1.3.2');
  assert.match(body.headings.es, /Nueva versión/);
});
```

- [ ] **Step 2: Implement client**

Build a payload with multilingual headings/contents, `isAndroid: true`, and update routing data. Send it to `https://api.onesignal.com/notifications` with `Authorization: Key <secret>` and the existing app ID.

Never print the key or include it in thrown error text.

- [ ] **Step 3: Pass app version into OneSignal initialization**

In `app.mjs`, after `loadAppInfo(App)` resolves, provide `appInfo.version` to the OneSignal adapter. In `onesignal-notifications.mjs`, store a single useful version tag such as `tiflo_version=<version>` and retain `tiflo_client=android_app` only if needed by existing segmentation; do not add redundant platform tags.

- [ ] **Step 4: Run focused tests**

Run:

```bash
cd mobile
node --test test/onesignal-release-notification.test.mjs test/onesignal-notifications.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile/scripts/onesignal-release-notification.mjs mobile/test/onesignal-release-notification.test.mjs mobile/src/native/onesignal-notifications.mjs mobile/src/app.mjs mobile/test/onesignal-notifications.test.mjs
git commit -m "feat: prepare Android update push notifications"
```

---

### Task 6: Notification routing for update actions

**Files:**
- Modify: `mobile/src/core/notification-destination.mjs`
- Modify: `mobile/src/core/notification-router.mjs`
- Modify: `mobile/test/notification-destination.test.mjs`
- Modify: `mobile/test/notification-router.test.mjs`

**Interfaces:**
- `normalizeNotificationDestination` now accepts `tiflo_type=update` and returns `{ type: 'update', version }`.
- Existing coordinator behavior remains unchanged and therefore queues an update destination if the app is not yet ready.

- [ ] **Step 1: Add failing destination test**

```js
test('normalizes update notification', () => {
  assert.deepEqual(normalizeNotificationDestination({
    tiflo_type: 'update', tiflo_version: '1.3.2'
  }), { type: 'update', version: '1.3.2' });
});
```

- [ ] **Step 2: Add failing router test**

Create an `update` spy action and assert that `createNotificationRouter({ home, update })` dispatches to it without falling back to home.

- [ ] **Step 3: Implement update type**

Add `update` to `TYPES`, sanitize `tiflo_version` with the same `x.y.z` rule, and return general on malformed update payloads.

- [ ] **Step 4: Run tests**

Run:

```bash
cd mobile
node --test test/notification-destination.test.mjs test/notification-router.test.mjs test/notification-coordinator.test.mjs
```

Expected: PASS, including the existing pending-before-ready coordinator behavior.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/core/notification-destination.mjs mobile/src/core/notification-router.mjs mobile/test/notification-destination.test.mjs mobile/test/notification-router.test.mjs
git commit -m "feat: route Android update notifications"
```

---

### Task 7: Native Google Play in-app update bridge

**Files:**
- Create: `mobile/android/app/src/main/java/com/tifloacosta/app/TifloUpdatePlugin.java`
- Modify: `mobile/android/app/src/main/java/com/tifloacosta/app/MainActivity.java`
- Modify: `mobile/android/app/build.gradle`
- Create: `mobile/src/native/update-plugin.mjs`
- Create: `mobile/src/core/update-policy.mjs`
- Create: `mobile/test/update-policy.test.mjs`

**Interfaces:**
- Native plugin methods: `check()`, `startFlexible()`, `startImmediate()`, `completeFlexible()`.
- `check()` returns `{ available, availability, versionCode, priority, flexibleAllowed, immediateAllowed, installStatus }`.
- JS wrapper exposes `TifloUpdate` through `registerPlugin('TifloUpdate')`.
- `chooseUpdateMode(info)` returns `'none' | 'flexible' | 'immediate'`.

- [ ] **Step 1: Write failing update-policy tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseUpdateMode } from '../src/core/update-policy.mjs';

test('priority 5 can use immediate when Play allows it', () => {
  assert.equal(chooseUpdateMode({ available: true, priority: 5, immediateAllowed: true, flexibleAllowed: true }), 'immediate');
});

test('ordinary update prefers flexible', () => {
  assert.equal(chooseUpdateMode({ available: true, priority: 2, flexibleAllowed: true }), 'flexible');
});

test('unavailable update produces none', () => {
  assert.equal(chooseUpdateMode({ available: false }), 'none');
});
```

- [ ] **Step 2: Verify failure**

Run: `cd mobile && node --test test/update-policy.test.mjs`

Expected: FAIL because module does not exist.

- [ ] **Step 3: Add Play Update dependency**

In `dependencies` add the current Play In-App Update artifacts compatible with the project Android toolchain, including the Java artifact required for `AppUpdateManager`.

At implementation time verify the exact artifact version against the current official Android documentation before committing; do not guess a stale version number into the repository.

- [ ] **Step 4: Implement `TifloUpdatePlugin.java`**

Use `AppUpdateManagerFactory.create(getContext())`. `check()` maps `AppUpdateInfo` into the documented JSON fields. `startFlexible()` and `startImmediate()` start the corresponding Play update flow from the current Activity. `completeFlexible()` calls `completeUpdate()` only when the install status is downloaded.

Plugin calls must reject with short stable codes such as `update_unavailable`, `flow_not_allowed`, and `update_failed`; never expose stack traces to the web layer.

- [ ] **Step 5: Register the plugin**

In `MainActivity.onCreate` add:

```java
registerPlugin(TifloUpdatePlugin.class);
```

- [ ] **Step 6: Add JS wrapper and pure policy**

```js
import { registerPlugin } from '@capacitor/core';
export const TifloUpdate = registerPlugin('TifloUpdate');
```

Policy:

```js
export function chooseUpdateMode(info = {}) {
  if (!info.available) return 'none';
  if (Number(info.priority) === 5 && info.immediateAllowed) return 'immediate';
  if (info.flexibleAllowed) return 'flexible';
  if (info.immediateAllowed) return 'immediate';
  return 'none';
}
```

- [ ] **Step 7: Run JS tests and Android compile**

Run:

```bash
cd mobile
node --test test/update-policy.test.mjs
npm run build
npx cap sync android
cd android
./gradlew --no-daemon compileDebugJavaWithJavac
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add mobile/android/app/src/main/java/com/tifloacosta/app/TifloUpdatePlugin.java mobile/android/app/src/main/java/com/tifloacosta/app/MainActivity.java mobile/android/app/build.gradle mobile/src/native/update-plugin.mjs mobile/src/core/update-policy.mjs mobile/test/update-policy.test.mjs
git commit -m "feat: add Google Play in-app update bridge"
```

---

### Task 8: Accessible in-app update experience

**Files:**
- Create: `mobile/src/core/update-session.mjs`
- Create: `mobile/src/screens/update.mjs`
- Modify: `mobile/src/app.mjs`
- Modify: `mobile/src/core/i18n.mjs`
- Modify: `mobile/src/styles.css`
- Create: `mobile/test/update-session.test.mjs`
- Create: `mobile/test/update-screen.test.mjs`

**Interfaces:**
- `createUpdateSession({ plugin, storage })` exposes `check`, `start`, `complete`, `dismissForSession`, `state`.
- Router gains an `update` screen.
- App checks once after initialization and again on `resume`, but the session suppresses duplicate prompts until availability materially changes or the app restarts.

- [ ] **Step 1: Write failing session tests**

Test these cases explicitly:

```js
// first available update => prompt
// repeated check in same session => no second prompt
// dismiss => no repeat in same session
// downloaded flexible update => state requests completion
// plugin failure => unavailable, app remains usable
```

Use a fake plugin; no Play calls.

- [ ] **Step 2: Implement session state machine**

Keep state in memory for same-session suppression. Do not permanently hide a version merely because the user chose `Más tarde`; a future app launch may offer it again.

- [ ] **Step 3: Write failing DOM/accessibility screen tests**

Assert:

```js
assert.equal(root.querySelector('h1')?.textContent, 'Nueva versión disponible');
assert.equal(root.querySelector('button[data-action="update"]')?.textContent, 'Actualizar ahora');
assert.equal(root.querySelector('button[data-action="later"]')?.textContent, 'Más tarde');
```

Also assert the heading is focusable by the existing `focusScreenHeading` convention and that immediate mode omits `Más tarde` only when the policy truly requires an immediate flow.

- [ ] **Step 4: Implement the update screen and translations**

Add ES/EN strings for heading, available-version copy, update, later, download-complete, restart/complete, and failure fallback.

Use existing `.back-button`/button conventions where appropriate, but do not force a back control onto an immediate-update screen.

- [ ] **Step 5: Wire app startup, resume, and notification action**

Create the session during app initialization. After app readiness call `check()`. On `resume`, call `check()` again. Add `update` to notification-router actions so an update push triggers the same session/screen, never a different update implementation.

- [ ] **Step 6: Run focused tests and all mobile tests**

Run:

```bash
cd mobile
node --test test/update-session.test.mjs test/update-screen.test.mjs
npm test
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add mobile/src/core/update-session.mjs mobile/src/screens/update.mjs mobile/src/app.mjs mobile/src/core/i18n.mjs mobile/src/styles.css mobile/test/update-session.test.mjs mobile/test/update-screen.test.mjs
git commit -m "feat: add accessible Android update experience"
```

---

### Task 9: Release orchestrator and GitHub Actions workflow

**Files:**
- Create: `mobile/scripts/release-android.mjs`
- Create: `mobile/test/release-android.test.mjs`
- Create: `.github/workflows/release-mobile-android.yml`
- Modify: `.github/workflows/bootstrap-mobile-android.yml`

**Interfaces:**
- Orchestrator consumes `mobile/release/request.json`, `mobile/release/state.json`, service-account JSON, signing secrets, and optional OneSignal REST key.
- Workflow dispatch input `publish` is a boolean safety gate in addition to request `status`.
- Existing bootstrap workflow remains validation-only.

- [ ] **Step 1: Write failing orchestrator decision tests**

Mock Play and OneSignal services and test:

```js
// missing service account => fail before upload
// draft request + publish=false => build/package only, no Play commit
// completed request + publish=true => upload, validate, commit
// notifyUpdate=true => OneSignal called only after Play commit succeeds
// Play commit failure => no OneSignal call
// production without explicit confirmation => rejected by Task 1 parser
```

- [ ] **Step 2: Implement `release-android.mjs` orchestration helpers**

Keep process execution separated from pure decision logic. Export a `runRelease({ request, play, oneSignal, paths, env })` function for tests. CLI entry reads files/env, obtains Play code, sets build environment, and executes Gradle through `spawnSync` with inherited stdio but no secret-bearing command-line arguments.

- [ ] **Step 3: Create dedicated release workflow**

`release-mobile-android.yml` must:

1. run only by `workflow_dispatch`;
2. checkout full history;
3. setup Node 22 with npm cache keyed on `mobile/package-lock.json`;
4. setup Java 21 with Gradle cache;
5. use `npm ci` in `mobile`;
6. run repository and mobile tests;
7. read/validate the release request;
8. decode the existing keystore secrets;
9. pass Google Play service-account JSON via environment/file with restrictive permissions;
10. invoke the release orchestrator;
11. verify AAB signature and merged notification manifest;
12. create renamed AAB/APK plus `INFORMACION-COMPILACION.txt` and Play notes;
13. ZIP the release package;
14. append the concise report to `$GITHUB_STEP_SUMMARY`;
15. upload exactly the named ZIP plus individual AAB/APK for convenience.

Secrets expected:

```text
TIFLOACOSTA_KEYSTORE_BASE64
TIFLOACOSTA_KEYSTORE_PASSWORD
GOOGLE_PLAY_SERVICE_ACCOUNT_JSON
ONESIGNAL_REST_API_KEY
```

- [ ] **Step 4: Make bootstrap workflow validation-only and reproducible**

Change `npm install` to `npm ci`; add Node npm cache and Gradle cache. Keep debug APK and validation AAB generation, but label artifacts explicitly as validation outputs and never call Play/OneSignal REST from this workflow.

- [ ] **Step 5: Add workflow source tests**

In `release-android.test.mjs`, read both YAML files and assert:

```js
assert.match(releaseWorkflow, /workflow_dispatch/);
assert.match(releaseWorkflow, /GOOGLE_PLAY_SERVICE_ACCOUNT_JSON/);
assert.match(releaseWorkflow, /ONESIGNAL_REST_API_KEY/);
assert.match(releaseWorkflow, /GITHUB_STEP_SUMMARY/);
assert.match(bootstrapWorkflow, /npm ci/);
assert.doesNotMatch(bootstrapWorkflow, /GOOGLE_PLAY_SERVICE_ACCOUNT_JSON/);
```

- [ ] **Step 6: Run the full repository test suite without publishing**

Run:

```bash
npm test
cd mobile
npm test
npm run build
npx cap sync android
cd android
./gradlew --no-daemon assembleDebug bundleRelease
```

Expected: PASS. No Google Play API mutation and no OneSignal REST send occurs in local verification.

- [ ] **Step 7: Commit**

```bash
git add mobile/scripts/release-android.mjs mobile/test/release-android.test.mjs .github/workflows/release-mobile-android.yml .github/workflows/bootstrap-mobile-android.yml
git commit -m "feat: automate Android release workflow"
```

---

### Task 10: End-to-end dry run, credentials gate, and operator documentation

**Files:**
- Create: `docs/android-release.md`
- Modify: `mobile/release/request.json` only if dry-run corrections are needed.

**Interfaces:**
- Documentation is the screen-reader-friendly operator contract for routine releases.

- [ ] **Step 1: Run all automated tests**

Run:

```bash
npm test
cd mobile && npm test
```

Expected: all PASS.

- [ ] **Step 2: Run a local build with synthetic release identity**

Run:

```bash
cd mobile
npm ci
npm run build
npx cap sync android
cd android
TIFLO_ANDROID_VERSION_NAME=1.3.2 TIFLO_ANDROID_VERSION_CODE=999 ./gradlew --no-daemon assembleDebug bundleRelease
```

Expected: APK/AAB generated; no publication occurs.

- [ ] **Step 3: Verify release workflow fails safely without publication credentials**

Exercise the orchestrator with missing `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`; expected result is an explicit credentials error before upload and without echoing secret values.

- [ ] **Step 4: Write operator documentation**

`docs/android-release.md` must contain a short linear procedure:

```text
1. Edit only mobile/release/request.json: version, notes, track, status, priority.
2. Run GitHub Actions > Release TifloAcosta Android.
3. For a build/package dry run, leave Publish disabled.
4. For the intended beta publication, enable Publish only after reviewing the request.
5. Read the final GitHub summary: version, code, tests, signature, Play status, update notification.
6. Download TifloAcosta-Android-<version>-code<code>.zip if a local copy is needed.
```

Also document the one-time secrets by name, but never their values.

- [ ] **Step 5: Perform first authenticated Google Play dry/draft integration**

After `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` is configured, run the release workflow with `status: draft` and Publish disabled first. Confirm authentication/version-code discovery succeeds while no release becomes available to testers.

- [ ] **Step 6: Perform first authenticated OneSignal API test without audience send**

Validate the REST credential using a non-sending/read-safe endpoint or a payload validation path if supported by the current OneSignal API. Do not send an update notification until an actual accepted Play release exists.

- [ ] **Step 7: Final beta publication verification**

Only after the dry run passes, set the requested beta status and run Publish. Verify in order:

```text
GitHub tests PASS
AAB signature PASS
Play upload PASS
Play edit commit PASS
Update push send PASS when enabled
ZIP artifact present
Android beta device sees the new update through Play
In-app update screen is usable with TalkBack
Novedades includes the current main-branch rotation and video integration
```

- [ ] **Step 8: Commit documentation**

```bash
git add docs/android-release.md
git commit -m "docs: document accessible Android release process"
```

---

## Self-review results

- Spec coverage: release request, automatic code selection, reproducible build, signing checks, accessible package, Google Play publishing, OneSignal update push, in-app updates, accessibility, security, beta/production separation, and routine operator procedure are each assigned to a task.
- Placeholder scan: no implementation task uses TBD/TODO. The only version intentionally not hard-coded is the external Google Play in-app-update library version, because the implementation must verify the current official artifact before committing a dependency; this prevents baking a stale version into the plan.
- Interface consistency: release request fields, version/code names, update destination type, plugin methods, and reporting fields are consistent across tasks.
- Review-focus coverage: malformed request (Task 1), version-code race/staleness (Task 3), missing credentials (Tasks 3/5/9), queued notification routing (Task 6), duplicate update prompting (Task 8).
