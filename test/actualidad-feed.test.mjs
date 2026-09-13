import assert from 'node:assert/strict';
import test from 'node:test';
import { canonicalizeUrl, normalizeFeedEntry, parseFeedXml, stableStoryId } from '../scripts/actualidad-feed.mjs';

const source = {
  id: 'applevis-apps',
  name: 'AppleVis',
  homepage: 'https://www.applevis.com/',
  feedUrl: 'https://www.applevis.com/feed/apps.xml',
  lang: 'en',
  categories: ['apple', 'apps-accesibles'],
  enabled: true
};

test('RSS items are parsed into feed entries', () => {
  const xml = `<?xml version="1.0"?><rss><channel><item><title>Accessible App</title><link>https://example.com/app?utm_source=rss</link><pubDate>Sun, 13 Sep 2026 12:00:00 GMT</pubDate><description><![CDATA[Useful app]]></description></item></channel></rss>`;
  const items = parseFeedXml(xml, source);
  assert.equal(items.length, 1);
  assert.equal(items[0].title, 'Accessible App');
  assert.equal(items[0].url, 'https://example.com/app?utm_source=rss');
});

test('Atom entries use href links and updated dates', () => {
  const xml = `<?xml version="1.0"?><feed><entry><title>NVDA note</title><link rel="alternate" href="https://example.com/nvda"/><updated>2026-09-13T13:00:00Z</updated><summary>Update</summary></entry></feed>`;
  const items = parseFeedXml(xml, source);
  assert.equal(items.length, 1);
  assert.equal(items[0].url, 'https://example.com/nvda');
  assert.equal(items[0].publishedAt, '2026-09-13T13:00:00Z');
});

test('canonical URLs drop fragments and common tracking parameters', () => {
  assert.equal(
    canonicalizeUrl('https://example.com/story?utm_source=rss&x=1&fbclid=abc#comments'),
    'https://example.com/story?x=1'
  );
});

test('stable IDs are deterministic for source and canonical URL', () => {
  const one = stableStoryId('applevis-apps', 'https://example.com/story');
  const two = stableStoryId('applevis-apps', 'https://example.com/story');
  assert.equal(one, two);
  assert.match(one, /^applevis-apps-[a-f0-9]{16}$/);
});

test('normalized feed entries inherit source language and categories', () => {
  const item = normalizeFeedEntry({
    title: 'Accessible App',
    url: 'https://example.com/app?utm_medium=rss',
    publishedAt: '2026-09-13T12:00:00Z',
    summary: 'Useful app'
  }, source);

  assert.equal(item.lang, 'en');
  assert.deepEqual(item.categories, ['apple', 'apps-accesibles']);
  assert.equal(item.originalUrl, 'https://example.com/app');
  assert.equal(item.editorialState, 'source-only');
});
