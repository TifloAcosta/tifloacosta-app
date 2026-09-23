import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

// Guard against publishing mixed cache generations of the simple download feature.
const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

function versionFor(source, asset) {
  const escaped = asset.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = source.match(new RegExp(`${escaped}\\?v=([0-9.]+)`));
  return match?.[1] || '';
}

test('download feature publishes one fresh, consistent simple asset generation', async () => {
  const [index, core, sw] = await Promise.all([
    read('index.html'),
    read('app-core.js'),
    read('sw.js')
  ]);

  assert.equal(versionFor(index, 'app-core.js'), '1.6', 'index must request the simple Downloads app-core generation');
  assert.equal(versionFor(core, 'downloads.js'), '1.4', 'app-core must request downloads.js?v=1.4');
  assert.equal(versionFor(sw, 'downloads.js'), '1.4', 'service worker must precache downloads.js?v=1.4');

  for (const source of [core, sw]) {
    assert.doesNotMatch(source, /downloads-hub\.js/);
    assert.doesNotMatch(source, /downloads-iphone-bridge\.js/);
    assert.doesNotMatch(source, /sound-search\.js/);
  }

  assert.match(sw, /tifloacosta-app-v2-22-braille-course/);
});
