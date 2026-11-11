import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const reader = readFileSync(new URL('../Sources/NativeTifloLector.swift', import.meta.url), 'utf8');

test('Selección múltiple mantiene fuera los controles de biblioteca general', () => {
  assert.match(reader, /if !selectionMode \{\s*Section\("Filtrar y ordenar"\)/);
  assert.match(reader, /if !selectionMode \{\s*Section \{\s*Button\("Importar"/);
  assert.match(reader, /Button\("Terminar selección"/); // replaced based on conditional below?
});
test('Borrado de seleccionados requiere confirmación con títulos', () => {
  assert.match(reader, /Button\("Eliminar seleccionados"\) \{ showBulkDelete = true \}/);
  assert.match(reader, /confirmationDialog\("Eliminar documentos seleccionados"/);
  assert.match(reader, /titles\.joined\(separator: ", "\)/);
  assert.match(reader, /role: \.destructive/);
  assert.match(reader, /documentToDelete\?\.title/);
});
