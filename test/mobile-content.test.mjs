import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  buildMobileContent,
  MOBILE_NEWS_MAX_AGE_DAYS,
  MOBILE_NEWS_MAX_PER_LANGUAGE
} from '../scripts/build-mobile-content.mjs';

test('mobile content feed normalizes resources, videos and localized news', () => {
  const resource = {
    id: 'r1',
    lang: 'es',
    category: 'iPhone',
    title: 'Guía',
    url: 'https://example.com/download',
    openUrl: 'https://tifloacosta.com/docs/es/reader-r1.html',
    new: true
  };
  const video = {
    id: 'v1234567890',
    title: 'Vídeo',
    publishedAt: '2026-09-13T09:00:00Z',
    description: 'Descripción',
    excerpt: 'Resumen',
    thumbnail: 'https://example.com/thumb.jpg',
    url: 'https://www.youtube.com/watch?v=v1234567890'
  };
  const news = {
    id: 'story-1',
    lang: 'es',
    title: 'Noticia accesible',
    summary: 'Resumen limpio',
    body: 'Texto completo limpio.\n\nSegundo párrafo.',
    sourceName: 'Fuente',
    originalUrl: 'https://example.com/noticia',
    publishedAt: '2026-09-17T08:00:00.000Z',
    categories: ['Accesibilidad']
  };

  const feed = buildMobileContent({
    resources: [resource],
    videos: [video],
    news: [news],
    generatedAt: '2026-09-17T09:00:00.000Z'
  });

  assert.equal(feed.schemaVersion, 1);
  assert.equal(feed.generatedAt, '2026-09-17T09:00:00.000Z');
  assert.deepEqual(feed.resources, [{
    kind: 'resource',
    id: 'r1',
    lang: 'es',
    category: 'iPhone',
    title: 'Guía',
    url: 'https://example.com/download',
    openUrl: 'https://tifloacosta.com/docs/es/reader-r1.html',
    isNew: true
  }]);
  assert.deepEqual(feed.videos, [{
    kind: 'video',
    id: 'v1234567890',
    title: 'Vídeo',
    publishedAt: '2026-09-13T09:00:00Z',
    description: 'Descripción',
    excerpt: 'Resumen',
    thumbnail: 'https://example.com/thumb.jpg',
    url: 'https://www.youtube.com/watch?v=v1234567890'
  }]);
  assert.deepEqual(feed.news, [{
    kind: 'news',
    id: 'story-1:es',
    sourceId: 'story-1',
    lang: 'es',
    title: 'Noticia accesible',
    summary: 'Resumen limpio',
    body: 'Texto completo limpio.\n\nSegundo párrafo.',
    sourceName: 'Fuente',
    originalUrl: 'https://example.com/noticia',
    publishedAt: '2026-09-17T08:00:00.000Z',
    categories: ['Accesibilidad']
  }]);
  assert.equal(resource.new, true, 'source resource must not be mutated');
  assert.equal('isNew' in resource, false, 'source resource must not gain mobile-only fields');
});

test('mobile feed replaces Microsoft Office formatting noise with the first clean body paragraph', () => {
  const feed = buildMobileContent({
    news: [{
      id: 'tca-doc',
      lang: 'es',
      title: 'Novedades en TCA Doc 1.0',
      summary: 'Normal 0 21 false false false ES-TRAD X-NONE X-NONE Style Definitions table.MsoNormalTable { mso-style-name: Tabla normal; }',
      body: 'TCA Doc incorpora nuevas mejoras de accesibilidad y funcionamiento.\n\nSegundo párrafo.',
      sourceName: 'TecnoAccesible',
      originalUrl: 'https://example.com/tca-doc',
      publishedAt: '2026-09-23T08:00:00.000Z',
      categories: ['Accesibilidad']
    }],
    generatedAt: '2026-09-23T09:00:00.000Z'
  });

  assert.equal(feed.news[0].summary, 'TCA Doc incorpora nuevas mejoras de accesibilidad y funcionamiento.');
  assert.doesNotMatch(feed.news[0].summary, /MsoNormal|Style Definitions|X-NONE/i);
});

