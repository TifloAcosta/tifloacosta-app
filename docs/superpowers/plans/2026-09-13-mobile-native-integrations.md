# TifloAcosta Native Mobile Integrations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the first native integration layer to the official TifloAcosta iOS/Android app: public-link routing, Android Back behavior, native sharing, intelligent external-app opening, system file saving, and a notification-permission integration point without disturbing the current public PWA.

**Architecture:** Build small platform-neutral adapters in `mobile/src/native/` and keep screen modules dependent only on those adapters. Use official Capacitor 8 plugins where they cover the requirement. For saving arbitrary downloaded files, use a narrow custom Capacitor plugin that presents the system document destination instead of requesting broad storage access. Domain association files for HTTPS Universal Links/App Links are completed in the store/release plan when the exact Apple Team ID and Android signing certificate fingerprints exist; this plan completes the runtime routing and native intent handling that those associations will call.

**Tech Stack:** Node.js 22+, native Node test runner, Capacitor 8, `@capacitor/app`, `@capacitor/share`, `@capacitor/app-launcher`, custom Capacitor plugin code in Swift/Java, existing vanilla HTML/CSS/ES modules.

**Spec:** `docs/superpowers/specs/2026-09-13-tifloacosta-mobile-apps-design.md`

## Global Constraints

- Public app name: `TifloAcosta`.
- Application identifier: `com.tifloacosta.app`.
- Accessibility has priority over decorative or convenience behavior.
- No permission is requested on first launch merely because the app starts.
- Public deep links use `https://tifloacosta.com/`; a development-only `tifloacosta://` scheme may be used to exercise the same runtime route parser before store credentials exist.
- A user entering from an external deep link must be able to use Back/Volver to reach TifloAcosta Home before leaving the app.
- Sharing, saving, permissions and external-app opening use native system behavior and explicit accessible text labels.
- Android Back at a secondary screen returns inside the app; at Home it may exit the app.
- No native integration may move screen-reader focus unexpectedly.
- No broad contacts, camera, microphone, location, photo-library or storage permission is introduced by this plan.
- Existing PWA behavior at `https://tifloacosta.com/` remains unchanged.

---

## File Structure Locked by This Plan

- `mobile/src/native/deep-links.mjs` — parse public/dev URLs into app routes and wire Capacitor App URL events.
- `mobile/src/native/back-button.mjs` — Android Back policy independent of DOM rendering.
- `mobile/src/native/share.mjs` — native share adapter with browser fallback.
- `mobile/src/native/external-links.mjs` — classify external URLs and use AppLauncher only when a real app scheme is known.
- `mobile/src/native/save-file.mjs` — fetch a remote file and invoke the narrow native SaveFile plugin.
- `mobile/src/native/notifications.mjs` — permission-state adapter and delayed opt-in contract; no automatic permission request.
- `mobile/test/native-*.test.mjs` — deterministic unit tests for platform-neutral policy.
- `mobile/android/app/src/main/java/com/tifloacosta/app/SaveFilePlugin.java` — Android Storage Access Framework bridge.
- `mobile/ios/App/App/SaveFilePlugin.swift` — iOS UIDocumentPicker bridge.
- Native manifests/project files — register only the development deep-link scheme and custom SaveFile plugin code required by this plan.

---

### Task 1: Parse Deep Links Into Stable App Routes

**Files:**
- Create: `mobile/src/native/deep-links.mjs`
- Create: `mobile/test/native-deep-links.test.mjs`
- Modify: `mobile/src/app.mjs`

**Interfaces:**
- Produces `parseTifloAcostaUrl(url) -> { route, params, externalEntry } | null`.
- Produces `installDeepLinkListener({ appPlugin, router, resolveRoute }) -> Promise<cleanupFn>`.
- Supported public/dev URLs in this foundation:
  - `/` -> `home`
  - `/actualidad` -> `actualidad`
  - `/buscar` or `/search` -> `search`
  - `/biblioteca` or `/library` -> `library`
  - `/favoritos` or `/favorites` -> `favorites`
  - `/videos` -> `videos`
  - `/libro` or `/book` -> `book`
  - `/podcast` -> `podcast`
  - `/contacto` or `/contact` -> `contact`
  - `/configuracion` or `/settings` -> `settings`
