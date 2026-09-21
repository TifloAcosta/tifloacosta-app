import assert from 'node:assert/strict';
import test from 'node:test';
import { syncActualidad } from '../scripts/sync-actualidad.mjs';

const TEST_NOW = new Date('2026-09-21T12:00:00Z');

const source = {
  id: 'source-a',
  name: 'Source A',
  homepage: 'https://example.com/',
  feedUrl: 'https://example.com/feed.xml',
  lang: 'en',
  categories: ['apple'],
  enabled: true
};

const rss = `<?xml version="1.0"?><rss><channel><item><title>Story</title><link>https://example.com/story</link><pubDate>Mon, 21 Sep 2026 12:00:00 GMT</pubDate><description>Summary</description></item></channel></rss>`;

function response(text, ok = true) {
  return { ok, status: ok ? 200 : 503, text: async () => text };
}

const previousStories = [{
  id: 'source-a-existing-story',
  type: 'news',
  sourceId: 'source-a',
  sourceName: 'Source A',
  sourceUrl: 'https://example.com/',
  originalUrl: 'https://example.com/story',
  originalLanguage: 'en',
  publishedAt: '2026-09-21T12:00:00.000Z',
  categories: ['apple'],
  editorialState: 'source-only',
  featuredRank: null,
  locales: {
    en: {
      title: 'Story',
      summary: 'Summary',
      body: [
        'First useful paragraph with enough information to belong to the article body and explain the subject clearly.',
        'Second useful paragraph continues the article with practical detail for the reader and remains part of the real story.',
        'Third useful paragraph closes the actual article before the publisher adds its own site furniture.',
        'Topics',
        'When you purchase through links in our articles, we may earn a small commission.',
        'Consumer News Editor',
        'Last day to book an exhibit table. Do not miss out.',
        'A new kind of AI model is thrilling developers'
      ].join('\n\n')
    }
  },
  media: null
}];

test('previously stored readable bodies are cleaned again with the current noise rules', async () => {
  let articleFetches = 0;
  const fetchFn = async url => {
    if (url === source.feedUrl) return response(rss);
    articleFetches += 1;
    return response('<article><p>Unexpected refetch.</p></article>');
  };

  const result = await syncActualidad({
    sources: [source],
    editorial: [],
    fetchFn,
    now: TEST_NOW,
    previousStories
  });

  assert.equal(articleFetches, 0);
  assert.equal(
    result.stories[0].locales.en.body,
    [
      'First useful paragraph with enough information to belong to the article body and explain the subject clearly.',
      'Second useful paragraph continues the article with practical detail for the reader and remains part of the real story.',
      'Third useful paragraph closes the actual article before the publisher adds its own site furniture.'
    ].join('\n\n')
  );
  assert.doesNotMatch(result.stories[0].locales.en.body, /Topics|commission|Consumer News Editor|exhibit table|thrilling developers/i);
});
