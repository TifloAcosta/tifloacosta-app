import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('simple Downloads does not load the old iPhone interaction bridge', async () => {
  const source = await read('app-core.js');
  assert.match(source, /downloads\.js\?v=1\.4/);
  assert.doesNotMatch(source, /sound-search\.js/);
  assert.doesNotMatch(source, /downloads-iphone-bridge\.js/);
});

test('dormant iPhone bridge still contains its link interaction safeguards', async () => {
  const source = await read('downloads-iphone-bridge.js');
  assert.match(source, /download-form/);
  assert.match(source, /download-url/);
  assert.match(source, /download-analyze/);
  assert.match(source, /Enlace recibido/);
  assert.match(source, /event\.preventDefault\(\)/);
  assert.match(source, /dispatchEvent\(new Event\('submit'/);
  assert.doesNotMatch(source, /Botón Analizar activado/);
  assert.doesNotMatch(source, /Validando enlace/);
  assert.doesNotMatch(source, /linkActivated/);
});

test('dormant bridge still contains its sound interaction safeguards', async () => {
  const source = await read('downloads-iphone-bridge.js');
  assert.match(source, /sound-search-form/);
  assert.match(source, /sound-query/);
  assert.match(source, /sound-search-submit/);
  assert.match(source, /Consulta de sonidos recibida/);
  assert.doesNotMatch(source, /Botón Buscar sonidos activado/);
  assert.doesNotMatch(source, /soundActivated/);
});

test('bridge announcements cannot asynchronously overwrite a later analysis state', async () => {
  const source = await read('downloads-iphone-bridge.js');
  assert.doesNotMatch(source, /window\.setTimeout\(\(\) => \{ status\.textContent = message; \}, 20\)/);
});

test('dormant bridge remains accessible but is not precached by the simple shell', async () => {
  const [bridge, sw] = await Promise.all([read('downloads-iphone-bridge.js'), read('sw.js')]);
  assert.match(bridge, /setAttribute\('role',\s*'status'\)/);
  assert.match(bridge, /setAttribute\('aria-live',\s*'assertive'\)/);
  assert.match(sw, /tifloacosta-app-v2-24-drive-free-library/);
  assert.doesNotMatch(sw, /downloads-iphone-bridge\.js/);
});
