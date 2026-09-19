import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('PWA shell advances its cache and precaches the fixed download script URL', async () => {
  const sw = await read('sw.js');
  assert.match(sw, /tifloacosta-app-v2-13-iphone-downloads/);
  assert.match(sw, /downloads\.js\?v=1\.2/);
});

test('network-first PWA refresh bypasses the browser HTTP cache when online', async () => {
  const sw = await read('sw.js');
  assert.match(sw, /fetch\(request,\s*\{\s*cache:\s*'no-store'\s*\}\)/);
});

test('stale downloads script requests are redirected to the fixed asset version', async () => {
  const sw = await read('sw.js');
  assert.match(sw, /pathname\.endsWith\('\/downloads\.js'\)/);
  assert.match(sw, /searchParams\.set\('v',\s*'1\.2'\)/);
});
