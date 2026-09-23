# Android Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add accessible native Android push notifications to the TifloAcosta Capacitor app through the existing OneSignal application, with safe direct routing to TifloAcosta content and clean separation from existing Web Push subscribers.

**Architecture:** Use `@onesignal/capacitor-plugin` 1.1.6 behind a small app-owned adapter so TifloAcosta does not depend on OneSignal throughout the UI. Parse and validate notification destinations in a pure module, queue any cold-start click until the app router is ready, and dispatch validated destinations into the existing news, video, resource, download, and Home flows. Keep the existing Settings > Notifications UI and wire its current service abstraction to the native adapter.

**Tech Stack:** Capacitor 8.5.2, JavaScript ES modules, Node 22 test runner, OneSignal Capacitor SDK 1.1.6, Android/Gradle, Firebase Cloud Messaging V1, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-23-android-notifications-design.md`

## Global Constraints

- Reuse the existing OneSignal application already used by `tifloacosta.com`; do not create a second OneSignal app for Android.
- Keep Android Push and Web Push independently targetable inside the same OneSignal application.
- Do not request notification permission automatically at startup.
- Request permission only from the existing explicit `Activar notificaciones` / `Enable notifications` user action.
- Notification clicks must work with the app foregrounded, backgrounded, or cold-started.
- Invalid, missing, stale, or unsafe destinations must fall back to Home.
- Do not design around TalkBack-only behavior; keep semantic controls and screen-reader-neutral Android accessibility behavior.
- Do not commit Firebase Service Account private keys, OneSignal REST API keys, Android signing secrets, or other private credentials.
- Keep the existing Web Push implementation in root `notifications.js` unchanged.
- The next beta will be Android versionName `1.2.0`, versionCode `7` after implementation and verification pass.
- Do not add topic/category preferences, rich notification layouts, or custom sounds in this release.
- Disable the unused OneSignal location module with `ONESIGNAL_DISABLE_LOCATION=true` during Capacitor sync and Android builds.
- Do not add `google-services.json` solely for OneSignal. Current OneSignal Android/Capacitor setup requires FCM credentials in the OneSignal dashboard; the existing conditional Gradle support for `google-services.json` can remain untouched.

## Review Focus

- A notification whose `additionalData` is null, an array, or contains non-string values must never crash routing; it must resolve to Home.
- A notification with an unsupported URL scheme such as `javascript:`, `file:`, or `intent:` must never be opened; it must resolve to Home.
- A video notification with an invalid YouTube ID or non-YouTube URL must not open an empty player; it must resolve to Home.
- Multiple clicks arriving before JavaScript startup is ready must not cause duplicate navigation; only the most recent pending destination should be consumed once.
- A OneSignal initialization/network failure must leave the rest of the app usable and report notifications as unavailable rather than causing an unhandled rejection or blocking startup.

---

### Task 1: Add and lock the OneSignal Capacitor dependency

**Files:**
- Modify: `mobile/package.json`
- Modify: `mobile/package-lock.json`
- Modify: `.github/workflows/bootstrap-mobile-android.yml`
- Generated/reviewed after sync: `mobile/android/capacitor.settings.gradle`
- Generated/reviewed after sync: `mobile/android/app/capacitor.build.gradle`
- Test: `mobile/test/android-notification-dependency.test.mjs`

**Interfaces:**
- Consumes: Capacitor 8.5.2 already present in `mobile/package.json`.
- Produces: `@onesignal/capacitor-plugin` version `1.1.6`, registered in Android by Capacitor sync.

- [ ] **Step 1: Write the failing dependency/configuration test**

Create `mobile/test/android-notification-dependency.test.mjs`:

```js
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const mobileRead = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const repoRead = path => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('mobile pins the OneSignal Capacitor plugin used for Android push', async () => {
  const pkg = JSON.parse(await mobileRead('package.json'));
  assert.equal(pkg.dependencies['@onesignal/capacitor-plugin'], '1.1.6');
});

test('Android CI disables the unused OneSignal location module', async () => {
  const workflow = await repoRead('.github/workflows/bootstrap-mobile-android.yml');
  assert.match(workflow, /ONESIGNAL_DISABLE_LOCATION/);
});
```

- [ ] **Step 2: Run the test and verify it fails**

```bash
cd mobile
node --test test/android-notification-dependency.test.mjs
```

Expected: FAIL because the OneSignal package and CI environment flag are absent.

- [ ] **Step 3: Install the exact SDK version**

```bash
cd mobile
npm install @onesignal/capacitor-plugin@1.1.6 --save-exact
```

- [ ] **Step 4: Add `ONESIGNAL_DISABLE_LOCATION` to Android sync/build in CI**

In `.github/workflows/bootstrap-mobile-android.yml`, add this environment block to the `Add and synchronize Android` step and the `Build Android debug APK and release bundle` step:

```yaml
env:
  ONESIGNAL_DISABLE_LOCATION: true
