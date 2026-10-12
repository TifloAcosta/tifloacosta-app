import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const reader = readFileSync(new URL('../src/screens/reading-book.mjs', import.meta.url), 'utf8');

test('table of contents is hidden when a document has no semantic headings', () => {
  assert.match(reader, /contentsSection\.hidden = headings\.length === 0/);
  assert.match(reader, /block\?\.type === 'heading'/);
});

test('jump action uses reading position and returns focus to the spoken heading', () => {
  assert.match(reader, /contentsGo\.addEventListener\('click'/);
  assert.match(reader, /documentModel\.blocks\[index\]\.type !== 'heading'/);
  assert.match(reader, /moveToPosition\(\{ blockIndex: index, unitIndex: 0 \}, \{ focus: true \}\)/);
});

test('new book refreshes the heading list and preserves existing navigation', () => {
  assert.match(reader, /populateTableOfContents\(\);\s*if \(!documentModel\.blocks\.length\)/);
  assert.match(reader, /adjacentSemanticBlockOfKind\(documentModel, position, kind, step\)/);
});
