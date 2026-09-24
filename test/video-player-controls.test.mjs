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

test('closing during player startup does not detach an already-created YouTube player', async () => {
  const source = await read('videos.js');

  assert.match(source, /if \(youtubePlayer\) \{\s*if \(playerReady\)/s);
  assert.match(source, /else \{\s*els\.playerFrame\.removeAttribute\('src'\);\s*\}/s);
});

test('opening the player isolates it from previous catalog chrome for desktop screen readers', async () => {
  const [html, source] = await Promise.all([read('videos.html'), read('videos.js')]);

  assert.match(source, /els\.controlsSection\.hidden = true/);
  assert.match(source, /els\.resultsSection\.hidden = true/);
  assert.match(html, /body:has\(#video-player-section:not\(\[hidden\]\)\) > \.site-header/);
  assert.match(html, /body:has\(#video-player-section:not\(\[hidden\]\)\) > \.skip-link/);
  assert.match(html, /body:has\(#video-player-section:not\(\[hidden\]\)\) #back-home/);
  assert.match(html, /body:has\(#video-player-section:not\(\[hidden\]\)\) \.video-hero/);
  assert.match(html, /body:has\(#video-player-section:not\(\[hidden\]\)\) #back-home-bottom/);
  assert.match(html, /body:has\(#video-player-section:not\(\[hidden\]\)\) > \.site-footer/);
  assert.match(html, /videos\.js\?v=2\.4/);
});

test('YouTube actions bridge leaves videos.js untouched and connects through existing DOM controls', async () => {
  const [html, bridge] = await Promise.all([read('videos.html'), read('youtube-actions-bridge.js')]);
  assert.match(html, /videos\.js\?v=2\.4/);
  assert.match(html, /youtube-actions-bridge\.js\?v=/);
  assert.match(bridge, /\.video-play-button\[data-video-id\]/);
  assert.match(bridge, /const actions = window\.TifloYouTubeActions/);
  assert.match(bridge, /actions\.showVideo\(/);
  assert.match(bridge, /actions\.hide\(/);
  assert.match(bridge, /actions\.setLanguage\(/);
  assert.match(bridge, /takePendingVideoId/);
  assert.match(bridge, /button\.click\(\)/);
});
