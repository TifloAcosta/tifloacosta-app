import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('iPhone download fix is cache-busted through the page, loader and PWA shell', async () => {
  const [html, appCore, sw] = await Promise.all([
    read('index.html'),
    read('app-core.js'),
    read('sw.js')
  ]);

  assert.match(html, /app-core\.js\?v=1\.4/);
  assert.match(appCore, /downloads\.js\?v=1\.2/);
  assert.match(sw, /app-core\.js\?v=1\.4/);
  assert.match(sw, /downloads\.js\?v=1\.2/);
  assert.match(sw, /tifloacosta-app-v2-13-iphone-downloads/);
});

test('network-first PWA refresh bypasses the browser HTTP cache when online', async () => {
  const sw = await read('sw.js');
  assert.match(sw, /fetch\(request,\s*\{\s*cache:\s*'no-store'\s*\}\)/);
});
