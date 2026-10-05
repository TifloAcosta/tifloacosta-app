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

const readRepo = async path => {
  try {
    return await readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
  } catch {
    return '';
  }
};

test('voice catalog keeps Android providers in the mobile adapter and shared provider types platform-neutral', async () => {
  const [catalog, sharedCatalog] = await Promise.all([
    read('src/core/reading-voice-catalog.mjs'),
    readRepo('shared/reading-voice-catalog.mjs')
  ]);

  for (const provider of ['Acapela', 'Vocalizer', 'Eloquence']) {
    assert.ok(catalog.includes(provider), `Missing provider ${provider}`);
  }
  assert.ok(catalog.includes("platform: 'android'"));
  assert.ok(catalog.includes('READING_VOICE_PROVIDER_TYPES.SYSTEM'));
  assert.ok(sharedCatalog.includes("'tiflolector-service'"));
  assert.ok(catalog.includes('com.acapelagroup.android.tts'));
  assert.ok(catalog.includes('es.codefactory.vocalizertts'));
  assert.ok(catalog.includes('com.codefactoryglobal.eloquencetts'));
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

test('shared voice catalog carries platform-specific copy for Android web and iOS in Spanish and English', async () => {
  const sharedCatalog = await readRepo('shared/reading-voice-catalog.mjs');

  for (const text of [
    'compatibles con Android',
    'compatible with Android',
    'Voces disponibles en el navegador',
    'voices exposed by the browser',
    'Voces compatibles con iOS',
    'Voices compatible with iOS',
    'servicios de voz',
    'voice services',
    'Vas a abandonar TifloAcosta',
    'You are leaving TifloAcosta'
  ]) {
    assert.ok(sharedCatalog.includes(text), `Missing catalog copy: ${text}`);
  }
});


test('Android external voice catalog is filterable by language and providers carry language metadata', async () => {
  const [catalog, sharedCatalog] = await Promise.all([
    read('src/core/reading-voice-catalog.mjs'),
    readRepo('shared/reading-voice-catalog.mjs')
  ]);
  for (const token of [
    'reading-provider-language-filter',
    'renderProviders',
    'setLanguageFilter',
    'provider.languages'
  ]) assert.ok(catalog.includes(token), `Missing provider language filter feature ${token}`);
  assert.ok(sharedCatalog.includes('languages: Array.isArray(provider.languages)'));
});
