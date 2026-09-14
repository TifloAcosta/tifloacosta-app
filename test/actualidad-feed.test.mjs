import assert from 'node:assert/strict';
import test from 'node:test';
import { canonicalizeUrl, normalizeFeedEntry, parseCtiNewsHtml, parseFeedXml, stableStoryId } from '../scripts/actualidad-feed.mjs';

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

test('CTI news listing is parsed into dated entries', () => {
  const html = `
    <section>
      <h2><span>Evaluaciones de APP</span> <a href="/noticias/evaluaciones-de-app-agosto">Evaluaciones de APP actualizadas en agosto</a></h2>
      <span class="date">11/09/2026</span>
      <p>A lo largo del pasado mes se han evaluado nuevas aplicaciones.</p>
      <h2><span>Accesibilidad y Tecnología</span> <a href="https://cti.once.es/noticias/futbol-accesible">Vive el fútbol accesible con Movistar Touch</a></h2>
      <span class="date">10/09/2026</span>
      <p>Una experiencia accesible e inmersiva para personas afiliadas.</p>
    </section>`;

  const items = parseCtiNewsHtml(html, { homepage: 'https://cti.once.es/' });
  assert.equal(items.length, 2);
  assert.equal(items[0].title, 'Evaluaciones de APP actualizadas en agosto');
  assert.equal(items[0].url, 'https://cti.once.es/noticias/evaluaciones-de-app-agosto');
  assert.equal(items[0].publishedAt, '2026-09-11T12:00:00.000Z');
  assert.equal(items[0].summary, 'A lo largo del pasado mes se han evaluado nuevas aplicaciones.');
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
