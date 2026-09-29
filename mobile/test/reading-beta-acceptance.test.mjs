import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('beta acceptance wires every approved textual format into the common semantic reader', async () => {
  const [plugin, screen] = await Promise.all([
    read('android/app/src/main/java/com/tifloacosta/app/TifloReadingPlugin.java'),
    read('src/screens/reading-book.mjs')
  ]);

  assert.match(plugin, /ReadingEpubAdapter/);
  assert.match(plugin, /ReadingDocxAdapter/);
  assert.match(plugin, /ReadingDaisyAdapter/);
  assert.match(plugin, /"daisy2\.02"\.equals\(record\.getFormat\(\)\)/);
  assert.match(plugin, /"daisy3"\.equals\(record\.getFormat\(\)\)/);
  assert.match(plugin, /ReadingStructuredDocumentJson\.serialize\(document\)/);

  assert.match(screen, /parseTextDocument/);
  assert.match(screen, /parseHtmlDocument/);
  assert.match(screen, /parsePdfDocument/);
  assert.match(screen, /parseStructuredDocument/);
  for (const format of ['epub', 'docx', 'daisy2.02', 'daisy3']) {
    assert.ok(screen.includes(`'${format}'`), `Shared reader does not route ${format} through structured semantics`);
  }
});

test('beta acceptance keeps container-only ZIP out of the library book format surface', async () => {
  const importer = await read('android/app/src/main/java/com/tifloacosta/app/reading/ReadingImportService.java');

  assert.match(importer, /"zip"\.equals\(detectedFormat\)/);
  assert.match(importer, /if \(!zipPackage\.isDaisy\(\)\) return ReadingImportResult\.rejected\("ambiguous-zip"\)/);
  assert.match(importer, /recordFormat = zipPackage\.daisy\.getFormat\(\)/);
});