```

Do not change the existing signing-secret logic.

- [ ] **Step 5: Synchronize Android and review generated plugin changes**

```bash
cd mobile
ONESIGNAL_DISABLE_LOCATION=true npx cap sync android
```

Expected: Capacitor registers the OneSignal plugin in the generated Android Gradle files. Do not hand-edit the generated plugin registration.

- [ ] **Step 6: Run the focused test and full mobile suite**

```bash
cd mobile
node --test test/android-notification-dependency.test.mjs
npm test
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add mobile/package.json mobile/package-lock.json .github/workflows/bootstrap-mobile-android.yml mobile/android/capacitor.settings.gradle mobile/android/app/capacitor.build.gradle mobile/test/android-notification-dependency.test.mjs
git commit -m "build: add OneSignal Capacitor SDK"
```

---

### Task 2: Parse notification destinations safely

**Files:**
- Create: `mobile/src/core/notification-destination.mjs`
- Test: `mobile/test/notification-destination.test.mjs`

**Interfaces:**
- Consumes: raw `event.notification.additionalData` from OneSignal.
- Consumes: existing `youtubeVideoId(url)` from `mobile/src/core/share-classifier.mjs`.
- Produces: `normalizeNotificationDestination(value)` returning one of:
  - `{ type: 'general' }`
  - `{ type: 'news', url, title }`
  - `{ type: 'video', id, url, title }` where `id` is always a validated 11-character YouTube ID
  - `{ type: 'resource', id, url, title }`
  - `{ type: 'download', url, title }`

- [ ] **Step 1: Write the failing parser tests**

Create `mobile/test/notification-destination.test.mjs`:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeNotificationDestination } from '../src/core/notification-destination.mjs';

test('missing or malformed notification data falls back to general', () => {
  for (const value of [null, undefined, [], 'news', 42]) {
    assert.deepEqual(normalizeNotificationDestination(value), { type: 'general' });
  }
});

test('news accepts only safe http or https URLs', () => {
  assert.deepEqual(
    normalizeNotificationDestination({ tiflo_type: 'news', tiflo_url: 'https://example.com/a', tiflo_title: 'Título' }),
    { type: 'news', url: 'https://example.com/a', title: 'Título' }
  );
  for (const url of ['javascript:alert(1)', 'file:///tmp/a', 'intent://x']) {
    assert.deepEqual(normalizeNotificationDestination({ tiflo_type: 'news', tiflo_url: url }), { type: 'general' });
  }
});

test('video accepts a valid YouTube id or derives it from a YouTube URL', () => {
  assert.deepEqual(
    normalizeNotificationDestination({ tiflo_type: 'video', tiflo_id: 'qYvoYsQZNbQ', tiflo_title: 'Vídeo' }),
    { type: 'video', id: 'qYvoYsQZNbQ', url: '', title: 'Vídeo' }
  );
  assert.deepEqual(
    normalizeNotificationDestination({ tiflo_type: 'video', tiflo_url: 'https://www.youtube.com/watch?v=qYvoYsQZNbQ' }),
    { type: 'video', id: 'qYvoYsQZNbQ', url: 'https://www.youtube.com/watch?v=qYvoYsQZNbQ', title: '' }
  );
});

test('invalid video destinations fall back to general', () => {
  for (const payload of [
    { tiflo_type: 'video', tiflo_id: 'short' },
    { tiflo_type: 'video', tiflo_url: 'https://example.com/not-youtube' },
    { tiflo_type: 'video' }
  ]) {
    assert.deepEqual(normalizeNotificationDestination(payload), { type: 'general' });
  }
});

test('resource and download require safe URLs', () => {
  assert.deepEqual(
    normalizeNotificationDestination({ tiflo_type: 'resource', tiflo_id: 'resource-1', tiflo_url: 'https://example.com/r' }),
    { type: 'resource', id: 'resource-1', url: 'https://example.com/r', title: '' }
  );
  assert.equal(normalizeNotificationDestination({ tiflo_type: 'download', tiflo_url: 'https://example.com/d.zip' }).type, 'download');
  assert.deepEqual(normalizeNotificationDestination({ tiflo_type: 'download' }), { type: 'general' });
});

test('non-string and oversized values are rejected or bounded safely', () => {
  assert.deepEqual(normalizeNotificationDestination({ tiflo_type: { bad: true }, tiflo_url: 'https://example.com' }), { type: 'general' });
  assert.deepEqual(normalizeNotificationDestination({ tiflo_type: 'news', tiflo_url: 'x'.repeat(3000) }), { type: 'general' });
  const result = normalizeNotificationDestination({ tiflo_type: 'news', tiflo_url: 'https://example.com', tiflo_title: 't'.repeat(500) });
  assert.equal(result.title.length, 200);
});
```

- [ ] **Step 2: Run the parser test and verify failure**

```bash
cd mobile
node --test test/notification-destination.test.mjs
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the parser**

Create `mobile/src/core/notification-destination.mjs`:

```js
import { youtubeVideoId } from './share-classifier.mjs';

const TYPES = new Set(['general', 'news', 'video', 'resource', 'download']);

function text(value, max = 200) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function safeHttpUrl(value) {
  const raw = text(value, 2048);
  if (!raw) return '';
  try {
    const url = new URL(raw);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : '';
  } catch {
    return '';
  }
}

function validYoutubeId(value) {
  const id = text(value, 32);
  return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : '';
}

