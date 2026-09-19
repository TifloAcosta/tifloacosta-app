import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('successful link analysis remains owned by the real download UI', async () => {
  const source = await read('downloads.js');
  assert.match(source, /setStatus\(t\(\)\.analyzing\)/);
  assert.match(source, /resultsHeading\.focus\(\)/);
});

test('iPhone bridge announces the completed result count by refocusing the results heading', async () => {
  const source = await read('downloads-iphone-bridge.js');
  assert.match(source, /download-results-section/);
  assert.match(source, /download-result-count/);
  assert.match(source, /download-results-heading/);
  assert.match(source, /MutationObserver/);
  assert.match(source, /heading\.textContent/);
  assert.match(source, /heading\.focus\(\)/);
});
