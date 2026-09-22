import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { text } from '../src/core/i18n.mjs';

const read = file => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

test('mobile videos expose the accessible player labels in Spanish and English', () => {
  const expected = {
    es: ['Abrir reproductor', 'Retroceder 1 minuto', 'Reproducir', 'Pausar', 'Avanzar 1 minuto', 'Cerrar vídeo y volver a la lista de vídeos', 'Abrir este vídeo en YouTube'],
    en: ['Open player', 'Rewind 1 minute', 'Play', 'Pause', 'Forward 1 minute', 'Close video and return to the video list', 'Open this video on YouTube']
  };
  const keys = ['videos.play','videos.rewindOneMinute','videos.playControl','videos.pauseControl','videos.forwardOneMinute','videos.closePlayer','videos.openYouTube'];
  for (const lang of ['es', 'en']) assert.deepEqual(keys.map(key => text(lang, key)), expected[lang]);
  assert.equal(text('es', 'nav.backHome'), 'Volver a la pantalla principal');
  assert.equal(text('en', 'nav.backHome'), 'Return to the main screen');
});

test('mobile videos reuse an embedded YouTube player with one-minute seek and play pause controls', async () => {
  const [screen, player] = await Promise.all([
    read('src/screens/videos.mjs'),
    read('src/screens/video-player.mjs')
  ]);
  assert.match(screen, /createAccessibleVideoPlayer/);
  assert.match(screen, /onBackStateChange/);
  assert.match(screen, /router\.start\(['"]home['"]\)/);
  assert.match(player, /youtube\.com\/iframe_api/);
  assert.match(player, /YT\.Player|window\.YT\.Player/);
  assert.match(player, /getCurrentTime/);
  assert.match(player, /seekTo\(/);
  assert.match(player, /playVideo\(/);
  assert.match(player, /pauseVideo\(/);
  assert.match(player, /videos\.rewindOneMinute/);
  assert.match(player, /videos\.forwardOneMinute/);
  assert.match(player, /videos\.closePlayer/);
  assert.match(player, /videos\.openYouTube/);
  assert.match(player, /autoplay:\s*0/);
});

test('mobile video player keeps the external YouTube route as an explicit fallback', async () => {
  const source = await read('src/screens/videos.mjs');
  assert.match(source, /addExternalLink\(/);
  assert.match(source, /videos\.openYouTube/);
});
