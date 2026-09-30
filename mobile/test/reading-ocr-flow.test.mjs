import assert from 'node:assert/strict';
import test from 'node:test';

import { createReadingOcrFlow } from '../src/core/reading-ocr-flow.mjs';

test('partial OCR resumes from the first missing page and persists progress', async () => {
  const recognized = [];
  const saved = [];
  const client = {
    async getDerivedContent() {
      return {
        status: 'partial', completedUnits: 2, totalUnits: 4,
        content: { version: 1, script: 'latin', pages: [
          { pageIndex: 0, text: 'page zero', blocks: ['page zero'], status: 'ok' },
          { pageIndex: 2, text: 'page two', blocks: ['page two'], status: 'ok' }
        ] }
      };
    },
    async recognizePdfPage(options) {
      recognized.push(options.pageIndex);
      return { pageIndex: options.pageIndex, text: 'page one', blocks: ['page one'], status: 'ok' };
    },
    async saveDerivedContent(value) { saved.push(value); return true; }
  };

  const flow = createReadingOcrFlow({ client, bookId: 'book-1', pageCount: 4, script: 'latin' });
  await flow.load();
  assert.equal(flow.getState().nextMissingPage, 1);
  const result = await flow.resumeNext();

  assert.equal(result.status, 'ok');
  assert.deepEqual(recognized, [1]);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].metadata.status, 'partial');
  assert.equal(saved[0].metadata.completedUnits, 3);
  assert.equal(saved[0].metadata.totalUnits, 4);
  assert.deepEqual(saved[0].content.pages.map(page => page.pageIndex), [0, 1, 2]);
  assert.equal(flow.getState().nextMissingPage, 3);
});

test('recognizing a current page never starts adjacent pages automatically', async () => {
  const recognized = [];
  const client = {
    async getDerivedContent() { return null; },
    async recognizePdfPage(options) {
      recognized.push(options.pageIndex);
      return { pageIndex: options.pageIndex, text: `page ${options.pageIndex}`, blocks: [], status: 'ok' };
    },
    async saveDerivedContent() { return true; }
  };
  const flow = createReadingOcrFlow({ client, bookId: 'book-1', pageCount: 5 });
  await flow.load();
  await flow.recognizePage(3);
  assert.deepEqual(recognized, [3]);
});

test('model-unavailable and errors remain explicit and do not invent persisted pages', async () => {
  const saved = [];
  const client = {
    async getDerivedContent() { return null; },
    async recognizePdfPage() { return { pageIndex: 0, text: '', blocks: [], status: 'model-unavailable' }; },
    async saveDerivedContent(value) { saved.push(value); return true; }
  };
  const flow = createReadingOcrFlow({ client, bookId: 'book-1', pageCount: 2 });
  await flow.load();
  const result = await flow.recognizePage(0);
  assert.equal(result.status, 'model-unavailable');
  assert.equal(saved.length, 0);
  assert.equal(flow.getState().status, 'model-unavailable');
  assert.equal(flow.getState().completedUnits, 0);
});

test('manual script override uses a separate persisted OCR variant', async () => {
  const reads = [];
  const recognitions = [];
  const client = {
    async getDerivedContent(options) { reads.push(options); return null; },
    async recognizePdfPage(options) {
      recognitions.push(options);
      return { pageIndex: 0, text: '日本語', blocks: ['日本語'], status: 'ok' };
    },
    async saveDerivedContent() { return true; }
  };
  const flow = createReadingOcrFlow({ client, bookId: 'book-1', pageCount: 1, script: 'japanese', password: 'temporary' });
  await flow.load();
  await flow.recognizePage(0);

  assert.equal(reads[0].variantKey, 'japanese');
  assert.equal(recognitions[0].script, 'japanese');
  assert.equal(recognitions[0].password, 'temporary');
  assert.equal(flow.getState().status, 'complete');
});
