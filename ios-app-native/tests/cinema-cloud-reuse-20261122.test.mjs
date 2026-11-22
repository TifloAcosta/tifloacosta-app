import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = name => readFileSync(new URL('../Sources/' + name, import.meta.url), 'utf8');
const cinema = read('NativeAccessibleCinema.swift');
const browser = read('NativeCloudFolderBrowserScreen.swift');
const picker = read('NativeCloudGooglePickerScreen.swift');

test('Multicines reuses the same secure cloud accounts as Mi música', () => {
  assert.match(cinema, /NativeCloudGooglePickerScreen\(/);
  assert.match(cinema, /NativeCloudFolderBrowserScreen\(/);
  assert.match(cinema, /provider: \.dropbox/);
  assert.match(cinema, /onImportValidated: \{ url in try importCloudAudio\(url\) \}/g);
  assert.match(cinema, /personalLibrary\.importAudio\(from: url, language: language, kind: kind\)/);
});

test('cloud import does not report success if the destination rejected the file', () => {
  for (const src of [browser, picker]) {
    assert.match(src, /var onImportValidated: \(\(URL\) throws -> Void\)\? = nil/);
    assert.match(src, /if let onImportValidated \{\s*try onImportValidated\(file\)/);
    assert.match(src, /onImport\(file\)/);
  }
});

test('cloud interface remains translated and requires a user action', () => {
  for (const locale of ['en', 'pt', 'fr', 'it', 'de']) {
    const table = read(locale + '.lproj/Localizable.strings');
    assert.ok(table.includes('"Archivo incorporado: %@" = '), locale);
  }
  assert.match(cinema, /NavigationLink\("Google Drive"\)/);
  assert.match(cinema, /NavigationLink\("Dropbox"\)/);
});
