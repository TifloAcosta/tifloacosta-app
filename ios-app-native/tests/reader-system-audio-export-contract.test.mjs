import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const root = new URL('../Sources/', import.meta.url);
const exportUI = readFileSync(new URL('NativeTifloLector.swift', root), 'utf8');
const pipeline = readFileSync(new URL('NativeGeminiAudioExport.swift', root), 'utf8');
const system = readFileSync(new URL('NativeSystemSpeechExport.swift', root), 'utf8');
const daisy = readFileSync(new URL('NativeGeminiDaisyExport.swift', root), 'utf8');

test('export defaults to iOS System with no API key', () => {
  assert.match(exportUI, /audioExportEngine: NativeGeminiAudioExport\.Engine = \.system/);
  assert.match(exportUI, /Sistema iOS, sin clave y sin conexión/);
  assert.match(exportUI, /Picker\("Voz del sistema"/);
  assert.match(exportUI, /Escuchar muestra de voz/);
  assert.match(pipeline, /case system = "Sistema iOS"/);
  assert.match(pipeline, /case \.system:[\s\S]*?NativeSystemSpeechExport\.generate/);
  assert.match(pipeline, /engine: Engine = \.system/);
});
test('system synthesizer writes PCM audio without external credentials', () => {
  assert.match(system, /AVSpeechSynthesizer\(\)/);
  assert.match(system, /synthesizer\.write\(utterance\)/);
  assert.match(system, /AVAudioConverter\(from: input\.format/);
  assert.match(system, /sampleRate: 24_000/);
  assert.match(system, /NativeGeminiSpeech\.wav\(pcm: pcm\)/);
  assert.doesNotMatch(system, /NativeVoiceCredentialStore|URLSession|https:\/\//);
});
test('DAISY uses normalized system audio and real-duration SMIL clips', () => {
  assert.match(daisy, /NativeGeminiAudioExport\.synthesize/);
  assert.match(daisy, /let pcm = try NativeGeminiAudioExport\.pcm\(bytes\)/);
  assert.match(daisy, /Double\(pcm\.count\) \/ 48000\.0/);
  assert.match(daisy, /NativeGeminiAudioExport\.mp3\(pcm: pcm\)/);
});
