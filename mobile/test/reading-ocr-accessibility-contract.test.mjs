import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

test('scanned PDF state exposes explicit accessible OCR controls', () => {
  const panel = read('src/screens/reading-ocr-panel.mjs');
  assert.match(panel, /createReadingOcrFlow/);
  assert.match(panel, /setAttribute\('role', 'status'\)/);
  assert.match(panel, /setAttribute\('aria-live', 'polite'\)/);
  assert.match(panel, /scriptLabel\.htmlFor = scriptSelect\.id/);
  assert.match(panel, /pageLabel\.htmlFor = pageInput\.id/);
  assert.match(panel, /recognizeButton/);
  assert.match(panel, /resumeButton/);
  assert.match(panel, /openRecognizedButton/);
  assert.match(panel, /\['latin', 'Latino'/);
  assert.match(panel, /\['chinese', 'Chino'/);
  assert.match(panel, /\['devanagari', 'Devanagari'/);
  assert.match(panel, /\['japanese', 'Japonés'/);
  assert.match(panel, /\['korean', 'Coreano'/);
});

test('reading screen replaces the no-text dead end with the OCR panel', () => {
  const screen = read('src/screens/reading-book.mjs');
  assert.match(screen, /createReadingOcrPanel/);
  assert.match(screen, /ocrPanel = createReadingOcrPanel/);
  assert.match(screen, /await ocrPanel\.load\(\)/);
  assert.match(screen, /onOpenRecognized/);
});
