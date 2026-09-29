import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('reading queue screen keeps ordered accessible actions explicit', async () => {
  const screen = await read('src/screens/reading-queue.mjs');

  assert.match(screen, /export function renderReadingQueue/);
  assert.match(screen, /client\.listQueue\(\)/);
  assert.match(screen, /onOpenBook/);
  assert.match(screen, /client\.removeFromQueue\(/);
  assert.match(screen, /client\.moveQueueItem\(/);
  assert.match(screen, /readingQueue\.moveEarlier/);
  assert.match(screen, /readingQueue\.moveLater/);
  assert.match(screen, /readingQueue\.remove/);
  assert.match(screen, /readingQueue\.empty/);
  assert.match(screen, /aria-live['"],\s*['"]polite['"]/);
});

test('reading queue never auto-opens the next title and exposes an explicit next suggestion', async () => {
  const [queue, book] = await Promise.all([
    read('src/screens/reading-queue.mjs'),
    read('src/screens/reading-book.mjs')
  ]);

  assert.doesNotMatch(queue, /onOpenBook\?\.[\s\S]{0,80}(?:moveQueueItem|removeFromQueue)/);
  assert.match(book, /readingBook\.endOfDocument/);
  assert.match(book, /readingBook\.nextSuggestion/);
  assert.match(book, /readingBook\.openNext/);
  assert.match(book, /readingBook\.backToQueue/);
});
