import assert from 'node:assert/strict';
import test from 'node:test';

import { parseStructuredDocument } from '../src/core/reading-structured-adapter.mjs';

test('reading structured adapter preserves EPUB semantics and creates sentence units for the common reader', () => {
  const document = parseStructuredDocument({
    title: 'Libro EPUB',
    author: 'Ana Ejemplo',
    language: 'es',
    blocks: [
      { id: 'OPS/c2.xhtml#h2', type: 'heading', text: 'Capítulo dos', level: 2, href: 'OPS/c2.xhtml#h2' },
      { id: 'OPS/c2.xhtml#p1', type: 'paragraph', text: 'Primera frase. Segunda frase.', level: 0, href: 'OPS/c2.xhtml#p1' },
      { id: 'OPS/c2.xhtml#li1', type: 'list-item', text: 'Elemento', href: 'OPS/c2.xhtml#li1' },
      { id: 'empty', type: 'paragraph', text: '   ' }
    ],
    navigation: [{ label: 'Capítulo dos', href: 'OPS/c2.xhtml#h2', level: 1 }],
    pageReferences: [{ label: '7', href: 'OPS/c2.xhtml#p1' }],
    mediaSyncReferences: [{ textHref: 'OPS/c2.xhtml#p1', audioHref: 'OPS/audio.mp3', clipBeginMs: 1500, clipEndMs: 3250 }]
  });

  assert.equal(document.title, 'Libro EPUB');
  assert.equal(document.author, 'Ana Ejemplo');
  assert.equal(document.language, 'es');
  assert.equal(document.blocks.length, 3);
  assert.equal(document.blocks[0].type, 'heading');
  assert.equal(document.blocks[0].level, 2);
  assert.deepEqual(document.blocks[1].sentences, ['Primera frase.', 'Segunda frase.']);
  assert.deepEqual(document.navigation, [{ label: 'Capítulo dos', href: 'OPS/c2.xhtml#h2', level: 1 }]);
  assert.deepEqual(document.pageReferences, [{ label: '7', href: 'OPS/c2.xhtml#p1' }]);
  assert.deepEqual(document.mediaSyncReferences, [{
    textHref: 'OPS/c2.xhtml#p1',
    audioHref: 'OPS/audio.mp3',
    clipBeginMs: 1500,
    clipEndMs: 3250
  }]);
});

test('reading structured adapter normalizes unknown block types without inventing unsafe content', () => {
  const document = parseStructuredDocument({
    language: 'en',
    blocks: [
      { id: 'x', type: 'script', text: 'Readable fallback text' },
      { id: 'y', type: 'table-cell', text: 'Cell' }
    ]
  });

  assert.equal(document.blocks[0].type, 'paragraph');
  assert.equal(document.blocks[0].text, 'Readable fallback text');
  assert.equal(document.blocks[1].type, 'table-cell');
});
