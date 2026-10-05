import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('reading library screen keeps import, search, paging and delete actions explicit', async () => {
  const screen = await read('src/screens/reading-library.mjs');

  assert.match(screen, /export function renderReadingLibrary/);
  assert.match(screen, /client\.getLatestInProgress\(\)/);
  assert.match(screen, /client\.pickDocuments\(\)/);
  assert.match(screen, /const PAGE_SIZE\s*=\s*10/);
  assert.match(screen, /client\.listBooks\(\{[\s\S]*pageSize:\s*PAGE_SIZE[\s\S]*query/);
  assert.match(screen, /addEventListener\(['"]submit['"]/);
  assert.doesNotMatch(screen, /addEventListener\(['"]input['"][\s\S]{0,120}listBooks/);
  assert.match(screen, /aria-live['"],\s*['"]polite['"]/);
  assert.match(screen, /readingLibrary\.confirmDelete/);
  assert.match(screen, /client\.deleteBook\(/);
  assert.match(screen, /readingLibrary\.previousPage/);
  assert.match(screen, /readingLibrary\.nextPage/);
  assert.match(screen, /readingLibrary\.pageStatus/);
});

test('reading library follows the approved accessible order and complete filter contract', async () => {
  const screen = await read('src/screens/reading-library.mjs');

  const search = screen.indexOf("t('readingLibrary.searchLabel')");
  const continueReading = screen.indexOf("t('readingLibrary.continueReading')");
  const queue = screen.indexOf("t('readingLibrary.queue')");
  const importAction = screen.indexOf("t('readingLibrary.import')");
  const filters = screen.indexOf("t('readingLibrary.filtersHeading')");
  const settings = screen.indexOf("t('readingLibrary.settings')");
  const library = screen.indexOf("t('readingLibrary.myLibrary')");

  assert.ok(search >= 0, 'search must be present');
  assert.ok(search < continueReading, 'search comes before Continue');
  assert.ok(continueReading < queue, 'Continue comes before Queue');
  assert.ok(queue < importAction, 'Queue comes before Import');
  assert.ok(importAction < filters, 'Import comes before Filters');
  assert.ok(filters < settings, 'Filters come before Settings');
  assert.ok(settings < library, 'Settings come before My library');

  assert.match(screen, /statusFilter/);
  assert.match(screen, /formatFilter/);
  assert.match(screen, /sortSelect/);
  assert.match(screen, /client\.listBooks\(\{[\s\S]*status[\s\S]*format[\s\S]*sort/);
  assert.match(screen, /readingLibrary\.filterAll/);
  assert.match(screen, /readingLibrary\.filterInReading/);
  assert.match(screen, /readingLibrary\.filterNotRead/);
  assert.match(screen, /readingLibrary\.filterRead/);
  assert.match(screen, /readingLibrary\.sortTitle/);
  assert.match(screen, /readingLibrary\.sortAuthor/);
  assert.match(screen, /readingLibrary\.sortImported/);
  assert.match(screen, /readingLibrary\.sortLastRead/);
});

test('format filter exposes every library format supported by the Android v1 reader', async () => {
  const screen = await read('src/screens/reading-library.mjs');

  assert.match(
    screen,
    /const FORMATS\s*=\s*\[[^\]]*['"]txt['"][^\]]*['"]html['"][^\]]*['"]pdf['"][^\]]*['"]epub['"][^\]]*['"]docx['"][^\]]*['"]daisy2\.02['"][^\]]*['"]daisy3['"][^\]]*['"]audio['"][^\]]*\]/s
  );
  assert.match(screen, /DAISY 2\.02/);
  assert.match(screen, /DAISY 3/);
  assert.doesNotMatch(screen, /FORMATS[^\n]*['"]zip['"]/);
});

test('reading library item options expose queue state metadata rename and delete actions', async () => {
  const screen = await read('src/screens/reading-library.mjs');

  assert.match(screen, /client\.addToQueue\(/);
  assert.match(screen, /client\.removeFromQueue\(/);
  assert.match(screen, /client\.updateBookMetadata\(/);
  assert.match(screen, /readingLibrary\.addToQueue/);
  assert.match(screen, /readingLibrary\.removeFromQueue/);
  assert.match(screen, /readingLibrary\.changeState/);
  assert.match(screen, /readingLibrary\.information/);
  assert.match(screen, /readingLibrary\.rename/);
  assert.match(screen, /readingLibrary\.delete/);
  assert.match(screen, /item\.author/);
  assert.match(screen, /item\.format/);
});

test('reading library exposes one open-now action only for one newly imported book', async () => {
  const screen = await read('src/screens/reading-library.mjs');
  assert.match(screen, /initialImportBatch/);
  assert.match(screen, /imported\.length\s*===\s*1/);
  assert.match(screen, /readingLibrary\.openNow/);
  assert.match(screen, /onOpenBook/);
});

test('global reading defaults expose speech audio and visual settings with immediate persistence and reset', async () => {
  const screen = await read('src/screens/reading-library.mjs');

  for (const key of [
    'speech.voice', 'speech.rate', 'audio.speed', 'audio.skipSeconds',
    'visual.textSize', 'visual.fontFamily', 'visual.fontWeight', 'visual.lineSpacing',
    'visual.paragraphSpacing', 'visual.readingWidth', 'visual.foreground', 'visual.background',
    'visual.highContrast', 'visual.theme'
  ]) {
    assert.ok(screen.includes(key), `Missing global reading setting ${key}`);
  }

  assert.match(screen, /scope:\s*['"]global['"]/);
  assert.match(screen, /addEventListener\(['"]change['"][\s\S]*setReadingSetting/);
  assert.match(screen, /READING_SETTING_DEFAULTS/);
  assert.match(screen, /resetGlobalReadingSettings|resetReadingDefaults/);
  assert.doesNotMatch(screen, /Save settings|Guardar ajustes/);
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
  assert.match(app, /case ['"]reading-queue['"]/);
  assert.match(app, /case ['"]library['"]/);

  const startHome = app.lastIndexOf("router.start('home');");
  const installReceiver = app.indexOf('void installReadingDocumentReceiver();', startHome);
  assert.ok(startHome >= 0 && installReceiver > startHome, 'reading document receiver must install after Home starts');

  assert.match(app, /router\.current\(\)\?\.name\s*===\s*['"]reading-library['"][\s\S]{0,180}render\(router\.current\(\)\)/);
  assert.match(app, /router\.navigate\(['"]reading-library['"]/);
  assert.match(app, /renderReadingQueue/);
});


test('import control explicitly lists every supported document family', async () => {
  const screen = await read('src/screens/reading-library.mjs');
  for (const label of ['Word (DOCX)', 'EPUB', 'PDF', 'TXT', 'HTML', 'DAISY', 'audio']) {
    assert.ok(screen.includes(label), `Missing import format hint: ${label}`);
  }
});


test('Android reading library keeps title list clean and reveals controls only after opening a title', async () => {
  const screen = await read('src/screens/reading-library.mjs');
  assert.ok(screen.includes('reading-library-item-details'));
  assert.ok(screen.includes("title.setAttribute('aria-expanded', 'false')"));
  assert.ok(screen.includes('details.hidden = true'));
  assert.ok(screen.includes('Abrir para leer'));
  assert.ok(screen.includes('Volver a los títulos de la biblioteca'));
});


test('Android reading library uses final title detail layout with progress times grouped settings and 10 percent jumps', async () => {
  const screen = await read('src/screens/reading-library.mjs');
  for (const token of [
    'reading-library-progress-',
    'Tiempo realizado y tiempo faltante',
    'Abrir en posición',
    'Audio y voz',
    'Presentación visual',
    'Más acciones',
    'for (let value = 0; value <= 100; value += 10)',
    "scope:'book'",
    'onOpenBook?.(item.id, Number(jumpSelect.value) || 0)'
  ]) assert.ok(screen.includes(token), `Missing Android library layout token: ${token}`);
});

test('Android composition carries a requested library percentage into the opened book', async () => {
  const [app, book] = await Promise.all([
    read('src/app.mjs'),
    read('src/screens/reading-book.mjs')
  ]);
  assert.ok(app.includes('pendingReadingBookPercent'));
  assert.ok(app.includes('initialPercent: pendingReadingBookPercent'));
  assert.ok(book.includes('initialPercent = null'));
  assert.ok(book.includes('positionForPercent(documentModel, requestedPercent)'));
});