export function normalizeNotificationDestination(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { type: 'general' };

  const type = text(value.tiflo_type, 32).toLowerCase();
  if (!TYPES.has(type) || type === 'general') return { type: 'general' };

  const url = safeHttpUrl(value.tiflo_url);
  const title = text(value.tiflo_title, 200);
  const rawId = text(value.tiflo_id, 200);

  if (type === 'video') {
    const id = validYoutubeId(rawId) || youtubeVideoId(url);
    if (!id) return { type: 'general' };
    return { type, id, url, title };
  }

  if (!url) return { type: 'general' };
  if (type === 'resource') return { type, id: rawId, url, title };
  return { type, url, title };
}
```

- [ ] **Step 4: Run the parser test**

```bash
cd mobile
node --test test/notification-destination.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/core/notification-destination.mjs mobile/test/notification-destination.test.mjs
git commit -m "feat: validate notification destinations"
```

---

### Task 3: Queue cold-start clicks and map destinations to existing app actions

**Files:**
- Create: `mobile/src/core/notification-coordinator.mjs`
- Create: `mobile/src/core/notification-router.mjs`
- Test: `mobile/test/notification-coordinator.test.mjs`
- Test: `mobile/test/notification-router.test.mjs`

**Interfaces:**
- Consumes: normalized destination objects from Task 2.
- Produces: `createNotificationCoordinator({ route })` with `receive(destination)` and `markReady()`.
- Produces: `createNotificationRouter(actions)` returning `route(destination)`.

- [ ] **Step 1: Write failing coordinator tests**

Create `mobile/test/notification-coordinator.test.mjs`:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { createNotificationCoordinator } from '../src/core/notification-coordinator.mjs';

test('cold-start destination waits until app is ready', async () => {
  const seen = [];
  const coordinator = createNotificationCoordinator({ route: async destination => seen.push(destination) });
  await coordinator.receive({ type: 'news', url: 'https://example.com/a', title: '' });
  assert.deepEqual(seen, []);
  await coordinator.markReady();
  assert.equal(seen.length, 1);
  assert.equal(seen[0].type, 'news');
});

test('only the most recent pre-ready click is consumed once', async () => {
  const seen = [];
  const coordinator = createNotificationCoordinator({ route: async destination => seen.push(destination) });
  await coordinator.receive({ type: 'general' });
  await coordinator.receive({ type: 'download', url: 'https://example.com/a.zip', title: '' });
  await coordinator.markReady();
  await coordinator.markReady();
  assert.deepEqual(seen, [{ type: 'download', url: 'https://example.com/a.zip', title: '' }]);
});
```

- [ ] **Step 2: Write failing router tests**

Create `mobile/test/notification-router.test.mjs`:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { createNotificationRouter } from '../src/core/notification-router.mjs';

function harness() {
  const calls = [];
  const route = createNotificationRouter({
    home: () => calls.push(['home']),
    news: destination => calls.push(['news', destination]),
    video: destination => calls.push(['video', destination]),
    resource: destination => calls.push(['resource', destination]),
    download: destination => calls.push(['download', destination])
  });
  return { route, calls };
}

test('known destinations dispatch exactly one matching action', async () => {
  for (const type of ['news', 'video', 'resource', 'download']) {
    const { route, calls } = harness();
    await route({ type, url: 'https://example.com', id: 'qYvoYsQZNbQ', title: 'x' });
    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], type);
  }
});

