import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('search keeps the exact result identity for videos, resources and news', async () => {
  const module = await import('../src/core/search.mjs');
  assert.equal(typeof module.searchResultAction, 'function');

  assert.deepEqual(
    module.searchResultAction({ kind: 'video', id: 'video-1', source: { id: 'video-1' } }),
    { type: 'video', id: 'video-1' }
  );
  assert.deepEqual(
    module.searchResultAction({ kind: 'resource', id: 'doc-1', source: { openUrl: 'https://example.test/doc' } }),
    { type: 'resource', url: 'https://example.test/doc' }
  );
  assert.deepEqual(
    module.searchResultAction({ kind: 'news', id: 'news-1', source: { originalUrl: 'https://example.test/news' } }),
    { type: 'news', url: 'https://example.test/news' }
  );
});

test('search screen delegates the chosen exact result instead of navigating only to its section', async () => {
  const source = await read('src/screens/search.mjs');
  assert.match(source, /onOpenResult/);
  assert.match(source, /onOpenResult\(result,\s*button\.id\)/);
  assert.doesNotMatch(source, /router\.navigate\(result\.route/);
});

test('video destination can open the exact video selected by Search', async () => {
  const source = await read('src/screens/videos.mjs');
  assert.match(source, /initialVideoId/);
  assert.match(source, /matchesInitialVideo\(item,\s*initialVideoId\)/);
  assert.match(source, /createAccessibleVideoPlayer/);
  assert.match(source, /openVideo\(initialTarget\.item,\s*initialTarget\.button\)/);
  assert.doesNotMatch(source, /\.playVideo\(/);
});

test('Actualidad headlines open the exact news item through the common reader and keep the original source as a secondary action', async () => {
  const source = await read('src/screens/actualidad.mjs');
  assert.match(source, /heading\.append\(openButton\)/);
  assert.match(source, /openButton\.textContent\s*=\s*item\.title/);
  assert.match(source, /openButton\.id\s*=\s*`news-open-\$\{item\.id\}`/);
  assert.match(source, /onOpenNews\?\.\(item,\s*openButton\.id\)/);
  assert.match(source, /label:\s*t\('actualidad\.original'\)/);
  assert.doesNotMatch(source, /openButton\.addEventListener\([\s\S]{0,160}nativeActions\?\.openExternal/);
});

test('Android maintenance release is version 1.0.4 code 5', async () => {
  const gradle = await read('android/app/build.gradle');
  assert.match(gradle, /versionCode\s+5/);
  assert.match(gradle, /versionName\s+"1\.0\.4"/);
});
