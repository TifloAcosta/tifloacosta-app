import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('PDF reader exposes a real go-to-page control through the shared reading position', async () => {
  const [screen, i18n] = await Promise.all([
    read('src/screens/reading-book.mjs'),
    read('src/core/i18n.mjs')
  ]);

  assert.match(screen, /readingBook\.goToPage/);
  assert.match(screen, /readingBook\.pageNumber/);
  assert.match(screen, /pageInput\.type\s*=\s*['"]number['"]/);
  assert.match(screen, /positionForPage\(documentModel,\s*requestedPage\)/);
  assert.match(screen, /moveToPosition\(target/);
  assert.doesNotMatch(screen, /positionForPage\(documentModel,\s*requestedPage\)[\s\S]{0,500}speech\.play\(/);

  for (const label of ['Ir a página', 'Número de página', 'Go to page', 'Page number']) {
    assert.ok(i18n.includes(label), `Missing PDF page navigation translation: ${label}`);
  }
});

test('PDF reader reports the real page in reading status and mark references', async () => {
  const [screen, marks] = await Promise.all([
    read('src/screens/reading-book.mjs'),
    read('src/screens/reading-marks.mjs')
  ]);

  assert.match(screen, /readingBook\.pdfPosition/);
  assert.match(screen, /pageForPosition\(documentModel,\s*normalized\)/);
  assert.match(screen, /getReference:/);
  assert.match(screen, /readingBook\.pdfPageReference/);
  assert.match(marks, /getReference/);
  assert.match(marks, /reference:\s*getReference\?\.\(position\)/);
});

test('PDF reader announces unreliable reading order once during initialization', async () => {
  const [screen, i18n] = await Promise.all([
    read('src/screens/reading-book.mjs'),
    read('src/core/i18n.mjs')
  ]);

  assert.match(screen, /orderReliable\s*===\s*false/);
  assert.match(screen, /readingBook\.pdfOrderWarning/);
  assert.match(screen, /orderWarning/);

  assert.ok(i18n.includes('El orden de lectura de este PDF puede no ser fiable.'));
  assert.ok(i18n.includes('The reading order of this PDF may not be reliable.'));
});
