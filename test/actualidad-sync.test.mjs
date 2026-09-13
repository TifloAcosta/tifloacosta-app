import assert from 'node:assert/strict';
import test from 'node:test';
import { syncActualidad } from '../scripts/sync-actualidad.mjs';

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

  const result = await syncActualidad({ sources, editorial: [], fetchFn });
  assert.equal(result.stories.length, 1);
  assert.deepEqual(result.failedSources, ['source-b']);
});

test('all enabled sources failing rejects instead of returning an empty feed', async () => {
  await assert.rejects(
    syncActualidad({ sources: [source()], editorial: [], fetchFn: async () => { throw new Error('offline'); } }),
    /All enabled Actualidad sources failed/
  );
});

test('duplicate canonical URLs appear only once', async () => {
  const sources = [source(), source({ id: 'source-b', feedUrl: 'https://example.org/feed.xml', homepage: 'https://example.org/' })];
  const fetchFn = async () => response(rss({ url: 'https://example.com/story?utm_source=rss' }));

  const result = await syncActualidad({ sources, editorial: [], fetchFn });
  assert.equal(result.stories.length, 1);
  assert.equal(result.stories[0].originalUrl, 'https://example.com/story');
});

test('output order is deterministic regardless of source order', async () => {
  const newer = source({ id: 'newer', feedUrl: 'https://new.example/feed.xml', homepage: 'https://new.example/' });
  const older = source({ id: 'older', feedUrl: 'https://old.example/feed.xml', homepage: 'https://old.example/' });
  const fetchFn = async url => url.includes('new.example')
    ? response(rss({ title: 'New', url: 'https://new.example/story', date: 'Sun, 13 Sep 2026 14:00:00 GMT' }))
    : response(rss({ title: 'Old', url: 'https://old.example/story', date: 'Sun, 13 Sep 2026 10:00:00 GMT' }));

  const first = await syncActualidad({ sources: [older, newer], editorial: [], fetchFn });
  const second = await syncActualidad({ sources: [newer, older], editorial: [], fetchFn });
  assert.deepEqual(first.stories, second.stories);
  assert.deepEqual(first.stories.map(item => item.title), ['New', 'Old']);
});

test('withheld editorial stories are excluded and valid adaptations remain public', async () => {
  const fetchFn = async () => response(rss());
  const first = await syncActualidad({ sources: [source()], editorial: [], fetchFn });
  const id = first.stories[0].id;

  const adapted = await syncActualidad({
    sources: [source()],
    editorial: [{ id, editorialState: 'adapted', lang: 'es', title: 'Historia adaptada', body: 'Texto propio.' }],
    fetchFn
  });
  assert.equal(adapted.stories[0].editorialState, 'adapted');
  assert.equal(adapted.stories[0].lang, 'es');

  const withheld = await syncActualidad({ sources: [source()], editorial: [{ id, editorialState: 'withheld' }], fetchFn });
  assert.deepEqual(withheld.stories, []);
});
