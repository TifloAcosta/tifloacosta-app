import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { adjacentWebReadingStructure, WEB_READING_STRUCTURE_MODES } from '../shared/web-reading-navigation.mjs';

const model = {
  blocks: [
    { type: 'heading', level: 1, text: 'Book title' },
    { type: 'paragraph', text: 'An introduction' },
    { type: 'heading', level: 2, text: 'Chapter 1' },
    { type: 'paragraph', text: 'Body text' },
    { type: 'heading', level: 3, text: 'Section 1.1' },
    { type: 'paragraph', text: 'Another paragraph' },
    { type: 'list-item', text: 'A list item' },
    { type: 'heading', level: 2, text: 'Chapter 2' },
    { type: 'quote', text: 'A quotation' },
    { type: 'table-cell', text: 'A cell' },
    { type: 'heading', level: 3, text: 'Section 2.1' },
    { type: 'heading', level: 2, text: '  ' }
  ]
};

test('forward/back headings ignore unrelated blocks and empty headings', () => {
  assert.deepEqual(adjacentWebReadingStructure(model, { blockIndex: 0 }, 'heading', 1), {
    position: { blockIndex: 2, unitIndex: 0 }, moved: true
  });
  assert.equal(adjacentWebReadingStructure(model, { blockIndex: 10 }, 'heading', -1).position.blockIndex, 7);
  assert.equal(adjacentWebReadingStructure(model, { blockIndex: 10 }, 'heading', 1).moved, false);
});

test('main heading mode respects actual heading levels 1 and 2', () => {
  assert.equal(adjacentWebReadingStructure(model, { blockIndex: 2 }, 'mainHeading', 1).position.blockIndex, 7);
  assert.equal(adjacentWebReadingStructure(model, { blockIndex: 7 }, 'mainHeading', -1).position.blockIndex, 2);
  assert.equal(adjacentWebReadingStructure(model, { blockIndex: 10 }, 'mainHeading', 1).moved, false);
});

test('lists, citations, table cells and paragraphs have deterministic semantics', () => {
  const cases = [
    ['listItem', 6], ['quote', 8], ['tableCell', 9], ['paragraph', 3]
  ];
  for (const [mode, expectedIndex] of cases) {
    assert.equal(adjacentWebReadingStructure(model, { blockIndex: 2 }, mode, 1).position.blockIndex, expectedIndex);
  }
});

test('boundaries and malformed documents do not jump, wrap or erase position', () => {
  assert.deepEqual(adjacentWebReadingStructure(null, { blockIndex: 0 }, 'heading'), {
    position: { blockIndex: 0, unitIndex: 0 }, moved: false
  });
  assert.deepEqual(adjacentWebReadingStructure(model, { blockIndex: 7 }, 'heading', 1).position, { blockIndex: 10, unitIndex: 0 });
  assert.equal(adjacentWebReadingStructure(model, { blockIndex: 0 }, 'heading', -1).moved, false);
  assert.equal(adjacentWebReadingStructure(model, { blockIndex: 5 }, 'invalid', 1).moved, false);
  assert.ok(WEB_READING_STRUCTURE_MODES.includes('mainHeading'));
});

test('iOS packaged reader consumes same helper and retains one play/pause button', () => {
  const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
  const source = read('web-reading.js');
  const html = read('index.html');
  const shared = read('shared/web-entry.mjs');
  const ios = read('ios-build/ios-parity.js');
  assert.match(shared, /adjacentWebReadingStructure/);
  assert.match(source, /shared\.adjacentWebReadingStructure\(/);
  assert.match(source, /speechController\?\.moveTo\?\./);
  assert.match(html, /id="reading-default-navigation"/);
  assert.match(html, /option value="mainHeading"/);
  assert.match(ios, /'mainHeading'/);
  assert.equal((html.match(/id="reading-play"/g) || []).length, 1);
  assert.equal((html.match(/id="reading-pause"/g) || []).length, 0);
});
