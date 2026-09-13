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

test('source-only stories remain source-only when no editorial record exists', () => {
  const [result] = mergeEditorial([sourceStory()], []);
  assert.equal(result.editorialState, 'source-only');
  assert.equal(result.body, '');
});

test('an adaptation is exposed only when it has a non-empty body', () => {
  const [result] = mergeEditorial([sourceStory()], [{
    id: 'story-1',
    editorialState: 'adapted',
    lang: 'es',
    title: 'Título adaptado',
    summary: 'Resumen propio',
    body: 'Texto propio de TifloAcosta.',
    categories: ['apple', 'tecnologia-accesibilidad'],
    featuredRank: 1
  }]);

  assert.equal(result.editorialState, 'adapted');
  assert.equal(result.lang, 'es');
  assert.equal(result.body, 'Texto propio de TifloAcosta.');
  assert.deepEqual(result.categories, ['apple', 'tecnologia-accesibilidad']);
  assert.equal(result.featuredRank, 1);
});

test('empty adapted records are downgraded to source-only', () => {
  const [result] = mergeEditorial([sourceStory()], [{
    id: 'story-1',
    editorialState: 'adapted',
    title: 'No debe publicarse como adaptación',
    body: '   '
  }]);

  assert.equal(result.editorialState, 'source-only');
  assert.equal(result.body, '');
});

test('editorial records can match by canonical original URL', () => {
  const [result] = mergeEditorial([sourceStory()], [{
    originalUrl: 'https://www.applevis.com/example',
    editorialState: 'withheld'
  }]);

  assert.equal(result.editorialState, 'withheld');
});
