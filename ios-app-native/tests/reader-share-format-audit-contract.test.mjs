import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const formats = read('Sources/NativeReaderFormats.swift');
const reader = read('Sources/NativeTifloLector.swift');
const share = read('ShareExtension/ShareViewController.swift');
const catalogs = read('Sources/NativeReaderExternalCatalogs.swift');

test('Compartir con TifloAcosta anuncia formatos leíbles por el lector', () => {
  for (const ext of ['m4b', 'daisy', 'ppsx', 'pptm', 'xlsm', 'odt', 'fb2', 'heic', 'tiff']) {
    assert.ok(share.includes('"' + ext + '"'), 'Falta extensión ' + ext);
  }
  assert.ok(!share.includes('"flac", "zip"'), 'No se debe ofrecer FLAC como descodificador probado');
  assert.ok(!share.includes('"jpeg", "webp"'), 'No se debe ofrecer WEBP sin OCR probado');
  assert.ok(share.includes('imageExtensions'));
});

test('FictionBook FB2 elimina las imágenes base64 antes de extraer texto', () => {
  assert.ok(formats.includes('case "fb2":'));
  assert.ok(formats.includes('(?is)<binary'));
  assert.ok(formats.includes('NativeDocumentText.extract(Data(clean.utf8)'));
  assert.ok(catalogs.includes('"fb2"'));
});

test('OpenDocument ODT lee su XML de contenido sin ejecutar macros', () => {
  assert.ok(formats.includes('case "odt":'));
  assert.ok(formats.includes('all.filter { $0 == "content.xml" }'));
  assert.ok(formats.includes('text:h'));
  assert.ok(catalogs.includes('"odt"'));
  assert.ok(reader.includes('"fb2", "odt"'));
});

test('Los ZIP no incorporan pistas falsas de __MACOSX ni archivos AppleDouble', () => {
  assert.ok(formats.includes('"__MACOSX"'));
  assert.ok(formats.includes('hasPrefix("._")'));
  assert.ok(formats.includes('entries <= 4000'));
});
