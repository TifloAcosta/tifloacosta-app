import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { text } from '../src/core/i18n.mjs';

const read = file => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

test('mobile videos expose the accessible player labels in Spanish and English', () => {
  const expected = {
    es: ['Abrir reproductor', 'Retroceder 1 minuto', 'Reproducir', 'Pausar', 'Avanzar 1 minuto', 'Cerrar reproductor y volver a los vídeos', 'Abrir este vídeo en YouTube'],
    en: ['Open player', 'Rewind 1 minute', 'Play', 'Pause', 'Forward 1 minute', 'Close player and return to videos', 'Open this video on YouTube']
  };

  const keys = [
    'videos.play',
    'videos.rewindOneMinute',
    'videos.playControl',
    'videos.pauseControl',
    'videos.forwardOneMinute',
    'videos.closePlayer',
    'videos.openYouTube'
  ];

  for (const lang of ['es', 'en']) {
    assert.deepEqual(keys.map(key => text(lang, key)), expected[lang]);
  }
});

test('mobile videos build an embedded YouTube player with one-minute seek and play pause controls', async () => {
  const source = await read('src/screens/videos.mjs');

  assert.match(source, /youtube\.com\/iframe_api/);
  assert.match(source, /YT\.Player|window\.YT\.Player/);
  assert.match(source, /getCurrentTime/);
  assert.match(source, /seekTo\(/);
  assert.match(source, /playVideo\(/);
  assert.match(source, /pauseVideo\(/);
  assert.match(source, /videos\.rewindOneMinute/);
  assert.match(source, /videos\.forwardOneMinute/);
  assert.match(source, /videos\.closePlayer/);
  assert.match(source, /videos\.openYouTube/);
});

test('mobile video player keeps the external YouTube route as an explicit fallback', async () => {
  const source = await read('src/screens/videos.mjs');
  assert.match(source, /addExternalLink\(/);
  assert.match(source, /videos\.openYouTube/);
});
