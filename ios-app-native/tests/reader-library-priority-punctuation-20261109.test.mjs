import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const reader = readFileSync(new URL('../Sources/NativeTifloLector.swift', import.meta.url), 'utf8');
const settings = readFileSync(new URL('../Sources/NativeReaderSettings.swift', import.meta.url), 'utf8');

test('La biblioteca presenta Importar y documentos antes de opciones secundarias', () => {
  const screen = reader.slice(reader.indexOf('struct NativeReaderLibraryScreen: View'),
                              reader.indexOf('private struct NativeReaderTextLayout'));
  const positions = [
    'Button("Importar", systemImage:',
    'Section("Mi biblioteca")',
    'Section("Filtrar y ordenar")',
    'Section("Carpetas")',
    'Section("Más opciones")'
  ].map(item => screen.indexOf(item));
  assert.ok(positions.every(value => value >= 0), 'Faltan secciones');
  assert.ok(positions.every((value, index) => !index || value > positions[index - 1]),
            'La biblioteca debe preceder a filtros, carpetas y ajustes');
});

test('Pausas Normal Mayor Expresiva y Personalizadas ofrecen ajustes reales por signo', () => {
  assert.match(settings, /choices: \["Normal", "Mayor", "Expresiva", "Personalizadas"\]/);
  assert.match(settings, /private let choices = \(0\.\.\.30\)\.map/);
  for (const name of ['comma', 'semicolon', 'colon', 'sentence', 'paragraph']) {
    assert.match(settings, new RegExp('native-reading-pause-' + name));
  }
  assert.match(settings, /NativeReaderPauseProfile/);
  assert.match(reader, /NativeReaderPauseProfile\.segments\(text\)/);
  assert.match(reader, /utterance\.postUtteranceDelay =/);
  assert.match(reader, /utteranceOffsets\[identifier\] = utf16Offset/);
  assert.match(reader, /self\.lastSpeechUtterance == ObjectIdentifier\(utterance\)/);
});

test('Lectura por fragmentos ignora eventos de una reproducción ya cancelada', () => {
  assert.match(reader, /guard let segmentBase = self\.utteranceOffsets\[ObjectIdentifier\(utterance\)\] else/);
  assert.match(reader, /utteranceOffsets\.removeAll\(\)/);
  assert.match(reader, /lastSpeechUtterance = identifier/);
});
