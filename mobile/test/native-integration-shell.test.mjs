import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('native integration shell preserves the approved permission and navigation boundaries', async () => {
  const [app, manifest, deepLinks] = await Promise.all([
    read('../src/app.mjs'),
    read('../android/app/src/main/AndroidManifest.xml'),
    read('../src/native/deep-links.mjs')
  ]);

  assert.doesNotMatch(app, /requestPermission\s*\(/);
  assert.equal((app.match(/addListener\('backButton'/g) || []).length, 1);
  assert.match(deepLinks, /tifloacosta\.com/);

  for (const permission of [
    'ACCESS_FINE_LOCATION',
    'ACCESS_COARSE_LOCATION',
    'CAMERA',
    'RECORD_AUDIO',
    'READ_CONTACTS',
    'WRITE_CONTACTS',
    'READ_EXTERNAL_STORAGE',
    'WRITE_EXTERNAL_STORAGE',
    'MANAGE_EXTERNAL_STORAGE'
  ]) {
    assert.doesNotMatch(manifest, new RegExp(`android\\.permission\\.${permission}`));
  }
});

test('native share and save actions keep explicit bilingual labels', async () => {
  const i18n = await read('../src/core/i18n.mjs');
  assert.match(i18n, /share: 'Compartir'/);
  assert.match(i18n, /saveFile: 'Guardar archivo'/);
  assert.match(i18n, /share: 'Share'/);
  assert.match(i18n, /saveFile: 'Save file'/);
});

test('maintenance guide records the credential-dependent production boundary', async () => {
  const readme = await read('../../README.txt');
  assert.match(readme, /IDENTIFICADORES PENDIENTES PARA PRODUCCIÓN/);
  assert.match(readme, /Apple Team ID/);
  assert.match(readme, /huellas del certificado de firma de Android/);
  assert.match(readme, /Universal Links y App Links/);
  assert.match(readme, /credenciales de producción de notificaciones/);
});
