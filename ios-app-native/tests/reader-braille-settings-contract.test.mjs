import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = name => readFileSync(new URL('../Sources/' + name, import.meta.url), 'utf8');
const reader = source('NativeTifloLector.swift');
const settings = source('NativeReaderSettings.swift');

test('braille is a persistent reading mode without a character cutoff', () => {
  const storage = /@AppStorage\("native-reader-presentation-mode"\) private var presentationMode = 0/;
  assert.match(settings, storage);
  assert.match(reader, storage);
  assert.match(settings, /choices: \["Voz TTS", "Lectura visual", "Línea braille"\]/);
  assert.match(reader, /if presentationMode == 2 && !latest\.body\.isEmpty/);
  assert.match(reader, /NativeBrailleContinuousText\(/);
  assert.match(reader, /private struct NativeBrailleContinuousText: UIViewRepresentable/);
  assert.match(reader, /view\.isEditable = false/);
  assert.match(reader, /if view\.text != text \{\s*view\.text = text/);
  assert.doesNotMatch(reader, /12_000/);
});

test('braille options describe VoiceOver ownership and expose functional navigation', () => {
  assert.match(settings, /Section\("Línea braille"\)/);
  assert.match(settings, /selectedIndex: \$navigationUnit/);
  assert.match(settings, /avance automático se activa y ajusta en VoiceOver/);
  assert.match(settings, /Ajustes del iPhone, Accesibilidad, VoiceOver, Braille/);
});

test('braille navigation moves the native text selection without resetting it on each render', () => {
  assert.match(reader, /let requestedOffset: Int/);
  assert.match(reader, /context\.coordinator\.lastAppliedOffset != requestedOffset/);
  assert.match(reader, /view\.selectedRange = NSRange\(location:/);
  assert.match(reader, /requestedOffset: brailleRequestedOffset/);
  assert.match(reader, /brailleRequestedOffset = readingOffset/);
});
