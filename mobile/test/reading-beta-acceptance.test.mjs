import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const readRepo = path => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

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

test('beta acceptance preserves DAISY audio capabilities across the native-to-JavaScript bridge', async () => {
  const [plugin, client, screen] = await Promise.all([
    read('android/app/src/main/java/com/tifloacosta/app/TifloReadingPlugin.java'),
    read('src/core/reading-library-client.mjs'),
    read('src/screens/reading-book.mjs')
  ]);

  assert.match(plugin, /result\.put\("daisyHasText",\s*daisy\.hasText\(\)\)/);
  assert.match(plugin, /result\.put\("daisyHasAudio",\s*daisy\.hasAudio\(\)\)/);
  assert.match(plugin, /result\.put\("daisySynchronized",\s*daisy\.isSynchronized\(\)\)/);
  assert.match(client, /\['daisy2\.02',\s*'daisy3'\]\.includes\(book\.format\)/);
  assert.match(client, /daisyHasText:\s*booleanValue\(result\.daisyHasText\)/);
  assert.match(client, /daisyHasAudio:\s*booleanValue\(result\.daisyHasAudio\)/);
  assert.match(client, /daisySynchronized:\s*booleanValue\(result\.daisySynchronized\)/);
  assert.match(client, /audioTracks:\s*result\.daisyHasAudio\s*\?\s*await listAudioTracks\(book\.id\)/);
  assert.match(screen, /opened\.daisyHasAudio\s*&&\s*!opened\.daisyHasText/);
  assert.match(screen, /initializeOpenedAudioBook\(opened\)/);
});

test('beta acceptance keeps container-only ZIP out of the library book format surface', async () => {
  const importer = await read('android/app/src/main/java/com/tifloacosta/app/reading/ReadingImportService.java');

  assert.match(importer, /"zip"\.equals\(detectedFormat\)/);
  assert.match(importer, /if \(!zipPackage\.isDaisy\(\)\) return ReadingImportResult\.rejected\("ambiguous-zip"\)/);
  assert.match(importer, /recordFormat = zipPackage\.daisy\.getFormat\(\)/);
});

test('beta acceptance protects reading queue ordering and never auto-opens the next title', async () => {
  const [queue, reader] = await Promise.all([
    read('src/screens/reading-queue.mjs'),
    read('src/screens/reading-book.mjs')
  ]);

  assert.match(queue, /client\.listQueue\(\)/);
  assert.match(queue, /client\.moveQueueItem\(book\.id,\s*index\s*-\s*1\)/);
  assert.match(queue, /client\.moveQueueItem\(book\.id,\s*index\s*\+\s*1\)/);
  assert.match(queue, /client\.removeFromQueue\(book\.id\)/);
  assert.match(queue, /Nothing opens automatically|Nada se abre automáticamente/);
  assert.match(reader, /async function showEndOfDocument\(\)[\s\S]*nextSuggestedBookId = nextBook\.id;[\s\S]*openNext\.hidden = false;/);
  assert.match(reader, /openNext\.addEventListener\(['"]click['"],\s*\(\)\s*=>\s*\{[\s\S]*if \(nextSuggestedBookId\) onOpenBook\?\.\(nextSuggestedBookId\);[\s\S]*\}\);/);
});

test('beta acceptance protects portable backup review and explicit restore conflicts', async () => {
  const backup = await read('src/screens/reading-backup-panel.mjs');

  assert.match(backup, /client\.exportReadingBackup\(null\)/);
  assert.match(backup, /client\.pickReadingRestore\(\)/);
  assert.match(backup, /positionConflicts/);
  assert.match(backup, /keep-current/);
  assert.match(backup, /use-backup/);
  assert.match(backup, /client\.applyReadingRestore\(/);
  assert.match(backup, /client\.cancelReadingRestore\(\)/);
  assert.match(backup, /client\.checkReadingLibrary\(\)/);
  assert.match(backup, /client\.deleteAllReadingData\(/);
});

test('beta acceptance protects ten-item library paging across large libraries', async () => {
  const library = await read('src/screens/reading-library.mjs');

  assert.match(library, /const PAGE_SIZE = 10/);
  assert.match(library, /pageSize:\s*PAGE_SIZE/);
  assert.match(library, /readingLibrary\.previousPage/);
  assert.match(library, /readingLibrary\.nextPage/);
  assert.match(library, /readingLibrary\.pageStatus/);
});

test('beta acceptance protects TalkBack dialog semantics and return-to-reading focus', async () => {
  const [reader, settings, backup] = await Promise.all([
    read('src/screens/reading-book.mjs'),
    read('src/screens/reading-settings.mjs'),
    read('src/screens/reading-backup-panel.mjs')
  ]);

  assert.match(reader, /focusCurrentSemanticUnit/);
  assert.match(reader, /previous\.setAttribute\(['"]aria-label['"]/);
  assert.match(reader, /next\.setAttribute\(['"]aria-label['"]/);
  assert.match(settings, /setAttribute\(['"]role['"],\s*['"]dialog['"]\)/);
  assert.match(settings, /setAttribute\(['"]aria-modal['"],\s*['"]true['"]\)/);
  assert.match(settings, /readingBook\.returnToReading/);
  assert.match(settings, /returnFocus/);
  assert.match(backup, /setAttribute\(['"]role['"],\s*['"]dialog['"]\)/);
  assert.match(backup, /Return to reading|Volver a la lectura/);
});

test('beta acceptance has a dedicated CI gate before Android packaging', async () => {
  const [packageJson, foundationWorkflow, bootstrapWorkflow] = await Promise.all([
    read('package.json'),
    readRepo('.github/workflows/test-mobile-foundation.yml'),
    readRepo('.github/workflows/bootstrap-mobile-android.yml')
  ]);

  const pkg = JSON.parse(packageJson);
  assert.equal(pkg.scripts?.['test:reading-beta'], 'node --test test/reading-beta-acceptance.test.mjs');
  assert.match(foundationWorkflow, /Run Leer con TifloAcosta beta acceptance gate[\s\S]*npm run test:reading-beta/);
  assert.match(bootstrapWorkflow, /Run Leer con TifloAcosta beta acceptance gate[\s\S]*npm run test:reading-beta/);
});
