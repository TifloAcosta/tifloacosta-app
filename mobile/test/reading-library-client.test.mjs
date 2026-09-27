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
          mediaTrackIndex: '2',
          mediaPositionMs: '5000000000',
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
    unitIndex: 0,
    anchorText: '',
    mediaTrackIndex: 2,
    mediaPositionMs: 5000000000,
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
  assert.equal(latest.mediaTrackIndex, 0);
  assert.equal(latest.mediaPositionMs, 0);
});

test('reading library client keeps TXT and HTML openBook content behavior unchanged', async () => {
  const calls = [];
  const client = createReadingLibraryClient({
    async openBook(id, options) {
      calls.push({ id, options });
      return {
        book: { id, title: 'Texto', format: 'TXT' },
        content: 'Contenido normal.'
      };
    }
  });

  const result = await client.openBook('txt-1');

  assert.deepEqual(calls, [{ id: 'txt-1', options: { password: '' } }]);
  assert.equal(result.book.format, 'txt');
  assert.equal(result.content, 'Contenido normal.');
  assert.equal('pdf' in result, false);
});

test('reading library client preserves structured PDF payload without stringifying it', async () => {
  const client = createReadingLibraryClient({
    async openBook(id, options) {
      return {
        book: { id, title: 'Manual', format: 'PDF' },
        pdf: {
          title: 'Manual interno',
          author: 'Autor',
          language: 'es',
          pageCount: '2',
          orderReliable: false,
          pages: [
            { number: '1', text: 'Página uno.' },
            { number: 2, text: 'Página dos.' }
          ]
        }
      };
    }
  });

  const result = await client.openBook('pdf-1');

  assert.equal(result.book.format, 'pdf');
  assert.deepEqual(result.pdf, {
    title: 'Manual interno',
    author: 'Autor',
    language: 'es',
    pageCount: 2,
    orderReliable: false,
    pages: [
      { number: 1, text: 'Página uno.' },
      { number: 2, text: 'Página dos.' }
    ]
  });
  assert.equal(typeof result.pdf, 'object');
});

test('reading library client forwards a transient PDF password once and never returns it', async () => {
  const calls = [];
  const secret = 'clave-temporal-123';
  const client = createReadingLibraryClient({
    async openBook(id, options) {
      calls.push({ id, options: { ...options } });
      if (!options.password) {
        return {
          book: { id, title: 'Protegido', format: 'pdf' },
          passwordRequired: true,
          passwordRejected: false
        };
      }
      return {
        book: { id, title: 'Protegido', format: 'pdf' },
        pdf: {
          pageCount: 1,
          orderReliable: true,
          pages: [{ number: 1, text: 'Contenido abierto.' }]
        }
      };
    }
  });

  const challenge = await client.openBook('pdf-secret');
  assert.equal(challenge.passwordRequired, true);
  assert.equal(challenge.passwordRejected, false);

  const opened = await client.openBook('pdf-secret', { password: secret });
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[1], { id: 'pdf-secret', options: { password: secret } });
  assert.equal(opened.pdf.pages[0].text, 'Contenido abierto.');
  assert.equal(JSON.stringify(opened).includes(secret), false);
});

test('reading library client keeps rejected password and PDF no-text states distinct from generic failure', async () => {
  const passwordClient = createReadingLibraryClient({
    async openBook(id) {
      return {
        book: { id, title: 'Protegido', format: 'pdf' },
        passwordRequired: true,
        passwordRejected: true
      };
    }
  });
  const noTextClient = createReadingLibraryClient({
    async openBook(id) {
      return {
        book: { id, title: 'Escaneado', format: 'pdf' },
        pdfNoText: true,
        pageCount: '4'
      };
    }
  });

  const rejected = await passwordClient.openBook('protected', { password: 'incorrecta' });
  assert.equal(rejected.passwordRequired, true);
  assert.equal(rejected.passwordRejected, true);

  const noText = await noTextClient.openBook('scan');
  assert.equal(noText.pdfNoText, true);
  assert.equal(noText.pageCount, 4);
});

test('reading library client saves exact audio track and long millisecond position without truncation', async () => {
  const calls = [];
  const client = createReadingLibraryClient({
    async saveProgress(progress) {
      calls.push(progress);
      return { saved: true };
    }
  });

  const saved = await client.saveProgress({
    id: 'audio-1',
    mediaTrackIndex: 3,
    mediaPositionMs: 5000000000,
    percent: 42.5,
    state: 'in-reading'
  });

  assert.equal(saved, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].mediaTrackIndex, 3);
  assert.equal(calls[0].mediaPositionMs, 5000000000);
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

test('reading library native wrapper forwards transient openBook password and degrades safely', async () => {
  const calls = [];
  const native = {
    async openBook(options) {
      calls.push({ ...options });
      return { book: { id: options.id, title: 'PDF', format: 'pdf' }, passwordRequired: true };
    }
  };
  const wrapper = createReadingLibraryPlugin(native);

  const result = await wrapper.openBook('pdf-1', { password: 'secreta' });

  assert.deepEqual(calls, [{ id: 'pdf-1', password: 'secreta' }]);
  assert.equal(result.passwordRequired, true);
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
