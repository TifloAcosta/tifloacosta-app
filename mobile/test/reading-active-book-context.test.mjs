import assert from 'node:assert/strict';
import test from 'node:test';
import { createReadingLibraryClient } from '../src/core/reading-library-client.mjs';

test('reading client exposes the last successfully opened book id to background speech', async () => {
  const client = createReadingLibraryClient({
    async openBook(id) {
      return { book: { id, title: 'Libro', format: 'txt' }, content: 'Texto.' };
    }
  });

  assert.equal(client.getActiveBookId(), '');
  const opened = await client.openBook('book-42');
  assert.equal(opened.book.id, 'book-42');
  assert.equal(client.getActiveBookId(), 'book-42');
});

test('failed open does not replace the last valid active book id', async () => {
  let fail = false;
  const client = createReadingLibraryClient({
    async openBook(id) {
      if (fail) throw new Error('boom');
      return { book: { id, title: 'Libro', format: 'txt' }, content: 'Texto.' };
    }
  });

  await client.openBook('book-ok');
  fail = true;
  assert.equal(await client.openBook('book-bad'), null);
  assert.equal(client.getActiveBookId(), 'book-ok');
});
