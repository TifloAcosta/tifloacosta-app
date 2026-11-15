# Microsoft Speech Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add opt-in Microsoft Azure document playback without regressing system voices, and keep Edge explicitly pending validation.

**Architecture:** Azure REST synthesizes bounded text chunks asynchronously. A cancellable player owns the current request and advances the document position only after audio finishes; the existing speech wrapper owns pause/stop and timer controls. User preferences select system or Azure, while cloud configuration remains in Keychain and AppStorage as appropriate.

**Tech Stack:** Swift 5.9, SwiftUI, AVFoundation, Security, URLSession, Node contract tests.

**Spec:** `docs/superpowers/specs/2026-11-15-microsoft-speech-design.md`

## Global Constraints

- Do not make Azure default or disable offline system voice.
- Never save a subscription key to UserDefaults, log it, or upload it elsewhere.
- Never claim Edge third-party integration is licensed or working without verification.
- Actual iOS compilation and playback verification require macOS and physical hardware.

## Review Focus

- Stop while a network request is pending must prevent stale audio playing.
- Pause must not fetch or advance behind the user's back.
- Long documents must use small chunks and maintain text offset.
- A failed Azure request must provide an accessible error and remain stopped.
- Switching providers must not alter audio-only audiobook playback.

### Task 1: Provider selection and configuration

**Files:** `ios-app-native/Sources/NativeReaderSettings.swift`, `ios-app-native/Sources/NativeMicrosoftSpeech.swift`, `ios-app-native/tests/reader-microsoft-speech-contract.test.mjs`.

- [ ] Write failing test that requires explicit `Voces de iOS` / `Microsoft Azure Speech` selection and a configured-key guard.
- [ ] Run the targeted test; confirm RED.
- [ ] Add the selector and Keychain-backed configuration validation.
- [ ] Run tests; confirm GREEN; commit.

### Task 2: Bounded Azure document playback

**Files:** `ios-app-native/Sources/NativeTifloLector.swift`, `ios-app-native/Sources/NativeMicrosoftSpeech.swift`, `ios-app-native/tests/reader-microsoft-speech-contract.test.mjs`.

- [ ] Add failing tests for bounded segmentation, cancellation generation, pause, and progress propagation.
- [ ] Run targeted tests; confirm RED.
- [ ] Add cancellable cloud text playback and route text-document play through chosen provider; retain system voice and audiobook paths.
- [ ] Run all tests; confirm GREEN; commit.

### Task 3: End-to-end release gates

**Files:** `ios-app-native/tests/reader-microsoft-speech-contract.test.mjs`, `ios-app-native/README.md`.

- [ ] Verify all available tests and `git diff --check`.
- [ ] Document iOS physical testing checklist: VoiceOver, pause/stop, position, background, network error, long book, credentials, braille.
- [ ] Verify no forbidden Edge endpoint or embedded key and commit.
- [ ] Report blocked macOS build and external GitHub upload truthfully.
