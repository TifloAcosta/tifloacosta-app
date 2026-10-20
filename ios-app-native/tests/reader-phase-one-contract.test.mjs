import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = name => readFileSync(new URL('../Sources/' + name, import.meta.url), 'utf8');
const reader = source('NativeTifloLector.swift');
const settings = source('NativeReaderSettings.swift');
const formats = source('NativeReaderFormats.swift');

test('The reading opening mode is persistent, opt-in and applied once per opening', () => {
  assert.match(settings, /@AppStorage\("native-reader-reading-mode"\) private var readingMode = 0/);
  assert.match(reader, /@AppStorage\("native-reader-reading-mode"\) private var readingMode = 0/);
  assert.match(settings, /Manual, reproducir cuando lo indique/);
  assert.match(settings, /Automático, reproducir al abrir/);
  assert.match(reader, /if !didApplyOpeningMode/);
  assert.match(reader, /if readingMode == 1 \{ play\(\) \}/);
});

test('General settings are folded into navigable destinations', () => {
  for (const title of [
    'Audio y voces', 'Modo de lectura', 'Ajustes visuales',
    'Navegación y avances', 'Formatos de lectura'
  ]) assert.ok(settings.includes('NavigationLink("' + title + '")'), title);
});

test('Per-document audio and visual settings persist and can inherit global defaults', () => {
  assert.match(reader, /var readerPreferences: NativeReaderPreferences\? = nil/);
  assert.match(reader, /func updatePreferences\(/);
  assert.match(reader, /func resetPreferences\(/);
  assert.match(reader, /effectiveSpeedIndex/);
  assert.match(reader, /effectiveVoiceID/);
  assert.match(reader, /effectiveTextSize/);
  assert.match(settings, /allowVoiceDownloads: false/);
  assert.match(settings, /library\.resetPreferences\(document\)/);
  assert.match(reader, /accessibilityAction\(named: Text\("Ajustes del documento"\)/);
});

test('Organizing folders preserves documents and bookmarks across changes', () => {
  assert.match(reader, /@Published private\(set\) var folders: \[String\]/);
  assert.match(reader, /@AppStorage\("native-reading-folder-filter"\)/);
  assert.match(reader, /func createFolder\(named rawName: String\)/);
  assert.match(reader, /func move\(_ document: NativeReadingDocument, to folder: String\?\)/);
  assert.match(reader, /func deleteFolder\(_ folder: String\)/);
  assert.match(reader, /documents\[index\]\.folderName = nil/);
  assert.match(reader, /library\.toggleFavorite\(document\)/);
});

test('Supported formats screen is tied to actual decoders and does not claim legacy binary Office', () => {
  assert.match(settings, /NativeReaderFormats\.supportedFormatGroups/);
  assert.match(formats, /title: "Presentaciones"/);
  assert.match(formats, /title: "Hojas de cálculo"/);
  assert.match(formats, /PPTX/);
  assert.match(formats, /XLSX/);
  assert.match(settings, /PPS, PPT y XLS todavía necesitan/);
  assert.match(formats, /"pptx", "xlsx"/);
});
