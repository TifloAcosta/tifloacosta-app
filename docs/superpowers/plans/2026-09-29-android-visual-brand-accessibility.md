# TifloAcosta Android Visual and Brand Accessibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the Android app a coherent TifloAcosta visual identity while fixing safe-area collisions, cramped controls, weak section spacing, Contact layout, and the missing Privacy and Accessibility section without regressing TalkBack.

**Architecture:** Build one reusable mobile design layer instead of patching screens independently. Reuse the web brand palette and existing TifloAcosta symbol, add shared screen-header/action-group/card primitives, then migrate all screens to those primitives. Visual changes remain semantic-neutral: native buttons/links/headings stay intact and decorative branding is hidden from accessibility services.

**Tech Stack:** ES modules; CSS custom properties; existing Capacitor WebView; Node 22 `node:test`; Android WebView safe-area environment variables; existing preferences/theme system.

**Spec:** `docs/superpowers/specs/2026-09-29-android-visual-brand-accessibility-design.md`

## Global Constraints

- The mobile app must respect `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)` plus additional visual breathing room.
- Brand colors are based on web values `#A61B1B` and `#7F1414`, adapted for light/dark/high-contrast modes.
- Color is never the only status cue.
- TalkBack semantics, heading hierarchy, focus order, and native controls must not regress.
- Large text may wrap; fixed heights must not clip content.
- No screen should require horizontal scrolling for normal use.
- The existing web app is a brand reference, not a layout template.
- The visual base must land before Voices/OCR/Translation UI work.

## Review Focus

- Devices where safe-area variables resolve to zero still need top spacing.
- Very large system font + maximum in-app text size must not overlap brand/header controls.
- Dark/high-contrast themes must not inherit low-contrast web colors accidentally.
- Action groups with three or more long Spanish labels must wrap cleanly.
- Decorative logo insertion must not add duplicate TalkBack announcements.

---

### Task 1: Pin visual structure and spacing contracts with tests

**Files:**
- Create: `mobile/test/visual-layout-contract.test.mjs`
- Modify: `mobile/test/home.test.mjs`
- Modify: `mobile/test/app-shell.test.mjs`
- Modify: `mobile/test/android-start-experience.test.mjs`

**Interfaces:**
- Shared CSS classes required by tests: `.app-brand`, `.screen-header`, `.action-group`, `.content-card`, `.section-stack`.
- Root safe-area variables: `--safe-top`, `--safe-bottom`, `--space-*`.
- Home includes `privacy` in its item model.

- [ ] Write failing source/DOM tests for safe-area `calc(...)`, brand classes, privacy home item, shared action-group gaps, and one accessible brand name.
- [ ] Add regression assertions that `button`/`a` remain native interactive elements and no wrapper receives an interactive role unnecessarily.
- [ ] Run `cd mobile && node --test test/visual-layout-contract.test.mjs test/home.test.mjs test/app-shell.test.mjs test/android-start-experience.test.mjs`; expect FAIL.
- [ ] Commit only tests after verifying the expected failures.

### Task 2: Create the mobile brand tokens and spacing system

**Files:**
- Modify: `mobile/src/styles.css`
- Modify: `mobile/src/index.html`

**Interfaces:**
- Brand variables: `--brand:#A61B1B`, `--brand-deep:#7F1414`, plus `--background`, `--surface`, `--surface-alt`, `--text`, `--muted`, `--border`, `--accent`, `--button-bg`, `--button-text`, `--focus`.
- Spacing tokens: `--space-1` through `--space-6` with increasing rem values.
- Root padding uses `calc(env(safe-area-inset-top, 0px) + var(--space-3))` and equivalent bottom calculation.
- `meta[name=theme-color]` matches brand-aware default instead of generic black.

- [ ] Implement light defaults, dark `prefers-color-scheme`, and existing explicit theme overrides while preserving current preference classes/data.
- [ ] Replace generic `Canvas`/`CanvasText` usage where it erases branding, but retain system-compatible fallbacks.
- [ ] Add `prefers-reduced-motion` rule disabling nonessential movement.
- [ ] Run visual contract tests; expect token and safe-area assertions PASS.
- [ ] Run full `npm test`; expect no regression.
- [ ] Commit: `style: add tifloacosta mobile design tokens`.

