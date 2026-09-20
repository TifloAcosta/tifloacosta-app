import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = file => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

test('Descargas simple no carga la integración de sonidos', async () => {
  const appCore = await read('app-core.js');
  const sw = await read('sw.js');

  assert.doesNotMatch(appCore, /sound-search/);
  assert.doesNotMatch(appCore, /downloads-hub/);
  assert.doesNotMatch(appCore, /downloads-iphone-bridge/);
  assert.doesNotMatch(sw, /sound-search/);
  assert.doesNotMatch(sw, /downloads-hub/);
});

test('Descargas vuelve a ser una sección directa desde el inicio', async () => {
  const downloads = await read('downloads.js');
  assert.match(downloads, /id: 'home-open-downloads'/);
  assert.match(downloads, /window\.location\.hash = '#downloads'/);
  assert.match(downloads, /back: 'Volver al inicio'/);
});

test('el analizador usa el subdominio directo independiente del dominio principal', async () => {
  const config = await read('download-config.js');
  assert.match(config, /https:\/\/download\.tifloacosta\.com\/analyze/);
  assert.doesNotMatch(config, /tifloacosta\.com\/api\/download\/analyze/);
});
