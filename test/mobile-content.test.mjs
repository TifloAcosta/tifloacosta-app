import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { buildMobileContent } from '../scripts/build-mobile-content.mjs';

test('mobile content feed normalizes resources, videos and localized news', () => {
  const resource = {
    id: 'r1', lang: 'es', category: 'iPhone', title: 'Guía', url: 'https://example.com/download',
    openUrl: 'https://tifloacosta.com/docs/es/reader-r1.html', new: true
  };
  const video = {
    id: 'v1234567890', title: 'Vídeo', publishedAt: '2026-09-13T09:00:00Z', description: 'Descripción',
    excerpt: 'Resumen', thumbnail: 'https://example.com/thumb.jpg', url: 'https://www.youtube.com/watch?v=v1234567890'
  };
  const news = {
    id: 'story-1', lang: 'es', title: 'Noticia accesible', summary: 'Resumen limpio', sourceName: 'Fuente',
    originalUrl: 'https://example.com/noticia', publishedAt: '2026-09-17T08:00:00.000Z', categories: ['Accesibilidad']
  };

  const feed = buildMobileContent({ resources: [resource], videos: [video], news: [news], generatedAt: '2026-09-17T09:00:00.000Z' });

  assert.equal(feed.schemaVersion, 1);
  assert.equal(feed.generatedAt, '2026-09-17T09:00:00.000Z');
  assert.deepEqual(feed.resources, [{
    kind: 'resource', id: 'r1', lang: 'es', category: 'iPhone', title: 'Guía', url: 'https://example.com/download',
    openUrl: 'https://tifloacosta.com/docs/es/reader-r1.html', isNew: true
  }]);
  assert.deepEqual(feed.videos, [{
    kind: 'video', id: 'v1234567890', title: 'Vídeo', publishedAt: '2026-09-13T09:00:00Z', description: 'Descripción',
    excerpt: 'Resumen', thumbnail: 'https://example.com/thumb.jpg', url: 'https://www.youtube.com/watch?v=v1234567890'
  }]);
  assert.deepEqual(feed.news, [{
    kind: 'news', id: 'story-1:es', sourceId: 'story-1', lang: 'es', title: 'Noticia accesible', summary: 'Resumen limpio',
    sourceName: 'Fuente', originalUrl: 'https://example.com/noticia', publishedAt: '2026-09-17T08:00:00.000Z', categories: ['Accesibilidad']
  }]);
  assert.equal(resource.new, true, 'source resource must not be mutated');
  assert.equal('isNew' in resource, false, 'source resource must not gain mobile-only fields');
});

test('mobile feed includes accessible apps and listen-watch items without inventing fields', () => {
  const feed = buildMobileContent({
    apps: [{
      id: 'app-1', lang: 'es', title: 'App accesible', summary: 'Descripción', platform: 'iOS',
      sourceName: 'Fuente', originalUrl: 'https://example.com/app', publishedAt: ''
    }],
    media: [{
      id: 'media-1', originalLanguage: 'en', title: 'Accessible video', summary: 'Demo', platform: 'youtube',
      sourceName: 'Channel', originalUrl: 'https://www.youtube.com/watch?v=abcdefghijk', publishedAt: '2026-09-21T12:00:00Z'
    }],
    generatedAt: '2026-09-22T10:00:00.000Z'
  });

  assert.deepEqual(feed.apps, [{
    kind: 'app', id: 'app-1', lang: 'es', title: 'App accesible', summary: 'Descripción', platform: 'iOS',
    sourceName: 'Fuente', originalUrl: 'https://example.com/app', publishedAt: ''
  }]);
  assert.deepEqual(feed.media, [{
    kind: 'media', id: 'media-1', lang: 'en', title: 'Accessible video', summary: 'Demo', platform: 'youtube',
    sourceName: 'Channel', originalUrl: 'https://www.youtube.com/watch?v=abcdefghijk', publishedAt: '2026-09-21T12:00:00Z'
  }]);
});

test('mobile feed tolerates optional video text fields without inventing values', () => {
  const feed = buildMobileContent({ resources: [], videos: [{ id: 'abcdefghijk', title: 'Solo título' }], generatedAt: '2026-09-17T09:00:00.000Z' });
  assert.deepEqual(feed.videos[0], {
    kind: 'video', id: 'abcdefghijk', title: 'Solo título', publishedAt: '', description: '', excerpt: '', thumbnail: '', url: ''
  });
});

test('mobile content generator reuses the shared Actualidad core and includes all approved Actualidad feeds', async () => {
  const source = await readFile(new URL('../scripts/build-mobile-content.mjs', import.meta.url), 'utf8');
  assert.match(source, /actualidad\.json/);
  assert.match(source, /actualidad-core\.js/);
  assert.match(source, /actualidad-apps\.json/);
  assert.match(source, /actualidad-media\.json/);
  assert.match(source, /publicStories\([^\n]+['"]es['"]\)/);
  assert.match(source, /publicStories\([^\n]+['"]en['"]\)/);
});
