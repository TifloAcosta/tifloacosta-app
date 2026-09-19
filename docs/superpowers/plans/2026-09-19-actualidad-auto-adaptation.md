# Actualidad Automatic Adaptation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically evaluate new Actualidad stories, adapt only highly valuable items into Spanish and English, validate them, preserve manual edits, and publish them through the existing hourly feed workflow.

**Architecture:** Keep source collection unchanged. Add a pure decision/state module, a small OpenAI Responses client, and an orchestration module that runs after source normalization and before `mergeEditorial`. The workflow remains safe when the API key is absent or an API call fails: source-only news still publishes and automatic editorial state is not corrupted.

**Tech Stack:** Node.js 22, built-in `fetch`, OpenAI Responses API with Structured Outputs, Node test runner, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-19-actualidad-auto-adaptation-design.md`

## Global Constraints

- Initial model: `gpt-5.6-luna`.
- Maximum 6 new AI evaluations per hourly run.
- Maximum 2 new automatic adaptations per hourly run.
- Maximum 1 paid contrast search per selected story.
- Maximum 3 attempts per story, at least 60 minutes apart.
- Automatic output must contain complete Spanish and English title, summary and body before it can become `adapted`.
- Manual editorial changes must take precedence over later automatic runs.
- The existing source collection and publication flow must continue when AI is unavailable.
- The OpenAI key must exist only in GitHub Actions secrets and must never be written to the repository or public feed.

---

### Task 1: Pure filtering, retry, validation and manual-protection core

**Files:**
- Create: `scripts/actualidad-auto-core.mjs`
- Create: `test/actualidad-auto-core.test.mjs`

**Interfaces:**
- Produces: `selectEvaluationCandidates`, `canRetryStory`, `findCorroboratingStory`, `validateAdaptation`, `automaticRecordHash`, `isManualRecordProtected`, `buildEditorialRecord`.

- [ ] Write failing tests for age/source filtering, deterministic limits, retry timing, local corroboration, bilingual validation, unsupported hard-fact validation, stable hashes and manual-edit protection.
- [ ] Run `node --test test/actualidad-auto-core.test.mjs` and verify RED because the module does not yet exist.
- [ ] Implement only the pure functions required by the tests.
- [ ] Run the focused test and verify GREEN.

### Task 2: Central configuration and editorial guidance

**Files:**
- Create: `actualidad-auto-config.json`
- Create: `docs/actualidad-editorial-guidelines.md`
- Create: `actualidad-auto-state.json`
- Extend: `test/actualidad-auto-core.test.mjs`

**Interfaces:**
- Config fields: `model`, `maxEvaluationsPerRun`, `maxAdaptationsPerRun`, `maxContrastSearchesPerStory`, `maxAttempts`, `retryAfterMinutes`, `candidateMaxAgeDays`.
- State shape: `{ "version": 1, "stories": {} }`.

- [ ] Add failing tests that load config and assert the exact approved limits and model.
- [ ] Verify RED because the files do not exist.
- [ ] Add config, guidance and initial state.
- [ ] Verify GREEN.

### Task 3: OpenAI Responses client

**Files:**
- Create: `scripts/openai-actualidad-client.mjs`
- Create: `test/openai-actualidad-client.test.mjs`

**Interfaces:**
- Produces: `createActualidadAIClient({ apiKey, fetchFn, model })` with `evaluateStory`, `adaptStory`, and optional `contrastStory` methods.
- Uses Structured Outputs (`text.format.type = json_schema`, strict schema) and `store: false`.

- [ ] Write failing tests using an injected `fetchFn` to inspect request shape without network access.
- [ ] Verify RED because the client module does not exist.
- [ ] Implement the client with no external npm dependency and robust extraction of Responses API output text.
- [ ] Verify GREEN, including API error and malformed-output cases.

### Task 4: Automatic editorial orchestrator

**Files:**
- Create: `scripts/actualidad-auto-adapt.mjs`
- Create: `test/actualidad-auto-adapt.test.mjs`

**Interfaces:**
- Produces: `runAutomaticEditorial({ stories, sources, editorial, state, aiClient, config, guidelines, now })` returning `{ editorial, state, stats }`.
- Evaluations write compact metadata only; no chain-of-thought is persisted.
- Selected stories may use local corroboration first; paid web contrast is capped by config.

- [ ] Write failing tests for selection, rejection, adaptation, two-item adaptation cap, six-evaluation cap, safe API failure, retry accounting, and manual preservation.
- [ ] Verify RED.
- [ ] Implement the orchestrator.
- [ ] Verify GREEN.

### Task 5: Integrate with hourly synchronization safely

**Files:**
- Modify: `scripts/sync-actualidad.mjs`
- Modify: `test/actualidad-sync.test.mjs`

**Interfaces:**
- `syncActualidad` keeps its current behavior by default.
- CLI mode optionally runs automatic editorial when `OPENAI_API_KEY` is present, writes `actualidad-editorial.json` and `actualidad-auto-state.json`, then rebuilds the public feed from the resulting editorial data.

- [ ] Add failing integration tests proving source collection still works without AI and adapted records flow into the public feed.
- [ ] Verify RED for the new integration path.
- [ ] Add the integration with dependency injection and safe no-key/no-API fallback.
- [ ] Verify GREEN and run all Actualidad tests.

### Task 6: Accessible adaptation notice

**Files:**
- Modify: `actualidad.js`
- Modify: `test/actualidad-page.test.mjs` or add a focused reader test.

**Interfaces:**
- Spanish: `Adaptación de TifloAcosta basada en la información de la fuente original.`
- English: `TifloAcosta adaptation based on information from the original source.`

- [ ] Write a failing test that requires exactly one localized adaptation notice in the clean reader for `adapted` items.
- [ ] Verify RED.
- [ ] Render the notice as its own paragraph before the adapted body, never inside source-only cards.
- [ ] Verify GREEN.

### Task 7: GitHub Actions persistence and final verification

**Files:**
- Modify: `.github/workflows/sync-actualidad.yml`
- Add/extend workflow source tests if needed.

**Interfaces:**
- Main workflow exposes `OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}` only to the Actualidad sync step.
- Change detection and commit include `actualidad-editorial.json` and `actualidad-auto-state.json` alongside `actualidad.json`.

- [ ] Add a failing source-level test requiring secret wiring and persistence paths.
- [ ] Verify RED.
- [ ] Update the workflow without printing the secret.
- [ ] Run `npm test` and verify all tests pass.
- [ ] Confirm the feature branch workflow succeeds and inspect its logs for safe behavior when the secret is absent.
