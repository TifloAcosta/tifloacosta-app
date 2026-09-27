import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeSemanticPosition,
  parseTextDocument,
  segmentSentences
} from '../src/core/reading-semantic-model.mjs';

test('reading semantic model: normalizes BOM and CRLF into stable paragraph blocks', () => {
  const document = parseTextDocument('\uFEFFPrimera línea.\r\nSegunda línea.\r\n\r\nOtro párrafo.', {
    title: 'Prueba',
    language: 'es'
  });

  assert.equal(document.title, 'Prueba');
  assert.equal(document.language, 'es');
  assert.deepEqual(document.blocks.map(block => ({
    id: block.id,
    type: block.type,
    text: block.text
  })), [
    { id: 'p-1', type: 'paragraph', text: 'Primera línea. Segunda línea.' },
    { id: 'p-2', type: 'paragraph', text: 'Otro párrafo.' }
  ]);
  assert.deepEqual(document.blocks[0].sentences, ['Primera línea.', 'Segunda línea.']);
});

test('reading semantic model: returns an empty document for empty text', () => {
  assert.deepEqual(parseTextDocument('', { title: 'Vacío', language: 'es' }), {
    title: 'Vacío',
    language: 'es',
    blocks: []
  });
});

test('reading semantic model: segments sentences and falls back for an invalid locale', () => {
  assert.deepEqual(segmentSentences('Uno. Dos? Tres!', '__invalid_locale__'), [
    'Uno.',
    'Dos?',
    'Tres!'
  ]);
  assert.deepEqual(segmentSentences('Sin puntuación final', 'es'), ['Sin puntuación final']);
  assert.deepEqual(segmentSentences('   ', 'es'), []);
});

test('reading semantic model: clamps block and sentence positions', () => {
  const document = parseTextDocument('Uno. Dos.\n\nTres.', { language: 'es' });

  assert.deepEqual(normalizeSemanticPosition({ blockIndex: -4, unitIndex: -9 }, document), {
    blockIndex: 0,
    unitIndex: 0
  });
  assert.deepEqual(normalizeSemanticPosition({ blockIndex: 0, unitIndex: 99 }, document), {
    blockIndex: 0,
    unitIndex: 1
  });
  assert.deepEqual(normalizeSemanticPosition({ blockIndex: 99, unitIndex: 99 }, document), {
    blockIndex: 1,
    unitIndex: 0
  });
  assert.deepEqual(normalizeSemanticPosition({ blockIndex: 8, unitIndex: 8 }, { blocks: [] }), {
    blockIndex: 0,
    unitIndex: 0
  });
});
