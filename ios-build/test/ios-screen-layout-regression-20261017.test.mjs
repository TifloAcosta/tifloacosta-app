import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '../..');
const read = path => readFileSync(resolve(root, path), 'utf8');

test('iOS defaults to normal text while keeping the user-controlled magnifications', () => {
  const css = read('styles.css');
  const ios = read('ios-build/ios-reader-presentation.css');
  assert.match(css, /--body-size:\s*100%/);
  for (const size of ['large', 'xlarge', 'max']) {
    assert.ok(css.includes(`html[data-text-size="${size}"]`));
  }
  assert.doesNotMatch(ios, /html\s*\{[^}]*font-size\s*:/s);
});

test('iOS keeps sections, cards, controls and received file names inside their viewport', () => {
  const css = read('ios-build/ios-reader-presentation.css');
  for (const selector of [
    '.wrap', 'main > section', '.panel', '.resource-card', '.video-card',
    '.news-item', '.global-search-card', '#reading-section', '#ios-received-section',
    '#reading-library-list', '#ios-received-list'
  ]) assert.ok(css.includes(selector), `Missing iOS layout guard: ${selector}`);
  assert.match(css, /inline-size:\s*min\(94vw,\s*100%\)/);
  assert.match(css, /overflow-wrap:\s*anywhere/);
  assert.match(css, /max-inline-size:\s*100%/);
  assert.match(css, /white-space:\s*normal/);
});

test('iOS retains flexible controls and safe areas, without hiding content', () => {
  const css = read('ios-build/ios-reader-presentation.css');
  assert.match(css, /env\(safe-area-inset-top,\s*0px\)/);
  assert.match(css, /env\(safe-area-inset-bottom,\s*0px\)/);
  assert.match(css, /max-inline-size:\s*100%/);
  assert.doesNotMatch(css, /visibility:\s*hidden|font-size:\s*0|height:\s*100vh/);
});