test('general unknown and null destinations go Home', async () => {
  for (const destination of [{ type: 'general' }, { type: 'mystery' }, null]) {
    const { route, calls } = harness();
    await route(destination);
    assert.deepEqual(calls, [['home']]);
  }
});
```

- [ ] **Step 3: Run tests and verify failure**

```bash
cd mobile
node --test test/notification-coordinator.test.mjs test/notification-router.test.mjs
```

Expected: FAIL because both modules are missing.

- [ ] **Step 4: Implement the coordinator**

Create `mobile/src/core/notification-coordinator.mjs`:

```js
export function createNotificationCoordinator({ route }) {
  let ready = false;
  let pending = null;

  return {
    async receive(destination) {
      if (!ready) {
        pending = destination;
        return false;
      }
      await route(destination);
      return true;
    },

    async markReady() {
      if (ready) return false;
      ready = true;
      const destination = pending;
      pending = null;
      if (!destination) return false;
      await route(destination);
      return true;
    }
  };
}
```

- [ ] **Step 5: Implement the router**

Create `mobile/src/core/notification-router.mjs`:

```js
export function createNotificationRouter(actions) {
  return async function route(destination) {
    const type = destination?.type;
    if (type === 'news') return actions.news(destination);
    if (type === 'video') return actions.video(destination);
    if (type === 'resource') return actions.resource(destination);
    if (type === 'download') return actions.download(destination);
    return actions.home();
  };
}
```

- [ ] **Step 6: Run tests**

```bash
cd mobile
node --test test/notification-coordinator.test.mjs test/notification-router.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add mobile/src/core/notification-coordinator.mjs mobile/src/core/notification-router.mjs mobile/test/notification-coordinator.test.mjs mobile/test/notification-router.test.mjs
git commit -m "feat: route native notification destinations"
```

---

### Task 4: Implement a failure-safe OneSignal adapter

**Files:**
- Create: `mobile/src/native/onesignal-notifications.mjs`
- Test: `mobile/test/onesignal-notifications.test.mjs`
- Existing test retained: `mobile/test/native-notifications.test.mjs`

**Interfaces:**
- Consumes: OneSignal default export from `@onesignal/capacitor-plugin`.
- Consumes: `normalizeNotificationDestination(additionalData)` from Task 2.
- Produces: `createOneSignalNotifications({ sdk, appId, onDestination, getLanguage })` with:
  - `start(): Promise<boolean>`
  - `setLanguage(lang): Promise<boolean>`
  - `adapter.status(): Promise<'unavailable'|'not-requested'|'denied'|'authorized'>`
  - `adapter.request(): Promise<'unavailable'|'not-requested'|'denied'|'authorized'>`
  - `adapter.openSettings(): Promise<boolean>`

- [ ] **Step 1: Write failing adapter tests**

Create `mobile/test/onesignal-notifications.test.mjs`:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { createOneSignalNotifications } from '../src/native/onesignal-notifications.mjs';

function fakeSdk({ permission = false, canRequest = true, initializeFails = false } = {}) {
  const calls = [];
  let clickListener = null;
  const sdk = {
    initialize: async appId => {
      calls.push(['initialize', appId]);
      if (initializeFails) throw new Error('offline');
    },
    User: {
      addTag: async (key, value) => calls.push(['tag', key, value]),
      setLanguage: async language => calls.push(['language', language])
    },
    Notifications: {
      hasPermission: async () => permission,
      canRequestPermission: async () => canRequest,
      requestPermission: async fallback => {
        calls.push(['requestPermission', fallback]);
        return permission;
      },
      addEventListener: (name, listener) => {
        calls.push(['listener', name]);
        if (name === 'click') clickListener = listener;
      }
    }
  };
  return { sdk, calls, click: event => clickListener?.(event) };
}

function client(fake, onDestination = async () => {}) {
  return createOneSignalNotifications({
    sdk: fake.sdk,
    appId: 'app-id',
    onDestination,
    getLanguage: () => 'es'
  });
}

test('startup initializes OneSignal and tags Android without requesting permission', async () => {
  const fake = fakeSdk();
  assert.equal(await client(fake).start(), true);
  assert.deepEqual(fake.calls.filter(call => call[0] === 'requestPermission'), []);
  assert.deepEqual(fake.calls.find(call => call[0] === 'tag'), ['tag', 'tiflo_client', 'android_app']);
});

test('status distinguishes not requested denied and authorized', async () => {
  assert.equal(await client(fakeSdk({ permission: false, canRequest: true })).adapter.status(), 'not-requested');
  assert.equal(await client(fakeSdk({ permission: false, canRequest: false })).adapter.status(), 'denied');
  assert.equal(await client(fakeSdk({ permission: true, canRequest: false })).adapter.status(), 'authorized');
});

test('explicit activation requests permission without forcing settings fallback', async () => {
  const fake = fakeSdk({ permission: false, canRequest: false });
  await client(fake).adapter.request();
  assert.deepEqual(fake.calls.find(call => call[0] === 'requestPermission'), ['requestPermission', false]);
});

test('explicit open settings action enables OneSignal fallback-to-settings', async () => {
  const fake = fakeSdk({ permission: false, canRequest: false });
  assert.equal(await client(fake).adapter.openSettings(), true);
  assert.deepEqual(fake.calls.find(call => call[0] === 'requestPermission'), ['requestPermission', true]);
});

test('click listener normalizes additional data before handing it to the app', async () => {
  const fake = fakeSdk();
  const seen = [];
  const notifications = client(fake, async destination => seen.push(destination));
  await notifications.start();
  fake.click({ notification: { additionalData: { tiflo_type: 'video', tiflo_id: 'qYvoYsQZNbQ' } } });
  await Promise.resolve();
  assert.deepEqual(seen[0], { type: 'video', id: 'qYvoYsQZNbQ', url: '', title: '' });
});

test('initialization failure is contained and reports unavailable', async () => {
  const notifications = client(fakeSdk({ initializeFails: true }));
  assert.equal(await notifications.start(), false);
  assert.equal(await notifications.adapter.status(), 'unavailable');
  assert.equal(await notifications.adapter.request(), 'unavailable');
  assert.equal(await notifications.adapter.openSettings(), false);
});
```

- [ ] **Step 2: Run tests and verify failure**

```bash
cd mobile
node --test test/onesignal-notifications.test.mjs test/native-notifications.test.mjs
```

Expected: FAIL because the OneSignal adapter module does not exist.

- [ ] **Step 3: Implement the adapter**

Create `mobile/src/native/onesignal-notifications.mjs`:

