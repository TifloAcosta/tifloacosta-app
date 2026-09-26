import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('PWA shell advances its cache and precaches the simple Downloads generation', async () => {
  const sw = await read('sw.js');
  assert.match(sw, /tifloacosta-app-v2-25-colors/);
  assert.match(sw, /app-core\.js\?v=1\.6/);
  assert.match(sw, /downloads\.js\?v=1\.4/);
  assert.doesNotMatch(sw, /downloads-hub\.js/);
  assert.doesNotMatch(sw, /downloads-iphone-bridge\.js/);
  assert.doesNotMatch(sw, /sound-search\.js/);
});

test('homepage requests the current app core generation', async () => {
  const html = await read('index.html');
  assert.match(html, /app-core\.js\?v=1\.6/);
});

test('Downloads workflow reruns when the homepage changes', async () => {
  const workflow = await read('.github/workflows/test-downloads.yml');
  assert.match(workflow, /- 'index\.html'/);
});

test('network-first PWA refresh bypasses the browser HTTP cache when online', async () => {
  const sw = await read('sw.js');
  assert.match(sw, /fetch\(request,\s*\{\s*cache:\s*'no-store'\s*\}\)/);
});

test('stale feature script requests are redirected only to the active Downloads generation', async () => {
  const sw = await read('sw.js');
  assert.match(sw, /pathname\.endsWith\('\/app-core\.js'\)/);
  assert.match(sw, /searchParams\.set\('v',\s*'1\.6'\)/);
  assert.match(sw, /pathname\.endsWith\('\/downloads\.js'\)/);
  assert.match(sw, /searchParams\.set\('v',\s*'1\.4'\)/);
  assert.doesNotMatch(sw, /pathname\.endsWith\('\/downloads-iphone-bridge\.js'\)/);
  assert.doesNotMatch(sw, /pathname\.endsWith\('\/sound-search\.js'\)/);
});
