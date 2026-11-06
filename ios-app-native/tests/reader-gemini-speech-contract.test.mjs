import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = name => readFileSync(new URL('../Sources/' + name, import.meta.url), 'utf8');
const engine = source('NativeGeminiSpeech.swift');
const ui = source('NativeReaderExternalVoiceCredentials.swift');

test('Gemini TTS uses authorized POST and model audio generation', () => {
  assert.match(engine, /generateContent/);
  assert.match(engine, /responseModalities/);
  assert.match(engine, /"AUDIO"/);
  assert.match(engine, /x-goog-api-key/);
  assert.doesNotMatch(engine, /\?key=/);
  assert.match(engine, /inlineData/);
  assert.match(engine, /Data\(base64Encoded: encoded\)/);
});
test('Only returned audio is played, raw PCM is converted to WAV', () => {
  assert.match(engine, /private var player: AVAudioPlayer\?/);
  assert.match(engine, /AVAudioPlayer\(data: audio\)/);
  assert.match(engine, /static func wav\(pcm: Data/);
  assert.match(engine, /RIFF/);
});
test('Preview is an explicit user action with stop, voice picker and quota warning', () => {
  assert.match(ui, /Picker\("Voz Gemini"/);
  assert.match(ui, /Button\("Escuchar muestra"\)/);
  assert.match(ui, /geminiPreview\.listen/);
  assert.match(ui, /Button\("Detener"\)/);
  assert.match(ui, /puede consumir cuota/);
});
