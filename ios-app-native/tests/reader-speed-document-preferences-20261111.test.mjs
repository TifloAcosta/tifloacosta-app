import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = file => readFileSync(new URL('../Sources/' + file, import.meta.url), 'utf8');
const settings = read('NativeReaderSettings.swift');
const reader = read('NativeTifloLector.swift');

test('El selector TTS ofrece pasos 0,05 y conserva índices anteriores', () => {
  assert.match(settings, /static let rates: \[Double\] = \(15\.\.\.30\)\.map/);
  assert.match(settings, /Double\(\$0\) \/ 20\.0/);
  assert.match(settings, /private static let legacyRates: \[Double\]/);
  assert.match(settings, /stored >= 100/);
  assert.match(settings, /100 \+ max\(0,/);
  assert.match(settings, /selectedIndex: speedChoiceBinding/);
  assert.match(reader, /NativeReaderSpeedOptions\.rate\(for: effectiveSpeedIndex\)/);
  assert.match(reader, /NativeReaderSpeedOptions\.rate\(for: chosenSpeed\)/);
});

test('Motor y voces externas se guardan por obra y no sobrescriben el general', () => {
  for (const field of ['readingEngineIndex', 'geminiVoiceID', 'phononVoiceID']) {
    assert.match(reader, new RegExp('var ' + field + ':'));
    assert.match(settings, new RegExp('readerPreferences\\?\\.' + field));
  }
  assert.match(settings, /readingEngineSelection \?\? \$readingEngine/);
  assert.match(settings, /geminiVoiceSelection \?\? \$geminiVoice/);
  assert.match(reader, /if effectiveReadingEngine == 1/);
  assert.match(reader, /if effectiveReadingEngine == 2/);
  assert.match(reader, /voice: effectiveGeminiVoice/);
  assert.match(reader, /voice: effectivePhononVoice/);
});
