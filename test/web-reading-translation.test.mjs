import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('web reader exposes accessible translation controls', async () => {
  const html = await read('index.html');
  for (const id of [
    'reading-translation-web',
    'reading-translation-heading',
    'reading-translation-source',
    'reading-translation-target',
    'reading-translation-prepare',
    'reading-translation-start',
    'reading-translation-stop',
    'reading-translation-original',
    'reading-translation-translated',
    'reading-translation-status'
  ]) {
    assert.ok(html.includes(`id="${id}"`), `Missing translation control ${id}`);
  }
  assert.ok(html.includes('aria-live="polite"'));
  assert.ok(html.includes('aria-pressed="true"'));
});

test('web translation adapter uses the browser Translator and LanguageDetector APIs', async () => {
  const source = await read('shared/web-reading-translation-adapter.mjs');
  assert.ok(source.includes('globalThis.Translator'));
  assert.ok(source.includes('globalThis.LanguageDetector'));
  assert.ok(source.includes('TranslatorClass.availability'));
  assert.ok(source.includes('TranslatorClass.create'));
  assert.ok(source.includes('translator.translate'));
  assert.ok(source.includes('prepareTranslationPair'));
  assert.ok(source.includes('translateBatch'));
});

test('shared translation client supports optional pair preparation without breaking mobile contract', async () => {
  const source = await read('shared/reading-translation-client.mjs');
  assert.ok(source.includes('prepareTranslationPair'));
  assert.ok(source.includes('downloadTranslationModel'));
  assert.ok(source.includes('translateBatch'));
});

test('web reader connects shared translation job and preserves original/translated views', async () => {
  const source = await read('web-reading.js');
  for (const token of [
    'createWebReadingTranslationAdapter',
    'createReadingTranslationClient',
    'createReadingTranslationJob',
    'translationPersistenceClient',
    'prepareTranslationPair',
    'runTranslation',
    'switchTranslationView',
    'originalDocumentModel',
    'translationDocument'
  ]) {
    assert.ok(source.includes(token), `Missing translation token ${token}`);
  }
  assert.ok(source.includes("engine: 'browser-translator'"));
});

test('privacy policy explains browser-local translation behavior', async () => {
  const policy = await read('privacidad/index.html');
  assert.ok(policy.includes('modelo interno del propio navegador'));
  assert.ok(policy.includes('no envía el texto a un servicio de traducción propio'));
  assert.ok(policy.includes("browser's own internal model"));
  assert.ok(policy.includes('does not send document text to its own translation service'));
});
