import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('video player exposes three accessible controls with one-minute jumps', async () => {
  const [html, source] = await Promise.all([read('videos.html'), read('videos.js')]);

  assert.match(html, /id="video-player-rewind"[^>]*disabled[^>]*>Retroceder 1 minuto</);
  assert.match(html, /id="video-player-toggle"[^>]*disabled[^>]*>Reproducir</);
  assert.match(html, /id="video-player-forward"[^>]*disabled[^>]*>Avanzar 1 minuto</);
  assert.match(source, /const SEEK_SECONDS = 60;/);
  assert.match(source, /rewindOneMinute:\s*'Retroceder 1 minuto'/);
  assert.match(source, /forwardOneMinute:\s*'Avanzar 1 minuto'/);
  assert.match(source, /rewindOneMinute:\s*'Rewind 1 minute'/);
  assert.match(source, /forwardOneMinute:\s*'Forward 1 minute'/);
});

test('custom controls drive the official YouTube iframe player and preserve focus return', async () => {
  const source = await read('videos.js');

  assert.match(source, /enablejsapi=1/);
  assert.match(source, /new YT\.Player\(els\.playerFrame/);
  assert.match(source, /getCurrentTime\(\)/);
  assert.match(source, /seekTo\(/);
  assert.match(source, /playVideo\(\)/);
  assert.match(source, /pauseVideo\(\)/);
  assert.match(source, /YT\.PlayerState\.PLAYING/);
  assert.match(source, /trigger\.focus\(\)/);
});
