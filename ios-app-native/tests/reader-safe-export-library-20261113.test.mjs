import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../Sources/NativeTifloLector.swift', import.meta.url), 'utf8');
const start = src.indexOf('private func exportGeneratedAudio()');
const end = src.indexOf('private var audioExportSheet: some View', start);
const exportFlow = src.slice(start, end);

test('completed MP3 and DAISY exports enter the durable library before user sharing', () => {
  assert.match(exportFlow, /library\.importDocuments\(from: \[url\]/);
  assert.match(exportFlow, /originalRelativePath/);
  assert.doesNotMatch(exportFlow, /NativeShare\.present\(url: url\)/);
});

test('the share dialog uses the stored URL and Cancel only dismisses the dialog', () => {
  assert.match(src, /Button\("Compartir"\)/);
  assert.match(src, /Button\("Cancelar", role: \.cancel\)/);
  assert.match(src, /Conversión completada\. Archivo guardado en la biblioteca/);
});
