import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../Sources/NativeTifloLector.swift', import.meta.url), 'utf8');

test('la biblioteca aparece inmediatamente después de Importar y antes de opciones auxiliares', () => {
  const screen = source.slice(source.indexOf('var body: some View {', source.indexOf('struct NativeTifloLector')));
  const positions = [
    screen.indexOf('Button("Importar"'),
    screen.indexOf('Section("Mi biblioteca")'),
    screen.indexOf('Section("Filtrar y ordenar")'),
    screen.indexOf('Section("Carpetas")'),
    screen.indexOf('NavigationLink("Ajustes")'),
  ];
  assert.ok(positions.every(position => position >= 0), 'faltan secciones principales');
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
});

test('lectura mantiene Reproducir/Pausa, Crear marca y Buscar visibles sin Detener', () => {
  const reading = source.slice(source.indexOf('struct NativeReadingScreen'));
  const controls = reading.slice(reading.indexOf('private var quickControls:'), reading.indexOf('private func readerFragment'));
  assert.ok(controls.includes('playbackRow'));
  assert.ok(controls.includes('Button("Añadir marca")'));
  assert.ok(controls.includes('Button("Buscar en el documento")'));
  assert.ok(controls.indexOf('Button("Añadir marca")') < controls.indexOf('Button("Buscar en el documento")'));
  const playback = reading.slice(reading.indexOf('private var playbackRow:'), reading.indexOf('private var trackButtons:'));
  assert.ok(!playback.includes('Button("Detener")'));
});
