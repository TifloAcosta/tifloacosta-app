import assert from 'node:assert/strict';
import test from 'node:test';
import { extractReadableText } from '../scripts/actualidad-feed.mjs';

const articleParagraphs = [
  'The first useful paragraph explains the story clearly and contains enough substance to be unmistakably part of the article.',
  'The second useful paragraph continues the reporting with practical detail for the reader and remains part of the real story.',
  'The third useful paragraph closes the actual article before the publisher adds site-specific promotional material.'
];

function articleWith(...trailing) {
  return `<article>${[...articleParagraphs, ...trailing].map(value => `<p>${value}</p>`).join('')}</article>`;
}

test('reader stops before affiliate disclosures and publisher promotions', () => {
  const html = articleWith(
    'FTC: We use income earning auto affiliate links. More.',
    'Check out ExampleSite on YouTube for more technology news:',
    'The easiest way to get into smart home technology. Great for gifts.'
  );

  const text = extractReadableText(html);
  assert.equal(text, articleParagraphs.join('\n\n'));
  assert.doesNotMatch(text, /FTC|affiliate|YouTube|Great for gifts/i);
});

test('reader stops before end-of-article comment calls and author boilerplate', () => {
  const html = articleWith(
    'What do you think about this new feature? Let me know in the comments.',
    'Security Bite is our weekly deep dive into the world of technology security.',
    'Follow the author on social media.'
  );

  const text = extractReadableText(html);
  assert.equal(text, articleParagraphs.join('\n\n'));
  assert.doesNotMatch(text, /comments|weekly deep dive|Follow the author/i);
});