```js
import { normalizeNotificationDestination } from '../core/notification-destination.mjs';

async function permissionState(sdk) {
  if (await sdk.Notifications.hasPermission()) return 'authorized';
  return (await sdk.Notifications.canRequestPermission()) ? 'not-requested' : 'denied';
}

export function createOneSignalNotifications({ sdk, appId, onDestination, getLanguage }) {
  let startPromise = null;
  let available = null;

  async function start() {
    if (!startPromise) {
      startPromise = (async () => {
        try {
          await sdk.initialize(appId);
          await sdk.User.addTag('tiflo_client', 'android_app');
          const language = getLanguage?.();
          if (language) await sdk.User.setLanguage(language);
          sdk.Notifications.addEventListener('click', event => {
            const destination = normalizeNotificationDestination(event?.notification?.additionalData);
            void onDestination(destination);
          });
          available = true;
          return true;
        } catch {
          available = false;
          return false;
        }
      })();
    }
    return startPromise;
  }

  async function ready() {
    if (available === true) return true;
    if (available === false) return false;
    return start();
  }

  return {
    start,
    async setLanguage(language) {
      if (!await ready()) return false;
      try {
        await sdk.User.setLanguage(language);
        return true;
      } catch {
        return false;
      }
    },
    adapter: {
      async status() {
        if (!await ready()) return 'unavailable';
        try {
          return await permissionState(sdk);
        } catch {
          return 'unavailable';
        }
      },
      async request() {
        if (!await ready()) return 'unavailable';
        try {
          await sdk.Notifications.requestPermission(false);
          return await permissionState(sdk);
        } catch {
          return 'unavailable';
        }
      },
      async openSettings() {
        if (!await ready()) return false;
        try {
          await sdk.Notifications.requestPermission(true);
          return true;
        } catch {
          return false;
        }
      }
    }
  };
}
```

Do not add a foreground interception handler in this release; allow OneSignal/Android to display notifications normally.

- [ ] **Step 4: Run adapter and existing notification tests**

```bash
cd mobile
node --test test/onesignal-notifications.test.mjs test/native-notifications.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/native/onesignal-notifications.mjs mobile/test/onesignal-notifications.test.mjs
git commit -m "feat: add OneSignal notification adapter"
```

---

### Task 5: Wire notifications into app startup, routing, language, and Settings recovery

**Files:**
- Modify: `mobile/src/app.mjs`
- Modify: `mobile/src/screens/settings.mjs`
- Test: `mobile/test/notification-app-integration.test.mjs`
- Modify: `mobile/test/native-notifications.test.mjs`

**Interfaces:**
- Consumes: modules from Tasks 2–4.
- Produces: notification click behavior using existing `openReadableFromApp`, accessible direct video playback, `nativeActions.openExternal`, `openNormalDownload`, and Home.

- [ ] **Step 1: Write the failing integration tests**

Create `mobile/test/notification-app-integration.test.mjs`:

```js
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('app wires OneSignal through app-owned notification layers', async () => {
  const app = await read('src/app.mjs');
  assert.match(app, /@onesignal\/capacitor-plugin/);
  assert.match(app, /createOneSignalNotifications/);
  assert.match(app, /createNotificationRouter/);
  assert.match(app, /createNotificationCoordinator/);
  assert.doesNotMatch(app, /const notificationService = createNotificationService\(null\)/);
});

test('notification routing reuses existing news video resource and download behavior', async () => {
  const app = await read('src/app.mjs');
  assert.match(app, /openReadableFromApp/);
  assert.match(app, /pendingDirectVideo/);
  assert.match(app, /nativeActions\.openExternal/);
  assert.match(app, /openNormalDownload/);
});

test('app startup contains OneSignal failure and marks routing ready after Home exists', async () => {
  const app = await read('src/app.mjs');
  assert.match(app, /void oneSignalNotifications\.start\(\)/);
  assert.match(app, /router\.start\(['"]home['"]\)/);
  assert.match(app, /notificationCoordinator\.markReady\(\)/);
});
```

Extend `mobile/test/native-notifications.test.mjs` with:

```js
test('returning from the explicit system-settings action refreshes notification state', async () => {
  const settings = await read('src/screens/settings.mjs');
  assert.match(settings, /await notificationService\.openSystemSettings\(\)/);
  assert.match(settings, /await renderState\(\)/);
});
```

- [ ] **Step 2: Run focused tests and verify failure**

```bash
cd mobile
node --test test/notification-app-integration.test.mjs test/native-notifications.test.mjs
```

Expected: FAIL because `app.mjs` still exposes an unavailable service and Settings does not refresh after returning from Android settings.

- [ ] **Step 3: Add imports and mutable notification service/client references in `app.mjs`**

Add:

```js
import OneSignal from '@onesignal/capacitor-plugin';
import { createNotificationCoordinator } from './core/notification-coordinator.mjs';
import { createNotificationRouter } from './core/notification-router.mjs';
import { createOneSignalNotifications } from './native/onesignal-notifications.mjs';
```

Near current storage/service setup use:

```js
const ONESIGNAL_APP_ID = 'ed030723-7f6f-4745-8cd3-6938a9d04377';
let notificationService = createNotificationService(null);
let oneSignalNotifications = null;
```

This keeps `render()` safe before the native client is wired and avoids constructing notification routing before `router` exists.

- [ ] **Step 4: Create notification routing after `router` exists and before startup**

