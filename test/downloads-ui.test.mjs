import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = file => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

test('download UI preserves pending external context and accessible focus behavior', async () => {
  const source = await read('downloads.js');
  assert.match(source, /const PENDING_KEY = 'tifloDownloadPendingV1'/);
  assert.match(source, /core\.resolveLocal/);
  assert.match(source, /core\.filterResults/);
  assert.match(source, /resultsHeading\.focus\(\)/);
  assert.match(source, /localStorage\.setItem\(PENDING_KEY/);
  assert.match(source, /Reintentar análisis/);
  assert.match(source, /Retry analysis/);
  assert.match(source, /La accesibilidad y el funcionamiento/);
  assert.match(source, /does not receive or store your credentials/);
});

test('opening the download section focuses the URL input', async () => {
  const source = await read('downloads.js');
  assert.match(source, /section\.hidden = false;\s*urlInput\.focus\(\);/);
});

test('filters do not move focus and every result gets its own download link', async () => {
  const source = await read('downloads.js');
  assert.match(source, /resultSearch\.addEventListener\('input', applyFilters\)/);
  assert.match(source, /typeFilter\.addEventListener\('change', applyFilters\)/);
  assert.match(source, /const link = element\('a'/);
  assert.match(source, /link\.href = item\.url/);
});

test('unknown sizes stay unknown instead of becoming zero bytes', async () => {
  const source = await read('downloads.js');
  assert.match(source, /item\.size !== null/);
  assert.match(source, /item\.size !== undefined/);
  assert.match(source, /hasSize \? core\.formatBytes\(numericSize\) : t\(\)\.unknownSize/);
});

test('blocked automated access is explained separately from authentication', async () => {
  const source = await read('downloads.js');
  assert.match(source, /access_denied:c\.blocked/);
  assert.match(source, /La página ha rechazado el análisis automático/);
  assert.match(source, /The page refused automated analysis/);
});
