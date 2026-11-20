import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const music = readFileSync(new URL('../Sources/NativeMyMusic.swift', import.meta.url), 'utf8');

test('automatic music backup destination can be selected and persists as a bookmark', () => {
  assert.match(music, /@Published private\(set\) var automaticBackupDestinationName/);
  assert.match(music, /func chooseAutomaticBackupDestination\(_ url: URL\)/);
  assert.match(music, /bookmarkData\(/);
  assert.match(music, /URL\(resolvingBookmarkData:/);
  assert.match(music, /startAccessingSecurityScopedResource\(\)/);
  assert.match(music, /Button\("Elegir destino de copias automáticas"\)/);
  assert.match(music, /Button\("Restablecer destino interno"\)/);
  assert.match(music, /func resetAutomaticBackupDestination\(\)/);
  assert.match(music, /\.fileImporter\(isPresented: \$selectingBackupDestination, allowedContentTypes: \[\.folder\]\)/);
});

test('a failed custom destination must not silently mark the automatic backup as successful', () => {
  assert.match(music, /try writeAutomaticBackup\(document, to: folder, custom: custom\)/);
  assert.match(music, /lastAutomaticBackup = Date\(\)/);
  assert.match(music, /No se pudo guardar la copia automática/);
});

test('changing the backup destination writes a fresh index before accepting the new folder', () => {
  const choose = music.slice(music.indexOf('func chooseAutomaticBackupDestination('), music.indexOf('func resetAutomaticBackupDestination()'));
  assert.match(choose, /guard let document = exportIndex\(\)/);
  assert.match(choose, /try writeAutomaticBackup\(document, to: url, custom: true\)/);
  assert.ok(choose.indexOf('try writeAutomaticBackup') < choose.indexOf('UserDefaults.standard.set(bookmark'),
    'destination must not be committed before the first backup succeeds');
  assert.match(choose, /lastAutomaticBackup = Date\(\)/);
});

test('resetting to internal storage creates a backup there before confirming the change', () => {
  const reset = music.slice(music.indexOf('func resetAutomaticBackupDestination()'), music.indexOf('private func automaticBackupDirectory()'));
  assert.match(reset, /guard let document = exportIndex\(\)/);
  assert.match(reset, /try writeAutomaticBackup\(document, to: .*custom: false\)/);
  assert.ok(reset.indexOf('try writeAutomaticBackup') < reset.indexOf('removeObject(forKey: automaticBackupBookmarkKey)'));
});