test('mobile feed tolerates optional video text fields without inventing values', () => {
  const feed = buildMobileContent({
    resources: [],
    videos: [{ id: 'abcdefghijk', title: 'Solo título' }],
    generatedAt: '2026-09-17T09:00:00.000Z'
  });

  assert.deepEqual(feed.videos[0], {
    kind: 'video',
    id: 'abcdefghijk',
    title: 'Solo título',
    publishedAt: '',
    description: '',
    excerpt: '',
    thumbnail: '',
    url: ''
  });
});

test('mobile content generator reuses the shared Actualidad core for both interface languages', async () => {
  const source = await readFile(new URL('../scripts/build-mobile-content.mjs', import.meta.url), 'utf8');
  assert.match(source, /actualidad\.json/);
  assert.match(source, /actualidad-core\.js/);
  assert.match(source, /publicStories\([^\n]+['"]es['"]\)/);
  assert.match(source, /publicStories\([^\n]+['"]en['"]\)/);
});

function story({ id, lang = 'es', publishedAt }) {
  return {
    id,
    lang,
    title: `Noticia ${id}`,
    summary: '',
    body: '',
    sourceName: 'Medio',
    originalUrl: `https://example.com/${id}`,
    publishedAt,
    categories: ['Accesibilidad']
  };
}

test('Actualidad mobile retention excludes stories older than ten days and future-dated stories', () => {
  assert.equal(MOBILE_NEWS_MAX_AGE_DAYS, 10);
  const generatedAt = '2026-09-23T12:00:00.000Z';
  const feed = buildMobileContent({
    generatedAt,
    news: [
      story({ id: 'inside', publishedAt: '2026-09-13T12:00:00.000Z' }),
      story({ id: 'too-old', publishedAt: '2026-09-13T11:59:59.999Z' }),
      story({ id: 'future', publishedAt: '2026-09-23T12:00:00.001Z' })
    ]
  });

  assert.deepEqual(feed.news.map(item => item.sourceId), ['inside']);
});

test('Actualidad mobile retention keeps only the newest sixty stories independently per language', () => {
  assert.equal(MOBILE_NEWS_MAX_PER_LANGUAGE, 60);
  const generatedAt = '2026-09-23T12:00:00.000Z';
  const makeLanguage = lang => Array.from({ length: 65 }, (_, index) => story({
    id: `${lang}-${String(index).padStart(2, '0')}`,
    lang,
    publishedAt: new Date(Date.parse(generatedAt) - index * 60_000).toISOString()
  }));

  const feed = buildMobileContent({
    generatedAt,
    news: [...makeLanguage('es'), ...makeLanguage('en')]
  });

  const es = feed.news.filter(item => item.lang === 'es');
  const en = feed.news.filter(item => item.lang === 'en');
  assert.equal(es.length, 60);
  assert.equal(en.length, 60);
  assert.equal(es[0].sourceId, 'es-00');
  assert.equal(es.at(-1).sourceId, 'es-59');
  assert.equal(en[0].sourceId, 'en-00');
  assert.equal(en.at(-1).sourceId, 'en-59');
  assert.equal(feed.news.some(item => /-(?:60|61|62|63|64)$/.test(item.sourceId)), false);
});

test('Actualidad mobile retention orders newest first and uses stable id order for equal timestamps', () => {
  const generatedAt = '2026-09-23T12:00:00.000Z';
  const timestamp = '2026-09-23T10:00:00.000Z';
  const feed = buildMobileContent({
    generatedAt,
    news: [
      story({ id: 'b', publishedAt: timestamp }),
      story({ id: 'older', publishedAt: '2026-09-23T09:59:59.000Z' }),
      story({ id: 'a', publishedAt: timestamp })
    ]
  });

  assert.deepEqual(feed.news.map(item => item.sourceId), ['a', 'b', 'older']);
});
