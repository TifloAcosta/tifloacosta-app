import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('web video player matches Android 30-second seek behavior', async () => {
  const [web, html, mobile] = await Promise.all([
    read('videos.js'),
    read('videos.html'),
    read('mobile/src/screens/video-player.mjs')
  ]);
  assert.ok(web.includes('const SEEK_SECONDS = 30'));
  assert.ok(mobile.includes('const SEEK_SECONDS = 30'));
  assert.ok(web.includes('Retroceder 30 segundos'));
  assert.ok(web.includes('Avanzar 30 segundos'));
  assert.ok(html.includes('Retroceder 30 segundos'));
  assert.ok(html.includes('Avanzar 30 segundos'));
  assert.ok(web.includes('trigger.focus()'));
});

test('web podcast has its own accessible player with Android-equivalent controls', async () => {
  const [html, source, mobile] = await Promise.all([
    read('podcast.html'),
    read('podcast.js'),
    read('mobile/src/screens/podcast.mjs')
  ]);
  for (const id of [
    'podcast-player',
    'podcast-audio',
    'podcast-rewind',
    'podcast-toggle',
    'podcast-forward',
    'podcast-position',
    'podcast-time',
    'podcast-episodes'
  ]) {
    assert.ok(html.includes(`id="${id}"`), `Missing podcast control ${id}`);
  }
  assert.ok(source.includes('const SEEK_SECONDS = 30'));
  assert.ok(mobile.includes("audio.currentTime - 30"));
  assert.ok(mobile.includes("audio.currentTime + 30"));
  assert.ok(source.includes("audio.currentTime - SEEK_SECONDS"));
  assert.ok(source.includes("audio.currentTime + SEEK_SECONDS"));
  assert.ok(source.includes("aria-valuetext"));
  assert.ok(source.includes("aria-current"));
  assert.ok(source.includes("mediaSession"));
  assert.ok(source.includes("MediaMetadata"));
  assert.ok(source.includes("FEED_URL"));
});

test('home navigation and PWA shell expose the web podcast player', async () => {
  const [home, worker] = await Promise.all([read('index.html'), read('sw.js')]);
  assert.ok(home.includes('id="home-open-podcast" href="podcast.html"'));
  assert.ok(worker.includes("'./podcast.html'"));
  assert.ok(worker.includes("'./podcast.js?v=1.0'"));
  assert.ok(worker.includes("url.pathname.endsWith('/podcast.js')"));
});
