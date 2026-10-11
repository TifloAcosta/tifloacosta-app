import assert from 'node:assert/strict';
import test from 'node:test';
import { enrichIosMediaCatalog } from '../ios-build/enrich-actualidad-media.mjs';

const source = {
  id: 'provider', type: 'audio', enabled: true, adapter: 'feed',
  endpoint: 'https://example.org/rss.xml', homepage: 'https://example.org/'
};
const entry = (title, originalUrl, publishedAt = '2026-10-08T10:00:00Z') => ({
  type: 'audio', sourceId: 'provider', title, originalUrl, publishedAt, mediaUrl: null
});
const response = text => async () => ({ ok: true, text: async () => text });
const xml = (title, link, enclosure, date = 'Thu, 08 Oct 2026 10:00:00 GMT') =>
  '<rss><channel><item><title>' + title + '</title><link>' + link + '</link>' +
  '<pubDate>' + date + '</pubDate><enclosure type="audio/mpeg" url="' +
  enclosure + '"/></item></channel></rss>';

test('iOS includes playable MP3 when exact episode link matches', async () => {
  const input = [
    entry('Episode One', 'https://example.org/e1'),
    { type: 'video', sourceId: 'v', title: 'Video', embedUrl: 'https://youtube.com/embed/abcd' }
  ];
  const result = await enrichIosMediaCatalog({
    items: input, sources: [source],
    fetchImpl: response(xml('Episode One', 'https://example.org/e1',
      'https://audio.example.org/e1.mp3?sig=x&amp;expires=y'))
  });
  assert.equal(result.stats.playableCount, 1);
  assert.equal(result.items[0].mediaUrl, 'https://audio.example.org/e1.mp3?sig=x&expires=y');
  assert.deepEqual(result.items[1], input[1]);
  assert.equal(input[0].mediaUrl, null, 'the original catalogue object is not modified');
});

test('iOS matches a unique episode title when a feed links every episode to its homepage', async () => {
  const result = await enrichIosMediaCatalog({
    items: [entry('A Tribute to a Colleague', 'https://example.org/')],
    sources: [source],
    fetchImpl: response(xml('A Tribute to a Colleague', 'https://example.org/episode-1',
      'https://audio.example.org/episode-1.m4a'))
  });
  assert.equal(result.stats.playableCount, 1);
});

test('iOS refuses to pair the wrong episode or an unsafe audio URL', async () => {
  const result = await enrichIosMediaCatalog({
    items: [entry('Expected', 'https://example.org/'), entry('Other', 'https://example.org/')],
    sources: [source],
    fetchImpl: response(xml('Unrelated', 'https://example.org/unrelated', 'javascript:alert(1)'))
  });
  assert.equal(result.stats.playableCount, 0);
  assert.equal(result.items[0].mediaUrl, null);
});

test('iOS retains original source links when a feed cannot be loaded', async () => {
  const input = [entry('Expected', 'https://example.org/episode')];
  const result = await enrichIosMediaCatalog({
    items: input, sources: [source], fetchImpl: async () => { throw new Error('offline'); }
  });
  assert.equal(result.stats.playableCount, 0);
  assert.equal(result.stats.feedsOk, 0);
  assert.deepEqual(result.stats.feedsFailed, ['provider']);
  assert.deepEqual(result.items, input);
});
