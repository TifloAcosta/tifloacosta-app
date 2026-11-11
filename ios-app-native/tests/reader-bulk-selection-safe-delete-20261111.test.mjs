import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const reader = readFileSync(new URL('../Sources/NativeTifloLector.swift', import.meta.url), 'utf8');

test('Selección múltiple mantiene fuera los controles de biblioteca general', () => {
  assert.match(reader, /if !selectionMode \{\s*Section\("Filtrar y ordenar"\)/);
  assert.match(reader, /if !selectionMode \{\s*Section \{\s*Button\("Importar"/);
  assert.match(reader, /selectionMode \? "Terminar selección" : "Selección"/);
});
test('Borrado de seleccionados requiere confirmación con títulos', () => {
  assert.match(reader, /Button\("Eliminar seleccionados"\) \{ showBulkDelete = true \}/);
  assert.match(reader, /confirmationDialog\("Eliminar documentos seleccionados"/);
  assert.match(reader, /titles\.joined\(separator: ", "\)/);
  assert.match(reader, /role: \.destructive/);
  assert.match(reader, /documentToDelete\?\.title/);
});

test('VoiceOver anuncia seleccionado o no seleccionado antes del título', () => {
  assert.match(reader, /accessibilityLabel\("\\?\(selectedDocumentIDs\.contains\(document\.id\) \? "Seleccionado" : "No seleccionado"\), \\?\(documentRowLabel\(document\)\)"/);
});

test('Mover varios libros permite crear carpeta y los mueve tras confirmar', () => {
  assert.match(reader, /Button\("Crear carpeta nueva"\)/);
  assert.match(reader, /alert\("Crear carpeta para los documentos seleccionados"/);
  assert.match(reader, /TextField\("Nombre de la carpeta nueva"/);
  assert.match(reader, /guard library\.createFolder\(named: name\) else/);
  assert.match(reader, /library\.moveDocuments\(withIDs: documentIDs, to: name\)/);
  assert.match(reader, /finishSelection\(/);
});
