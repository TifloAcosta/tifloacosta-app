import assert from 'node:assert/strict';
import test from 'node:test';
import { createReadingLibraryClient } from '../src/core/reading-library-client.mjs';
import { createReadingLibraryPlugin } from '../src/native/reading-library-plugin.mjs';

const emptyBatch = {
  cancelled: false,
  imported: [],
  duplicates: [],
  rejected: []
};

test('reading library client applies paged defaults and normalizes book fields', async () => {
  const fakePlugin = {
    lastListOptions: null,
    async listBooks(options) {
      this.lastListOptions = options;
      return {
        items: [{
          id: 42,
          title: '  Mi libro  ',
          format: 'TXT',
          state: 'in-reading',
          percent: '25.5',
          blockIndex: '3',
          importedAt: '1000',
          lastReadAt: '2000',
          sizeBytes: '4096'
        }],
        total: '11',
        page: '1',
        pageSize: '10',
        pages: '2'
      };
    }
  };
  const client = createReadingLibraryClient(fakePlugin);

  const result = await client.listBooks();

  assert.deepEqual(fakePlugin.lastListOptions, {
    page: 1,
    pageSize: 10,
    query: '',
    status: 'all',
    sort: 'lastRead'
  });
  assert.equal(result.pageSize, 10);
  assert.equal(result.total, 11);
  assert.equal(result.pages, 2);
  assert.deepEqual(result.items[0], {
    id: '42',
    title: 'Mi libro',
    format: 'txt',
    state: 'in-reading',
    percent: 25.5,
    blockIndex: 3,
    importedAt: 1000,
    lastReadAt: 2000,
    sizeBytes: 4096
  });
});

test('reading library client normalizes import batches and latest reading item', async () => {
  const client = createReadingLibraryClient({
    async pickDocuments() {
      return {
        cancelled: 0,
        imported: [{ id: 'a', title: ' A ', format: 'TXT' }],
        duplicates: [{ id: 'b', title: ' B ' }],
        rejected: [{ name: 'bad.bin', reason: 'unsupported' }]
      };
    },
    async getLatestInProgress() {
      return { id: 'a', title: ' A ', format: 'TXT', percent: '50', blockIndex: '4' };
    }
  });

  const batch = await client.pickDocuments();
  assert.equal(batch.cancelled, false);
  assert.equal(batch.imported[0].id, 'a');
  assert.equal(batch.imported[0].title, 'A');
  assert.equal(batch.imported[0].format, 'txt');
  assert.equal(batch.duplicates[0].id, 'b');
  assert.deepEqual(batch.rejected[0], { name: 'bad.bin', reason: 'unsupported' });

  const latest = await client.getLatestInProgress();
  assert.equal(latest.id, 'a');
  assert.equal(latest.percent, 50);
  assert.equal(latest.blockIndex, 4);
});

test('reading library client returns safe empty results when optional native functions are absent', async () => {
  const client = createReadingLibraryClient({});

  assert.deepEqual(await client.listBooks(), {
    items: [], total: 0, page: 1, pageSize: 10, pages: 0
  });
  assert.deepEqual(await client.consumeInitialSharedDocuments(), emptyBatch);
  assert.equal(await client.openBook('missing'), null);
  assert.equal(await client.saveProgress({ id: 'missing' }), false);
  assert.equal(await client.deleteBook('missing'), false);
  assert.equal(await client.getLatestInProgress(), null);
});

test('reading library native wrapper degrades safely and listener fallback is removable', async () => {
  const wrapper = createReadingLibraryPlugin({});

  assert.deepEqual(await wrapper.pickDocuments(), {
    cancelled: true,
    imported: [],
    duplicates: [],
    rejected: []
  });
  assert.deepEqual(await wrapper.consumeInitialSharedDocuments(), emptyBatch);
  assert.deepEqual(await wrapper.listBooks({ page: 2, pageSize: 10 }), {
    items: [], total: 0, page: 2, pageSize: 10, pages: 0
  });
  assert.equal(await wrapper.openBook('missing'), null);
  assert.equal(await wrapper.saveProgress({ id: 'missing' }), false);
  assert.equal(await wrapper.deleteBook('missing'), false);
  assert.equal(await wrapper.getLatestInProgress(), null);

  const handle = await wrapper.addListener('documentsReceived', () => {});
  assert.equal(typeof handle.remove, 'function');
  await handle.remove();
});
