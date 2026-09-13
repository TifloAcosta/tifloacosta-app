import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const core = require('../actualidad-core.js');

const story = overrides => ({
  id: 'story-1',
  lang: 'es',
  title: 'Una noticia',
  sourceId: 'source',
  sourceName: 'Fuente',
  sourceUrl: 'https://example.com/',
  originalUrl: 'https://example.com/story-1',
  publishedAt: '2026-09-13T10:00:00Z',
  categories: ['apple'],
  editorialState: 'source-only',
  summary: '',
  body: '',
  featuredRank: null,
  ...overrides
});

test('withheld stories never become public', () => {
  const items = [story({ editorialState: 'withheld' })];
  assert.deepEqual(core.publicStories(items, 'es'), []);
});

test('public stories follow the selected interface language', () => {
  const items = [story({ id: 'es' }), story({ id: 'en', lang: 'en' })];
  assert.deepEqual(core.publicStories(items, 'es').map(item => item.id), ['es']);
  assert.deepEqual(core.publicStories(items, 'en').map(item => item.id), ['en']);
});

test('home preview honors explicit priority before recency and caps at five', () => {
  const items = Array.from({ length: 7 }, (_, index) => story({
    id: String(index),
    publishedAt: `2026-09-${String(13 - index).padStart(2, '0')}T10:00:00Z`,
    featuredRank: index === 6 ? 1 : null
  }));

  const result = core.homePreview(items, 'es');
  assert.equal(result.length, 5);
  assert.equal(result[0].id, '6');
});

test('invalid stories are rejected instead of leaking into the feed', () => {
  assert.equal(core.normalizeStory(story({ originalUrl: '' })), null);
  assert.equal(core.normalizeStory(story({ categories: [] })), null);
});
