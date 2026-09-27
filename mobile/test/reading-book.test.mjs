import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('reading book screen opens private TXT content and renders one semantic paragraph', async () => {
  const screen = await read('src/screens/reading-book.mjs');

  assert.match(screen, /export function renderReadingBook/);
  assert.match(screen, /client\.openBook\(bookId\)/);
  assert.match(screen, /parsePlainText/);
  assert.match(screen, /createReadingSession/);
  assert.match(screen, /document\.createElement\(['"]h1['"]\)/);
  assert.match(screen, /document\.createElement\(['"]p['"]\)/);
  assert.match(screen, /current\(\)/);
});

test('reading book screen saves in-reading progress on open and paragraph navigation', async () => {
  const screen = await read('src/screens/reading-book.mjs');

  assert.match(screen, /client\.saveProgress\(/);
  assert.match(screen, /state:\s*['"]in-reading['"]/);
  assert.match(screen, /readingBook\.previousParagraph/);
  assert.match(screen, /readingBook\.nextParagraph/);
  assert.match(screen, /session\.previous\(\)/);
  assert.match(screen, /session\.next\(\)/);
  assert.match(screen, /readingBook\.resume/);
  assert.doesNotMatch(screen, /speechSynthesis|\.speak\(|autoplay/i);
});

test('reading book screen handles empty private content and returns to the reading library', async () => {
  const screen = await read('src/screens/reading-book.mjs');

  assert.match(screen, /readingBook\.empty/);
  assert.match(screen, /router\.back\(\)/);
});

test('app and translations expose the dedicated reading-book route without changing the web reader', async () => {
  const [app, i18n] = await Promise.all([
    read('src/app.mjs'),
    read('src/core/i18n.mjs')
  ]);

  assert.match(app, /pendingReadingBookId/);
  assert.match(app, /case ['"]reading-book['"]/);
  assert.match(app, /renderReadingBook/);
  assert.match(app, /router\.navigate\(['"]reading-book['"]/);
  assert.match(app, /case ['"]reader['"]/);

  assert.match(i18n, /previousParagraph:\s*'Párrafo anterior'/);
  assert.match(i18n, /nextParagraph:\s*'Párrafo siguiente'/);
  assert.match(i18n, /previousParagraph:\s*'Previous paragraph'/);
  assert.match(i18n, /nextParagraph:\s*'Next paragraph'/);
});