After the `router` declaration and before `router.start('home')`, create:

```js
const routeNotification = createNotificationRouter({
  home: () => {
    router.start('home');
    return true;
  },
  news: destination => openReadableFromApp({
    url: destination.url,
    title: destination.title,
    originId: '',
    allowOriginalFallback: true
  }),
  video: destination => {
    pendingDirectVideo = {
      videoId: destination.id,
      url: destination.url,
      title: destination.title
    };
    router.navigate('direct-video');
    return true;
  },
  resource: destination => nativeActions.openExternal(destination.url),
  download: destination => openNormalDownload(destination.url)
});

const notificationCoordinator = createNotificationCoordinator({ route: routeNotification });
oneSignalNotifications = createOneSignalNotifications({
  sdk: OneSignal,
  appId: ONESIGNAL_APP_ID,
  onDestination: destination => notificationCoordinator.receive(destination),
  getLanguage: () => preferencesStore.getCurrent().lang
});
notificationService = createNotificationService(oneSignalNotifications.adapter);
```

- [ ] **Step 5: Make cold-start ordering explicit**

Replace the current startup trio with this order:

```js
void oneSignalNotifications.start();
router.start('home');
void notificationCoordinator.markReady();
void installShareReceiver();
```

If OneSignal delivers a retained cold-start click before Home is ready, the coordinator keeps the latest destination and consumes it once after `markReady()`.

- [ ] **Step 6: Synchronize OneSignal language without changing focus behavior**

Inside `onPreferencesChange`, after calculating `after`:

```js
if (before.lang !== after.lang || reset) {
  void oneSignalNotifications?.setLanguage(after.lang);
}
```

Keep the existing rerender and `restoreOriginFocus` behavior unchanged.

- [ ] **Step 7: Refresh Settings after returning from Android notification settings**

Change only the denied-state button handler in `mobile/src/screens/settings.mjs` to:

```js
settings.addEventListener('click', async () => {
  settings.disabled = true;
  await notificationService.openSystemSettings();
  await renderState();
});
```

The live region already present on the screen remains responsible for announcing the resulting status.

- [ ] **Step 8: Run focused and full mobile verification**

```bash
cd mobile
node --test test/notification-app-integration.test.mjs test/notification-destination.test.mjs test/notification-coordinator.test.mjs test/notification-router.test.mjs test/onesignal-notifications.test.mjs test/native-notifications.test.mjs
npm test
npm run build
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add mobile/src/app.mjs mobile/src/screens/settings.mjs mobile/test/notification-app-integration.test.mjs mobile/test/native-notifications.test.mjs
git commit -m "feat: open Android notifications in TifloAcosta"
```

---

### Task 6: Configure Firebase Cloud Messaging V1 in the existing OneSignal app

**Files:**
- No repository files.
- The Firebase Service Account private key stays outside GitHub and outside application source.

**Interfaces:**
- Consumes: a Firebase project associated with Android package `com.tifloacosta.app`.
- Consumes: Firebase Service Account private key with `cloudmessaging.messages.create` and `firebase.projects.get` permissions.
- Produces: Google Android (FCM) enabled inside the existing OneSignal TifloAcosta application.

- [ ] **Step 1: Open or create the Firebase project used for TifloAcosta Android**

In Firebase Console, ensure the project represents the Android app whose package is:

```text
com.tifloacosta.app
```

No `google-services.json` needs to be added to this repository solely for OneSignal.

- [ ] **Step 2: Verify Firebase Cloud Messaging API V1 is enabled**

In Firebase Console:

```text
Project settings > Cloud Messaging
```

Confirm Firebase Cloud Messaging API (V1) is Enabled. If it is disabled, use the three-dot menu > Manage API in Google Cloud Console > Enable.

- [ ] **Step 3: Generate a Firebase Service Account private key**

In Firebase Console:

```text
Project settings > Service accounts > Generate new private key > Generate key
```

Store the downloaded JSON privately. Do not add it to the repository or paste its contents into source code.

If OneSignal rejects the key for insufficient permissions, verify in Google Cloud IAM that the service account has:

```text
Firebase Cloud Messaging API Admin (roles/firebasecloudmessaging.admin)
Firebase Viewer (roles/firebase.viewer)
```

- [ ] **Step 4: Attach FCM V1 credentials to the existing OneSignal application**

In the existing TifloAcosta OneSignal app:

```text
Settings > Push & In-App > Platforms > Google Android (FCM)
```

Choose Activate on first setup or Settings if Android is already present, select the Firebase Service Account JSON file, then choose Save & Continue.

The OneSignal App ID remains:

```text
ed030723-7f6f-4745-8cd3-6938a9d04377
```

Do not create a second OneSignal application.

- [ ] **Step 5: Confirm platform setup before release testing**

OneSignal must show Google Android (FCM) configured successfully. Web Push configuration must remain present and unchanged.

---

### Task 7: Verify the Android build and real notification behavior

**Files:**
- No source changes unless a failure is reproduced by an automated test first.

**Interfaces:**
- Consumes OneSignal additional data keys: `tiflo_type`, `tiflo_id`, `tiflo_url`, `tiflo_title`.
- Produces verified Android subscriptions and direct navigation behavior.

