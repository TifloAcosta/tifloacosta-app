import assert from 'node:assert/strict';
import test from 'node:test';

import { adjacentSemanticUnit } from '../src/core/reading-semantic-model.mjs';

const documentModel = {
  blocks: [
    { type: 'paragraph', text: 'Uno. Dos.', sentences: ['Uno.', 'Dos.'] },
    { type: 'heading', text: 'Capítulo', sentences: ['Capítulo'] },
    { type: 'list-item', text: 'Elemento', sentences: ['Elemento'] },
    { type: 'quote', text: 'Cita', sentences: ['Cita'] },
    { type: 'table-cell', text: 'Celda', sentences: ['Celda'] }
  ]
};

test('adjacent semantic navigation identifies sentence moves inside a block', () => {
  assert.deepEqual(
    adjacentSemanticUnit(documentModel, { blockIndex: 0, unitIndex: 0 }, 1),
    {
      position: { blockIndex: 0, unitIndex: 1 },
      kind: 'sentence',
      moved: true
    }
  );
});

test('adjacent semantic navigation exposes the real target block kind', () => {
  const heading = adjacentSemanticUnit(documentModel, { blockIndex: 0, unitIndex: 1 }, 1);
  const paragraph = adjacentSemanticUnit(documentModel, { blockIndex: 1, unitIndex: 0 }, -1);
  const listItem = adjacentSemanticUnit(documentModel, { blockIndex: 1, unitIndex: 0 }, 1);
  const quote = adjacentSemanticUnit(documentModel, { blockIndex: 2, unitIndex: 0 }, 1);
  const tableCell = adjacentSemanticUnit(documentModel, { blockIndex: 3, unitIndex: 0 }, 1);

  assert.equal(heading.kind, 'heading');
  assert.deepEqual(heading.position, { blockIndex: 1, unitIndex: 0 });
  assert.equal(paragraph.kind, 'paragraph');
  assert.deepEqual(paragraph.position, { blockIndex: 0, unitIndex: 1 });
  assert.equal(listItem.kind, 'listItem');
  assert.equal(quote.kind, 'quote');
  assert.equal(tableCell.kind, 'tableCell');
});

test('adjacent semantic navigation reports document boundaries without moving', () => {
  assert.deepEqual(
    adjacentSemanticUnit(documentModel, { blockIndex: 0, unitIndex: 0 }, -1),
    {
      position: { blockIndex: 0, unitIndex: 0 },
      kind: 'paragraph',
      moved: false
    }
  );

  assert.deepEqual(
    adjacentSemanticUnit(documentModel, { blockIndex: 4, unitIndex: 0 }, 1),
    {
      position: { blockIndex: 4, unitIndex: 0 },
      kind: 'tableCell',
      moved: false
    }
  );
});
