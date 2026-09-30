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

test('voice catalog exposes current Android-system providers and reserves future TifloLector services', async () => {
  const catalog = await read('src/core/reading-voice-catalog.mjs');

  for (const provider of ['Acapela', 'Vocalizer', 'Eloquence']) {
    assert.ok(catalog.includes(provider), `Missing provider ${provider}`);
  }
  assert.match(catalog, /android-system/);
  assert.match(catalog, /tiflolector-service/);
  assert.match(catalog, /com\.acapelagroup\.android\.tts/);
  assert.match(catalog, /es\.codefactory\.vocalizertts/);
  assert.match(catalog, /com\.codefactoryglobal\.eloquencetts/);
});

test('voice settings open an accessible provider catalog, warn before leaving, and keep native installer access', async () => {
  const [screen, catalog] = await Promise.all([
    read('src/screens/reading-settings.mjs'),
    read('src/core/reading-voice-catalog.mjs')
  ]);

  assert.match(screen, /createReadingVoiceCatalog/);
  assert.match(screen, /voiceCatalog\.open/);
  assert.match(screen, /refreshVoicesAfterResume/);
  assert.match(catalog, /confirmExternalProvider/);
  assert.match(catalog, /openTtsVoiceInstaller/);
  assert.match(catalog, /Browser\.open|openExternal/);
});

test('voice catalog copy explains system-wide compatibility and future TifloLector-only services in Spanish and English', async () => {
  const catalog = await read('src/core/reading-voice-catalog.mjs');

  for (const text of [
    'compatibles con Android',
    'compatible with Android',
    'solo dentro de TifloLector',
    'only inside TifloLector',
    'Vas a abandonar TifloAcosta',
    'You are leaving TifloAcosta'
  ]) {
    assert.ok(catalog.includes(text), `Missing catalog copy: ${text}`);
  }
});
