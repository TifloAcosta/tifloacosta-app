import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../Sources/NativeTifloLector.swift', import.meta.url), 'utf8');

test('Files multi-selection imports each document without stopping on the first error', () => {
  assert.match(source, /allowsMultipleSelection: true/);
  assert.match(source, /func importSelectedFiles\(from urls: \[URL\]/);
  assert.match(source, /for \(index, url\) in urls\.enumerated\(\)/);
  assert.match(source, /try importDocuments\(from: \[url\]\)/);
  assert.match(source, /failures\.append\(url\.lastPathComponent/);
  assert.match(source, /importSelectedFiles\(from: urls\)/);
});
test('VoiceOver sees actual file counts and concise batch result', () => {
  assert.match(source, /MusicLocalized\.format\("Importando %d de %d: %@"/);
  assert.match(source, /@State private var importFilesStatus/);
  assert.match(source, /Text\(importFilesStatus\)/);
  assert.match(source, /lastAnnouncement = Date\(\)/);
  assert.match(source, /timeIntervalSince\(lastAnnouncement\) >= 5/);
  assert.match(source, /Importación terminada\. Documentos importados: %d\. Omitidos: %d\. Fallidos: %d\./);
  assert.match(source, /summary\.failed\.prefix\(6\)/);
});
for (const lang of ['en', 'pt', 'fr', 'it', 'de']) {
  test('Multi-file import messages are localized for ' + lang, () => {
    const strings = readFileSync(new URL('../Sources/' + lang + '.lproj/Localizable.strings', import.meta.url), 'utf8');
    for (const key of ['Preparando importación de archivos.',
                       'No se pudieron importar los archivos: %@',
                       'Importación de archivos interrumpida.']) {
      assert.ok(strings.includes('"' + key + '" = '), 'Missing ' + key + ' in ' + lang);
    }
  });
}
