import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const reader = readFileSync(new URL('../Sources/NativeTifloLector.swift', import.meta.url), 'utf8');
const settings = readFileSync(new URL('../Sources/NativeReaderSettings.swift', import.meta.url), 'utf8');
const section = (source, start, end) => source.split(start)[1]?.split(end)[0] ?? '';

test('reading mode offers voice visual and braille independently of old focus preference', () => {
  const mode = section(settings, 'NavigationLink("Modo de lectura")', 'NavigationLink("Ajustes visuales")');
  assert.match(mode, /choices:\s*\["Voz", "Visual", "Braille"\]/);
  assert.match(settings, /@AppStorage\("native-reader-presentation-mode"\)/);
  assert.match(settings, /@AppStorage\("native-reader-reading-mode"\)/);
  assert.match(reader, /@AppStorage\("native-reader-presentation-mode"\)/);
  assert.match(reader, /presentationMode == 0/);
});

test('minute navigation is one selection, not a second interval control', () => {
  const controls = section(reader, 'private var quickControls: some View {', 'private var readerFooterControls');
  assert.match(reader, /\(5, "Un minuto"\)/);
  assert.doesNotMatch(controls, /Intervalo de tiempo/);
  assert.match(reader, /private let timeStep = 60/);
});

test('magic tap can start playback and external controls use the same play pause path', () => {
  const magic = section(reader, '.accessibilityAction(.magicTap)', '.accessibilityAction(named: Text("Añadir marca")');
  assert.match(magic, /else\s*\{\s*play\(\)/);
  assert.match(reader, /MPRemoteCommandCenter/);
  assert.match(reader, /remoteCommandCenter\.playCommand/);
  assert.match(reader, /remoteCommandCenter\.pauseCommand/);
  assert.match(reader, /remoteCommandCenter\.togglePlayPauseCommand/);
  assert.match(reader, /removeTarget/);
});
