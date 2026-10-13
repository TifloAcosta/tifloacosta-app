import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('reader offers screen-reader-labeled notes on passages, highlights Important marks and guards edits', async () => {
  const [html, reader, store] = await Promise.all([
    readFile(new URL('../index.html',import.meta.url),'utf8'),
    readFile(new URL('../web-reading.js',import.meta.url),'utf8'),
    readFile(new URL('../shared/web-reading-library-adapter.mjs',import.meta.url),'utf8')
  ]);
  assert.match(html, /<label for="reading-marks-note">Nota opcional/);
  assert.match(html, /id="reading-marks-note" rows="3" maxlength="4000"/);
  assert.match(reader, /marksNote: \$\('#reading-marks-note'\)/);
  assert.match(reader, /async function addBookmark\(type = 'bookmark'\)/);
  assert.match(reader, /note \&\& libraryAdapter\?\.addMark/);
  assert.match(reader, /libraryAdapter\?\.updateMark/);
  assert.match(reader, /element\.replaceChildren\(highlight\)/);
  assert.match(reader, /document\.createElement\('mark'\)/);
  assert.match(reader, /mark\.blockIndex === blockIndex/);
  assert.match(store, /async function updateMark\(/);
  assert.match(store, /saved\.bookId !== clean\(bookId\)/);
  assert.match(store, /note: clean\(value\.note\)\.slice\(0, 4000\)/);
});
