import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const src = new URL('../Sources/', import.meta.url);
const reader = readFileSync(new URL('NativeTifloLector.swift', src), 'utf8');
const settings = readFileSync(new URL('NativeReaderSettings.swift', src), 'utf8');
test('the library exposes only one entry to folders, with create action first inside', () => {
  const library = reader.slice(reader.indexOf('private var libraryFoldersSection'), reader.indexOf('private var libraryBase'));
  assert.match(library, /NavigationLink/);
  assert.match(library, /Text\("Carpetas"\)/);
  assert.doesNotMatch(library, /Todas las carpetas|Sin carpeta|Crear nueva carpeta/);
  const folderScreen = reader.slice(reader.indexOf('private struct NativeReaderFoldersScreen'), reader.indexOf('struct NativeReaderLibraryScreen'));
  const create=folderScreen.indexOf('Button("Crear nueva carpeta")');
  const all=folderScreen.indexOf('Button("Todas las carpetas")');
  const folders=folderScreen.indexOf('ForEach(library.folders');
  assert.ok(create >= 0 && create < all && all < folders);
});
test('three agreed reading styles are exposed in general and per-document audio', () => {
  assert.match(settings, /title: "Estilo de lectura"/);
  assert.match(settings, /"Normal", "Mayor", "Expresiva"/);
  assert.match(settings, /readingStyleSelection: Binding/);
  assert.match(reader, /var readingStyle: Int\? = nil/);
  assert.match(reader, /readerPreferences\?\.readingStyle \?\? readingStyle/);
});
test('actual speech engine inserts punctuation pauses and maintains exact cursor', () => {
  assert.match(reader, /private func speechChunks\(/);
  assert.match(reader, /case ",": pause =/);
  assert.match(reader, /case "\\n": pause =/);
  assert.match(reader, /utterance\.postUtteranceDelay = chunk\.2/);
  assert.match(reader, /utteranceOffsets\[identifier\] = baseUTF16 \+ chunk\.1/);
  assert.match(reader, /readingStyle: effectiveReadingStyle/);
  assert.match(reader, /\.onChange\(of: effectiveReadingStyle\)/);
});
