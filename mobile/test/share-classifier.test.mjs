import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveLocal } from '../src/core/downloads.mjs';
import { extractHttpUrls, youtubeVideoId, classifySharedText, classifySharedUrl } from '../src/core/share-classifier.mjs';

test('extractHttpUrls trims punctuation without damaging query strings', () => {
  assert.deepEqual(
    extractHttpUrls('Mira (https://example.com/a?x=1&y=2), y luego https://example.org/b.'),
    ['https://example.com/a?x=1&y=2', 'https://example.org/b']
  );
});

test('youtubeVideoId accepts watch, youtu.be, shorts, embed and live URLs', () => {
  assert.equal(youtubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30'), 'dQw4w9WgXcQ');
  assert.equal(youtubeVideoId('https://youtu.be/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(youtubeVideoId('https://www.youtube.com/shorts/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(youtubeVideoId('https://m.youtube.com/embed/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(youtubeVideoId('https://music.youtube.com/live/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
});

test('classifySharedText never chooses silently when there are several URLs', () => {
  const result = classifySharedText('Uno https://a.example y dos https://b.example', { resolveDownload: resolveLocal });
  assert.equal(result.kind, 'multi-url');
  assert.deepEqual(result.urls, ['https://a.example/', 'https://b.example/']);
});

test('classifySharedText deduplicates equivalent URLs while preserving order', () => {
  const result = classifySharedText('https://example.com https://example.com/ https://other.example', { resolveDownload: resolveLocal });
  assert.equal(result.kind, 'multi-url');
  assert.deepEqual(result.urls, ['https://example.com/', 'https://other.example/']);
});

test('classifySharedUrl prefers YouTube, then known downloads, then normal web', () => {
  assert.equal(classifySharedUrl('https://youtu.be/dQw4w9WgXcQ', { resolveDownload: resolveLocal }).kind, 'youtube');
  assert.equal(classifySharedUrl('https://www.dropbox.com/s/test/file.pdf', { resolveDownload: resolveLocal }).kind, 'download');
  assert.equal(classifySharedUrl('https://example.com/article', { resolveDownload: resolveLocal }).kind, 'web');
  assert.equal(classifySharedUrl('javascript:alert(1)', { resolveDownload: resolveLocal }).kind, 'invalid');
});

test('classifySharedText keeps pure text as text', () => {
  const result = classifySharedText('Cómo configuro VoiceOver', { resolveDownload: resolveLocal });
  assert.deepEqual(result, {
    kind: 'text',
    text: 'Cómo configuro VoiceOver',
    urls: []
  });
});
