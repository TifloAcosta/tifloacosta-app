import test from 'node:test';
import assert from 'node:assert/strict';

import { createReadingLibraryClient } from '../src/core/reading-library-client.mjs';

function fakePlugin() {
  return {
    async identifyLanguage({ text }) { return { language: text ? 'EN' : 'und' }; },
    async listTranslationLanguages() { return { languages: ['ES', 'en', 'fr'] }; },
    async downloadTranslationModel({ language }) { return { downloaded: language === 'es', language }; },
    async translateBatch({ sourceLanguage, targetLanguage, texts }) {
      return { translations: texts.map(text => `${sourceLanguage}-${targetLanguage}:${text}`) };
    }
  };
}

test('reading client exposes normalized language detection and supported translation languages', async () => {
  const client = createReadingLibraryClient(fakePlugin());
  assert.equal(await client.identifyLanguage('Hello'), 'en');
  assert.deepEqual(await client.listTranslationLanguages(), ['en', 'es', 'fr']);
});

test('reading client downloads models and translates ordered batches', async () => {
  const client = createReadingLibraryClient(fakePlugin());
  assert.equal(await client.downloadTranslationModel('ES'), true);
  const result = await client.translateBatch({
    sourceLanguage: 'EN',
    targetLanguage: 'ES',
    texts: ['one', 'two']
  });
  assert.deepEqual(result, { translations: ['en-es:one', 'en-es:two'], status: 'ok' });
});

test('reading client reports bridge translation failures without throwing', async () => {
  const client = createReadingLibraryClient({
    async translateBatch() { return { status: 'model-unavailable', translations: [] }; }
  });
  assert.deepEqual(await client.translateBatch({ sourceLanguage: 'en', targetLanguage: 'es', texts: ['x'] }), {
    translations: [],
    status: 'model-unavailable'
  });
});
