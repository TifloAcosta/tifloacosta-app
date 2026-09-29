import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('reading book selects semantic TXT or HTML adapters and never injects source HTML', async () => {
  const screen = await read('src/screens/reading-book.mjs');

  assert.match(screen, /parseTextDocument/);
  assert.match(screen, /parseHtmlDocument/);
  assert.match(screen, /activeBook\.format/);
  assert.doesNotMatch(screen, /\.innerHTML\s*=|\.outerHTML\s*=|insertAdjacentHTML\s*\(/);
  for (const semantic of ['heading', 'paragraph', 'list-item', 'quote', 'table-cell']) {
    assert.match(screen, new RegExp(`['"]${semantic}['"]`));
  }
});

test('reading book has explicit play pause navigation search marks state voice and visual controls without autoplay', async () => {
  const [screen, i18n] = await Promise.all([
    read('src/screens/reading-book.mjs'),
    read('src/core/i18n.mjs')
  ]);

  assert.match(screen, /createReadingSpeechController/);
  assert.match(screen, /readingBook\.play/);
  assert.match(screen, /readingBook\.pause/);
  assert.match(screen, /readingBook\.navigation/);
  assert.match(screen, /readingBook\.search/);
  assert.match(screen, /readingBook\.marks/);
  assert.match(screen, /readingBook\.readingState/);
  assert.match(screen, /readingBook\.voiceAndSpeed/);
  assert.match(screen, /readingBook\.visualSettings/);
  assert.match(screen, /playButton\.focus\(\)/);
  assert.doesNotMatch(screen, /speechSynthesis|autoplay/i);

  for (const label of [
    'Reproducir', 'Pausa', 'Navegación', 'Buscar', 'Marcas', 'Estado de lectura', 'Voz y velocidad', 'Ajustes visuales',
    'Play', 'Pause', 'Navigation', 'Search', 'Marks', 'Reading status', 'Voice and speed', 'Visual settings'
  ]) {
    assert.ok(i18n.includes(label), `Missing translation: ${label}`);
  }
});

test('visual navigation and speech share precise block and sentence position and persist anchor text', async () => {
  const screen = await read('src/screens/reading-book.mjs');

  assert.match(screen, /speech\.moveTo\(/);
  assert.match(screen, /unitIndex/);
  assert.match(screen, /anchorText/);
  assert.match(screen, /client\.saveProgress\(/);
  assert.match(screen, /getCurrentUnitText/);
  assert.match(screen, /previousUnit/);
  assert.match(screen, /nextUnit/);
});

test('previous and next expose the active semantic unit and navigation focuses the rendered reading unit', async () => {
  const [screen, i18n] = await Promise.all([
    read('src/screens/reading-book.mjs'),
    read('src/core/i18n.mjs')
  ]);

  assert.match(screen, /previous\.setAttribute\(['"]aria-label['"]/);
  assert.match(screen, /next\.setAttribute\(['"]aria-label['"]/);
  assert.match(screen, /readingBook\.previousSentence/);
  assert.match(screen, /readingBook\.nextSentence/);
  assert.match(screen, /focusCurrentSemanticUnit/);
  assert.doesNotMatch(screen, /navigationButton\.addEventListener\(['"]click['"],\s*\(\)\s*=>\s*readerContainer\.focus\(\)/);
  for (const label of ['Frase anterior', 'Frase siguiente', 'Previous sentence', 'Next sentence']) {
    assert.ok(i18n.includes(label), `Missing navigation translation: ${label}`);
  }
});

test('opening restores position announces progress focuses Play and never starts speech itself', async () => {
  const screen = await read('src/screens/reading-book.mjs');

  assert.match(screen, /initialPosition:\s*\{[\s\S]*blockIndex:[\s\S]*unitIndex:/);
  assert.match(screen, /readingBook\.resume/);
  assert.match(screen, /playButton\.focus\(\)/);
  assert.match(screen, /playButton\.addEventListener\(['"]click['"]/);
  assert.doesNotMatch(screen, /await\s+speech\.play\(\)[\s\S]*playButton\.focus\(\)/);
});

test('search preview is visual only until continue reading is chosen', async () => {
  const screen = await read('src/screens/reading-book.mjs');

  assert.match(screen, /renderSemanticPosition\(position,\s*\{\s*focus:\s*true,\s*commit:\s*false\s*\}\)/);
  assert.match(screen, /renderSemanticPosition\([^)]*,\s*\{[^}]*commit/);
  assert.match(screen, /if\s*\(commit\)\s*currentPosition\s*=\s*normalized/);
  assert.match(screen, /onContinue\(position\)[\s\S]*moveToPosition\(position\)/);
});

test('reading book uses screen cleanup to stop speech and listeners when leaving the document', async () => {
  const screen = await read('src/screens/reading-book.mjs');

  assert.match(screen, /setScreenCleanup/);
  assert.match(screen, /speech\.destroy\(\)/);
  assert.match(screen, /searchPanel.*destroy|destroy.*searchPanel/s);
  assert.match(screen, /settingsPanel.*destroy|destroy.*settingsPanel/s);
});

test('reading book uses the PDF semantic adapter and navigates by real PDF pages', async () => {
  const screen = await read('src/screens/reading-book.mjs');

  assert.match(screen, /parsePdfDocument/);
  assert.match(screen, /pageForPosition/);
  assert.match(screen, /positionForPage/);
  assert.match(screen, /activeBook\.format\s*===\s*['"]pdf['"]/);
  assert.match(screen, /parsePdfDocument\(opened\.pdf/);
  assert.match(screen, /pageForPosition\(documentModel,\s*currentPosition\)/);
  assert.match(screen, /positionForPage\(documentModel,/);
  assert.match(screen, /readingLibrary\.previousPage/);
  assert.match(screen, /readingLibrary\.nextPage/);
  assert.match(screen, /readingLibrary\.pageStatus/);
});

test('protected PDFs request a transient password and no-text PDFs have a distinct accessible state', async () => {
  const [screen, i18n] = await Promise.all([
    read('src/screens/reading-book.mjs'),
    read('src/core/i18n.mjs')
  ]);

  assert.match(screen, /opened\.passwordRequired/);
  assert.match(screen, /opened\.passwordRejected/);
  assert.match(screen, /opened\.pdfNoText/);
  assert.match(screen, /passwordInput\.type\s*=\s*['"]password['"]/);
  assert.match(screen, /client\.openBook\(bookId,\s*\{\s*password\s*\}\)/);
  assert.match(screen, /passwordInput\.value\s*=\s*['"]['"]/);
  assert.match(screen, /passwordInput\.focus\(\)/);
  assert.match(screen, /readingBook\.pdfPasswordRequired/);
  assert.match(screen, /readingBook\.pdfPasswordRejected/);
  assert.match(screen, /readingBook\.pdfNoText/);

  for (const label of [
    'Este PDF está protegido con contraseña.', 'Contraseña del PDF', 'Abrir PDF', 'La contraseña no es correcta.',
    'Este PDF no contiene texto que TifloAcosta pueda extraer para leer.',
    'This PDF is password protected.', 'PDF password', 'Open PDF', 'The password is incorrect.',
    'This PDF does not contain text that TifloAcosta can extract for reading.'
  ]) {
    assert.ok(i18n.includes(label), `Missing translation: ${label}`);
  }
});
