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

test('reading mode uses a double-tap toggle and keeps braille settings inside its destination', () => {
  assert.match(settings, /Toggle\("Foco inicial en Reproducir", isOn: automaticReadingBinding\)/);
  assert.match(settings, /get: \{ readingMode == 1 \}/);
  assert.match(settings, /set: \{ readingMode = \$0 \? 1 : 0 \}/);
  const readingModeScreen = settings.slice(settings.indexOf('NavigationLink("Modo de lectura")'));
  const braille = readingModeScreen.indexOf('NavigationLink("Lectura con línea braille")');
  const nextTopLevel = readingModeScreen.indexOf('NavigationLink("Ajustes visuales")');
  assert.ok(braille > 0 && braille < nextTopLevel);
  assert.equal((settings.match(/NavigationLink\("Lectura con línea braille"\)/g) ?? []).length, 1);
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
