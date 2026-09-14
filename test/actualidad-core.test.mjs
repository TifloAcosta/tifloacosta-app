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

const bilingual = overrides => ({
  id: 'bilingual-1',
  type: 'news',
  sourceId: 'applevis-blog',
  sourceName: 'AppleVis Blog',
  sourceUrl: 'https://www.applevis.com/blog',
  originalUrl: 'https://www.applevis.com/blog/story',
  originalLanguage: 'en',
  publishedAt: '2026-09-14T10:00:00Z',
  categories: ['apple'],
  editorialState: 'adapted',
  featuredRank: null,
  locales: {
    es: { title: 'Historia en español', summary: 'Resumen', body: 'Texto.' },
    en: { title: 'English story', summary: 'Summary', body: 'Text.' }
  },
  media: null,
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

test('a bilingual logical item resolves naturally in both interface languages', () => {
  assert.equal(core.localizedStory(bilingual(), 'es').title, 'Historia en español');
  assert.equal(core.localizedStory(bilingual(), 'en').title, 'English story');
});

test('legacy records remain renderable during migration', () => {
  const legacy = story({ id: 'legacy-es', lang: 'es', title: 'Legado' });
  assert.equal(core.localizedStory(legacy, 'es').title, 'Legado');
  assert.equal(core.localizedStory(legacy, 'en'), null);
});

test('adapted logical items require both locale variants', () => {
  const invalid = bilingual({ locales: { es: { title: 'Solo español', summary: '', body: 'Texto.' } } });
  assert.equal(core.normalizeContent(invalid), null);
});

test('home preview honors explicit priority among eligible items and caps at five', () => {
  const now = new Date('2026-09-14T12:00:00Z');
  const items = Array.from({ length: 7 }, (_, index) => story({
    id: String(index),
    sourceId: `source-${index}`,
    sourceName: `Fuente ${index}`,
    sourceUrl: `https://source-${index}.example.com/`,
    originalUrl: `https://source-${index}.example.com/story`,
    publishedAt: `2026-09-14T${String(11 - index).padStart(2, '0')}:00:00Z`,
    featuredRank: index === 6 ? 1 : null
  }));

  const result = core.homePreview(items, 'es', 5, now);
  assert.equal(result.length, 5);
  assert.equal(result[0].id, '6');
});

test('home preview excludes a story older than five days even with top editorial rank', () => {
  const now = new Date('2026-09-14T12:00:00Z');
  const old = story({
    id: 'old-priority',
    publishedAt: '2026-09-08T11:59:59Z',
    featuredRank: 1
  });
  const recent = story({
    id: 'recent',
    publishedAt: '2026-09-14T10:00:00Z'
  });

  assert.deepEqual(core.homePreview([old, recent], 'es', 5, now).map(item => item.id), ['recent']);
});

test('a story exactly five days old remains eligible for Featured', () => {
  const now = new Date('2026-09-14T12:00:00Z');
  const boundary = story({ id: 'boundary', publishedAt: '2026-09-09T12:00:00Z' });

  assert.equal(core.homePreview([boundary], 'es', 5, now).length, 1);
});

test('Featured is not padded with older stories', () => {
  const now = new Date('2026-09-14T12:00:00Z');
  const items = [
    story({ id: 'fresh', publishedAt: '2026-09-14T10:00:00Z' }),
    story({ id: 'stale', publishedAt: '2026-09-01T10:00:00Z' })
  ];

  assert.deepEqual(core.homePreview(items, 'es', 5, now).map(item => item.id), ['fresh']);
});

test('future-dated stories are not eligible for Featured', () => {
  const now = new Date('2026-09-14T12:00:00Z');
  const future = story({ id: 'future', publishedAt: '2026-09-14T12:00:01Z' });

  assert.equal(core.isFeaturedEligible(future, now), false);
});

test('home preview shows at most two items from the same source when alternatives exist', () => {
  const now = new Date('2026-09-14T12:00:00Z');
  const items = [
    story({ id: 'a1', sourceId: 'a', publishedAt: '2026-09-13T12:00:00Z', originalUrl: 'https://a.example/a1', sourceUrl: 'https://a.example/' }),
    story({ id: 'a2', sourceId: 'a', publishedAt: '2026-09-13T11:00:00Z', originalUrl: 'https://a.example/a2', sourceUrl: 'https://a.example/' }),
    story({ id: 'a3', sourceId: 'a', publishedAt: '2026-09-13T10:00:00Z', originalUrl: 'https://a.example/a3', sourceUrl: 'https://a.example/' }),
    story({ id: 'b1', sourceId: 'b', publishedAt: '2026-09-13T09:00:00Z', originalUrl: 'https://b.example/b1', sourceUrl: 'https://b.example/' }),
    story({ id: 'c1', sourceId: 'c', publishedAt: '2026-09-13T08:00:00Z', originalUrl: 'https://c.example/c1', sourceUrl: 'https://c.example/' }),
    story({ id: 'd1', sourceId: 'd', publishedAt: '2026-09-13T07:00:00Z', originalUrl: 'https://d.example/d1', sourceUrl: 'https://d.example/' })
  ];

  const result = core.homePreview(items, 'es', 5, now);
  assert.equal(result.length, 5);
  assert.deepEqual(result.map(item => item.id), ['a1', 'a2', 'b1', 'c1', 'd1']);
  assert.equal(result.filter(item => item.sourceId === 'a').length, 2);
});

test('invalid stories are rejected instead of leaking into the feed', () => {
  assert.equal(core.normalizeStory(story({ originalUrl: '' })), null);
  assert.equal(core.normalizeStory(story({ categories: [] })), null);
});
