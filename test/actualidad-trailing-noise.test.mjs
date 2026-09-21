import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeFeedEntry } from '../scripts/actualidad-feed.mjs';

const source = {
  id: 'general-tech',
  name: 'General Tech',
  homepage: 'https://example.com/',
  feedUrl: 'https://example.com/feed/',
  lang: 'en',
  categories: ['tecnologia-general'],
  enabled: true
};

test('reader stops before trailing publisher topics, promos and recommendations', () => {
  const item = normalizeFeedEntry({
    title: 'A useful technology article',
    url: 'https://example.com/useful-article',
    publishedAt: '2026-09-21T12:00:00Z',
    summary: 'Short summary',
    contentHtml: `
      <article>
        <p>First useful paragraph with enough information to belong to the article body and explain the subject clearly.</p>
        <p>Second useful paragraph continues the article with practical detail for the reader and remains part of the real story.</p>
        <p>Third useful paragraph closes the actual article before the publisher adds its own site furniture.</p>
        <p>Topics</p>
        <p>When you purchase through links in our articles, we may earn a small commission.</p>
        <p>Consumer News Editor</p>
        <p>Last day to book an exhibit table. Do not miss out.</p>
        <p>A new kind of AI model is thrilling developers</p>
      </article>`
  }, source);

  assert.equal(
    item.body,
    [
      'First useful paragraph with enough information to belong to the article body and explain the subject clearly.',
      'Second useful paragraph continues the article with practical detail for the reader and remains part of the real story.',
      'Third useful paragraph closes the actual article before the publisher adds its own site furniture.'
    ].join('\n\n')
  );
  assert.doesNotMatch(item.body, /Topics|commission|Consumer News Editor|exhibit table|thrilling developers/i);
});

// Regression for publisher content that lives inside the article container.
