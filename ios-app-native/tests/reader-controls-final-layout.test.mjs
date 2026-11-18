import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../Sources/NativeTifloLector.swift', import.meta.url), 'utf8');
const reading = source.slice(source.indexOf('struct NativeReadingScreen: View'));
const playback = reading.slice(reading.indexOf('private var playbackRow:'), reading.indexOf('private var trackButtons:'));
const controls = reading.slice(reading.indexOf('private var quickControls:'), reading.indexOf('private func readerFragment'));

test('reproducir y desplazarse un minuto comparten el primer grupo de controles', () => {
  assert.match(playback, /Button\("Retroceder un minuto"\)/);
  assert.match(playback, /Button\("Avanzar un minuto"\)/);
  assert.doesNotMatch(playback, /Button\("Detener"\)/);
});

test('información, marcas y apagado automático están disponibles en lectura', () => {
  assert.match(controls, /Button\("Información"\)/);
  assert.match(controls, /Button\("Añadir marca"\)/);
  assert.match(controls, /Button\("Buscar en el documento"\)/);
  assert.match(controls, /title: "Apagado automático"/);
});
