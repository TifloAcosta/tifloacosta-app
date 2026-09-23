import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { buildMobileContent } from '../scripts/build-mobile-content.mjs';

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
    }]
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
