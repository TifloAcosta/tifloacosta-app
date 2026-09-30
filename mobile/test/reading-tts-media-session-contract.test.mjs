import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = async path => {
  try {
    return await readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  } catch {
    return '';
  }
};

test('background TTS exposes standard Android media play and pause controls', async () => {
  const service = await read('android/app/src/main/java/com/tifloacosta/app/reading/ReadingBackgroundTtsService.java');

  assert.match(service, /android\.media\.session\.MediaSession/);
  assert.match(service, /android\.media\.session\.PlaybackState/);
  assert.match(service, /new\s+MediaSession\s*\(/);
  assert.match(service, /setCallback\s*\(new\s+MediaSession\.Callback/);
  assert.match(service, /void\s+onPlay\s*\(\)/);
  assert.match(service, /void\s+onPause\s*\(\)/);
  assert.match(service, /void\s+onStop\s*\(\)/);
  assert.match(service, /PlaybackState\.ACTION_PLAY/);
  assert.match(service, /PlaybackState\.ACTION_PAUSE/);
  assert.match(service, /PlaybackState\.ACTION_PLAY_PAUSE/);
  assert.match(service, /setActive\s*\(true\)/);
  assert.match(service, /setActive\s*\(false\)/);
});

test('media session state follows TTS playback state', async () => {
  const service = await read('android/app/src/main/java/com/tifloacosta/app/reading/ReadingBackgroundTtsService.java');

  assert.match(service, /updateMediaSessionState\s*\(/);
  assert.match(service, /PlaybackState\.STATE_PLAYING/);
  assert.match(service, /PlaybackState\.STATE_PAUSED/);
  assert.match(service, /MediaMetadata\.METADATA_KEY_TITLE/);
});
