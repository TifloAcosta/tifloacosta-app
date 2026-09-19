import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = file => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

test('app core loads the simple download tool without the experimental hub', async () => {
  const source = await read('app-core.js');
  assert.match(source, /downloads-core\.js\?v=1\.1/);
  assert.match(source, /download-config\.js\?v=1\.1/);
  assert.match(source, /downloads\.js\?v=1\.4/);
  assert.doesNotMatch(source, /downloads-hub\.js/);
  assert.doesNotMatch(source, /sound-search\.js/);
  assert.doesNotMatch(source, /downloads-iphone-bridge\.js/);
});

test('link download tool owns the first-level launcher and accessible surface', async () => {
  const source = await read('downloads.js');
  assert.match(source, /id: 'home-open-downloads'/);
  assert.match(source, /window\.location\.hash = '#downloads'/);
  assert.match(source, /downloads-section/);
  assert.match(source, /download-url/);
  assert.match(source, /aria-live/);
  assert.match(source, /download-results-heading/);
});

test('the old hub remains dormant rather than controlling the active launcher', async () => {
  const [core, hub] = await Promise.all([
    read('app-core.js'),
    read('downloads-hub.js').catch(() => '')
  ]);
  assert.match(hub, /downloads-open-link/);
  assert.match(hub, /downloads-open-sounds/);
  assert.doesNotMatch(core, /downloads-hub\.js/);
});
