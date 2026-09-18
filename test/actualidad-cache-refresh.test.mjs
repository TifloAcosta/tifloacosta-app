import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Actualidad cache busts all corrected iPhone assets and PWA shell', async () => {
  const [html, sw] = await Promise.all([read('actualidad.html'), read('sw.js')]);
  assert.match(html, /styles\.css\?v=1\.2/);
  assert.match(html, /actualidad-core\.js\?v=1\.6/);
  assert.match(html, /actualidad\.js\?v=1\.2/);
  assert.match(html, /actualidad-media\.js\?v=1\.1/);
  assert.match(sw, /styles\.css\?v=1\.2/);
  assert.match(sw, /actualidad-core\.js\?v=1\.6/);
  assert.match(sw, /actualidad\.js\?v=1\.2/);
  assert.match(sw, /actualidad-media\.js\?v=1\.1/);
  assert.match(sw, /tifloacosta-app-v2-11-downloads/);
});
