import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const reader = readFileSync(new URL('../Sources/NativeTifloLector.swift', import.meta.url), 'utf8');
const settings = readFileSync(new URL('../Sources/NativeReaderSettings.swift', import.meta.url), 'utf8');

test('Navigation options expose bookmarks and time only when supported', () => {
  assert.match(reader, /\(5, "Marcas"\), \(6, "Tiempo, un minuto"\)/);
  assert.match(reader, /tracks\.isEmpty \? \[\] : \[\(6, "Tiempo, un minuto"\)\]/);
  assert.match(reader, /title: "Modo de navegación"/);
  assert.match(settings, /"Marcas", "Tiempo, un minuto \(solo audio\)"/);
});

test('Navigation actions include previous and next bookmarks and exact minute jumps', () => {
  assert.match(reader, /Button\("Anterior"\) \{ moveUnit\(-1\) \}/);
  assert.match(reader, /Button\("Siguiente"\) \{ moveUnit\(1\) \}/);
  assert.match(reader, /private func moveToAudioBookmark\(_ direction: Int\)/);
  assert.match(reader, /private var sortedTextMarkOffsets: \[Int\]/);
  assert.match(reader, /Double\(direction\) \* 60/);
  assert.match(reader, /speech\.seek\(seconds: destination\)/);
  assert.match(reader, /Button\("Retroceder 30 segundos"\)/);
  assert.match(reader, /Button\("Avanzar 30 segundos"\)/);
});
