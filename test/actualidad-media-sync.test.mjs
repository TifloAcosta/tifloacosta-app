import assert from 'node:assert/strict';
import test from 'node:test';
import { parseTifloAudioHtml, youtubeEntriesFromApi } from '../scripts/actualidad-media-adapters.mjs';
import { buildMediaCatalog, mergeMediaEditorial, orderMediaItems } from '../scripts/sync-actualidad-media.mjs';

test('Tiflo Audio HTML yields dated episodes and an official MP3 when present', () => {
  const html = `<article>
    <h2><a href="https://www.tifloaudio.com/tiflo-audio-232/">Tiflo Audio 232</a></h2>
    <time datetime="2026-08-03T10:00:00+00:00">3 agosto 2026</time>
    <p>Resumen del episodio.</p>
    <a href="https://www.tifloaudio.com/audio/tiflo232.mp3">Descargar</a>
  </article>`;
  assert.deepEqual(parseTifloAudioHtml(html), [{
    title: 'Tiflo Audio 232',
    originalUrl: 'https://www.tifloaudio.com/tiflo-audio-232/',
    publishedAt: '2026-08-03T10:00:00+00:00',
    summary: 'Resumen del episodio.',
    mediaUrl: 'https://www.tifloaudio.com/audio/tiflo232.mp3'
  }]);
});

test('YouTube API conversion builds official source and embed URLs', () => {
  const page = { items: [{
    contentDetails: { videoId: 'abcdefghijk', videoPublishedAt: '2026-09-12T10:00:00Z' },
    snippet: { title: 'Noticias Apple', description: 'Resumen' }
  }] };
  assert.deepEqual(youtubeEntriesFromApi(page), [{
    title: 'Noticias Apple',
    summary: 'Resumen',
    publishedAt: '2026-09-12T10:00:00Z',
    originalUrl: 'https://www.youtube.com/watch?v=abcdefghijk',
    embedUrl: 'https://www.youtube.com/embed/abcdefghijk',
    platform: 'youtube'
  }]);
});

test('one failed source keeps valid media from another source', async () => {
  const sources = [
    { id: 'bad', name: 'Bad', homepage: 'https://bad.example/', endpoint: 'https://bad.example/feed', section: 'accessibility', type: 'audio', lang: 'es', adapter: 'feed', enabled: true, maxItems: 5 },
    { id: 'good', name: 'Good', homepage: 'https://good.example/', endpoint: 'https://good.example/feed', section: 'accessibility', type: 'audio', lang: 'es', adapter: 'feed', enabled: true, maxItems: 5 }
  ];
  const fetchImpl = async url => {
    if (String(url).includes('bad.example')) throw new Error('offline');
    return {
      ok: true,
      text: async () => `<?xml version="1.0"?><rss><channel><item><title>Episodio válido</title><link>https://good.example/e1</link><pubDate>Sat, 12 Sep 2026 10:00:00 GMT</pubDate><description>Resumen</description></item></channel></rss>`
    };
  };
  const result = await buildMediaCatalog({ sources, fetchImpl, env: {}, now: new Date('2026-09-14T12:00:00Z'), editorial: [] });
  assert.equal(result.items.length, 1);
  assert.deepEqual(result.failures.map(item => item.sourceId), ['bad']);
});

test('all enabled sources failing rejects instead of returning an empty catalog', async () => {
  const sources = [
    { id: 'bad', name: 'Bad', homepage: 'https://bad.example/', endpoint: 'https://bad.example/feed', section: 'accessibility', type: 'audio', lang: 'es', adapter: 'feed', enabled: true, maxItems: 5 }
  ];
  await assert.rejects(
    () => buildMediaCatalog({ sources, fetchImpl: async () => { throw new Error('offline'); }, env: {}, now: new Date('2026-09-14T12:00:00Z'), editorial: [] }),
    /All multimedia sources failed/
  );
});

