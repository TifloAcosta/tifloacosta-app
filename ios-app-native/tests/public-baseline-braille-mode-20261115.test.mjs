import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = name => readFileSync(new URL('../Sources/' + name, import.meta.url), 'utf8');
const settings = source('NativeReaderSettings.swift');
const reader = source('NativeTifloLector.swift');

test('Public reader preserves its features while offering three adjustable reading modes', () => {
  for (const mode of ['Voz TTS', 'Lectura visual', 'Línea braille']) {
    assert.ok(settings.includes('"' + mode + '"'), mode);
  }
  assert.match(settings, /@AppStorage\("native-reader-presentation-mode"\)/);
  assert.match(settings, /selectedIndex: \$presentationMode/);
  assert.match(settings, /NativeReaderAudioControls\(\)/);
  assert.match(settings, /NativeReaderVisualControls\(\)/);
});

test('Braille presentation exposes one stable selectable text view rather than separate fragments', () => {
  assert.match(reader, /private struct NativeBrailleContinuousText: UIViewRepresentable/);
  assert.match(reader, /view\.isEditable = false/);
  assert.match(reader, /view\.isSelectable = true/);
  assert.match(reader, /if view\.text != text/);
  assert.match(reader, /if presentationMode == 2 && !latest\.body\.isEmpty/);
  assert.match(reader, /NativeBrailleContinuousText\(/);
  assert.match(reader, /else \{\s+segmentedReadingContent/);
});

test('Azure remains an optional user-keyed speech engine without replacing the public engines', () => {
  const microsoft = source('NativeMicrosoftSpeech.swift');
  assert.match(microsoft, /NativeMicrosoftSpeechKeychain/);
  assert.match(microsoft, /kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly/);
  assert.match(microsoft, /NativeAzureSpeechService/);
  assert.match(settings, /NativeAzureSpeechSettings\(\)/);
  assert.match(reader, /func playAzure\(/);
  assert.match(reader, /NativeAzureSpeechService\.synthesize\(/);
  assert.match(reader, /func playGemini\(/);
  assert.match(reader, /func playPhonon\(/);
  const start = reader.slice(reader.indexOf('private func startTextSpeech()'));
  assert.ok(start.indexOf('if speechProvider == 1') < start.indexOf('effectiveReadingEngine == 1'));
});
