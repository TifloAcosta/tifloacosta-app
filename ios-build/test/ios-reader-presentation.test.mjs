import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '../..');
const read = path => readFileSync(resolve(root, path), 'utf8');

test('iOS keeps native VoiceOver-adjustable controls and makes value visible', () => {
  const source = read('ios-build/ios-reader-selects.js');
  assert.match(source, /slider\.type = 'range'/);
  assert.match(source, /slider\.setAttribute\('aria-valuetext', value\)/);
  assert.match(source, /visibleValue\.textContent = value/);
  assert.match(source, /field\.append\(caption, slider\)/);
  assert.match(source, /caption\.setAttribute\('aria-hidden', 'true'\)/);
  assert.match(source, /select\.dispatchEvent\(new Event\('change', \{ bubbles: true \}\)\)/);
  for (const id of ['reading-library-filter', 'ios-reading-library-sort']) {
    assert.ok(source.includes("'" + id + "'"));
  }
});

test('TifloLector visual presentation remains isolated to packaged iOS', () => {
  const prep = read('ios-build/prepare-web.mjs');
  assert.match(prep, /ios-reader-presentation\.css/);
  assert.match(prep, /href="ios-reader-presentation\.css"/);
  const css = read('ios-build/ios-reader-presentation.css');
  assert.match(css, /\.ios-reader-adjustable-caption/);
  assert.match(css, /\.ios-reader-adjustable-name/);
  assert.match(css, /\.ios-reader-adjustable-value/);
  assert.match(css, /#reading-library-list > \.reading-library-title-card/);
  assert.match(css, /#reading-library-list > \.reading-library-title-card > \.reading-library-title/);
  assert.match(css, /\.reading-library-title:focus-visible/);
  // Avoid hiding text solely for visual compactness.
  assert.doesNotMatch(css, /visibility:\s*hidden|font-size:\s*0/);
});

test('moving a document selector also moves its caption and slider', () => {
  const minimal = read('ios-build/ios-reader-minimal.js');
  assert.match(minimal, /const field = companion\?\.classList\.contains\('ios-reader-adjustable-field'\)/);
  assert.match(minimal, /\[label, select, field, adjusted \? companion : null, choices\]/);
  assert.match(minimal, /ios-reader-import-panel/);
});

test('VoiceOver library titles keep the original web presentation without native screens', () => {
  const bridge = read('ios-build/ios-reader-native.js');
  const plugin = read('ios-build/native/TifloReadingAccessibilityPlugin.swift');
  const list = read('ios-build/native/TifloNativeActionListController.swift');
  assert.match(bridge, /nativeRowsOnFocus: false/);
  assert.match(plugin, /element\.accessibilityCustomActions = actions/);
  assert.match(plugin, /view\.accessibilityCustomActions = actions/);
  assert.match(plugin, /if autoNativeLibraryEnabled/);
  assert.doesNotMatch(bridge, /nativeRowsOnFocus: true/);
  assert.match(list, /cell\.accessibilityCustomActions = rowActionHandlers\[indexPath\.row\]/);
  assert.match(list, /func closeFromHost\(\)/);
});
