import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('reading marks screen exposes exactly the four approved mark types', async () => {
  const screen = await read('src/screens/reading-marks.mjs');

  for (const type of ['bookmark', 'important', 'review', 'quote']) {
    assert.match(screen, new RegExp(`['"]${type}['"]`));
  }
  assert.match(screen, /client\.addMark\(/);
  assert.match(screen, /client\.listMarks\(/);
  assert.match(screen, /client\.deleteMark\(/);
});

test('marks are created at the current semantic position and can jump without autoplay', async () => {
  const screen = await read('src/screens/reading-marks.mjs');

  assert.match(screen, /getPosition\(\)/);
  assert.match(screen, /blockIndex/);
  assert.match(screen, /unitIndex/);
  assert.match(screen, /onJump/);
  assert.doesNotMatch(screen, /\.play\(\)|startTts/);
});

test('marks screen supports filtering and deletion with accessible native controls', async () => {
  const screen = await read('src/screens/reading-marks.mjs');

  assert.match(screen, /document\.createElement\(['"]select['"]\)/);
  assert.match(screen, /document\.createElement\(['"]button['"]\)/);
  assert.match(screen, /readingBook\.markFilter/);
  assert.match(screen, /readingBook\.deleteMark/);
});

test('mark jump and delete actions are distinguishable by context and the panel can return to reading', async () => {
  const [screen, i18n] = await Promise.all([
    read('src/screens/reading-marks.mjs'),
    read('src/core/i18n.mjs')
  ]);

  assert.match(screen, /jump\.setAttribute\(['"]aria-label['"]/);
  assert.match(screen, /remove\.setAttribute\(['"]aria-label['"]/);
  assert.match(screen, /readingBook\.jumpToMarkLabel/);
  assert.match(screen, /readingBook\.deleteMarkLabel/);
  assert.match(screen, /readingBook\.returnToReading/);
  assert.match(screen, /returnFocus/);
  for (const label of ['Volver a la lectura', 'Return to reading']) {
    assert.ok(i18n.includes(label), `Missing return-to-reading translation: ${label}`);
  }
});
