# Apple Analytics by Email Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver each newly available TifloAcosta Apple Analytics report as a readable email to tonytenerife@gmail.com, polling every six hours without duplicate deliveries.

**Architecture:** Extend the existing apple-chat-commands GitHub Actions bridge using its permanent APPSTORE_ANALYTICS_* secrets. Separate Apple API download, metric summarization, delivery and durable deduplication; keep real email disabled until a protected sender is configured and tested.

**Tech Stack:** Node.js (built in crypto, zlib, fetch, node:test), GitHub Actions, Apple App Store Connect Analytics Reports API.

**Spec:** docs/superpowers/specs/2026-11-16-apple-analytics-email-design.md

## Global Constraints
- Preserve all existing secrets and workflows unrelated to analytics.
- Do not store private keys or raw personal analytics in source control.
- Do not fabricate zero values for absent metrics.
- No live email before sender authentication is securely configured.
- Continue to support chat-initiated read-only checks.

## Review Focus
- Several segments per report instance must be handled without double counting.
- An instance processingDate may contain previous metric dates; do not mistake it for a measurement period.
- Failed SMTP delivery must not mark a report as delivered.
- Re-run or concurrent jobs must not send duplicate emails.
- Privacy-suppressed metrics must be marked unavailable.

---

### Task 1: Apple analytics client and test
**Files:** Create .github/scripts/apple-analytics-reports.mjs, .github/scripts/apple-analytics-reports.test.mjs.
**Interfaces:** `listReports(requestId, token)`, `listInstances(reportId, token)`, `listSegments(instanceId, token)`, `downloadSegment(url)`.
- [ ] Write node:test cases using fake fetch responses for pagination, missing reports, error responses, integrity failure, and multiple segments.
- [ ] Run node --test .github/scripts/apple-analytics-reports.test.mjs; verify expected RED.
- [ ] Implement minimal functions, avoiding token log output.
- [ ] Re-run tests and project-relevant suite; verify GREEN.
- [ ] Commit to apple-chat-commands.

### Task 2: Accurate Spanish aggregation and test
**Files:** Create .github/scripts/apple-analytics-summary.mjs, .github/scripts/apple-analytics-summary.test.mjs.
**Interfaces:** `summarizeSegments(rows, metadata)` → text and stable report keys; metric-aware grouping.
- [ ] Write tests for headers, missing fields, differing granularities, locale, opt-in and privacy thresholds.
- [ ] Run tests to confirm RED.
- [ ] Implement gzip/TSV parsing and safe aggregation only for known columns.
- [ ] Run tests to confirm GREEN.
- [ ] Commit.

### Task 3: Safe delivery and deduplication
**Files:** Create .github/scripts/apple-analytics-delivery.mjs, .github/scripts/apple-analytics-delivery.test.mjs.
**Interfaces:** `pendingItems(observed,delivered)`, `sendSummary(message,credentials)`, `recordDelivered(id)`.
- [ ] Write tests for unchanged instances, new instances, retry-on-error, and duplicate/concurrent invocation safety.
- [ ] Run to confirm RED.
- [ ] Implement delivery adapter; configure protected credentials only after Tony approves sender method.
- [ ] Run to confirm GREEN and dry-run without actual email.
- [ ] Commit.

### Task 4: Scheduled workflow and end-to-end checks
**Files:** Modify .github/workflows/check-ios-app-analytics.yml or add a closely scoped workflow .github/workflows/send-ios-app-analytics-email.yml.
- [ ] Add cron every six hours, dispatch/read-only testing, concurrency protection; skip real send until sender verified.
- [ ] Verify read-only live API calls and absence of duplicate messages via Actions logs.
- [ ] Confirm with Tony before live first email if external send is not already authorized.
- [ ] Confirm first delivered email, then enable schedule and monitor.
- [ ] Commit and report remaining blockers.
