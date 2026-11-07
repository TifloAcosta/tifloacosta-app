import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const src = name => readFileSync(new URL('../Sources/' + name, import.meta.url), 'utf8');
const wav = src('NativeSystemSpeechExport.swift');
const audio = src('NativeGeminiAudioExport.swift');
const daisy = src('NativeGeminiDaisyExport.swift');

test('local voice keeps continuity between synthesis buffers and prevents PCM overload', () => {
  assert.match(wav, /let conversion = PCMConversionState\(\)/);
  assert.match(wav, /private var converter: AVAudioConverter\?/);
  assert.match(wav, /converter\?\.inputFormat != input\.format/);
  assert.match(wav, /let headroom: Float = 0\.88/);
  assert.match(wav, /channel\[index\] \* headroom/);
});
test('DAISY MP3 speech encoding uses 128 kbps and preserves document title', () => {
  assert.match(audio, /bitrateKbps: 128, mode: \.mono/);
  assert.match(audio, /static func destination\(title: String, fileExtension: String\)/);
  assert.match(daisy, /NativeGeminiAudioExport\.destination\(/);
  assert.match(daisy, /title: title, fileExtension: "zip"/);
  assert.doesNotMatch(daisy, /appendingPathComponent\("TifloLector-\\\(uuid\)\.zip"\)/);
});
