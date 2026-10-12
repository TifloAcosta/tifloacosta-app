import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ocr = readFileSync(new URL('../src/screens/reading-ocr-panel.mjs', import.meta.url), 'utf8');
const library = readFileSync(new URL('../src/screens/reading-library.mjs', import.meta.url), 'utf8');

test('OCR export uses only recognized non-empty pages in page order', () => {
  assert.match(ocr, /\.filter\(page => String\(page\?\.text \|\| ''\)\.trim\(\)\)/);
  assert.match(ocr, /\.sort\(\(a, b\) => a\.pageIndex - b\.pageIndex\)/);
  assert.match(ocr, /NativeExport\.shareTextFile/);
});

test('OCR export is disabled if no recognized text exists', () => {
  assert.match(ocr, /exportOcrButton\.disabled = !state\.pages\?\.some/);
});

test('original library export remains unavailable and is not misrepresented as implemented', () => {
  assert.doesNotMatch(library, /exportOriginalBook\(/);
});
