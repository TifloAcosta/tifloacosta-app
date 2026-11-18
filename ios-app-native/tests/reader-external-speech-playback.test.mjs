import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../Sources/', import.meta.url);
const reader = readFileSync(new URL('NativeTifloLector.swift', root), 'utf8');
const settings = readFileSync(new URL('NativeReaderSettings.swift', root), 'utf8');

test('la lectura puede usar el motor externo seleccionado sin afectar a voces iOS', () => {
  assert.match(reader, /speechEngine == "gemini"/);
  assert.match(reader, /speech\.playExternalText\(/);
  assert.match(reader, /speech\.play\(remainder, speed: speed/);
  assert.match(settings, /title: "Motor de lectura"/);
});

test('el motor externo conserva la pausa mientras espera audio y cancela tareas al parar', () => {
  assert.match(reader, /private var externalTask: Task<Void, Never>\?/);
  assert.match(reader, /externalTask\?\.cancel\(\)/);
  assert.match(reader, /if isPaused \{ externalPendingData = data; return \}/);
  assert.match(reader, /if externalActive/);
});
