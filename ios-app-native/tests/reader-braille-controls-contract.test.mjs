import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../Sources/NativeTifloLector.swift', import.meta.url), 'utf8');
const section = (begin, end) => source.split(begin)[1]?.split(end)[0] ?? '';

test('reader quick controls appear in requested order before text', () => {
  const controls = section('private var quickControls: some View {', 'private var readerFooterControls');
  const labels = ['playbackRow', 'Modo de navegación', 'Añadir marca', 'Apagado automático', 'Ir a posición'];
  const positions = labels.map(label => controls.indexOf(label));
  assert.ok(positions.every(pos => pos >= 0));
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
  assert.doesNotMatch(controls, /Button\("Información"|Button\("Buscar en el documento"|Button\("Marcas guardadas"/);
});

test('marks and visual/audio settings follow the document text', () => {
  const chrome = section('private var readerChrome: some View {', 'private var readerWithSheets');
  assert.match(chrome, /translatedReadingContent\s+readerFooterControls/);
  const footer = section('private var readerFooterControls: some View {', 'private var readerChrome');
  assert.match(footer, /Button\("Marcas guardadas"/);
  assert.match(footer, /Button\("Audio"/);
  assert.match(footer, /Button\("Visual"/);
});

test('actions retain information and search but do not duplicate bookmark controls', () => {
  const actions = section('private var documentActions: some View {', 'private var bookmarksSheetContent');
  assert.match(actions, /Button\("Información de la obra"/);
  assert.match(actions, /Button\("Buscar en el documento"/);
  assert.doesNotMatch(actions, /Button\("Marcas guardadas"|Button\("Añadir marca"/);
});
