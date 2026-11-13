import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../Sources/NativePocketTtsTrial.swift', import.meta.url), 'utf8');
const settings = readFileSync(new URL('../Sources/NativeReaderExternalVoiceCredentials.swift', import.meta.url), 'utf8');
const project = readFileSync(new URL('../project.yml', import.meta.url), 'utf8');

test('Pocket TTS experimental runs only Spanish, with no English fallback', () => {
  assert.match(source, /PocketTtsManager\(language: \.spanish\)/);
  assert.doesNotMatch(source, /language: \.english/);
  assert.match(settings, /Pocket TTS \(prueba en español\)/);
  assert.match(project, /FluidAudio:/);
  assert.match(project, /- package: FluidAudio/);
});

test('voice cloning is a deliberate import with consent, not automatic microphone capture', () => {
  assert.match(source, /fileImporter\(/);
  assert.match(source, /consentToClone/);
  assert.match(source, /cloneVoice\(from:/);
  assert.match(source, /Detener muestra/);
  assert.doesNotMatch(source, /AVAudioRecorder/);
});
