import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const reader = readFileSync(new URL('../Sources/NativeTifloLector.swift', import.meta.url), 'utf8');

test('exportar el paquete DAISY existente prepara una copia íntegra', () => {
  assert.match(reader, /Button\("Preparar copia del DAISY original"\)/);
  assert.match(reader, /latest\.fileExtension == "daisy"/);
  assert.match(reader, /NativeReaderFormats\.storedURL\(for: originalPath\)/);
});

test('tras preparar el archivo se puede compartir o regresar a la biblioteca', () => {
  assert.match(reader, /confirmationDialog\("Paquete DAISY preparado"/);
  assert.match(reader, /Button\("Compartir paquete DAISY"\)/);
  assert.match(reader, /Button\("No compartir y volver a la biblioteca"\)/);
  assert.match(reader, /dismiss\(\)/);
});
