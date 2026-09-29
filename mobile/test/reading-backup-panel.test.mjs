import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('reading backup panel is an accessible modal with explicit export and restore actions', async () => {
  const panel = await read('src/screens/reading-backup-panel.mjs');

  assert.match(panel, /createReadingBackupClient/);
  assert.match(panel, /TifloReadingBackup/);
  assert.match(panel, /setAttribute\(['"]role['"],\s*['"]dialog['"]\)/);
  assert.match(panel, /setAttribute\(['"]aria-modal['"],\s*['"]true['"]\)/);
  assert.match(panel, /exportReadingBackup\(/);
  assert.match(panel, /pickReadingRestore\(/);
  assert.match(panel, /applyReadingRestore\(/);
  assert.match(panel, /cancelReadingRestore\(/);
  assert.match(panel, /positionConflicts/);
  assert.match(panel, /keep-current/);
  assert.match(panel, /use-backup/);
  assert.match(panel, /event\.key\s*===\s*['"]Tab['"]/);
  assert.match(panel, /returnFocus/);

  for (const label of [
    'Copia y restauración',
    'Exportar toda la biblioteca',
    'Restaurar desde una copia',
    'Mantener posición actual',
    'Usar posición de la copia',
    'Aplicar restauración',
    'Volver a la lectura'
  ]) {
    assert.ok(panel.includes(label), `Missing accessible backup label: ${label}`);
  }
});

test('reading backup panel exposes safe library maintenance with explicit destructive confirmation', async () => {
  const panel = await read('src/screens/reading-backup-panel.mjs');

  assert.match(panel, /checkReadingLibrary\(/);
  assert.match(panel, /deleteAllReadingData\(/);
  assert.match(panel, /confirmDeleteAll/);
  assert.match(panel, /checked/);
  for (const label of [
    'Comprobar biblioteca',
    'Eliminar todos los datos de lectura',
    'Entiendo que se eliminarán todos los documentos, marcas, posiciones y ajustes de lectura'
  ]) {
    assert.ok(panel.includes(label), `Missing maintenance label: ${label}`);
  }
});

test('reading settings exposes the backup panel without merging or publishing anything', async () => {
  const settings = await read('src/screens/reading-settings.mjs');
  assert.match(settings, /createReadingBackupPanel/);
  assert.match(settings, /backupPanel\.open\(/);
});
