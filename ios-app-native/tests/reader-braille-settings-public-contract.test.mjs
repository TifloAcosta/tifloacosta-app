import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = file => readFileSync(new URL('../Sources/' + file, import.meta.url), 'utf8');
const settings = read('NativeReaderSettings.swift');
const reader = read('NativeTifloLector.swift');

test('braille guidance appears directly when Braille is the selected mode', () => {
  assert.match(settings, /selectedIndex: \$presentationMode/);
  assert.match(settings, /else \{\s+Section\("Línea braille"\)/);
  assert.match(settings, /avance automático se configura en VoiceOver/);
  assert.match(settings, /Unidad de navegación de TifloLector/);
  assert.match(settings, /@AppStorage\("native-reader-reading-mode"\)/);
});

test('reading focus preference remains available only in voice mode', () => {
  assert.match(settings, /Toggle\("Foco inicial en Reproducir", isOn: automaticReadingBinding\)/);
  assert.match(settings, /get: \{ readingMode == 1 \}/);
  assert.match(settings, /set: \{ readingMode = \$0 \? 1 : 0 \}/);
  assert.match(settings, /if presentationMode == 0 \{/);
  assert.match(settings, /else if presentationMode == 1 \{/);
});

test('the actual document title exposes Exportar as a VoiceOver action', () => {
  assert.match(reader, /ToolbarItem\(placement: \.principal\)/);
  assert.match(reader, /accessibilityAction\(named: Text\("Exportar"\)\)/);
  assert.match(reader, /accessibilityAction\(named: Text\("Compartir"\)\)/);
  assert.match(reader, /private func shareCurrentDocument\(\)/);
});

test('opening preference focuses play or text without automatic speech', () => {
  assert.match(settings, /Toggle\("Foco inicial en Reproducir", isOn: automaticReadingBinding\)/);
  assert.match(reader, /@AccessibilityFocusState private var playbackButtonFocused: Bool/);
  assert.match(reader, /\.accessibilityFocused\(\$playbackButtonFocused\)/);
  assert.match(reader, /if readingMode == 1 \{ playbackButtonFocused = true \}/);
  assert.doesNotMatch(reader, /startAutomaticReadingAfterOpening\(/);
});
