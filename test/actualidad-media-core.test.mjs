import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeMediaItem, dedupeMediaItems, retainRecentMedia } from '../scripts/actualidad-media-core.mjs';

const accessibility = {
  id: 'applevis-podcast',
  name: 'AppleVis Podcast',
  homepage: 'https://www.applevis.com/podcasts',
  section: 'accessibility',
  type: 'audio',
  lang: 'en'
};

test('normalization keeps the source section authoritative', () => {
  const item = normalizeMediaItem({
    id: 'a1',
    title: 'Accessible app demo',
    originalUrl: 'https://example.com/episode',
    publishedAt: '2026-09-10T10:00:00Z',
    mediaUrl: 'https://example.com/episode.mp3'
  }, accessibility);
  assert.equal(item.section, 'accessibility');
  assert.equal(item.type, 'audio');
  assert.equal(item.originalLanguage, 'en');
});

test('a technology source stays technology even when the title mentions accessibility', () => {
  const source = { ...accessibility, id: 'la-manzana-mordida', section: 'technology', type: 'video', lang: 'es' };
  const item = normalizeMediaItem({
    id: 'v1',
    title: 'Accesibilidad del nuevo iPhone',
    originalUrl: 'https://www.youtube.com/watch?v=abcdefghijk',
    publishedAt: '2026-09-12T10:00:00Z'
  }, source);
  assert.equal(item.section, 'technology');
});

test('canonical duplicate URLs collapse to one item', () => {
  const input = [
    { id: '1', originalUrl: 'https://example.com/watch?v=1&utm_source=x' },
    { id: '2', originalUrl: 'https://example.com/watch?v=1' }
  ];
  assert.equal(dedupeMediaItems(input).length, 1);
});

test('items older than ninety days are excluded', () => {
  const now = new Date('2026-09-14T12:00:00Z');
  const input = [
    { id: 'new', publishedAt: '2026-09-13T12:00:00Z' },
    { id: 'old', publishedAt: '2026-06-01T12:00:00Z' }
  ];
  assert.deepEqual(retainRecentMedia(input, now).map(item => item.id), ['new']);
});
