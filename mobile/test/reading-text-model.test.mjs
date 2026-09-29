import assert from 'node:assert/strict';
import test from 'node:test';

import {
  normalizeReadingPosition,
  parsePlainText,
  percentForBlock
} from '../src/core/reading-text-model.mjs';

test('reading text model removes one BOM, normalizes CRLF and builds stable paragraph ids', () => {
  const model = parsePlainText('\uFEFFPrimera línea\r\nsegunda línea\r\n\r\nSegundo párrafo\rTercera línea', {
    title: 'Documento de prueba'
  });

  assert.equal(model.title, 'Documento de prueba');
  assert.deepEqual(model.blocks, [
    { id: 'p-1', type: 'paragraph', text: 'Primera línea segunda línea' },
    { id: 'p-2', type: 'paragraph', text: 'Segundo párrafo Tercera línea' }
  ]);
});

test('reading text model joins single newlines inside one paragraph and discards empty blocks', () => {
  const model = parsePlainText('Uno\nDos\n\n\n   \n\nTres');

  assert.deepEqual(model.blocks, [
    { id: 'p-1', type: 'paragraph', text: 'Uno Dos' },
    { id: 'p-2', type: 'paragraph', text: 'Tres' }
  ]);
});

test('reading text model returns an empty block list for empty or whitespace-only text', () => {
  assert.deepEqual(parsePlainText('').blocks, []);
  assert.deepEqual(parsePlainText(' \n\n\t ').blocks, []);
});

test('reading text model clamps negative and oversized saved positions safely', () => {
  assert.equal(normalizeReadingPosition({ blockIndex: -4 }, 3), 0);
  assert.equal(normalizeReadingPosition({ blockIndex: 99 }, 3), 2);
  assert.equal(normalizeReadingPosition({ blockIndex: 1 }, 3), 1);
  assert.equal(normalizeReadingPosition({}, 3), 0);
  assert.equal(normalizeReadingPosition({ blockIndex: 9 }, 0), 0);
});

test('reading text model calculates progress from the clamped paragraph position', () => {
  assert.equal(percentForBlock(0, 4), 25);
  assert.equal(percentForBlock(1, 4), 50);
  assert.equal(percentForBlock(99, 4), 100);
  assert.equal(percentForBlock(-5, 4), 25);
  assert.equal(percentForBlock(0, 0), 0);
});
