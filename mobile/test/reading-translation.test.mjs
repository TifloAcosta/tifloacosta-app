import test from 'node:test';
import assert from 'node:assert/strict';

import { createReadingTranslationJob, readingTranslationCacheKey } from '../src/core/reading-translation.mjs';
import { parseStructuredDocument } from '../src/core/reading-structured-adapter.mjs';

function sourceDocument() {
  return parseStructuredDocument({
    title: 'Sample',
    language: 'en',
    blocks: [
      { id: 'h1', type: 'heading', level: 2, text: 'Introduction' },
      { id: 'p1', type: 'paragraph', text: 'Hello world.' },
      { id: 'l1', type: 'list-item', text: 'First item' },
      { id: 'q1', type: 'quote', text: 'A short quote' },
      { id: 'c1', type: 'table-cell', text: 'Table value' },
      { id: 'u1', type: 'paragraph', text: 'https://example.com' }
    ]
  });
}

function fakeClient(saved = null) {
  const calls = [];
  const writes = [];
  return {
    calls,
    writes,
    async getDerivedContent() { return saved; },
    async saveDerivedContent(value) { writes.push(value); return true; },
    async translateBatch({ texts }) {
      calls.push([...texts]);
      return { translations: texts.map(text => `ES:${text}`) };
    }
  };
}

test('translation cache key is deterministic and includes source identity and languages', () => {
  const first = readingTranslationCacheKey({ sourceSha256: 'abc', sourceLanguage: 'en', targetLanguage: 'es', engine: 'mlkit' });
  const second = readingTranslationCacheKey({ sourceSha256: 'abc', sourceLanguage: 'en', targetLanguage: 'es', engine: 'mlkit' });
  const changed = readingTranslationCacheKey({ sourceSha256: 'xyz', sourceLanguage: 'en', targetLanguage: 'es', engine: 'mlkit' });
  assert.equal(first, second);
  assert.notEqual(first, changed);
});

test('translation preserves semantic block kind and source alignment while excluding URL-only blocks', async () => {
  const client = fakeClient();
  const job = createReadingTranslationJob({
    client,
    bookId: 'book-1',
    document: sourceDocument(),
    sourceLanguage: 'en',
    targetLanguage: 'es',
    sourceSha256: 'sha-1'
  });

  await job.load();
  await job.resumeNext();
  const state = job.getState();

  assert.equal(state.status, 'complete');
  assert.deepEqual(state.document.blocks.map(block => block.type), ['heading', 'paragraph', 'list-item', 'quote', 'table-cell', 'paragraph']);
  assert.deepEqual(state.document.blocks.slice(0, 5).map(block => block.sourceRef), [
    { blockIndex: 0, blockId: 'h1' },
    { blockIndex: 1, blockId: 'p1' },
    { blockIndex: 2, blockId: 'l1' },
    { blockIndex: 3, blockId: 'q1' },
    { blockIndex: 4, blockId: 'c1' }
  ]);
  assert.equal(state.document.blocks[5].text, 'https://example.com');
  assert.equal(client.calls.flat().includes('https://example.com'), false);
});

test('translation persists bounded partial work and resumes it without retranslating completed blocks', async () => {
  const document = sourceDocument();
  const firstClient = fakeClient();
  const first = createReadingTranslationJob({
    client: firstClient,
    bookId: 'book-1',
    document,
    sourceLanguage: 'en',
    targetLanguage: 'es',
    sourceSha256: 'sha-1',
    batchSize: 2
  });
  await first.load();
  await first.resumeNext();
  const partialWrite = firstClient.writes.at(-1);
  assert.equal(partialWrite.metadata.status, 'partial');
  assert.equal(partialWrite.metadata.completedUnits, 2);

  const resumedClient = fakeClient({
    ...partialWrite.metadata,
    content: partialWrite.content
  });
  const resumed = createReadingTranslationJob({
    client: resumedClient,
    bookId: 'book-1',
    document,
    sourceLanguage: 'en',
    targetLanguage: 'es',
    sourceSha256: 'sha-1',
    batchSize: 2
  });
  await resumed.load();
  assert.equal(resumed.getState().completedUnits, 2);
  await resumed.resumeNext();
  assert.equal(resumedClient.calls.flat().includes('Introduction'), false);
  assert.equal(resumedClient.calls.flat().includes('Hello world.'), false);
});

test('translation ignores stale persisted content when source SHA changes', async () => {
  const client = fakeClient({
    sourceSha256: 'old-sha',
    sourceLanguage: 'en',
    targetLanguage: 'es',
    status: 'partial',
    completedUnits: 2,
    totalUnits: 5,
    content: { version: 1, blocks: [{ sourceBlockIndex: 0, text: 'OLD' }] }
  });
  const job = createReadingTranslationJob({
    client,
    bookId: 'book-1',
    document: sourceDocument(),
    sourceLanguage: 'en',
    targetLanguage: 'es',
    sourceSha256: 'new-sha'
  });
  await job.load();
  assert.equal(job.getState().completedUnits, 0);
});
