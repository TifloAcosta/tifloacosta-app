import assert from 'node:assert/strict';
import test from 'node:test';

import { createReadingSession } from '../src/core/reading-session.mjs';

const blocks = [
  { id: 'p-1', type: 'paragraph', text: 'Uno' },
  { id: 'p-2', type: 'paragraph', text: 'Dos' },
  { id: 'p-3', type: 'paragraph', text: 'Tres' }
];

test('reading session clamps the saved paragraph and exposes current progress', () => {
  const negative = createReadingSession({ blocks, initialIndex: -8 });
  assert.deepEqual(negative.current(), blocks[0]);
  assert.deepEqual(negative.snapshot(), { blockIndex: 0, percent: 100 / 3 });

  const oversized = createReadingSession({ blocks, initialIndex: 99 });
  assert.deepEqual(oversized.current(), blocks[2]);
  assert.deepEqual(oversized.snapshot(), { blockIndex: 2, percent: 100 });
});

test('reading session moves one paragraph at a time and stops at boundaries', () => {
  const session = createReadingSession({ blocks, initialIndex: 1 });

  assert.deepEqual(session.previous(), blocks[0]);
  assert.deepEqual(session.previous(), blocks[0]);
  assert.deepEqual(session.next(), blocks[1]);
  assert.deepEqual(session.next(), blocks[2]);
  assert.deepEqual(session.next(), blocks[2]);
  assert.deepEqual(session.snapshot(), { blockIndex: 2, percent: 100 });
});

test('reading session handles an empty document safely', () => {
  const session = createReadingSession({ blocks: [], initialIndex: 4 });

  assert.equal(session.current(), null);
  assert.equal(session.previous(), null);
  assert.equal(session.next(), null);
  assert.deepEqual(session.snapshot(), { blockIndex: 0, percent: 0 });
});
