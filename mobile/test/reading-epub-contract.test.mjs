import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = async path => {
  try {
    return await readFile(new URL(`../${path}`, import.meta.url), 'utf8');
  } catch {
    return '';
  }
};

test('reading EPUB native contract routes EPUB through import, private storage and structured open', async () => {
  const [plugin, importer, store] = await Promise.all([
    read('android/app/src/main/java/com/tifloacosta/app/TifloReadingPlugin.java'),
    read('android/app/src/main/java/com/tifloacosta/app/reading/ReadingImportService.java'),
    read('android/app/src/main/java/com/tifloacosta/app/reading/AndroidReadingFileStore.java')
  ]);

  assert.match(plugin, /"application\/epub\+zip"/);
  assert.match(importer, /\.endsWith\("\.epub"\)/);
  assert.match(importer, /application\/epub\+zip/);
  assert.match(importer, /ReadingEpubAdapter/);
  assert.match(plugin, /"epub"\.equals\(record\.getFormat\(\)\)/);
  assert.match(plugin, /ReadingEpubAdapter/);
  assert.match(plugin, /result\.put\("content"/);
  assert.match(store, /"epub"\.equals\(format\)/);
  assert.match(store, /source\.epub/);
  assert.doesNotMatch(plugin, /READ_EXTERNAL_STORAGE|WRITE_EXTERNAL_STORAGE|MANAGE_EXTERNAL_STORAGE|READ_MEDIA_/);
});

test('reading EPUB common-reader contract consumes native structured documents instead of treating ZIP bytes as plain text', async () => {
  const reader = await read('src/screens/reading-book.mjs');
  const adapter = await read('src/core/reading-structured-adapter.mjs');

  assert.match(reader, /parseStructuredDocument/);
  assert.match(reader, /activeBook\.format\s*===\s*'epub'/);
  assert.match(adapter, /segmentSentences/);
  assert.match(adapter, /navigation/);
  assert.match(adapter, /pageReferences/);
  assert.match(adapter, /mediaSyncReferences/);
});