test('source maxItems prevents one provider from flooding multimedia', async () => {
  const items = Array.from({ length: 6 }, (_, index) => `<item><title>E${index}</title><link>https://good.example/e${index}</link><pubDate>Sat, 12 Sep 2026 10:00:00 GMT</pubDate></item>`).join('');
  const sources = [
    { id: 'good', name: 'Good', homepage: 'https://good.example/', endpoint: 'https://good.example/feed', section: 'accessibility', type: 'audio', lang: 'es', adapter: 'feed', enabled: true, maxItems: 3 }
  ];
  const result = await buildMediaCatalog({
    sources,
    fetchImpl: async () => ({ ok: true, text: async () => `<?xml version="1.0"?><rss><channel>${items}</channel></rss>` }),
    env: {},
    now: new Date('2026-09-14T12:00:00Z'),
    editorial: []
  });
  assert.equal(result.items.length, 3);
});

test('technology source remains technology even when its video title mentions accessibility', async () => {
  const sources = [{
    id: 'tech', name: 'Tech', homepage: 'https://youtube.example/', section: 'technology', type: 'video', lang: 'es',
    adapter: 'youtube-handle', youtubeHandle: '@Tech', enabled: true, maxItems: 5
  }];
  const responses = [
    { items: [{ contentDetails: { relatedPlaylists: { uploads: 'UPLOADS' } } }] },
    { items: [{ contentDetails: { videoId: 'abcdefghijk', videoPublishedAt: '2026-09-12T10:00:00Z' }, snippet: { title: 'Accesibilidad en el nuevo móvil', description: '' } }] }
  ];
  const fetchImpl = async () => ({ ok: true, json: async () => responses.shift() });
  const result = await buildMediaCatalog({ sources, fetchImpl, env: { YOUTUBE_API_KEY: 'test-key' }, now: new Date('2026-09-14T12:00:00Z'), editorial: [] });
  assert.equal(result.items[0].section, 'technology');
});

test('editorial localization cannot overwrite source metadata', () => {
  const item = {
    id: 'source-1',
    type: 'audio',
    section: 'accessibility',
    sourceId: 'source',
    sourceName: 'Source',
    sourceUrl: 'https://source.example/',
    originalUrl: 'https://source.example/e1',
    originalLanguage: 'en',
    publishedAt: '2026-09-12T10:00:00.000Z',
    title: 'Original title',
    summary: 'Original summary'
  };
  const editorial = [{
    id: 'source-1',
    state: 'adapted',
    locales: {
      es: { title: 'Título natural en español', summary: 'Resumen natural.' },
      en: { title: 'Natural English title', summary: 'Natural summary.' }
    },
    featuredRank: 2,
    section: 'technology',
    sourceId: 'tampered',
    originalUrl: 'https://evil.example/',
    originalLanguage: 'es',
    publishedAt: '2000-01-01T00:00:00Z'
  }];
  const [merged] = mergeMediaEditorial([item], editorial);
  assert.equal(merged.section, 'accessibility');
  assert.equal(merged.sourceId, 'source');
  assert.equal(merged.originalUrl, 'https://source.example/e1');
  assert.equal(merged.originalLanguage, 'en');
  assert.equal(merged.publishedAt, '2026-09-12T10:00:00.000Z');
  assert.equal(merged.featuredRank, 2);
  assert.equal(merged.locales.es.title, 'Título natural en español');
  assert.equal(merged.locales.en.title, 'Natural English title');
});

test('withheld editorial multimedia is removed from public output', () => {
  const item = { id: 'hide-me', originalUrl: 'https://source.example/hide', publishedAt: '2026-09-12T10:00:00Z' };
  assert.deepEqual(mergeMediaEditorial([item], [{ id: 'hide-me', state: 'withheld' }]), []);
});

test('media ordering avoids more than two consecutive items from one source when alternatives remain', () => {
  const input = [
    { id: 'a1', sourceId: 'a', publishedAt: '2026-09-14T10:00:00Z' },
    { id: 'a2', sourceId: 'a', publishedAt: '2026-09-14T09:00:00Z' },
    { id: 'a3', sourceId: 'a', publishedAt: '2026-09-14T08:00:00Z' },
    { id: 'b1', sourceId: 'b', publishedAt: '2026-09-14T07:00:00Z' }
  ];
  assert.deepEqual(orderMediaItems(input).map(item => item.id), ['a1', 'a2', 'b1', 'a3']);
});