- Unknown `tifloacosta.com` paths return Home rather than leaving the user in a dead route.
- Non-TifloAcosta HTTPS URLs return `null`.

- [ ] **Step 1: Write the failing parser tests**

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { parseTifloAcostaUrl } from '../src/native/deep-links.mjs';

test('public TifloAcosta links map to app routes', () => {
  assert.equal(parseTifloAcostaUrl('https://tifloacosta.com/actualidad').route, 'actualidad');
  assert.equal(parseTifloAcostaUrl('https://tifloacosta.com/library').route, 'library');
  assert.equal(parseTifloAcostaUrl('https://tifloacosta.com/').route, 'home');
});

test('development scheme uses the same route parser', () => {
  assert.equal(parseTifloAcostaUrl('tifloacosta://actualidad').route, 'actualidad');
});

test('foreign links are not treated as internal deep links', () => {
  assert.equal(parseTifloAcostaUrl('https://example.com/actualidad'), null);
});
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `cd mobile && node --test test/native-deep-links.test.mjs`

Expected: FAIL because `deep-links.mjs` does not exist.

- [ ] **Step 3: Implement the pure parser**

Use `new URL(url)`, normalize pathname to lower case without trailing slash, accept hostname `tifloacosta.com` and scheme `tifloacosta:` only, and return `{ route, params: {}, externalEntry: true }`.

- [ ] **Step 4: Add listener wiring without importing native plugins into tests**

```js
export async function installDeepLinkListener({ appPlugin, router, resolveRoute = parseTifloAcostaUrl }) {
  const open = value => {
    const target = resolveRoute(value);
    if (!target) return false;
    router.enterExternal(target.route);
    return true;
  };
  const launch = await appPlugin.getLaunchUrl();
  if (launch?.url) open(launch.url);
  const handle = await appPlugin.addListener('appUrlOpen', event => open(event.url));
  return () => handle.remove();
}
```

- [ ] **Step 5: Extend router contract for external entry**

Add `enterExternal(route)` to `router.mjs`: replace the stack with a synthetic Home record followed by the requested route unless requested route is Home. Back from that route therefore returns to Home.

- [ ] **Step 6: Add router tests for external-entry Back behavior**

Assert `enterExternal('library')`, then `back()`, leaves `current().name === 'home'`.

- [ ] **Step 7: Wire `@capacitor/app` only in `app.mjs`**

Dynamically import `@capacitor/app` inside startup and install the listener. Failure to load a native plugin in a plain browser must not prevent the app from starting.

- [ ] **Step 8: Run mobile tests**

