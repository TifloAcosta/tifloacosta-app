import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = file => readFileSync(new URL('../Sources/' + file, import.meta.url), 'utf8');
const settings = read('NativeReaderSettings.swift');
const reader = read('NativeTifloLector.swift');

test('braille guidance lives in its own destination independently of playback mode', () => {
  assert.match(settings, /NavigationLink\("Lectura con línea braille"\)/);
  assert.match(settings, /Duración del avance automático/);
  assert.match(settings, /Cambio de página automático/);
  assert.match(settings, /@AppStorage\("native-reader-reading-mode"\)/);
});

test('the actual document title exposes Exportar as a VoiceOver action', () => {
  assert.match(reader, /ToolbarItem\(placement: \.principal\)/);
  assert.match(reader, /accessibilityAction\(named: Text\("Exportar"\)\)/);
});
