import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const reader = read('Sources/NativeTifloLector.swift');
const inbox = read('Sources/NativeShareInbox.swift');
const home = read('Sources/NativeScreens.swift');
const formats = read('Sources/NativeReaderFormats.swift');
const extensionSource = read('ShareExtension/ShareViewController.swift');

test('shared OCR progress is bounded and accessible during automatic and manual imports', () => {
  assert.match(reader, /bufferingPolicy: \.bufferingNewest\(1\)/);
  assert.match(reader, /await progressTask\.value[\s\S]*try await persistImportedDocument/);
  assert.match(reader, /withTaskCancellationHandler \{\s*try await worker\.value\s*\} onCancel: \{\s*worker\.cancel\(\)/);
  assert.match(inbox, /originalName: originalName\) \{ message in\s*self\.reportReaderProgress\(message\)/);
  assert.match(inbox, /timeIntervalSince\(lastReaderAnnouncement\) >= 3/);
  for (const source of [home, inbox]) {
    assert.match(source, /if let progress = inbox\.readerImportProgress \{\s*ProgressView \{\s*Text\(progress\)/);
  }
});

test('archive import checks free space before extraction, bounds output and moves staged tracks', () => {
  const unpack = formats.split('private static func readPackage(')[1];
  assert.match(unpack, /UInt64\(total\)\.addingReportingOverflow\(UInt64\(originalSize\)\)/);
  assert.ok(unpack.indexOf('try requireStorage(needed, at: directory)') <
            unpack.indexOf('try archive.extract(entry)'));
  assert.match(unpack, /UInt64\(chunk\.count\) <= entry\.uncompressedSize - written/);
  assert.match(unpack, /written == entry\.uncompressedSize, checksum == entry\.checksum/);
  assert.match(unpack, /documentID: documentID, move: true/);
  assert.match(unpack, /defer \{ try\? FileManager\.default\.removeItem\(at: directory\) \}/);
  assert.match(extensionSource, /attributesOfFileSystem\(forPath: inbox\.path\)[\s\S]*?copyItem\(at: file, to: destination\)/);
});

test('all six import locales cover new status and error text with intact format arguments', () => {
  const keys = [
    'Procesando página %d de %d: %@',
    'No hay espacio suficiente para importar el archivo.',
    'La importación admite hasta 750 archivos por lote.',
    'PDF con más de 150 páginas escaneadas. Divide el archivo para realizar OCR.',
    'No se pudo abrir «%@»: %@. El elemento permanece en Recibidos.',
    'Algunos elementos no se pudieron importar y permanecen en Recibidos.'
  ];
  for (const language of ['es', 'en', 'pt', 'fr', 'it', 'de']) {
    const isSpanish = language === 'es';
    const catalog = isSpanish ? reader + formats + inbox
      : read('Sources/' + language + '.lproj/Localizable.strings');
    for (const key of keys) {
      const entry = catalog.split('"' + key + '"')[1];
      assert.ok(entry, language + ': ' + key);
      if (!isSpanish) {
        const value = entry.match(/^ = "([^"]+)";/)?.[1];
        assert.ok(value, language + ': ' + key);
        assert.deepEqual(value.match(/%[d@]/g), key.match(/%[d@]/g), language + ': ' + key);
      }
    }
    assert.ok(read('ShareExtension/Localizations/' + language + '.lproj/Localizable.strings')
      .includes('"' + keys[1] + '" = '));
  }
});
