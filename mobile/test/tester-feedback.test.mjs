import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { resourceMatchesPlatform } from '../src/screens/library.mjs';

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

test('library follows the agreed category-only structure and does not expose the complete catalog by default', () => {
  assert.match(librarySource, /library-category-filter/);
  assert.match(librarySource, /resourceCategories\(allItems, lang\)/);
  assert.match(librarySource, /selectResources\(allItems, \{ lang, category \}\)/);
  assert.match(librarySource, /list\.hidden = true/);
  assert.doesNotMatch(librarySource, /library-search-input/);
  assert.doesNotMatch(librarySource, /library-platform-filter/);
  assert.doesNotMatch(librarySource, /newestResources\(allItems/);
  assert.doesNotMatch(librarySource, /favorites\.addEventListener/);
});

test('library platform matching works even when the source category is topical instead of an operating system', () => {
  assert.equal(resourceMatchesPlatform({ category: 'Correos', title: 'Curso práctico de Outlook con lector de pantalla en Windows' }, 'Windows'), true);
  assert.equal(resourceMatchesPlatform({ category: 'APPs', title: 'Lo que no puede faltar en tu iPhone' }, 'iPhone'), true);
  assert.equal(resourceMatchesPlatform({ category: 'Cursos', title: 'Curso completo con TalkBack' }, 'Android'), true);
  assert.equal(resourceMatchesPlatform({ category: 'Cursos', title: 'Curso Jieshuo' }, 'Android'), true);
  assert.equal(resourceMatchesPlatform({ category: 'Accesibilidad', title: 'Guía de JAWS y NVDA para Windows' }, 'Windows'), true);
  assert.equal(resourceMatchesPlatform({ category: 'General', title: 'Documento multiplataforma' }, 'Windows'), false);
});

test('iPhone matching does not treat VoiceOver alone as an iPhone signal', () => {
  const macCourse = { category: 'Mac', title: 'Curso de VoiceOver con Mac desde 0' };
  assert.equal(resourceMatchesPlatform(macCourse, 'iPhone'), false);

  const shortcuts = { category: 'Atajos', title: 'Tomando atajos con Canal TifloAcosta' };
  assert.equal(resourceMatchesPlatform(shortcuts, 'iPhone'), true);

  const multiPlatform = {
    category: 'Nubes',
    title: 'Google Drive para Windows, Mac, iPhone y Android con JAWS, NVDA, VoiceOver y TalkBack'
  };
  assert.equal(resourceMatchesPlatform(multiPlatform, 'Android'), true);
  assert.equal(resourceMatchesPlatform(multiPlatform, 'iPhone'), true);
  assert.equal(resourceMatchesPlatform(multiPlatform, 'Windows'), true);
});

test('long catalogue screens expose a bottom Back control so screen-reader users do not traverse the whole page backwards', () => {
  for (const source of [searchSource, librarySource, actualidadSource]) {
    assert.match(source, /end-back-button/);
    assert.match(source, /router\.back\(\)/);
  }
});

test('Actualidad follows the selected language without leaving the temporary beta diagnostic in the interface', () => {
  assert.match(actualidadSource, /item\.lang\s*===\s*preferences\.lang/);
  assert.doesNotMatch(actualidadSource, /settings\.language|settings\.spanish|settings\.english|activeLanguage|contentLanguage|Idioma:/i);
});

test('Downloads explains what link analysis does before presenting the actions', () => {
  assert.match(downloadsSource, /downloadsLink\.intro/);
});
