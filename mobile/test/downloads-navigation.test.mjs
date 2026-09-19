import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { text } from '../src/core/i18n.mjs';
import { HOME_ITEMS } from '../src/screens/home.mjs';

const read = file => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

test('Downloads follows Library on the mobile home screen', () => {
  const index = HOME_ITEMS.indexOf('library');
  assert.equal(HOME_ITEMS[index + 1], 'downloads');
});

test('Downloads core labels exist in Spanish and English', () => {
  for (const lang of ['es', 'en']) {
    for (const key of ['home.downloads', 'screen.downloads', 'downloads.link', 'downloads.sounds']) {
      assert.notEqual(text(lang, key), key);
    }
  }
});

test('app registers all Downloads routes', async () => {
  const source = await read('src/app.mjs');
  assert.match(source, /case 'downloads':/);
  assert.match(source, /case 'downloads-link':/);
  assert.match(source, /case 'downloads-sounds':/);
});

test('Downloads hub uses shared accessible header and stable child origin ids', async () => {
  const source = await read('src/screens/downloads.mjs');
  assert.match(source, /addScreenHeader\(/);
  assert.match(source, /downloads-open-link/);
  assert.match(source, /downloads-open-sounds/);
  assert.doesNotMatch(source, /autofocus/i);
});
