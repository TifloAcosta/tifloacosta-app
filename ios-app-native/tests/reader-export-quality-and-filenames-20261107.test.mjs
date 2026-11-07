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

test('DAISY exports use the same reading speed and pitch as the open document', () => {
  const reader = src('NativeTifloLector.swift');
  assert.match(reader, /engine: engine, speed: speed, pitch: pitch/);
  assert.match(audio, /NativeSystemSpeechExport\.generate\(text, voice: voice, speed: speed, pitch: pitch\)/);
  assert.match(daisy, /speed: speed, pitch: pitch\)/);
  assert.match(wav, /utterance\.pitchMultiplier = max\(0\.5, min\(2, pitch\)\)/);
});
test('export names retain titles and avoid UUIDs for visible files', () => {
  assert.match(audio, /let cleaned = title\.replacingOccurrences/);
  assert.match(audio, /while FileManager\.default\.fileExists\(atPath: candidate\.path\)/);
  assert.match(audio, /fileExtension: format == \.mp3 \? "mp3" : "m4a"/);
  assert.match(daisy, /title: title, fileExtension: "zip"/);
});