### Task 3: Package the existing TifloAcosta symbol for the mobile build

**Files:**
- Create: `mobile/src/assets/tifloacosta-symbol.svg` from the existing repository symbol, preserving the artwork and removing unnecessary generator metadata if safe.
- Modify: `mobile/scripts/build.mjs`
- Modify: `mobile/test/app-shell.test.mjs`

**Interfaces:**
- Build copies `mobile/src/assets/tifloacosta-symbol.svg` to `mobile/dist/assets/tifloacosta-symbol.svg`.
- Home brand image uses empty `alt` and `aria-hidden="true"`; visible text supplies `TifloAcosta`.

- [ ] Add failing build/source test for asset copy and decorative accessibility attributes.
- [ ] Update build script to create `dist/assets` and copy the SVG.
- [ ] Run `npm run build` and relevant tests; expect PASS.
- [ ] Commit: `build: package tifloacosta mobile brand asset`.

### Task 4: Create reusable brand and screen-header primitives

**Files:**
- Modify: `mobile/src/screens/shared.mjs`
- Modify: `mobile/src/styles.css`
- Create: `mobile/test/shared-screen-header.test.mjs`

**Interfaces:**
- `addAppBrand(parent, {compact=false})` renders decorative symbol + visible `TifloAcosta` text.
- `addScreenHeader(root,{router,title,backLabel})` renders a `.screen-header` containing back button then `h1` in DOM/focus order.
- `.screen-header` owns spacing; individual screens do not add ad-hoc top margins.
- `.action-group` is flex/grid with `gap`, wrapping, and no fixed control height.

- [ ] Write failing DOM tests for order `back -> h1`, single readable brand name, and native button semantics.
- [ ] Implement primitives and CSS.
- [ ] Run focused tests; expect PASS.
- [ ] Commit: `feat: add shared mobile brand and headers`.

### Task 5: Rebuild Home with brand presence and Privacy entry

**Files:**
- Modify: `mobile/src/screens/home.mjs`
- Modify: `mobile/src/core/i18n.mjs`
- Modify: `mobile/src/app.mjs`
- Create: `mobile/src/screens/privacy.mjs`
- Create: `mobile/test/privacy-screen.test.mjs`
- Modify: `mobile/test/home.test.mjs`

**Interfaces:**
- `HOME_ITEMS` includes `privacy` between contact and settings unless tests reveal a stronger existing ordering constraint.
- Home begins with `addAppBrand(...)`, followed by the accessible `h1` and section navigation.
- New route `privacy` renders `Privacidad y accesibilidad` / `Privacy and accessibility`.
- Privacy screen text describes Android local storage/library/progress/marks, notifications/external services, OCR/translation local-processing intent for 1.3.4, accessibility statement, and external full-policy link.

- [ ] Write failing ES/EN tests for Home ordering and Privacy content/route.
- [ ] Implement screen, route, translations, and brand header.
- [ ] Ensure full-policy link uses the existing external-opening mechanism and does not claim web-only browser storage behavior.
- [ ] Run focused tests and full `npm test`; expect PASS.
- [ ] Commit: `feat: add android privacy and branded home`.

### Task 6: Separate Actualidad actions from content and from each other

**Files:**
- Modify: `mobile/src/screens/actualidad.mjs`
- Modify: `mobile/src/styles.css`
- Modify: `mobile/test/actualidad-screen.test.mjs` if present; otherwise create it.

**Interfaces:**
- Each news article gets a dedicated `.action-group` after summary/meta content.
- `Abrir fuente original`, `Compartir`, and favorite action are appended to that group.
- Group wraps with gap and has block spacing from preceding text.

- [ ] Write failing DOM test proving all article actions share one action group and preserve order/names.
- [ ] Refactor helper usage so external link/share/favorite can append into the group without changing behavior.
- [ ] Run focused test; expect PASS.
- [ ] Commit: `style: separate actualidad actions`.

