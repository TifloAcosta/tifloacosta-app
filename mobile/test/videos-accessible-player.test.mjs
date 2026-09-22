import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { text } from '../src/core/i18n.mjs';

const read = file => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

test('mobile videos keep the existing bilingual accessible player labels', () => {
  const keys = ['videos.play','videos.rewindOneMinute','videos.playControl','videos.pauseControl','videos.forwardOneMinute','videos.closePlayer','videos.openYouTube'];
  for (const lang of ['es', 'en']) {
    for (const key of keys) assert.notEqual(text(lang, key), key, `Missing ${lang} ${key}`);
  }
});

test('mobile videos delegate embedded playback to one reusable accessible player', async () => {
  const [screen, player] = await Promise.all([
    read('src/screens/videos.mjs'),
    read('src/screens/video-player.mjs')
  ]);
  assert.match(screen, /createAccessibleVideoPlayer/);
  assert.match(player, /youtube\.com\/iframe_api/);
  assert.match(player, /getCurrentTime/);
  assert.match(player, /seekTo\(/);
  assert.match(player, /playVideo\(/);
  assert.match(player, /pauseVideo\(/);
  assert.match(player, /autoplay:\s*0/);
  assert.match(player, /cueVideoById/);
});

test('initialVideoId prepares the exact selected video without an autoplay call', async () => {
  const [screen, player] = await Promise.all([
    read('src/screens/videos.mjs'),
    read('src/screens/video-player.mjs')
  ]);
  assert.match(screen, /initialVideoId\s*=\s*['"]/);
  assert.match(screen, /matchesInitialVideo/);
  assert.match(screen, /queueMicrotask/);
  assert.doesNotMatch(screen, /\.playVideo\(/);
  assert.match(player, /autoplay:\s*0/);
});

test('external YouTube remains an explicit fallback rather than the primary player', async () => {
  const screen = await read('src/screens/videos.mjs');
  assert.match(screen, /addExternalLink\(/);
  assert.match(screen, /videos\.openYouTube/);
});
