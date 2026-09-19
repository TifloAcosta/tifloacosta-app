import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = file => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

test('Downloads has hub and child routes', async () => {
  const hub = await read('downloads-hub.js').catch(() => '');
  const tool = await read('downloads.js');
  assert.match(hub, /downloads-open-link/);
  assert.match(hub, /downloads-open-sounds/);
  assert.match(hub, /#downloads-link/);
  assert.match(hub, /#downloads-sounds/);
  assert.match(tool, /downloads-link/);
});

test('download assets are explicitly loaded once', async () => {
  const html = await read('index.html');
  for (const asset of ['downloads.css','downloads-core.js','download-config.js','downloads-hub.js','downloads.js']) {
    assert.equal((html.match(new RegExp(asset.replace('.', '\\.'), 'g')) || []).length, 1, asset);
  }
});