- [ ] **Step 1: Build Android with the OneSignal location module excluded**

```bash
cd mobile
ONESIGNAL_DISABLE_LOCATION=true npx cap sync android
cd android
ONESIGNAL_DISABLE_LOCATION=true ./gradlew --no-daemon assembleDebug
```

Expected: Gradle PASS.

Inspect the merged manifest for Android notification permission support:

```bash
grep -R "android.permission.POST_NOTIFICATIONS" app/build/intermediates/merged_manifest* app/build/intermediates/merged_manifests 2>/dev/null
```

Expected on modern SDK integration: `android.permission.POST_NOTIFICATIONS` is present in the merged manifest.

- [ ] **Step 2: Verify permission behavior on a fresh physical Android install**

1. Install the build on an Android device with Google Play Services.
2. Launch TifloAcosta: no notification permission prompt appears automatically.
3. Open Configuración > Notificaciones.
4. Activate notifications using the explicit button.
5. Grant permission.
6. Re-enter Configuración > Notificaciones and confirm authorized state.
7. In OneSignal, open Audience > Subscriptions and confirm an Android Push subscription is now subscribed.
8. Confirm the Android user has `tiflo_client=android_app` as a secondary tag.
9. Confirm Web Push subscriptions remain separately identifiable by subscription/device type.

- [ ] **Step 3: Verify denial and recovery through Android settings**

1. On a clean permission state, deny notification permission.
2. Confirm TifloAcosta reports the denied/blocked state.
3. Activate `Abrir ajustes del sistema`.
4. Enable notifications in Android settings.
5. Return to TifloAcosta.
6. Confirm the Settings status refreshes to authorized without forcing focus to an unrelated control.

- [ ] **Step 4: Get a current real news URL and video ID from the mobile feed**

Run from repository root:

```bash
node --input-type=module -e "import fs from 'node:fs'; const c=JSON.parse(fs.readFileSync('mobile-content.json','utf8')); console.log('NEWS', c.news?.find(x=>/^https?:/.test(x.originalUrl||x.url||''))?.originalUrl || c.news?.find(x=>/^https?:/.test(x.url||''))?.url); console.log('VIDEO', c.videos?.find(x=>/^[A-Za-z0-9_-]{11}$/.test(String(x.id||'')))?.id);"
```

Use the printed current values for the next tests rather than inventing a stale destination.

- [ ] **Step 5: Send a general Android-only test notification**

Target only the Android Push test subscription/device type.

Expected: tapping opens TifloAcosta Home exactly once.

- [ ] **Step 6: Send a news notification with the current URL printed in Step 4**

Additional data structure:

```json
{
  "tiflo_type": "news",
  "tiflo_url": "THE_CURRENT_NEWS_URL_PRINTED_IN_STEP_4",
  "tiflo_title": "Prueba de noticia"
}
```

In the OneSignal dashboard, paste the exact URL printed by the command into `tiflo_url` rather than the descriptive token shown above.

Expected: tapping enters the existing clean-reader flow. Repeat once with the app foregrounded, once backgrounded, and once fully stopped.

- [ ] **Step 7: Send a video notification with the current ID printed in Step 4**

Additional data structure:

```json
{
  "tiflo_type": "video",
  "tiflo_id": "THE_CURRENT_VIDEO_ID_PRINTED_IN_STEP_4",
  "tiflo_title": "Prueba de vídeo"
}
```

In the OneSignal dashboard, paste the exact 11-character ID printed by the command into `tiflo_id`.

Expected: tapping opens the existing accessible in-app video player.

- [ ] **Step 8: Send resource, download, and unsafe-destination tests**

Resource:

```json
{
  "tiflo_type": "resource",
  "tiflo_url": "https://tifloacosta.com/",
  "tiflo_title": "Prueba de recurso"
}
```

Download:

```json
{
  "tiflo_type": "download",
  "tiflo_url": "https://example.com/test.zip",
  "tiflo_title": "Prueba de descarga"
}
```

Unsafe destination:

```json
{
  "tiflo_type": "news",
  "tiflo_url": "javascript:alert(1)"
}
```

Expected: resource uses the existing external/resource behavior; download enters the existing link-analysis flow; unsafe destination falls back to Home and opens no unsafe URL.

- [ ] **Step 9: Accessibility verification**

Use more than one Android screen reader where practical. Verify:

- notification title/body are understandable when spoken;
- Configuración > Notificaciones controls are announced with meaningful roles/names;
- status changes do not steal focus;
- opening a notification lands on the same semantic headings/navigation used by normal app navigation;
- one tap produces one navigation only.

Record any reader-specific problem as reader-specific; do not treat one screen reader as the Android accessibility baseline.

---

### Task 8: Bump Android beta to 1.2.0/code 7 and run final release verification

**Files:**
- Modify: `mobile/android/app/build.gradle`
- Delete: `mobile/test/android-1.1.0-release.test.mjs`
- Create: `mobile/test/android-1.2.0-release.test.mjs`