Run: `cd mobile && npm test`

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add mobile/src/native/deep-links.mjs mobile/src/core/router.mjs mobile/src/app.mjs mobile/test/native-deep-links.test.mjs mobile/test/navigation.test.mjs
git commit -m "feat: route native deep links"
```

---

### Task 2: Implement Native Android Back Policy

**Files:**
- Create: `mobile/src/native/back-button.mjs`
- Create: `mobile/test/native-back-button.test.mjs`
- Modify: `mobile/src/app.mjs`
- Modify: `mobile/capacitor.config.json`

**Interfaces:**
- Produces `createBackButtonHandler({ router, appPlugin }) -> () => Promise<void>`.

- [ ] **Step 1: Write failing policy tests**

Test that a secondary route calls `router.back()` and never exits; Home calls `appPlugin.exitApp()` only when `router.back()` returns false.

- [ ] **Step 2: Run focused test and verify failure**

Run: `cd mobile && node --test test/native-back-button.test.mjs`

Expected: FAIL because module is missing.

- [ ] **Step 3: Implement policy**

```js
export function createBackButtonHandler({ router, appPlugin }) {
  return async function handleBack() {
    if (router.back()) return;
    await appPlugin.exitApp();
  };
}
```

- [ ] **Step 4: Configure Capacitor App back handling explicitly**

Set `plugins.App.disableBackButtonHandler` to `true` and register one `backButton` listener in `app.mjs` so behavior is owned by TifloAcosta rather than duplicated.

- [ ] **Step 5: Run mobile tests and sync Android**

Run:

```bash
cd mobile
npm test
npx cap sync android
```

Expected: PASS and sync exits 0.

- [ ] **Step 6: Commit**

```bash
git add mobile/src/native/back-button.mjs mobile/test/native-back-button.test.mjs mobile/src/app.mjs mobile/capacitor.config.json mobile/android
git commit -m "feat: add native Android back behavior"
```

---

### Task 3: Add Native System Sharing

**Files:**
- Create: `mobile/src/native/share.mjs`
- Create: `mobile/test/native-share.test.mjs`
- Modify: `mobile/package.json`
- Modify: content screens that expose a share action.

**Interfaces:**
- Produces `createShareService({ sharePlugin, navigatorObj })` with `shareLink({ title, text, url })`.
- Native path uses `Share.share`; browser fallback uses `navigator.share` when available; otherwise returns `{ shared:false }` without inventing clipboard behavior in the official app.

- [ ] **Step 1: Write failing native/fallback tests**
- [ ] **Step 2: Run focused test and verify failure**
- [ ] **Step 3: Implement service with dependency injection**
- [ ] **Step 4: Install `@capacitor/share` matching Capacitor major 8 and sync platforms**

Run:

```bash
cd mobile
npm install @capacitor/share@^8
npx cap sync android
npx cap sync ios
```

- [ ] **Step 5: Add explicit bilingual `Compartir` / `Share` controls to resources, videos and news only where a public URL exists**
- [ ] **Step 6: Run full mobile tests**
- [ ] **Step 7: Commit**

```bash
git add mobile
 git commit -m "feat: share mobile content natively"
```

---

### Task 4: Open External Apps Intelligently Without Hijacking Ordinary Web Links

**Files:**
- Create: `mobile/src/native/external-links.mjs`
- Create: `mobile/test/native-external-links.test.mjs`
- Modify: `mobile/package.json`
- Modify: `mobile/ios/App/App/Info.plist`
- Modify: `mobile/android/app/src/main/AndroidManifest.xml`
- Modify: Podcast, Contact, Book and video link handlers.

**Interfaces:**
- Produces `classifyExternalTarget(url) -> { kind, appUrl, webUrl }`.
- Recognized schemes are limited to targets actually used by TifloAcosta: `mailto:`, `https://wa.me/`, YouTube, Spotify and the podcast/store URLs already present in app content.
- HTTPS remains the fallback. The app never claims a specific third-party app is installed unless `AppLauncher.canOpenUrl` confirms it.

- [ ] **Step 1: Write failing classification tests**
- [ ] **Step 2: Implement deterministic classification with HTTPS fallback**
- [ ] **Step 3: Install `@capacitor/app-launcher@^8` and sync**
- [ ] **Step 4: Add only the iOS query schemes and Android `<queries>` entries actually used by the classifier**
- [ ] **Step 5: Add `openExternal` adapter: try confirmed app URL, otherwise open HTTPS/system URL**
- [ ] **Step 6: Run tests and native sync**
- [ ] **Step 7: Commit**

```bash
git add mobile
git commit -m "feat: open external services intelligently"
```

---

### Task 5: Save Downloaded Files Through System Document UI

**Files:**
- Create: `mobile/src/native/save-file.mjs`
- Create: `mobile/test/native-save-file.test.mjs`
- Create: `mobile/android/app/src/main/java/com/tifloacosta/app/SaveFilePlugin.java`
- Create: `mobile/ios/App/App/SaveFilePlugin.swift`
- Modify native registration files only as required by Capacitor 8 plugin discovery.

