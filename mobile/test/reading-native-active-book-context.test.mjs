import assert from 'node:assert/strict';
import test from 'node:test';
import { createReadingLibraryPlugin } from '../src/native/reading-library-plugin.mjs';

test('native reading adapter remembers the last successfully opened book id', async () => {
  let fail = false;
  const native = {
    async openBook({ id }) {
      if (fail) throw new Error('boom');
      return { book: { id, title: 'Libro', format: 'txt' }, content: 'Texto.' };
    }
  };
  const plugin = createReadingLibraryPlugin(native, native, native, native, native);

  assert.equal(plugin.getActiveBookId(), '');
  const opened = await plugin.openBook('book-42');
  assert.equal(opened.book.id, 'book-42');
  assert.equal(plugin.getActiveBookId(), 'book-42');

  fail = true;
  assert.equal(await plugin.openBook('book-bad'), null);
  assert.equal(plugin.getActiveBookId(), 'book-42');
});
