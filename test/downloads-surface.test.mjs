import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = file => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

test('app core loads the download hub before the link tool', async () => {
  const source = await read('app-core.js');
  assert.match(source, /downloads-core\.js\?v=1\.1/);
  assert.match(source, /download-config\.js\?v=1\.1/);
  assert.match(source, /downloads-hub\.js\?v=1\.0/);
  assert.match(source, /downloads\.js\?v=1\.3/);
  assert.ok(source.indexOf('downloads-hub.js?v=1.0') < source.indexOf('downloads.js?v=1.3'));
});

test('download hub owns the first-level launcher and child choices', async () => {
  const hub = await read('downloads-hub.js').catch(() => '');
  assert.match(hub, /home-open-downloads/);
  assert.match(hub, /downloads-hub/);
  assert.match(hub, /downloads-open-link/);
  assert.match(hub, /downloads-open-sounds/);
  assert.match(hub, /Descargar desde un enlace/);
  assert.match(hub, /Buscar sonidos/);
  assert.match(hub, /Download from a link/);
  assert.match(hub, /Search sounds/);
});

test('link download tool remains accessible but no longer creates the home launcher', async () => {
  const source = await read('downloads.js');
  assert.doesNotMatch(source, /id: 'home-open-downloads'/);
  assert.match(source, /downloads-section/);
  assert.match(source, /download-url/);
  assert.match(source, /aria-live/);
  assert.match(source, /download-results-heading/);
  assert.match(source, /Descargar desde un enlace/);
  assert.match(source, /Download from a link/);
});

test('download hub launcher stays immediately before Videos on the home screen', async () => {
  const hub = await read('downloads-hub.js').catch(() => '');
  assert.match(hub, /getElementById\('home-open-videos'\)/);
  assert.match(hub, /insertBefore\(launcher,\s*videosLauncher\)/);
});
