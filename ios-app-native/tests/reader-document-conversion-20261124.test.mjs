import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const screen = read('Sources/NativeDocumentConversionScreen.swift');
const reader = read('Sources/NativeTifloLector.swift');

test('conversion operates on a snapshot and saves a separate document through the importer', () => {
  assert.match(reader, /openDocumentConversion\(document\)/);
  assert.match(reader, /Button\("Convertir documentos seleccionados"\)/);
  assert.match(reader, /Button\("Convertir documento"\) \{ showDocumentConversion = true \}/);
  assert.match(screen, /Task\.detached\(priority: .userInitiated\)/);
  assert.match(screen, /withTaskCancellationHandler[\s\S]*?worker\.cancel\(\)/);
  assert.match(screen, /try await library\.importFile\(from: url\)/);
  assert.match(screen, /NativeShare\.present\(urls: outputs\)/);
  assert.doesNotMatch(screen, /delete\(document|markOpened|URLSession/);
});

test('the ten outputs are reopened through the native validation workflow', () => {
  const workflow = read('../.github/workflows/ios-next-beta-validation.yml');
  const smoke = read('tests/document-conversion-smoke.swift');
  assert.match(workflow, /bash ios-app-native\/scripts\/test-document-conversion.sh/);
  assert.match(smoke, /NSAttributedString\(url: results\[\.rtf\]/);
  assert.match(smoke, /"StructTreeRoot"/);
  assert.match(smoke, /checksum == entry\.checksum/);
  assert.match(smoke, /assets\/image-1\.png/);
});

test('conversion actions and status descriptions are available in six languages', () => {
  const keys = ['Convertir documento', 'Formato de destino', 'DAISY de texto',
    'Se conservará el texto. Si el original contiene imágenes, tablas, listas, notas o estilos, pueden perderse.', 'Cancelar conversión',
    'Convirtiendo documento %d de %d.', 'Documentos convertidos: %d. Fallidos: %d.',
    'Compartir o exportar a Archivos y nubes'];
  for (const lang of ['es', 'en', 'pt', 'fr', 'it', 'de']) {
    const catalog = lang === 'es' ? reader + screen + read('Sources/NativeDocumentConversion.swift') : read('Sources/' + lang + '.lproj/Localizable.strings');
    for (const key of keys) assert.ok(catalog.includes('"' + key + '"' + (lang === 'es' ? '' : ' = ')), lang + ': ' + key);
  }
});
