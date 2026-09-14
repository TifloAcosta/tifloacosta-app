import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMediaCatalog } from '../scripts/sync-actualidad-media.mjs';

const source = (overrides = {}) => ({
  id: 'source',
  name: 'Source',
  homepage: 'https://source.example/',
  endpoint: 'https://source.example/feed',
  section: 'accessibility',
  type: 'audio',
  lang: 'es',
  adapter: 'feed',
  enabled: true,
  maxItems: 5,
  ...overrides
});

const response = xml => ({ ok: true, text: async () => xml });

const oneItemFeed = (title = 'Episodio', url = 'https://source.example/e1') => `<?xml version="1.0"?><rss><channel><item><title>${title}</title><link>${url}</link><pubDate>Sat, 12 Sep 2026 10:00:00 GMT</pubDate><description>Resumen</description></item></channel></rss>`;

test('a source that responds but parses zero valid items is a source failure', async () => {
  await assert.rejects(
    () => buildMediaCatalog({
      sources: [source()],
      fetchImpl: async () => response('<?xml version="1.0"?><rss><channel></channel></rss>'),
      env: {},
      now: new Date('2026-09-14T12:00:00Z'),
      editorial: []
    }),
    /All multimedia sources failed/
  );
});

test('every enabled multimedia section must have at least one retained item', async () => {
  const sources = [
    source({ id: 'access', endpoint: 'https://access.example/feed' }),
    source({ id: 'tech', endpoint: 'https://tech.example/feed', homepage: 'https://tech.example/', section: 'technology' })
  ];
  const fetchImpl = async url => {
    if (String(url).includes('access.example')) return response(oneItemFeed('Accesibilidad', 'https://access.example/e1'));
    return response('<?xml version="1.0"?><rss><channel></channel></rss>');
  };
  await assert.rejects(
    () => buildMediaCatalog({ sources, fetchImpl, env: {}, now: new Date('2026-09-14T12:00:00Z'), editorial: [] }),
    /Multimedia section unavailable: technology/
  );
});
