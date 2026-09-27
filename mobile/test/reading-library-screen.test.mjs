import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('reading library screen keeps import, search, paging and delete actions explicit', async () => {
  const screen = await read('src/screens/reading-library.mjs');

  assert.match(screen, /export function renderReadingLibrary/);
  assert.match(screen, /client\.getLatestInProgress\(\)/);
  assert.match(screen, /client\.pickDocuments\(\)/);
  assert.match(screen, /client\.listBooks\(\{[\s\S]*pageSize:\s*10[\s\S]*query/);
  assert.match(screen, /addEventListener\(['"]submit['"]/);
  assert.doesNotMatch(screen, /addEventListener\(['"]input['"][\s\S]{0,120}listBooks/);
  assert.match(screen, /aria-live['"],\s*['"]polite['"]/);
  assert.match(screen, /readingLibrary\.options/);
  assert.match(screen, /readingLibrary\.confirmDelete/);
  assert.match(screen, /client\.deleteBook\(/);
  assert.match(screen, /readingLibrary\.previousPage/);
  assert.match(screen, /readingLibrary\.nextPage/);
  assert.match(screen, /readingLibrary\.pageStatus/);
});

test('reading library exposes one open-now action only for one newly imported book', async () => {
  const screen = await read('src/screens/reading-library.mjs');
  assert.match(screen, /initialImportBatch/);
  assert.match(screen, /imported\.length\s*===\s*1/);
  assert.match(screen, /readingLibrary\.openNow/);
  assert.match(screen, /onOpenBook/);
});

test('home and translations expose the dedicated reading library without replacing Library', async () => {
  const [home, i18n] = await Promise.all([
    read('src/screens/home.mjs'),
    read('src/core/i18n.mjs')
  ]);

  assert.match(home, /['"]reading-library['"]/);
  assert.match(home, /['"]library['"]/);
  assert.match(i18n, /readingLibrary:\s*'Leer con TifloAcosta'/);
  assert.match(i18n, /readingLibrary:\s*'Read with TifloAcosta'/);
  assert.match(i18n, /continueReading:\s*'Continuar leyendo'/);
  assert.match(i18n, /continueReading:\s*'Continue reading'/);
});

test('composition root consumes initial and live shared documents through the reading library client', async () => {
  const app = await read('src/app.mjs');

  assert.match(app, /createReadingLibraryClient/);
  assert.match(app, /TifloReading/);
  assert.match(app, /pendingReadingImportBatch/);
  assert.match(app, /function installReadingDocumentReceiver\(\)/);
  assert.match(app, /consumeInitialSharedDocuments\(\)/);
  assert.match(app, /addListener\(['"]documentsReceived['"]/);
  assert.match(app, /case ['"]reading-library['"]/);
  assert.match(app, /case ['"]library['"]/);

  const startHome = app.indexOf("router.start('home')");
  const installReceiver = app.indexOf('installReadingDocumentReceiver()');
  assert.ok(startHome >= 0 && installReceiver > startHome, 'reading document receiver must install after Home starts');

  assert.match(app, /router\.current\(\)\?\.name\s*===\s*['"]reading-library['"][\s\S]{0,180}render\(router\.current\(\)\)/);
  assert.match(app, /router\.navigate\(['"]reading-library['"]/);
});
