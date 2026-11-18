import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const reader = readFileSync(new URL('../Sources/NativeTifloLector.swift', import.meta.url), 'utf8');
const formats = readFileSync(new URL('../Sources/NativeReaderFormats.swift', import.meta.url), 'utf8');

test('la importación conserva el archivo original completo y su ruta persistente', () => {
  assert.match(reader, /var originalPath: String\? = nil/);
  assert.match(reader, /let originalPath = try NativeReaderFormats\.storeOriginal\(url, documentID: identifier\)/);
  assert.match(reader, /originalPath: originalPath/);
  assert.match(formats, /static func storeOriginal\(/);
});

test('la biblioteca y el documento ofrecen Compartir documento por acción accesible', () => {
  assert.match(reader, /\.accessibilityAction\(named: Text\("Compartir documento"\)\)/);
  assert.match(reader, /Button\("Compartir documento"\)/);
});

test('la acción comparte el archivo original, no solo la primera pista de un DAISY', () => {
  assert.match(reader, /NativeReaderFormats\.storedURL\(for: originalPath\)/);
  assert.doesNotMatch(reader, /Button\("Compartir archivo de audio"\)/);
});
