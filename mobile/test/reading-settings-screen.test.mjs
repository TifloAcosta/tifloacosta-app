import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('reading settings load inherited values voices and apply effective speech settings', async () => {
  const screen = await read('src/screens/reading-settings.mjs');

  assert.match(screen, /client\.getReadingSettings\(/);
  assert.match(screen, /client\.listTtsVoices\(/);
  assert.match(screen, /resolveReadingSettings/);
  assert.match(screen, /speech\.setVoice\(/);
  assert.match(screen, /speech\.setRate\(/);
});

test('per-book voice rate and visual changes are persisted immediately as overrides', async () => {
  const screen = await read('src/screens/reading-settings.mjs');

  assert.match(screen, /client\.setReadingSetting\(/);
  assert.match(screen, /scope:\s*['"]book['"]/);
  for (const key of [
    'speech.voice', 'speech.rate', 'visual.textSize', 'visual.fontFamily', 'visual.fontWeight',
    'visual.lineSpacing', 'visual.paragraphSpacing', 'visual.readingWidth', 'visual.highContrast', 'visual.theme'
  ]) {
    assert.ok(screen.includes(key), `Missing setting ${key}`);
  }
});

test('reset removes only this book overrides and reapplies inherited values', async () => {
  const screen = await read('src/screens/reading-settings.mjs');

  assert.match(screen, /client\.resetBookReadingSettings\(bookId\)/);
  assert.match(screen, /readingBook\.resetBookSettings/);
  assert.match(screen, /await\s+loadSettings\(\)/);
});

test('visual settings are scoped to reader container through CSS custom properties', async () => {
  const [screen, styles] = await Promise.all([
    read('src/screens/reading-settings.mjs'),
    read('src/styles.css')
  ]);

  assert.match(screen, /readerContainer\.style\.setProperty/);
  assert.match(styles, /--reading-text-scale/);
  assert.match(styles, /--reading-line-spacing/);
  assert.match(styles, /--reading-paragraph-spacing/);
  assert.match(styles, /--reading-width/);
  assert.doesNotMatch(styles, /\.reading-reader[^}]*height:\s*\d+px/s);
});
