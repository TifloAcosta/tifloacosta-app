import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMobileContent } from '../scripts/build-mobile-content.mjs';

test('mobile content feed normalizes resources and videos and exposes news', () => {
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

  const feed = buildMobileContent({
    resources: [resource],
    videos: [video],
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
  assert.deepEqual(feed.news, []);
  assert.equal(resource.new, true, 'source resource must not be mutated');
  assert.equal('isNew' in resource, false, 'source resource must not gain mobile-only fields');
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
