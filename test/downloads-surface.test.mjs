import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = file => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

test('app core loads the download feature after DOM content is ready', async () => {
  const source = await read('app-core.js');
  assert.match(source, /downloads-core\.js\?v=1\.0/);
  assert.match(source, /download-config\.js\?v=1\.0/);
  assert.match(source, /downloads\.js\?v=1\.0/);
});

test('download surface exposes a first-level launcher and accessible controls', async () => {
  const source = await read('downloads.js');
  assert.match(source, /home-open-downloads/);
  assert.match(source, /downloads-section/);
  assert.match(source, /download-url/);
  assert.match(source, /aria-live/);
  assert.match(source, /download-results-heading/);
  assert.match(source, /Volver al inicio/);
  assert.match(source, /Download from a link/);
});

test('download launcher is inserted immediately before Videos on the home screen', async () => {
  const source = await read('downloads.js');
  assert.match(source, /getElementById\('home-open-videos'\)/);
  assert.match(source, /insertBefore\(launcher,\s*videosLauncher\)/);
});
