import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = file => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

const screens = await Promise.all([
  read('src/screens/downloads.mjs'),
  read('src/screens/download-link.mjs'),
  read('src/screens/sound-search.mjs')
]);

test('all Downloads screens use the shared accessible header and never autofocus', () => {
  for (const source of screens) {
    assert.match(source, /addScreenHeader\(/);
    assert.doesNotMatch(source, /autofocus/i);
  }
});

test('async Downloads screens expose labeled controls and polite live status', () => {
  const link = screens[1];
  const sounds = screens[2];
  assert.match(link, /label\.htmlFor\s*=\s*input\.id/);
  assert.match(link, /aria-live['"],\s*['"]polite/);
  assert.match(sounds, /queryLabel\.htmlFor\s*=\s*queryInput\.id/);
  assert.match(sounds, /categoryLabel\.htmlFor\s*=\s*categorySelect\.id/);
  assert.match(sounds, /aria-live['"],\s*['"]polite/);
});

test('sound search has no autoplay and external navigation stays native', () => {
  const sounds = screens[2];
  assert.doesNotMatch(sounds, /autoplay\s*=|window\.location|window\.open/i);
  assert.match(sounds, /nativeActions\.openExternal/);
});

test('mobile source contains no Freesound or signing secret values', async () => {
  const files = [
    'src/app.mjs', 'src/core/downloads.mjs', 'src/core/sound-search.mjs', 'src/core/i18n.mjs',
    'src/screens/downloads.mjs', 'src/screens/download-link.mjs', 'src/screens/sound-search.mjs'
  ];
  for (const file of files) {
    const source = await read(file);
    assert.doesNotMatch(source, /FREESOUND_API_KEY|TIFLOACOSTA_KEYSTORE_PASSWORD|TIFLOACOSTA_KEYSTORE_BASE64/);
  }
});
