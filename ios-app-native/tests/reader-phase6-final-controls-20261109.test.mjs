import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../Sources/NativeTifloLector.swift', import.meta.url), 'utf8');

test('La fase 6 ofrece un único botón de Reproducir y Pausar y gestos por unidad', () => {
  const row = source.slice(source.indexOf('private var playbackRow: some View'), source.indexOf('private var trackButtons: some View'));
  assert.match(row, /Button\(speech\.isPlaying \? "Pausar" : "Reproducir"\)/);
  assert.match(row, /\.accessibilityAdjustableAction/);
  assert.match(row, /moveUnit\(1\)/);
  assert.match(row, /moveUnit\(-1\)/);
  assert.doesNotMatch(row, /Button\("Detener"\)/);
});

test('Navegación adaptable no conserva un modo inexistente del libro anterior', () => {
  assert.match(source, /private var effectiveNavigationUnit: Int/);
  assert.match(source, /let unit = effectiveNavigationUnit/);
  assert.match(source, /unit: unit/);
});

test('Navegación, marcas y apagado preceden al texto; ajustes secundarios quedan después', () => {
  const controls = source.slice(source.indexOf('private var quickControls: some View'), source.indexOf('private func readerFragment('));
  const labels = ['title: "Modo de navegación"', 'Button("Añadir marca")', 'title: "Apagado automático"', 'Button("Marcas guardadas")', 'Button("Audio")', 'Button("Visual")'];
  const indices = labels.map(s => controls.indexOf(s));
  assert.ok(indices.every(i => i >= 0));
  assert.ok(indices.every((v, i) => i === 0 || v > indices[i-1]));
  assert.match(source, /LabeledContent\("Páginas identificadas"/);
  assert.match(source, /Tiempo restante estimado/);
});

test('Toque mágico solo controla una reproducción existente sin iniciar audio externo', () => {
  const chrome = source.slice(source.lastIndexOf('.accessibilityAction(.magicTap)'), source.lastIndexOf('.accessibilityAction(named: Text("Añadir marca"))'));
  assert.match(chrome, /\.accessibilityAction\(\.magicTap\)/);
  assert.match(chrome, /if speech\.isPlaying/);
  assert.match(chrome, /else if speech\.isPaused/);
  assert.doesNotMatch(chrome, /\bplay\(\)/);
});
