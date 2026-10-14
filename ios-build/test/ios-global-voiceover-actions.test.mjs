import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
const source = file => readFileSync(resolve(import.meta.dirname, '../..', file), 'utf8');

test('el rotor se conecta al elemento enfocado y no a toda la ventana', () => {
  const swift = source('ios-build/native/TifloReadingAccessibilityPlugin.swift');
  assert.match(swift, /UIAccessibility\.elementFocusedNotification/);
  assert.match(swift, /UIAccessibility\.focusedElement\(using: \.notificationVoiceOver\)/);
  assert.match(swift, /registerAccessibleTargets/);
  assert.match(swift, /focusedTargetId == targetId/);
  assert.match(swift, /matches\.count == 1/);
  assert.match(swift, /notifyListeners\("targetAction"/);
  assert.match(swift, /element\.accessibilityCustomActions = actions/);
  assert.match(swift, /view\.accessibilityCustomActions = actions/);
});

test('títulos de vídeos, podcasts y recursos tienen acciones sin controles añadidos', () => {
  const js = source('ios-build/ios-accessible-actions.js');
  for (const selector of ['#video-list .video-card', '#podcast-episodes .podcast-episode-card',
    '.resource-card h3 a[aria-haspopup="dialog"]']) assert.ok(js.includes(selector));
  for (const action of ["'play'", "'youtube'", "'description'", "'open'",
    "'download'", "'share'", "'favorite'", "'options'"]) assert.ok(js.includes(action));
  assert.match(js, /native\.addListener\('targetAction'/);
  assert.match(js, /element\.dataset\.iosRotorTarget/);
  assert.match(js, /new MutationObserver\(scheduleRefresh\)/);
  assert.doesNotMatch(js, /document\.createElement\('button'\)/);
  assert.match(js, /if \(!element \|\| !visible\(element\)\) return/);
});

test('el empaquetado iOS incluye la extensión sin tocar la web ni Android', () => {
  const prep = source('ios-build/prepare-web.mjs');
  assert.match(prep, /ios-accessible-actions\.js/);
  assert.match(prep, /html = html\.replace\('<\/body>', '<script src="ios-accessible-actions\.js"/);
  assert.match(prep, /nativeAccessibilitySource\.includes\('registerAccessibleTargets'\)/);
  assert.match(prep, /nativeAccessibilitySource\.includes\('notifyListeners\("targetAction"'/);
});
