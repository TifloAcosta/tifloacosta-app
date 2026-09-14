import assert from 'node:assert/strict';
import test from 'node:test';
import { mergeEditorial } from '../scripts/actualidad-editorial.mjs';

const sourceStory = overrides => ({
  id: 'story-1',
  lang: 'en',
  title: 'Original title',
  sourceId: 'applevis-blog',
  sourceName: 'AppleVis',
  sourceUrl: 'https://www.applevis.com/blog',
  originalUrl: 'https://www.applevis.com/example',
  publishedAt: '2026-09-13T12:00:00.000Z',
  categories: ['apple'],
  editorialState: 'source-only',
  summary: 'Original summary',
  body: '',
  featuredRank: null,
  ...overrides
});

test('source-only stories become one logical source-language item when no editorial record exists', () => {
  const [result] = mergeEditorial([sourceStory()], []);
  assert.equal(result.editorialState, 'source-only');
  assert.equal(result.originalLanguage, 'en');
  assert.equal(result.locales.en.title, 'Original title');
  assert.equal(result.locales.es, undefined);
});

test('an adapted editorial record produces one logical item with both locales', () => {
  const [result] = mergeEditorial([sourceStory()], [{
    id: 'story-1',
    editorialState: 'adapted',
    locales: {
      es: { title: 'Título adaptado', summary: 'Resumen propio', body: 'Texto propio.' },
      en: { title: 'Adapted title', summary: 'Own summary', body: 'Own text.' }
    },
    categories: ['apple', 'tecnologia-accesibilidad'],
    featuredRank: 1
  }]);

  assert.equal(result.editorialState, 'adapted');
  assert.equal(result.originalLanguage, 'en');
  assert.equal(result.locales.es.title, 'Título adaptado');
  assert.equal(result.locales.en.title, 'Adapted title');
  assert.deepEqual(result.categories, ['apple', 'tecnologia-accesibilidad']);
  assert.equal(result.featuredRank, 1);
});

test('an incomplete bilingual adaptation is not published as adapted', () => {
  const [result] = mergeEditorial([sourceStory()], [{
    id: 'story-1',
    editorialState: 'adapted',
    locales: { es: { title: 'Solo español', body: 'Texto.' } }
  }]);

  assert.notEqual(result.editorialState, 'adapted');
});

test('editorial records can match by canonical original URL', () => {
  const [result] = mergeEditorial([sourceStory()], [{
    originalUrl: 'https://www.applevis.com/example',
    editorialState: 'withheld'
  }]);

  assert.equal(result.editorialState, 'withheld');
});
