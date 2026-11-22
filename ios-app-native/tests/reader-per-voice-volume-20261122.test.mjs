import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = name => readFileSync(new URL('../Sources/' + name, import.meta.url), 'utf8');
const settings = read('NativeReaderSettings.swift');
const reader = read('NativeTifloLector.swift');

test('per-voice volume remains optional for older saved profiles', () => {
  assert.match(settings, /struct NativeReaderVoiceProfile: Codable, Equatable/);
  assert.match(settings, /var volume: Float\? = nil/);
  assert.match(settings, /NativeReaderVoiceProfileStore\.save\(draft, for: voiceIdentifier\)/);
  assert.match(settings, /NativeAdjustableChoice\(title: "Volumen de esta voz"/);
  assert.match(settings, /draft\.volume = Float\(\$0\) \/ 20/);
});

test('voice preview and actual speech apply the saved utterance volume', () => {
  assert.match(settings, /utterance\.volume = max\(0, min\(1, profile\.volume \?\? 1\)\)/);
  assert.match(reader, /utterance\.volume = max\(0, min\(1, NativeReaderVoiceProfileStore\.load\(for: voiceIdentifier\)\?\.volume \?\? 1\)\)/);
  assert.ok(reader.split('utterance.volume = max(').length >= 3);
  assert.doesNotMatch(reader, /MPVolumeView|outputVolume\s*=/);
});

test('volume label exists in five translated interface catalogues', () => {
  for (const language of ['en', 'pt', 'fr', 'it', 'de']) {
    const contents = read(language + '.lproj/Localizable.strings');
    assert.ok(contents.includes('"Volumen de esta voz" = '), language);
  }
});
