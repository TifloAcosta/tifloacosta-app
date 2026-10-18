import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const swift = readFileSync(new URL('../native/TifloYouTubeViewController.swift', import.meta.url), 'utf8');

test('Native iOS YouTube player prevents idle lock only during foreground video playback', () => {
  assert.match(swift, /private func setScreenAwake\(_ requested: Bool\)/);
  assert.match(swift, /UIApplication\.shared\.applicationState == \.active/);
  assert.match(swift, /UIApplication\.shared\.isIdleTimerDisabled = true/);
  assert.match(swift, /UIApplication\.shared\.isIdleTimerDisabled = priorIdleTimerDisabled/);
  assert.match(swift, /setScreenAwake\(state == 1\)/);
  assert.match(swift, /setScreenAwake\(false\)/);
  assert.match(swift, /viewWillDisappear\(_ animated: Bool\)/);
  assert.match(swift, /UIApplication\.willResignActiveNotification/);
  assert.match(swift, /UIApplication\.didBecomeActiveNotification/);
});

test('Pausing, ending, errors, leaving and manual screen locking do not start background playback', () => {
  assert.match(swift, /private func presentPlayerError\(_ code: Int\) \{\s*setScreenAwake\(false\)/);
  assert.match(swift, /setScreenAwake\(state == 1\)/);
  assert.match(swift, /@objc private func appWillResignActive\(\) \{\s*setScreenAwake\(false\)/);
  assert.doesNotMatch(swift, /AVPlayer\(/);
  assert.doesNotMatch(swift, /WKWebView.*backgroundPlay/);
});
