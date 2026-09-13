# TifloAcosta Mobile Bundling Prerequisite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a minimal deterministic web build so Capacitor npm plugins can be imported by the official mobile app while preserving the existing accessible vanilla HTML/CSS/ES-module source structure.

**Architecture:** Keep all authored mobile code under `mobile/src/`. Use esbuild only as a bundling step for JavaScript and a small Node build script to copy `index.html` and `styles.css` into `mobile/dist/`. Capacitor reads only `mobile/dist/`; source files remain human-readable and testable without a browser framework.

**Tech Stack:** Node.js 22+, esbuild, Capacitor 8, native Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-13-tifloacosta-mobile-apps-design.md`

## Global Constraints

- Do not change visible navigation, copy or accessibility semantics.
- Do not touch the public root PWA.
- `mobile/src/` remains source of truth.
- `mobile/dist/` is generated and must not be manually edited.
- `npm test` must not require a native SDK.
- Capacitor sync commands must build the web bundle first.

### Task 1: Add Deterministic Mobile Web Build

**Files:**
- Create: `mobile/scripts/build.mjs`
- Create: `mobile/test/build-config.test.mjs`
- Modify: `mobile/package.json`
- Modify: `mobile/capacitor.config.json`
- Modify: `mobile/src/index.html`
- Modify: `.gitignore`

**Interfaces:**
- `npm run build` removes and recreates `mobile/dist/`, bundles `src/app.mjs` to `dist/app.js`, and copies `src/index.html` plus `src/styles.css`.
- `capacitor.config.json.webDir` becomes `dist`.
- `sync:android` and `sync:ios` run `npm run build` before `npx cap sync`.

- [ ] **Step 1: Write failing configuration test**

Assert `webDir === 'dist'`, package scripts contain `build`, both sync scripts run the build first, and `src/index.html` references `./app.js` rather than `./app.mjs`.

- [ ] **Step 2: Run test and verify failure**

Run: `cd mobile && node --test test/build-config.test.mjs`

Expected: FAIL because current config still uses `src`.

- [ ] **Step 3: Implement `scripts/build.mjs`**

Use `rm`, `mkdir`, `copyFile` from `node:fs/promises` and `build` from `esbuild`:

```js
await rm(distDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });
await build({ entryPoints: [srcApp], bundle: true, format: 'esm', platform: 'browser', outfile: distApp });
await Promise.all([
  copyFile(srcIndex, distIndex),
  copyFile(srcStyles, distStyles)
]);
```

- [ ] **Step 4: Add `esbuild` dev dependency and build-aware scripts**

```json
"build": "node scripts/build.mjs",
"sync:android": "npm run build && npx cap sync android",
"sync:ios": "npm run build && npx cap sync ios"
```

- [ ] **Step 5: Change Capacitor `webDir` to `dist` and source HTML script to `./app.js`**
- [ ] **Step 6: Ignore `mobile/dist/`**
- [ ] **Step 7: Run tests, build and sync both native projects**

Run:

```bash
cd mobile
npm install
npm test
npm run build
npm run sync:android
npm run sync:ios
```

Expected: all commands exit 0 on the macOS CI environment.

- [ ] **Step 8: Commit generated dependency lock and native sync changes**

```bash
git add mobile/package.json mobile/package-lock.json mobile/scripts mobile/test/build-config.test.mjs mobile/capacitor.config.json mobile/src/index.html mobile/android mobile/ios .gitignore
git commit -m "build: bundle mobile native modules"
```