**Interfaces:**
- JS service: `saveRemoteFile({ url, suggestedName, fetchFn, nativeSave })`.
- Native plugin method: `SaveFile.save({ base64Data, fileName, mimeType }) -> Promise<{saved:boolean}>`.
- Android implementation uses `ACTION_CREATE_DOCUMENT` with `CATEGORY_OPENABLE`; no broad storage permission.
- iOS implementation writes a temporary file in the app cache and presents `UIDocumentPickerViewController(forExporting:)`; no photo-library permission.

- [ ] **Step 1: Write failing JS tests for successful fetch, HTTP failure and native cancellation**
- [ ] **Step 2: Implement pure JS fetch/base64 adapter**
- [ ] **Step 3: Implement Android custom plugin using Storage Access Framework**
- [ ] **Step 4: Implement iOS custom plugin using UIDocumentPicker**
- [ ] **Step 5: Add bilingual `Guardar archivo` / `Save file` controls only for downloadable resource URLs**
- [ ] **Step 6: Build/sync native projects and run tests**
- [ ] **Step 7: Commit**

```bash
git add mobile
git commit -m "feat: save files with system picker"
```

---

### Task 6: Add Delayed Notification Opt-In Contract

**Files:**
- Create: `mobile/src/native/notifications.mjs`
- Create: `mobile/test/native-notifications.test.mjs`
- Modify: `mobile/src/screens/settings.mjs`
- Modify: `mobile/src/core/i18n.mjs`

**Interfaces:**
- Produces `createNotificationService(adapter)` with `status()`, `requestFromUserAction()` and `openSystemSettings()`.
- Startup must call only `status()`; it must never call `requestFromUserAction()`.
- Settings shows a short explanation and an explicit activation button only when state permits.

- [ ] **Step 1: Write failing tests proving startup cannot request permission**
- [ ] **Step 2: Implement permission-state service around an injected adapter**
- [ ] **Step 3: Add accessible Settings UI states: unavailable, not requested, denied, authorized**
- [ ] **Step 4: Add OneSignal native adapter only after exact current SDK setup is verified and buildable; keep the permission service independent of OneSignal**
- [ ] **Step 5: Run mobile tests**
- [ ] **Step 6: Commit**

```bash
git add mobile/src/native/notifications.mjs mobile/test/native-notifications.test.mjs mobile/src/screens/settings.mjs mobile/src/core/i18n.mjs
git commit -m "feat: add notification opt-in contract"
```

---

### Task 7: Native Integration Regression Gate

**Files:**
- Create: `mobile/test/native-integration-shell.test.mjs`
- Modify: `README.txt`

**Interfaces:**
- Test source text and exported adapters for these invariants: no startup notification permission request, no broad Android storage permission, no location/camera/microphone/contact permission, one Android Back listener, deep-link parser accepts public domain, share/save labels exist in Spanish and English.

- [ ] **Step 1: Write the regression gate**
- [ ] **Step 2: Run all root and mobile tests**

Run:

```bash
npm test
cd mobile && npm test
```

Expected: all PASS.

- [ ] **Step 3: Sync both native projects**

Run:

```bash
cd mobile
npx cap sync android
npx cap sync ios
```

Expected: both exit 0.

- [ ] **Step 4: Update README with native-integration development notes and the credential-dependent association-file boundary**
- [ ] **Step 5: Commit**

```bash
git add mobile README.txt
git commit -m "test: gate native mobile integrations"
```

---

## Self-Review Against the Approved Spec

This plan implements the runtime/native behavior approved for first-version deep links, Android Back, sharing, saving, external-app opening and delayed notification permission. It deliberately does not invent Apple Team IDs, APNs credentials, Android signing fingerprints or Google Play values. Public HTTPS association files and production push credentials therefore remain in the store/release layer, where those exact identifiers are available.

No task adds a broad sensitive permission. System pickers and native sheets are preferred so VoiceOver/TalkBack users receive platform-standard controls and announcements. The app keeps one clean semantic interface; native services are adapters rather than duplicated screen implementations.