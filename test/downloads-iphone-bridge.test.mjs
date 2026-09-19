import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('app core loads the iPhone interaction bridge after both download UIs', async () => {
  const source = await read('app-core.js');
  const linkUi = source.indexOf("appendScript('downloads.js?v=1.1'");
  const soundUi = source.indexOf("appendScript('sound-search.js?v=1.0'");
  const bridge = source.indexOf("appendScript('downloads-iphone-bridge.js?v=1.0'");
  assert.ok(linkUi >= 0);
  assert.ok(soundUi >= 0);
  assert.ok(bridge > linkUi);
  assert.ok(bridge > soundUi);
});

test('iPhone bridge announces link paste and Analyze activation and dispatches explicit submit', async () => {
  const source = await read('downloads-iphone-bridge.js');
  assert.match(source, /download-form/);
  assert.match(source, /download-url/);
  assert.match(source, /download-analyze/);
  assert.match(source, /Enlace recibido/);
  assert.match(source, /Botón Analizar activado/);
  assert.match(source, /Validando enlace/);
  assert.match(source, /event\.preventDefault\(\)/);
  assert.match(source, /dispatchEvent\(new Event\('submit'/);
});

test('iPhone bridge also announces sound query and Search activation and dispatches explicit submit', async () => {
  const source = await read('downloads-iphone-bridge.js');
  assert.match(source, /sound-search-form/);
  assert.match(source, /sound-query/);
  assert.match(source, /sound-search-submit/);
  assert.match(source, /Consulta de sonidos recibida/);
  assert.match(source, /Botón Buscar sonidos activado/);
  assert.match(source, /Buscando sonidos/);
});

test('bridge status announcements are assertive and service worker precaches the bridge', async () => {
  const [bridge, sw] = await Promise.all([read('downloads-iphone-bridge.js'), read('sw.js')]);
  assert.match(bridge, /setAttribute\('role',\s*'status'\)/);
  assert.match(bridge, /setAttribute\('aria-live',\s*'assertive'\)/);
  assert.match(sw, /tifloacosta-app-v2-14-iphone-diagnostics/);
  assert.match(sw, /downloads-iphone-bridge\.js\?v=1\.0/);
});
