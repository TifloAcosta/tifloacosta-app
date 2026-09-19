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

test('app core loads each download asset once through marked dynamic scripts', async () => {
  const core = await read('app-core.js');
  assert.match(core, /downloads\.css\?v=1\.1/);
  assert.match(core, /downloads-core\.js\?v=1\.1/);
  assert.match(core, /download-config\.js\?v=1\.1/);
  assert.match(core, /downloads-hub\.js\?v=1\.0/);
  assert.match(core, /downloads\.js\?v=1\.3/);
  assert.match(core, /data-tiflo-download-hub/);
});

test('app core starts download assets even when DOMContentLoaded already fired', async () => {
  const core = await read('app-core.js');
  assert.match(core, /function\s+loadDownloadAssets\s*\(/);
  assert.match(core, /document\.readyState\s*===\s*['"]loading['"]/);
  assert.match(core, /addEventListener\(['"]DOMContentLoaded['"],\s*loadDownloadAssets/);
  assert.match(core, /else\s*\{\s*loadDownloadAssets\(\);\s*\}/s);
});
