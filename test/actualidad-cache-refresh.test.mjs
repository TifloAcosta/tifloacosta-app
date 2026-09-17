import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Actualidad reader hotfix forces installed PWA clients to fetch the corrected core', async () => {
  const html = await read('actualidad.html');
  const sw = await read('sw.js');

  assert.match(html, /actualidad-core\.js\?v=1\.1/);
  assert.match(sw, /actualidad-core\.js\?v=1\.1/);
  assert.match(sw, /const CACHE = 'tifloacosta-app-v2-4-actualidad-reader-fix';/);
});
