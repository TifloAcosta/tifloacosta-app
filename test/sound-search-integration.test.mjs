import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = file => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

test('service worker keeps dormant sound assets out of the Downloads shell', async () => {
  const sw = await read('sw.js');
  for (const asset of ['downloads-hub.js','sound-search-core.js','sound-search-config.js','sound-search.js']) {
    assert.doesNotMatch(sw, new RegExp(asset.replace('.', '\\.')));
  }
});

test('privacy copy explains sound-search provider requests in both languages', async () => {
  const ui = await read('sound-search.js');
  assert.match(ui, /búsquedas de sonidos/i);
  assert.match(ui, /sound searches/i);
  assert.match(ui, /no guarda un historial personal/i);
  assert.match(ui, /does not keep a personal history/i);
  assert.match(ui, /sound-search-privacy-note/);
  assert.match(ui, /privacy-text/);
});

test('frontend contains no Freesound authorization secret', async () => {
  const publicSource = (await Promise.all(['sound-search-config.js','sound-search.js','index.html'].map(read))).join('\n');
  assert.doesNotMatch(publicSource, /FREESOUND_API_KEY|Authorization:\s*Token/i);
});

test('service worker never caches the dynamic sound-search endpoint', async () => {
  const sw = await read('sw.js');
  assert.doesNotMatch(sw, /download\.tifloacosta\.com\/sounds\/search/);
});
