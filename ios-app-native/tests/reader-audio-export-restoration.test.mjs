import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../Sources/', import.meta.url);
const reader = readFileSync(new URL('NativeTifloLector.swift', root), 'utf8');
const exporter = readFileSync(new URL('NativeGeminiAudioExport.swift', root), 'utf8');
const daisy = readFileSync(new URL('NativeGeminiDaisyExport.swift', root), 'utf8');

test('el lector restaura la elección MP3, M4A, WAV o DAISY', () => {
  assert.match(reader, /Button\("Exportar audio o DAISY"\)/);
  assert.match(reader, /NativeGeminiAudioExport\.Format\.allCases/);
  assert.match(exporter, /case mp3 = "MP3"/);
  assert.match(exporter, /case m4a = "M4A"/);
  assert.match(exporter, /case wav = "WAV"/);
  assert.match(exporter, /case daisy = "DAISY"/);
});

test('la exportación ofrece compartir o regresar sin compartir', () => {
  assert.match(reader, /Button\("No compartir y volver a la biblioteca"\)/);
  assert.match(reader, /confirmationDialog\("Exportación completada"/);
  assert.match(reader, /NativeGeminiAudioExport\.export\(/);
});

test('el DAISY recuperado conserva texto audio y navegación SMIL', () => {
  assert.match(daisy, /\.smil/);
  assert.match(daisy, /\.ncx/);
  assert.match(daisy, /audio.*\.mp3/);
});
