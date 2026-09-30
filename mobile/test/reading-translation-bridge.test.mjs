import test from 'node:test';
import assert from 'node:assert/strict';

import { createReadingTranslationClient } from '../src/core/reading-translation-client.mjs';

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

test('translation client exposes normalized language detection and supported languages', async () => {
  const client = createReadingTranslationClient(fakePlugin());
  assert.equal(await client.identifyLanguage('Hello'), 'en');
  assert.deepEqual(await client.listTranslationLanguages(), ['en', 'es', 'fr']);
});

test('translation client downloads models and translates ordered batches', async () => {
  const client = createReadingTranslationClient(fakePlugin());
  assert.equal(await client.downloadTranslationModel('ES'), true);
  const result = await client.translateBatch({
    sourceLanguage: 'EN',
    targetLanguage: 'ES',
    texts: ['one', 'two']
  });
  assert.deepEqual(result, { translations: ['en-es:one', 'en-es:two'], status: 'ok' });
});

test('translation client reports bridge translation failures without throwing', async () => {
  const client = createReadingTranslationClient({
    async translateBatch() { return { status: 'model-unavailable', translations: [] }; }
  });
  assert.deepEqual(await client.translateBatch({ sourceLanguage: 'en', targetLanguage: 'es', texts: ['x'] }), {
    translations: [],
    status: 'model-unavailable'
  });
});
