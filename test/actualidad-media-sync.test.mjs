import assert from 'node:assert/strict';
import test from 'node:test';
import { parseTifloAudioHtml, youtubeEntriesFromApi } from '../scripts/actualidad-media-adapters.mjs';
import { buildMediaCatalog } from '../scripts/sync-actualidad-media.mjs';

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
  const result = await buildMediaCatalog({ sources, fetchImpl, env: {}, now: new Date('2026-09-14T12:00:00Z') });
  assert.equal(result.items.length, 1);
  assert.deepEqual(result.failures.map(item => item.sourceId), ['bad']);
});

test('all enabled sources failing rejects instead of returning an empty catalog', async () => {
  const sources = [
    { id: 'bad', name: 'Bad', homepage: 'https://bad.example/', endpoint: 'https://bad.example/feed', section: 'accessibility', type: 'audio', lang: 'es', adapter: 'feed', enabled: true, maxItems: 5 }
  ];
  await assert.rejects(
    () => buildMediaCatalog({ sources, fetchImpl: async () => { throw new Error('offline'); }, env: {}, now: new Date('2026-09-14T12:00:00Z') }),
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
    now: new Date('2026-09-14T12:00:00Z')
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
  const result = await buildMediaCatalog({ sources, fetchImpl, env: { YOUTUBE_API_KEY: 'test-key' }, now: new Date('2026-09-14T12:00:00Z') });
  assert.equal(result.items[0].section, 'technology');
});
