import assert from 'node:assert/strict';
import test from 'node:test';

import {
  pageForPosition,
  parsePdfDocument,
  positionForPage
} from '../src/core/reading-pdf-adapter.mjs';

const payload = {
  title: 'Manual accesible',
  author: 'TifloAcosta',
  language: 'es',
  pageCount: 3,
  orderReliable: false,
  pages: [
    {
      number: 1,
      text: 'Primer párrafo. Segunda frase.\n\nOtro párrafo de la primera página.'
    },
    { number: 2, text: '   \n\n  ' },
    {
      number: 3,
      text: 'Texto de la tercera página.'
    }
  ]
};

test('reading pdf adapter: maps extracted pages into the common semantic model in source order', () => {
  const document = parsePdfDocument(payload);

  assert.equal(document.title, 'Manual accesible');
  assert.equal(document.author, 'TifloAcosta');
  assert.equal(document.language, 'es');
  assert.equal(document.pageCount, 3);
  assert.equal(document.orderReliable, false);
  assert.deepEqual(
    document.blocks.map(block => ({ type: block.type, text: block.text, pageNumber: block.pageNumber })),
    [
      { type: 'paragraph', text: 'Primer párrafo. Segunda frase.', pageNumber: 1 },
      { type: 'paragraph', text: 'Otro párrafo de la primera página.', pageNumber: 1 },
      { type: 'paragraph', text: 'Texto de la tercera página.', pageNumber: 3 }
    ]
  );
  assert.deepEqual(document.blocks[0].sentences, ['Primer párrafo.', 'Segunda frase.']);
  assert.notEqual(document.blocks[0].id, document.blocks[2].id);
  assert.ok(document.blocks.every(block => block.type === 'paragraph'));
});

test('reading pdf adapter: preserves real page metadata including pages without text', () => {
  const document = parsePdfDocument(payload);

  assert.deepEqual(document.pages, [
    { number: 1, firstBlockIndex: 0, lastBlockIndex: 1 },
    { number: 2, firstBlockIndex: null, lastBlockIndex: null },
    { number: 3, firstBlockIndex: 2, lastBlockIndex: 2 }
  ]);
  assert.equal(document.blocks.some(block => block.pageNumber === 2), false);
});

test('reading pdf adapter: maps shared positions to real pages and clamps shared positions', () => {
  const document = parsePdfDocument(payload);

  assert.equal(pageForPosition(document, { blockIndex: 0, unitIndex: 0 }), 1);
  assert.equal(pageForPosition(document, { blockIndex: 1, unitIndex: 99 }), 1);
  assert.equal(pageForPosition(document, { blockIndex: 2, unitIndex: 0 }), 3);
  assert.equal(pageForPosition(document, { blockIndex: -50, unitIndex: -10 }), 1);
  assert.equal(pageForPosition(document, { blockIndex: 999, unitIndex: 999 }), 3);
  assert.equal(pageForPosition({ blocks: [] }, { blockIndex: 0, unitIndex: 0 }), null);
});

test('reading pdf adapter: maps real pages to positions without inventing positions for empty or invalid pages', () => {
  const document = parsePdfDocument(payload);

  assert.deepEqual(positionForPage(document, 1), { blockIndex: 0, unitIndex: 0 });
  assert.equal(positionForPage(document, 2), null);
  assert.deepEqual(positionForPage(document, 3), { blockIndex: 2, unitIndex: 0 });
  assert.equal(positionForPage(document, 0), null);
  assert.equal(positionForPage(document, 4), null);
  assert.equal(positionForPage(document, 'not-a-page'), null);
});

test('reading pdf adapter: does not invent headings, chapters or tables from plain extracted text', () => {
  const document = parsePdfDocument({
    title: 'Sin estructura',
    pageCount: 1,
    orderReliable: true,
    pages: [{ number: 1, text: 'CAPÍTULO UNO\nUna fila | otra fila\nTexto final.' }]
  });

  assert.ok(document.blocks.length > 0);
  assert.ok(document.blocks.every(block => block.type === 'paragraph'));
  assert.equal(document.blocks.some(block => 'level' in block), false);
});
