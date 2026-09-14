import assert from 'node:assert/strict';
import test from 'node:test';
import { syncActualidad } from '../scripts/sync-actualidad.mjs';

const TEST_NOW = new Date('2026-09-13T12:00:00Z');

const source = overrides => ({
  id: 'source-a',
  name: 'Source A',
  homepage: 'https://example.com/',
  feedUrl: 'https://example.com/feed.xml',
  lang: 'en',
  categories: ['apple'],
  enabled: true,
  ...overrides
});

const rss = ({ title = 'Story', url = 'https://example.com/story', date = 'Sun, 13 Sep 2026 12:00:00 GMT' } = {}) => `<?xml version="1.0"?><rss><channel><item><title>${title}</title><link>${url}</link><pubDate>${date}</pubDate><description>Summary</description></item></channel></rss>`;

function response(text, ok = true) {
  return { ok, status: ok ? 200 : 503, text: async () => text };
}

test('one failed source does not discard valid stories from another source', async () => {
  const sources = [source(), source({ id: 'source-b', feedUrl: 'https://example.org/feed.xml', homepage: 'https://example.org/' })];
  const fetchFn = async url => {
    if (url.includes('example.org')) throw new Error('offline');
    return response(rss());
  };

  const result = await syncActualidad({ sources, editorial: [], fetchFn, now: TEST_NOW });
  assert.equal(result.stories.length, 1);
  assert.deepEqual(result.failedSources, ['source-b']);
});

test('temporary source failures are retried before the source is discarded', async () => {
  let attempts = 0;
  const fetchFn = async () => {
    attempts += 1;
    if (attempts === 1) throw new Error('temporary network failure');
    return response(rss());
  };

  const result = await syncActualidad({ sources: [source()], editorial: [], fetchFn, now: TEST_NOW });
  assert.equal(attempts, 2);
  assert.equal(result.stories.length, 1);
  assert.deepEqual(result.failedSources, []);
});

test('all enabled sources failing rejects instead of returning an empty feed', async () => {
  await assert.rejects(
    syncActualidad({ sources: [source()], editorial: [], fetchFn: async () => { throw new Error('offline'); }, now: TEST_NOW }),
    /All enabled Actualidad sources failed/
  );
});

test('duplicate canonical URLs appear only once', async () => {
  const sources = [source(), source({ id: 'source-b', feedUrl: 'https://example.org/feed.xml', homepage: 'https://example.org/' })];
  const fetchFn = async () => response(rss({ url: 'https://example.com/story?utm_source=rss' }));

  const result = await syncActualidad({ sources, editorial: [], fetchFn, now: TEST_NOW });
  assert.equal(result.stories.length, 1);
  assert.equal(result.stories[0].originalUrl, 'https://example.com/story');
});

test('CTI HTML sources are normalized into the shared feed', async () => {
  const html = `
    <h2><a href="/noticias/app-agosto">Evaluaciones de APP actualizadas en agosto</a></h2>
    <span>11/09/2026</span>
    <p>Nuevas evaluaciones de aplicaciones accesibles.</p>`;
  const cti = source({
    id: 'cti-once',
    name: 'CTI de la ONCE',
    homepage: 'https://cti.once.es/',
    feedUrl: 'https://cti.once.es/noticias',
    format: 'cti-html',
    lang: 'es',
    categories: ['tecnologia-accesibilidad']
  });

  const result = await syncActualidad({ sources: [cti], editorial: [], fetchFn: async () => response(html), now: TEST_NOW });
  assert.equal(result.stories.length, 1);
  assert.equal(result.stories[0].sourceId, 'cti-once');
  assert.equal(result.stories[0].lang, 'es');
  assert.equal(result.stories[0].title, 'Evaluaciones de APP actualizadas en agosto');
});

test('per-source limits prevent one source from flooding the feed', async () => {
  const xml = `<?xml version="1.0"?><rss><channel>
    <item><title>Newest</title><link>https://example.com/newest</link><pubDate>Sun, 13 Sep 2026 12:00:00 GMT</pubDate><description>Newest</description></item>
    <item><title>Middle</title><link>https://example.com/middle</link><pubDate>Sat, 12 Sep 2026 12:00:00 GMT</pubDate><description>Middle</description></item>
    <item><title>Oldest</title><link>https://example.com/oldest</link><pubDate>Fri, 11 Sep 2026 12:00:00 GMT</pubDate><description>Oldest</description></item>
  </channel></rss>`;

  const result = await syncActualidad({
    sources: [source({ maxItems: 2 })],
    editorial: [],
    fetchFn: async () => response(xml),
    now: TEST_NOW
  });

  assert.deepEqual(result.stories.map(item => item.title), ['Newest', 'Middle']);
});

test('output order is deterministic regardless of source order', async () => {
  const newer = source({ id: 'newer', feedUrl: 'https://new.example/feed.xml', homepage: 'https://new.example/' });
  const older = source({ id: 'older', feedUrl: 'https://old.example/feed.xml', homepage: 'https://old.example/' });
  const fetchFn = async url => url.includes('new.example')
    ? response(rss({ title: 'New', url: 'https://new.example/story', date: 'Sun, 13 Sep 2026 14:00:00 GMT' }))
    : response(rss({ title: 'Old', url: 'https://old.example/story', date: 'Sun, 13 Sep 2026 10:00:00 GMT' }));

  const first = await syncActualidad({ sources: [older, newer], editorial: [], fetchFn, now: TEST_NOW });
  const second = await syncActualidad({ sources: [newer, older], editorial: [], fetchFn, now: TEST_NOW });
  assert.deepEqual(first.stories, second.stories);
  assert.deepEqual(first.stories.map(item => item.title), ['New', 'Old']);
});

test('stories older than 90 days are excluded from the shared feed', async () => {
  const xml = `<?xml version="1.0"?><rss><channel>
    <item><title>Recent</title><link>https://example.com/recent</link><pubDate>Sat, 12 Sep 2026 12:00:00 GMT</pubDate><description>Recent summary</description></item>
    <item><title>Stale</title><link>https://example.com/stale</link><pubDate>Fri, 01 May 2026 12:00:00 GMT</pubDate><description>Stale summary</description></item>
  </channel></rss>`;

  const result = await syncActualidad({
    sources: [source()],
    editorial: [],
    fetchFn: async () => response(xml),
    now: TEST_NOW
  });

  assert.deepEqual(result.stories.map(item => item.title), ['Recent']);
});

test('withheld editorial stories are excluded and valid adaptations remain public', async () => {
  const fetchFn = async () => response(rss());
  const first = await syncActualidad({ sources: [source()], editorial: [], fetchFn, now: TEST_NOW });
  const id = first.stories[0].id;

  const adapted = await syncActualidad({
    sources: [source()],
    editorial: [{ id, editorialState: 'adapted', lang: 'es', title: 'Historia adaptada', body: 'Texto propio.' }],
    fetchFn,
    now: TEST_NOW
  });
  assert.equal(adapted.stories[0].editorialState, 'adapted');
  assert.equal(adapted.stories[0].lang, 'es');

  const withheld = await syncActualidad({
    sources: [source()],
    editorial: [{ id, editorialState: 'withheld' }],
    fetchFn,
    now: TEST_NOW
  });
  assert.deepEqual(withheld.stories, []);
});
