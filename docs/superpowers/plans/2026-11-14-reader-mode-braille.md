# Reader Mode and Braille Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Place the automatic playback toggle and braille settings together in the reading-mode screen, preserving the current saved value.

**Architecture:** Keep the existing `native-reader-reading-mode` integer for backward compatibility (`0` manual, `1` automatic). Present it as a native SwiftUI Toggle through a Boolean binding. Move the existing braille navigation screen into the reading-mode list, without changing its contents.

**Tech Stack:** SwiftUI, `@AppStorage`, Node contract tests.

**Spec:** Tony's approved screen order in the 2026-11-14 conversation.

## Global Constraints

- Do not reset saved reading mode.
- Preserve independent braille access regardless of playback state.
- Do not publish a public release.

## Review Focus

- Existing automatic selection remains selected after update.
- Existing manual selection remains off after update.
- Braille navigation remains available for both settings.
- Only one braille navigation entry is present in TifloLector settings.
- VoiceOver can operate the native switch with double tap.

### Task 1: Replace reading mode selector and nest braille settings

**Files:**
- Modify: `ios-app-native/Sources/NativeReaderSettings.swift`
- Test: `ios-app-native/tests/reader-braille-settings-public-contract.test.mjs`

- [ ] Add contract check that the toggle binds to the existing stored `0/1` mode and braille link is nested under `Modo de lectura`.
- [ ] Run focused test and verify the regression test fails.
- [ ] Implement `private var automaticReadingBinding: Binding<Bool>` mapping `readingMode == 1` and `readingMode = value ? 1 : 0`; replace `NativeAdjustableChoice` with `Toggle`; move the braille `NavigationLink` inside the nested list.
- [ ] Run focused test and full native test suite.
- [ ] Inspect diff and commit.

### Task 2: Investigate autoplay without speculative timing tweaks

**Files:**
- Inspect: `ios-app-native/Sources/NativeTifloLector.swift`

- [ ] Trace the activation path on open and the existing `AVSpeechSynthesizer` state transitions.
- [ ] Record uncertainty and request targeted device evidence before making additional audio lifecycle changes if no reproducible root cause emerges.
