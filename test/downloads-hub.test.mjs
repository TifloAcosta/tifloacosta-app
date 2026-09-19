import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = file => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

test('the dormant Downloads hub keeps its child routes for future work', async () => {
  const hub = await read('downloads-hub.js').catch(() => '');
  assert.match(hub, /downloads-open-link/);
  assert.match(hub, /downloads-open-sounds/);
  assert.match(hub, /#downloads-link/);
  assert.match(hub, /#downloads-sounds/);
});

test('app core leaves the hub dormant and loads the simple Downloads tool', async () => {
  const core = await read('app-core.js');
  assert.match(core, /downloads\.css\?v=1\.1/);
  assert.match(core, /downloads-core\.js\?v=1\.1/);
  assert.match(core, /download-config\.js\?v=1\.1/);
  assert.match(core, /downloads\.js\?v=1\.4/);
  assert.doesNotMatch(core, /downloads-hub\.js/);
  assert.doesNotMatch(core, /sound-search\.js/);
  assert.doesNotMatch(core, /downloads-iphone-bridge\.js/);
  assert.doesNotMatch(core, /data-tiflo-download-hub/);
});

test('app core starts download assets even when DOMContentLoaded already fired', async () => {
  const core = await read('app-core.js');
  assert.match(core, /function\s+loadDownloadAssets\s*\(/);
  assert.match(core, /document\.readyState\s*===\s*['"]loading['"]/);
  assert.match(core, /addEventListener\(['"]DOMContentLoaded['"],\s*loadDownloadAssets/);
  assert.match(core, /else\s*\{\s*loadDownloadAssets\(\);\s*\}/s);
});
