import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = name => readFileSync(new URL('../Sources/' + name, import.meta.url), 'utf8');
const reader = source('NativeTifloLector.swift');
const audio = source('NativeGeminiAudioExport.swift');
const settings = source('NativeReaderSettings.swift');

test('finished conversion offers explicit return to the library alongside sharing', () => {
  const completion = reader.slice(reader.indexOf('.alert("Conversión completada. Archivo guardado en la biblioteca"'));
  assert.match(completion, /Button\("Volver a la biblioteca"\)/);
  assert.match(completion, /dismiss\(\)/);
  assert.match(completion, /Button\("Compartir"\)/);
});

test('resuming paused text uses exact readingOffset rather than a stale segment cursor', () => {
  const play = reader.slice(reader.lastIndexOf('private func play() {'));
  assert.match(play, /if speech\.isPaused && tracks\.isEmpty \{[\s\S]*?startTextSpeech\(\)/);
});

test('audio export strips Markdown heading markers only from text sent to synthesizers', () => {
  assert.match(audio, /static func spokenText\(_ text: String\) -> String/);
  assert.match(audio, /#"\(\?m\)\^#\{1,6\}\(\?=\[ \\t\]\)"#/);
  assert.match(audio, /let spoken = spokenText\(text\)/);
});

test('voice adjustments can be previewed and saved separately for each system voice', () => {
  const profiles = source('NativeReaderVoiceProfiles.swift');
  assert.match(profiles, /struct NativeReaderVoiceProfile: Codable/);
  assert.match(profiles, /static func save\(/);
  assert.match(profiles, /static func load\(/);
  assert.match(settings, /Button\("Escuchar muestra"\)/);
  assert.match(settings, /Button\("Guardar ajustes de esta voz"\)/);
  assert.match(settings, /NativeReaderVoiceProfiles\.load\(/);
  assert.match(settings, /NativeReaderVoiceProfiles\.save\(/);
});

test('system TTS has its own volume independent of VoiceOver and device volume', () => {
  assert.match(settings, /@AppStorage\("native-reading-volume-index"\)/);
  assert.match(settings, /title: "Volumen de la voz"/);
  assert.match(reader, /utterance\.volume =/);
});
