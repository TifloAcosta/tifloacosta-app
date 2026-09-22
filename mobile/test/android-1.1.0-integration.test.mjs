import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { text } from '../src/core/i18n.mjs';

const read = async path => {
  try {
    return await readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  } catch {
    return '';
  }
};

test('Actualidad title delegates the exact news item to the common reader entry', async () => {
  const source = await read('src/screens/actualidad.mjs');
  assert.match(source, /onOpenNews/);
  assert.match(source, /openButton\.id\s*=\s*`news-open-\$\{item\.id\}`/);
  assert.match(source, /onOpenNews\?\.\(item,\s*openButton\.id\)/);
  assert.doesNotMatch(source, /openButton\.addEventListener\([\s\S]{0,160}nativeActions\?\.openExternal/);
  assert.match(source, /actualidad\.original/);
});

test('normal app navigation exposes one reader route backed by the shared loader/session', async () => {
  const source = await read('src/app.mjs');
  assert.match(source, /createReaderSession/);
  assert.match(source, /loadReadableTarget/);
  assert.match(source, /renderReader/);
  assert.match(source, /function openReadableFromApp/);
  assert.match(source, /case ['"]reader['"]/);
  assert.match(source, /allowOriginalFallback/);
  assert.match(source, /onOpenNews:\s*openActualidadNews/);
});

test('common reader renders semantic safe nodes and never injects remote HTML', async () => {
  const source = await read('src/screens/reader.mjs');
  assert.match(source, /export function renderReadableContent/);
  assert.match(source, /document\.createElement\(`h\$\{level\}`\)/);
  assert.match(source, /document\.createElement\('ul'\)/);
  assert.match(source, /part\.type === 'link'/);
  assert.match(source, /onActivateLink\(href,\s*link\.id\)/);
  assert.doesNotMatch(source, /innerHTML\s*=/);
});

test('reader operational copy exists in Spanish and English', () => {
  const keys = ['reader.title','reader.source','reader.backPage','reader.preparing','reader.loading','reader.errorHeading','reader.error','reader.retry'];
  for (const lang of ['es', 'en']) {
    for (const key of keys) assert.notEqual(text(lang, key), key, `Missing ${lang} ${key}`);
  }
});
