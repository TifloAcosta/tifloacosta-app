import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { text } from '../src/core/i18n.mjs';

const read = name => readFile(new URL(`../${name}`, import.meta.url), 'utf8');

test('iOS labels Recursos independently of TifloLector personal library', () => {
  assert.equal(text('es', 'home.library'), 'Recursos');
  assert.equal(text('es', 'screen.library'), 'Recursos');
  assert.equal(text('en', 'home.library'), 'Resources');
  assert.equal(text('en', 'screen.library'), 'Resources');
  assert.equal(text('es', 'readingLibrary.myLibrary'), 'Mi biblioteca');
  assert.equal(text('en', 'readingLibrary.myLibrary'), 'My library');
});

test('TifloLector filters lay out each label and control on a separate row', async () => {
  const css = await read('src/styles.css');
  assert.match(css, /\\.reading-library-filters\\s*\\{\\s*display:\\s*grid;/);
  const view = await read('src/screens/reading-library.mjs');
  assert.match(view, /filterForm\\.append\\(statusLabel, statusSelect, formatFilterLabel, formatSelect, sortLabel, sortControl, applyFilters\\)/);
});

test('iOS single reader screen opens with Import, Settings, Filters before the library', async () => {
  const view = await read('src/screens/reading-library.mjs');
  assert.match(view, /root\\.append\\(importSection, settingsSection, filtersSection, searchForm,[\\s\\S]*?librarySection, continueSection, queueSection\\)/);
  assert.match(view, /renderReadingQueue/);
  assert.match(view, /client\\.pickDocuments\\(\\)/);
});
