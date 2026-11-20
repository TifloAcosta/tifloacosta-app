# Mi música Navigation and Discovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify Mi música navigation and VoiceOver while adding browseable Jamendo and Radio directories.

**Architecture:** Extend existing SwiftUI screens and provider directory models; keep separate category destination views and reuse player instances. Preserve existing provider semantics and use the existing Node test suite for regression tests.

**Tech Stack:** SwiftUI, AVFoundation, URLSession, Radio Browser and Jamendo APIs, Node test runner.

**Spec:** `docs/superpowers/specs/2026-11-20-mi-musica-accessibility-discovery-design.md`

## Global Constraints
- Work on `feature/mi-musica` only; no MEGA; no App Store publication.
- Preserve song playback, playlist persistence, cloud imports, existing favorite storage and standard button activation.
- Onscreen content and VoiceOver must be concise; no extra explanation blocks unless needed.
- New text must use the existing app localization approach.

## Review Focus
- Empty API results: give a useful, localized empty state without failing navigation (Task 3, 4).
- API or network failure: preserve usable retry and do not clear favorites (Task 4).
- VoiceOver action order and default double-tap: preserve direct playback and contextual actions (Task 2).
- No playlist configured: never expose nonfunctional add-to-playlist action (Task 2).
- Returning from a nested settings page: retain the correct settings navigation context (Task 1).

---

### Task 1: Menu structure and settings

**Files:**
- Modify: `ios-app-native/Sources/NativeMyMusic.swift`
- Test: `ios-app-native/tests/music-navigation.test.mjs`

**Interfaces:**
- Produces: `NativeMusicCloudsScreen`, settings subviews for connection, VoiceOver, backups and equalizer; revised `musicOrganizeSection`.

- [ ] Write a failing navigation behavior test for a single Nubes entry, early platforms entry, and settings category separation; run `node --test ios-app-native/tests/music-navigation.test.mjs` and observe the expected failure.
- [ ] Add focused SwiftUI destination views preserving existing bindings and controls.
- [ ] Run targeted tests, then `node --test ios-app-native/tests/*.test.mjs`.
- [ ] Commit the task.

### Task 2: VoiceOver context actions

**Files:**
- Modify: `ios-app-native/Sources/NativeMyMusic.swift`, `NativeJamendoMusic.swift`, `NativeAudiusMusic.swift`, `NativeAppleMusic.swift`, `NativeRadioBrowser.swift`
- Test: `ios-app-native/tests/music-accessibility-actions.test.mjs`

**Interfaces:**
- Produces: concise labels and SwiftUI `.accessibilityAction(named:)` for actions on each station/song.

- [ ] Write failing targeted tests for unchanged double-tap playback, concise labels, context actions and conditional playlist/favorites; observe failure.
- [ ] Implement actions with labels and menus intact for non-VoiceOver users.
- [ ] Run targeted tests and full Node test suite.
- [ ] Commit the task.

### Task 3: Jamendo catalog and genres

**Files:**
- Modify: `ios-app-native/Sources/NativeJamendoMusic.swift`
- Test: `ios-app-native/tests/music-jamendo-discovery.test.mjs`

**Interfaces:**
- Produces: `NativeJamendoDirectory.loadFeatured()` and `loadGenre(_ genre: String)`, using existing track presentation and search.

- [ ] Write failing tests for automatic featured load and genre selection, including empty/error behavior; observe failure.
- [ ] Implement API requests with bounded limits, allowed genres and provider failure states; avoid requiring login.
- [ ] Run targeted and full Node test suites.
- [ ] Commit the task.

### Task 4: Radio browsing and advanced filters

**Files:**
- Modify: `ios-app-native/Sources/NativeRadioBrowser.swift`
- Test: `ios-app-native/tests/music-radio-filters.test.mjs`

**Interfaces:**
- Produces: `NativeRadioSearchFilter` (name, country code, language, genre), `NativeRadioDirectory.search(filter:)`, and category views; preserves `search(_ query: String)` or migrates callers coherently.

- [ ] Write failing tests for category filtering, combined advanced search, popular default, error/empty cases and favorites persistence; observe failure.
- [ ] Build Radio Browser `/json/stations/search` parameters for countrycode, language, tag and name using bounded queries and safe HTTPS streams.
- [ ] Add independent navigation for countries, languages, styles, name, combined advanced search, popular and favorites.
- [ ] Run targeted and full Node test suites.
- [ ] Commit the task.

### Task 5: Build and TestFlight gate

**Files:**
- Modify: only files implicated by verified errors.

**Interfaces:**
- Consumes: tasks 1-4.

- [ ] Review diff against approved spec and verify no lost existing controls.
- [ ] Run `node --test ios-app-native/tests/*.test.mjs` and examine failures.
- [ ] Run `ios-native-testflight-upload.yml` on `feature/mi-musica` only once code/tests are ready; inspect full build and Apple verification steps. This workflow is the Xcode compilation gate.
- [ ] Report the precise run/build and TestFlight status; never claim availability before confirmation.

### Task 6: Internet Archive — recordings and concerts

**Files:**
- Create: `ios-app-native/Sources/NativeInternetArchiveMusic.swift`
- Modify: `ios-app-native/Sources/NativeRadioBrowser.swift` (platform navigation)
- Test: `ios-app-native/tests/music-internet-archive.test.mjs`

**Interfaces:**
- Produces: `NativeInternetArchiveScreen` with featured Live Music Archive recordings, artist/title search and selected-item audio tracks.

- [ ] Write failing tests for public search and metadata URL construction, safe HTTPS audio selection, empty results, and no unlicensed download action; verify red.
- [ ] Implement read-only browsing using Internet Archive's public search and metadata APIs, prioritizing the Live Music Archive. Display rights/source metadata where available, open original item's rights details, and permit streaming only for publicly accessible playable files.
- [ ] Add an accessible platform entry without requiring user signup or developer credentials; retain previous providers untouched.
- [ ] Run targeted and full Node suites; test the signed iOS build through the existing native workflow before TestFlight.
- [ ] Commit after verification.

**Deferred candidates:** Radio Paradise requires checking third-party embedding terms; Mixcloud uses an embedded player and needs VoiceOver evaluation; SoundCloud needs approved API credentials. Spotify, Amazon and Deezer remain outside this phase due provider restrictions.
