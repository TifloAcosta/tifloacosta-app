import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('successful link analysis puts the real result count in the focused heading', async () => {
  const source = await read('downloads.js');
  assert.match(source, /resultsHeading\.textContent\s*=\s*[^;]*allResults\.length/);
  assert.match(source, /resultsHeading\.focus\(\)/);
});

test('analysis progress remains owned by the real download UI', async () => {
  const source = await read('downloads.js');
  assert.match(source, /setStatus\(t\(\)\.analyzing\)/);
});
