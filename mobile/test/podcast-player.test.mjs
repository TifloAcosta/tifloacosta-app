import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../src/screens/podcast.mjs', import.meta.url), 'utf8');

test('podcast screen loads the open RSS feed and keeps external services as fallback', () => {
  assert.match(source, /anchor\.fm\/s\/5b48ca28\/podcast\/rss/);
  assert.match(source, /DOMParser/);
  assert.match(source, /querySelectorAll\('channel > item'\)/);
  assert.match(source, /PLATFORMS/);
  assert.match(source, /addExternalLink/);
});

test('podcast player provides explicit accessible playback and seeking controls', () => {
  assert.match(source, /document\.createElement\('audio'\)/);
  assert.match(source, /Back 30 seconds|Retroceder 30 segundos/);
  assert.match(source, /Forward 30 seconds|Avanzar 30 segundos/);
  assert.match(source, /document\.createElement\('input'\)/);
  assert.match(source, /position\.type = 'range'/);
  assert.match(source, /audio\.play\(\)/);
  assert.match(source, /audio\.pause\(\)/);
  assert.match(source, /timeupdate/);
  assert.match(source, /setScreenCleanup/);
});
