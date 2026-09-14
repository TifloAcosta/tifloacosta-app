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

test('Actualidad page loads one shared feed and resolves interface language through the shared core', async () => {
  const html = await read('actualidad.html');
  const js = await read('actualidad.js');
  assert.match(html, /actualidad-core\.js/);
  assert.match(html, /actualidad\.js/);
  assert.match(js, /core\.publicStories\(stories, lang\)/);
  assert.match(js, /fetch\(['"]actualidad\.json['"]/);
  assert.equal((js.match(/fetch\(['"]actualidad\.json['"]/g) || []).length, 1);
  assert.doesNotMatch(js, /setInterval|setTimeout/);
});

test('source-only stories never expose a TifloAcosta reader action', async () => {
  const view = require('../actualidad.js');
  const actions = view.availableActions({ editorialState: 'source-only', originalUrl: 'https://example.com/story' }, 'es');
  assert.deepEqual(actions.map(action => action.kind), ['original']);
  assert.equal(actions[0].label, 'Abrir fuente original');
});

test('one bilingual logical item exposes natural reader actions in Spanish and English', () => {
  const core = require('../actualidad-core.js');
  const view = require('../actualidad.js');
  const item = {
    id: 'bilingual-story',
    type: 'news',
    sourceId: 'applevis-blog',
    sourceName: 'AppleVis Blog',
    sourceUrl: 'https://www.applevis.com/blog',
    originalUrl: 'https://www.applevis.com/blog/example',
    originalLanguage: 'en',
    publishedAt: '2026-09-14T10:00:00Z',
    categories: ['apple'],
    editorialState: 'adapted',
    featuredRank: null,
    locales: {
      es: { title: 'Título en español', summary: 'Resumen', body: 'Texto en español.' },
      en: { title: 'English title', summary: 'Summary', body: 'English text.' }
    },
    media: null
  };

  const es = core.localizedStory(item, 'es');
  const en = core.localizedStory(item, 'en');
  assert.equal(es.id, en.id);
  assert.equal(es.title, 'Título en español');
  assert.equal(en.title, 'English title');
  assert.deepEqual(view.availableActions(es, 'es').map(action => action.label), ['Leer en TifloAcosta', 'Abrir fuente original']);
  assert.deepEqual(view.availableActions(en, 'en').map(action => action.label), ['Read on TifloAcosta', 'Open original source']);
});

test('adapted flat stories expose reader and original source actions in both languages', async () => {
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
