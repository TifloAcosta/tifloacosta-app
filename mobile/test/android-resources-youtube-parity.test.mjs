import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const librarySource = await readFile(new URL('../src/screens/library.mjs', import.meta.url), 'utf8');
const videosSource = await readFile(new URL('../src/screens/videos.mjs', import.meta.url), 'utf8');

test('Android Resources exposes only the real category selector', () => {
  assert.match(librarySource, /library-category-filter/);
  assert.doesNotMatch(librarySource, /library-search-input/);
  assert.doesNotMatch(librarySource, /library-platform-filter/);
  assert.doesNotMatch(librarySource, /labels\.favorites/);
});

test('Android Videos includes accessible public YouTube search with ten-result continuation', () => {
  assert.match(videosSource, /YouTube accesible/);
  assert.match(videosSource, /youtube-auth\.tifloacosta\.com/);
  assert.match(videosSource, /Mostrar 10 resultados más/);
  assert.match(videosSource, /pageToken/);
  assert.match(videosSource, /durationSeconds/);
  assert.match(videosSource, /createAccessibleVideoPlayer/);
});
