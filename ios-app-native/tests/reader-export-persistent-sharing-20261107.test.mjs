import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../Sources/NativeTifloLector.swift', import.meta.url), 'utf8');
test('audio and DAISY exports persist in app Documents rather than being lost with temporary files', () => {
  assert.match(source, /private enum NativeReaderSavedExports/);
  assert.match(source, /\.documentDirectory/);
  assert.match(source, /Exportaciones de TifloLector/);
  assert.match(source, /FileManager\.default\.moveItem\(at: source, to: target\)/);
  assert.match(source, /let saved = try NativeReaderSavedExports\.save\(url\)/);
  assert.match(source, /audioExportResult = saved/);
});
test('the export page has a real iOS ShareLink and history accessible after closing it', () => {
  assert.match(source, /ShareLink\(item: result\)/);
  assert.match(source, /Compartir archivo generado/);
  assert.match(source, /Section\("Archivos exportados"\)/);
  assert.match(source, /ForEach\(savedAudioExports, id: \\.self\)/);
  assert.match(source, /ShareLink\(item: file\)/);
  assert.match(source, /savedAudioExports = NativeReaderSavedExports\.list\(\)/);
});

test('legacy temporary DAISY files are recovered without reconversion', () => {
  assert.match(source, /private static func recoverLegacyExports/);
  assert.match(source, /file\.lastPathComponent\.hasPrefix/);
  assert.match(source, /recoverLegacyExports\(\)/);
});
