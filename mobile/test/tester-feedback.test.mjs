import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const searchSource = await readFile(new URL('../src/screens/search.mjs', import.meta.url), 'utf8');
const librarySource = await readFile(new URL('../src/screens/library.mjs', import.meta.url), 'utf8');
const actualidadSource = await readFile(new URL('../src/screens/actualidad.mjs', import.meta.url), 'utf8');
const downloadsSource = await readFile(new URL('../src/screens/downloads.mjs', import.meta.url), 'utf8');

test('search offers an explicit way to clear the previous query and returns focus to the field', () => {
  assert.match(searchSource, /clear-search/);
  assert.match(searchSource, /lastQuery\s*=\s*['"]['"]/);
  assert.match(searchSource, /input\.value\s*=\s*['"]['"]/);
  assert.match(searchSource, /input\.focus\(\)/);
  assert.match(searchSource, /results\.replaceChildren\(\)/);
});

test('library exposes Android, iPhone and Windows platform filters without hiding the complete library by default', () => {
  assert.match(librarySource, /Android/);
  assert.match(librarySource, /iPhone/);
  assert.match(librarySource, /Windows/);
  assert.match(librarySource, /ariaPressed/);
  assert.match(librarySource, /activePlatform/);
});

test('library platform detection also uses titles and common screen-reader names because source categories are often topical', () => {
  assert.match(librarySource, /item\?\.title/);
  assert.match(librarySource, /talkback/i);
  assert.match(librarySource, /jieshuo/i);
  assert.match(librarySource, /voiceover/i);
  assert.match(librarySource, /\bjaws\b/i);
  assert.match(librarySource, /nvda/i);
});

test('long catalogue screens expose a bottom Back control so screen-reader users do not traverse the whole page backwards', () => {
  for (const source of [searchSource, librarySource, actualidadSource]) {
    assert.match(source, /end-back-button/);
    assert.match(source, /router\.back\(\)/);
  }
});

test('Actualidad announces the selected content language for beta diagnostics', () => {
  assert.match(actualidadSource, /settings\.language/);
  assert.match(actualidadSource, /settings\.spanish/);
  assert.match(actualidadSource, /settings\.english/);
});

test('Downloads explains what link analysis does before presenting the actions', () => {
  assert.match(downloadsSource, /downloadsLink\.intro/);
});
