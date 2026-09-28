import assert from 'node:assert/strict';
import test from 'node:test';
import { createReadingLibraryClient } from '../src/core/reading-library-client.mjs';
import { createReadingLibraryPlugin } from '../src/native/reading-library-plugin.mjs';

test('reading library client exposes author language format filter and author sort', async () => {
  const calls = [];
  const client = createReadingLibraryClient({
    async listBooks(options) {
      calls.push(options);
      return {
        items: [{
          id: 'epub-1',
          title: ' Libro ',
          author: ' Autora ',
          language: ' ES ',
          format: 'EPUB',
          queued: true,
          state: 'not-read'
        }],
        total: 1,
        page: 1,
        pageSize: 10,
        pages: 1
      };
    }
  });

  const result = await client.listBooks({ format: ' EPUB ', sort: 'author' });

  assert.deepEqual(calls, [{
    page: 1,
    pageSize: 10,
    query: '',
    status: 'all',
    format: 'epub',
    sort: 'author'
  }]);
  assert.equal(result.items[0].author, 'Autora');
  assert.equal(result.items[0].language, 'es');
  assert.equal(result.items[0].queued, true);
});

test('reading library client normalizes and mutates the reading queue', async () => {
  const calls = [];
  const plugin = {
    async listQueue() {
      return {
        items: [
          { id: 'b', title: 'Segundo', format: 'docx', queueIndex: 1 },
          { id: 'a', title: 'Primero', format: 'epub', queueIndex: 0 }
        ]
      };
    },
    async addToQueue(options) {
      calls.push(['add', options]);
      return { queued: true };
    },
    async removeFromQueue(options) {
      calls.push(['remove', options]);
      return { removed: true };
    },
    async moveQueueItem(options) {
      calls.push(['move', options]);
      return { moved: true };
    }
  };
  const client = createReadingLibraryClient(plugin);

  assert.equal(typeof client.listQueue, 'function');
  assert.equal(typeof client.addToQueue, 'function');
  assert.equal(typeof client.removeFromQueue, 'function');
  assert.equal(typeof client.moveQueueItem, 'function');

  const queue = await client.listQueue();
  assert.deepEqual(queue.map(item => [item.id, item.queueIndex]), [['a', 0], ['b', 1]]);
  assert.equal(await client.addToQueue('a'), true);
  assert.equal(await client.removeFromQueue('a'), true);
  assert.equal(await client.moveQueueItem('b', 0), true);
  assert.deepEqual(calls, [
    ['add', { bookId: 'a' }],
    ['remove', { bookId: 'a' }],
    ['move', { bookId: 'b', targetIndex: 0 }]
  ]);
});

test('reading library native wrapper forwards queue operations and degrades safely', async () => {
  const calls = [];
  const wrapper = createReadingLibraryPlugin({
    async listQueue() {
      return { items: [{ id: 'a', title: 'A', queueIndex: 0 }] };
    },
    async addToQueue(options) {
      calls.push(['add', options]);
      return { queued: true };
    },
    async removeFromQueue(options) {
      calls.push(['remove', options]);
      return { removed: true };
    },
    async moveQueueItem(options) {
      calls.push(['move', options]);
      return { moved: true };
    }
  });

  assert.equal(typeof wrapper.listQueue, 'function');
  assert.equal(typeof wrapper.addToQueue, 'function');
  assert.equal(typeof wrapper.removeFromQueue, 'function');
  assert.equal(typeof wrapper.moveQueueItem, 'function');
  assert.equal((await wrapper.listQueue()).items.length, 1);
  assert.equal(await wrapper.addToQueue('a'), true);
  assert.equal(await wrapper.removeFromQueue('a'), true);
  assert.equal(await wrapper.moveQueueItem('a', 2), true);
  assert.deepEqual(calls, [
    ['add', { bookId: 'a' }],
    ['remove', { bookId: 'a' }],
    ['move', { bookId: 'a', targetIndex: 2 }]
  ]);

  const empty = createReadingLibraryPlugin({});
  assert.deepEqual(await empty.listQueue(), { items: [] });
  assert.equal(await empty.addToQueue('a'), false);
  assert.equal(await empty.removeFromQueue('a'), false);
  assert.equal(await empty.moveQueueItem('a', 0), false);
});
