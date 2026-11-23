import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = name => readFileSync(new URL('../Sources/'+name,import.meta.url),'utf8');
const settings=read('NativeReaderSettings.swift');
const reader=read('NativeTifloLector.swift');
const phonon=read('NativePhononRuntime.swift');
const store=read('NativeReaderGeneratedVoiceVolume.swift');
const workflow=readFileSync(new URL('../../.github/workflows/ios-next-beta-validation.yml',import.meta.url),'utf8');

test('Gemini and Phonon voice volume controls are individually persisted and accessible', () => {
  assert.match(settings,/struct NativeReaderGeneratedVoiceVolumeControls: View/);
  assert.match(settings,/NativeAdjustableChoice\(title: "Volumen de esta voz"/);
  assert.match(settings,/NativeReaderGeneratedVoiceVolume[.]setLevel/);
  assert.match(settings,/chosenEngine == 1 \|\| chosenEngine == 2/);
  assert.match(settings,/voice: chosenEngine == 1 \? chosenGeminiVoice : chosenPhononVoice/);
  assert.match(store,/engine == 1 \|\| engine == 2/);
  assert.match(store,/native-reader-generated-voice-volume-/);
  assert.match(store,/Float\(level\(engine: engine, voice: voice, defaults: defaults\)\) \/ 20/);
});

test('generated playback, live changes and Phonon preview apply voice gain only', () => {
  const start=reader.indexOf('    private func playNextGeminiSegment()');
  const finish=reader.indexOf('    private func startAudio(_ url:',start);
  const generated=reader.slice(start,finish);
  assert.match(generated,/audio[.]volume = NativeReaderGeneratedVoiceVolume[.]gain/);
  assert.match(generated,/func updateLiveGeneratedVolume\(\)/);
  assert.match(generated,/player[.]volume = NativeReaderGeneratedVoiceVolume[.]gain/);
  assert.match(reader,/speech[.]updateLiveGeneratedVolume\(\)/);
  assert.match(phonon,/player\?[.]volume = NativeReaderGeneratedVoiceVolume[.]gain/);
  assert.doesNotMatch(generated,/MPVolumeView|outputVolume/);
});

test('Swift smoke checks separate voice identities, bounds and defaults', () => {
  assert.match(workflow,/reader-generated-voice-volume-smoke[.]swift/);
  const smoke=readFileSync(new URL('reader-generated-voice-volume-smoke.swift',import.meta.url),'utf8');
  assert.match(smoke,/engine: 1, voice: "Kore"/);
  assert.match(smoke,/engine: 2, voice: "Kore"/);
  assert.match(smoke,/engine: 1, voice: "Aoede"/);
});
