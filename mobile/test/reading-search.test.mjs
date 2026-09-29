import assert from 'node:assert/strict';
import test from 'node:test';

import { createReadingSearchIndex } from '../src/core/reading-search.mjs';

const document = {
  title: 'Manual',
  language: 'es',
  blocks: [
    { id: 'h-1', type: 'heading', level: 1, text: 'Introducción', sentences: ['Introducción'] },
    { id: 'p-1', type: 'paragraph', text: 'Primer café tranquilo. Segunda frase útil.', sentences: ['Primer café tranquilo.', 'Segunda frase útil.'] },
    { id: 'h-2', type: 'heading', level: 2, text: 'Uso diario', sentences: ['Uso diario'] },
    { id: 'p-2', type: 'paragraph', text: 'Buscar una frase útil ayuda. Otra FRASE útil aparece aquí.', sentences: ['Buscar una frase útil ayuda.', 'Otra FRASE útil aparece aquí.'] }
  ]
};

test('reading search finds words and phrases case-insensitively while preserving accents', async () => {
  const index = createReadingSearchIndex(document);
  await index.build();

  const phrase = index.search('frase útil');
  assert.equal(phrase.total, 3);
  assert.deepEqual(phrase.results.map(result => [result.blockIndex, result.unitIndex]), [[1, 1], [3, 0], [3, 1]]);

  assert.equal(index.search('CAFÉ').total, 1);
  assert.equal(index.search('CAFE').total, 0);
});

test('reading search returns context and the nearest preceding heading in document order', async () => {
  const index = createReadingSearchIndex(document);
  await index.build();

  const result = index.search('aparece').results[0];
  assert.equal(result.blockIndex, 3);
  assert.equal(result.unitIndex, 1);
  assert.equal(result.heading, 'Uso diario');
  assert.match(result.excerpt, /FRASE útil aparece aquí/);
  assert.ok(result.matchStart < result.matchEnd);
});

test('reading search handles empty queries and limits without changing total matches', async () => {
  const index = createReadingSearchIndex(document);
  await index.build();

  assert.deepEqual(index.search('   '), { total: 0, results: [] });
  const limited = index.search('frase', { limit: 2 });
  assert.equal(limited.total, 3);
  assert.equal(limited.results.length, 2);
});

test('reading search build yields incrementally and reports progress for large documents', async () => {
  const large = {
    title: 'Grande',
    language: 'es',
    blocks: Array.from({ length: 205 }, (_, index) => ({
      id: `p-${index + 1}`,
      type: 'paragraph',
      text: `Bloque ${index + 1}`,
      sentences: [`Bloque ${index + 1}`]
    }))
  };
  let yields = 0;
  const progress = [];
  const index = createReadingSearchIndex(large, {
    yieldEvery: 100,
    scheduler: async () => { yields += 1; }
  });

  await index.build(value => progress.push(value));

  assert.equal(yields, 2);
  assert.deepEqual(progress.at(-1), { processed: 205, total: 205 });
  assert.equal(index.search('Bloque 205').total, 1);
});

test('reading search results are temporary data and do not mutate the reading position', async () => {
  const position = { blockIndex: 1, unitIndex: 0 };
  const index = createReadingSearchIndex(document);
  await index.build();

  const result = index.search('aparece').results[0];
  assert.deepEqual(position, { blockIndex: 1, unitIndex: 0 });
  assert.deepEqual({ blockIndex: result.blockIndex, unitIndex: result.unitIndex }, { blockIndex: 3, unitIndex: 1 });

  const continuedPosition = { blockIndex: result.blockIndex, unitIndex: result.unitIndex };
  assert.deepEqual(continuedPosition, { blockIndex: 3, unitIndex: 1 });
});
