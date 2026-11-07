import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const reader = readFileSync(new URL('../Sources/NativeTifloLector.swift', import.meta.url), 'utf8');

test('voiceover sort label says zeta rather than abbreviations', () => {
  assert.match(reader, /Título de zeta a a/);
  assert.match(reader, /Título de a a zeta/);
  assert.doesNotMatch(reader, /Título Z a A/);
});
test('the most recently opened book is recorded persistently and filterable', () => {
  assert.match(reader, /var lastOpenedAt: Date\? = nil/);
  assert.match(reader, /func markOpened\(_ document: NativeReadingDocument\)/);
  assert.match(reader, /documents\[i\]\.lastOpenedAt = \.now/);
  assert.match(reader, /case 11:/);
  assert.match(reader, /Último abierto/);
  assert.match(reader, /\.onAppear \{ library\.markOpened\(document\) \}/);
});
test('library has a single Carpeta entry, opening a screen with create first', () => {
  const start = reader.indexOf('private var libraryFoldersSection');
  const end = reader.indexOf('private var libraryBase', start);
  assert.ok(start > 0 && end > start);
  const section = reader.slice(start, end);
  assert.match(section, /NavigationLink/);
  assert.match(section, /Text\("Carpetas"\)/);
  assert.doesNotMatch(section, /ForEach\(library\.folders|Todas las carpetas|Sin carpeta/);
  const folderScreen = reader.slice(reader.indexOf('private struct NativeReaderFoldersScreen'),
    reader.indexOf('struct NativeReaderLibraryScreen'));
  assert.ok(folderScreen.indexOf('Button("Crear nueva carpeta")') <
    folderScreen.indexOf('ForEach(library.folders'));
});
test('each library book exposes persisted reading percentage to VoiceOver', () => {
  assert.match(reader, /library\.latest\(document\)\.lastPercent \?\? 0/);
  assert.match(reader, /por ciento leído/);
  assert.match(reader, /\.accessibilityLabel\("\\\(document\.title\),/);
});
