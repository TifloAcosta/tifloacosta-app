import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('reader exposes a real accessible navigation unit selector', async () => {
  const screen = await read('src/screens/reading-book.mjs');

  assert.match(screen, /navigationSelect = document\.createElement\('select'\)/);
  assert.match(screen, /navigationLabel\.htmlFor = navigationSelect\.id/);
  assert.match(screen, /populateNavigationModes/);
  assert.match(screen, /availableNavigationModes/);
  assert.match(screen, /navigationSelect\.addEventListener\('change'/);
  assert.doesNotMatch(screen, /navigationButton = document\.createElement\('button'\)/);
});

test('reader supports sentence paragraph heading list quote table cell and PDF page navigation', async () => {
  const screen = await read('src/screens/reading-book.mjs');

  for (const kind of ['sentence', 'paragraph', 'heading', 'listItem', 'quote', 'tableCell', 'page']) {
    assert.ok(screen.includes(kind), `Missing navigation mode: ${kind}`);
  }
  assert.match(screen, /adjacentSemanticUnit/);
  assert.match(screen, /adjacentSemanticBlockOfKind/);
  assert.match(screen, /readablePdfPageFrom/);
});

test('previous and next labels describe the selected unit rather than an incidental focus target', async () => {
  const screen = await read('src/screens/reading-book.mjs');

  assert.match(screen, /const navigationKind = navigationSelect\.value \|\| 'sentence'/);
  assert.match(screen, /previous\.setAttribute\('aria-label', semanticNavigationLabel\(t, navigationKind, -1\)\)/);
  assert.match(screen, /next\.setAttribute\('aria-label', semanticNavigationLabel\(t, navigationKind, 1\)\)/);
});
