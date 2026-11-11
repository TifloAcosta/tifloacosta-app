import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const reader = readFileSync(new URL('../Sources/NativeTifloLector.swift', import.meta.url), 'utf8');

test('Carpetas ofrecen navegación independiente de los filtros globales', () => {
  assert.match(reader, /Button\("Ver por carpetas"\)/);
  assert.match(reader, /NavigationLink\("Sin carpeta"\)/);
  assert.match(reader, /folderDocumentsView\(folder\)/);
  assert.match(reader, /library\.documents\.filter \{ \$0\.folderName == folder \}/);
  const start = reader.indexOf('private var shownDocuments:');
  const end = reader.indexOf('private var visibleSelection:', start);
  assert.ok(start !== -1 && end > start);
  const libraryFilter = reader.slice(start, end);
  assert.doesNotMatch(libraryFilter, /selectedFolder/);
});

test('Abrir carpeta no reescribe el filtro ni oculta libros ajenos', () => {
  const start = reader.indexOf('private func folderDocumentsView(');
  const end = reader.indexOf('private func resumeRequestedBook()', start);
  assert.ok(start !== -1 && end > start);
  const view = reader.slice(start, end);
  assert.match(view, /NavigationLink/);
  assert.match(view, /NativeReadingScreen\(document: doc, speech: speech\)/);
  assert.doesNotMatch(view, /selectedFolder\s*=/);
});
