import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('native shell keeps startup permission and back-navigation rules', async () => {
  const [app, manifest, deepLinks] = await Promise.all([
    read('../src/app.mjs'),
    read('../android/app/src/main/AndroidManifest.xml'),
    read('../src/native/deep-links.mjs')
  ]);

  assert.doesNotMatch(app, /requestPermission\s*\(/);
  assert.equal((app.match(/addListener\('backButton'/g) || []).length, 1);
  assert.match(deepLinks, /tifloacosta\.com/);
  assert.doesNotMatch(manifest, /ACCESS_FINE_LOCATION|ACCESS_COARSE_LOCATION|CAMERA|RECORD_AUDIO|READ_CONTACTS|WRITE_CONTACTS|READ_EXTERNAL_STORAGE|WRITE_EXTERNAL_STORAGE|MANAGE_EXTERNAL_STORAGE/);
});

test('native share and save actions remain bilingual', async () => {
  const i18n = await read('../src/core/i18n.mjs');
  assert.match(i18n, /share: 'Compartir'/);
  assert.match(i18n, /saveFile: 'Guardar archivo'/);
  assert.match(i18n, /share: 'Share'/);
  assert.match(i18n, /saveFile: 'Save file'/);
});

test('maintenance guide records that final store values are added only at publication time', async () => {
  const readme = await read('../../README.txt');
  assert.match(readme, /DATOS PENDIENTES PARA PUBLICACIÓN/);
  assert.match(readme, /datos reales/);
  assert.match(readme, /enlaces universales y enlaces de aplicación/);
  assert.match(readme, /OneSignal/);
});
