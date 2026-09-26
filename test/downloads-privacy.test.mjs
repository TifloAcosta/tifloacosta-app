import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = file => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

test('privacy policy discloses transient URL analysis without credentials or file proxying', async () => {
  const html = await read('privacidad/index.html');
  assert.match(html, /Descargar desde un enlace/);
  assert.match(html, /solo cuando.*Analizar enlace/s);
  assert.match(html, /no.*guarda.*credenciales/is);
  assert.match(html, /no almacena.*archivos/is);
  assert.match(html, /servidor original/is);
  assert.match(html, /Download from a link/);
  assert.match(html, /does not store credentials/i);
});

test('privacy policy keeps the dormant sound-search disclosure in both languages', async () => {
  const html = await read('privacidad/index.html');
  assert.match(html, /Buscar sonidos/);
  assert.match(html, /Freesound/);
  assert.match(html, /no mantiene un historial personal de las búsquedas de sonidos/i);
  assert.match(html, /Search sounds/);
  assert.match(html, /does not keep a personal history of sound searches/i);
  assert.match(html, /Mixkit/);
  assert.match(html, /Pixabay/);
});

test('service worker refreshes only the active simple Downloads feature files', async () => {
  const source = await read('sw.js');
  assert.match(source, /tifloacosta-app-v2-25-colors/);
  assert.match(source, /downloads-core\.js\?v=1\.1/);
  assert.match(source, /download-config\.js\?v=1\.1/);
  assert.match(source, /downloads\.js\?v=1\.4/);
  assert.match(source, /downloads\.css\?v=1\.1/);
  assert.doesNotMatch(source, /downloads-hub\.js/);
  assert.doesNotMatch(source, /downloads-iphone-bridge\.js/);
  assert.doesNotMatch(source, /sound-search-core\.js/);
  assert.doesNotMatch(source, /sound-search-config\.js/);
  assert.doesNotMatch(source, /sound-search\.js/);
});
