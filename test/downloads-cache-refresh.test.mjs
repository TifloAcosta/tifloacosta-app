import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('PWA shell advances its cache and precaches the fixed download script URLs', async () => {
  const sw = await read('sw.js');
  assert.match(sw, /tifloacosta-app-v2-18-safe-update/);
  assert.match(sw, /app-core\.js\?v=1\.5/);
  assert.doesNotMatch(sw, /app-core\.js\?v=1\.4/);
  assert.match(sw, /app\.js\?v=2\.2/);
  assert.match(sw, /downloads\.js\?v=1\.3/);
  assert.match(sw, /downloads-iphone-bridge\.js\?v=1\.1/);
  assert.match(sw, /sound-search\.js\?v=1\.1/);
});

test('homepage requests the fixed app core and safe update generations', async () => {
  const html = await read('index.html');
  assert.match(html, /app-core\.js\?v=1\.5/);
  assert.match(html, /app\.js\?v=2\.2/);
});

test('manual app update refreshes the worker without unregistering it or deleting the app cache', async () => {
  const app = await read('app.js');
  const start = app.indexOf('async function forceUpdateApplication()');
  const end = app.indexOf('function announceCompletedUpdate()', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const updateFlow = app.slice(start, end);
  assert.match(updateFlow, /\.update\(\)/);
  assert.doesNotMatch(updateFlow, /\.unregister\(\)/);
  assert.doesNotMatch(updateFlow, /caches\.delete/);
});

test('Descargas launcher is present in the initial homepage markup before enhancement scripts run', async () => {
  const html = await read('index.html');
  assert.match(html, /id="home-open-downloads"[^>]*href="#downloads"[^>]*>Descargas<\/a>/);
});

test('network-first PWA refresh bypasses the browser HTTP cache when online', async () => {
  const sw = await read('sw.js');
  assert.match(sw, /fetch\(request,\s*\{\s*cache:\s*'no-store'\s*\}\)/);
});

test('stale feature script requests are redirected to the fresh asset generation', async () => {
  const sw = await read('sw.js');
  assert.match(sw, /pathname\.endsWith\('\/app-core\.js'\)/);
  assert.match(sw, /searchParams\.set\('v',\s*'1\.5'\)/);
  assert.match(sw, /pathname\.endsWith\('\/downloads\.js'\)/);
  assert.match(sw, /searchParams\.set\('v',\s*'1\.3'\)/);
  assert.match(sw, /pathname\.endsWith\('\/downloads-iphone-bridge\.js'\)/);
  assert.match(sw, /searchParams\.set\('v',\s*'1\.1'\)/);
  assert.match(sw, /pathname\.endsWith\('\/sound-search\.js'\)/);
});
