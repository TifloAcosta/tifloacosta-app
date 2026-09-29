import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('reader derives previous and next labels from the real adjacent semantic unit', async () => {
  const screen = await read('src/screens/reading-book.mjs');

  assert.match(screen, /adjacentSemanticUnit/);
  assert.match(screen, /previous\.setAttribute\(['"]aria-label['"],\s*semanticNavigationLabel/);
  assert.match(screen, /next\.setAttribute\(['"]aria-label['"],\s*semanticNavigationLabel/);
  assert.match(screen, /adjacentSemanticUnit\(documentModel,\s*normalized,\s*-1\)/);
  assert.match(screen, /adjacentSemanticUnit\(documentModel,\s*normalized,\s*1\)/);
});

test('reader provides localized navigation names for every supported semantic target', async () => {
  const screen = await read('src/screens/reading-book.mjs');

  for (const key of [
    'previousParagraph', 'nextParagraph',
    'previousSentence', 'nextSentence',
    'previousHeading', 'nextHeading',
    'previousListItem', 'nextListItem',
    'previousQuote', 'nextQuote',
    'previousTableCell', 'nextTableCell'
  ]) {
    assert.match(screen, new RegExp(`readingBook\\.${key}`), `Reader does not use ${key}`);
  }

  for (const label of [
    'Encabezado anterior', 'Encabezado siguiente',
    'Elemento de lista anterior', 'Elemento de lista siguiente',
    'Cita anterior', 'Cita siguiente',
    'Celda de tabla anterior', 'Celda de tabla siguiente',
    'Previous heading', 'Next heading',
    'Previous list item', 'Next list item',
    'Previous quote', 'Next quote',
    'Previous table cell', 'Next table cell'
  ]) {
    assert.ok(screen.includes(label), `Missing navigation fallback: ${label}`);
  }
});
