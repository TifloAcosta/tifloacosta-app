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
  assert.match(music, /try writeAutomaticBackup\(document, to: folder\)/);
  assert.match(music, /lastAutomaticBackup = Date\(\)/);
  assert.match(music, /No se pudo guardar la copia automática/);
});
