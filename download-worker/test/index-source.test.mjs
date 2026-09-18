import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = file => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

test('worker enforces POST/OPTIONS, CORS, manual redirects and bounded HTML analysis', async () => {
  const source = await read('src/index.js');
  assert.match(source, /request\.method === 'OPTIONS'/);
  assert.match(source, /request\.method !== 'POST'/);
  assert.match(source, /https:\/\/tifloacosta\.com/);
  assert.match(source, /https:\/\/tifloacosta\.github\.io/);
  assert.match(source, /redirect:\s*'manual'/);
  assert.match(source, /MAX_REDIRECTS\s*=\s*5/);
  assert.match(source, /REQUEST_TIMEOUT_MS\s*=\s*8000/);
  assert.match(source, /MAX_HTML_BYTES\s*=\s*1_000_000/);
  assert.match(source, /HTMLRewriter/);
  assert.match(source, /MAX_CANDIDATES\s*=\s*200/);
});

test('worker validates every redirect and never proxies complete files', async () => {
  const source = await read('src/index.js');
  assert.match(source, /safeRedirectTarget/);
  assert.match(source, /content-disposition/);
  assert.match(source, /nameFromHeaders/);
  assert.doesNotMatch(source, /return\s+response\s*;/);
});