**Interfaces:**
- Consumes: all prior tasks passing.
- Produces: Android beta `1.2.0`, versionCode `7`, with signed release AAB when signing secrets are present.

- [ ] **Step 1: Create the new failing release test**

Create `mobile/test/android-1.2.0-release.test.mjs` by carrying forward the native Share/web-fetch assertions from the 1.1.0 release test and changing only the version assertion to:

```js
test('integrated Android candidate is version 1.2.0 code 7', async () => {
  const gradle = await read('android/app/build.gradle');
  assert.match(gradle, /versionCode\s+7/);
  assert.match(gradle, /versionName\s+"1\.2\.0"/);
  assert.doesNotMatch(gradle, /versionCode\s+6/);
});
```

Keep this existing second test unchanged in the new file:

```js
test('release candidate includes native Share and bounded web fetch plugins', async () => {
  const manifest = await read('android/app/src/main/AndroidManifest.xml');
  const mainActivity = await read('android/app/src/main/java/com/tifloacosta/app/MainActivity.java');
  assert.match(manifest, /android\.intent\.action\.SEND/);
  assert.match(manifest, /android:mimeType="text\/plain"/);
  assert.doesNotMatch(manifest, /SEND_MULTIPLE/);
  assert.match(mainActivity, /registerPlugin\(TifloSharePlugin\.class\)/);
  assert.match(mainActivity, /registerPlugin\(TifloWebFetchPlugin\.class\)/);
});
```

Delete `mobile/test/android-1.1.0-release.test.mjs` after the new test exists.

- [ ] **Step 2: Run the new release test and verify failure**

```bash
cd mobile
node --test test/android-1.2.0-release.test.mjs
```

Expected: FAIL against current version 1.1.0/code 6.

- [ ] **Step 3: Bump Android version**

In `mobile/android/app/build.gradle` set:

```gradle
versionCode 7
versionName "1.2.0"
```

- [ ] **Step 4: Run all automated verification**

From repository root:

```bash
npm test
cd mobile
npm test
npm run build
ONESIGNAL_DISABLE_LOCATION=true npx cap sync android
cd android
ONESIGNAL_DISABLE_LOCATION=true ./gradlew --no-daemon assembleDebug bundleRelease
```

Expected: every test PASS; mobile bundle builds; Android debug APK and release AAB build successfully.

- [ ] **Step 5: Check final diff for credentials, formatting, and unintended web changes**

From repository root:

```bash
git status --short
git diff --check
git diff -- notifications.js
git ls-files | grep -E '(service-account|firebase-admin|google-services)\.json' && exit 1 || true
```

Expected: `git diff --check` has no output; root `notifications.js` has no diff; no Firebase credential JSON is tracked.

- [ ] **Step 6: Commit the release bump**

```bash
git add mobile/android/app/build.gradle mobile/test/android-1.2.0-release.test.mjs mobile/test/android-1.1.0-release.test.mjs
git commit -m "release: prepare Android 1.2.0 beta"
```

---

## Final manual accessibility and behavior checklist

Before uploading the AAB to Play Console, verify on physical Android hardware:

- Fresh install does not request notification permission on launch.
- Configuración > Notificaciones is reachable and understandable with a screen reader.
- The activation control is announced as a button with meaningful text.
- Permission state changes are announced without forcing focus elsewhere.
- Denied state exposes `Abrir ajustes del sistema` and returning from settings does not trap focus.
- Notification titles/messages are concise enough to make sense when read aloud by Android accessibility services.
- Tapping each supported notification type lands at the expected content and preserves the same heading/focus behavior as normal app navigation.
- One notification tap produces one navigation only.
- Test with more than one Android screen reader where practical and document reader-specific issues separately.

## Plan self-review

- Spec coverage: permission flow, same OneSignal app, Android/Web separation, direct routing, cold start, Home fallback, accessibility, FCM V1 platform credentials, testing, and release bump are each assigned to explicit tasks.
- Current-vendor check: OneSignal Capacitor 1.1.6 supports Capacitor 7+, uses `OneSignal.initialize(appId)`, exposes `Notifications.hasPermission()`, `canRequestPermission()`, `requestPermission(fallbackToSettings)`, click events, and User tags/language. TifloAcosta is already on Capacitor 8.5.2.
- Firebase correction: current OneSignal Android/Capacitor documentation requires FCM V1 Service Account credentials in the OneSignal dashboard; it does not require adding `google-services.json` to this repository for OneSignal. The plan therefore avoids creating a needless GitHub secret/file path.
- Player correction: the existing direct-video helper requires a valid 11-character YouTube ID, so notification parsing derives/validates that ID before routing.
- Placeholder scan: automated implementation steps contain concrete code and commands. Manual live-message steps include a command that retrieves the exact current news URL/video ID before the dashboard test rather than relying on a stale hard-coded content item.
- Type consistency: `normalizeNotificationDestination` outputs the same `type` values consumed by `createNotificationRouter`; the coordinator consumes those objects; the OneSignal adapter emits only state strings already accepted by `createNotificationService`.
- Review Focus coverage: malformed data, unsafe URL schemes, invalid video destinations, pre-ready duplicate clicks, and initialization failure each have an explicit automated test or manual verification step.
