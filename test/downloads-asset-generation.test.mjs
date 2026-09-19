import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

function versionFor(source, asset) {
  const escaped = asset.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = source.match(new RegExp(`${escaped}\\?v=([0-9.]+)`));
  return match?.[1] || '';
}

test('download feature publishes one fresh, consistent asset generation', async () => {
  const [index, core, sw] = await Promise.all([
    read('index.html'),
    read('app-core.js'),
    read('sw.js')
  ]);

  assert.equal(versionFor(index, 'app-core.js'), '1.4', 'index must request the new app-core generation');

  const expected = new Map([
    ['downloads.js', '1.3'],
    ['sound-search.js', '1.1'],
    ['downloads-iphone-bridge.js', '1.1']
  ]);

  for (const [asset, version] of expected) {
    assert.equal(versionFor(core, asset), version, `app-core must request ${asset}?v=${version}`);
    assert.equal(versionFor(sw, asset), version, `service worker must precache ${asset}?v=${version}`);
  }

  assert.match(sw, /tifloacosta-app-v2-16-download-assets/);
});
