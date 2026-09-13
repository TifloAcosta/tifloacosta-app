import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const read = file => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

test('Actualidad page has semantic navigation, filters and a quiet status region', async () => {
  const html = await read('actualidad.html');
  assert.match(html, /<h1[^>]*id="actualidad-heading"/);
  assert.match(html, /<label[^>]*for="news-category"/);
  assert.match(html, /<select[^>]*id="news-category"/);
  assert.match(html, /id="news-status"[^>]*aria-live="polite"/);
  assert.match(html, /id="news-list"/);
  assert.match(html, /id="news-reader"[^>]*hidden/);
  assert.equal((html.match(/href="index\.html"/g) || []).length >= 2, true);
  assert.doesNotMatch(html, /autofocus/i);
});

test('Actualidad page loads one shared feed and the shared contract', async () => {
  const html = await read('actualidad.html');
  const js = await read('actualidad.js');
  assert.match(html, /actualidad-core\.js/);
  assert.match(html, /actualidad\.js/);
  assert.match(js, /fetch\(['"]actualidad\.json['"]/);
  assert.doesNotMatch(js, /setInterval|setTimeout/);
});

test('source-only stories never expose a TifloAcosta reader action', async () => {
  const view = require('../actualidad.js');
  const actions = view.availableActions({ editorialState: 'source-only', originalUrl: 'https://example.com/story' }, 'es');
  assert.deepEqual(actions.map(action => action.kind), ['original']);
  assert.equal(actions[0].label, 'Abrir fuente original');
});

test('adapted stories expose reader and original source actions in both languages', async () => {
  const view = require('../actualidad.js');
  const es = view.availableActions({ editorialState: 'adapted', body: 'Texto', originalUrl: 'https://example.com/story' }, 'es');
  const en = view.availableActions({ editorialState: 'adapted', body: 'Text', originalUrl: 'https://example.com/story' }, 'en');
  assert.deepEqual(es.map(action => action.label), ['Leer en TifloAcosta', 'Abrir fuente original']);
  assert.deepEqual(en.map(action => action.label), ['Read on TifloAcosta', 'Open original source']);
});

test('reader provides explicit return controls at both ends and restores its opener', async () => {
  const html = await read('actualidad.html');
  const js = await read('actualidad.js');
  assert.match(html, /id="reader-back-top"/);
  assert.match(html, /id="reader-back-bottom"/);
  assert.match(js, /readerOpener/);
  assert.match(js, /\.focus\(\)/);
});