### Task 7: Reorganize Contact into readable groups

**Files:**
- Modify: `mobile/src/screens/contact.mjs`
- Modify: `mobile/src/core/i18n.mjs`
- Modify: `mobile/src/styles.css`
- Create: `mobile/test/contact-screen.test.mjs`

**Interfaces:**
- Groups: `Contacto directo`, `Redes sociales`, `Podcast y otros canales` when destinations exist.
- Each group uses a semantic heading and `.action-group`.
- Existing destinations remain links and external behavior remains unchanged.

- [ ] Write failing ES/EN tests for group headings, link count, and no flattened one-line container.
- [ ] Expand contact destination data to include current podcast destinations already present elsewhere where appropriate.
- [ ] Implement grouped layout and spacing.
- [ ] Run focused test and full suite; expect PASS.
- [ ] Commit: `feat: group android contact destinations`.

### Task 8: Apply shared action/card spacing across remaining screens

**Files:**
- Modify as needed: `mobile/src/screens/search.mjs`
- Modify as needed: `mobile/src/screens/library.mjs`
- Modify as needed: `mobile/src/screens/reading-library.mjs`
- Modify as needed: `mobile/src/screens/reading-book.mjs`
- Modify as needed: `mobile/src/screens/reading-audio.mjs`
- Modify as needed: `mobile/src/screens/downloads.mjs`
- Modify as needed: `mobile/src/screens/favorites.mjs`
- Modify as needed: `mobile/src/screens/videos.mjs`
- Modify as needed: `mobile/src/screens/book.mjs`
- Modify as needed: `mobile/src/screens/podcast.mjs`
- Modify as needed: `mobile/src/screens/settings.mjs`
- Modify: `mobile/src/styles.css`
- Modify: relevant existing screen tests.

**Interfaces:**
- Repeated actions use `.action-group`; repeated content uses card/section classes rather than ad-hoc margins.
- Every internal screen uses `addScreenHeader()` or an explicitly tested equivalent.

- [ ] Inventory screens that manually create top back/header controls and add failing source assertions for any inconsistent screen.
- [ ] Migrate those screens to shared primitives without changing routes or labels.
- [ ] Apply section/card spacing to repeated content.
- [ ] Run all screen tests and full `npm test`; expect PASS.
- [ ] Commit: `style: unify android screen spacing`.

### Task 9: Large-text, dark-mode, and accessibility regression gate

**Files:**
- Modify: `mobile/test/visual-layout-contract.test.mjs`
- Modify: `mobile/test/reading-accessible-navigation.test.mjs`
- Modify: `mobile/test/android-start-experience.test.mjs`
- Modify: `mobile/test/reading-beta-acceptance.test.mjs`

**Interfaces:**
- Source contract rejects fixed heights on core text/button components that would clip multiline labels.
- Theme contracts require visible focus token and explicit dark/high-contrast values.
- Home brand image remains decorative.
- Privacy remains keyboard/TalkBack reachable from Home.

- [ ] Add tests for wrapping/flexible heights, focus styles, dark/high-contrast token presence, and absence of overflow-inducing fixed widths.
- [ ] Run `npm test` and `npm run build`; expect PASS.
- [ ] Run Android sync/build: `npm run sync:android && cd android && ./gradlew --no-daemon assembleDebug --stacktrace`; expect PASS.
- [ ] Commit: `test: gate android visual accessibility`.

### Task 10: Manual visual verification on Android

**Files:**
- Modify this plan only to record checked items when evidence exists.

- [ ] Verify standard status bar and a device/emulator with display cutout/notch: no content collides with time/camera area.
- [ ] Verify Home, Actualidad, Contact, Privacy, Settings, Videos, and TifloLector in light and dark themes.
- [ ] Verify in-app text sizes Normal, Large, Extra Large, Maximum plus elevated Android system font scale.
- [ ] Verify TalkBack order: Back, screen heading, content, related actions.
- [ ] Verify no duplicate announcement of the TifloAcosta logo/name.
- [ ] Verify no horizontal scrolling is required in Contact or long action groups.
