import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { searchResultAction } from '../src/core/search.mjs';
import { createReaderSession } from '../src/core/reader-session.mjs';
import { loadReadableTarget } from '../src/core/readable-loader.mjs';

const source = path => readFile(new URL(path, import.meta.url), 'utf8');

test('global search preserves exact destination identity', () => {
  assert.deepEqual(searchResultAction({ kind: 'video', id: 'dQw4w9WgXcQ' }), { type: 'video', id: 'dQw4w9WgXcQ' });
  assert.deepEqual(searchResultAction({ kind: 'resource', source: { openUrl: 'https://example.test/doc' } }), { type: 'resource', url: 'https://example.test/doc' });
  assert.deepEqual(searchResultAction({ kind: 'news', source: { originalUrl: 'https://example.test/news' } }), { type: 'news', url: 'https://example.test/news' });
  assert.equal(searchResultAction({ kind: 'future-kind' }), null);
});

test('normal reader session rejects stale requests and keeps page history', () => {
  const session = createReaderSession();
  const first = session.begin({ url: 'https://one.test', title: 'One', allowOriginalFallback: true });
  const request = session.beginRequest();
  session.push({ url: 'https://one.test', title: 'One', blocks: [] });
  session.push({ url: 'https://two.test', title: 'Two', blocks: [] });
  assert.equal(session.pop().url, 'https://one.test');
  session.begin({ url: 'https://three.test', title: 'Three' });
  assert.equal(session.isCurrentRequest(request), false);
  assert.equal(session.snapshot().generation, first.generation + 1);
});

test('common readable loader reclassifies redirected targets', async () => {
  const resolveDownload = url => ({ provider: url.endsWith('.pdf') ? 'direct' : 'web' });
  const result = await loadReadableTarget({
    url: 'https://short.example/x',
    resolveDownload,
    webFetch: async () => ({ finalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', contentType: 'text/html', body: '<html></html>' })
  });
  assert.equal(result.kind, 'youtube');
});

test('Actualidad delegates its title to the common reader', async () => {
  const actualidad = await source('../src/screens/actualidad.mjs');
  assert.match(actualidad, /onOpenNews/);
  assert.match(actualidad, /news-open-\$\{item\.id\}/);
  assert.match(actualidad, /onOpenNews\(item,\s*openButton\.id\)/);
});

test('Search delegates a result instead of navigating only to its section', async () => {
  const search = await source('../src/screens/search.mjs');
  assert.match(search, /onOpenResult\(result,\s*button\.id\)/);
  assert.doesNotMatch(search, /router\.navigate\(result\.route/);
});

test('Videos supports exact initial video and two-level back navigation', async () => {
  const videos = await source('../src/screens/videos.mjs');
  const app = await source('../src/app.mjs');
  assert.match(videos, /initialVideoId/);
  assert.match(videos, /onBackStateChange/);
  assert.match(videos, /nav\.backHome/);
  assert.match(app, /handleScreenBack/);
});

test('the web videos page has no local search form but keeps sorting', async () => {
  const html = await source('../../videos.html');
  assert.doesNotMatch(html, /id="video-search-form"/);
  assert.doesNotMatch(html, /id="video-search"/);
  assert.match(html, /id="video-sort"/);
});
