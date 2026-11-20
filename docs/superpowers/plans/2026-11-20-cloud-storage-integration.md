# Cloud Storage Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect Google Drive, Dropbox and OneDrive to Mi música with reusable app-wide account infrastructure.

**Architecture:** A common provider-neutral authentication and secure-session layer wraps the existing `NativeCloudStorage` transport. A SwiftUI file browser in Mi música consumes it, leaving the native Files picker and other app sections untouched.

**Tech Stack:** Swift 5.9, SwiftUI, AuthenticationServices, CryptoKit, Security, REST APIs, Node contract tests.

**Spec:** `docs/CLOUD-INTEGRATIONS-SCOPE-2026-11-20.md`

## Global Constraints

- Only `feature/mi-musica`; no new development branch.
- No MEGA, cinema features, or TestFlight upload.
- Tokens in Keychain, never source or user defaults.
- Maintain current audio import and playback behavior.

## Review Focus

- An OAuth callback for an old or cancelled request must not authenticate the user.
- A revoked/expired token must reconnect or refresh without leaking credentials.
- Navigating a folder with an invalid ID or cursor must not reach an arbitrary host.
- Cloud audio import must preserve file title and respect the 250 MB limit.
- Cancelled imports and unavailable networks must leave the library intact.

---

### Task 1: Native account/session infrastructure

**Files:** Create `ios-app-native/Sources/NativeCloudAccount.swift`; test `ios-app-native/tests/cloud-account-contract.test.mjs`.

**Interfaces:** Expose a provider-neutral observable account store, `connect(provider:)`, `disconnect(provider:)`, and `validAccessToken(for:)` for the browser; provider-specific OAuth configuration must be explicit and absent credentials must disable connection.

- [ ] Write contract tests for ASWebAuthenticationSession, PKCE state and verifier, Keychain, cancellation and disconnected state.
- [ ] Run the tests and confirm the expected missing-file failure.
- [ ] Implement the smallest reusable OAuth account store with host and redirect validation.
- [ ] Run focused tests and the existing iOS contract suite.
- [ ] Commit to the existing branch after verification.

### Task 2: Google Drive authorization and selection

**Files:** Modify `NativeCloudAccount.swift`, `NativeCloudStorage.swift`; test `ios-app-native/tests/cloud-google-contract.test.mjs`.

**Interfaces:** `validAccessToken(for: .googleDrive)` enables authorized selected-file metadata/download. Selection must use a Google-approved picker or file selection mechanism consistent with the granted `drive.file` scope.

- [ ] Write tests for URL scheme, ID configuration, least-privilege scope, denied access and selected file.
- [ ] Run tests red; implement and configure with verified public OAuth client ID.
- [ ] Run focused and full tests; verify iOS compilation.
- [ ] Commit and record any Google verification limitations.

### Task 3: Dropbox account and navigation

**Files:** Modify `NativeCloudAccount.swift`; test `ios-app-native/tests/cloud-dropbox-contract.test.mjs`.

**Interfaces:** Authorization Code + PKCE, permitted files metadata/content read, app-key configuration, refresh and disconnect.

- [ ] Write failing OAuth and navigation tests.
- [ ] Implement with the registered app's public client ID and callback.
- [ ] Run focused/full tests and iOS compilation.
- [ ] Commit with no stored credentials.

### Task 4: OneDrive account and navigation

**Files:** Modify `NativeCloudAccount.swift`; test `ios-app-native/tests/cloud-onedrive-contract.test.mjs`.

**Interfaces:** Microsoft delegated `Files.Read` with registered mobile callback, token renewal and account disconnect.

- [ ] Write failing callback/authorization/refresh tests.
- [ ] Implement with verified Microsoft app registration and redirect.
- [ ] Run focused/full tests and iOS compilation.
- [ ] Commit with no stored credentials.

### Task 5: Accessible cloud browser in Mi música

**Files:** Create `ios-app-native/Sources/NativeCloudBrowser.swift`; modify `ios-app-native/Sources/NativeMyMusic.swift`; test `ios-app-native/tests/cloud-music-ui-contract.test.mjs`.

**Interfaces:** Accessible provider selection, connect/disconnect, list folders/page forward, download selected track, and `NativeMusicLibrary.importFiles(_:)` preserving title and existing library behavior.

- [ ] Write tests for provider labels, navigation, empty/loading/errors, one-file selection and VoiceOver status.
- [ ] Run tests red; implement with existing library and transport.
- [ ] Run full tests, Swift compilation and regression checks.
- [ ] Commit and record real-device scenarios remaining.

### Task 6: Final review without deployment

- [ ] Run all native/web test commands used by the branch; capture pass/fail counts.
- [ ] Run iOS build on macOS CI (not a TestFlight upload).
- [ ] Inspect diff for secrets, unrelated changes and accidental MEGA support.
- [ ] Record Google/Dropbox/Microsoft registration and account-test status with exact evidence.
- [ ] Do not dispatch any store/TestFlight workflow.
