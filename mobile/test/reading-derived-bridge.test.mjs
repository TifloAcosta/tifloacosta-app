import assert from 'node:assert/strict';
import test from 'node:test';

import { createReadingLibraryClient } from '../src/core/reading-library-client.mjs';

test('derived content client saves, loads, lists and deletes validated private results', async () => {
  const calls = [];
  const derivedPlugin = {
    async saveDerivedContent(options) {
      calls.push(['save', options]);
      return { saved: true };
    },
    async getDerivedContent(options) {
      calls.push(['get', options]);
      return {
        found: true,
        bookId: 'book-1',
        kind: 'ocr',
        variantKey: 'latin',
        sourceSha256: 'abc',
        sourceLanguage: '',
        targetLanguage: '',
        engine: 'mlkit',
        engineVersion: '1',
        status: 'partial',
        completedUnits: 2,
        totalUnits: 5,
        updatedAt: 12,
        content: '{"pages":[{"pageIndex":0,"text":"uno"}]}'
      };
    },
    async listDerivedContent(options) {
      calls.push(['list', options]);
      return { items: [{
        bookId: 'book-1', kind: 'ocr', variantKey: 'latin', sourceSha256: 'abc',
        status: 'partial', completedUnits: 2, totalUnits: 5, updatedAt: 12
      }] };
    },
    async deleteDerivedContent(options) {
      calls.push(['delete', options]);
      return { deleted: true };
    }
  };
  const client = createReadingLibraryClient({}, derivedPlugin);

  assert.equal(await client.saveDerivedContent({
    bookId: 'book-1', kind: 'ocr', variantKey: 'latin',
    metadata: { sourceSha256: 'abc', engine: 'mlkit', engineVersion: '1', status: 'partial', completedUnits: 2, totalUnits: 5 },
    content: { pages: [{ pageIndex: 0, text: 'uno' }] }
  }), true);

  const loaded = await client.getDerivedContent({ bookId: 'book-1', kind: 'ocr', variantKey: 'latin' });
  assert.equal(loaded.status, 'partial');
  assert.equal(loaded.completedUnits, 2);
  assert.deepEqual(loaded.content, { pages: [{ pageIndex: 0, text: 'uno' }] });

  const listed = await client.listDerivedContent('book-1');
  assert.equal(listed.length, 1);
  assert.equal(listed[0].variantKey, 'latin');
  assert.equal(await client.deleteDerivedContent({ bookId: 'book-1', kind: 'ocr', variantKey: 'latin' }), true);
  assert.deepEqual(calls.map(entry => entry[0]), ['save', 'get', 'list', 'delete']);
});

test('derived content client rejects malformed JSON, unsupported metadata and stale records', async () => {
  const client = createReadingLibraryClient({}, {
    async getDerivedContent() {
      return { found: true, stale: false, bookId: 'book-1', kind: 'ocr', variantKey: 'latin', status: 'complete', content: '{bad' };
    },
    async saveDerivedContent() { return { saved: true }; }
  });

  assert.equal(await client.getDerivedContent({ bookId: 'book-1', kind: 'ocr', variantKey: 'latin' }), null);
  assert.equal(await client.saveDerivedContent({ bookId: 'book-1', kind: 'other', variantKey: 'x', content: {} }), false);

  const staleClient = createReadingLibraryClient({}, {
    async getDerivedContent() { return { found: false, stale: true }; }
  });
  assert.equal(await staleClient.getDerivedContent({ bookId: 'book-1', kind: 'ocr', variantKey: 'latin' }), null);
});

test('reading client exposes page OCR with an error fallback and active book id', async () => {
  const calls = [];
  const plugin = {
    async openBook() { return { book: { id: 'book-1', format: 'pdf', title: 'Scan' }, pdfNoText: true, pageCount: 3 }; },
    async recognizePdfPage(options) { calls.push(options); return { pageIndex: 1, text: 'texto', blocks: ['texto'], status: 'ok' }; }
  };
  const client = createReadingLibraryClient(plugin);
  await client.openBook('book-1');
  const result = await client.recognizePdfPage({ pageIndex: 1, script: 'latin' });
  assert.equal(result.status, 'ok');
  assert.deepEqual(calls, [{ bookId: 'book-1', password: '', pageIndex: 1, script: 'latin' }]);

  const fallback = await createReadingLibraryClient({}).recognizePdfPage({ pageIndex: 2 });
  assert.deepEqual(fallback, { pageIndex: 2, text: '', blocks: [], status: 'error' });
});
