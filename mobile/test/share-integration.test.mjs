import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = async path => {
  try { return await readFile(new URL(`../${path}`, import.meta.url), 'utf8'); }
  catch { return ''; }
};

test('existing destination screens accept controlled shared-flow prefill', async () => {
  const [downloadScreen, searchScreen, videosScreen] = await Promise.all([
    read('src/screens/download-link.mjs'),
    read('src/screens/search.mjs'),
    read('src/screens/videos.mjs')
  ]);
  assert.match(downloadScreen, /initialUrl/);
  assert.match(downloadScreen, /analyzeOnOpen/);
  assert.match(searchScreen, /initialQuery/);
  assert.match(searchScreen, /if \(!hasSharedInitialQuery && lastQuery\)/);
  assert.doesNotMatch(searchScreen, /if \(initialQuery\)[^{]*renderResults\(/);
  assert.match(videosScreen, /createAccessibleVideoPlayer/);
});

test('reusable player module supports an external shared YouTube video without autoplay', async () => {
  const source = await read('src/screens/video-player.mjs');
  assert.match(source, /export function createAccessibleVideoPlayer/);
  assert.match(source, /export function videoItemFromShared/);
  assert.match(source, /cueVideoById/);
  assert.doesNotMatch(source, /onReady[\s\S]{0,300}playVideo\(\)/);
  assert.match(source, /seekTo/);
  assert.match(source, /pauseVideo/);
});

test('shared video helper creates a standalone player item outside the catalog', async () => {
  const { createSharedVideoItem, videoItemFromShared } = await import('../src/screens/video-player.mjs');
  assert.equal(createSharedVideoItem, videoItemFromShared);
  assert.deepEqual(
    createSharedVideoItem({ videoId: 'dQw4w9WgXcQ', url: 'https://youtu.be/dQw4w9WgXcQ', title: 'Shared video' }),
    { id: 'dQw4w9WgXcQ', url: 'https://youtu.be/dQw4w9WgXcQ', title: 'Shared video' }
  );
  assert.equal(videoItemFromShared({ videoId: 'bad', url: 'https://example.com', title: 'Bad' }), null);
});

test('a short web URL that redirects to YouTube is reclassified before reader parsing', async () => {
  const { resolveSharedUrl } = await import('../src/screens/share.mjs');
  const result = await resolveSharedUrl({
    url: 'https://short.example/video',
    resolveDownload: () => ({ provider: 'web', kind: 'needs-analyzer' }),
    webFetch: async () => ({
      ok: true,
      finalUrl: 'https://youtu.be/dQw4w9WgXcQ',
      status: 200,
      contentType: 'text/html',
      body: '<main><h1>Should never be parsed</h1></main>'
    })
  });
  assert.equal(result.kind, 'youtube');
  assert.equal(result.classification.videoId, 'dQw4w9WgXcQ');
  assert.equal(result.page, undefined);
});
