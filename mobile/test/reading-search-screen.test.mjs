import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('reading search builds the shared incremental index and does not announce every keystroke', async () => {
  const screen = await read('src/screens/reading-search.mjs');

  assert.match(screen, /createReadingSearchIndex/);
  assert.match(screen, /\.build\(/);
  assert.match(screen, /submit/);
  assert.doesNotMatch(screen, /input\.addEventListener\(['"]input['"][\s\S]{0,500}status\.textContent/);
});

test('search preview is temporary and only explicit continue changes the primary reading position', async () => {
  const screen = await read('src/screens/reading-search.mjs');

  assert.match(screen, /onPreview/);
  assert.match(screen, /onContinue/);
  assert.match(screen, /readingBook\.continueFromResult/);
  assert.match(screen, /previewButton\.addEventListener/);
  assert.match(screen, /continueButton\.addEventListener/);
  assert.doesNotMatch(screen, /client\.saveProgress/);
});

test('search offers an explicit return to reading that can restore the previewed position', async () => {
  const [screen, i18n] = await Promise.all([
    read('src/screens/reading-search.mjs'),
    read('src/core/i18n.mjs')
  ]);

  assert.match(screen, /readingBook\.returnToReading/);
  assert.match(screen, /onClose/);
  assert.match(screen, /returnFocus/);
  for (const label of ['Volver a la lectura', 'Return to reading']) {
    assert.ok(i18n.includes(label), `Missing return-to-reading translation: ${label}`);
  }
});

test('search result actions have contextual accessible names instead of repeated generic labels', async () => {
  const screen = await read('src/screens/reading-search.mjs');

  assert.match(screen, /previewButton\.setAttribute\(['"]aria-label['"]/);
  assert.match(screen, /continueButton\.setAttribute\(['"]aria-label['"]/);
  assert.match(screen, /readingBook\.previewResultLabel/);
  assert.match(screen, /readingBook\.continueFromResultLabel/);
});

test('search results expose heading context and semantic block sentence positions', async () => {
  const screen = await read('src/screens/reading-search.mjs');

  assert.match(screen, /result\.heading/);
  assert.match(screen, /result\.excerpt/);
  assert.match(screen, /blockIndex/);
  assert.match(screen, /unitIndex/);
});
