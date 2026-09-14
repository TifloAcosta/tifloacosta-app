import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { syncActualidad } from '../scripts/sync-actualidad.mjs';

const TEST_NOW = new Date('2026-09-14T18:00:00Z');
const sources = JSON.parse(await readFile(new URL('../actualidad-sources.json', import.meta.url), 'utf8'));
const byId = new Map(sources.map(source => [source.id, source]));

function response(text) {
  return { ok: true, status: 200, text: async () => text };
}

test('English generalist written sources require positive and negative editorial filters', () => {
  for (const id of ['ars-technica', 'the-verge', 'engadget', 'techcrunch', '9to5mac']) {
    const source = byId.get(id);
    assert.ok(source, `${id} must be configured`);
    assert.ok(Array.isArray(source.includeKeywords) && source.includeKeywords.length >= 10, `${id} needs a useful includeKeywords filter`);
    assert.ok(Array.isArray(source.excludeKeywords) && source.excludeKeywords.length >= 5, `${id} needs an excludeKeywords noise filter`);
    assert.ok(!source.includeKeywords.includes('app'), `${id} must not use the overly broad app keyword`);
  }
});

test('generalist filtering keeps practical technology and rejects entertainment and rumors', async () => {
  const xml = `<?xml version="1.0"?><rss><channel>
    <item><title>How to know if your USB-C ports can support video</title><link>https://example.com/usb-c-video</link><pubDate>Mon, 14 Sep 2026 17:30:00 GMT</pubDate><description>A practical guide to USB-C video support.</description></item>
    <item><title>Netflix is making movies based on classic games</title><link>https://example.com/netflix-movies</link><pubDate>Mon, 14 Sep 2026 17:20:00 GMT</pubDate><description>New movies and entertainment releases.</description></item>
    <item><title>Rumor: the next iPhone could arrive early</title><link>https://example.com/iphone-rumor</link><pubDate>Mon, 14 Sep 2026 17:10:00 GMT</pubDate><description>An unconfirmed iPhone leak.</description></item>
  </channel></rss>`;

  const source = {
    id: 'generalist-test',
    name: 'Generalist Test',
    homepage: 'https://example.com/',
    feedUrl: 'https://example.com/feed.xml',
    lang: 'en',
    categories: ['tecnologia-general'],
    editorialClass: 'generalist',
    includeKeywords: ['usb-c', 'iphone'],
    excludeKeywords: ['movie', 'movies', 'rumor', 'rumour', 'leak'],
    enabled: true
  };

  const result = await syncActualidad({
    sources: [source],
    editorial: [],
    fetchFn: async () => response(xml),
    now: TEST_NOW
  });

  assert.deepEqual(result.stories.map(item => item.locales.en.title), [
    'How to know if your USB-C ports can support video'
  ]);
});
